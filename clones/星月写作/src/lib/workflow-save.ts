import type { Book } from "../types/workspace";

export function appendWorkflowChapters(book: Book, outputs: string[], now = new Date().toISOString()): Book {
  if (!outputs.length || outputs.some(output => !output.trim())) throw new Error("没有完整的轮次结果可保存。");
  const existing = book.chapters?.length ? book.chapters : book.content.trim() ? [{ id: crypto.randomUUID(), title: "第1章", content: book.content, summary: "", updatedAt: book.updatedAt }] : [];
  const chapters = [...existing, ...outputs.map((content,index) => ({ id: crypto.randomUUID(), title: `第${existing.length + index + 1}章`, content, summary: "", updatedAt: now }))];
  return { ...book, chapters, content: chapters.map(chapter => chapter.content).filter(Boolean).join("\n\n"), updatedAt: now };
}

/** Append at the chosen position, keeping the editor and whole-book export identical. */
export function appendWorkflowOutput(book: Book, output: string, chapterId = "", now = new Date().toISOString()): Book {
  if (!output.trim()) throw new Error("当前没有可保存的结果。");
  const chapters = book.chapters?.length ? book.chapters : [{
    id: crypto.randomUUID(), title: "第1章", content: book.content, summary: "", updatedAt: now,
  }];
  const targetIndex = chapterId ? chapters.findIndex(chapter => chapter.id === chapterId) : chapters.length - 1;
  if (targetIndex < 0) throw new Error("所选章节已不存在，请重新选择章节后保存。");
  const updated = chapters.map((chapter, index) => index === targetIndex ? {
    ...chapter,
    content: `${chapter.content}${chapter.content.trim() ? "\n\n" : ""}${output}`,
    updatedAt: now,
  } : chapter);
  return { ...book, chapters: updated, content: updated.map(chapter => chapter.content).filter(Boolean).join("\n\n"), updatedAt: now };
}
