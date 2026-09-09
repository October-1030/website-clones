import test from "node:test";
import assert from "node:assert/strict";
import { buildContinuityAuditSource } from "../src/lib/continuity-audit.ts";

test("continuity audit includes evidence rules, all summaries, and recent prose", () => {
  const chapters = [1, 2, 3, 4].map((number) => ({ id: `c${number}`, title: `第${number}章`, content: `${number}`.repeat(1200), summary: `第${number}章概要`, updatedAt: "now" }));
  const book = { id: "b", title: "长夜", description: "城门日落关闭。", kind: "novel", status: "active", content: "", updatedAt: "now", chapters };
  const text = buildContinuityAuditSource(book, chapters, 6000);
  assert.match(text, /证据不足时写“待确认”/);
  assert.match(text, /第1章概要/);
  assert.match(text, /【最近正文结尾】/);
  assert.ok(text.length <= 6000);
});
