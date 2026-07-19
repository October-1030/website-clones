import { randomUUID } from "node:crypto";

const baseUrl = process.env.STORYBOUND_URL || "http://127.0.0.1:5173";
const taskId = randomUUID();

async function request(path, init) {
  const response = await fetch(`${baseUrl}${path}`, init);
  if (!response.ok) throw new Error(`${path}: HTTP ${response.status} ${await response.text()}`);
  return response;
}

let created = false;
try {
  await request("/api/tasks", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      id: taskId,
      title: "MiniMax 时间戳回归测试",
      inputText: "夜深了，怀表仍在走。",
      mode: "direct",
      videoForm: "narration",
      aspectRatio: "9:16",
    }),
  });
  created = true;
  const audioResponse = await request("/api/tts/synthesize", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      provider: "minimax",
      text: "夜深了，怀表仍在走。",
      voiceId: "male-qn-qingse",
      speed: 1,
      config: { model: "speech-2.8-hd" },
      taskId,
      shotId: 0,
      fileName: "alignment-smoke.mp3",
      alignment: true,
    }),
  });
  await audioResponse.arrayBuffer();
  const alignmentUrl = decodeURIComponent(audioResponse.headers.get("X-TTS-Alignment-Url") || "");
  if (!alignmentUrl) throw new Error("TTS 响应缺少时间戳文件 URL");
  const alignment = await request(alignmentUrl).then((response) => response.json());
  if (alignment.source !== "minimax-word" || !Array.isArray(alignment.words) || alignment.words.length < 8) {
    throw new Error("MiniMax 词级时间戳结构不完整");
  }
  if (alignment.words.some((word) => !Number.isFinite(word.startSec) || !Number.isFinite(word.endSec) || word.endSec <= word.startSec)) {
    throw new Error("MiniMax 返回了无效时间戳");
  }
  process.stdout.write(`${JSON.stringify({ ok: true, words: alignment.words.length, durationSec: Number(audioResponse.headers.get("X-TTS-Duration")), first: alignment.words[0].text, last: alignment.words.at(-1).text })}\n`);
} finally {
  if (created) await request(`/api/tasks/${taskId}`, { method: "DELETE" }).catch(() => undefined);
}
