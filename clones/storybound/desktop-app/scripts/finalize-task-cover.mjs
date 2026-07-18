import { renderTitledCover } from "../server/cover-compositor.mjs";

const baseUrl = process.env.STORYBOUND_URL || "http://127.0.0.1:5173";
const taskId = process.argv[2];
if (!taskId) throw new Error("用法：node scripts/finalize-task-cover.mjs <task-id>");

async function jsonRequest(path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
  });
  if (!response.ok) throw new Error(await response.text());
  return response.json();
}

const task = (await jsonRequest(`/api/tasks/${encodeURIComponent(taskId)}`)).task;
const cover = task.media.coverImages?.[0];
if (!cover?.path) throw new Error("任务没有可用封面");
const sourcePath = cover.sourceBackupPath || cover.path;
const rendered = await renderTitledCover({
  sourcePath,
  destinationPath: cover.path,
  title: task.artifacts.rewrite?.title || task.title,
  subtitles: task.artifacts.rewrite?.subtitle || [],
});
const coverImages = [{ ...cover, ...rendered, textComposited: true }];
await jsonRequest(`/api/tasks/${encodeURIComponent(taskId)}`, {
  method: "PATCH",
  body: JSON.stringify({ media: { coverImages }, draft: null }),
});
await jsonRequest(`/api/tasks/${encodeURIComponent(taskId)}/draft`, { method: "POST", body: "{}" });
process.stdout.write(`${rendered.path}\n`);
