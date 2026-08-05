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

const orderedOpinionMarkers = ["第一", "第二", "第三", "第四", "第五", "第六", "第七", "第八"];
const fictionalNarrativePatterns = [
  /(?:^|[。！？\n])(?:从前|很久以前|有一天|这一天|有个人|有一位|有个(?:男人|女人|年轻人|老人))/u,
  /(?:他|她)叫[\u3400-\u9fff·]{2,8}/u,
  /[\u3400-\u9fff]{2,10}(?:府|县|村|镇)人/u,
  /(?:老和尚|老道士|小庙|佛前|师傅|掌柜|书生|村里人|邻村|家徒四壁)/u,
  /(?:上山|下山|跪在|娶了|嫁给|盖起了新房|几年后|[一二三四五六七八九十\d]+年后)/u,
];

function orderedOpinionMarkerCount(value) {
  const text = String(value || "");
  return orderedOpinionMarkers.filter((marker) => text.includes(marker)).length;
}

function fictionalNarrativeSignalCount(value) {
  const text = String(value || "");
  return fictionalNarrativePatterns.filter((pattern) => pattern.test(text)).length;
}

export function sourceContentForm(value) {
  const text = String(value || "");
  const markerCount = orderedOpinionMarkerCount(text);
  const opinionSignals = ["共同点", "解决办法", "所以", "先问自己", "行动", "结果", "成本"]
    .filter((signal) => text.includes(signal)).length;
  if (markerCount >= 2 && opinionSignals >= 1) return "opinion-list";
  if (fictionalNarrativeSignalCount(text) >= 2) return "narrative";
  return "general";
}

export function rewriteStructureIssue(value, sourceText) {
  if (sourceContentForm(sourceText) !== "opinion-list") return "";
  const sourceSignals = fictionalNarrativeSignalCount(sourceText);
  const rewriteSignals = fictionalNarrativeSignalCount(value);
  if (rewriteSignals >= 2 && rewriteSignals >= sourceSignals + 2) {
    return "原稿是观点/清单型口播，但改写凭空加入了人物、地名、对话或完整故事线；必须保留原稿的观点结构，不得改成民间故事";
  }
  return "";
}

export function rewriteStructureContract(sourceText) {
  if (sourceContentForm(sourceText) === "opinion-list") {
    return [
      "## 原稿内容形态（高优先级，覆盖赛道中的泛化叙事建议）",
      "- 原稿是观点/清单型口播，不是人物故事或民间故事。",
      "- 必须保留“总论 → 逐项论证 → 结论/行动建议”的结构和原有条目数量。",
      "- 可以口语化、压缩和补充不带身份的日常例子，但严禁虚构姓名、籍贯、朝代、村庄、和尚/师傅、婚姻、年表、人物对话或完整故事线。",
      "- 赛道规则要求的‘具体场景’只能服务于原观点，不能把题材改成故事。",
    ].join("\n");
  }
  return [
    "## 原稿内容形态（高优先级）",
    "- 保持原稿的题材、事实边界和基本结构；不得为了增强画面感而凭空新增姓名、籍贯、真实身份或完整虚构故事线。",
  ].join("\n");
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
  const structureIssue = rewriteStructureIssue(value, sourceText);
  if (structureIssue) return structureIssue;
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
