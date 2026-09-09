import { test } from "node:test";
import assert from "node:assert/strict";
import { appendWorkflowOutput } from "../src/lib/workflow-save.ts";

const now = "2026-09-05T12:00:00.000Z";
function fixture() {
  return {
    id: "book", title: "测试作品", description: "", kind: "novel", status: "active", updatedAt: "old",
    content: "第一章内容\n\n第二章内容",
    chapters: [
      { id: "first", title: "第一章", content: "第一章内容", summary: "摘要", bookmarked: true, updatedAt: "old" },
      { id: "last", title: "第二章", content: "第二章内容", summary: "", updatedAt: "old" },
    ],
  };
}

test("saving without chapter remains visible after reloading the chapter editor", () => {
  const original = fixture();
  const saved = appendWorkflowOutput(original, "新增段落", "", now);
  const reloaded = JSON.parse(JSON.stringify(saved));
  assert.equal(reloaded.chapters[1].content, "第二章内容\n\n新增段落");
  assert.equal(reloaded.content, "第一章内容\n\n第二章内容\n\n新增段落");
  assert.equal(reloaded.updatedAt, now);
  assert.deepEqual(original, fixture());
});

test("saving into an earlier chapter preserves whole-book reading and export order", () => {
  const saved = appendWorkflowOutput(fixture(), "第一章补充", "first", now);
  assert.equal(saved.content, "第一章内容\n\n第一章补充\n\n第二章内容");
  assert.equal(saved.chapters[0].summary, "摘要");
  assert.equal(saved.chapters[0].bookmarked, true);
  assert.equal(saved.chapters[0].updatedAt, now);
  assert.equal(saved.chapters[1].updatedAt, "old");
});

test("legacy books preserve prose when normalized into an editable first chapter", () => {
  for (const chapters of [undefined, []]) {
    const legacy = { ...fixture(), chapters, content: "旧正文" };
    const saved = appendWorkflowOutput(legacy, "新正文", "", now);
    assert.equal(saved.chapters.length, 1);
    assert.equal(saved.chapters[0].content, "旧正文\n\n新正文");
    assert.equal(saved.content, saved.chapters[0].content);
    assert.ok(saved.chapters[0].id);
  }
});

test("empty books get visible content without leading separators", () => {
  const saved = appendWorkflowOutput({ ...fixture(), chapters: [], content: "" }, "Opening", "", now);
  assert.equal(saved.content, "Opening");
  assert.equal(saved.chapters[0].content, "Opening");
});

test("a deleted selected chapter fails instead of silently writing to another chapter", () => {
  const original = fixture();
  assert.throws(() => appendWorkflowOutput(original, "结果", "deleted", now), /所选章节已不存在/);
  assert.deepEqual(original, fixture());
  assert.throws(() => appendWorkflowOutput(original, " \n", "first", now), /没有可保存/);
});
