import { normalizeCanvasInstanceUrl } from "./validation";
import { LmsError } from "./types";

const READ_ONLY_SCOPES = [
  "url:GET|/api/v1/users/self/profile",
  "url:GET|/api/v1/courses",
  "url:GET|/api/v1/courses/:course_id/modules",
  "url:GET|/api/v1/courses/:course_id/assignments",
  "url:GET|/api/v1/courses/:course_id/files",
  "url:GET|/api/v1/courses/:course_id/pages/:url_or_id",
  "url:GET|/api/v1/files/:id",
];

export interface CanvasOauthConfig {
  instanceUrl: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  scopes: string[];
}

export function getCanvasOauthConfig(
  environment: NodeJS.ProcessEnv = process.env,
): CanvasOauthConfig | null {
  const instanceRaw = environment.CANVAS_INSTANCE_URL?.trim();
  const clientId = environment.CANVAS_CLIENT_ID?.trim();
  const clientSecret = environment.CANVAS_CLIENT_SECRET?.trim();
  const redirectRaw = environment.CANVAS_REDIRECT_URI?.trim();
  if (!instanceRaw && !clientId && !clientSecret && !redirectRaw) return null;
  if (!instanceRaw || !clientId || !clientSecret || !redirectRaw) {
    throw new LmsError("Canvas OAuth configuration is incomplete.", "canvas_oauth_not_configured", 503);
  }
  if (clientId.length > 500 || clientSecret.length > 4_000) {
    throw new LmsError("Canvas OAuth configuration is invalid.", "canvas_oauth_invalid", 503);
  }
  let redirect: URL;
  try {
    redirect = new URL(redirectRaw);
  } catch {
    throw new LmsError("Canvas OAuth redirect URL is invalid.", "canvas_oauth_invalid", 503);
  }
  const local = redirect.hostname === "127.0.0.1" || redirect.hostname === "localhost";
  if ((redirect.protocol !== "https:" && !(local && redirect.protocol === "http:")) || redirect.username || redirect.password) {
    throw new LmsError("Canvas OAuth redirect URL is unsafe.", "canvas_oauth_invalid", 503);
  }
  return {
    instanceUrl: normalizeCanvasInstanceUrl(instanceRaw, environment),
    clientId,
    clientSecret,
    redirectUri: redirect.toString(),
    scopes: READ_ONLY_SCOPES,
  };
}

export function buildCanvasAuthorizationUrl(config: CanvasOauthConfig, state: string): string {
  const url = new URL("/login/oauth2/auth", `${config.instanceUrl}/`);
  url.searchParams.set("client_id", config.clientId);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("redirect_uri", config.redirectUri);
  url.searchParams.set("state", state);
  url.searchParams.set("scope", config.scopes.join(" "));
  return url.toString();
}

interface CanvasTokenResponse {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  token_type?: string;
  user?: { name?: string };
}

export async function exchangeCanvasAuthorizationCode(
  config: CanvasOauthConfig,
  code: string,
  fetchImpl: typeof fetch = fetch,
): Promise<{
  accessToken: string;
  refreshToken: string | null;
  expiresAt: string | null;
  accountLabel: string;
}> {
  const cleanCode = code.trim();
  if (!cleanCode || cleanCode.length > 4_000) {
    throw new LmsError("Canvas authorization code is invalid.", "canvas_oauth_code_invalid", 400);
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 25_000);
  try {
    const response = await fetchImpl(new URL("/login/oauth2/token", `${config.instanceUrl}/`), {
      method: "POST",
      redirect: "manual",
      signal: controller.signal,
      headers: {
        Accept: "application/json",
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        client_id: config.clientId,
        client_secret: config.clientSecret,
        redirect_uri: config.redirectUri,
        code: cleanCode,
      }),
    });
    if (!response.ok) {
      throw new LmsError("Canvas OAuth token exchange failed.", "canvas_oauth_exchange_failed", 502);
    }
    const text = await response.text();
    if (text.length > 100_000) throw new LmsError("Canvas OAuth response is too large.", "canvas_oauth_invalid_response", 502);
    let payload: CanvasTokenResponse;
    try {
      payload = JSON.parse(text) as CanvasTokenResponse;
    } catch {
      throw new LmsError("Canvas OAuth returned malformed JSON.", "canvas_oauth_invalid_response", 502);
    }
    const accessToken = payload.access_token?.trim();
    if (!accessToken || accessToken.length > 8_000) {
      throw new LmsError("Canvas OAuth response did not include a valid access token.", "canvas_oauth_invalid_response", 502);
    }
    const expiresIn = Number(payload.expires_in);
    return {
      accessToken,
      refreshToken: payload.refresh_token?.trim() || null,
      expiresAt: Number.isFinite(expiresIn) && expiresIn > 0
        ? new Date(Date.now() + expiresIn * 1_000).toISOString()
        : null,
      accountLabel: payload.user?.name?.trim().slice(0, 120) || "Canvas",
    };
  } catch (error) {
    if (error instanceof LmsError) throw error;
    if (error instanceof Error && error.name === "AbortError") {
      throw new LmsError("Canvas OAuth token exchange timed out.", "canvas_oauth_timeout", 504);
    }
    throw new LmsError("Canvas OAuth endpoint could not be reached.", "canvas_oauth_unreachable", 502);
  } finally {
    clearTimeout(timeout);
  }
}
