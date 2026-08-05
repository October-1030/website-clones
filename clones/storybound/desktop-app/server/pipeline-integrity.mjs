const rewritePlaceholders = new Set([
  "完整改写正文",
  "改写后的完整正文",
  "待改写正文",
  "示例正文",
  "实际完整正文字符串",
  "string",
]);

function compact(value) {
  return String(value || "").replace(/\s+/gu, "").trim();
}

export function rewriteNarrationIssue(value, sourceText, targetLength) {
  const narration = compact(value);
  if (!narration) return "WriterAgent 没有返回改写正文";
  if (rewritePlaceholders.has(narration)) return `WriterAgent 返回了占位内容“${narration}”，不是真实正文`;

  const sourceLength = compact(sourceText).length;
  const requestedLength = Number(targetLength);
  const expectedLength = Number.isFinite(requestedLength) && requestedLength > 0
    ? requestedLength
    : sourceLength;
  const minimumLength = expectedLength >= 120
    ? Math.min(220, Math.max(80, Math.floor(expectedLength * 0.25)))
    : Math.max(12, Math.floor(expectedLength * 0.3));
  if (narration.length < minimumLength) {
    return `WriterAgent 正文只有 ${narration.length} 字，低于本任务最低完整性要求 ${minimumLength} 字`;
  }
  return "";
}

export function writerPayloadIssue(payload, sourceText, targetLength) {
  const narrationIssue = rewriteNarrationIssue(
    payload?.narration || payload?.rewritten_text || payload?.content,
    sourceText,
    targetLength,
  );
  if (narrationIssue) return narrationIssue;
  const scoreValues = payload?.scores && typeof payload.scores === "object"
    ? Object.values(payload.scores).map(Number).filter(Number.isFinite)
    : [];
  if (scoreValues.length < 6) return "WriterAgent 缺少六维自评 scores";
  const totalScore = Number(payload?.totalScore ?? payload?.total_score);
  if (!Number.isFinite(totalScore)) return "WriterAgent 缺少有效的自评总分 totalScore";
  return "";
}

export function metadataIssue(payload) {
  const title = compact(payload?.title);
  const subtitles = Array.isArray(payload?.subtitle) ? payload.subtitle.map(compact).filter(Boolean) : [];
  const summary = compact(payload?.summary || payload?.publishCopy || payload?.publish_copy || payload?.description);
  const tags = Array.isArray(payload?.tags) ? payload.tags.map(compact).filter(Boolean) : [];
  const comments = Array.isArray(payload?.comments) ? payload.comments.map(compact).filter(Boolean) : [];
  if (!title) return "封面与发布元数据缺少主标题";
  if (!subtitles.length) return "封面与发布元数据缺少副标题";
  if (summary.length < 20) return "封面与发布元数据的视频简介不完整";
  if (tags.length < 3) return "封面与发布元数据至少需要 3 个有效标签";
  if (comments.length !== 5) return `封面与发布元数据应返回 5 条种子评论，实际为 ${comments.length} 条`;
  return "";
}

export function taskRewriteIntegrityIssue(task) {
  if (!task || task.mode !== "auto") return "";
  const promptTemplateId = String(task.options?.promptTemplateId || "");
  if (promptTemplateId.startsWith("system-") && promptTemplateId !== `system-${task.track}`) {
    return `内容赛道“${task.track}”与提示词模板“${promptTemplateId.slice(7)}”不一致`;
  }
  const rewrite = task.artifacts?.rewrite;
  if (!rewrite) return "缺少 Step 2 改写产物";
  const narrationIssue = rewriteNarrationIssue(
    rewrite.narration,
    task.artifacts?.precheck?.cleanText || task.inputText,
    task.options?.targetLength,
  );
  if (narrationIssue) return narrationIssue;
  return metadataIssue(rewrite);
}
