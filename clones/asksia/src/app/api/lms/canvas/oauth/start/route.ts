import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { CloudAuthError, requireCloudUser } from "@/lib/cloud/server";
import { buildCanvasAuthorizationUrl, getCanvasOauthConfig } from "@/lib/lms/oauth";
import { LmsError } from "@/lib/lms/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    await requireCloudUser();
    const config = getCanvasOauthConfig();
    if (!config) throw new LmsError("Canvas OAuth is not configured.", "canvas_oauth_not_configured", 503);
    const state = randomBytes(32).toString("base64url");
    const requestUrl = new URL(request.url);
    const cookieStore = await cookies();
    cookieStore.set("studypal_canvas_oauth_state", state, {
      httpOnly: true,
      sameSite: "lax",
      secure: requestUrl.protocol === "https:",
      path: "/api/lms/canvas/oauth",
      maxAge: 10 * 60,
    });
    return NextResponse.redirect(buildCanvasAuthorizationUrl(config, state), 302);
  } catch (error) {
    if (error instanceof CloudAuthError || error instanceof LmsError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
    }
    return NextResponse.json({ error: "Unable to start Canvas OAuth.", code: "canvas_oauth_start_failed" }, { status: 503 });
  }
}
