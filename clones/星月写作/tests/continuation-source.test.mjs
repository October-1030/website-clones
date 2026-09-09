import test from "node:test";
import assert from "node:assert/strict";
import { buildContinuationSource } from "../src/lib/continuation-source.ts";

const chapters = Array.from({ length: 6 }, (_, index) => ({
  id: `c${index + 1}`,
  title: `第${index + 1}章`,
  content: index === 5 ? "" : String(index + 1).repeat(3000),
  summary: "",
  updatedAt: "now",
}));

test("continuing an empty chapter carries the three immediately preceding chapters", () => {
  const text = buildContinuationSource(chapters, "c6", 5000);
  assert.doesNotMatch(text, /【第2章】/);
  assert.match(text, /【第3章】[\s\S]*【第4章】[\s\S]*【第5章】[\s\S]*【第6章】/);
  assert.match(text, /本章尚未写正文/);
  assert.ok(text.length <= 5000);
});

test("continuation source keeps the ending of long chapters", () => {
  const custom = [{ ...chapters[0], content: `开头${"中".repeat(4000)}关键悬念` }];
  const text = buildContinuationSource(custom, "c1", 1200);
  assert.doesNotMatch(text, /开头/);
  assert.match(text, /关键悬念/);
});
