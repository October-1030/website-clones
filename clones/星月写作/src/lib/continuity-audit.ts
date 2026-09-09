import type { Book, Chapter } from "@/types/workspace";

export function buildContinuityAuditSource(book: Book, chapters: Chapter[], limit = 24000) {
  const instruction = [
    "请对这部小说进行剧情一致性体检。",
    "逐项检查：人物目标和状态、时间线、地点移动、世界规则、物品去向、称谓与专名、伏笔埋设和回收、事件因果。",
    "每个问题必须引用对应章节和原有信息，标明严重程度，并给出最小修改方案；证据不足时写“待确认”，不要虚构错误。",
  ].join("\n");
  const summaries = chapters.filter((chapter) => chapter.summary.trim()).map((chapter) => `- ${chapter.title}：${chapter.summary.trim()}`).join("\n");
  const recent = chapters.filter((chapter) => chapter.content.trim()).slice(-3).map((chapter) => {
    const body = chapter.content.replace(/\r/g, "").trim();
    return `${chapter.title}\n${body.length > 1600 ? `…${body.slice(-1600)}` : body}`;
  }).join("\n\n");
  const sections = [
    instruction,
    book.description.trim() ? `【作品设定】\n${book.description.trim()}` : "",
    summaries ? `【全部章节概要】\n${summaries}` : "【全部章节概要】\n尚未生成章节概要，以下判断只能依据近期正文。",
    recent ? `【最近正文结尾】\n${recent}` : "",
  ].filter(Boolean);
  const full = sections.join("\n\n");
  if (full.length <= limit) return full;
  const separator = "\n\n……中间概要因长度限制已压缩……\n\n";
  const available = Math.max(0, limit - separator.length);
  const headLength = Math.floor(available * 0.6);
  return `${full.slice(0, headLength)}${separator}${full.slice(-(available - headLength))}`;
}
