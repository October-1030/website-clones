import { readFile } from "node:fs/promises";
import { dirname, extname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const appRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const baseUrl = process.env.STORYBOUND_URL || "http://127.0.0.1:5173";
const taskId = process.argv[2] || "60e16696-c3fd-4a24-b5db-7844f56447d8";
const onlyBatch = process.argv[3] || "";

const referencePaths = {
  youth: resolve(appRoot, "docs/research/character-references/li-xianglan/li-xianglan-1940.png"),
  postwar: resolve(appRoot, "docs/research/character-references/li-xianglan/yamaguchi-yoshiko-1950.jpg"),
  late: resolve(appRoot, "docs/research/character-references/li-xianglan/yamaguchi-yoshiko-midlife-bunshun.jpg"),
};

const approvedShotIds = new Set([3, 6, 17, 55]);
const common = "Vertical 9:16, pure monochrome black-and-white historical documentary photography, realistic archival film grain, period-correct East Asian setting and clothing, cinematic depth, no color tint, no readable text, no letters, no numbers, no logos, no watermark, no poster, no deformed hands, no modern objects.";
const youthIdentity = "Use the supplied verified 1940 Li Xianglan photograph strictly for the same East Asian Japanese woman's facial structure, natural East Asian eyes, short black wavy hair, and identity continuity. No Caucasian, mixed-race, or K-pop idol facial traits.";

const fixes = [
  {
    shotId: 2,
    reference: "youth",
    visual: "1945年上海法院木质长廊，25岁的李香兰穿深色旗袍，被两名看守押送前行；头至膝下的中远景，环境和三人动作完整入镜。",
    prompt: "竖屏9:16，纯黑白历史纪实照片。1940年代上海木质长廊，一名25岁东亚女性穿深色旗袍，与两名制服工作人员并肩向前走，三人从头到脚完整入镜，长廊环境占画面70%，严肃克制，不是肖像照。严格参考上传的1940年李香兰本人照片保持东亚女性骨相。无桌子，无文件，无文字，无欧美面孔，无彩色，无现代物件。",
  },
  {
    shotId: 10,
    reference: "youth",
    visual: "李香兰全身站在旧电影院出口与车站月台交会的空间里，人物只占小比例，三个时代场景在纵深中自然衔接。",
    prompt: `A restrained wide historical scene about an identity that is difficult to judge: young Li Xianglan stands full-body and small at the spatial intersection of a 1940s cinema exit, a rain-dark Shanghai street, and an old railway platform. Make it one believable deep location, not a collage. Environment at least 75 percent, no close-up. ${youthIdentity} ${common}`,
  },
  {
    shotId: 12,
    reference: "youth",
    visual: "李香兰背对镜头，从昏暗舞台走向远处的自然光；人物全身且很小，空舞台、幕布与座椅承担主要叙事。",
    prompt: `Full back view of young Li Xianglan walking away from a dim 1940s stage toward soft daylight beyond an open backstage door. Her entire body is small in frame; empty seats, curtains, floorboards, and stage equipment occupy at least 80 percent. No face portrait. ${youthIdentity} ${common}`,
  },
  {
    shotId: 14,
    reference: "youth",
    visual: "1920年代东北小城土路与院落，一名约10岁的东亚女孩在远处经过；街巷、屋舍和生活环境占画面主体。",
    prompt: `A 1920s Northeast China town lane with earthen houses, wooden fences, winter haze, and everyday Chinese neighbors. A ten-year-old East Asian girl representing young Li Xianglan walks in the distance, full body and less than 20 percent of the frame. The town environment tells the story; not a child portrait. Preserve plausible childhood resemblance to the supplied adult reference without glamour. ${common}`,
  },
  {
    shotId: 19,
    reference: "youth",
    visual: "满映摄影棚选角现场，摄影机、灯架、布景和工作人员占主体，李香兰全身站在远处候场，人物比例不超过三成。",
    prompt: `Wide 1930s Manchukuo Film Association casting studio. Wooden motion-picture camera, arc lamps, cables, painted set, and crew dominate the frame. Young Li Xianglan waits full-body at a distance beside the camera, less than 30 percent of the image. No portrait pose. ${youthIdentity} ${common}`,
  },
  {
    shotId: 22,
    reference: "youth",
    visual: "李香兰背对镜头走进满映摄影棚，前景是摄影机与轨道，远处布景同时暗示银幕爱情与战争背景。",
    prompt: `Full back view of young Li Xianglan walking into a vast 1940s film studio. A large camera, dolly track, lamps, painted romantic interior set, and distant wartime shadows dominate the scene. She is small and full-body, entering the constructed screen persona; no close-up and no collage. ${youthIdentity} ${common}`,
  },
  {
    shotId: 23,
    reference: "youth",
    visual: "老式圆形麦克风、唱片机和胶片盘的物件近景，李香兰双手扶住麦克风支架，仅露少量侧脸。",
    prompt: `Close detail of young Li Xianglan's hands holding the stand of a 1940s round studio microphone, beside a phonograph and film reels. Only a small sliver of her side face is visible; props and hands carry the story. Every surface is blank with no labels. ${youthIdentity} ${common}`,
  },
  {
    shotId: 28,
    reference: "youth",
    visual: "满映剪辑台上，一双手压住胶片和金属剪片器，旁边是胶片盘；只露李香兰极少侧脸，物件为主体。",
    prompt: `1940s Manchukuo film editing bench. Young Li Xianglan's hands press a film strip beside a metal film splicer and old reel cans. Only a very small part of her side face appears; equipment and hands dominate. All objects are blank without labels. ${youthIdentity} ${common}`,
  },
  {
    shotId: 29,
    reference: "youth",
    visual: "满映大型摄影棚全景，木质摄影机、弧光灯、轨道和布景占大部分，李香兰作为小比例全身人物站在镜头前。",
    prompt: `Very wide 1940s Manchukuo film studio. Wooden movie camera, arc lights, dolly rails, cables, and painted scenery fill most of the vertical frame. Young Li Xianglan in a period Chinese qipao stands full-body and small before the camera, no more than 25 percent. ${youthIdentity} ${common}`,
  },
  {
    shotId: 33,
    reference: "youth",
    visual: "李香兰一手握老式麦克风支架，一手触碰电影胶片，录音棚和摄影设备在背景中展开，人物为中远景。",
    prompt: `Medium-wide 1940s recording stage. Young Li Xianglan reaches one hand toward a round microphone stand while the other touches a loose film strip on an editing table. Recording booth, camera, curtains, and empty seats remain clearly visible; she occupies under 40 percent, never a beauty portrait. ${youthIdentity} ${common}`,
  },
  {
    shotId: 34,
    reference: "youth",
    visual: "1942年上海火车站月台，李香兰携小行李全身站在远处，蒸汽、铁轨和城市建筑占画面四分之三。",
    prompt: `1942 Shanghai railway platform arrival. Steam, rails, period train carriages, iron canopy, and distant city architecture occupy at least 75 percent. Young Li Xianglan stands full-body and small with one modest suitcase, seen in three-quarter view, not posing for a portrait. All station signs are blank. ${youthIdentity} ${common}`,
  },
  {
    shotId: 35,
    reference: "youth",
    visual: "1942年战时上海舞厅演唱会全景，麦克风、幕布、唱片机和观众剪影组成环境，李香兰只占画面约三分之一。",
    prompt: `Wide 1942 wartime Shanghai concert hall. A round microphone, heavy curtains, phonograph, empty dance-floor tables, and audience silhouettes form the environment. Young Li Xianglan sings at center but occupies only about one third of the frame; searchlight shadows outside suggest war. ${youthIdentity} ${common}`,
  },
  {
    shotId: 38,
    reference: "none",
    visual: "化妆台物件近景，李香兰双手分别触碰旗袍布料与舞台服装，镜中仅有模糊侧影，避免双脸和大头照。",
    prompt: `No people and no hands. 1940s backstage dressing table detail with two different period costumes laid side by side: a Chinese qipao and a plain Japanese stage robe. An old standing mirror reflects only empty curtains and light, never a face. Costumes and mirror dominate; no papers and no readable labels. ${common}`,
  },
  {
    shotId: 39,
    reference: "youth",
    visual: "空旷摄影棚与一排空座椅，李香兰独自站在远处胶片与灯架之间，人物很小，压迫环境占主体。",
    prompt: `Wide empty 1940s film studio after hours. Rows of empty chairs, coiled film, camera tracks, hanging lamps, and deep shadows dominate. Young Li Xianglan stands alone in the distance, full-body and under 20 percent of frame, conveying fear and awareness rather than glamour. ${youthIdentity} ${common}`,
  },
  {
    shotId: 41,
    reference: "youth",
    visual: "1942年前后电影后台，22岁的李香兰坐在木椅边侧望画外，保持头至膝上的中景，背景胶片盒与阴影清晰可见。",
    prompt: `Around 1942 in a film backstage room, 22-year-old Li Xianglan sits on the edge of a wooden chair and looks off-frame with fear, dependence, and hesitation. Medium shot from head to knees, with film cans, curtains, and hard shadows clearly visible. No large portrait. ${youthIdentity} ${common}`,
  },
  {
    shotId: 42,
    reference: "none",
    visual: "1945年战败后法院长廊，李香兰与看守从侧后方走向拘押室，三人全身，木门和长廊纵深为主体。",
    prompt: `1945 postwar Shanghai courthouse corridor viewed from behind and slightly to the side. A 25-year-old East Asian Japanese woman in a dark qipao walks full-body between two uniformed guards toward a detention doorway. The long wooden corridor, doors, and window shadows dominate; all three people remain small. No table, no paper, no portrait, never Caucasian. ${common}`,
  },
  {
    shotId: 43,
    reference: "youth",
    visual: "前景是围观者紧握的手和模糊肩背，远处李香兰被押送经过法院门厅；无标语、无文字，人物不做肖像化。",
    prompt: `1945 courthouse entrance seen through a tense crowd. Foreground hands grip coat sleeves and railings while young Li Xianglan is escorted in the distant background, full-body and small. Faces in the crowd stay indistinct; no placards, signs, or text. ${youthIdentity} ${common}`,
  },
  {
    shotId: 44,
    reference: "youth",
    visual: "上海法庭全景，李香兰作为小比例人物站在中央，木桌、法官席、看守与窗格阴影围绕；桌面文件全部闭合空白。",
    prompt: `Wide 1945 Shanghai courtroom. Young Li Xianglan stands small at center while the judge's bench, wooden tables, guards, tall windows, and audience benches fill the frame. A closed blank folder lies on a table but no paper surface is readable. No portrait. ${youthIdentity} ${common}`,
  },
  {
    shotId: 48,
    reference: "youth",
    visual: "1950至60年代电视演播室中远景，李香兰调试老式麦克风，摄像机、导播窗和灯架占画面主体。",
    prompt: `Medium-wide 1950s to early-1960s Japanese television studio. Yoshiko Yamaguchi adjusts an old broadcast microphone while large television cameras, control-room windows, cables, and light stands dominate. She occupies under 35 percent, seen in a working action rather than a portrait. Age her naturally into her thirties while preserving identity. ${youthIdentity} ${common}`,
  },
  {
    shotId: 52,
    reference: "none",
    visual: "1974年日本国会建筑长廊，约54岁的山口淑子穿正式套装从侧后方走向议事厅，全身很小，建筑占主体。",
    prompt: `1974 Japanese parliament corridor. A 54-year-old East Asian Japanese woman politician in a period formal suit walks full-body toward the chamber, seen from the back and three-quarter side. The monumental corridor, doors, and ceiling occupy at least 80 percent; she is unmistakably middle-aged, not a young model. All plaques are absent, no desk and no paper. ${common}`,
  },
  {
    shotId: 53,
    reference: "none",
    visual: "1980年代国际交流会议室中远景，约60岁的山口淑子与东亚代表围桌交谈，会议空间为主体，人物比例克制。",
    prompt: `1980s international exchange meeting room. A 60-year-old East Asian Japanese woman with short curled hair sits with five East Asian delegates around a long table, speaking calmly in a medium-wide documentary scene. Room architecture and the full table dominate; she occupies under 25 percent and is visibly older, not a young model. No flags, name cards, documents, or readable text. ${common}`,
  },
  {
    shotId: 54,
    reference: "none",
    visual: "无人空镜：废弃战时电影院里，一面开裂后修补过的墙、空座椅和老放映机同时出现，表现后来交流无法抹去旧伤。",
    prompt: `No people. An abandoned wartime cinema interior with a cracked wall that has been repaired but remains visibly scarred, rows of empty wooden seats, an old projector, dust in a beam of light, and restrained historical melancholy. Pure environmental still life, absolutely no paper, posters, signs, labels, or text. ${common}`,
  },
  {
    shotId: 56,
    reference: "none",
    visual: "2010年代约90岁的山口淑子安静坐在窗边，戴浅色眼镜、短卷发和自然皱纹；黑白中景，避免年轻化与彩色。",
    prompt: `Around 2010, a 90-year-old East Asian Japanese woman resembling elderly Yoshiko Yamaguchi sits quietly beside a window, wearing light-colored glasses. Medium documentary scene from head to waist with natural wrinkles, short curled hair, hands resting calmly, and a modest room visible. Strict neutral grayscale black-and-white only, absolutely no color or sepia, no cosmetic youthfulness and never Caucasian. ${common}`,
  },
  {
    shotId: 59,
    reference: "youth",
    visual: "李香兰全身站在三个纵深相连的空间入口之间：舞台、法庭与议事厅；人物很小，环境象征复杂身份，不做拼贴。",
    prompt: `A single believable deep architectural space with three adjoining doorways suggesting a 1940s stage, a postwar courtroom, and a later parliament chamber. Young Li Xianglan stands full-body and very small at the central threshold, environment at least 80 percent. One continuous location, not a collage, no duplicate person. ${youthIdentity} ${common}`,
  },
  {
    shotId: 62,
    reference: "none",
    visual: "无人结尾空镜：昏暗长廊尽头分成三扇门，其中一扇透出自然光，地面留下长影；不出现人物、纸张、文字或标识。",
    prompt: `No people. Final symbolic shot of a dim historical corridor ending in three closed wooden doorways, with one narrow opening admitting natural light and long floor shadows. Restrained unresolved ending, realistic architecture, no human silhouette, no paper, no signs, no symbols, and no text of any kind. ${common}`,
  },
];

const batches = [
  { name: "youth-a", reference: "youth", shotIds: [2, 10, 12, 14, 19, 22] },
  { name: "youth-b", reference: "youth", shotIds: [23, 28, 29, 33, 34, 35] },
  { name: "youth-c", reference: "youth", shotIds: [38, 39, 41, 42, 43, 44] },
  { name: "youth-d", reference: "youth", shotIds: [48, 59] },
  { name: "postwar", reference: "postwar", shotIds: [52, 53] },
  { name: "late", reference: "late", shotIds: [56] },
  { name: "environment", reference: "youth", shotIds: [54, 62] },
  { name: "retry-42", reference: "youth", shotIds: [42] },
  { name: "round2-objective", reference: "youth", shotIds: [2, 38, 42, 52, 53, 56] },
  { name: "retry-primary-2-53", reference: "youth", shotIds: [2, 53], requirePrimary: true },
  { name: "retry-primary-2", reference: "youth", shotIds: [2], requirePrimary: true },
];

async function requestJson(path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
  });
  if (!response.ok) throw new Error(`${path} failed (${response.status}): ${await response.text()}`);
  return response.json();
}

async function uploadReference(group) {
  const path = referencePaths[group];
  const bytes = await readFile(path);
  return (await requestJson(`/api/tasks/${encodeURIComponent(taskId)}/assets`, {
    method: "POST",
    body: JSON.stringify({
      kind: "uploads",
      fileName: `li-xianglan-${group}-qc${extname(path).toLowerCase()}`,
      base64: bytes.toString("base64"),
    }),
  })).asset;
}

function patchArtifacts(task, selected) {
  const fixMap = new Map(selected.map((fix) => [fix.shotId, fix]));
  const shots = task.artifacts.storyboard.shots.map((shot) => {
    const fix = fixMap.get(Number(shot.id));
    return fix ? { ...shot, visual: fix.visual } : shot;
  });
  const prompts = task.artifacts.prompts.prompts.map((prompt) => {
    const fix = fixMap.get(Number(prompt.shotId));
    return fix
      ? {
          ...prompt,
          prompt: fix.prompt,
          provider: "minimax",
          useReference: fix.reference !== "none",
          negativePrompt: "color, sepia, Caucasian face, mixed-race face, modern clothing, modern architecture, portrait headshot, readable text, letters, numbers, logo, watermark, malformed hands, duplicate person",
        }
      : prompt;
  });
  return {
    ...task.artifacts,
    storyboard: { ...task.artifacts.storyboard, shots },
    prompts: { ...task.artifacts.prompts, prompts },
  };
}

async function patchTask(task, patch) {
  return (await requestJson(`/api/tasks/${encodeURIComponent(taskId)}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  })).task;
}

async function generateBatch(task, batch, referenceImage) {
  const selected = fixes.filter((fix) => batch.shotIds.includes(fix.shotId));
  if (selected.some((fix) => approvedShotIds.has(fix.shotId))) {
    throw new Error(`Batch ${batch.name} attempts to overwrite an approved shot`);
  }
  task = await patchTask(task, {
    options: { ...task.options, referenceImage },
    artifacts: patchArtifacts(task, selected),
    draft: null,
  });
  const promptMap = new Map(task.artifacts.prompts.prompts.map((prompt) => [Number(prompt.shotId), prompt]));
  const prompts = selected.map((fix) => promptMap.get(fix.shotId));
  process.stdout.write(`GENERATE ${batch.name} ${batch.shotIds.join(",")}\n`);
  const result = await requestJson("/api/images/minimax/generate", {
    method: "POST",
    body: JSON.stringify({
      taskId,
      prompts,
      apiKey: "",
      aspectRatio: "9:16",
      maxImages: prompts.length,
      track: task.track,
      visualStyle: task.visualStyle,
      force: true,
    }),
  });
  const ready = result.images.filter((image) => image.status === "ready" && image.path);
  const merged = new Map((task.media.images || []).map((image) => [Number(image.shotId), image]));
  for (const image of ready) merged.set(Number(image.shotId), image);
  task = await patchTask(task, {
    media: {
      ...task.media,
      images: [...merged.values()].sort((left, right) => Number(left.shotId) - Number(right.shotId)),
    },
    draft: null,
  });
  const failed = result.images.filter(
    (image) => image.status !== "ready" || !image.path || (batch.requirePrimary && Number(image.retryLevel) !== 0),
  );
  process.stdout.write(`SAVED ${batch.name} ${ready.length}/${prompts.length}\n`);
  if (failed.length) {
    throw new Error(`${batch.name} failed shots: ${failed.map((image) => image.shotId).join(",")}`);
  }
  return task;
}

async function main() {
  let task = (await requestJson(`/api/tasks/${encodeURIComponent(taskId)}`)).task;
  const references = {};
  for (const group of ["youth", "postwar", "late"]) references[group] = await uploadReference(group);
  const selectedBatches = onlyBatch
    ? batches.filter((batch) => batch.name === onlyBatch)
    : batches.filter((batch) => !batch.name.startsWith("retry-") && !batch.name.startsWith("round2-"));
  if (!selectedBatches.length) throw new Error(`Unknown batch: ${onlyBatch}`);

  for (const batch of selectedBatches) {
    task = await generateBatch(task, batch, references[batch.reference]);
  }

  const readyIds = new Set(
    (task.media.images || [])
      .filter((image) => image.status === "ready" && image.path)
      .map((image) => Number(image.shotId)),
  );
  const missing = task.artifacts.storyboard.shots
    .map((shot) => Number(shot.id))
    .filter((shotId) => !readyIds.has(shotId));
  if (missing.length) throw new Error(`Images missing after QC: ${missing.join(",")}`);
  task = await patchTask(task, {
    title: "李香兰（完整62镜构图重制·MiniMax）",
    status: "paused",
    runState: "paused",
    currentStep: 4,
    stepStatuses: ["done", "done", "done", "done", "done", "pending", "pending"],
    options: { ...task.options, referenceImage: references.youth },
    draft: null,
    error: null,
  });
  process.stdout.write(`DONE ${task.id} READY ${readyIds.size}\n`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
