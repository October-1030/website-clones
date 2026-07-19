const baseUrl = process.env.STORYBOUND_URL || "http://127.0.0.1:5173";
const taskId = process.argv[2] || "6e8bcd4d-86d7-4244-9ac6-ff9124b1fd1d";

async function requestJson(path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
  });
  if (!response.ok) throw new Error(`${path} failed (${response.status}): ${await response.text()}`);
  return response.json();
}

let task = (await requestJson(`/api/tasks/${encodeURIComponent(taskId)}`)).task;
const prompt = {
  shotId: 9001,
  prompt: "固定唯一主角：28岁中国女性，椭圆脸，黑色中长发低束，细长眉眼，深色高领针织衫，与参考图保持同一张脸。她在暗调旧卧室中双手捧着打开的黄铜旧怀表，怀表和眼神共同成为视觉中心，暖黄色台灯与冷蓝月光形成电影级对比，1980年代柯达胶片颗粒，写实竖屏电影海报底图，中部构图简洁且略暗，为标题排版留出清晰区域；不得生成任何文字、数字、水印、标志、扇子、信件、多余人物、畸形手指或多只怀表",
  negativePrompt: "文字，数字，水印，标志，扇子，信件，多余人物，人物换脸，发型变化，服装变化，畸形手指，多只怀表，现代手机，低清晰度，3D渲染，动漫",
};
const generated = await requestJson("/api/images/minimax/generate", {
  method: "POST",
  body: JSON.stringify({
    taskId,
    prompts: [prompt],
    apiKey: "",
    aspectRatio: "3:4",
    maxImages: 1,
    track: task.track,
    visualStyle: task.visualStyle,
    coverBackgroundOnly: true,
  }),
});
const cover = generated.images[0];
if (!cover || cover.status !== "ready" || !cover.path) throw new Error(cover?.error || "封面生成失败");
task = (await requestJson(`/api/tasks/${encodeURIComponent(taskId)}`, {
  method: "PATCH",
  body: JSON.stringify({ media: { ...task.media, coverImages: [cover] } }),
})).task;
process.stdout.write(`${JSON.stringify({ taskId: task.id, cover: { path: cover.path, bytes: cover.bytes, textComposited: cover.textComposited, retryLevel: cover.retryLevel } })}\n`);
