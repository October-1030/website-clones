import type { StudyCitation, StudyProviderMode, StudyQuestionResult, StudySourcePage, StudySummary } from "./types";

export interface StudyDocumentInput {
  pages: StudySourcePage[];
  fileName: string;
}

export interface StudyProvider {
  readonly id: string;
  readonly mode: StudyProviderMode;
  readonly label: string;
  summarize(document: StudyDocumentInput): Promise<StudySummary>;
  answer(document: StudyDocumentInput, question: string): Promise<StudyQuestionResult>;
}

export interface StudyChunk {
  id: string;
  page: number | null;
  label: string;
  text: string;
}

export class StudyProviderError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly status = 502,
  ) {
    super(message);
    this.name = "StudyProviderError";
  }
}

const stopWords = new Set([
  "about", "after", "also", "been", "being", "between", "could", "did", "does", "explain", "from", "have", "how", "into", "more", "most", "other", "that", "the", "their", "there", "these", "they", "this", "through", "using", "what", "when", "where", "which", "who", "why", "will", "with", "would",
  "一个", "以及", "什么", "他们", "可以", "因为", "如何", "对于", "我们", "所有", "这个", "这些", "进行", "通过", "需要",
]);

function normalize(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function clip(value: string, length = 280): string {
  const normalized = normalize(value);
  return normalized.length > length ? `${normalized.slice(0, length - 1)}…` : normalized;
}

function sentences(text: string): string[] {
  return text
    .split(/(?<=[.!?。！？])\s+|\n{2,}/u)
    .map((sentence) => normalize(sentence))
    .filter((sentence) => sentence.length >= 24);
}

function tokens(text: string): string[] {
  const raw = text.toLowerCase().match(/[a-z0-9][a-z0-9-]{1,}|[\p{Script=Han}]{2,}/gu) ?? [];
  const result: string[] = [];
  for (const token of raw) {
    if (/^[\p{Script=Han}]+$/u.test(token) && token.length > 3) {
      for (let index = 0; index < token.length - 1; index += 1) result.push(token.slice(index, index + 2));
    } else if (!stopWords.has(token)) {
      result.push(token);
    }
  }
  return result.filter((token) => !stopWords.has(token));
}

function keywordCandidates(document: StudyDocumentInput): string[] {
  const originalTerms = document.pages
    .flatMap((page) => page.text.match(/[A-Za-z][A-Za-z-]{3,}|[\p{Script=Han}]{2,8}/gu) ?? [])
    .filter((term) => !stopWords.has(term.toLowerCase()));
  const frequencies = new Map<string, { count: number; display: string }>();
  for (const term of originalTerms) {
    const key = term.toLowerCase();
    const current = frequencies.get(key);
    frequencies.set(key, { count: (current?.count ?? 0) + 1, display: current?.display ?? term });
  }
  return [...frequencies.values()]
    .sort((left, right) => right.count - left.count || right.display.length - left.display.length)
    .slice(0, 6)
    .map((entry) => entry.display);
}

export function buildStudyChunks(pages: StudySourcePage[], targetLength = 1_400, overlap = 180): StudyChunk[] {
  const chunks: StudyChunk[] = [];
  for (const page of pages) {
    const text = normalize(page.text);
    let start = 0;
    while (start < text.length) {
      let end = Math.min(text.length, start + targetLength);
      if (end < text.length) {
        const boundary = Math.max(
          text.lastIndexOf(". ", end),
          text.lastIndexOf("。", end),
          text.lastIndexOf("\n", end),
        );
        if (boundary > start + Math.floor(targetLength * 0.55)) end = boundary + 1;
      }
      const chunkText = text.slice(start, end).trim();
      if (chunkText) chunks.push({ id: `S${chunks.length + 1}`, page: page.page, label: page.label, text: chunkText });
      if (end >= text.length) break;
      start = Math.max(start + 1, end - overlap);
    }
  }
  return chunks;
}

function scoreChunk(chunk: string, queryTokens: string[]): number {
  const chunkTokens = new Set(tokens(chunk));
  return queryTokens.reduce((score, token) => score + (chunkTokens.has(token) ? Math.max(1, token.length / 2) : 0), 0);
}

export function selectRelevantChunks(pages: StudySourcePage[], question: string, limit = 6): StudyChunk[] {
  const queryTokens = [...new Set(tokens(question))];
  if (queryTokens.length === 0) return [];
  return buildStudyChunks(pages)
    .map((chunk) => ({ chunk, score: scoreChunk(chunk.text, queryTokens) }))
    .filter((entry) => entry.score > 0)
    .sort((left, right) => right.score - left.score)
    .slice(0, limit)
    .map((entry) => entry.chunk);
}

function selectSummaryChunks(pages: StudySourcePage[], maxCharacters = 45_000): StudyChunk[] {
  const chunks = buildStudyChunks(pages);
  const totalCharacters = chunks.reduce((total, chunk) => total + chunk.text.length, 0);
  if (totalCharacters <= maxCharacters) return chunks;
  const count = Math.max(1, Math.floor(maxCharacters / 1_500));
  const sampled: StudyChunk[] = [];
  for (let index = 0; index < count; index += 1) {
    const sourceIndex = count === 1 ? 0 : Math.round(index * (chunks.length - 1) / (count - 1));
    const chunk = chunks[sourceIndex];
    if (chunk && !sampled.includes(chunk)) sampled.push(chunk);
  }
  return sampled;
}

class DeterministicStudyProvider implements StudyProvider {
  readonly id = "deterministic-local-v2";
  readonly mode = "demo" as const;
  readonly label = "演示模式 · 本地确定性总结";

  async summarize(document: StudyDocumentInput): Promise<StudySummary> {
    const allSentences = document.pages.flatMap((page) => sentences(page.text));
    const fallback = document.pages.map((page) => normalize(page.text)).filter(Boolean);
    const overviewParts = (allSentences.length ? allSentences : fallback).slice(0, 3).map((value) => clip(value, 300));
    const keywords = keywordCandidates(document);
    const keyConcepts = keywords.length
      ? keywords.slice(0, 5).map((keyword) => {
          const evidence = allSentences.find((sentence) => sentence.toLowerCase().includes(keyword.toLowerCase()));
          return evidence ? `${keyword}：${clip(evidence, 180)}` : keyword;
        })
      : overviewParts.slice(0, 3);
    const reviewQuestions = (keywords.length ? keywords : ["核心观点", "关键方法", "主要结论"])
      .slice(0, 4)
      .map((keyword, index) => index === 0
        ? `资料如何定义或解释“${keyword}”？`
        : index === 1
          ? `“${keyword}”与资料中的其他概念有什么关系？`
          : `请根据资料概括“${keyword}”的重点。`);
    return {
      overview: overviewParts.join(" ") || `已读取 ${document.fileName}，但可用文字较少。`,
      keyConcepts,
      reviewQuestions,
    };
  }

  async answer(document: StudyDocumentInput, question: string): Promise<StudyQuestionResult> {
    const ranked = selectRelevantChunks(document.pages, question, 2);
    const provider = { id: this.id, mode: this.mode, label: this.label };
    if (ranked.length === 0) {
      return {
        answer: "在当前资料中没有找到足够依据来回答这个问题。请换一个更贴近资料内容的问题；我不会补写资料中没有的信息。",
        citations: [],
        grounded: false,
        provider,
      };
    }
    const citations: StudyCitation[] = ranked.map((chunk) => ({ page: chunk.page, label: chunk.label, excerpt: clip(chunk.text, 240) }));
    return {
      answer: `根据资料中最相关的内容：${ranked.map((chunk) => clip(chunk.text, 260)).join(" ")}`,
      citations,
      grounded: true,
      provider,
    };
  }
}

interface OpenAIProviderOptions {
  apiKey: string;
  model: string;
  baseUrl?: string;
  fetchImpl?: typeof fetch;
}

interface OpenAIResponsePayload {
  output_text?: string;
  output?: Array<{ content?: Array<{ type?: string; text?: string; refusal?: string }> }>;
  error?: { message?: string };
}

function responseText(payload: OpenAIResponsePayload): string {
  if (typeof payload.output_text === "string" && payload.output_text.trim()) return payload.output_text;
  const parts = payload.output?.flatMap((item) => item.content ?? []) ?? [];
  const text = parts.filter((part) => part.type === "output_text" && typeof part.text === "string").map((part) => part.text).join("");
  if (text.trim()) return text;
  const refusal = parts.find((part) => part.type === "refusal" && typeof part.refusal === "string")?.refusal;
  throw new StudyProviderError(refusal || "真实 AI 没有返回可用内容。", "live_empty_response");
}

function validateBaseUrl(value: string): string {
  let url: URL;
  try {
    url = new URL(value.endsWith("/") ? value : `${value}/`);
  } catch {
    throw new StudyProviderError("OPENAI_BASE_URL 不是有效网址。", "live_invalid_base_url", 503);
  }
  const local = url.hostname === "localhost" || url.hostname === "127.0.0.1";
  if (url.protocol !== "https:" && !(local && url.protocol === "http:")) {
    throw new StudyProviderError("真实 AI 地址必须使用 HTTPS；仅本机 localhost 可使用 HTTP。", "live_insecure_base_url", 503);
  }
  return url.toString();
}

export class OpenAIResponsesStudyProvider implements StudyProvider {
  readonly id: string;
  readonly mode = "live" as const;
  readonly label: string;
  private readonly apiKey: string;
  private readonly model: string;
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;

  constructor(options: OpenAIProviderOptions) {
    this.apiKey = options.apiKey;
    this.model = options.model;
    this.baseUrl = validateBaseUrl(options.baseUrl || "https://api.openai.com/v1");
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.id = `openai-responses:${this.model}`;
    this.label = `真实 AI · ${this.model}`;
  }

  private async structuredRequest<T>(name: string, schema: Record<string, unknown>, instructions: string, input: string): Promise<T> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 60_000);
    try {
      const endpoint = new URL("responses", this.baseUrl);
      const response = await this.fetchImpl(endpoint, {
        method: "POST",
        headers: { Authorization: `Bearer ${this.apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: this.model,
          instructions,
          input,
          store: false,
          max_output_tokens: 2_400,
          text: { format: { type: "json_schema", name, strict: true, schema } },
        }),
        signal: controller.signal,
      });
      const payload = await response.json().catch(() => ({})) as OpenAIResponsePayload;
      if (!response.ok) {
        const detail = payload.error?.message ? `：${clip(payload.error.message, 180)}` : "";
        throw new StudyProviderError(`真实 AI 请求失败（HTTP ${response.status}）${detail}`, "live_request_failed", 502);
      }
      const text = responseText(payload);
      try {
        return JSON.parse(text) as T;
      } catch {
        throw new StudyProviderError("真实 AI 返回的结构无法解析。", "live_invalid_response");
      }
    } catch (error) {
      if (error instanceof StudyProviderError) throw error;
      if (error instanceof Error && error.name === "AbortError") throw new StudyProviderError("真实 AI 请求超时，请重试。", "live_timeout", 504);
      throw new StudyProviderError("无法连接真实 AI 服务，请检查网络与服务配置。", "live_unreachable", 502);
    } finally {
      clearTimeout(timeout);
    }
  }

  async summarize(document: StudyDocumentInput): Promise<StudySummary> {
    const sources = selectSummaryChunks(document.pages).map((chunk) => `[${chunk.id}] [${chunk.label}]\n${chunk.text}`).join("\n\n");
    return this.structuredRequest<StudySummary>(
      "study_summary",
      {
        type: "object",
        additionalProperties: false,
        properties: {
          overview: { type: "string" },
          keyConcepts: { type: "array", items: { type: "string" }, minItems: 3, maxItems: 7 },
          reviewQuestions: { type: "array", items: { type: "string" }, minItems: 3, maxItems: 6 },
        },
        required: ["overview", "keyConcepts", "reviewQuestions"],
      },
      "You are StudyPal AI. Summarize only the supplied study material. Preserve the document's primary language. Do not add outside facts. Return a concise overview, key concepts, and useful review questions.",
      `File: ${document.fileName}\n\nStudy material:\n${sources}`,
    );
  }

  async answer(document: StudyDocumentInput, question: string): Promise<StudyQuestionResult> {
    const selected = selectRelevantChunks(document.pages, question, 6);
    const provider = { id: this.id, mode: this.mode, label: this.label };
    if (selected.length === 0) {
      return { answer: "在当前资料中没有找到足够依据来回答这个问题。我不会补写资料中没有的信息。", citations: [], grounded: false, provider };
    }
    const sourceById = new Map(selected.map((chunk) => [chunk.id, chunk]));
    const sources = selected.map((chunk) => `[${chunk.id}] [${chunk.label}]\n${chunk.text}`).join("\n\n");
    const result = await this.structuredRequest<{ answer: string; sourceIds: string[] }>(
      "grounded_study_answer",
      {
        type: "object",
        additionalProperties: false,
        properties: { answer: { type: "string" }, sourceIds: { type: "array", items: { type: "string" } } },
        required: ["answer", "sourceIds"],
      },
      "Answer only from the supplied source fragments. If the fragments do not support an answer, say so and return an empty sourceIds array. Never invent source IDs, page numbers, or facts. Use the question's language.",
      `Question: ${question}\n\nSource fragments:\n${sources}`,
    );
    const cited = [...new Set(result.sourceIds)].map((id) => sourceById.get(id)).filter((chunk): chunk is StudyChunk => Boolean(chunk));
    return {
      answer: result.answer,
      citations: cited.map((chunk) => ({ page: chunk.page, label: chunk.label, excerpt: clip(chunk.text, 300) })),
      grounded: cited.length > 0,
      provider,
    };
  }
}

export const demoStudyProvider: StudyProvider = new DeterministicStudyProvider();

export function getStudyProvider(environment: NodeJS.ProcessEnv = process.env): StudyProvider {
  const requested = (environment.STUDYPAL_AI_PROVIDER || "demo").trim().toLowerCase();
  if (requested === "demo") return demoStudyProvider;
  if (requested !== "openai") throw new StudyProviderError("STUDYPAL_AI_PROVIDER 仅支持 demo 或 openai。", "live_unknown_provider", 503);
  const apiKey = environment.OPENAI_API_KEY?.trim();
  const model = environment.OPENAI_MODEL?.trim();
  if (!apiKey || !model) {
    throw new StudyProviderError("真实 AI 模式尚未完成配置：需要在服务端设置 OPENAI_API_KEY 和 OPENAI_MODEL。", "live_not_configured", 503);
  }
  return new OpenAIResponsesStudyProvider({ apiKey, model, baseUrl: environment.OPENAI_BASE_URL?.trim() || undefined });
}

// Kept for deterministic fixtures. Request handlers resolve the configured provider per request.
export const studyProvider = demoStudyProvider;
