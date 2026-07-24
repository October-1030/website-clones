import { timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { CloudAuthError, requireCloudUser } from "@/lib/cloud/server";
import {
  BrightspaceClient,
  exchangeBrightspaceAuthorizationCode,
  getBrightspaceOauthConfig,
} from "@/lib/lms/brightspace";
import { saveBrightspaceOauthConnection } from "@/lib/lms/service";
import { LmsError } from "@/lib/lms/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function equalState(expected: string, received: string): boolean {
  const left = Buffer.from(expected);
  const right = Buffer.from(received);
  return left.length === right.length && timingSafeEqual(left, right);
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const returnUrl = new URL("/pro/session", requestUrl.origin);
  try {
    const context = await requireCloudUser();
    const config = getBrightspaceOauthConfig();
    if (!config) throw new LmsError("Brightspace OAuth is not configured.", "brightspace_not_configured", 503);
    const cookieStore = await cookies();
    const expectedState = cookieStore.get("studypal_brightspace_oauth_state")?.value || "";
    const receivedState = requestUrl.searchParams.get("state") || "";
    cookieStore.delete("studypal_brightspace_oauth_state");
    if (!expectedState || !receivedState || !equalState(expectedState, receivedState)) {
      throw new LmsError("Brightspace OAuth state did not match.", "brightspace_oauth_state_invalid", 400);
    }
    if (requestUrl.searchParams.get("error")) {
      throw new LmsError("Brightspace authorization was not completed.", "brightspace_oauth_denied", 400);
    }
    const token = await exchangeBrightspaceAuthorizationCode(config, requestUrl.searchParams.get("code") || "");
    const brightspace = new BrightspaceClient(config.instanceUrl, token.accessToken, config);
    const profile = await brightspace.verifyConnection();
    await saveBrightspaceOauthConnection(context, {
      instanceUrl: config.instanceUrl,
      accessToken: token.accessToken,
      refreshToken: token.refreshToken,
      expiresAt: token.expiresAt,
      scopes: config.scopes,
      accountLabel: profile.displayName || "Brightspace",
    });
    returnUrl.searchParams.set("lms", "brightspace-connected");
    return NextResponse.redirect(returnUrl, 302);
  } catch (error) {
    const code = error instanceof CloudAuthError || error instanceof LmsError
      ? error.code
      : "brightspace_oauth_callback_failed";
    returnUrl.searchParams.set("lms", "error");
    returnUrl.searchParams.set("code", code);
    return NextResponse.redirect(returnUrl, 302);
  }
}