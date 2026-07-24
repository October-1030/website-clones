import { NextResponse } from "next/server";
import { CloudAuthError, getCloudAuthContext } from "@/lib/cloud/server";
import { getBlackboardConfig } from "@/lib/lms/blackboard";
import { getCanvasOauthConfig } from "@/lib/lms/oauth";
import { listLmsConnections } from "@/lib/lms/service";
import { LmsError } from "@/lib/lms/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const context = await getCloudAuthContext();
    const providers = {
      canvas: {
        manualToken: true,
        oauthConfigured: Boolean(getCanvasOauthConfig()),
        readOnly: true,
      },
      blackboard: {
        configured: Boolean(getBlackboardConfig()),
        readOnly: true,
        administratorManaged: true,
      },
    };
    if (context.state !== "authenticated") {
      return NextResponse.json({
        authenticated: false,
        connections: [],
        courses: [],
        providers,
      });
    }
    const result = await listLmsConnections(context);
    return NextResponse.json({
      authenticated: true,
      ...result,
      providers,
    });
  } catch (error) {
    if (error instanceof CloudAuthError || error instanceof LmsError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
    }
    return NextResponse.json({ error: "Unable to load LMS status.", code: "lms_status_failed" }, { status: 503 });
  }
}
