import { createHash, randomBytes } from "node:crypto";
import { saveCloudSession } from "../cloud/session-repository";
import { createStudyPalServerClient, type CloudAuthContext } from "../cloud/server";
import { getStudyProvider } from "../study/provider";
import type { StudySession } from "../study/types";
import { consumeAccountUsage } from "../usage/service";
import type { AccountUsageStatus } from "../usage/types";
import type {
  ExtensionCaptureInput,
  ExtensionCaptureSummary,
  ExtensionTokenSummary,
} from "./types";
import { ExtensionSyncError } from "./types";

type AuthenticatedCloud = Extract<CloudAuthContext, { state: "authenticated" }>;

interface ExtensionCaptureRecord {
  id: string;
  source_url: string;
  title: string;
  text_content: string;
  captured_at: string;
  created_at: string;
  metadata: Record<string, unknown> | null;
}

const MAX_ACTIVE_TOKENS = 5;
const TOKEN_LIFETIME_MS = 30 * 24 * 60 * 60_000;

function databaseFailure(message: string): ExtensionSyncError {
  return new ExtensionSyncError(message, "extension_database_failed", 503);
}

function tokenSummary(row: Record<string, unknown>): ExtensionTokenSummary {
  return {
    id: String(row.id),
    label: String(row.label),
    tokenHint: String(row.token_hint),
    expiresAt: String(row.expires_at),
    lastUsedAt: row.last_used_at ? String(row.last_used_at) : null,
    createdAt: String(row.created_at),
  };
}

function captureSummary(row: ExtensionCaptureRecord): ExtensionCaptureSummary {
  const metadata = row.metadata || {};
  return {
    id: row.id,
    sourceUrl: row.source_url,
    title: row.title,
    capturedAt: row.captured_at,
    createdAt: row.created_at,
    scope: metadata.scope === "selection" ? "selection" : "page",
    truncated: metadata.truncated === true,
    wordCount: Number.isFinite(Number(metadata.wordCount)) ? Math.max(0, Number(metadata.wordCount)) : 0,
  };
}

export function hashExtensionToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function createExtensionToken(
  context: AuthenticatedCloud,
  label: string,
): Promise<{ token: string; connection: ExtensionTokenSummary }> {
  const now = new Date();
  const { count, error: countError } = await context.client
    .from("extension_pairing_tokens")
    .select("id", { count: "exact", head: true })
    .eq("user_id", context.user.id)
    .gt("expires_at", now.toISOString());
  if (countError) throw databaseFailure("Unable to inspect extension connections.");
  if ((count || 0) >= MAX_ACTIVE_TOKENS) {
    throw new ExtensionSyncError("Revoke an existing extension connection before creating another.", "extension_token_limit", 409);
  }

  const token = `spx_${randomBytes(32).toString("base64url")}`;
  const expiresAt = new Date(now.valueOf() + TOKEN_LIFETIME_MS).toISOString();
  const tokenHint = `${token.slice(0, 12)}…${token.slice(-4)}`;
  const { data, error } = await context.client
    .from("extension_pairing_tokens")
    .insert({
      user_id: context.user.id,
      label,
      token_hash: hashExtensionToken(token),
      token_hint: tokenHint,
      expires_at: expiresAt,
    })
    .select("id,label,token_hint,expires_at,last_used_at,created_at")
    .single();
  if (error || !data) throw databaseFailure("Unable to create the extension pairing token.");
  return { token, connection: tokenSummary(data as Record<string, unknown>) };
}

export async function listExtensionStatus(context: AuthenticatedCloud): Promise<{
  connections: ExtensionTokenSummary[];
  captures: ExtensionCaptureSummary[];
}> {
  const now = new Date().toISOString();
  const [connectionsResult, capturesResult] = await Promise.all([
    context.client
      .from("extension_pairing_tokens")
      .select("id,label,token_hint,expires_at,last_used_at,created_at")
      .eq("user_id", context.user.id)
      .gt("expires_at", now)
      .order("created_at", { ascending: false })
      .limit(MAX_ACTIVE_TOKENS),
    context.client
      .from("extension_captures")
      .select("id,source_url,title,captured_at,created_at,metadata")
      .eq("user_id", context.user.id)
      .order("captured_at", { ascending: false })
      .limit(20),
  ]);
  if (connectionsResult.error || capturesResult.error) throw databaseFailure("Unable to load extension sync status.");
  return {
    connections: (connectionsResult.data || []).map((row) => tokenSummary(row as Record<string, unknown>)),
    captures: (capturesResult.data || []).map((row) => captureSummary(row as ExtensionCaptureRecord)),
  };
}

export async function revokeExtensionToken(context: AuthenticatedCloud, id: string): Promise<void> {
  const { data, error } = await context.client
    .from("extension_pairing_tokens")
    .delete()
    .eq("id", id)
    .eq("user_id", context.user.id)
    .select("id")
    .maybeSingle();
  if (error) throw databaseFailure("Unable to revoke the extension connection.");
  if (!data) throw new ExtensionSyncError("Extension connection was not found.", "extension_token_not_found", 404);
}

export async function ingestExtensionCapture(
  token: string,
  capture: ExtensionCaptureInput,
): Promise<{ captureId: string; deduplicated: boolean }> {
  const client = await createStudyPalServerClient();
  if (!client) throw new ExtensionSyncError("StudyPal cloud is not configured.", "extension_cloud_unavailable", 503);
  const { data, error } = await client.rpc("ingest_extension_capture", {
    p_token_hash: hashExtensionToken(token),
    p_client_capture_id: capture.clientCaptureId,
    p_source_url: capture.sourceUrl,
    p_title: capture.title,
    p_text_content: capture.textContent,
    p_captured_at: capture.capturedAt,
    p_metadata: capture.metadata,
  });
  if (error) {
    if (error.code === "28000") {
      throw new ExtensionSyncError("The extension pairing token is expired or revoked.", "extension_token_rejected", 401);
    }
    if (error.code === "P0001" && /rate/i.test(error.message || "")) {
      throw new ExtensionSyncError("Too many page captures. Wait a minute and try again.", "extension_rate_limited", 429);
    }
    throw databaseFailure("Unable to save the extension capture.");
  }
  const row = Array.isArray(data) ? data[0] : data;
  if (!row || typeof row.capture_id !== "string") throw databaseFailure("Extension capture response is invalid.");
  return { captureId: row.capture_id, deduplicated: row.deduplicated === true };
}

function captureFileName(title: string): string {
  const safe = title.replace(/[\\/:*?"<>|]/g, " ").replace(/\s+/g, " ").trim().slice(0, 220) || "Captured webpage";
  return `${safe}.txt`;
}

export async function summarizeExtensionCapture(
  context: AuthenticatedCloud,
  id: string,
): Promise<{ session: StudySession; href: string; usage: AccountUsageStatus }> {
  const { data, error } = await context.client
    .from("extension_captures")
    .select("id,source_url,title,text_content,captured_at,created_at,metadata")
    .eq("id", id)
    .eq("user_id", context.user.id)
    .maybeSingle();
  if (error) throw databaseFailure("Unable to load the captured webpage.");
  if (!data) throw new ExtensionSyncError("Captured webpage was not found.", "extension_capture_not_found", 404);
  const capture = data as ExtensionCaptureRecord;
  let host = "webpage";
  try {
    host = new URL(capture.source_url).hostname;
  } catch {
    // The database constraint and API validation normally make this unreachable.
  }
  const pages = [{ page: null, label: `Web page · ${host}`, text: capture.text_content }];
  const provider = getStudyProvider();
  const summary = await provider.summarize({ pages, fileName: captureFileName(capture.title) });
  const usage = await consumeAccountUsage({ aiRequests: 1 }, async () => context);
  const now = new Date().toISOString();
  const session: StudySession = {
    version: 1,
    id: `web-${capture.id}`,
    file: {
      name: captureFileName(capture.title),
      kind: "txt",
      type: "text/plain",
      size: Buffer.byteLength(capture.text_content, "utf8"),
      pageCount: 1,
      uploadedAt: capture.captured_at,
    },
    provider: { id: provider.id, mode: provider.mode, label: provider.label },
    pages,
    summary,
    messages: [],
    truncated: capture.metadata?.truncated === true,
    createdAt: capture.captured_at,
    updatedAt: now,
  };
  const saved = await saveCloudSession("study", session, async () => context);
  if (!saved) throw databaseFailure("Unable to save the webpage study session.");
  return { session, href: `/pro/session?session=${encodeURIComponent(session.id)}`, usage };
}
