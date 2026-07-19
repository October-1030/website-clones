const baseUrl = process.env.STORYBOUND_URL || "http://127.0.0.1:5173";
const taskId = process.argv[2] || "6e8bcd4d-86d7-4244-9ac6-ff9124b1fd1d";
const referenceTaskId = process.argv[3] || "de33bf73-94a8-4520-8535-eb8c1bdd8218";

async function requestJson(path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
  });
  if (!response.ok) throw new Error(`${path} failed (${response.status}): ${await response.text()}`);
  return response.json();
}

const character = "固定唯一主角：28岁中国女性，椭圆脸，黑色中长发低束，细长眉眼，深色高领针织衫；九个镜头必须保持同一张脸、同一发型、同一服装、同一年龄";
const style = "1980年代柯达电影胶片质感，竖屏9:16，写实电影剧照，暗调暖黄色钨丝灯与冷蓝月光对比，克制的悬疑与怀念情绪，真实皮肤纹理，浅景深，细腻颗粒，不生成任何文字";
const scenes = [
  "外婆去世后的旧卧室，主角坐在床边拉开木质床头柜抽屉，双手拿起一只打开的黄铜旧怀表，怀表清晰成为视觉中心，中景，暖黄台灯照亮手与表",
  "主角手指托住打开的黄铜旧怀表，表盘与指针占画面主体，指针停在两点十七分；主角同一张脸在背景中轻微虚化，近距离特写，家人只当表坏了的压抑氛围",
  "深夜的木质抽屉内部特写，唯一物件是一只打开的黄铜旧怀表，主角同一双手悬在抽屉边缘迟疑不敢触碰，表针仿佛被无形力量按住，冷蓝月光",
  "主角独自坐在深夜卧室的床沿，侧耳望向半开的床头柜抽屉，抽屉里的旧怀表在暗处微微反光，空间占画面大半，安静到仿佛能听见滴答声，全景",
  "主角终于把打开的黄铜旧怀表贴近右耳，神情紧张又专注，眼角微湿，怀表、耳朵与手指都清楚可见，床头柜在背景虚化，近景特写",
  "同一主角继续把怀表贴在耳边，听见外婆年轻时温柔沙哑的留言后神情由惊惧转为震动和思念，暖黄光落在半边脸上，黄铜怀表清晰，中近景",
  "打开的黄铜旧怀表超近景，表针仍停在两点十七分，玻璃表盖映出同一主角含泪的眼睛，时间停止但情绪开始流动，电影微距镜头",
  "黎明微光进入旧卧室，同一主角坐在窗边双手轻捧怀表，低头理解时间的新意义，怀表、旧木家具和晨光形成前中后景，安静释然的中景",
  "故事结尾，同一主角把黄铜旧怀表握在胸前，站在外婆卧室门口回望最后一眼，清晨暖光照进室内，脸部侧面仍可辨认，怀念而非恐怖，留有余韵的全景",
];
const negativePrompt = "水印，品牌标志，文字，字幕，标题，数字乱码，现代手机，手表，扇子，信件，照片堆，戒指，多余道具，多余人物，欧美人脸，人物换脸，年龄变化，发型变化，服装变化，畸形手指，多手，多怀表，表盘融化，低清晰度，过度磨皮，3D渲染，动漫，赛博朋克，过饱和";
const prompts = scenes.map((scene, index) => ({
  shotId: index + 1,
  prompt: `${character}。本镜画面：${scene}。${style}。画面中避免出现：${negativePrompt}`,
  negativePrompt,
}));

let task = (await requestJson(`/api/tasks/${encodeURIComponent(taskId)}`)).task;
const referenceTask = (await requestJson(`/api/tasks/${encodeURIComponent(referenceTaskId)}`)).task;
const reference = referenceTask.media?.images?.find((image) => image.shotId === 1 && image.path);
if (!reference) throw new Error("没有找到用于人物一致性的参考图");

task = (await requestJson(`/api/tasks/${encodeURIComponent(taskId)}`, {
  method: "PATCH",
  body: JSON.stringify({
    options: {
      ...task.options,
      referenceImage: {
        fileName: "pocket-watch-character-reference.jpg",
        path: reference.path,
        url: reference.url,
        bytes: reference.bytes,
      },
    },
    artifacts: {
      ...task.artifacts,
      prompts: {
        templateVersion: "Storybound 1.13.1 + QC semantic/reference hardening",
        trackId: task.artifacts?.prompts?.trackId || "character-story",
        styleId: task.artifacts?.prompts?.styleId || "retro-film",
        prompts,
      },
    },
  }),
})).task;

const generated = await requestJson("/api/images/minimax/generate", {
  method: "POST",
  body: JSON.stringify({
    taskId,
    prompts,
    apiKey: "",
    aspectRatio: "9:16",
    maxImages: prompts.length,
    track: task.track,
    visualStyle: task.visualStyle,
  }),
});
const failures = generated.images.filter((image) => image.status !== "ready" || !image.path);
if (failures.length) throw new Error(`第二轮生图有 ${failures.length} 张失败：${failures.map((item) => `#${item.shotId} ${item.error || "unknown"}`).join("；")}`);

task = (await requestJson(`/api/tasks/${encodeURIComponent(taskId)}`, {
  method: "PATCH",
  body: JSON.stringify({ media: { ...task.media, images: generated.images } }),
})).task;

process.stdout.write(`${JSON.stringify({ taskId: task.id, prompts: prompts.length, images: generated.images.map((image) => ({ shotId: image.shotId, path: image.path, bytes: image.bytes, retryLevel: image.retryLevel })) })}\n`);
