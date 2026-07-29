import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import {
  assertPublicDeploymentConfig,
  getDeploymentMode,
  getSupabasePublicConfig,
} from "./lib/cloud/config";
import { RequestLimitError, requireDeclaredBodySize } from "./lib/http/request-limit";
import { RequestOriginError, requireSameOriginMutation } from "./lib/http/same-origin";

type RateBucket = { count: number; resetAt: number };

const rateBuckets = new Map<string, RateBucket>();
const PUBLIC_API_EXEMPTIONS = new Set(["/api/cloud/status", "/api/extension/import", "/api/health"]);
const EMPTY_BODY_POSTS = [
  /^\/api\/extension\/captures\/[^/]+\/study$/,
  /^\/api\/lms\/connections\/[^/]+\/sync$/,
];

function jsonError(error: string, code: string, status: number, headers?: HeadersInit) {
  return NextResponse.json({ error, code }, { status, headers });
}

function isUnsafeMethod(method: string): boolean {
  return method !== "GET" && method !== "HEAD" && method !== "OPTIONS";
}

function requestBodyLimit(pathname: string): number {
  if (pathname === "/api/transcribe") return 52 * 1024 * 1024;
  if (pathname === "/api/study/extract") return 12 * 1024 * 1024;
  if (pathname === "/api/study/ask") return 1024 * 1024;
  return 1024 * 1024;
}

function allowsEmptyBody(pathname: string, method: string): boolean {
  return method === "DELETE" || EMPTY_BODY_POSTS.some((pattern) => pattern.test(pathname));
}

function ratePolicy(pathname: string): { limit: number; group: string } {
  if (pathname === "/api/transcribe") return { limit: 2, group: "transcribe" };
  if (
    pathname.startsWith("/api/study/")
    || pathname.startsWith("/api/homework/")
    || pathname.startsWith("/api/video/")
    || pathname.startsWith("/api/web-search")
    || pathname.startsWith("/api/writing/")
    || pathname.includes("/study")
  ) {
    return { limit: 12, group: "ai" };
  }
  return { limit: 60, group: "standard" };
}

function enforceRateLimit(userId: string, pathname: string): Headers | null {
  const now = Date.now();
  const { limit, group } = ratePolicy(pathname);
  const key = `${userId}:${group}`;
  const existing = rateBuckets.get(key);
  const bucket = !existing || existing.resetAt <= now
    ? { count: 0, resetAt: now + 60_000 }
    : existing;
  bucket.count += 1;
  rateBuckets.set(key, bucket);

  if (rateBuckets.size > 10_000) {
    for (const [candidate, value] of rateBuckets) {
      if (value.resetAt <= now) rateBuckets.delete(candidate);
    }
  }
  if (bucket.count <= limit) return null;

  const retryAfter = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));
  return new Headers({
    "Retry-After": String(retryAfter),
    "X-RateLimit-Limit": String(limit),
    "X-RateLimit-Remaining": "0",
    "X-RateLimit-Reset": String(Math.ceil(bucket.resetAt / 1000)),
  });
}

export async function proxy(request: NextRequest) {
  let publicMode = true;
  try {
    publicMode = getDeploymentMode() === "public";
    if (publicMode) {
      assertPublicDeploymentConfig();
      if (request.nextUrl.pathname.startsWith("/api/") && isUnsafeMethod(request.method)) {
        if (request.nextUrl.pathname !== "/api/extension/import") {
          requireSameOriginMutation(request);
        }
        requireDeclaredBodySize(
          request,
          requestBodyLimit(request.nextUrl.pathname),
          allowsEmptyBody(request.nextUrl.pathname, request.method),
        );
      }
    }
  } catch (error) {
    if (error instanceof RequestOriginError || error instanceof RequestLimitError) {
      return jsonError(error.message, error.code, error.status);
    }
    return jsonError("StudyPal public deployment is not configured safely.", "public_config_invalid", 503);
  }

  const config = getSupabasePublicConfig();
  if (!config || process.env.STUDYPAL_CLOUD_MODE === "off") {
    if (publicMode) return jsonError("StudyPal authentication is unavailable.", "cloud_auth_unavailable", 503);
    return NextResponse.next({ request });
  }

  let response = NextResponse.next({ request });
  const client = createServerClient(config.url, config.publishableKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (cookiesToSet) => {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });
  const { data, error } = await client.auth.getUser();

  if (
    publicMode
    && request.nextUrl.pathname.startsWith("/api/")
    && !PUBLIC_API_EXEMPTIONS.has(request.nextUrl.pathname)
  ) {
    if (error || !data.user) {
      return jsonError("Sign in is required for this StudyPal API.", "cloud_sign_in_required", 401);
    }
    const rateHeaders = enforceRateLimit(data.user.id, request.nextUrl.pathname);
    if (rateHeaders) {
      return jsonError("Too many requests. Try again shortly.", "rate_limit_exceeded", 429, rateHeaders);
    }
  }
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
