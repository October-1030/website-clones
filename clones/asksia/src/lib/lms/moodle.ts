import { createHash } from "node:crypto";
import type { LmsCourseInput, LmsMaterialInput } from "./types";
import { LmsError } from "./types";

const MAX_RESPONSE_CHARS = 2_000_000;
const MAX_COURSES = 100;
const MAX_MATERIALS_PER_COURSE = 500;

const READ_ONLY_FUNCTIONS = [
  "core_webservice_get_site_info",
  "core_enrol_get_users_courses",
  "core_course_get_contents",
] as const;

type ReadOnlyFunction = typeof READ_ONLY_FUNCTIONS[number];

interface MoodleFunctionInfo {
  name?: string;
  version?: string;
}

interface MoodleSiteInfo {
  sitename?: string;
  siteurl?: string;
  username?: string;
  firstname?: string;
  lastname?: string;
  fullname?: string;
  userid?: number | string;
  functions?: MoodleFunctionInfo[];
}

interface MoodleCourse {
  id?: number | string;
  shortname?: string;
  fullname?: string;
  enrolledusercount?: number;
  visible?: number;
  startdate?: number | string;
  enddate?: number | string;
  progress?: number;
  completed?: boolean;
}

interface MoodleContentFile {
  type?: string;
  filename?: string;
  filepath?: string;
  filesize?: number;
  fileurl?: string;
  timemodified?: number | string;
  mimetype?: string;
  author?: string;
  license?: string;
}

interface MoodleModuleDate {
  label?: string;
  timestamp?: number | string;
  dataid?: string;
}

interface MoodleModule {
  id?: number | string;
  url?: string;
  name?: string;
  instance?: number | string;
  visible?: number;
  uservisible?: boolean;
  modname?: string;
  modplural?: string;
  availability?: string | null;
  description?: string;
  contents?: MoodleContentFile[];
  dates?: MoodleModuleDate[];
  contentsinfo?: { filescount?: number; filessize?: number; lastmodified?: number; mimetypes?: string[] };
}

interface MoodleSection {
  id?: number | string;
  name?: string;
  visible?: number;
  summary?: string;
  summaryformat?: number;
  section?: number;
  modules?: MoodleModule[];
}

interface MoodleErrorPayload {
  exception?: string;
  errorcode?: string;
  message?: string;
  debuginfo?: string;
}

export interface MoodleVerification {
  externalUserId: string;
  displayName: string;
  email: null;
}

export interface MoodleCourseSnapshot {
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
  if ((typeof value !== "string" && typeof value !== "number") || !String(value).trim()) return null;
  const output = String(value).trim();
  return output.length <= 300 ? output : null;
}

function unixDate(value: unknown): string | null {
  const seconds = Number(value);
  if (!Number.isFinite(seconds) || seconds <= 0) return null;
  const date = new Date(seconds * 1_000);
  return Number.isNaN(date.valueOf()) ? null : date.toISOString();
}

function hashContent(value: string): string {
  return value ? createHash("sha256").update(value).digest("hex") : "";
}

function materialKind(modname: string, hasFiles: boolean): LmsMaterialInput["kind"] {
  if (modname === "url" || modname === "lti") return "external-link";
  if (["assign", "quiz", "lesson", "workshop", "choice", "feedback", "scorm"].includes(modname)) return "assignment";
  if (hasFiles || modname === "resource" || modname === "folder") return "file";
  return "page";
}

export class MoodleClient {
  private readonly baseUrl: URL;
  private readonly endpoint: URL;
  private readonly fetchImpl: typeof fetch;
  private userId: string | null = null;

  constructor(instanceUrl: string, private readonly accessToken: string, options: { fetchImpl?: typeof fetch } = {}) {
    this.baseUrl = new URL(`${instanceUrl.replace(/\/$/, "")}/`);
    this.endpoint = new URL("webservice/rest/server.php", this.baseUrl);
    this.fetchImpl = options.fetchImpl || fetch;
  }

  private safeSourceUrl(value: unknown): string | null {
    const clean = cleanText(value, 2_000);
    if (!clean) return null;
    try {
      const url = new URL(clean, this.baseUrl);
      if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) return null;
      url.searchParams.delete("token");
      url.searchParams.delete("wstoken");
      return url.toString().slice(0, 2_000);
    } catch {
      return null;
    }
  }

  private async request<T>(wsfunction: ReadOnlyFunction, parameters: Record<string, string> = {}): Promise<T> {
    if (!READ_ONLY_FUNCTIONS.includes(wsfunction)) {
      throw new LmsError("Moodle function is not on the read-only allowlist.", "moodle_function_blocked", 403);
    }
    const body = new URLSearchParams({
      wstoken: this.accessToken,
      wsfunction,
      moodlewsrestformat: "json",
      ...parameters,
    });
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 25_000);
    try {
      const response = await this.fetchImpl(this.endpoint, {
        method: "POST",
        redirect: "manual",
        signal: controller.signal,
        headers: {
          Accept: "application/json",
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body,
      });
      if (response.status >= 300 && response.status < 400) {
        throw new LmsError("Moodle API redirects are not followed.", "moodle_redirect_blocked", 502);
      }
      if (!response.ok) {
        throw new LmsError(`Moodle API failed with HTTP ${response.status}.`, "moodle_api_failed", 502);
      }
      const length = Number(response.headers.get("content-length") || 0);
      if (length > MAX_RESPONSE_CHARS * 4) throw new LmsError("Moodle response is too large.", "moodle_response_too_large", 413);
      const text = await response.text();
      if (text.length > MAX_RESPONSE_CHARS) throw new LmsError("Moodle response is too large.", "moodle_response_too_large", 413);
      let payload: T & MoodleErrorPayload;
      try {
        payload = JSON.parse(text) as T & MoodleErrorPayload;
      } catch {
        throw new LmsError("Moodle returned malformed JSON.", "moodle_invalid_response", 502);
      }
      if (payload?.exception || payload?.errorcode) {
        const code = cleanText(payload.errorcode, 120).toLowerCase();
        if (code.includes("invalidtoken") || code.includes("token")) {
          throw new LmsError("Moodle rejected the web service token.", "moodle_token_rejected", 401);
        }
        if (code.includes("access") || code.includes("capability") || code.includes("servicenotavailable")) {
          throw new LmsError("Moodle denied a required read-only function.", "moodle_scope_denied", 403);
        }
        throw new LmsError("Moodle web service returned an error.", "moodle_api_failed", 502);
      }
      return payload as T;
    } catch (error) {
      if (error instanceof LmsError) throw error;
      if (error instanceof Error && error.name === "AbortError") throw new LmsError("Moodle API request timed out.", "moodle_timeout", 504);
      throw new LmsError("Moodle API could not be reached.", "moodle_unreachable", 502);
    } finally {
      clearTimeout(timeout);
    }
  }

  async verifyConnection(): Promise<MoodleVerification> {
    const site = await this.request<MoodleSiteInfo>("core_webservice_get_site_info");
    const id = asId(site.userid);
    if (!id) throw new LmsError("Moodle site info is missing a user ID.", "moodle_invalid_user", 502);
    const available = new Set((site.functions || []).map((value) => cleanText(value.name, 200)));
    const missing = READ_ONLY_FUNCTIONS.filter((name) => !available.has(name));
    if (missing.length) {
      throw new LmsError(
        `Moodle service is missing required read-only functions: ${missing.join(", ")}.`,
        "moodle_scope_denied",
        403,
      );
    }
    this.userId = id;
    const displayName = cleanText(site.fullname || [site.firstname, site.lastname].filter(Boolean).join(" ") || site.username, 120) || "Moodle";
    return { externalUserId: id, displayName, email: null };
  }

  async listCourses(): Promise<LmsCourseInput[]> {
    if (!this.userId) await this.verifyConnection();
    const courses = await this.request<MoodleCourse[]>("core_enrol_get_users_courses", { userid: this.userId || "" });
    if (!Array.isArray(courses)) throw new LmsError("Moodle course response is invalid.", "moodle_invalid_response", 502);
    return courses.slice(0, MAX_COURSES).flatMap((course) => {
      const externalId = asId(course.id);
      const name = cleanText(course.fullname, 300);
      if (!externalId || !name || course.visible === 0) return [];
      return [{
        externalId,
        name,
        courseCode: cleanText(course.shortname, 120),
        enrollmentState: "enrolled",
        workflowState: course.completed ? "completed" : "active",
        startAt: unixDate(course.startdate),
        endAt: unixDate(course.enddate),
      }];
    });
  }

  async loadCourseSnapshot(course: LmsCourseInput): Promise<MoodleCourseSnapshot> {
    const sections = await this.request<MoodleSection[]>("core_course_get_contents", { courseid: course.externalId });
    if (!Array.isArray(sections)) throw new LmsError("Moodle content response is invalid.", "moodle_invalid_response", 502);
    const materials = new Map<string, LmsMaterialInput>();
    const warnings: string[] = [];
    for (const [sectionIndex, section] of sections.entries()) {
      if (materials.size >= MAX_MATERIALS_PER_COURSE) break;
      if (section.visible === 0) continue;
      const sectionId = asId(section.id) || `section-${sectionIndex}`;
      const sectionName = cleanText(section.name, 500) || `Section ${sectionIndex + 1}`;
      const sectionText = stripHtml(section.summary);
      materials.set(`module:${sectionId}`, {
        externalId: sectionId,
        kind: "module",
        title: sectionName,
        moduleName: "",
        sourceUrl: null,
        mimeType: null,
        dueAt: null,
        position: Number.isInteger(section.section) ? Math.max(0, section.section || 0) : sectionIndex,
        textContent: sectionText,
        contentHash: hashContent(sectionText),
        metadata: { summaryFormat: section.summaryformat ?? null },
      });
      for (const [moduleIndex, courseModule] of (section.modules || []).entries()) {
        if (materials.size >= MAX_MATERIALS_PER_COURSE) break;
        if (courseModule.visible === 0 || courseModule.uservisible === false) continue;
        const moduleId = asId(courseModule.id);
        const title = cleanText(courseModule.name, 500);
        if (!moduleId || !title) continue;
        const modname = cleanText(courseModule.modname, 100).toLowerCase();
        const files = Array.isArray(courseModule.contents) ? courseModule.contents : [];
        const kind = materialKind(modname, files.length > 0);
        const textContent = stripHtml(courseModule.description);
        const dueDate = (courseModule.dates || []).find((value) => cleanText(value.label, 80).toLowerCase().includes("due"));
        materials.set(`${kind}:${moduleId}`, {
          externalId: moduleId,
          kind,
          title,
          moduleName: sectionName,
          sourceUrl: this.safeSourceUrl(courseModule.url),
          mimeType: courseModule.contentsinfo?.mimetypes?.[0]?.slice(0, 200) || null,
          dueAt: unixDate(dueDate?.timestamp),
          position: moduleIndex,
          textContent,
          contentHash: hashContent(textContent),
          metadata: {
            modname,
            instanceId: asId(courseModule.instance),
            availability: cleanText(courseModule.availability, 1_000) || null,
            filesCount: Number(courseModule.contentsinfo?.filescount || files.length),
            filesSize: Number(courseModule.contentsinfo?.filessize || 0),
          },
        });
        for (const [fileIndex, file] of files.entries()) {
          if (materials.size >= MAX_MATERIALS_PER_COURSE) break;
          const filename = cleanText(file.filename, 500);
          if (!filename || file.type === "content") continue;
          const fingerprint = hashContent(`${moduleId}:${file.filepath || ""}:${filename}`).slice(0, 24);
          materials.set(`file:${moduleId}:${fingerprint}`, {
            externalId: `${moduleId}:file:${fingerprint}`,
            kind: "file",
            title: filename,
            moduleName: `${sectionName} / ${title}`,
            sourceUrl: this.safeSourceUrl(file.fileurl),
            mimeType: cleanText(file.mimetype, 200) || null,
            dueAt: null,
            position: fileIndex,
            textContent: "",
            contentHash: "",
            metadata: {
              path: cleanText(file.filepath, 1_000),
              size: Number(file.filesize || 0),
              modifiedAt: unixDate(file.timemodified),
              author: cleanText(file.author, 200),
              license: cleanText(file.license, 120),
            },
          });
        }
      }
    }
    if (materials.size >= MAX_MATERIALS_PER_COURSE) warnings.push("material_limit_reached");
    return { course, materials: [...materials.values()], warnings };
  }
}