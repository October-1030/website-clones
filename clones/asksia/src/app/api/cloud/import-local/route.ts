import { NextResponse } from "next/server";
import { getDeploymentMode } from "@/lib/cloud/config";
import { importLocalSessionsToCloud } from "@/lib/cloud/local-import";
import { CloudAuthError } from "@/lib/cloud/server";
import { CloudStorageError } from "@/lib/cloud/session-repository";
import { RequestOriginError, requireSameOriginMutation } from "@/lib/http/same-origin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    requireSameOriginMutation(request);
    if (getDeploymentMode() === "public") {
      return NextResponse.json(
        { error: "Local server imports are disabled in public deployments.", code: "local_import_disabled" },
        { status: 403 },
      );
    }
    const contentLength = Number(request.headers.get("content-length") || "0");
    if (contentLength > 2_048) {
      return NextResponse.json({ error: "Import request is too large.", code: "request_too_large" }, { status: 413 });
    }
    const body = await request.json() as { confirmation?: unknown };
    if (body.confirmation !== "IMPORT_LOCAL_SESSIONS") {
      return NextResponse.json({ error: "Explicit import confirmation is required.", code: "confirmation_required" }, { status: 400 });
    }
    const imported = await importLocalSessionsToCloud();
    return NextResponse.json({ imported, total: Object.values(imported).reduce((sum, value) => sum + value, 0) });
  } catch (error) {
    if (
      error instanceof CloudAuthError
      || error instanceof CloudStorageError
      || error instanceof RequestOriginError
    ) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
    }
    return NextResponse.json({ error: "Unable to import local sessions.", code: "cloud_import_failed" }, { status: 503 });
  }
}
