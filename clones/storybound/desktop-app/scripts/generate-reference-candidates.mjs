import { copyFile } from "node:fs/promises";

const baseUrl = "http://127.0.0.1:5173";
const [taskId, shotIdArgument, countArgument] = process.argv.slice(2);
const shotId = Number(shotIdArgument);
const count = Math.max(2, Math.min(4, Number(countArgument) || 4));

if (!taskId || !Number.isFinite(shotId)) {
  throw new Error("Usage: node scripts/generate-reference-candidates.mjs <task-id> <shot-id> [2-4]");
}

async function requestJson(path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    ...options,
  });
  if (!response.ok) throw new Error(`${path} failed (${response.status}): ${await response.text()}`);
  return response.json();
}

const task = (await requestJson(`/api/tasks/${encodeURIComponent(taskId)}`)).task;
const prompt = (task.artifacts?.prompts?.prompts || []).find((item) => Number(item.shotId) === shotId);
if (!prompt?.useReference) throw new Error(`Shot ${shotId} is not configured as an identity-reference shot.`);

for (let index = 1; index <= count; index += 1) {
  const result = await requestJson("/api/images/minimax/generate", {
    method: "POST",
    body: JSON.stringify({
      taskId,
      prompts: [prompt],
      apiKey: "",
      aspectRatio: task.aspectRatio,
      maxImages: 1,
      track: task.track,
      visualStyle: task.visualStyle,
      provider: "minimax",
      force: true,
    }),
  });
  const image = result.images?.[0];
  if (!image?.path || image.status !== "ready") {
    throw new Error(`Candidate ${index} failed for shot ${shotId}.`);
  }
  const target = image.path.replace(/\.jpg$/u, `-candidate-${index}.jpg`);
  await copyFile(image.path, target);
  process.stdout.write(`${target}\n`);
}
