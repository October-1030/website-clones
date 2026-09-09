import { test } from "node:test";
import assert from "node:assert/strict";
import { defaultOpening, validateOpening, buildOpeningPrompt, buildToolPrompt, buildWritingSystemPrompt, countWritingUnits, formatWritingLength } from "../src/lib/golden-opening.ts";
import { readSseData } from "../src/lib/chat-stream.ts";

test("prompt preserves custom requirements and associated context", () => {
  const input = validateOpening({ ...defaultOpening, theme: " 城市悬疑 ", useCustom: true, customPrompt: "使用第一人称", context: "主角是一名钟表匠", words: 3000 });
  const prompt = buildOpeningPrompt(input);
  assert.match(prompt, /城市悬疑/);
  assert.match(prompt, /使用第一人称/);
  assert.match(prompt, /主角是一名钟表匠/);
  assert.match(prompt, /3000 字/);
  assert.equal(input.theme, "城市悬疑");
});

test("invalid form data is rejected before a paid request", () => {
  for (const patch of [{ theme: " " }, { theme: "x".repeat(501) }, { words: -1 }, { words: "2000" }, { preset: "missing" }, { context: {} }, { useCustom: true, customPrompt: " " }, { language: "invalid" }]) {
    assert.throws(() => validateOpening({ ...defaultOpening, theme: "悬疑", ...patch }));
  }
});

test("English novel presets use English prose instructions and word counts", () => {
  for (const preset of ["first", "three", "suspense", "romance"]) {
    const input = validateOpening({ ...defaultOpening, theme: "悬疑小说", context: "主角是一名邮递员", language: "en", preset, words: 1000 });
    const prompt = buildOpeningPrompt(input);
    assert.match(prompt, /1000 English words/);
    assert.match(prompt, /English chapter titles and novel prose/);
    assert.match(prompt, /主角是一名邮递员/);
    assert.doesNotMatch(prompt, /创作中文小说|1000 字/);
  }
});

test("English custom tools retain their requirements while the system selects English", () => {
  const input = validateOpening({ ...defaultOpening, theme: "润色", language: "en", useCustom: true, customPrompt: "保持情节不变，润色对话。" });
  assert.match(buildToolPrompt(input), /保持情节不变/);
  assert.match(buildToolPrompt(input), /Output language: English/);
  assert.match(buildOpeningPrompt(input), /保持情节不变/);
  for (const task of ["opening", "tool"]) assert.match(buildWritingSystemPrompt(task, input.language), /natural English, even when/);
});

test("legacy drafts default to Chinese and English lengths count words", () => {
  const legacy = { ...defaultOpening, theme: "悬疑" };
  delete legacy.language;
  assert.equal(validateOpening(legacy).language, "zh");
  assert.equal(countWritingUnits("Don't stop—it's a moon-lit night.", "en"), 6);
  assert.equal(countWritingUnits("第一章\n 月光", "zh"), 5);
  assert.equal(countWritingUnits("", "en"), 0);
  assert.equal(formatWritingLength(1000, "en"), "1000 words");
});

test("tool prompts preserve long source material without forcing novel output", () => {
  const source = "章节审稿素材。".repeat(1000);
  const input = validateOpening({ ...defaultOpening, theme: "审稿", useCustom: true, customPrompt: `请输出问题清单。\n${source}`, context: "角色规则" });
  const prompt = buildToolPrompt(input);
  assert.ok(prompt.includes(source));
  assert.match(prompt, /问题清单/);
  assert.match(prompt, /角色规则/);
  assert.doesNotMatch(prompt, /只输出章节标题与小说正文/);
});

test("SSE parser handles one-byte chunks including Chinese UTF-8 and CRLF boundaries", async () => {
  const text = ': keepalive\r\n\r\ndata: {"text":"第一章：月光"}\r\n\r\ndata: [DONE]\n\n';
  const bytes = new TextEncoder().encode(text);
  let index = 0;
  const body = new ReadableStream({ pull(controller) { if (index === bytes.length) controller.close(); else controller.enqueue(bytes.slice(index, ++index)); } });
  const events = [];
  for await (const data of readSseData(body)) events.push(data);
  assert.deepEqual(events, ['{"text":"第一章：月光"}', "[DONE]"]);
});

test("SSE parser cancels the upstream when consumer stops", async () => {
  let cancelled = false;
  const body = new ReadableStream({ start(controller) { controller.enqueue(new TextEncoder().encode("data: first\n\ndata: second\n\n")); }, cancel() { cancelled = true; } });
  for await (const data of readSseData(body)) { assert.equal(data, "first"); break; }
  assert.equal(cancelled, true);
});

test("stopping does not wait for a second browser stream reader", async () => {
  const [body, observer] = new ReadableStream({ start(controller) { controller.enqueue(new TextEncoder().encode("data: first\n\n")); } }).tee();
  let timer;
  try {
    await Promise.race([
      (async () => { for await (const data of readSseData(body)) { assert.equal(data, "first"); break; } })(),
      new Promise((_, reject) => { timer = setTimeout(() => reject(new Error("Cancellation blocked on observer")), 1000); }),
    ]);
  } finally { clearTimeout(timer); await observer.cancel(); }
});
