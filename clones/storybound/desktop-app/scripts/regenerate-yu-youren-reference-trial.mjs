const baseUrl = "http://127.0.0.1:5173";
const [taskId] = process.argv.slice(2);
const trialShots = [6, 7, 28, 40, 42];

if (!taskId) {
  throw new Error("Usage: node scripts/regenerate-yu-youren-reference-trial.mjs <task-id>");
}

async function requestJson(path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    ...options,
  });
  if (!response.ok) throw new Error(`${path} failed (${response.status}): ${await response.text()}`);
  return response.json();
}

let task = (await requestJson(`/api/tasks/${encodeURIComponent(taskId)}`)).task;
const prompts = (task.artifacts?.prompts?.prompts || []).filter((prompt) => (
  trialShots.includes(Number(prompt.shotId))
));

if (prompts.length !== trialShots.length) {
  throw new Error("The expected five Yu Youren reference shots are not all present.");
}

const result = await requestJson("/api/images/minimax/generate", {
  method: "POST",
  body: JSON.stringify({
    taskId: task.id,
    prompts,
    apiKey: "",
    aspectRatio: task.aspectRatio,
    maxImages: prompts.length,
    track: task.track,
    visualStyle: task.visualStyle,
    provider: "minimax",
    force: true,
  }),
});

const generated = result.images
  .filter((image) => image?.path && image.status === "ready")
  .map((image) => ({ ...image, status: "ready", historicalPortrait: false }));

if (generated.length !== trialShots.length) {
  const failed = result.images
    .filter((image) => !image?.path || image.status !== "ready")
    .map((image) => image.shotId)
    .join(", ");
  throw new Error(`MiniMax did not return all five trial images. Failed: ${failed || "unknown"}`);
}

const replacedIds = new Set(generated.map((image) => Number(image.shotId)));
const images = [
  ...(task.media.images || []).filter((image) => !replacedIds.has(Number(image.shotId))),
  ...generated,
].sort((left, right) => Number(left.shotId) - Number(right.shotId));

const stepStatuses = [...task.stepStatuses];
stepStatuses[6] = "pending";
task = (await requestJson(`/api/tasks/${encodeURIComponent(task.id)}`, {
  method: "PATCH",
  body: JSON.stringify({
    media: { ...task.media, images },
    options: {
      ...task.options,
      historicalPortraitMode: false,
      historicalPortraitNotice: "",
    },
    draft: null,
    stepStatuses,
  }),
})).task;

process.stdout.write(`MiniMax reference trial ready: ${generated.map((image) => image.shotId).join(", ")}\n`);
