import { timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { CloudAuthError, requireCloudUser } from "@/lib/cloud/server";
import { CanvasClient } from "@/lib/lms/canvas";
import { exchangeCanvasAuthorizationCode, getCanvasOauthConfig } from "@/lib/lms/oauth";
import { saveCanvasOauthConnection } from "@/lib/lms/service";
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
    const config = getCanvasOauthConfig();
    if (!config) throw new LmsError("Canvas OAuth is not configured.", "canvas_oauth_not_configured", 503);
    const cookieStore = await cookies();
    const expectedState = cookieStore.get("studypal_canvas_oauth_state")?.value || "";
    const receivedState = requestUrl.searchParams.get("state") || "";
    cookieStore.delete("studypal_canvas_oauth_state");
    if (!expectedState || !receivedState || !equalState(expectedState, receivedState)) {
      throw new LmsError("Canvas OAuth state did not match.", "canvas_oauth_state_invalid", 400);
    }
    const code = requestUrl.searchParams.get("code") || "";
    const token = await exchangeCanvasAuthorizationCode(config, code);
    const canvas = new CanvasClient(config.instanceUrl, token.accessToken);
    const profile = await canvas.verifyConnection();
    await saveCanvasOauthConnection(context, {
      instanceUrl: config.instanceUrl,
      accessToken: token.accessToken,
      refreshToken: token.refreshToken,
      expiresAt: token.expiresAt,
      scopes: config.scopes,
      accountLabel: profile.displayName || token.accountLabel,
    });
    returnUrl.searchParams.set("lms", "canvas-connected");
    return NextResponse.redirect(returnUrl, 302);
  } catch (error) {
    const code = error instanceof CloudAuthError || error instanceof LmsError
      ? error.code
      : "canvas_oauth_callback_failed";
    returnUrl.searchParams.set("lms", "error");
    returnUrl.searchParams.set("code", code);
    return NextResponse.redirect(returnUrl, 302);
  }
}
