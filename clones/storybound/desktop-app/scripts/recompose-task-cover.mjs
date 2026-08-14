import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { renderTitledCover } from "../server/cover-compositor.mjs";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const taskId = String(process.argv[2] || "").trim();
const explicitSource = String(process.argv[3] || "").trim();
if (!taskId) throw new Error("用法：node scripts/recompose-task-cover.mjs <task-id> [clean-source-path]");

const taskPath = resolve(root, ".storybound-data", "tasks", taskId, "task.json");
const task = JSON.parse(await readFile(taskPath, "utf8"));
const cover = task.media?.coverImages?.[0];
if (!cover?.path) throw new Error("任务没有可写入的封面文件");

const sourcePath = explicitSource || cover.sourceBackupPath;
if (!sourcePath) throw new Error("没有干净封面底图；请提供 clean-source-path，避免在旧乱码图上叠字");

const title = String(task.artifacts?.rewrite?.title || task.title || "").trim();
const subtitles = Array.isArray(task.artifacts?.rewrite?.subtitle)
  ? task.artifacts.rewrite.subtitle.map((line) => String(line || "").trim()).filter(Boolean).slice(0, 2)
  : [];
if (!title || subtitles.length === 0) throw new Error("任务缺少封面主标题或副标题");

const ratio = String(task.options?.coverRatio || "3:4");
const sizes = {
  "3:4": { width: 1080, height: 1440 },
  "9:16": { width: 1080, height: 1920 },
  "4:3": { width: 1440, height: 1080 },
  "16:9": { width: 1920, height: 1080 },
  "1:1": { width: 1080, height: 1080 },
};
const size = sizes[ratio] || sizes["3:4"];
const rendered = await renderTitledCover({
  sourcePath,
  destinationPath: cover.path,
  title,
  subtitles,
  width: size.width,
  height: size.height,
  templateId: String(task.options?.coverTemplateId || "cinematic-poster"),
});
if (!rendered) throw new Error("封面排字器没有返回结果");

cover.bytes = rendered.bytes;
cover.width = rendered.width;
cover.height = rendered.height;
cover.sourceBackupPath = sourcePath;
cover.textComposited = true;
cover.textRenderer = rendered.textRenderer;
cover.url = `/api/tasks/${encodeURIComponent(taskId)}/files/images/9001.jpg?v=${Date.now()}`;
cover.status = "ready";
task.updatedAt = new Date().toISOString();
await writeFile(taskPath, `${JSON.stringify(task, null, 2)}\n`, "utf8");
process.stdout.write(JSON.stringify({ taskId, title, subtitles, output: cover.path, ...size }, null, 2));
