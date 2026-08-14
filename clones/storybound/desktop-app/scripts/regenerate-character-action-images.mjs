const baseUrl = "http://127.0.0.1:5173";
const [taskId, batchSizeArgument, selectedIdsArgument] = process.argv.slice(2);
const batchSize = Math.max(1, Math.min(4, Number(batchSizeArgument) || 3));
const selectedIds = new Set(String(selectedIdsArgument || "").split(",").map((value) => Number(value.trim())).filter(Number.isFinite));

if (!taskId) throw new Error("Usage: node scripts/regenerate-character-action-images.mjs <task-id> [batch-size] [shot-id,shot-id]");

async function requestJson(path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    ...options,
  });
  if (!response.ok) throw new Error(`${path} failed (${response.status}): ${await response.text()}`);
  return response.json();
}

function isCharacterActionPrompt(prompt) {
  return prompt?.characterAction === true && prompt?.useReference !== true && prompt?.use_reference !== true;
}

async function main() {
  let task = (await requestJson(`/api/tasks/${encodeURIComponent(taskId)}`)).task;
  const prompts = (task.artifacts?.prompts?.prompts || []).filter((prompt) => isCharacterActionPrompt(prompt) && (!selectedIds.size || selectedIds.has(Number(prompt.shotId))));
  if (!prompts.length) throw new Error("任务没有待重画的中国人物行动镜头");
  for (let start = 0; start < prompts.length; start += batchSize) {
    const batch = prompts.slice(start, start + batchSize);
    const result = await requestJson("/api/images/minimax/generate", {
      method: "POST",
      body: JSON.stringify({
        taskId: task.id,
        prompts: batch,
        apiKey: "",
        aspectRatio: task.aspectRatio,
        maxImages: batch.length,
        track: task.track,
        visualStyle: task.visualStyle,
        provider: "minimax",
        force: true,
      }),
    });
    const generated = result.images.filter((image) => image?.path && image.status === "ready").map((image) => ({ ...image, status: "ready" }));
    if (generated.length !== batch.length) throw new Error(`镜头 ${batch.map((item) => item.shotId).join(", ")} 未全部生成成功`);
    const replacementIds = new Set(generated.map((image) => image.shotId));
    const images = [
      ...(task.media.images || []).filter((image) => !replacementIds.has(image.shotId)),
      ...generated,
    ].sort((left, right) => left.shotId - right.shotId);
    const stepStatuses = [...task.stepStatuses];
    stepStatuses[6] = "pending";
    task = (await requestJson(`/api/tasks/${encodeURIComponent(task.id)}`, {
      method: "PATCH",
      body: JSON.stringify({ media: { ...task.media, images }, draft: null, stepStatuses }),
    })).task;
    process.stdout.write(`重画中国人物行动镜头 ${start + 1}-${start + batch.length}/${prompts.length}: ${batch.map((item) => item.shotId).join(", ")}\n`);
  }
}

await main();
