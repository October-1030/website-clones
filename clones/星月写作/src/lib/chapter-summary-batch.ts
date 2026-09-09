import type { Chapter } from "@/types/workspace";

export interface ChapterSummaryTarget {
  key: string;
  chapterId: string;
  title: string;
}

export interface ChapterSummaryRequest {
  prompt: string;
  targets: ChapterSummaryTarget[];
  omitted: number;
}

function excerpt(content: string, budget: number) {
  const text = content.replace(/\r/g, "").trim();
  if (text.length <= budget) return text;
  const head = Math.floor((budget - 5) * 0.45);
  const tail = budget - 5 - head;
  return `${text.slice(0, head)}\n……\n${text.slice(-tail)}`;
}

export function buildChapterSummaryRequest(chapters: Chapter[], limit = 24000, batchSize = 20): ChapterSummaryRequest {
  if (!Number.isInteger(limit) || limit < 2000) throw new Error("概要生成上下文至少需要2000字符。");
  if (!Number.isInteger(batchSize) || batchSize < 1 || batchSize > 50) throw new Error("概要批次必须为1至50章。");
  const missing = chapters.filter((chapter) => chapter.content.trim() && !chapter.summary.trim());
  if (!missing.length) throw new Error("所有有正文的章节都已经有概要。");
  const included = missing.slice(0, batchSize);
  const instruction = [
    "为下面每章生成一个可用于长篇续写的概要。",
    "严格每章一行，格式为 S编号｜概要，例如：S1｜主角发现密信并决定赴约。",
    "保留人物目标、事件因果、新信息、伏笔和章末状态；不要输出标题、序号说明或其他文字。",
    "概要语言跟随正文，每条控制在60至160字。",
  ].join("\n");
  const fixedLength = instruction.length + included.reduce((sum, chapter, index) => sum + `\n\n【S${index + 1} · ${chapter.title}】\n`.length, 0);
  const contentBudget = Math.max(200, Math.floor((limit - fixedLength) / included.length));
  const targets = included.map((chapter, index) => ({ key: `S${index + 1}`, chapterId: chapter.id, title: chapter.title }));
  const bodies = included.map((chapter, index) => `【S${index + 1} · ${chapter.title}】\n${excerpt(chapter.content, contentBudget)}`);
  const omitted = missing.length - included.length;
  const omittedNotice = omitted ? `\n\n本批未包含其余${omitted}章；完成并保存本批后可再次运行。` : "";
  const prompt = `${instruction}\n\n${bodies.join("\n\n")}${omittedNotice}`;
  return { prompt: prompt.slice(0, limit), targets, omitted };
}

export function applyGeneratedChapterSummaries(chapters: Chapter[], targets: ChapterSummaryTarget[], output: string, updatedAt = new Date().toISOString()) {
  const accepted = new Map<string, string>();
  for (const rawLine of output.replace(/```(?:json|text)?/gi, "").replace(/```/g, "").split(/\r?\n/)) {
    const match = rawLine.trim().match(/^(S\d+)\s*[|｜:：]\s*(.+)$/i);
    if (!match) continue;
    const summary = match[2].trim().slice(0, 500);
    if (summary) accepted.set(match[1].toUpperCase(), summary);
  }
  const summaryById = new Map(targets.flatMap((target) => {
    const summary = accepted.get(target.key);
    return summary ? [[target.chapterId, summary] as const] : [];
  }));
  if (!summaryById.size) throw new Error("没有识别到 S编号｜概要 格式，请调整结果后再应用。");
  let applied = 0;
  const updated = chapters.map((chapter) => {
    const summary = summaryById.get(chapter.id);
    if (!summary || chapter.summary.trim()) return chapter;
    applied += 1;
    return { ...chapter, summary, updatedAt };
  });
  if (!applied) throw new Error("目标章节已有概要，没有覆盖原内容。");
  return { chapters: updated, applied };
}
