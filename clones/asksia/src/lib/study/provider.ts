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

const stopWords = new Set([
  "about", "after", "also", "been", "being", "between", "could", "did", "does", "explain", "from", "have", "how", "into", "more", "most", "other", "that", "the", "their", "there", "these", "they", "this", "through", "using", "what", "when", "where", "which", "who", "why", "will", "with", "won", "would",
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
  const normalized = text.toLowerCase();
  const raw = normalized.match(/[a-z0-9][a-z0-9-]{1,}|[\p{Script=Han}]{2,}/gu) ?? [];
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

function buildChunks(pages: StudySourcePage[]): Array<{ page: StudySourcePage; text: string }> {
  return pages.flatMap((page) => {
    const paragraphs = page.text.split(/\n{2,}|(?<=[.!?。！？])\s+/u).map(normalize).filter(Boolean);
    if (paragraphs.length === 0) return [];
    return paragraphs.map((paragraph) => ({ page, text: clip(paragraph, 520) }));
  });
}

function scoreChunk(chunk: string, queryTokens: string[]): number {
  const chunkTokens = new Set(tokens(chunk));
  return queryTokens.reduce((score, token) => score + (chunkTokens.has(token) ? Math.max(1, token.length / 2) : 0), 0);
}

class DeterministicStudyProvider implements StudyProvider {
  readonly id = "deterministic-local-v1";
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
      .map((keyword, index) => index === 0 ? `资料如何定义或解释“${keyword}”？` : index === 1 ? `“${keyword}”与资料中的其他概念有什么关系？` : `请根据资料概括“${keyword}”的重点。`);

    return {
      overview: overviewParts.join(" ") || `已读取 ${document.fileName}，但可用文字较少。`,
      keyConcepts,
      reviewQuestions,
    };
  }

  async answer(document: StudyDocumentInput, question: string): Promise<StudyQuestionResult> {
    const queryTokens = [...new Set(tokens(question))];
    const ranked = buildChunks(document.pages)
      .map((chunk) => ({ ...chunk, score: scoreChunk(chunk.text, queryTokens) }))
      .filter((chunk) => chunk.score >= 2)
      .sort((left, right) => right.score - left.score)
      .slice(0, 2);

    const provider = { id: this.id, mode: this.mode, label: this.label };
    if (queryTokens.length === 0 || ranked.length === 0) {
      return {
        answer: "在当前资料中没有找到足够依据来回答这个问题。请换一个更贴近资料内容的问题；我不会补写资料中没有的信息。",
        citations: [],
        grounded: false,
        provider,
      };
    }

    const citations: StudyCitation[] = ranked.map((chunk) => ({
      page: chunk.page.page,
      label: chunk.page.label,
      excerpt: clip(chunk.text, 240),
    }));
    return {
      answer: `根据资料中最相关的内容：${ranked.map((chunk) => clip(chunk.text, 260)).join(" ")}`,
      citations,
      grounded: true,
      provider,
    };
  }
}

export const studyProvider: StudyProvider = new DeterministicStudyProvider();
