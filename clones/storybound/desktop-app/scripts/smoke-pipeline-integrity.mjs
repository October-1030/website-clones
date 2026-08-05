import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { metadataIssue, rewriteNarrationIssue, rewriteStructureContract, rewriteStructureIssue, sourceContentForm, taskRewriteIntegrityIssue, writerPayloadIssue } from "../server/pipeline-integrity.mjs";
import { createTaskStore } from "../server/task-store.mjs";

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

const opinionSource = `真正困住一个人的，往往不是没有机会，而是四种听起来很正确的自我安慰。
它们有一个共同点：想要长期结果，却不愿意支付短期成本。
第一，只看碎片信息。第二，还没有独立能力。第三，要求关系解决所有问题。第四，研究成功方法却迟迟不开始。
所以，先问自己愿不愿意行动。`;
const opinionRewrite = `困住人的，常常不是机会太少，而是四种看似正确的安慰。
第一，拿碎片信息当完整认知。第二，没有独立能力却埋怨不自由。第三，把关系当作解决生活的工具。第四，研究了很多方法却一直不开始。
说到底，长期结果都要用短期行动来换。`;
const inventedStory = `有个人，活了快三十年。他叫李勤，是济南府人。这一天他上山找到老和尚，跪在佛前问师傅怎么办。三年后，他娶了邻村姑娘，又盖起了新房。`;
assert.equal(sourceContentForm(opinionSource), "opinion-list");
assert.equal(rewriteStructureIssue(opinionRewrite, opinionSource), "");
assert.match(rewriteStructureIssue(inventedStory, opinionSource), /改成民间故事/u);
assert.match(rewriteStructureContract(opinionSource), /观点\/清单型口播/u);
assert.match(writerPayloadIssue({ narration: inventedStory.repeat(4), scores: validScores, totalScore: 90 }, opinionSource), /改成民间故事/u);

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

const temporaryRoot = await mkdtemp(join(tmpdir(), "storybound-clear-from-step-"));
try {
  const store = createTaskStore(temporaryRoot);
  const clearTaskId = "clear-from-step-smoke";
  await store.createTask({
    id: clearTaskId,
    title: "下游清理测试",
    inputText: opinionSource,
    mode: "auto",
    track: "心灵鸡汤",
    status: "completed",
    runState: "completed",
    currentStep: 6,
    stepStatuses: Array(7).fill("done"),
    completedAt: new Date().toISOString(),
    artifacts: {
      precheck: { cleanText: opinionSource },
      rewrite: { narration: opinionRewrite },
      storyboard: { shots: [{ id: 1, text: opinionRewrite }] },
      prompts: { prompts: [{ shotId: 1, prompt: "测试" }] },
    },
    media: { images: [{ shotId: 1 }], audioSegments: [{ shotId: 1 }] },
    draft: { ready: true },
  });
  const cleared = await store.clearFromStep(clearTaskId, 1);
  assert.ok(cleared.artifacts.precheck);
  assert.equal(cleared.artifacts.rewrite, undefined);
  assert.equal(cleared.artifacts.storyboard, undefined);
  assert.equal(cleared.artifacts.prompts, undefined);
  assert.deepEqual(cleared.media.images, []);
  assert.deepEqual(cleared.media.audioSegments, []);
  assert.equal(cleared.draft, null);
  assert.equal(cleared.completedAt, null);
  const reread = await store.readTask(clearTaskId);
  assert.equal(reread.artifacts.storyboard, undefined);
  assert.equal(reread.artifacts.prompts, undefined);
} finally {
  await rm(temporaryRoot, { recursive: true, force: true });
}

process.stdout.write("pipeline integrity smoke passed\n");
