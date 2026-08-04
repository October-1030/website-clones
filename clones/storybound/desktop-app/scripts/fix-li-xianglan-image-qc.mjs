import { readFile, unlink } from "node:fs/promises";
import { basename, extname } from "node:path";

const baseUrl = process.env.STORYBOUND_URL || "http://127.0.0.1:5173";
const taskId = process.argv[2] || "8fc390f6-c0a1-49de-82ff-8855311c7fd1";
const onlyShotIds = new Set(
  String(process.argv[3] || "")
    .split(",")
    .map((value) => Number(value.trim()))
    .filter(Number.isFinite),
);
const lateLifeReferencePath = new URL(
  "../docs/research/character-references/li-xianglan/yamaguchi-yoshiko-midlife-bunshun.jpg",
  import.meta.url,
);

async function requestJson(path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
  });
  if (!response.ok) throw new Error(`${path} failed (${response.status}): ${await response.text()}`);
  return response.json();
}

async function uploadReference(path) {
  const bytes = await readFile(path);
  const extension = extname(path.pathname).toLowerCase();
  const fileName = extension === ".png" ? "li-xianglan-late-life-reference.png" : "li-xianglan-late-life-reference.jpg";
  return (await requestJson(`/api/tasks/${encodeURIComponent(taskId)}/assets`, {
    method: "POST",
    body: JSON.stringify({
      kind: "uploads",
      fileName,
      base64: bytes.toString("base64"),
    }),
  })).asset;
}

const fixes = [
  {
    shotId: 2,
    promptEnglish: "Vertical 9:16 black-and-white historical documentary photograph, Shanghai in 1945. A 25-year-old East Asian Japanese-Chinese woman based strictly on the supplied young Li Xianglan reference walks through a wooden courthouse corridor while two uniformed guards escort her, one guard visible behind each shoulder. She is clearly young, with an oval East Asian face, black short wavy 1940s hair, and wears a fitted dark Chinese qipao. Medium full shot from head to below knees, all three people walking forward, tense restrained expression, period-correct architecture and clothing, realistic archival film grain. No desk, no seated pose, no portrait close-up, no papers, no readable text, no modern objects, no Caucasian facial traits, no middle-aged face.",
    prompt: "1945年战后上海法院长廊，25岁的李香兰穿深色合身旗袍，被两名只露肩背轮廓的看守陪同向前走。严格使用青年参考照的东亚日本女性骨相：椭圆脸、真实东亚眼型、黑色短卷发，年龄必须年轻，不能生成欧美人、混血感或中年脸。李香兰位于画面中央，神情克制紧张，人物半身到膝上，中景；1945年服装与木质法院环境，黑白历史纪实摄影，竖屏9:16，禁止文件特写、禁止文字、禁止现代建筑。",
  },
  {
    shotId: 7,
    prompt: "1945年上海战后法庭，25岁的李香兰坐在木桌另一侧，严格使用青年参考照的东亚日本女性骨相。前景仅见一只手把一张完全空白、背面朝向镜头的身份纸推过木桌，纸面不出现任何字母、汉字、数字、印章或符号；李香兰的脸清楚，紧张而克制。黑白历史纪实摄影，竖屏9:16，中景与手部前景结合，服装符合1945年，禁止欧美面孔，禁止纸面文字。",
  },
  {
    shotId: 9,
    prompt: "1945年上海，25岁的李香兰走出昏暗法庭门口，严格使用青年参考照的东亚日本女性骨相，逆光勾勒同一张脸。她只握着折叠后看不见纸面的文件边缘，画面中不得出现任何可读文字、字母、数字或印章。黑白历史纪实摄影，竖屏9:16，中景，服装符合1945年，禁止欧美面孔和现代建筑。",
  },
  {
    shotId: 28,
    prompt: "1940年代满洲电影制片厂的剪辑台，特写一双年轻女性的手压住胶片条和金属剪片器，旁边是老式电影胶片盘；只露出李香兰侧脸的一小部分，严格保持青年参考照的东亚日本女性骨相。道具表面完全无文字、无标签、无数字。黑白历史纪实摄影，竖屏9:16，环境与手部为主体，强调她身处宣传电影机器之中，禁止欧美面孔，禁止现代设备。",
  },
  {
    shotId: 29,
    prompt: "1940年代满洲电影制片厂的宽阔摄影棚全景，老式木质摄影机、弧光灯、轨道和布景占画面大部分；年轻李香兰穿符合1940年代的中式旗袍，作为小比例人物站在镜头前，严格使用青年参考照的东亚日本女性骨相。不要和服，不要韩服，不要现代服装。所有海报、场记板和道具均为空白无文字。黑白历史纪实摄影，竖屏9:16，远景，禁止欧美面孔。",
  },
  {
    shotId: 35,
    prompt: "1942年战时上海的旧舞厅和演唱会舞台全景，老式圆形麦克风、幕布、唱片机和观众剪影构成环境，年轻李香兰穿1940年代旗袍站在舞台中央，人物只占画面约三分之一，严格使用青年参考照的东亚日本女性骨相。窗外探照灯暗示战争阴影；招牌和背景完全无文字。黑白胶片纪实摄影，竖屏9:16，禁止大头肖像，禁止欧美面孔。",
  },
  {
    shotId: 41,
    prompt: "1942年前后的电影后台，22岁的李香兰独自坐在木椅边，半身侧面望向画外，神情是恐惧、依附和迟疑，严格使用青年参考照的东亚日本女性骨相，脸型、眼距、鼻形与嘴形保持一致，不能显老。环境可见胶片盒和阴影，但所有物件无文字。黑白历史纪实摄影，竖屏9:16，中景，禁止欧美面孔、禁止男性化面孔、禁止现代服装。",
  },
  {
    shotId: 56,
    lateLife: true,
    prompt: "2010年代的山口淑子，约90岁，严格使用上传的山口淑子本人晚年彩色照片作为唯一面部骨相和衰老参考：东亚日本老年女性、圆润面部、真实眼距和鼻口比例、短卷发并佩戴浅色眼镜。她安静坐在窗边，神情克制，不美化成欧美人。转为纯黑白纪实摄影，竖屏9:16，半身肖像，自然皱纹，禁止白人或欧美面孔，禁止年轻脸，禁止文字。",
  },
];

async function main() {
  let task = (await requestJson(`/api/tasks/${encodeURIComponent(taskId)}`)).task;
  const youthReference = task.options.referenceImage;
  if (!youthReference?.path) throw new Error("Task has no verified youth reference");
  const lateLifeReference = await uploadReference(lateLifeReferencePath);

  for (const fix of fixes.filter((item) => onlyShotIds.size === 0 || onlyShotIds.has(item.shotId))) {
    const referenceImage = fix.lateLife ? lateLifeReference : youthReference;
    task = (await requestJson(`/api/tasks/${encodeURIComponent(taskId)}`, {
      method: "PATCH",
      body: JSON.stringify({ options: { ...task.options, referenceImage } }),
    })).task;

    const existing = task.media.images.find((image) => Number(image.shotId) === fix.shotId);
    if (existing?.path) await unlink(existing.path).catch(() => undefined);
    const effectivePrompt = fix.promptEnglish || fix.prompt;
    fix.prompt = effectivePrompt;
    const result = await requestJson("/api/images/minimax/generate", {
      method: "POST",
      body: JSON.stringify({
        taskId,
        prompts: [{ shotId: fix.shotId, prompt: fix.prompt, negativePrompt: "文字，字母，数字，欧美面孔，白人面孔，现代服装，现代建筑，畸形手指，模糊，低清晰度" }],
        apiKey: "",
        aspectRatio: "9:16",
        maxImages: 1,
        track: task.track,
        visualStyle: task.visualStyle,
      }),
    });
    const replacement = result.images[0];
    if (!replacement?.path || replacement.status !== "ready") {
      throw new Error(`Shot ${fix.shotId} regeneration failed: ${JSON.stringify(replacement)}`);
    }

    const images = task.media.images
      .filter((image) => Number(image.shotId) !== fix.shotId)
      .concat(replacement)
      .sort((a, b) => Number(a.shotId) - Number(b.shotId));
    const prompts = task.artifacts.prompts.prompts.map((item) =>
      Number(item.shotId) === fix.shotId ? { ...item, prompt: effectivePrompt } : item,
    );
    task = (await requestJson(`/api/tasks/${encodeURIComponent(taskId)}`, {
      method: "PATCH",
      body: JSON.stringify({
        options: { ...task.options, referenceImage: youthReference },
        artifacts: { ...task.artifacts, prompts: { ...task.artifacts.prompts, prompts } },
        media: { ...task.media, images },
        draft: null,
      }),
    })).task;
    process.stdout.write(`FIXED ${fix.shotId} ${basename(replacement.path)}\n`);
  }

  const built = await requestJson(`/api/tasks/${encodeURIComponent(taskId)}/draft`, { method: "POST", body: "{}" });
  task = built.task || task;
  process.stdout.write(`DRAFT ${task.draft?.projectDir || built.draft?.projectDir}\nDONE ${taskId}\n`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
