import { getStudyProvider, type StudyProvider } from "../study/provider";
import type { StudyQuestionResult } from "../study/types";
import { extractMediaSource, mediaSourceToStudyPages, type MediaSourceOptions } from "./source";
import {
  MAX_VIDEO_QUESTION_CHARS,
  type VideoSession,
} from "./types";

export interface CreateVideoSessionOptions extends MediaSourceOptions {
  provider?: StudyProvider;
  id?: string;
  now?: string;
}

export async function createVideoSession(url: string, options: CreateVideoSessionOptions = {}): Promise<VideoSession> {
  const source = await extractMediaSource(url, options);
  const pages = mediaSourceToStudyPages(source);
  const provider = options.provider ?? getStudyProvider(options.environment);
  const summary = await provider.summarize({ fileName: source.title, pages });
  const now = options.now ?? new Date().toISOString();
  return {
    version: 1,
    id: options.id ?? crypto.randomUUID(),
    source: {
      kind: source.kind,
      url: source.url,
      canonicalUrl: source.canonicalUrl,
      title: source.title,
      author: source.author,
      durationSeconds: source.durationSeconds,
      language: source.language,
      transcriptCharacters: pages.reduce((total, page) => total + page.text.length, 0),
      segmentCount: source.transcript.length,
      fetchedAt: now,
    },
    provider: { id: provider.id, mode: provider.mode, label: provider.label },
    pages,
    summary,
    messages: [],
    truncated: source.truncated,
    createdAt: now,
    updatedAt: now,
  };
}

export async function askVideoSession(
  session: VideoSession,
  question: string,
  provider: StudyProvider = getStudyProvider(),
  now = new Date().toISOString(),
): Promise<{ session: VideoSession; result: StudyQuestionResult }> {
  const cleanQuestion = question.trim();
  if (cleanQuestion.length < 2 || cleanQuestion.length > MAX_VIDEO_QUESTION_CHARS) {
    throw new RangeError(`问题长度必须在 2–${MAX_VIDEO_QUESTION_CHARS} 个字符之间。`);
  }
  const result = await provider.answer({ fileName: session.source.title, pages: session.pages }, cleanQuestion);
  const next: VideoSession = {
    ...session,
    provider: result.provider,
    messages: [
      ...session.messages,
      { id: crypto.randomUUID(), role: "user", content: cleanQuestion, createdAt: now },
      {
        id: crypto.randomUUID(),
        role: "assistant",
        content: result.answer,
        citations: result.citations,
        createdAt: now,
      },
    ],
    updatedAt: now,
  };
  return { session: next, result };
}
