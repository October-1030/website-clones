export interface KnowledgeDocument {
  id: string;
  title: string;
  content: string;
  sourceName: string;
  companyId: string;
  projectId: string;
  createdAt: string;
}

export interface SearchQuestion {
  id: string;
  text: string;
  source: "ai" | "manual";
  companyId: string;
  projectId: string;
  createdAt: string;
}

export interface WritingPrompt {
  id: string;
  name: string;
  content: string;
  createdAt: string;
}

export interface GeneratedArticle {
  id: string;
  title: string;
  content: string;
  questionId: string;
  promptId: string;
  companyId: string;
  projectId: string;
  createdAt: string;
}

export interface PublicationTask {
  id: string;
  articleId: string;
  platform: string;
  scheduledAt: string;
  status: "draft" | "queued";
  createdAt: string;
}

export interface IndexRecord {
  id: string;
  articleId: string;
  platform: string;
  query: string;
  url: string;
  status: "included" | "not-found" | "pending";
  createdAt: string;
}

export interface GeoReport {
  id: string;
  type: "diagnosis" | "monitor";
  title: string;
  content: string;
  createdAt: string;
}

export interface GeoWorkflowData {
  knowledge: KnowledgeDocument[];
  questions: SearchQuestion[];
  prompts: WritingPrompt[];
  articles: GeneratedArticle[];
  publications: PublicationTask[];
  indexing: IndexRecord[];
  reports: GeoReport[];
}

export const emptyGeoWorkflow: GeoWorkflowData = {
  knowledge: [],
  questions: [],
  prompts: [],
  articles: [],
  publications: [],
  indexing: [],
  reports: [],
};

export function parseGeneratedQuestions(reply: string, limit: number) {
  const lines = reply
    .split(/\r?\n/)
    .map((line) => line.replace(/^\s*(?:[-*•]|\d+[.)、])\s*/, "").trim())
    .filter((line) => line.length >= 4 && line.length <= 180);
  return [...new Set(lines)].slice(0, limit);
}

export async function requestWorkflowGeneration(prompt: string, signal?: AbortSignal) {
  const response = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages: [{ role: "user", content: prompt }] }),
    signal,
  });
  const payload: unknown = await response.json();
  if (!response.ok || typeof payload !== "object" || payload === null || !("reply" in payload) || typeof payload.reply !== "string") {
    const message = typeof payload === "object" && payload !== null && "error" in payload && typeof payload.error === "object" && payload.error !== null && "message" in payload.error && typeof payload.error.message === "string" ? payload.error.message : "MiniMax 生成失败，请稍后再试。";
    throw new Error(message);
  }
  return payload.reply.trim();
}
