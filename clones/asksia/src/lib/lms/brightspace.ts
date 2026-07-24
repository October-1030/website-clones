import { createHash } from "node:crypto";
import type { LmsCourseInput, LmsMaterialInput } from "./types";
import { LmsError } from "./types";
import { normalizeBrightspaceInstanceUrl } from "./validation";

const AUTHORIZATION_ENDPOINT = "https://auth.brightspace.com/oauth2/auth";
const TOKEN_ENDPOINT = "https://auth.brightspace.com/core/connect/token";
const MAX_RESPONSE_CHARS = 2_000_000;
const MAX_PAGES = 20;
const MAX_COURSES = 50;
const MAX_MATERIALS_PER_COURSE = 500;

export const BRIGHTSPACE_READ_ONLY_SCOPES = [
  "users:own_profile:read",
  "enrollment:own_enrollment:read",
  "content:toc:read",
  "core:*:*",
] as const;

export interface BrightspaceOauthConfig {
  instanceUrl: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  lpVersion: string;
  leVersion: string;
  scopes: string[];
  courseOrgUnitTypeIds: Set<string>;
}

interface TokenResponse {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
}

interface WhoAmI {
  Identifier?: string;
  UniqueName?: string;
  FirstName?: string;
  LastName?: string;
}

interface OrgUnitType {
  Id?: number | string;
  Code?: string;
  Name?: string;
}

interface Enrollment {
  OrgUnit?: {
    Id?: number | string;
    Type?: OrgUnitType;
    Name?: string;
    Code?: string | null;
  };
  Access?: {
    IsActive?: boolean;
    StartDate?: string | null;
    EndDate?: string | null;
    CanAccess?: boolean;
    ClasslistRoleName?: string | null;
  };
}

interface PagedResult<T> {
  PagingInfo?: { Bookmark?: string; HasMoreItems?: boolean };
  Items?: T[];
}

interface TocTopic {
  TopicId?: number | string;
  Identifier?: string;
  TypeIdentifier?: string;
  Title?: string;
  Url?: string;
  SortOrder?: number;
  StartDateTime?: string | null;
  EndDateTime?: string | null;
  ActivityId?: string | null;
  IsHidden?: boolean;
  IsLocked?: boolean;
  IsBroken?: boolean;
  ActivityType?: number;
  GradeItemId?: number | string | null;
  LastModifiedDate?: string | null;
}

interface TocModule {
  ModuleId?: number | string;
  Title?: string;
  SortOrder?: number;
  StartDateTime?: string | null;
  EndDateTime?: string | null;
  Modules?: TocModule[];
  Topics?: TocTopic[];
  IsHidden?: boolean;
  IsLocked?: boolean;
  LastModifiedDate?: string | null;
}

interface TableOfContents {
  Modules?: TocModule[];
}

export interface BrightspaceVerification {
  externalUserId: string;
  displayName: string;
  email: null;
}

export interface BrightspaceCourseSnapshot {
  course: LmsCourseInput;
  materials: LmsMaterialInput[];
  warnings: string[];
}

function cleanText(value: unknown, max: number): string {
  return typeof value === "string"
    ? value.replace(/\u200b/g, "").replace(/\s+/g, " ").trim().slice(0, max)
    : "";
}

function asId(value: unknown): string | null {
  if ((typeof value !== "string" && typeof value !== "number") || !String(value).trim()) return null;
  const output = String(value).trim();
  return output.length <= 300 ? output : null;
}

function safeDate(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? null : date.toISOString();
}

function hashContent(value: string): string {
  return value ? createHash("sha256").update(value).digest("hex") : "";
}

function validateVersion(value: string | undefined, fallback: string, label: string): string {
  const version = value?.trim() || fallback;
  if (!/^\d{1,3}\.\d{1,3}$/.test(version)) {
    throw new LmsError(`Brightspace ${label} API version is invalid.`, "brightspace_config_invalid", 503);
  }
  return version;
}

function validateRedirectUrl(raw: string): string {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new LmsError("Brightspace OAuth redirect URL is invalid.", "brightspace_config_invalid", 503);
  }
  const local = url.hostname === "127.0.0.1" || url.hostname === "localhost";
  if ((url.protocol !== "https:" && !(local && url.protocol === "http:")) || url.username || url.password) {
    throw new LmsError("Brightspace OAuth redirect URL is unsafe.", "brightspace_config_invalid", 503);
  }
  return url.toString();
}

export function getBrightspaceOauthConfig(
  environment: NodeJS.ProcessEnv = process.env,
): BrightspaceOauthConfig | null {
  const instanceRaw = environment.BRIGHTSPACE_INSTANCE_URL?.trim();
  const clientId = environment.BRIGHTSPACE_CLIENT_ID?.trim();
  const clientSecret = environment.BRIGHTSPACE_CLIENT_SECRET?.trim();
  const redirectRaw = environment.BRIGHTSPACE_REDIRECT_URI?.trim();
  if (!instanceRaw && !clientId && !clientSecret && !redirectRaw) return null;
  if (!instanceRaw || !clientId || !clientSecret || !redirectRaw) {
    throw new LmsError("Brightspace OAuth configuration is incomplete.", "brightspace_not_configured", 503);
  }
  if (clientId.length > 2_000 || clientSecret.length > 4_000) {
    throw new LmsError("Brightspace OAuth configuration is invalid.", "brightspace_config_invalid", 503);
  }
  return {
    instanceUrl: normalizeBrightspaceInstanceUrl(instanceRaw, environment),
    clientId,
    clientSecret,
    redirectUri: validateRedirectUrl(redirectRaw),
    lpVersion: validateVersion(environment.BRIGHTSPACE_LP_VERSION, "1.49", "LP"),
    leVersion: validateVersion(environment.BRIGHTSPACE_LE_VERSION, "1.82", "LE"),
    scopes: [...BRIGHTSPACE_READ_ONLY_SCOPES],
    courseOrgUnitTypeIds: new Set(
      (environment.BRIGHTSPACE_COURSE_ORG_UNIT_TYPE_IDS || "")
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean),
    ),
  };
}

export function buildBrightspaceAuthorizationUrl(config: BrightspaceOauthConfig, state: string): string {
  const url = new URL(AUTHORIZATION_ENDPOINT);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("redirect_uri", config.redirectUri);
  url.searchParams.set("client_id", config.clientId);
  url.searchParams.set("scope", config.scopes.join(" "));
  url.searchParams.set("state", state);
  return url.toString();
}

async function requestToken(
  config: BrightspaceOauthConfig,
  parameters: URLSearchParams,
  fetchImpl: typeof fetch,
): Promise<{ accessToken: string; refreshToken: string | null; expiresAt: string }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 25_000);
  try {
    const response = await fetchImpl(TOKEN_ENDPOINT, {
      method: "POST",
      redirect: "manual",
      signal: controller.signal,
      headers: {
        Accept: "application/json",
        Authorization: `Basic ${Buffer.from(`${config.clientId}:${config.clientSecret}`, "utf8").toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: parameters,
    });
    if (response.status >= 300 && response.status < 400) {
      throw new LmsError("Brightspace token redirects are not followed.", "brightspace_redirect_blocked", 502);
    }
    if (!response.ok) {
      throw new LmsError("Brightspace rejected the OAuth grant.", "brightspace_token_rejected", 401);
    }
    const text = await response.text();
    if (text.length > 100_000) {
      throw new LmsError("Brightspace token response is too large.", "brightspace_invalid_response", 502);
    }
    let payload: TokenResponse;
    try {
      payload = JSON.parse(text) as TokenResponse;
    } catch {
      throw new LmsError("Brightspace returned malformed token JSON.", "brightspace_invalid_response", 502);
    }
    const accessToken = payload.access_token?.trim();
    const refreshToken = payload.refresh_token?.trim() || null;
    const expiresIn = Number(payload.expires_in);
    if (!accessToken || accessToken.length > 8_000 || (refreshToken?.length || 0) > 8_000 || !Number.isFinite(expiresIn) || expiresIn <= 0) {
      throw new LmsError("Brightspace returned an invalid token response.", "brightspace_invalid_response", 502);
    }
    return {
      accessToken,
      refreshToken,
      expiresAt: new Date(Date.now() + expiresIn * 1_000).toISOString(),
    };
  } catch (error) {
    if (error instanceof LmsError) throw error;
    if (error instanceof Error && error.name === "AbortError") {
      throw new LmsError("Brightspace token request timed out.", "brightspace_timeout", 504);
    }
    throw new LmsError("Brightspace token endpoint could not be reached.", "brightspace_unreachable", 502);
  } finally {
    clearTimeout(timeout);
  }
}

export async function exchangeBrightspaceAuthorizationCode(
  config: BrightspaceOauthConfig,
  code: string,
  fetchImpl: typeof fetch = fetch,
) {
  const cleanCode = code.trim();
  if (!cleanCode || cleanCode.length > 4_000) {
    throw new LmsError("Brightspace authorization code is invalid.", "brightspace_oauth_code_invalid", 400);
  }
  return requestToken(config, new URLSearchParams({
    grant_type: "authorization_code",
    redirect_uri: config.redirectUri,
    code: cleanCode,
  }), fetchImpl);
}

export async function refreshBrightspaceAccessToken(
  config: BrightspaceOauthConfig,
  refreshToken: string,
  fetchImpl: typeof fetch = fetch,
) {
  const cleanToken = refreshToken.trim();
  if (!cleanToken || cleanToken.length > 8_000) {
    throw new LmsError("Brightspace refresh token is invalid.", "brightspace_token_rejected", 401);
  }
  return requestToken(config, new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: cleanToken,
  }), fetchImpl);
}

export class BrightspaceClient {
  private readonly baseUrl: URL;
  private readonly fetchImpl: typeof fetch;

  constructor(
    instanceUrl: string,
    private readonly accessToken: string,
    private readonly config: Pick<BrightspaceOauthConfig, "lpVersion" | "leVersion" | "courseOrgUnitTypeIds">,
    options: { fetchImpl?: typeof fetch } = {},
  ) {
    this.baseUrl = new URL(`${instanceUrl.replace(/\/$/, "")}/`);
    this.fetchImpl = options.fetchImpl || fetch;
  }

  private apiUrl(pathOrUrl: string): URL {
    const url = new URL(pathOrUrl, this.baseUrl);
    if (url.origin !== this.baseUrl.origin || !url.pathname.startsWith("/d2l/api/") || url.username || url.password) {
      throw new LmsError("Brightspace attempted an unsafe API URL.", "unsafe_brightspace_api_url", 502);
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
        headers: { Accept: "application/json", Authorization: `Bearer ${this.accessToken}` },
      });
      if (response.status >= 300 && response.status < 400) {
        throw new LmsError("Brightspace API redirects are not followed.", "brightspace_redirect_blocked", 502);
      }
      if (response.status === 401) throw new LmsError("Brightspace token expired.", "brightspace_token_rejected", 401);
      if (response.status === 403) throw new LmsError("Brightspace denied a required read-only scope.", "brightspace_scope_denied", 403);
      if (!response.ok) throw new LmsError(`Brightspace API failed with HTTP ${response.status}.`, "brightspace_api_failed", 502);
      const length = Number(response.headers.get("content-length") || 0);
      if (length > MAX_RESPONSE_CHARS * 4) throw new LmsError("Brightspace response is too large.", "brightspace_response_too_large", 413);
      const text = await response.text();
      if (text.length > MAX_RESPONSE_CHARS) throw new LmsError("Brightspace response is too large.", "brightspace_response_too_large", 413);
      try {
        return JSON.parse(text) as T;
      } catch {
        throw new LmsError("Brightspace returned malformed JSON.", "brightspace_invalid_response", 502);
      }
    } catch (error) {
      if (error instanceof LmsError) throw error;
      if (error instanceof Error && error.name === "AbortError") throw new LmsError("Brightspace API request timed out.", "brightspace_timeout", 504);
      throw new LmsError("Brightspace API could not be reached.", "brightspace_unreachable", 502);
    } finally {
      clearTimeout(timeout);
    }
  }

  private async requestPaged<T>(path: string, maxItems: number): Promise<T[]> {
    const output: T[] = [];
    const seenBookmarks = new Set<string>();
    const pageUrl = this.apiUrl(path);
    for (let page = 0; page < MAX_PAGES && output.length < maxItems; page += 1) {
      const payload = await this.requestOne<PagedResult<T>>(pageUrl.toString());
      if (!Array.isArray(payload.Items)) throw new LmsError("Brightspace paged response is invalid.", "brightspace_invalid_response", 502);
      output.push(...payload.Items.slice(0, maxItems - output.length));
      const bookmark = cleanText(payload.PagingInfo?.Bookmark, 1_000);
      if (!payload.PagingInfo?.HasMoreItems || !bookmark || seenBookmarks.has(bookmark)) break;
      seenBookmarks.add(bookmark);
      pageUrl.searchParams.set("bookmark", bookmark);
    }
    return output;
  }

  private isCourseOffering(type: OrgUnitType | undefined): boolean {
    const normalized = `${cleanText(type?.Code, 100)} ${cleanText(type?.Name, 100)}`.toLowerCase().replace(/[^a-z0-9]+/g, "");
    const id = asId(type?.Id);
    return normalized.includes("courseoffering") || Boolean(id && this.config.courseOrgUnitTypeIds.has(id));
  }

  private safeSourceUrl(value: unknown): string | null {
    const clean = cleanText(value, 2_000);
    if (!clean) return null;
    try {
      const url = new URL(clean, this.baseUrl);
      if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) return null;
      return url.toString().slice(0, 2_000);
    } catch {
      return null;
    }
  }

  async verifyConnection(): Promise<BrightspaceVerification> {
    const user = await this.requestOne<WhoAmI>(`/d2l/api/lp/${this.config.lpVersion}/users/whoami`);
    const id = asId(user.Identifier);
    if (!id) throw new LmsError("Brightspace user response is missing an ID.", "brightspace_invalid_user", 502);
    const displayName = cleanText([user.FirstName, user.LastName].filter(Boolean).join(" ") || user.UniqueName, 120) || "Brightspace";
    return { externalUserId: id, displayName, email: null };
  }

  async listCourses(): Promise<LmsCourseInput[]> {
    const enrollments = await this.requestPaged<Enrollment>(
      `/d2l/api/lp/${this.config.lpVersion}/enrollments/myenrollments/?isActive=true&canAccess=true`,
      MAX_COURSES * 4,
    );
    return enrollments.flatMap((enrollment) => {
      const orgUnit = enrollment.OrgUnit;
      const externalId = asId(orgUnit?.Id);
      const name = cleanText(orgUnit?.Name, 300);
      if (!externalId || !name || !this.isCourseOffering(orgUnit?.Type) || enrollment.Access?.CanAccess === false || enrollment.Access?.IsActive === false) return [];
      return [{
        externalId,
        name,
        courseCode: cleanText(orgUnit?.Code, 120),
        enrollmentState: cleanText(enrollment.Access?.ClasslistRoleName, 80),
        workflowState: "active",
        startAt: safeDate(enrollment.Access?.StartDate),
        endAt: safeDate(enrollment.Access?.EndDate),
      }];
    }).slice(0, MAX_COURSES);
  }

  async loadCourseSnapshot(course: LmsCourseInput): Promise<BrightspaceCourseSnapshot> {
    const orgUnitId = encodeURIComponent(course.externalId);
    const toc = await this.requestOne<TableOfContents>(`/d2l/api/le/${this.config.leVersion}/${orgUnitId}/content/toc`);
    if (!Array.isArray(toc.Modules)) throw new LmsError("Brightspace table of contents is invalid.", "brightspace_invalid_response", 502);
    const materials = new Map<string, LmsMaterialInput>();
    const warnings: string[] = [];
    const visit = (modules: TocModule[], parentPath: string, depth: number) => {
      if (depth > 12) {
        warnings.push("content_depth_limit_reached");
        return;
      }
      for (const contentModule of modules) {
        if (materials.size >= MAX_MATERIALS_PER_COURSE) return;
        if (contentModule.IsHidden) continue;
        const id = asId(contentModule.ModuleId);
        const title = cleanText(contentModule.Title, 500);
        if (!id || !title) continue;
        const modulePath = parentPath ? `${parentPath} / ${title}` : title;
        materials.set(`module:${id}`, {
          externalId: id,
          kind: "module",
          title,
          moduleName: parentPath,
          sourceUrl: null,
          mimeType: null,
          dueAt: null,
          position: Number.isInteger(contentModule.SortOrder) ? Math.max(0, contentModule.SortOrder || 0) : 0,
          textContent: title,
          contentHash: hashContent(title),
          metadata: {
            locked: Boolean(contentModule.IsLocked),
            startAt: safeDate(contentModule.StartDateTime),
            endAt: safeDate(contentModule.EndDateTime),
            modifiedAt: safeDate(contentModule.LastModifiedDate),
          },
        });
        for (const topic of Array.isArray(contentModule.Topics) ? contentModule.Topics : []) {
          if (materials.size >= MAX_MATERIALS_PER_COURSE) break;
          if (topic.IsHidden) continue;
          const topicId = asId(topic.TopicId || topic.Identifier);
          const topicTitle = cleanText(topic.Title, 500);
          if (!topicId || !topicTitle) continue;
          const activityType = Number(topic.ActivityType);
          const kind: LmsMaterialInput["kind"] = activityType === 1
            ? "file"
            : activityType === 2 || activityType === 7 || activityType === 27
              ? "external-link"
              : activityType === 3 || activityType === 4 || activityType === 11 || activityType === 12
                ? "assignment"
                : "page";
          materials.set(`${kind}:${topicId}`, {
            externalId: topicId,
            kind,
            title: topicTitle,
            moduleName: modulePath,
            sourceUrl: this.safeSourceUrl(topic.Url),
            mimeType: kind === "file" ? "application/octet-stream" : null,
            dueAt: null,
            position: Number.isInteger(topic.SortOrder) ? Math.max(0, topic.SortOrder || 0) : 0,
            textContent: topicTitle,
            contentHash: hashContent(topicTitle),
            metadata: {
              activityType: Number.isFinite(activityType) ? activityType : null,
              typeIdentifier: cleanText(topic.TypeIdentifier, 120),
              activityId: cleanText(topic.ActivityId, 300) || null,
              gradeItemId: asId(topic.GradeItemId),
              locked: Boolean(topic.IsLocked),
              broken: Boolean(topic.IsBroken),
              startAt: safeDate(topic.StartDateTime),
              endAt: safeDate(topic.EndDateTime),
              modifiedAt: safeDate(topic.LastModifiedDate),
            },
          });
        }
        visit(Array.isArray(contentModule.Modules) ? contentModule.Modules : [], modulePath, depth + 1);
      }
    };
    visit(toc.Modules, "", 0);
    if (materials.size >= MAX_MATERIALS_PER_COURSE) warnings.push("material_limit_reached");
    return { course, materials: [...materials.values()], warnings };
  }
}