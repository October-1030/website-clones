import type { Chapter } from "@/types/workspace";

export function buildContinuationSource(chapters: Chapter[], chapterId: string, limit = 24000) {
  if (!Number.isInteger(limit) || limit < 1000) throw new Error("续写前文长度至少需要1000字符。");
  const currentIndex = chapters.findIndex((chapter) => chapter.id === chapterId);
  if (currentIndex < 0) return "";
  const recent = chapters.slice(Math.max(0, currentIndex - 3), currentIndex + 1);
  const header = "以下是当前章及最多3章相邻前文，请承接人物状态、时间线和未完成冲突：";
  const available = limit - header.length - 2;
  const perChapter = Math.max(200, Math.floor(available / recent.length) - 12);
  const sections = recent.map((chapter) => {
    const body = chapter.content.trim();
    const clipped = body.length > perChapter ? `…${body.slice(-(perChapter - 1))}` : body;
    return `【${chapter.title}】\n${clipped || "（本章尚未写正文）"}`;
  });
  const text = `${header}\n\n${sections.join("\n\n")}`;
  return text.length > limit ? text.slice(0, limit) : text;
}
