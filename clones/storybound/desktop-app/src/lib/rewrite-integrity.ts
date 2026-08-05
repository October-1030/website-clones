import type { StoryboundTask } from "../types/task";

export type RewriteIntegrityLevel = "blocking" | "warning";

export interface RewriteIntegrityIssue {
  code: string;
  level: RewriteIntegrityLevel;
  message: string;
}

const rewritePlaceholders = new Set([
  "完整改写正文",
  "改写后的完整正文",
  "待改写正文",
  "示例正文",
  "实际完整正文字符串",
  "string",
]);

function compact(value: string | undefined): string {
  return (value || "").replace(/\s+/gu, "").trim();
}

export function systemTemplateTrack(promptTemplateId: string | undefined): string | null {
  return promptTemplateId?.startsWith("system-") ? promptTemplateId.slice(7) : null;
}

export function taskRewriteIntegrityIssues(task: StoryboundTask): RewriteIntegrityIssue[] {
  const issues: RewriteIntegrityIssue[] = [];
  const templateTrack = systemTemplateTrack(task.options.promptTemplateId);
  if (templateTrack && templateTrack !== task.track) {
    issues.push({
      code: "template-track-mismatch",
      level: "blocking",
      message: `内容赛道是“${task.track}”，但提示词模板是“${templateTrack}”；两套规则会生成互相矛盾的标题和文案。`,
    });
  }
  if (task.mode !== "auto") return issues;

  const rewrite = task.artifacts.rewrite;
  if (!rewrite) {
    issues.push({ code: "rewrite-missing", level: "blocking", message: "缺少 Step 2 改写产物。" });
    return issues;
  }

  const narration = compact(rewrite.narration);
  if (!narration) {
    issues.push({ code: "narration-empty", level: "blocking", message: "改写正文为空。" });
  } else if (rewritePlaceholders.has(narration)) {
    issues.push({ code: "narration-placeholder", level: "blocking", message: `“${narration}”是格式占位词，不是真实改写正文。` });
  } else {
    const sourceLength = compact(task.artifacts.precheck?.cleanText || task.inputText).length;
    const expectedLength = task.options.targetLength && task.options.targetLength > 0
      ? task.options.targetLength
      : sourceLength;
    const minimumLength = expectedLength >= 120
      ? Math.min(220, Math.max(80, Math.floor(expectedLength * 0.25)))
      : Math.max(12, Math.floor(expectedLength * 0.3));
    if (narration.length < minimumLength) {
      issues.push({
        code: "narration-too-short",
        level: "blocking",
        message: `改写正文只有 ${narration.length} 字，低于当前任务最低完整性要求 ${minimumLength} 字。`,
      });
    }
  }

  if (!compact(rewrite.title)) issues.push({ code: "title-empty", level: "blocking", message: "封面主标题为空。" });
  if (!(rewrite.subtitle || []).some((line) => compact(line))) issues.push({ code: "subtitle-empty", level: "blocking", message: "封面副标题为空。" });
  if (compact(rewrite.summary || rewrite.publishCopy).length < 20) issues.push({ code: "summary-incomplete", level: "blocking", message: "发布简介为空或不完整。" });
  if ((rewrite.tags || []).filter((tag) => compact(tag)).length < 3) issues.push({ code: "tags-incomplete", level: "blocking", message: "有效发布标签少于 3 个。" });
  if ((rewrite.comments || []).filter((comment) => compact(comment)).length !== 5) issues.push({ code: "comments-incomplete", level: "blocking", message: "原版元数据规则要求恰好 5 条种子评论。" });
  if (!compact(rewrite.pinnedComment)) issues.push({ code: "pinned-comment-empty", level: "warning", message: "置顶评论为空；默认应取第 1 条种子评论。" });
  const scoreCount = rewrite.scores ? Object.values(rewrite.scores).map(Number).filter(Number.isFinite).length : 0;
  if (scoreCount < 6 || !Number.isFinite(rewrite.totalScore)) issues.push({ code: "writer-score-missing", level: "warning", message: "原版 WriterAgent 的六维自评或总分没有完整保存。" });
  return issues;
}

export function blockingRewriteIssues(task: StoryboundTask): RewriteIntegrityIssue[] {
  return taskRewriteIntegrityIssues(task).filter((issue) => issue.level === "blocking");
}
