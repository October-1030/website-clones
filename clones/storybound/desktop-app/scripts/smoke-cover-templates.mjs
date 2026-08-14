import assert from "node:assert/strict";
import { copyFile, mkdtemp, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { renderTitledCover } from "../server/cover-compositor.mjs";

const templateIds = [
  "cinematic-poster",
  "minimal-clean",
  "portrait-emotion",
  "typographic-impact",
  "guofeng-poster",
  "legend-portrait",
];
const onePixelPng = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64",
);
const directory = await mkdtemp(join(tmpdir(), "storybound-cover-templates-"));

try {
  const sourcePath = join(directory, "source.png");
  await writeFile(sourcePath, onePixelPng);
  for (const templateId of templateIds) {
    const destinationPath = join(directory, `${templateId}.png`);
    await copyFile(sourcePath, destinationPath);
    const rendered = await renderTitledCover({
      sourcePath: destinationPath,
      destinationPath,
      title: "人物故事",
      subtitles: ["第一行副标题", "第二行副标题"],
      width: 360,
      height: 480,
      templateId,
    });
    assert.equal(rendered?.textRenderer, `original-template:${templateId}`);
    assert.ok((await stat(destinationPath)).size > onePixelPng.length, `${templateId} 没有生成排字封面`);
  }
  console.log(`PASS ${templateIds.length} 套封面模板均可本地精确排字`);
} finally {
  await rm(directory, { recursive: true, force: true });
}
