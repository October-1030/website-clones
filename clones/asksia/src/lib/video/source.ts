import type { StudySourcePage } from "../study/types";
import {
  MAX_MEDIA_URL_CHARS,
  MAX_VIDEO_TRANSCRIPT_CHARS,
  type ExtractedMediaSource,
  type VideoTranscriptSegment,
} from "./types";

const YOUTUBE_HOSTS = new Set(["youtube.com", "www.youtube.com", "m.youtube.com", "youtu.be", "www.youtube-nocookie.com"]);
const PODCAST_HOSTS = new Set([
  "podcasts.apple.com",
  "open.spotify.com",
  "podcasters.spotify.com",
  "buzzsprout.com",
  "www.buzzsprout.com",
  "podbean.com",
  "www.podbean.com",
  "transistor.fm",
  "www.transistor.fm",
]);
const MAX_REMOTE_HTML_CHARS = 4_000_000;
const MAX_REDIRECTS = 3;
const BROWSER_USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36";
const VIDEO_ID_PATTERN = /^[a-zA-Z0-9_-]{6,20}$/;

export class MediaSourceError extends Error {
  constructor(message: string, public readonly code: string, public readonly status = 422) {
    super(message);
    this.name = "MediaSourceError";
  }
}

export interface MediaSourceOptions {
  fetchImpl?: typeof fetch;
  environment?: NodeJS.ProcessEnv;
}

interface CaptionTrack {
  baseUrl?: string;
  languageCode?: string;
  kind?: string;
  name?: { simpleText?: string };
}

function normalizeText(value: string): string {
  return value.replace(/\u200b/g, "").replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
}

function decodeEntities(value: string): string {
  return value
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)))
    .replace(/&#x([\da-f]+);/gi, (_, code: string) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/&quot;/gi, "\"")
    .replace(/&apos;|&#39;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&amp;/gi, "&");
}

function stripHtml(value: string): string {
  return normalizeText(decodeEntities(value.replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]+>/g, " ")));
}

function configuredPodcastHosts(environment: NodeJS.ProcessEnv): Set<string> {
  const hosts = new Set(PODCAST_HOSTS);
  for (const raw of (environment.STUDYPAL_MEDIA_ALLOWED_HOSTS || "").split(",")) {
    const host = raw.trim().toLowerCase().replace(/\.$/, "");
    if (host) hosts.add(host);
  }
  return hosts;
}

function looksPrivateHost(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/\.$/, "");
  return host === "localhost"
    || host.endsWith(".localhost")
    || host.endsWith(".local")
    || /^\d{1,3}(?:\.\d{1,3}){3}$/.test(host)
    || host.includes(":");
}

export function extractYoutubeVideoId(url: URL): string | null {
  const host = url.hostname.toLowerCase();
  let candidate: string | null = null;
  if (host === "youtu.be") candidate = url.pathname.split("/").filter(Boolean)[0] ?? null;
  else if (YOUTUBE_HOSTS.has(host)) {
    if (url.pathname === "/watch") candidate = url.searchParams.get("v");
    else {
      const parts = url.pathname.split("/").filter(Boolean);
      if (["embed", "shorts", "live"].includes(parts[0] || "")) candidate = parts[1] ?? null;
    }
  }
  return candidate && VIDEO_ID_PATTERN.test(candidate) ? candidate : null;
}

export function validateMediaUrl(raw: string, environment: NodeJS.ProcessEnv = process.env): {
  url: URL;
  kind: "youtube" | "podcast";
  videoId: string | null;
  allowedHosts: Set<string>;
} {
  const clean = raw.trim();
  if (!clean || clean.length > MAX_MEDIA_URL_CHARS) {
    throw new MediaSourceError(`链接长度必须在 1–${MAX_MEDIA_URL_CHARS} 个字符之间。`, "invalid_media_url", 400);
  }
  let url: URL;
  try {
    url = new URL(clean);
  } catch {
    throw new MediaSourceError("请输入完整的 HTTPS 视频或播客链接。", "invalid_media_url", 400);
  }
  if (url.protocol !== "https:" || url.username || url.password || url.port || looksPrivateHost(url.hostname)) {
    throw new MediaSourceError("仅支持不含账号信息的公开 HTTPS 链接。", "unsafe_media_url", 400);
  }
  const host = url.hostname.toLowerCase();
  const videoId = extractYoutubeVideoId(url);
  if (YOUTUBE_HOSTS.has(host)) {
    if (!videoId) throw new MediaSourceError("无法识别该 YouTube 视频 ID。", "invalid_youtube_url", 400);
    return { url, kind: "youtube", videoId, allowedHosts: YOUTUBE_HOSTS };
  }
  const podcastHosts = configuredPodcastHosts(environment);
  if (!podcastHosts.has(host)) {
    throw new MediaSourceError("该域名不在媒体读取白名单中。当前默认支持 YouTube 和已配置的播客平台。", "media_host_not_allowed", 400);
  }
  return { url, kind: "podcast", videoId: null, allowedHosts: podcastHosts };
}

function validateRedirectUrl(url: URL, allowedHosts: Set<string>): void {
  if (
    url.protocol !== "https:"
    || url.username
    || url.password
    || url.port
    || looksPrivateHost(url.hostname)
    || !allowedHosts.has(url.hostname.toLowerCase())
  ) throw new MediaSourceError("媒体页面跳转到了未授权域名，已停止读取。", "unsafe_media_redirect", 400);
}

async function fetchBoundedText(
  initialUrl: URL,
  allowedHosts: Set<string>,
  fetchImpl: typeof fetch,
  accept: string,
): Promise<{ response: Response; text: string; finalUrl: URL }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 25_000);
  let current = initialUrl;
  try {
    for (let redirects = 0; redirects <= MAX_REDIRECTS; redirects += 1) {
      validateRedirectUrl(current, allowedHosts);
      const response = await fetchImpl(current, {
        redirect: "manual",
        signal: controller.signal,
        headers: {
          Accept: accept,
          "Accept-Language": "en-US,en;q=0.8,zh-CN;q=0.7",
          "User-Agent": BROWSER_USER_AGENT,
        },
      });
      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get("location");
        if (!location || redirects === MAX_REDIRECTS) throw new MediaSourceError("媒体页面重定向次数过多。", "media_redirect_failed");
        current = new URL(location, current);
        continue;
      }
      if (!response.ok) throw new MediaSourceError(`媒体页面读取失败（HTTP ${response.status}）。`, "media_fetch_failed", 502);
      const contentLength = Number(response.headers.get("content-length") || 0);
      if (contentLength > MAX_REMOTE_HTML_CHARS * 4) throw new MediaSourceError("远程页面体积过大，已停止读取。", "media_response_too_large", 413);
      const text = await response.text();
      if (text.length > MAX_REMOTE_HTML_CHARS) throw new MediaSourceError("远程页面体积过大，已停止读取。", "media_response_too_large", 413);
      return { response, text, finalUrl: current };
    }
    throw new MediaSourceError("媒体页面重定向失败。", "media_redirect_failed");
  } catch (error) {
    if (error instanceof MediaSourceError) throw error;
    if (error instanceof Error && error.name === "AbortError") throw new MediaSourceError("媒体页面读取超时。", "media_fetch_timeout", 504);
    throw new MediaSourceError("无法连接媒体页面，请检查网络或稍后重试。", "media_unreachable", 502);
  } finally {
    clearTimeout(timeout);
  }
}

function extractJsonArrayAfterKey(html: string, key: string): unknown[] | null {
  const marker = `"${key}":`;
  const markerIndex = html.indexOf(marker);
  if (markerIndex < 0) return null;
  const start = html.indexOf("[", markerIndex + marker.length);
  if (start < 0) return null;
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let index = start; index < html.length; index += 1) {
    const character = html[index];
    if (inString) {
      if (escaped) escaped = false;
      else if (character === "\\") escaped = true;
      else if (character === "\"") inString = false;
      continue;
    }
    if (character === "\"") inString = true;
    else if (character === "[") depth += 1;
    else if (character === "]") {
      depth -= 1;
      if (depth === 0) {
        try {
          return JSON.parse(html.slice(start, index + 1)) as unknown[];
        } catch {
          return null;
        }
      }
    }
  }
  return null;
}

function metaContent(html: string, key: string): string | null {
  for (const tag of html.match(/<meta\b[^>]*>/gi) ?? []) {
    const name = tag.match(/\b(?:name|property)\s*=\s*["']([^"']+)["']/i)?.[1];
    if (name?.toLowerCase() !== key.toLowerCase()) continue;
    const content = tag.match(/\bcontent\s*=\s*["']([^"']*)["']/i)?.[1];
    if (content) return stripHtml(content);
  }
  return null;
}

function formatTimestamp(seconds: number): string {
  const whole = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(whole / 3_600);
  const minutes = Math.floor((whole % 3_600) / 60);
  const remaining = whole % 60;
  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, "0")}:${String(remaining).padStart(2, "0")}`
    : `${minutes}:${String(remaining).padStart(2, "0")}`;
}

function parseJson3Transcript(raw: string): VideoTranscriptSegment[] {
  const payload = JSON.parse(raw) as { events?: Array<{ tStartMs?: number; dDurationMs?: number; segs?: Array<{ utf8?: string }> }> };
  const result: VideoTranscriptSegment[] = [];
  for (const event of payload.events ?? []) {
    const text = normalizeText((event.segs ?? []).map((segment) => segment.utf8 || "").join(""));
    if (!text) continue;
    const startSeconds = Math.max(0, Number(event.tStartMs || 0) / 1_000);
    const durationSeconds = Math.max(0, Number(event.dDurationMs || 0) / 1_000);
    result.push({ startSeconds, durationSeconds, label: formatTimestamp(startSeconds), text });
  }
  return result;
}

function parseXmlTranscript(raw: string): VideoTranscriptSegment[] {
  const result: VideoTranscriptSegment[] = [];
  for (const match of raw.matchAll(/<text\b([^>]*)>([\s\S]*?)<\/text>/gi)) {
    const attributes = match[1] || "";
    const startSeconds = Number(attributes.match(/\bstart=["']([^"']+)["']/i)?.[1] || 0);
    const durationSeconds = Number(attributes.match(/\bdur=["']([^"']+)["']/i)?.[1] || 0);
    const text = stripHtml(match[2] || "");
    if (text) result.push({ startSeconds, durationSeconds, label: formatTimestamp(startSeconds), text });
  }
  return result;
}

function capTranscript(segments: VideoTranscriptSegment[]): { transcript: VideoTranscriptSegment[]; truncated: boolean } {
  const result: VideoTranscriptSegment[] = [];
  let remaining = MAX_VIDEO_TRANSCRIPT_CHARS;
  let truncated = false;
  for (const segment of segments) {
    if (remaining <= 0) {
      truncated = true;
      break;
    }
    const text = segment.text.slice(0, remaining);
    result.push({ ...segment, text });
    remaining -= text.length;
    if (text.length < segment.text.length) {
      truncated = true;
      break;
    }
  }
  return { transcript: result, truncated };
}

interface InnertubePlayerResponse {
  playabilityStatus?: { status?: string };
  captions?: { playerCaptionsTracklistRenderer?: { captionTracks?: CaptionTrack[] } };
  videoDetails?: {
    title?: string;
    author?: string;
    lengthSeconds?: string;
  };
}

function chooseCaptionTrack(tracks: CaptionTrack[], preferredLanguage: string): CaptionTrack | null {
  const usable = tracks.filter((track) => typeof track.baseUrl === "string" && track.baseUrl.startsWith("https://"));
  const exact = usable.find((track) => track.languageCode?.toLowerCase() === preferredLanguage.toLowerCase());
  if (exact) return exact;
  const family = preferredLanguage.split("-")[0]?.toLowerCase();
  const related = usable.find((track) => track.languageCode?.toLowerCase().split("-")[0] === family);
  if (related) return related;
  return usable.find((track) => track.kind === "asr") ?? usable.find((track) => track.kind !== "asr") ?? null;
}

async function fetchAndroidPlayer(
  pageHtml: string,
  videoId: string,
  fetchImpl: typeof fetch,
): Promise<InnertubePlayerResponse | null> {
  const apiKey = pageHtml.match(/"INNERTUBE_API_KEY":"([^"]+)"/)?.[1]
    ?? pageHtml.match(/INNERTUBE_API_KEY\\":\\"([^\\"]+)\\"/)?.[1];
  if (!apiKey) return null;
  const endpoint = new URL(`https://www.youtube.com/youtubei/v1/player?key=${encodeURIComponent(apiKey)}`);
  validateRedirectUrl(endpoint, YOUTUBE_HOSTS);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 25_000);
  try {
    const response = await fetchImpl(endpoint, {
      method: "POST",
      redirect: "manual",
      signal: controller.signal,
      headers: {
        Accept: "application/json",
        "Accept-Language": "en-US,en;q=0.9",
        "Content-Type": "application/json",
        "User-Agent": BROWSER_USER_AGENT,
      },
      body: JSON.stringify({
        context: {
          client: {
            clientName: "ANDROID",
            clientVersion: "20.10.38",
            hl: "en",
            gl: "US",
          },
        },
        videoId,
      }),
    });
    if (!response.ok) return null;
    const text = await response.text();
    if (!text || text.length > MAX_REMOTE_HTML_CHARS) return null;
    return JSON.parse(text) as InnertubePlayerResponse;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

async function downloadCaptionTrack(
  track: CaptionTrack,
  fetchImpl: typeof fetch,
): Promise<VideoTranscriptSegment[]> {
  if (!track.baseUrl) return [];
  const transcriptUrl = new URL(track.baseUrl);
  transcriptUrl.searchParams.set("fmt", "json3");
  const response = await fetchBoundedText(transcriptUrl, YOUTUBE_HOSTS, fetchImpl, "application/json,text/xml;q=0.9");
  try {
    return parseJson3Transcript(response.text);
  } catch {
    return parseXmlTranscript(response.text);
  }
}

async function extractYoutubeSource(
  videoId: string,
  fetchImpl: typeof fetch,
  environment: NodeJS.ProcessEnv,
): Promise<ExtractedMediaSource> {
  const canonicalUrl = new URL(`https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}`);
  const page = await fetchBoundedText(canonicalUrl, YOUTUBE_HOSTS, fetchImpl, "text/html");
  const pageTracks = (extractJsonArrayAfterKey(page.text, "captionTracks") ?? []) as CaptionTrack[];
  const player = await fetchAndroidPlayer(page.text, videoId, fetchImpl);
  const androidTracks = player?.captions?.playerCaptionsTracklistRenderer?.captionTracks ?? [];
  const preferredLanguage = environment.STUDYPAL_MEDIA_LANGUAGE?.trim() || "en";
  const candidates = [
    chooseCaptionTrack(androidTracks, preferredLanguage),
    chooseCaptionTrack(pageTracks, preferredLanguage),
  ].filter((track): track is CaptionTrack => Boolean(track));

  let selectedTrack: CaptionTrack | null = null;
  let segments: VideoTranscriptSegment[] = [];
  for (const track of candidates) {
    const downloaded = await downloadCaptionTrack(track, fetchImpl);
    if (downloaded.length > 0) {
      selectedTrack = track;
      segments = downloaded;
      break;
    }
  }
  if (candidates.length === 0) {
    throw new MediaSourceError("该 YouTube 视频没有可读取的公开字幕。请换一个带字幕的视频。", "youtube_captions_unavailable");
  }
  if (!selectedTrack || segments.reduce((total, segment) => total + segment.text.length, 0) < 80) {
    throw new MediaSourceError("字幕内容为空或过短，无法生成可靠总结。", "youtube_transcript_empty");
  }

  const capped = capTranscript(segments);
  const lengthSeconds = Number(player?.videoDetails?.lengthSeconds || page.text.match(/"lengthSeconds":"(\d+)"/)?.[1] || 0);
  return {
    kind: "youtube",
    url: canonicalUrl.toString(),
    canonicalUrl: canonicalUrl.toString(),
    title: player?.videoDetails?.title || metaContent(page.text, "og:title") || `YouTube ${videoId}`,
    author: player?.videoDetails?.author || metaContent(page.text, "author"),
    durationSeconds: lengthSeconds > 0 ? lengthSeconds : null,
    language: selectedTrack.languageCode || null,
    transcript: capped.transcript,
    truncated: capped.truncated,
  };
}

function jsonLdObjects(html: string): unknown[] {
  const values: unknown[] = [];
  for (const match of html.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      values.push(JSON.parse(decodeEntities(match[1].trim())));
    } catch {
      // Ignore malformed third-party JSON-LD and keep looking for a valid transcript.
    }
  }
  return values;
}

function walkObjects(value: unknown, visit: (object: Record<string, unknown>) => void): void {
  if (Array.isArray(value)) {
    for (const item of value) walkObjects(item, visit);
    return;
  }
  if (!value || typeof value !== "object") return;
  const object = value as Record<string, unknown>;
  visit(object);
  for (const child of Object.values(object)) walkObjects(child, visit);
}

function transcriptText(value: unknown): string | null {
  if (typeof value === "string") {
    const text = stripHtml(value);
    return text.length >= 80 ? text : null;
  }
  if (value && typeof value === "object" && "text" in value && typeof value.text === "string") {
    const text = stripHtml(value.text);
    return text.length >= 80 ? text : null;
  }
  return null;
}

function podcastSegments(text: string): VideoTranscriptSegment[] {
  const paragraphs = text.split(/\n{2,}|(?<=[.!?。！？])\s+(?=[A-Z\u4e00-\u9fff])/u).map(normalizeText).filter(Boolean);
  const segments: VideoTranscriptSegment[] = [];
  let current = "";
  for (const paragraph of paragraphs) {
    if (current && current.length + paragraph.length > 3_500) {
      segments.push({ startSeconds: null, durationSeconds: null, label: `Transcript section ${segments.length + 1}`, text: current });
      current = "";
    }
    current = current ? `${current}\n${paragraph}` : paragraph;
  }
  if (current) segments.push({ startSeconds: null, durationSeconds: null, label: `Transcript section ${segments.length + 1}`, text: current });
  return segments;
}

async function extractPodcastSource(
  url: URL,
  allowedHosts: Set<string>,
  fetchImpl: typeof fetch,
): Promise<ExtractedMediaSource> {
  const page = await fetchBoundedText(url, allowedHosts, fetchImpl, "text/html,application/xhtml+xml");
  let transcript: string | null = null;
  let title: string | null = null;
  let author: string | null = null;
  let durationSeconds: number | null = null;
  for (const value of jsonLdObjects(page.text)) {
    walkObjects(value, (object) => {
      if (!transcript) transcript = transcriptText(object.transcript);
      if (!title && typeof object.name === "string") title = stripHtml(object.name);
      if (!durationSeconds && typeof object.duration === "string") {
        const match = object.duration.match(/^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/i);
        if (match) durationSeconds = Number(match[1] || 0) * 3_600 + Number(match[2] || 0) * 60 + Number(match[3] || 0);
      }
      if (!author && object.author && typeof object.author === "object" && "name" in object.author && typeof object.author.name === "string") {
        author = stripHtml(object.author.name);
      }
    });
  }
  if (!transcript) {
    throw new MediaSourceError("该播客页面没有公开结构化 transcript，不能只根据标题或简介生成总结。", "podcast_transcript_unavailable");
  }
  const capped = capTranscript(podcastSegments(transcript));
  return {
    kind: "podcast",
    url: url.toString(),
    canonicalUrl: page.finalUrl.toString(),
    title: title || metaContent(page.text, "og:title") || "Podcast episode",
    author,
    durationSeconds,
    language: null,
    transcript: capped.transcript,
    truncated: capped.truncated,
  };
}

export async function extractMediaSource(raw: string, options: MediaSourceOptions = {}): Promise<ExtractedMediaSource> {
  const environment = options.environment ?? process.env;
  const validated = validateMediaUrl(raw, environment);
  const fetchImpl = options.fetchImpl ?? fetch;
  if (validated.kind === "youtube" && validated.videoId) return extractYoutubeSource(validated.videoId, fetchImpl, environment);
  return extractPodcastSource(validated.url, validated.allowedHosts, fetchImpl);
}

export function mediaSourceToStudyPages(source: ExtractedMediaSource): StudySourcePage[] {
  if (source.kind === "podcast") {
    return source.transcript.map((segment) => ({ page: null, label: segment.label, text: segment.text }));
  }
  const pages: StudySourcePage[] = [];
  let start = source.transcript[0]?.startSeconds ?? 0;
  let end = start;
  let text = "";
  function flush() {
    if (!text.trim()) return;
    pages.push({ page: null, label: `${formatTimestamp(start)}–${formatTimestamp(end)}`, text: text.trim() });
    text = "";
  }
  for (const segment of source.transcript) {
    const segmentStart = segment.startSeconds ?? end;
    const segmentEnd = segmentStart + (segment.durationSeconds ?? 0);
    if (text && (segmentStart - start >= 300 || text.length + segment.text.length > 6_000)) {
      flush();
      start = segmentStart;
    }
    end = Math.max(segmentEnd, segmentStart);
    text += `${text ? "\n" : ""}[${segment.label}] ${segment.text}`;
  }
  flush();
  return pages;
}
