import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  compactTrackProviderPrompt,
  referenceDisciplineForTrack,
  referencePlanMode,
} from "../server/track-image-policy.mjs";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const library = JSON.parse(await readFile(resolve(root, "original-prompt-library.json"), "utf8"));
const tracks = new Map(library.tracks.map((track) => [track.id, track]));

assert.equal(referencePlanMode(tracks.get("character-story")), "biography-balanced");
assert.equal(referencePlanMode(tracks.get("picture-book")), "picture-book");
assert.equal(referencePlanMode(tracks.get("folk-tale")), "per-shot");
assert.equal(referencePlanMode(tracks.get("health-book")), "per-shot");
assert.equal(referencePlanMode(tracks.get("culture-knowledge")), "per-shot");
assert.equal(referencePlanMode(tracks.get("ecommerce")), "per-shot");
assert.equal(referencePlanMode(tracks.get("inspirational")), "none");
assert.equal(referencePlanMode(tracks.get("general")), "none");

const forbiddenBiographyLeak = /Republican-era|民国|于右任|银白头发与长须|Chinese historical figure/u;
for (const id of ["health-book", "culture-knowledge", "picture-book", "ecommerce", "inspirational", "folk-tale", "general"]) {
  const prompt = compactTrackProviderPrompt({
    item: { prompt: `TRACK=${id}；严格保留本赛道场景、主体与构图。` },
    shotId: 1,
    task: { options: {} },
    track: tracks.get(id),
    useReference: false,
  });
  assert.match(prompt, new RegExp(`TRACK=${id}`));
  assert.doesNotMatch(prompt, forbiddenBiographyLeak, `${id} 被人物传记提示污染`);
}

for (const id of ["health-book", "culture-knowledge", "ecommerce"]) {
  const prompt = compactTrackProviderPrompt({
    item: { prompt: "在真实使用场景中展示核心物件。" },
    shotId: 2,
    task: { options: { referenceGuidance: "保持参考物正面轮廓" } },
    track: tracks.get(id),
    useReference: true,
  });
  assert.match(prompt, /产品或器物/u);
  assert.match(prompt, /不是人物身份参考/u);
  assert.doesNotMatch(prompt, /脸型|五官|白胡须/u);
}

assert.match(referenceDisciplineForTrack(tracks.get("folk-tale")), /不设置传记片的固定空镜比例/u);
assert.match(referenceDisciplineForTrack(tracks.get("health-book")), /referenceKind=product/u);
assert.match(referenceDisciplineForTrack(tracks.get("picture-book")), /不得替换为真实儿童或历史人物/u);
assert.match(referenceDisciplineForTrack(tracks.get("character-story")), /人物故事应同时包含 true 和 false/u);

console.log("PASS 8 个赛道的参考计划与图片 provider 路由互不串线");
