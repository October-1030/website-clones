import assert from "node:assert/strict";

import { metadataIssue, rewriteNarrationIssue, taskRewriteIntegrityIssue, writerPayloadIssue } from "../server/pipeline-integrity.mjs";

const source = "这是一段用于验证完整改写流程的原始文案。".repeat(20);
const validNarration = "真正的改变从来不是一句口号，而是愿意把想法落到每天的行动里。".repeat(8);
const validMetadata = {
  title: "开始行动",
  subtitle: ["别让想法停在原地", "完成今天最小的一步"],
  summary: "很多时候困住我们的不是能力，而是迟迟没有开始。把目标拆成今天能完成的一步，结果才会慢慢出现。",
  tags: ["#成长", "#行动", "#人生感悟"],
  comments: ["第一条", "第二条", "第三条", "第四条", "第五条"],
};
const validScores = { hook: 18, fluency: 18, empathy: 17, visual: 14, originality: 14, spoken: 9 };

assert.match(rewriteNarrationIssue("完整改写正文", source), /占位内容/u);
assert.match(rewriteNarrationIssue("太短", source), /最低完整性要求/u);
assert.equal(rewriteNarrationIssue(validNarration, source), "");
assert.match(writerPayloadIssue({ narration: validNarration }, source), /六维自评/u);
assert.equal(writerPayloadIssue({ narration: validNarration, scores: validScores, totalScore: 90 }, source), "");
assert.match(metadataIssue({ ...validMetadata, comments: ["只有一条"] }), /5 条种子评论/u);
assert.equal(metadataIssue(validMetadata), "");

const task = {
  mode: "auto",
  track: "心灵鸡汤",
  inputText: source,
  options: { promptTemplateId: "system-心灵鸡汤" },
  artifacts: {
    precheck: { cleanText: source },
    rewrite: { ...validMetadata, narration: validNarration, publishCopy: validMetadata.summary, pinnedComment: validMetadata.comments[0], scores: validScores, totalScore: 90 },
  },
};
assert.equal(taskRewriteIntegrityIssue(task), "");
assert.match(taskRewriteIntegrityIssue({ ...task, options: { promptTemplateId: "system-民间故事" } }), /不一致/u);
assert.match(taskRewriteIntegrityIssue({ ...task, artifacts: { ...task.artifacts, rewrite: { ...task.artifacts.rewrite, narration: "完整改写正文" } } }), /占位内容/u);

process.stdout.write("pipeline integrity smoke passed\n");
