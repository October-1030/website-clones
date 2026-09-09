import test from "node:test";
import assert from "node:assert/strict";
import { applyEditorRecovery, createEditorRecoveryDraft, parseEditorRecoveryDraft } from "../src/lib/editor-recovery.ts";

const chapter = { id: "c1", title: "第一章", content: "旧正文", summary: "旧概要", updatedAt: "2026-09-08T10:00:00.000Z" };

test("recovers a newer unsaved chapter draft", () => {
  const draft = createEditorRecoveryDraft("b1", { ...chapter, content: "尚未落盘的新正文" }, "2026-09-08T10:01:00.000Z");
  const parsed = parseEditorRecoveryDraft(JSON.stringify(draft));
  const result = applyEditorRecovery([chapter], parsed, "b1", "2026-09-08T10:00:30.000Z");
  assert.equal(result.recovered, true);
  assert.equal(result.chapters[0].content, "尚未落盘的新正文");
});

test("ignores invalid, stale, or unrelated recovery drafts", () => {
  assert.equal(parseEditorRecoveryDraft("not json"), null);
  const stale = createEditorRecoveryDraft("b1", { ...chapter, content: "旧草稿" }, "2026-09-08T09:00:00.000Z");
  assert.equal(applyEditorRecovery([chapter], stale, "b1", "2026-09-08T10:00:00.000Z").recovered, false);
  assert.equal(applyEditorRecovery([chapter], { ...stale, bookId: "b2", savedAt: "2026-09-08T11:00:00.000Z" }, "b1", "2026-09-08T10:00:00.000Z").recovered, false);
});
