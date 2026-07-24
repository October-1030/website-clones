import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { CloudAuthError, requireCloudUser } from "@/lib/cloud/server";
import { buildBrightspaceAuthorizationUrl, getBrightspaceOauthConfig } from "@/lib/lms/brightspace";
import { LmsError } from "@/lib/lms/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    await requireCloudUser();
    const config = getBrightspaceOauthConfig();
    if (!config) throw new LmsError("Brightspace OAuth is not configured.", "brightspace_not_configured", 503);
    const state = randomBytes(32).toString("base64url");
    const requestUrl = new URL(request.url);
    const cookieStore = await cookies();
    cookieStore.set("studypal_brightspace_oauth_state", state, {
      httpOnly: true,
      sameSite: "lax",
      secure: requestUrl.protocol === "https:",
      path: "/api/lms/brightspace/oauth",
      maxAge: 10 * 60,
    });
    return NextResponse.redirect(buildBrightspaceAuthorizationUrl(config, state), 302);
  } catch (error) {
    if (error instanceof CloudAuthError || error instanceof LmsError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
    }
    return NextResponse.json({ error: "Unable to start Brightspace OAuth.", code: "brightspace_oauth_start_failed" }, { status: 503 });
  }
}