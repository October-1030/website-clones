import type { ExtensionCaptureInput } from "./types";
import { ExtensionSyncError } from "./types";

const TOKEN_PATTERN = /^spx_[A-Za-z0-9_-]{43}$/;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const CHROME_EXTENSION_ORIGIN = /^chrome-extension:\/\/[a-p]{32}$/;
const MAX_CAPTURE_CHARS = 120_000;

function cleanSingleLine(value: unknown, maximum: number): string {
  if (typeof value !== "string") return "";
  return value.replace(/[\u0000-\u001f\u007f]+/g, " ").replace(/\s+/g, " ").trim().slice(0, maximum);
}

function cleanPageText(value: unknown): string {
  if (typeof value !== "string") return "";
  return value
    .replace(/\r\n?/g, "\n")
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "")
    .split("\n")
    .map((line) => line.replace(/[ \t]+/g, " ").trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function wordCount(text: string): number {
  return (text.match(/[\p{L}\p{N}]+/gu) || []).length;
}

export function parseExtensionToken(value: string | null | undefined): string {
  const token = value?.trim() || "";
  if (!TOKEN_PATTERN.test(token)) {
    throw new ExtensionSyncError("The extension pairing token is invalid.", "extension_token_invalid", 401);
  }
  return token;
}

export function readExtensionBearerToken(header: string | null): string {
  const match = /^Bearer\s+(.+)$/i.exec(header || "");
  return parseExtensionToken(match?.[1]);
}

export function parseExtensionLabel(value: unknown): string {
  const label = cleanSingleLine(value, 81) || "Chrome on this computer";
  if (label.length > 80) {
    throw new ExtensionSyncError("Extension label is too long.", "extension_label_invalid");
  }
  return label;
}

export function parseExtensionId(value: string): string {
  if (!UUID_PATTERN.test(value)) {
    throw new ExtensionSyncError("Extension record ID is invalid.", "extension_id_invalid");
  }
  return value.toLowerCase();
}

export function parseExtensionCaptureInput(value: unknown, now = Date.now()): ExtensionCaptureInput {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new ExtensionSyncError("Extension capture input is invalid.", "extension_capture_invalid");
  }
  const record = value as Record<string, unknown>;
  const clientCaptureId = parseExtensionId(typeof record.clientCaptureId === "string" ? record.clientCaptureId : "");
  const title = cleanSingleLine(record.title, 501);
  if (!title || title.length > 500) {
    throw new ExtensionSyncError("Captured page title is invalid.", "extension_title_invalid");
  }

  const rawUrl = typeof record.sourceUrl === "string" ? record.sourceUrl.trim() : "";
  if (!rawUrl || rawUrl.length > 2_048) {
    throw new ExtensionSyncError("Captured page URL is invalid.", "extension_url_invalid");
  }
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new ExtensionSyncError("Captured page URL is invalid.", "extension_url_invalid");
  }
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) {
    throw new ExtensionSyncError("Only public HTTP or HTTPS page URLs can be captured.", "extension_url_invalid");
  }
  url.hash = "";

  const textContent = cleanPageText(record.textContent);
  if (textContent.length < 50 || textContent.length > MAX_CAPTURE_CHARS) {
    throw new ExtensionSyncError("Captured page text must contain 50 to 120,000 characters.", "extension_text_invalid");
  }

  const capturedTimestamp = Date.parse(typeof record.capturedAt === "string" ? record.capturedAt : "");
  if (!Number.isFinite(capturedTimestamp) || capturedTimestamp < now - 7 * 24 * 60 * 60_000 || capturedTimestamp > now + 5 * 60_000) {
    throw new ExtensionSyncError("Capture timestamp is invalid.", "extension_timestamp_invalid");
  }

  const rawMetadata = record.metadata && typeof record.metadata === "object" && !Array.isArray(record.metadata)
    ? record.metadata as Record<string, unknown>
    : {};
  const scope = rawMetadata.scope === "selection" ? "selection" : "page";
  return {
    clientCaptureId,
    sourceUrl: url.toString(),
    title,
    textContent,
    capturedAt: new Date(capturedTimestamp).toISOString(),
    metadata: {
      source: "chromium-extension",
      scope,
      truncated: rawMetadata.truncated === true,
      wordCount: wordCount(textContent),
      language: cleanSingleLine(rawMetadata.language, 35),
      description: cleanSingleLine(rawMetadata.description, 500),
    },
  };
}

export function isAllowedExtensionOrigin(origin: string | null): boolean {
  return origin === null || CHROME_EXTENSION_ORIGIN.test(origin);
}

export function extensionCorsHeaders(origin: string | null): Record<string, string> {
  if (!origin || !CHROME_EXTENSION_ORIGIN.test(origin)) return { Vary: "Origin" };
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Authorization, Content-Type",
    "Access-Control-Max-Age": "600",
    Vary: "Origin",
  };
}
