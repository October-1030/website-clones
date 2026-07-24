import { isIP } from "node:net";
import { LmsError } from "./types";

const INSTANCE_URL_MAX = 500;
const LABEL_MAX = 120;
const CANVAS_HOST_SUFFIX = ".instructure.com";
const BRIGHTSPACE_HOST_SUFFIX = ".brightspace.com";

function configuredHosts(environment: NodeJS.ProcessEnv): Set<string> {
  return new Set(
    (environment.STUDYPAL_LMS_ALLOWED_HOSTS || "")
      .split(",")
      .map((value) => value.trim().toLowerCase().replace(/\.$/, ""))
      .filter(Boolean),
  );
}

function isPrivateIpv4(host: string): boolean {
  const parts = host.split(".").map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return true;
  return parts[0] === 10
    || parts[0] === 127
    || (parts[0] === 169 && parts[1] === 254)
    || (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31)
    || (parts[0] === 192 && parts[1] === 168)
    || parts[0] === 0
    || parts[0] >= 224;
}

function isUnsafeHost(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/\.$/, "");
  if (
    host === "localhost"
    || host.endsWith(".localhost")
    || host.endsWith(".local")
    || host.endsWith(".internal")
  ) return true;
  const ipVersion = isIP(host);
  if (ipVersion === 4) return isPrivateIpv4(host);
  if (ipVersion === 6) return true;
  return false;
}

export function normalizeBlackboardInstanceUrl(
  raw: string,
  environment: NodeJS.ProcessEnv = process.env,
): string {
  const clean = raw.trim();
  if (!clean || clean.length > INSTANCE_URL_MAX) {
    throw new LmsError("Blackboard URL length is invalid.", "invalid_lms_instance", 400);
  }
  let url: URL;
  try {
    url = new URL(clean);
  } catch {
    throw new LmsError("Enter a complete Blackboard HTTPS URL.", "invalid_lms_instance", 400);
  }
  if (
    url.protocol !== "https:"
    || url.username
    || url.password
    || url.port
    || isUnsafeHost(url.hostname)
  ) {
    throw new LmsError("Blackboard must use an approved public HTTPS host.", "unsafe_lms_instance", 400);
  }
  const host = url.hostname.toLowerCase().replace(/\.$/, "");
  const approved = host === "blackboard.com"
    || host.endsWith(".blackboard.com")
    || host === "bbhosted.com"
    || host.endsWith(".bbhosted.com")
    || configuredHosts(environment).has(host);
  if (!approved) {
    throw new LmsError(
      "This Blackboard host is not approved. Add its exact hostname to STUDYPAL_LMS_ALLOWED_HOSTS.",
      "lms_host_not_allowed",
      400,
    );
  }
  url.hostname = host;
  url.pathname = "/";
  url.search = "";
  url.hash = "";
  return url.toString().replace(/\/$/, "");
}
export function normalizeCanvasInstanceUrl(
  raw: string,
  environment: NodeJS.ProcessEnv = process.env,
): string {
  const clean = raw.trim();
  if (!clean || clean.length > INSTANCE_URL_MAX) {
    throw new LmsError("Canvas URL length is invalid.", "invalid_lms_instance", 400);
  }
  let url: URL;
  try {
    url = new URL(clean);
  } catch {
    throw new LmsError("Enter a complete Canvas HTTPS URL.", "invalid_lms_instance", 400);
  }
  if (
    url.protocol !== "https:"
    || url.username
    || url.password
    || url.port
    || isUnsafeHost(url.hostname)
  ) {
    throw new LmsError("Canvas must use an approved public HTTPS host.", "unsafe_lms_instance", 400);
  }
  const host = url.hostname.toLowerCase().replace(/\.$/, "");
  const approved = host === "instructure.com"
    || host.endsWith(CANVAS_HOST_SUFFIX)
    || configuredHosts(environment).has(host);
  if (!approved) {
    throw new LmsError(
      "This Canvas host is not approved. Add its exact hostname to STUDYPAL_LMS_ALLOWED_HOSTS.",
      "lms_host_not_allowed",
      400,
    );
  }
  url.hostname = host;
  url.pathname = "/";
  url.search = "";
  url.hash = "";
  return url.toString().replace(/\/$/, "");
}


export function normalizeBrightspaceInstanceUrl(
  raw: string,
  environment: NodeJS.ProcessEnv = process.env,
): string {
  const clean = raw.trim();
  if (!clean || clean.length > INSTANCE_URL_MAX) {
    throw new LmsError("Brightspace URL length is invalid.", "invalid_lms_instance", 400);
  }
  let url: URL;
  try {
    url = new URL(clean);
  } catch {
    throw new LmsError("Enter a complete Brightspace HTTPS URL.", "invalid_lms_instance", 400);
  }
  if (
    url.protocol !== "https:"
    || url.username
    || url.password
    || url.port
    || isUnsafeHost(url.hostname)
  ) {
    throw new LmsError("Brightspace must use an approved public HTTPS host.", "unsafe_lms_instance", 400);
  }
  const host = url.hostname.toLowerCase().replace(/\.$/, "");
  const approved = host === "brightspace.com"
    || host.endsWith(BRIGHTSPACE_HOST_SUFFIX)
    || configuredHosts(environment).has(host);
  if (!approved) {
    throw new LmsError(
      "This Brightspace host is not approved. Add its exact hostname to STUDYPAL_LMS_ALLOWED_HOSTS.",
      "lms_host_not_allowed",
      400,
    );
  }
  url.hostname = host;
  url.pathname = "/";
  url.search = "";
  url.hash = "";
  return url.toString().replace(/\/$/, "");
}
export function parseCanvasConnectionInput(value: unknown): {
  instanceUrl: string;
  accessToken: string;
  accountLabel: string;
} {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new LmsError("Canvas connection input is invalid.", "invalid_lms_connection", 400);
  }
  const record = value as Record<string, unknown>;
  const instanceUrl = normalizeCanvasInstanceUrl(typeof record.instanceUrl === "string" ? record.instanceUrl : "");
  const accessToken = typeof record.accessToken === "string" ? record.accessToken.trim() : "";
  const accountLabel = typeof record.accountLabel === "string" && record.accountLabel.trim()
    ? record.accountLabel.trim()
    : "Canvas";
  if (!accessToken || accessToken.length > 8_000) {
    throw new LmsError("Canvas access token length is invalid.", "invalid_lms_token", 400);
  }
  if (accountLabel.length > LABEL_MAX) {
    throw new LmsError("Canvas account label is too long.", "invalid_lms_label", 400);
  }
  return { instanceUrl, accessToken, accountLabel };
}

export function parseConnectionId(raw: string): string {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(raw)) {
    throw new LmsError("LMS connection ID is invalid.", "invalid_lms_connection_id", 400);
  }
  return raw.toLowerCase();
}
