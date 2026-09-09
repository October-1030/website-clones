import type { Book } from "@/types/workspace";

export interface ContextResource {
  name: string;
  content?: string;
  personality?: string;
  background?: string;
  appearance?: string;
  bookId?: string;
}

export interface ContextKnowledge {
  title: string;
  content: string;
}

export interface LongNovelContextResult {
  text: string;
  compressed: boolean;
  includedChapters: number;
}

function compact(value: string) {
  return value.replace(/\r/g, "").replace(/\n{3,}/g, "\n\n").trim();
}

export function buildLongNovelContext(book: Book, resources: ContextResource[], knowledge: ContextKnowledge[], limit = 6000): LongNovelContextResult {
  if (!Number.isInteger(limit) || limit < 500) throw new Error("上下文长度至少需要500字符。");
  const chapters = book.chapters?.length ? book.chapters : book.content ? [{ id: "body", title: "正文", content: book.content, summary: "", updatedAt: book.updatedAt }] : [];
  const sections: string[] = [];
  if (book.description.trim()) sections.push(`【作品设定】\n${compact(book.description)}`);

  const relatedResources = resources.filter((item) => !item.bookId || item.bookId === book.id);
  if (relatedResources.length) {
    sections.push(`【人物与资料】\n${relatedResources.map((item) => {
      const detail = [item.content, item.personality, item.background, item.appearance].filter(Boolean).join("；");
      return `- ${item.name}${detail ? `：${compact(detail)}` : ""}`;
    }).join("\n")}`);
  }
  if (knowledge.length) sections.push(`【知识卡】\n${knowledge.map((item) => `- ${item.title}：${compact(item.content)}`).join("\n")}`);

  const summaries = chapters.filter((chapter) => chapter.summary.trim());
  if (summaries.length) sections.push(`【已写章节概要】\n${summaries.map((chapter) => `- ${chapter.title}：${compact(chapter.summary)}`).join("\n")}`);

  const recent = chapters.filter((chapter) => chapter.content.trim()).slice(-3);
  if (recent.length) sections.push(`【最近正文结尾】\n${recent.map((chapter) => {
    const body = compact(chapter.content);
    return `${chapter.title}\n${body.length > 900 ? `…${body.slice(-900)}` : body}`;
  }).join("\n\n")}`);

  const full = sections.join("\n\n");
  if (full.length <= limit) return { text: full, compressed: false, includedChapters: summaries.length + recent.length };
  const notice = "\n\n【系统提示】资料超过上限，已保留开头设定与最近剧情并压缩中间内容。";
  const separator = "\n\n……\n\n";
  const available = Math.max(0, limit - notice.length - separator.length);
  const headLength = Math.floor(available * 0.55);
  const tailLength = available - headLength;
  const latest = recent.at(-1);
  const latestHeading = latest ? `【最近正文结尾】\n${latest.title}\n` : "【资料结尾】\n";
  const latestBody = latest ? compact(latest.content) : full;
  const bodyBudget = Math.max(0, tailLength - latestHeading.length);
  const visibleBody = latestBody.length <= bodyBudget
    ? latestBody
    : bodyBudget <= 1 ? "…".slice(0, bodyBudget) : `…${latestBody.slice(-(bodyBudget - 1))}`;
  const tail = latestHeading.length >= tailLength ? latestHeading.slice(0, tailLength) : `${latestHeading}${visibleBody}`;
  return {
    text: `${full.slice(0, headLength)}${separator}${tail}${notice}`,
    compressed: true,
    includedChapters: summaries.length + recent.length,
  };
}
