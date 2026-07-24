import { createHash } from "node:crypto";
import type { LmsCourseInput, LmsMaterialInput } from "./types";
import { LmsError } from "./types";

const MAX_RESPONSE_CHARS = 2_000_000;
const MAX_PAGES = 20;
const MAX_COURSES = 50;
const MAX_MATERIALS_PER_COURSE = 500;

interface CanvasProfile {
  id?: number | string;
  name?: string;
  primary_email?: string;
}

interface CanvasCourse {
  id?: number | string;
  name?: string;
  course_code?: string;
  enrollment_state?: string;
  workflow_state?: string;
  start_at?: string | null;
  end_at?: string | null;
}

interface CanvasModuleItem {
  id?: number | string;
  title?: string;
  type?: string;
  content_id?: number | string;
  page_url?: string;
  external_url?: string;
  html_url?: string;
  position?: number;
}

interface CanvasModule {
  id?: number | string;
  name?: string;
  position?: number;
  items?: CanvasModuleItem[];
}

interface CanvasAssignment {
  id?: number | string;
  name?: string;
  description?: string | null;
  due_at?: string | null;
  html_url?: string;
  position?: number;
  points_possible?: number | null;
}

interface CanvasPage {
  page_id?: number | string;
  url?: string;
  title?: string;
  body?: string | null;
  html_url?: string;
  updated_at?: string | null;
}

interface CanvasFile {
  id?: number | string;
  display_name?: string;
  filename?: string;
  url?: string;
  size?: number;
  "content-type"?: string;
  updated_at?: string | null;
}

export interface CanvasVerification {
  externalUserId: string;
  displayName: string;
  email: string | null;
}

export interface CanvasCourseSnapshot {
  course: LmsCourseInput;
  materials: LmsMaterialInput[];
  warnings: string[];
}

export interface CanvasClientOptions {
  fetchImpl?: typeof fetch;
}

function cleanText(value: unknown, max: number): string {
  if (typeof value !== "string") return "";
  return value.replace(/\u200b/g, "").replace(/[ \t]+/g, " ").replace(/ *\n */g, "\n").replace(/\n{3,}/g, "\n\n").trim().slice(0, max);
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
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (typeof value === "string" && value.trim() && value.length <= 300) return value.trim();
  return null;
}

function safeDate(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? null : date.toISOString();
}

function hashContent(value: string): string {
  return value ? createHash("sha256").update(value).digest("hex") : "";
}

function nextLink(header: string | null): string | null {
  if (!header) return null;
  for (const segment of header.split(",")) {
    const match = segment.match(/<([^>]+)>\s*;\s*rel=\"?next\"?/i);
    if (match?.[1]) return match[1];
  }
  return null;
}

export class CanvasClient {
  private readonly fetchImpl: typeof fetch;
  private readonly baseUrl: URL;

  constructor(
    instanceUrl: string,
    private readonly accessToken: string,
    options: CanvasClientOptions = {},
  ) {
    this.baseUrl = new URL(`${instanceUrl.replace(/\/$/, "")}/`);
    this.fetchImpl = options.fetchImpl || fetch;
  }

  private validatedApiUrl(pathOrUrl: string): URL {
    const url = new URL(pathOrUrl, this.baseUrl);
    if (
      url.origin !== this.baseUrl.origin
      || !url.pathname.startsWith("/api/v1/")
      || url.username
      || url.password
    ) {
      throw new LmsError("Canvas attempted an unsafe API redirect.", "unsafe_canvas_api_url", 502);
    }
    return url;
  }

  private async requestPage<T>(pathOrUrl: string): Promise<{ data: T; next: string | null }> {
    const url = this.validatedApiUrl(pathOrUrl);
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
        throw new LmsError("Canvas API redirects are not followed.", "canvas_redirect_blocked", 502);
      }
      if (response.status === 401) {
        throw new LmsError("Canvas rejected the access token.", "canvas_token_rejected", 401);
      }
      if (response.status === 403) {
        throw new LmsError("Canvas denied the requested read scope.", "canvas_scope_denied", 403);
      }
      if (!response.ok) {
        throw new LmsError(`Canvas API request failed with HTTP ${response.status}.`, "canvas_api_failed", 502);
      }
      const contentLength = Number(response.headers.get("content-length") || 0);
      if (contentLength > MAX_RESPONSE_CHARS * 4) {
        throw new LmsError("Canvas API response is too large.", "canvas_response_too_large", 413);
      }
      const body = await response.text();
      if (body.length > MAX_RESPONSE_CHARS) {
        throw new LmsError("Canvas API response is too large.", "canvas_response_too_large", 413);
      }
      let data: T;
      try {
        data = JSON.parse(body) as T;
      } catch {
        throw new LmsError("Canvas returned malformed JSON.", "canvas_invalid_response", 502);
      }
      const next = nextLink(response.headers.get("link"));
      if (next) this.validatedApiUrl(next);
      return { data, next };
    } catch (error) {
      if (error instanceof LmsError) throw error;
      if (error instanceof Error && error.name === "AbortError") {
        throw new LmsError("Canvas API request timed out.", "canvas_timeout", 504);
      }
      throw new LmsError("Canvas API could not be reached.", "canvas_unreachable", 502);
    } finally {
      clearTimeout(timeout);
    }
  }

  private async requestOne<T>(path: string): Promise<T> {
    return (await this.requestPage<T>(path)).data;
  }

  private async requestAll<T>(path: string, maxItems: number): Promise<T[]> {
    const result: T[] = [];
    let next: string | null = path;
    for (let page = 0; next && page < MAX_PAGES && result.length < maxItems; page += 1) {
      const response: { data: T[]; next: string | null } = await this.requestPage<T[]>(next);
      if (!Array.isArray(response.data)) {
        throw new LmsError("Canvas returned an unexpected list response.", "canvas_invalid_response", 502);
      }
      result.push(...response.data.slice(0, maxItems - result.length));
      next = response.next;
    }
    return result;
  }

  async verifyConnection(): Promise<CanvasVerification> {
    const profile = await this.requestOne<CanvasProfile>("/api/v1/users/self/profile");
    const id = asId(profile.id);
    if (!id) throw new LmsError("Canvas profile response is missing an ID.", "canvas_invalid_profile", 502);
    return {
      externalUserId: id,
      displayName: cleanText(profile.name, 120) || "Canvas user",
      email: cleanText(profile.primary_email, 320) || null,
    };
  }

  async listCourses(): Promise<LmsCourseInput[]> {
    const courses = await this.requestAll<CanvasCourse>(
      "/api/v1/courses?enrollment_state=active&state%5B%5D=available&per_page=100",
      MAX_COURSES,
    );
    return courses.flatMap((course) => {
      const externalId = asId(course.id);
      const name = cleanText(course.name, 300);
      if (!externalId || !name) return [];
      return [{
        externalId,
        name,
        courseCode: cleanText(course.course_code, 120),
        enrollmentState: cleanText(course.enrollment_state, 80),
        workflowState: cleanText(course.workflow_state, 80),
        startAt: safeDate(course.start_at),
        endAt: safeDate(course.end_at),
      }];
    });
  }

  async loadCourseSnapshot(course: LmsCourseInput): Promise<CanvasCourseSnapshot> {
    const courseId = encodeURIComponent(course.externalId);
    const [modules, assignments, files] = await Promise.all([
      this.requestAll<CanvasModule>(
        `/api/v1/courses/${courseId}/modules?include%5B%5D=items&include%5B%5D=content_details&per_page=100`,
        200,
      ),
      this.requestAll<CanvasAssignment>(
        `/api/v1/courses/${courseId}/assignments?order_by=position&per_page=100`,
        MAX_MATERIALS_PER_COURSE,
      ),
      this.requestAll<CanvasFile>(
        `/api/v1/courses/${courseId}/files?sort=position&order=asc&per_page=100`,
        MAX_MATERIALS_PER_COURSE,
      ),
    ]);
    const warnings: string[] = [];
    const materials = new Map<string, LmsMaterialInput>();
    const assignmentMap = new Map(assignments.flatMap((value) => {
      const id = asId(value.id);
      return id ? [[id, value] as const] : [];
    }));
    const fileMap = new Map(files.flatMap((value) => {
      const id = asId(value.id);
      return id ? [[id, value] as const] : [];
    }));

    const add = (material: LmsMaterialInput) => {
      if (materials.size >= MAX_MATERIALS_PER_COURSE) return;
      materials.set(`${material.kind}:${material.externalId}`, material);
    };

    for (const canvasModule of modules) {
      const moduleId = asId(canvasModule.id);
      const moduleName = cleanText(canvasModule.name, 300);
      if (!moduleId || !moduleName) continue;
      add({
        externalId: moduleId,
        kind: "module",
        title: moduleName,
        moduleName,
        sourceUrl: null,
        mimeType: null,
        dueAt: null,
        position: Number.isInteger(canvasModule.position) ? Math.max(0, canvasModule.position || 0) : 0,
        textContent: "",
        contentHash: "",
        metadata: {},
      });
      for (const item of canvasModule.items || []) {
        const itemId = asId(item.id);
        const title = cleanText(item.title, 500);
        if (!itemId || !title) continue;
        const position = Number.isInteger(item.position) ? Math.max(0, item.position || 0) : 0;
        const contentId = asId(item.content_id);
        try {
          if (item.type === "Assignment" && contentId) {
            const assignment = assignmentMap.get(contentId);
            const textContent = stripHtml(assignment?.description);
            add({
              externalId: contentId,
              kind: "assignment",
              title: cleanText(assignment?.name, 500) || title,
              moduleName,
              sourceUrl: cleanText(assignment?.html_url || item.html_url, 2000) || null,
              mimeType: "text/html",
              dueAt: safeDate(assignment?.due_at),
              position,
              textContent,
              contentHash: hashContent(textContent),
              metadata: { pointsPossible: assignment?.points_possible ?? null },
            });
          } else if (item.type === "Page" && item.page_url) {
            const page = await this.requestOne<CanvasPage>(
              `/api/v1/courses/${courseId}/pages/${encodeURIComponent(item.page_url)}`,
            );
            const textContent = stripHtml(page.body);
            add({
              externalId: asId(page.page_id) || cleanText(page.url, 300) || itemId,
              kind: "page",
              title: cleanText(page.title, 500) || title,
              moduleName,
              sourceUrl: cleanText(page.html_url || item.html_url, 2000) || null,
              mimeType: "text/html",
              dueAt: null,
              position,
              textContent,
              contentHash: hashContent(textContent),
              metadata: { updatedAt: safeDate(page.updated_at) },
            });
          } else if (item.type === "File" && contentId) {
            const file = fileMap.get(contentId) || await this.requestOne<CanvasFile>(`/api/v1/files/${encodeURIComponent(contentId)}`);
            add({
              externalId: contentId,
              kind: "file",
              title: cleanText(file.display_name || file.filename, 500) || title,
              moduleName,
              sourceUrl: cleanText(file.url || item.html_url, 2000) || null,
              mimeType: cleanText(file["content-type"], 200) || null,
              dueAt: null,
              position,
              textContent: "",
              contentHash: "",
              metadata: { size: Number.isFinite(file.size) ? file.size : null, updatedAt: safeDate(file.updated_at) },
            });
          } else if ((item.type === "ExternalUrl" || item.type === "ExternalTool") && item.external_url) {
            add({
              externalId: itemId,
              kind: "external-link",
              title,
              moduleName,
              sourceUrl: cleanText(item.external_url, 2000) || null,
              mimeType: null,
              dueAt: null,
              position,
              textContent: "",
              contentHash: "",
              metadata: {},
            });
          }
        } catch (error) {
          const code = error instanceof LmsError ? error.code : "canvas_item_failed";
          warnings.push(`${itemId}:${code}`);
        }
      }
    }

    for (const assignment of assignments) {
      const id = asId(assignment.id);
      const title = cleanText(assignment.name, 500);
      if (!id || !title || materials.has(`assignment:${id}`)) continue;
      const textContent = stripHtml(assignment.description);
      add({
        externalId: id,
        kind: "assignment",
        title,
        moduleName: "",
        sourceUrl: cleanText(assignment.html_url, 2000) || null,
        mimeType: "text/html",
        dueAt: safeDate(assignment.due_at),
        position: Number.isInteger(assignment.position) ? Math.max(0, assignment.position || 0) : 0,
        textContent,
        contentHash: hashContent(textContent),
        metadata: { pointsPossible: assignment.points_possible ?? null },
      });
    }

    for (const file of files) {
      const id = asId(file.id);
      const title = cleanText(file.display_name || file.filename, 500);
      if (!id || !title || materials.has(`file:${id}`)) continue;
      add({
        externalId: id,
        kind: "file",
        title,
        moduleName: "",
        sourceUrl: cleanText(file.url, 2000) || null,
        mimeType: cleanText(file["content-type"], 200) || null,
        dueAt: null,
        position: 0,
        textContent: "",
        contentHash: "",
        metadata: { size: Number.isFinite(file.size) ? file.size : null, updatedAt: safeDate(file.updated_at) },
      });
    }

    if (materials.size >= MAX_MATERIALS_PER_COURSE) warnings.push("material_limit_reached");
    return { course, materials: [...materials.values()], warnings };
  }
}
