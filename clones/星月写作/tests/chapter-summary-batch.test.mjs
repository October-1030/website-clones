import test from "node:test";
import assert from "node:assert/strict";
import { applyGeneratedChapterSummaries, buildChapterSummaryRequest } from "../src/lib/chapter-summary-batch.ts";

const chapters = [
  { id: "c1", title: "第一章", content: "林舟收到未来来信。", summary: "", updatedAt: "old" },
  { id: "c2", title: "第二章", content: "他在城门找到银色钥匙。", summary: "人工概要", updatedAt: "old" },
  { id: "c3", title: "第三章", content: "钥匙在烛火中发光。", summary: "", updatedAt: "old" },
];

test("summary request includes only non-empty chapters missing summaries", () => {
  const request = buildChapterSummaryRequest(chapters);
  assert.deepEqual(request.targets.map((target) => target.chapterId), ["c1", "c3"]);
  assert.match(request.prompt, /【S1 · 第一章】/);
  assert.match(request.prompt, /【S2 · 第三章】/);
  assert.doesNotMatch(request.prompt, /第二章/);
});

test("structured summary output maps to chapters and preserves manual summaries", () => {
  const request = buildChapterSummaryRequest(chapters);
  const result = applyGeneratedChapterSummaries(chapters, request.targets, "S1｜林舟收到一封来自未来的信。\nS2: 银色钥匙在烛火中显现异光。", "now");
  assert.equal(result.applied, 2);
  assert.equal(result.chapters[0].summary, "林舟收到一封来自未来的信。");
  assert.equal(result.chapters[1].summary, "人工概要");
  assert.equal(result.chapters[2].summary, "银色钥匙在烛火中显现异光。");
});

test("invalid model output is rejected without changing chapters", () => {
  const request = buildChapterSummaryRequest(chapters);
  assert.throws(() => applyGeneratedChapterSummaries(chapters, request.targets, "这里是普通段落"), /没有识别到/);
  assert.equal(chapters[0].summary, "");
});
