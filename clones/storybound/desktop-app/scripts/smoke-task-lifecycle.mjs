import { randomUUID } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";

const baseUrl = process.env.STORYBOUND_URL || "http://127.0.0.1:5193";
const taskId = randomUUID();
const longSubtitle = "第一句测试字幕需要自动拆成适合手机阅读的短句，不能整段铺满屏幕。";

function silentWav(seconds = 2, sampleRate = 8000) {
  const samples = seconds * sampleRate;
  const dataSize = samples * 2;
  const buffer = Buffer.alloc(44 + dataSize);
  buffer.write("RIFF", 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write("WAVEfmt ", 8);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * 2, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write("data", 36);
  buffer.writeUInt32LE(dataSize, 40);
  return buffer;
}

const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=", "base64");

async function request(path, init) {
  const response = await fetch(`${baseUrl}${path}`, init);
  if (!response.ok) throw new Error(`${path}: HTTP ${response.status} ${await response.text()}`);
  return response;
}

async function json(path, init) {
  return request(path, init).then((response) => response.json());
}

async function upload(fileName, kind, buffer) {
  const payload = await json(`/api/tasks/${taskId}/assets`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ fileName, kind, base64: buffer.toString("base64") }),
  });
  return payload.asset;
}

let created = false;
try {
  await json("/api/tasks", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      id: taskId,
      title: "Storybound 草稿闭环测试",
      inputText: `${longSubtitle}第二句测试字幕。`,
      mode: "direct",
      videoForm: "narration",
      track: "通用故事",
      visualStyle: "现代电影",
      aspectRatio: "9:16",
      status: "paused",
      runState: "paused",
      currentStep: 6,
      stepStatuses: ["skipped", "skipped", "done", "done", "done", "done", "pending"],
      artifacts: {
        storyboard: { shots: [
          { id: 1, text: longSubtitle, visual: "夜晚城市", emotion: "安静", durationSec: 2 },
          { id: 2, text: "第二句测试字幕。", visual: "清晨窗边", emotion: "温暖", durationSec: 2 },
        ] },
        prompts: { templateVersion: "Storybound 1.13.1", prompts: [
          { shotId: 1, prompt: "夜晚城市", negativePrompt: "水印" },
          { shotId: 2, prompt: "清晨窗边", negativePrompt: "水印" },
        ] },
      },
    }),
  });
  created = true;
  const [image1, image2, audio1, audio2] = await Promise.all([
    upload("1.png", "images", png),
    upload("2.png", "images", png),
    upload("1.wav", "audio", silentWav()),
    upload("2.wav", "audio", silentWav()),
  ]);
  if (Math.abs(Number(audio1.durationSec) - 2) > 0.05 || Math.abs(Number(audio2.durationSec) - 2) > 0.05) {
    throw new Error(`音频真实时长探测失败：${audio1.durationSec}, ${audio2.durationSec}`);
  }
  const patch = {
    media: {
      images: [
        { id: "image-1", shotId: 1, prompt: "夜晚城市", status: "ready", crop: { x: 0.1, y: -0.05, scale: 1.2 }, ...image1 },
        { id: "image-2", shotId: 2, prompt: "清晨窗边", status: "ready", ...image2 },
      ],
      coverImages: [],
      audioSegments: [
        { id: "audio-1", shotId: 1, text: longSubtitle, voiceId: "smoke", durationSec: 2, status: "ready", ...audio1 },
        { id: "audio-2", shotId: 2, text: "第二句测试字幕。", voiceId: "smoke", durationSec: 2, status: "ready", ...audio2 },
      ],
      podcast: null,
      externalAudio: null,
      bgm: null,
    },
  };
  await json(`/api/tasks/${taskId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(patch) });
  const result = await json(`/api/tasks/${taskId}/draft`, { method: "POST" });
  if (!result.draft?.ready || result.draft.trackCount < 3 || result.draft.fileCount < 8) throw new Error("草稿产物不完整");
  const [imageFiles, audioFiles] = await Promise.all([
    readdir(join(result.draft.projectDir, "assets", "image")),
    readdir(join(result.draft.projectDir, "assets", "audio")),
  ]);
  if (!imageFiles.every((file) => file.endsWith(".png"))) throw new Error(`图片扩展名丢失：${imageFiles.join(", ")}`);
  if (!audioFiles.every((file) => file.endsWith(".wav"))) throw new Error(`音频扩展名丢失：${audioFiles.join(", ")}`);
  const draftInfo = JSON.parse(await readFile(join(result.draft.projectDir, "draft_info.json"), "utf8"));
  const firstImageSegment = draftInfo.tracks?.find((track) => track.name === "image_main")?.segments?.[0];
  if (firstImageSegment?.clip?.transform?.x !== 0.1 || firstImageSegment?.clip?.scale?.x !== 1.2) throw new Error("图片裁切参数未写入剪映草稿");
  const subtitleTrack = draftInfo.tracks?.find((track) => track.name === "subtitle");
  const textById = new Map((draftInfo.materials?.texts || []).map((item) => [item.id, JSON.parse(item.content).text]));
  const subtitleTexts = (subtitleTrack?.segments || []).map((segment) => textById.get(segment.material_id) || "");
  if (subtitleTexts.length <= 2 || subtitleTexts.some((text) => [...text.replace(/\s/g, "")].length > 20 || /^[，,。！？!?；;：:、]/.test(text))) {
    throw new Error(`长字幕未正确拆分：${subtitleTexts.join(" | ")}`);
  }
  if (draftInfo.tracks?.some((track) => track.name === "cover_title")) throw new Error("关闭标题封面时仍生成了标题轨");
  const zip = Buffer.from(await (await request(`/api/tasks/${taskId}/draft.zip`)).arrayBuffer());
  if (zip.subarray(0, 2).toString("ascii") !== "PK") throw new Error("下载结果不是 ZIP");
  process.stdout.write(JSON.stringify({ ok: true, taskId, projectName: result.draft.projectName, tracks: result.draft.trackCount, files: result.draft.fileCount, zipBytes: zip.length }) + "\n");
} finally {
  if (created && process.env.KEEP_TASK !== "1") await request(`/api/tasks/${taskId}`, { method: "DELETE" }).catch(() => undefined);
}
