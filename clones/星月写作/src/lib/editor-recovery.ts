import type { Chapter } from "@/types/workspace";

export interface EditorRecoveryDraft {
  format: "xingyue-editor-recovery";
  version: 1;
  bookId: string;
  chapterId: string;
  title: string;
  content: string;
  summary: string;
  savedAt: string;
}

export function createEditorRecoveryDraft(bookId: string, chapter: Chapter, savedAt = new Date().toISOString()): EditorRecoveryDraft {
  return {
    format: "xingyue-editor-recovery",
    version: 1,
    bookId,
    chapterId: chapter.id,
    title: chapter.title,
    content: chapter.content,
    summary: chapter.summary,
    savedAt,
  };
}

export function parseEditorRecoveryDraft(value: string | null): EditorRecoveryDraft | null {
  if (!value) return null;
  try {
    const draft: unknown = JSON.parse(value);
    if (!draft || typeof draft !== "object" || Array.isArray(draft)) return null;
    const record = draft as Record<string, unknown>;
    if (record.format !== "xingyue-editor-recovery" || record.version !== 1) return null;
    if (!["bookId", "chapterId", "title", "content", "summary", "savedAt"].every((field) => typeof record[field] === "string")) return null;
    return record as unknown as EditorRecoveryDraft;
  } catch {
    return null;
  }
}

export function applyEditorRecovery(chapters: Chapter[], draft: EditorRecoveryDraft | null, bookId: string, bookUpdatedAt: string) {
  if (!draft || draft.bookId !== bookId || Date.parse(draft.savedAt) <= Date.parse(bookUpdatedAt)) return { chapters, recovered: false };
  const chapter = chapters.find((item) => item.id === draft.chapterId);
  if (!chapter) return { chapters, recovered: false };
  if (chapter.title === draft.title && chapter.content === draft.content && chapter.summary === draft.summary) return { chapters, recovered: false };
  return {
    chapters: chapters.map((item) => item.id === draft.chapterId ? {
      ...item,
      title: draft.title,
      content: draft.content,
      summary: draft.summary,
      updatedAt: draft.savedAt,
    } : item),
    recovered: true,
  };
}
