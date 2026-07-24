import { createServerClient } from "@supabase/ssr";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { getCloudMode, getSupabasePublicConfig } from "./config";

export type CloudAuthContext =
  | { state: "disabled"; client: null; user: null }
  | { state: "anonymous"; client: SupabaseClient; user: null }
  | { state: "authenticated"; client: SupabaseClient; user: User };

export class CloudAuthError extends Error {
  constructor(message: string, public readonly status = 503, public readonly code = "cloud_auth_failed") {
    super(message);
    this.name = "CloudAuthError";
  }
}

export async function createStudyPalServerClient(): Promise<SupabaseClient | null> {
  const config = getSupabasePublicConfig();
  if (!config || getCloudMode() === "off") return null;
  const cookieStore = await cookies();
  return createServerClient(config.url, config.publishableKey, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (cookiesToSet) => {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Server Components cannot always write cookies. Route handlers and proxy can.
        }
      },
    },
  });
}

function isMissingSession(error: { name?: string; message?: string; code?: string } | null): boolean {
  if (!error) return false;
  return error.name === "AuthSessionMissingError"
    || error.code === "session_not_found"
    || /auth session missing/i.test(error.message || "");
}

export async function getCloudAuthContext(): Promise<CloudAuthContext> {
  const client = await createStudyPalServerClient();
  if (!client) return { state: "disabled", client: null, user: null };
  const { data, error } = await client.auth.getUser();
  if (error && !isMissingSession(error)) {
    throw new CloudAuthError("Unable to verify the cloud session.");
  }
  if (!data.user) {
    if (getCloudMode() === "required") {
      throw new CloudAuthError("Sign in is required for this StudyPal server.", 401, "cloud_sign_in_required");
    }
    return { state: "anonymous", client, user: null };
  }
  return { state: "authenticated", client, user: data.user };
}

export async function requireCloudUser(): Promise<Extract<CloudAuthContext, { state: "authenticated" }>> {
  const context = await getCloudAuthContext();
  if (context.state !== "authenticated") {
    throw new CloudAuthError("Sign in to use StudyPal cloud sync.", 401, "cloud_sign_in_required");
  }
  return context;
}
