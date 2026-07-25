import { NextResponse } from "next/server";
import { RequestOriginError, requireSameOriginMutation } from "@/lib/http/same-origin";
import { CloudAuthError, requireCloudUser } from "@/lib/cloud/server";
import { createExtensionToken } from "@/lib/extension/service";
import { ExtensionSyncError } from "@/lib/extension/types";
import { parseExtensionLabel } from "@/lib/extension/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    requireSameOriginMutation(request);
    const contentLength = Number(request.headers.get("content-length") || "0");
    if (contentLength > 2_048) {
      return NextResponse.json({ error: "Extension token request is too large.", code: "request_too_large" }, { status: 413 });
    }
    const context = await requireCloudUser();
    const body = await request.json().catch(() => null) as { label?: unknown } | null;
    const label = parseExtensionLabel(body?.label);
    return NextResponse.json(await createExtensionToken(context, label), {
      status: 201,
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    if (error instanceof CloudAuthError || error instanceof ExtensionSyncError || error instanceof RequestOriginError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
    }
    return NextResponse.json({ error: "Unable to create extension token.", code: "extension_token_create_failed" }, { status: 503 });
  }
}
