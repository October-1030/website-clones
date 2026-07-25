import { NextResponse } from "next/server";
import { CloudAuthError, requireCloudUser } from "@/lib/cloud/server";
import { revokeExtensionToken } from "@/lib/extension/service";
import { ExtensionSyncError } from "@/lib/extension/types";
import { parseExtensionId, requireSameOriginMutation } from "@/lib/extension/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

export async function DELETE(request: Request, context: RouteContext) {
  try {
    requireSameOriginMutation(request);
    const contentLength = Number(request.headers.get("content-length") || "0");
    if (contentLength > 2_048) {
      return NextResponse.json({ error: "Extension revoke request is too large.", code: "request_too_large" }, { status: 413 });
    }
    const body = await request.json().catch(() => null) as { confirmation?: unknown } | null;
    if (body?.confirmation !== "REVOKE_EXTENSION") {
      return NextResponse.json({ error: "Extension revoke confirmation is required.", code: "extension_revoke_confirmation_required" }, { status: 400 });
    }
    const { id } = await context.params;
    const cloud = await requireCloudUser();
    await revokeExtensionToken(cloud, parseExtensionId(id));
    return NextResponse.json({ revoked: true });
  } catch (error) {
    if (error instanceof CloudAuthError || error instanceof ExtensionSyncError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
    }
    return NextResponse.json({ error: "Unable to revoke extension connection.", code: "extension_revoke_failed" }, { status: 503 });
  }
}
