import { NextResponse } from "next/server";
import { ingestExtensionCapture } from "@/lib/extension/service";
import { ExtensionSyncError } from "@/lib/extension/types";
import {
  extensionCorsHeaders,
  isAllowedExtensionOrigin,
  parseExtensionCaptureInput,
  readExtensionBearerToken,
} from "@/lib/extension/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function json(request: Request, body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: extensionCorsHeaders(request.headers.get("origin")) });
}

export async function OPTIONS(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin || !isAllowedExtensionOrigin(origin)) {
    return json(request, { error: "Extension origin is not allowed.", code: "extension_origin_blocked" }, 403);
  }
  return new Response(null, { status: 204, headers: extensionCorsHeaders(origin) });
}

export async function POST(request: Request) {
  try {
    const origin = request.headers.get("origin");
    if (!isAllowedExtensionOrigin(origin)) {
      return json(request, { error: "Extension origin is not allowed.", code: "extension_origin_blocked" }, 403);
    }
    const contentLength = Number(request.headers.get("content-length") || "0");
    if (contentLength > 180_000) {
      return json(request, { error: "Captured page is too large.", code: "request_too_large" }, 413);
    }
    const token = readExtensionBearerToken(request.headers.get("authorization"));
    const capture = parseExtensionCaptureInput(await request.json().catch(() => null));
    const result = await ingestExtensionCapture(token, capture);
    return json(request, {
      ...result,
      studyUrl: `/pro/session?extensionCapture=${encodeURIComponent(result.captureId)}`,
    }, result.deduplicated ? 200 : 201);
  } catch (error) {
    if (error instanceof ExtensionSyncError) {
      return json(request, { error: error.message, code: error.code }, error.status);
    }
    return json(request, { error: "Unable to import captured page.", code: "extension_import_failed" }, 503);
  }
}
