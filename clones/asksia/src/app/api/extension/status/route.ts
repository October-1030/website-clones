import { NextResponse } from "next/server";
import { CloudAuthError, getCloudAuthContext } from "@/lib/cloud/server";
import { listExtensionStatus } from "@/lib/extension/service";
import { ExtensionSyncError } from "@/lib/extension/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const context = await getCloudAuthContext();
    if (context.state !== "authenticated") {
      return NextResponse.json({ authenticated: false, connections: [], captures: [] }, {
        headers: { "Cache-Control": "no-store" },
      });
    }
    return NextResponse.json({ authenticated: true, ...await listExtensionStatus(context) }, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    if (error instanceof CloudAuthError || error instanceof ExtensionSyncError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
    }
    return NextResponse.json({ error: "Unable to load extension sync status.", code: "extension_status_failed" }, { status: 503 });
  }
}
