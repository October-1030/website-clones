import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  buildPictureBookReferencePlan,
  compactPictureBookProviderPrompt,
  isPictureBookTrack,
  pictureBookComposition,
} from "../server/picture-book-policy.mjs";

const root = fileURLToPath(new URL("..", import.meta.url));
const library = JSON.parse(await readFile(join(root, "original-prompt-library.json"), "utf8"));
const track = library.tracks.find((item) => item.id === "picture-book");

assert.ok(isPictureBookTrack(track));
assert.equal(track.name, "绘本故事");
assert.equal(track.defaultStyleId, "pixar-3d");
assert.equal(track.needsCharacterCard, true);
assert.match(track.rewritePrompt, /儿童（3-10 岁）/u);
assert.match(track.metadataPrompt, /#绘本故事/u);
assert.match(track.metadataPrompt, /#亲子阅读/u);
assert.match(track.imagePrompt, /严禁写实儿童影像/u);

const shots = [
  { id: 1, text: "白色小兔子豆豆跳过小河", visual: "小兔子穿蓝色围裙在河边跳跃" },
  { id: 2, text: "月光落在安静的森林里", visual: "纯环境空镜，星星和萤火虫" },
  { id: 3, text: "豆豆轻轻推开蘑菇屋的门", visual: "豆豆推门，神情好奇" },
];
const prompts = [
  { shotId: 1, prompt: "一只白色小兔子穿蓝色围裙跳过小河", useReference: true },
  { shotId: 2, prompt: "深蓝夜空下的森林与萤火虫", useReference: false },
  { shotId: 3, prompt: "豆豆推开粉色蘑菇屋的花朵门" },
];
const plan = buildPictureBookReferencePlan(shots, prompts);
assert.equal(plan.get(1), true);
assert.equal(plan.get(2), false);
assert.equal(plan.get(3), true);

const task = { artifacts: { storyboard: { shots } } };
const plainPrompt = compactPictureBookProviderPrompt({
  item: prompts[0],
  shotId: 1,
  task,
  aspectRatio: "9:16",
  useReference: false,
});
assert.match(plainPrompt, /白色小兔子/u);
assert.doesNotMatch(plainPrompt, /Republican-era|1964年台北|民国旧街|档案摄影/u);

const referencedPrompt = compactPictureBookProviderPrompt({
  item: prompts[0],
  shotId: 1,
  task,
  aspectRatio: "9:16",
  useReference: true,
});
assert.match(referencedPrompt, /种类、颜色、体型、服饰和标志性特征/u);
assert.match(referencedPrompt, /参考图只约束角色身份，不复制参考图背景/u);
assert.doesNotMatch(referencedPrompt, /历史人物|Republican-era/u);

const coverPrompt = "儿童绘本封面底图，主角开心挥手，中央预留标题区";
assert.equal(compactPictureBookProviderPrompt({
  item: { prompt: coverPrompt },
  shotId: 9001,
  task,
  aspectRatio: "3:4",
  useReference: true,
}), coverPrompt);

assert.match(pictureBookComposition(0, true), /固定角色/u);
assert.match(pictureBookComposition(2, true), /不做写实儿童肖像/u);
assert.match(pictureBookComposition(1, false), /禁止改成历史纪实场景/u);

console.log("绘本故事赛道 smoke 通过：入口、原版提示词、角色参考、空镜与 MiniMax 路由均已隔离。");
