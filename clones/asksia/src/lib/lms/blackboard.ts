import { createHash } from "node:crypto";
import type { LmsCourseInput, LmsMaterialInput } from "./types";
import { LmsError } from "./types";
import { normalizeBlackboardInstanceUrl } from "./validation";

const MAX_RESPONSE_CHARS = 2_000_000;
const MAX_PAGES = 20;
const MAX_COURSES = 50;
const MAX_MATERIALS_PER_COURSE = 500;
const MAX_CONTENT_DEPTH = 8;

export interface BlackboardConfig {
  instanceUrl: string;
  appKey: string;
  appSecret: string;
}

interface BlackboardTokenResponse {
  access_token?: string;
  expires_in?: number;
}

interface BlackboardUser {
  id?: string;
  userName?: string;
  name?: { given?: string; family?: string };
  contact?: { email?: string };
}

interface BlackboardCourse {
  id?: string;
  courseId?: string;
  name?: string;
  created?: string;
  modified?: string;
  availability?: { available?: string; duration?: { start?: string; end?: string } };
}

interface BlackboardMembership {
  courseId?: string;
  courseRoleId?: string;
  course?: BlackboardCourse;
}

interface BlackboardLink {
  href?: string;
  rel?: string;
  title?: string;
  type?: string;
}

interface BlackboardContent {
  id?: string;
  parentId?: string;
  title?: string;
  body?: string;
  description?: string;
  position?: number;
  hasChildren?: boolean;
  modified?: string;
  availability?: { available?: string };
  contentHandler?: { id?: string; isBbPage?: boolean };
  links?: BlackboardLink[];
}

interface BlackboardPage<T> {
  results?: T[];
  paging?: { nextPage?: string };
}

export interface BlackboardVerification {
  externalUserId: string;
  displayName: string;
  email: string | null;
}

export interface BlackboardCourseSnapshot {
  course: LmsCourseInput;
  materials: LmsMaterialInput[];
  warnings: string[];
}

function cleanText(value: unknown, max: number): string {
  if (typeof value !== "string") return "";
  return value
    .replace(/\u200b/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, max);
}

function stripHtml(value: unknown): string {
  return cleanText(
    typeof value === "string"
      ? value
        .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
        .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
        .replace(/<br\s*\/?>/gi, "\n")
        .replace(/<\/(?:p|div|li|h[1-6])>/gi, "\n")
        .replace(/<[^>]+>/g, " ")
        .replace(/&nbsp;/gi, " ")
        .replace(/&amp;/gi, "&")
        .replace(/&lt;/gi, "<")
        .replace(/&gt;/gi, ">")
        .replace(/&quot;/gi, "\"")
        .replace(/&#39;|&apos;/gi, "'")
      : "",
    200_000,
  );
}

function asId(value: unknown): string | null {
  return typeof value === "string" && value.trim() && value.length <= 300 ? value.trim() : null;
}

function safeDate(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? null : date.toISOString();
}

function hashContent(value: string): string {
  return value ? createHash("sha256").update(value).digest("hex") : "";
}

export function getBlackboardConfig(
  environment: NodeJS.ProcessEnv = process.env,
): BlackboardConfig | null {
  const instanceRaw = environment.BLACKBOARD_INSTANCE_URL?.trim();
  const appKey = environment.BLACKBOARD_APP_KEY?.trim();
  const appSecret = environment.BLACKBOARD_APP_SECRET?.trim();
  if (!instanceRaw && !appKey && !appSecret) return null;
  if (!instanceRaw || !appKey || !appSecret) {
    throw new LmsError("Blackboard integration configuration is incomplete.", "blackboard_not_configured", 503);
  }
  if (appKey.length > 2_000 || appSecret.length > 4_000) {
    throw new LmsError("Blackboard integration configuration is invalid.", "blackboard_config_invalid", 503);
  }
  return {
    instanceUrl: normalizeBlackboardInstanceUrl(instanceRaw, environment),
    appKey,
    appSecret,
  };
}

export async function requestBlackboardAccessToken(
  config: BlackboardConfig,
  fetchImpl: typeof fetch = fetch,
): Promise<{ accessToken: string; expiresAt: string }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 25_000);
  try {
    const response = await fetchImpl(new URL("/learn/api/public/v1/oauth2/token", `${config.instanceUrl}/`), {
      method: "POST",
      redirect: "manual",
      signal: controller.signal,
      headers: {
        Accept: "application/json",
        Authorization: `Basic ${Buffer.from(`${config.appKey}:${config.appSecret}`, "utf8").toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ grant_type: "client_credentials" }),
    });
    if (!response.ok) {
      throw new LmsError("Blackboard rejected the integration key or installation.", "blackboard_token_rejected", 401);
    }
    const text = await response.text();
    if (text.length > 100_000) throw new LmsError("Blackboard token response is too large.", "blackboard_invalid_response", 502);
    let payload: BlackboardTokenResponse;
    try {
      payload = JSON.parse(text) as BlackboardTokenResponse;
    } catch {
      throw new LmsError("Blackboard returned malformed token JSON.", "blackboard_invalid_response", 502);
    }
    const accessToken = payload.access_token?.trim();
    const expiresIn = Number(payload.expires_in);
    if (!accessToken || accessToken.length > 8_000 || !Number.isFinite(expiresIn) || expiresIn <= 0) {
      throw new LmsError("Blackboard returned an invalid access token.", "blackboard_invalid_response", 502);
    }
    return {
      accessToken,
      expiresAt: new Date(Date.now() + expiresIn * 1_000).toISOString(),
    };
  } catch (error) {
    if (error instanceof LmsError) throw error;
    if (error instanceof Error && error.name === "AbortError") {
      throw new LmsError("Blackboard token request timed out.", "blackboard_timeout", 504);
    }
    throw new LmsError("Blackboard token endpoint could not be reached.", "blackboard_unreachable", 502);
  } finally {
    clearTimeout(timeout);
  }
}

export class BlackboardClient {
  private readonly baseUrl: URL;
  private readonly fetchImpl: typeof fetch;

  constructor(instanceUrl: string, private readonly accessToken: string, options: { fetchImpl?: typeof fetch } = {}) {
    this.baseUrl = new URL(`${instanceUrl.replace(/\/$/, "")}/`);
    this.fetchImpl = options.fetchImpl || fetch;
  }

  private apiUrl(pathOrUrl: string): URL {
    const url = new URL(pathOrUrl, this.baseUrl);
    if (
      url.origin !== this.baseUrl.origin
      || !url.pathname.startsWith("/learn/api/public/")
      || url.username
      || url.password
    ) {
      throw new LmsError("Blackboard attempted an unsafe API redirect.", "unsafe_blackboard_api_url", 502);
    }
    return url;
  }

  private async requestOne<T>(pathOrUrl: string): Promise<T> {
    const url = this.apiUrl(pathOrUrl);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 25_000);
    try {
      const response = await this.fetchImpl(url, {
        method: "GET",
        redirect: "manual",
        signal: controller.signal,
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${this.accessToken}`,
        },
      });
      if (response.status >= 300 && response.status < 400) {
        throw new LmsError("Blackboard API redirects are not followed.", "blackboard_redirect_blocked", 502);
      }
      if (response.status === 401) throw new LmsError("Blackboard token expired.", "blackboard_token_rejected", 401);
      if (response.status === 403) throw new LmsError("Blackboard denied the required read entitlement.", "blackboard_scope_denied", 403);
      if (!response.ok) throw new LmsError(`Blackboard API failed with HTTP ${response.status}.`, "blackboard_api_failed", 502);
      const length = Number(response.headers.get("content-length") || 0);
      if (length > MAX_RESPONSE_CHARS * 4) throw new LmsError("Blackboard response is too large.", "blackboard_response_too_large", 413);
      const text = await response.text();
      if (text.length > MAX_RESPONSE_CHARS) throw new LmsError("Blackboard response is too large.", "blackboard_response_too_large", 413);
      try {
        return JSON.parse(text) as T;
      } catch {
        throw new LmsError("Blackboard returned malformed JSON.", "blackboard_invalid_response", 502);
      }
    } catch (error) {
      if (error instanceof LmsError) throw error;
      if (error instanceof Error && error.name === "AbortError") {
        throw new LmsError("Blackboard API request timed out.", "blackboard_timeout", 504);
      }
      throw new LmsError("Blackboard API could not be reached.", "blackboard_unreachable", 502);
    } finally {
      clearTimeout(timeout);
    }
  }

  private async requestAll<T>(path: string, maxItems: number): Promise<T[]> {
    const output: T[] = [];
    let next: string | null = path;
    for (let page = 0; next && page < MAX_PAGES && output.length < maxItems; page += 1) {
      const payload: BlackboardPage<T> = await this.requestOne<BlackboardPage<T>>(next);
      if (!Array.isArray(payload.results)) throw new LmsError("Blackboard list response is invalid.", "blackboard_invalid_response", 502);
      output.push(...payload.results.slice(0, maxItems - output.length));
      next = payload.paging?.nextPage || null;
      if (next) this.apiUrl(next);
    }
    return output;
  }

  async verifyConnection(): Promise<BlackboardVerification> {
    const user = await this.requestOne<BlackboardUser>("/learn/api/public/v1/users/me");
    const id = asId(user.id);
    if (!id) throw new LmsError("Blackboard user response is missing an ID.", "blackboard_invalid_user", 502);
    const displayName = cleanText(
      [user.name?.given, user.name?.family].filter(Boolean).join(" ") || user.userName,
      120,
    ) || "Blackboard integration";
    return { externalUserId: id, displayName, email: cleanText(user.contact?.email, 320) || null };
  }

  async listCourses(): Promise<LmsCourseInput[]> {
    const memberships = await this.requestAll<BlackboardMembership>(
      "/learn/api/public/v1/users/me/courses?expand=course&limit=100",
      MAX_COURSES,
    );
    return memberships.flatMap((membership) => {
      const course = membership.course;
      const externalId = asId(course?.id || membership.courseId);
      const name = cleanText(course?.name, 300);
      if (!externalId || !name) return [];
      return [{
        externalId,
        name,
        courseCode: cleanText(course?.courseId, 120),
        enrollmentState: cleanText(membership.courseRoleId, 80),
        workflowState: cleanText(course?.availability?.available, 80),
        startAt: safeDate(course?.availability?.duration?.start),
        endAt: safeDate(course?.availability?.duration?.end),
      }];
    });
  }

  async loadCourseSnapshot(course: LmsCourseInput): Promise<BlackboardCourseSnapshot> {
    const courseId = encodeURIComponent(course.externalId);
    const materials = new Map<string, LmsMaterialInput>();
    const warnings: string[] = [];
    const queue: Array<{ path: string; parentName: string; depth: number }> = [{
      path: `/learn/api/public/v1/courses/${courseId}/contents?limit=100`,
      parentName: "",
      depth: 0,
    }];
    while (queue.length && materials.size < MAX_MATERIALS_PER_COURSE) {
      const current = queue.shift()!;
      if (current.depth > MAX_CONTENT_DEPTH) {
        warnings.push("content_depth_limit_reached");
        continue;
      }
      let contents: BlackboardContent[];
      try {
        contents = await this.requestAll<BlackboardContent>(current.path, MAX_MATERIALS_PER_COURSE - materials.size);
      } catch (error) {
        const code = error instanceof LmsError ? error.code : "blackboard_content_failed";
        warnings.push(`${current.path}:${code}`);
        continue;
      }
      for (const content of contents) {
        const id = asId(content.id);
        const title = cleanText(content.title, 500);
        if (!id || !title) continue;
        const handler = cleanText(content.contentHandler?.id, 200).toLowerCase();
        const kind: LmsMaterialInput["kind"] = handler.includes("folder")
          ? "module"
          : handler.includes("file")
            ? "file"
            : handler.includes("assignment") || handler.includes("assessment") || handler.includes("test")
              ? "assignment"
              : handler.includes("link") || handler.includes("external")
                ? "external-link"
                : "page";
        const textContent = stripHtml([content.body, content.description].filter(Boolean).join("\n"));
        const alternate = content.links?.find((link) => link.rel === "alternate")?.href;
        const sourceUrl = alternate ? new URL(alternate, this.baseUrl).toString().slice(0, 2000) : null;
        materials.set(`${kind}:${id}`, {
          externalId: id,
          kind,
          title,
          moduleName: current.parentName,
          sourceUrl,
          mimeType: content.links?.find((link) => link.rel === "alternate")?.type?.slice(0, 200) || null,
          dueAt: null,
          position: Number.isInteger(content.position) ? Math.max(0, content.position || 0) : 0,
          textContent,
          contentHash: hashContent(textContent),
          metadata: {
            contentHandler: handler,
            modifiedAt: safeDate(content.modified),
            availability: cleanText(content.availability?.available, 80),
          },
        });
        if (content.hasChildren && current.depth < MAX_CONTENT_DEPTH) {
          queue.push({
            path: `/learn/api/public/v1/courses/${courseId}/contents/${encodeURIComponent(id)}/children?limit=100`,
            parentName: kind === "module" ? title : current.parentName,
            depth: current.depth + 1,
          });
        }
        if (materials.size >= MAX_MATERIALS_PER_COURSE) break;
      }
    }
    if (materials.size >= MAX_MATERIALS_PER_COURSE) warnings.push("material_limit_reached");
    return { course, materials: [...materials.values()], warnings };
  }
}
