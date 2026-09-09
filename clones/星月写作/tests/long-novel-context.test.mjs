import test from "node:test";
import assert from "node:assert/strict";
import { buildLongNovelContext } from "../src/lib/long-novel-context.ts";

const book = {
  id: "book-1", title: "长夜", description: "一座每天日落后封闭城门的城市。", kind: "novel", status: "active", content: "", updatedAt: "now",
  chapters: [
    { id: "c1", title: "第一章", content: "A".repeat(1200), summary: "林舟得到银色钥匙。", updatedAt: "now" },
    { id: "c2", title: "第二章", content: "B".repeat(1200), summary: "钥匙在烛火下发光。", updatedAt: "now" },
    { id: "c3", title: "第三章", content: "C".repeat(1200), summary: "城门守卫认出了符文。", updatedAt: "now" },
    { id: "c4", title: "第四章", content: "D".repeat(1200), summary: "林舟决定夜探城门。", updatedAt: "now" },
  ],
};

test("builds structured context with settings, characters, summaries, and recent endings", () => {
  const result = buildLongNovelContext(book, [{ name: "林舟", personality: "沉静", bookId: "book-1" }], [{ title: "城门规则", content: "日落关闭" }], 6000);
  assert.match(result.text, /【作品设定】/);
  assert.match(result.text, /【人物与资料】/);
  assert.match(result.text, /【已写章节概要】/);
  assert.match(result.text, /第二章[\s\S]*第三章[\s\S]*第四章/);
  assert.doesNotMatch(result.text, /第一章\nA{20}/);
});

test("keeps the explicit size limit and tells the writer when compression happened", () => {
  const result = buildLongNovelContext({ ...book, description: "设".repeat(5000) }, [], [], 1000);
  assert.equal(result.text.length, 1000);
  assert.equal(result.compressed, true);
  assert.match(result.text, /资料超过上限/);
  assert.match(result.text, /第四章[\s\S]*D{20}/);
});
