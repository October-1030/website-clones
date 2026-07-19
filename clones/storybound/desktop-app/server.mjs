import { createReadStream, existsSync } from "node:fs";
import { readFile, stat } from "node:fs/promises";
import { createServer } from "node:http";
import { basename, dirname, extname, join, normalize, resolve } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

import { buildJianyingDraft } from "./server/draft-builder.mjs";
import { renderTitledCover } from "./server/cover-compositor.mjs";
import { createTaskStore } from "./server/task-store.mjs";

const root = dirname(fileURLToPath(import.meta.url));
const taskStore = createTaskStore(root);
await taskStore.ensureRoot();
const originalPromptLibrary = JSON.parse(
  await readFile(join(root, "original-prompt-library.json"), "utf8"),
);
const tutorialStoryboardPrompt = `# 同琛教程分镜补充规则（连续旁白模式）
- 分镜与最终显示字幕是两套数据；这里按可视语义切图片，不按 9 字字幕切图片。
- 每张图片目标覆盖 5–7 秒旁白；按正常中文语速优先组织为约 20–30 字且语义完整的画面段。
- 同一主体、场景和连续动作应合并；人物、地点、时间或核心动作变化时切镜。
- 3–5 分钟成片通常控制在 27–35 镜，数量随正文动态变化，不机械凑数。`;
const tutorialImagePrompt = `# 同琛教程绘图提示词补充规则（连续旁白模式）
- 每个分镜必须输出一条完整、可直接生图的中文提示词，数量与分镜严格一致。
- 人物题材写明姓名或身份、年龄、性别、面部特征、服装、景别、动作、时代和场景细节；相近年龄段重复一致外观。
- 全片统一色调并保持时代真实；中老年人物故事可采用低饱和、轻微泛黄的写实质感。
- 禁止生成台词、字幕、书名或水印；禁止用象征、剪影、拼贴、线稿漫画替代真实画面。`;
const production = process.argv.includes("--production");
const port = Number(process.env.PORT || 5173);
const publicAccessToken = String(process.env.STORYBOUND_PUBLIC_ACCESS_TOKEN || "").trim();
const maxJsonBytes = 24 * 1024 * 1024;
const volcengineEndpoint = "https://openspeech.bytedance.com/api/v3/tts/unidirectional";
const minimaxBase = "https://api.minimaxi.com";
const llmProviderDefaults = {
  minimax: { baseUrl: "https://api.minimaxi.com/v1", model: "MiniMax-M2.7" },
  openai: { baseUrl: "https://api.openai.com/v1", model: "gpt-4.1-mini" },
  deepseek: { baseUrl: "https://api.deepseek.com/v1", model: "deepseek-chat" },
  siliconflow: { baseUrl: "https://api.siliconflow.cn/v1", model: "Qwen/Qwen3-32B" },
  custom: { baseUrl: "", model: "" },
};
const execFileAsync = promisify(execFile);
const ffprobeCandidates = [
  process.env.FFPROBE_PATH,
  "C:\\Users\\pdb12\\AppData\\Local\\Microsoft\\WinGet\\Packages\\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\\ffmpeg-7.1.1-full_build\\bin\\ffprobe.exe",
  "ffprobe",
].filter(Boolean);
const minimaxSecretCandidates = [
  process.env.MINIMAX_SECRETS_FILE,
  "C:\\tmp\\minimax-secrets.txt",
  "D:\\projects\\MIMI\\coding\\Tbot\\MINIMAX.txt",
].filter(Boolean);
const llmSecretCandidates = [
  process.env.STORYBOUND_LLM_SECRETS_FILE,
  "C:\\tmp\\storybound-secrets.txt",
  "C:\\tmp\\llm-secrets.txt",
].filter(Boolean);

function parseMinimaxApiKey(contents) {
  const lines = String(contents || "").split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  for (const line of lines) {
    const labeled = line.match(/^(?:export\s+)?MINIMAX_API_KEY\s*[:=]\s*["']?([^"']+?)["']?\s*$/i);
    if (labeled?.[1]?.trim()) return labeled[1].trim();
  }
  return lines.find((line) => /^sk-[A-Za-z0-9_.-]{40,}$/.test(line)) || "";
}

function parseKeyValueSecrets(contents) {
  const values = {};
  const lines = String(contents || "").split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  for (const line of lines) {
    if (line.startsWith("#")) continue;
    const match = line.match(/^(?:export\s+)?([A-Z0-9_]+)\s*[:=]\s*["']?([^"']+?)["']?\s*$/i);
    if (match?.[1]) values[match[1].toUpperCase()] = match[2].trim();
  }
  return values;
}

async function findLocalMinimaxCredential() {
  for (const file of minimaxSecretCandidates) {
    try {
      const apiKey = parseMinimaxApiKey(await readFile(file, "utf8"));
      if (apiKey) return { apiKey, source: basename(file) };
    } catch (error) {
      if (error?.code !== "ENOENT") throw error;
    }
  }
  return null;
}

async function resolveMinimaxApiKey(input) {
  const provided = String(input || "").trim();
  if (provided) return provided;
  const local = await findLocalMinimaxCredential();
  if (local?.apiKey) return local.apiKey;
  throw new Error("请填写 MiniMax API Key，或在本机凭据文件中配置 MINIMAX_API_KEY");
}

async function getTtsStatus() {
  const minimax = await findLocalMinimaxCredential();
  return {
    minimax: { available: Boolean(minimax), source: minimax?.source || null },
    volcengine: {
      available: Boolean(process.env.VOLCENGINE_APP_ID && process.env.VOLCENGINE_ACCESS_TOKEN),
      source: process.env.VOLCENGINE_APP_ID && process.env.VOLCENGINE_ACCESS_TOKEN ? "环境变量" : null,
    },
  };
}

function normalizeLlmProvider(value) {
  const provider = String(value || "").trim().toLowerCase();
  return Object.hasOwn(llmProviderDefaults, provider) ? provider : "minimax";
}

async function findLocalLlmCredential() {
  const envApiKey = process.env.STORYBOUND_LLM_API_KEY
    || process.env.LLM_API_KEY
    || process.env.MINIMAX_API_KEY
    || process.env.DEEPSEEK_API_KEY
    || process.env.OPENAI_API_KEY
    || process.env.SILICONFLOW_API_KEY;
  if (envApiKey) {
    const provider = normalizeLlmProvider(
      process.env.STORYBOUND_LLM_PROVIDER
      || (process.env.MINIMAX_API_KEY ? "minimax" : process.env.OPENAI_API_KEY ? "openai" : "deepseek"),
    );
    const defaults = llmProviderDefaults[provider];
    return {
      apiKey: envApiKey,
      provider,
      baseUrl: process.env.STORYBOUND_LLM_BASE_URL || process.env.OPENAI_BASE_URL || defaults.baseUrl,
      model: process.env.STORYBOUND_LLM_MODEL || defaults.model,
      source: "环境变量",
    };
  }

  for (const file of llmSecretCandidates) {
    try {
      const values = parseKeyValueSecrets(await readFile(file, "utf8"));
      const apiKey = values.STORYBOUND_LLM_API_KEY
        || values.LLM_API_KEY
        || values.MINIMAX_API_KEY
        || values.DEEPSEEK_API_KEY
        || values.OPENAI_API_KEY
        || values.SILICONFLOW_API_KEY;
      if (!apiKey) continue;
      const provider = normalizeLlmProvider(
        values.STORYBOUND_LLM_PROVIDER
        || values.LLM_PROVIDER
        || (values.MINIMAX_API_KEY ? "minimax" : values.OPENAI_API_KEY ? "openai" : "deepseek"),
      );
      const defaults = llmProviderDefaults[provider];
      return {
        apiKey,
        provider,
        baseUrl: values.STORYBOUND_LLM_BASE_URL || values.LLM_BASE_URL || values.OPENAI_BASE_URL || defaults.baseUrl,
        model: values.STORYBOUND_LLM_MODEL || values.LLM_MODEL || defaults.model,
        source: basename(file),
      };
    } catch (error) {
      if (error?.code !== "ENOENT") throw error;
    }
  }
  const minimax = await findLocalMinimaxCredential();
  if (!minimax) return null;
  return {
    apiKey: minimax.apiKey,
    provider: "minimax",
    ...llmProviderDefaults.minimax,
    source: minimax.source,
  };
}

async function getLlmStatus() {
  const local = await findLocalLlmCredential();
  return {
    available: Boolean(local),
    source: local?.source || null,
    provider: local?.provider || null,
    baseUrl: local?.baseUrl || null,
    model: local?.model || null,
    promptLibrary: {
      sourceVersion: originalPromptLibrary.sourceVersion,
      trackCount: originalPromptLibrary.tracks.length,
      styleCount: originalPromptLibrary.styles.length,
    },
  };
}

async function resolveLlmConfig(input) {
  const local = await findLocalLlmCredential();
  const providedApiKey = String(input?.apiKey || "").trim();
  const provider = normalizeLlmProvider(providedApiKey ? input?.provider : local?.provider || input?.provider);
  const defaults = llmProviderDefaults[provider];
  const apiKey = providedApiKey || local?.apiKey;
  const baseUrl = providedApiKey
    ? String(input?.baseUrl || "").trim() || defaults.baseUrl
    : local?.baseUrl || String(input?.baseUrl || "").trim() || defaults.baseUrl;
  const model = providedApiKey
    ? String(input?.model || "").trim() || defaults.model
    : local?.model || String(input?.model || "").trim() || defaults.model;
  if (!apiKey) throw new Error("请填写 LLM API Key，或在 C:\\tmp\\storybound-secrets.txt 配置 STORYBOUND_LLM_API_KEY");
  if (!baseUrl) throw new Error("请填写 LLM Base URL");
  if (!model) throw new Error("请填写 LLM 模型名");
  return { provider, apiKey, baseUrl: baseUrl.replace(/\/+$/, ""), model };
}

function sendJson(response, status, value) {
  response.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(value));
}

async function readJson(request) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > maxJsonBytes) throw new Error("请求内容过大");
    chunks.push(chunk);
  }
  if (chunks.length === 0) return {};
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function splitText(input, maxLength) {
  const text = String(input || "").trim();
  if (!text) return [];
  const chunks = [];
  let remaining = text;
  while (remaining.length > maxLength) {
    const window = remaining.slice(0, maxLength + 1);
    const candidates = ["\n", "。", "！", "？", "；", "，", ".", "!", "?", ";", ","];
    let splitAt = -1;
    for (const marker of candidates) splitAt = Math.max(splitAt, window.lastIndexOf(marker));
    if (splitAt < Math.floor(maxLength * 0.45)) splitAt = maxLength - 1;
    const end = splitAt + 1;
    chunks.push(remaining.slice(0, end).trim());
    remaining = remaining.slice(end).trim();
  }
  if (remaining) chunks.push(remaining);
  return chunks.filter(Boolean);
}

async function mapLimit(items, concurrency, worker) {
  const results = new Array(items.length);
  let cursor = 0;
  async function run() {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await worker(items[index], index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, run));
  return results;
}

async function fetchWithTimeout(url, options, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

function providerMessage(value, fallback) {
  if (value instanceof Error) {
    if (value.name === "AbortError") return "TTS 请求超时";
    return value.message.slice(0, 300);
  }
  return fallback;
}

async function synthesizeVolcengine(text, voiceId, speed, config) {
  if (!config?.appId?.trim() || !config?.accessToken?.trim()) {
    throw new Error("请先填写火山引擎 App ID 和 Access Token");
  }
  const speechRate = Math.max(-50, Math.min(50, Math.round((Number(speed || 1) - 1) * 100)));
  const audioParams = { format: "mp3", sample_rate: 24000 };
  if (speechRate !== 0) audioParams.speech_rate = speechRate;
  const response = await fetchWithTimeout(
    volcengineEndpoint,
    {
      method: "POST",
      headers: {
        "X-Api-App-Id": config.appId.trim(),
        "X-Api-Access-Key": config.accessToken.trim(),
        "X-Api-Resource-Id": /_uranus_bigtts$|^saturn_/.test(voiceId) ? "seed-tts-2.0" : "seed-tts-1.0",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        user: { uid: "storybound_clone" },
        req_params: { text, speaker: voiceId, audio_params: audioParams },
      }),
    },
    120000,
  );
  const body = await response.text();
  if (!response.ok) throw new Error(`火山 TTS HTTP ${response.status}: ${body.slice(0, 180)}`);
  const buffers = [];
  let providerError = "";
  for (const line of body.split(/\r?\n/)) {
    if (!line.trim()) continue;
    let event;
    try {
      event = JSON.parse(line);
    } catch {
      continue;
    }
    const code = event.code ?? 0;
    if (code !== 0 && code !== 20000000) {
      providerError = `${event.message || event.msg || "火山 TTS 错误"} (code=${code})`;
    }
    if (typeof event.data === "string" && event.data) buffers.push(Buffer.from(event.data, "base64"));
  }
  if (providerError) throw new Error(providerError);
  if (buffers.length === 0) throw new Error("火山 TTS 返回空音频");
  return Buffer.concat(buffers);
}

async function minimaxJson(path, apiKey, body, timeoutMs = 90000) {
  const resolvedApiKey = await resolveMinimaxApiKey(apiKey);
  const response = await fetchWithTimeout(
    `${minimaxBase}/${path}`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${resolvedApiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
    timeoutMs,
  );
  const text = await response.text();
  if (!response.ok) throw new Error(`MiniMax HTTP ${response.status}: ${text.slice(0, 180)}`);
  let payload;
  try {
    payload = JSON.parse(text);
  } catch {
    throw new Error("MiniMax 响应不是合法 JSON");
  }
  const code = payload.base_resp?.status_code ?? 0;
  if (code !== 0) throw new Error(`MiniMax ${code}: ${payload.base_resp?.status_msg || "请求失败"}`);
  return payload;
}

async function fetchMinimaxAlignment(url, text) {
  if (!url) return null;
  const response = await fetchWithTimeout(url, { headers: { Accept: "application/json" } }, 20_000);
  if (!response.ok) return null;
  let segments;
  try {
    segments = JSON.parse(await response.text());
  } catch {
    return null;
  }
  if (!Array.isArray(segments)) return null;
  const words = segments.flatMap((segment) => Array.isArray(segment.timestamped_words) ? segment.timestamped_words : [])
    .map((word) => ({
      text: String(word.word || ""),
      textStart: Number(word.word_begin),
      textEnd: Number(word.word_end),
      startSec: Number(word.time_begin) / 1000,
      endSec: Number(word.time_end) / 1000,
    }))
    .filter((word) => word.text && Number.isFinite(word.textStart) && Number.isFinite(word.textEnd) && Number.isFinite(word.startSec) && Number.isFinite(word.endSec));
  return words.length ? { source: "minimax-word", text, words } : null;
}

async function synthesizeMinimax(text, voiceId, speed, config, withAlignment = false) {
  const payload = await minimaxJson("v1/t2a_v2", config?.apiKey, {
    model: config?.model || "speech-2.8-hd",
    text,
    stream: false,
    language_boost: "auto",
    voice_setting: {
      voice_id: voiceId,
      speed: Math.max(0.5, Math.min(2, Number(speed || 1))),
      vol: 1,
      pitch: 0,
    },
    audio_setting: { sample_rate: 32000, bitrate: 128000, format: "mp3", channel: 1 },
    subtitle_enable: withAlignment,
    ...(withAlignment ? { subtitle_type: "word" } : {}),
    output_format: "hex",
  });
  const hex = payload.data?.audio;
  if (!hex || typeof hex !== "string") throw new Error("MiniMax 响应缺少 audio 字段");
  return {
    audio: Buffer.from(hex, "hex"),
    durationSec: Number(payload.extra_info?.audio_length) / 1000,
    alignment: withAlignment ? await fetchMinimaxAlignment(payload.data?.subtitle_file, text) : null,
  };
}

async function synthesize(body) {
  const provider = body.provider;
  const text = String(body.text || "").trim();
  const voiceId = String(body.voiceId || "").trim();
  if (!text) throw new Error("请输入配音文本");
  if (text.length > 10000) throw new Error("配音文本最多 10000 字");
  if (!voiceId) throw new Error("请选择配音员");
  const maxLength = provider === "minimax" ? (body.alignment ? 9999 : 2000) : 500;
  const parts = splitText(text, maxLength);
  const results = await mapLimit(parts, 3, async (part) =>
    provider === "minimax"
      ? synthesizeMinimax(part, voiceId, body.speed, body.config, Boolean(body.alignment))
      : { audio: await synthesizeVolcengine(part, voiceId, body.speed, body.config), durationSec: null, alignment: null },
  );
  let textOffset = 0;
  let timeOffset = 0;
  const alignedWords = [];
  for (const [index, result] of results.entries()) {
    if (result.alignment?.words) {
      alignedWords.push(...result.alignment.words.map((word) => ({
        ...word,
        textStart: word.textStart + textOffset,
        textEnd: word.textEnd + textOffset,
        startSec: word.startSec + timeOffset,
        endSec: word.endSec + timeOffset,
      })));
    }
    textOffset += parts[index].length;
    timeOffset += Number.isFinite(result.durationSec) ? result.durationSec : 0;
  }
  const measuredDuration = results.every((result) => Number.isFinite(result.durationSec) && result.durationSec > 0)
    ? results.reduce((sum, result) => sum + result.durationSec, 0)
    : 0;
  return {
    audio: Buffer.concat(results.map((result) => result.audio)),
    segments: parts.length,
    durationSec: measuredDuration || Math.max(0.8, text.replace(/\s/g, "").length / (4.2 * Math.max(0.5, Number(body.speed || 1)))),
    alignment: alignedWords.length ? { source: "minimax-word", text, words: alignedWords } : null,
  };
}

async function listMinimaxVoices(body) {
  const type = body.voiceType === "system" ? "system" : "voice_cloning";
  const payload = await minimaxJson("v1/get_voice", body.apiKey, { voice_type: type }, 20000);
  const list = type === "system" ? payload.system_voice : payload.voice_cloning;
  return (Array.isArray(list) ? list : [])
    .filter((voice) => typeof voice.voice_id === "string" && voice.voice_id.trim())
    .map((voice) => ({
      id: voice.voice_id,
      name: voice.voice_name || voice.description?.find((item) => typeof item === "string") || voice.voice_id,
      tag: type === "system" ? "MiniMax 系统音色" : "我的克隆音色",
      provider: "minimax",
      cloned: type !== "system",
    }));
}

async function cloneMinimaxVoice(body) {
  const apiKey = await resolveMinimaxApiKey(body.apiKey);
  const audio = Buffer.from(String(body.audioBase64 || ""), "base64");
  if (audio.length === 0) throw new Error("请选择用于克隆的音频");
  if (audio.length > 20 * 1024 * 1024) throw new Error("克隆音频不能超过 20 MB");
  const form = new FormData();
  form.append("purpose", "voice_clone");
  form.append("file", new Blob([audio], { type: body.mimeType || "audio/mpeg" }), body.fileName || "clone.mp3");
  const upload = await fetchWithTimeout(
    `${minimaxBase}/v1/files/upload`,
    { method: "POST", headers: { Authorization: `Bearer ${apiKey}` }, body: form },
    60000,
  );
  const uploadText = await upload.text();
  if (!upload.ok) throw new Error(`MiniMax 上传失败 ${upload.status}: ${uploadText.slice(0, 180)}`);
  const uploadPayload = JSON.parse(uploadText);
  const uploadCode = uploadPayload.base_resp?.status_code ?? 0;
  if (uploadCode !== 0 || !uploadPayload.file?.file_id) {
    throw new Error(`MiniMax 上传失败: ${uploadPayload.base_resp?.status_msg || "未返回 file_id"}`);
  }
  const voiceId = `clone_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  const cloneBody = {
    file_id: uploadPayload.file.file_id,
    voice_id: voiceId,
    text: String(body.testText || "这是一段示例文本，用来测试克隆音色").slice(0, 500),
    model: body.model || "speech-2.8-hd",
    language_boost: "auto",
    need_noise_reduction: true,
    need_volume_normalization: true,
  };
  const name = String(body.displayName || "我的克隆音色").trim().slice(0, 60);
  if (name) cloneBody.description = [name];
  const payload = await minimaxJson("v1/voice_clone", apiKey, cloneBody, 60000);
  return { id: voiceId, name, tag: "我的克隆音色", provider: "minimax", cloned: true, demoAudio: payload.demo_audio || null };
}

function originalTrack(value) {
  const normalized = String(value || "").trim().toLowerCase();
  return originalPromptLibrary.tracks.find((track) => (
    track.id.toLowerCase() === normalized || track.name === value
  )) || originalPromptLibrary.tracks.find((track) => track.id === "general");
}

function originalStyle(value, track) {
  const normalized = String(value || "").trim().toLowerCase();
  return originalPromptLibrary.styles.find((style) => (
    style.id.toLowerCase() === normalized || style.name === value
  )) || originalPromptLibrary.styles.find((style) => style.id === track?.defaultStyleId)
    || originalPromptLibrary.styles.find((style) => style.id === "realistic");
}

function composeOriginalImagePrompt(corePrompt, style, negativePrompt = "") {
  const positive = [style?.prefix, corePrompt, style?.suffix]
    .map((part) => String(part || "").trim())
    .filter(Boolean)
    .join("，");
  const negative = String(negativePrompt || "").trim();
  return `${positive}${negative ? `。画面中避免出现：${negative}` : ""}`.slice(0, 1500);
}

async function generateMinimaxImages(body) {
  const prompts = Array.isArray(body.prompts) ? body.prompts : [];
  if (prompts.length === 0) throw new Error("缺少绘图 prompt");
  const maxImages = Math.max(1, Math.min(18, Number(body.maxImages || prompts.length)));
  const aspectRatio = ["16:9", "9:16", "1:1", "4:3", "3:4"].includes(body.aspectRatio)
    ? body.aspectRatio
    : "9:16";
  const track = originalTrack(body.track);
  const style = originalStyle(body.visualStyle, track);
  let subjectReference = null;
  let generationTask = null;
  if (body.taskId) {
    generationTask = await taskStore.readTask(body.taskId);
    const reference = generationTask?.options?.referenceImage;
    if (reference?.path && existsSync(reference.path)) {
      const extension = extname(reference.path).toLowerCase();
      const mime = extension === ".png" ? "image/png" : "image/jpeg";
      const encoded = (await readFile(reference.path)).toString("base64");
      if (encoded.length < 14 * 1024 * 1024) {
        subjectReference = [{ type: "character", image_file: `data:${mime};base64,${encoded}` }];
      }
    }
  }
  const selectedPrompts = prompts.slice(0, maxImages);
  function coverBackgroundPrompt(value, shotId) {
    if (!body.coverBackgroundOnly || shotId < 9000 || generationTask?.options?.coverMode !== "titled") return value;
    const marker = /[，。；]?(?:整体按电影海报式排版|极简排版|情感海报排版|冲击式排版|国风题字排版|人物传奇式排版)[:：][\s\S]*$/u;
    const visualPrompt = String(value).replace(marker, "").replace(/。画面中避免出现[:：][\s\S]*$/u, "").trim();
    return `${visualPrompt}，只生成干净的封面视觉底图，中部构图简洁并预留标题区；画面中不得出现任何文字、字母、数字、水印、标志、招牌或乱码`;
  }
  async function finalizeCover(saved, shotId) {
    if (!saved || shotId < 9000 || generationTask?.options?.coverMode !== "titled") return saved;
    try {
      const rendered = await renderTitledCover({
        sourcePath: saved.path,
        title: generationTask.artifacts?.rewrite?.title || generationTask.title,
        subtitles: generationTask.artifacts?.rewrite?.subtitle || [],
      });
      return rendered ? { ...saved, bytes: rendered.bytes, width: rendered.width, height: rendered.height, sourceBackupPath: rendered.backupPath, textComposited: true } : saved;
    } catch (error) {
      console.warn("[cover] 精确标题合成失败，保留 AI 原图:", error);
      return saved;
    }
  }
  const images = await mapLimit(selectedPrompts, 3, async (item, index) => {
    const shotId = Number(item.shotId || index + 1);
    const prompt = coverBackgroundPrompt(String(item.prompt || "").trim(), shotId).slice(0, 1500);
    if (!prompt) throw new Error(`第 ${index + 1} 条 prompt 为空`);
    const retryPrompts = [
      prompt,
      composeOriginalImagePrompt(track?.fallbackScenes?.l2, style, style?.negativePrompt),
      composeOriginalImagePrompt(track?.fallbackScenes?.l3, style, style?.negativePrompt),
    ].filter(Boolean);
    let lastError;
    for (let attempt = 0; attempt < retryPrompts.length; attempt += 1) {
      const activePrompt = retryPrompts[attempt];
      try {
        const payload = await minimaxJson("v1/image_generation", body.apiKey, {
          model: "image-01",
          prompt: activePrompt,
          aspect_ratio: aspectRatio,
          response_format: "base64",
          n: 1,
          prompt_optimizer: true,
          ...(subjectReference ? { subject_reference: subjectReference } : {}),
          aigc_watermark: false,
        }, 180000);
        const base64 = payload.data?.image_base64?.[0];
        const imageUrl = payload.data?.image_urls?.[0];
        if (typeof base64 === "string" && base64) {
          let saved = body.taskId
            ? await taskStore.saveBuffer(body.taskId, "images", `${shotId}.jpg`, Buffer.from(base64, "base64"))
            : null;
          saved = await finalizeCover(saved, shotId);
          return {
            id: payload.id || `minimax-image-${Date.now()}-${index}`,
            shotId,
            prompt: activePrompt,
            retryLevel: attempt,
            url: saved?.url || `data:image/jpeg;base64,${base64}`,
            path: saved?.path,
            bytes: saved?.bytes || Math.round(base64.length * 0.75),
            status: "ready",
          };
        }
        if (typeof imageUrl === "string" && imageUrl) {
          let saved = body.taskId
            ? await taskStore.saveRemoteAsset(body.taskId, "images", `${shotId}.jpg`, imageUrl)
            : null;
          saved = await finalizeCover(saved, shotId);
          return {
            id: payload.id || `minimax-image-${Date.now()}-${index}`,
            shotId,
            prompt: activePrompt,
            retryLevel: attempt,
            url: saved?.url || imageUrl,
            path: saved?.path,
            bytes: saved?.bytes,
            status: "ready",
          };
        }
        throw new Error("MiniMax 未返回图片数据");
      } catch (error) {
        lastError = error;
      }
    }
    return {
      id: `failed-image-${Date.now()}-${index}`,
      shotId: Number(item.shotId || index + 1),
      prompt,
      retryLevel: retryPrompts.length - 1,
      url: "",
      status: "failed",
      error: `第 ${index + 1} 镜生图重试失败：${providerMessage(lastError, "MiniMax 生图失败")}`,
    };
  });
  return { images };
}

function parseJsonObject(text) {
  const raw = String(text || "").trim();
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1]?.trim();
  const source = fenced || raw;
  const start = source.indexOf("{");
  const end = source.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("LLM 未返回 JSON");
  const candidate = source.slice(start, end + 1);
  const repaired = candidate
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/([{,]\s*)([A-Za-z_$][\w$]*)(\s*:)/g, '$1"$2"$3')
    .replace(/,\s*([}\]])/g, "$1");
  let lastError;
  for (const value of [raw, candidate, repaired]) {
    try {
      return JSON.parse(value);
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError || new Error("LLM 未返回合法 JSON");
}

function clampString(value, fallback = "") {
  return String(value || fallback).trim();
}

async function probeMediaDuration(file) {
  for (const executable of ffprobeCandidates) {
    try {
      const { stdout } = await execFileAsync(executable, ["-v", "error", "-show_entries", "format=duration", "-of", "default=noprint_wrappers=1:nokey=1", file], { timeout: 15000, windowsHide: true });
      const duration = Number(String(stdout).trim());
      if (Number.isFinite(duration) && duration > 0) return Number(duration.toFixed(3));
    } catch {
      // Try the next local ffprobe location. Upload remains usable without probing.
    }
  }
  return undefined;
}

function normalizeCharacterCard(value) {
  if (!value || typeof value !== "object") return undefined;
  const card = {
    name: clampString(value.name || value.characterName || value.character),
    identity: clampString(value.identity || value.role),
    age: clampString(value.age || value.ageRange),
    gender: clampString(value.gender),
    appearance: clampString(value.appearance || value.face || value.look),
    clothing: clampString(value.clothing || value.costume || value.outfit),
  };
  if (!Object.values(card).some(Boolean)) return undefined;
  const feminine = /女/u.test(`${card.gender}${card.identity}`);
  const masculine = /男/u.test(`${card.gender}${card.identity}`);
  if (!card.age) card.age = "青年至中年";
  if (!card.appearance) {
    card.appearance = feminine
      ? "中长深色头发，椭圆脸，表情克制内敛，眼神含蓄深邃"
      : masculine
        ? "短深色头发，轮廓自然，表情克制内敛，眼神含蓄深邃"
        : "深色头发，五官自然，表情克制内敛，眼神含蓄深邃";
  }
  if (!card.clothing) card.clothing = "深色素雅服装；跨分镜保持同一脸型、发型、服装与年龄";
  return card;
}

function characterCardPrompt(card) {
  if (!card) return "";
  return [card.name, card.identity, card.age, card.gender, card.appearance, card.clothing]
    .map((part) => clampString(part))
    .filter(Boolean)
    .join("，");
}

function normalizePipelineResult(step, payload, context, artifacts) {
  const track = originalTrack(context.track);
  const style = originalStyle(context.visualStyle, track);
  if (step === "precheck") {
    const cleanText = clampString(payload.cleanText || payload.cleaned_text || payload.content, context.inputText).slice(0, 10000);
    return {
      step,
      data: {
        title: clampString(payload.title, context.title || cleanText.slice(0, 18)),
        cleanText,
        warnings: Array.isArray(payload.warnings) ? payload.warnings.map(String).slice(0, 12) : [],
        sensitiveTerms: Array.isArray(payload.sensitiveTerms || payload.sensitive_terms)
          ? (payload.sensitiveTerms || payload.sensitive_terms).map(String).slice(0, 16)
          : [],
      },
    };
  }
  if (step === "rewrite") {
    const source = artifacts.precheck?.cleanText || context.inputText;
    const narration = clampString(payload.narration || payload.rewrittenText || payload.content || payload.text, source).slice(0, 10000);
    const comments = Array.isArray(payload.comments) ? payload.comments.map(String).filter(Boolean).slice(0, 5) : [];
    const summary = clampString(payload.summary || payload.publishCopy || payload.publish_copy || payload.description, narration.slice(0, 240));
    return {
      step,
      data: {
        title: clampString(payload.title, artifacts.precheck?.title || context.title || narration.slice(0, 18)),
        subtitle: Array.isArray(payload.subtitle) ? payload.subtitle.map(String).filter(Boolean).slice(0, 2) : [],
        narration,
        publishCopy: summary,
        summary,
        tags: Array.isArray(payload.tags) ? payload.tags.map(String).slice(0, 10) : [track?.name].filter(Boolean),
        pinnedComment: clampString(payload.pinnedComment || payload.pinned_comment || payload.comment || comments[0], "你觉得这个故事最打动你的地方是什么？"),
        comments,
        ...(payload.scores && typeof payload.scores === "object" ? { scores: payload.scores } : {}),
        ...(Number.isFinite(Number(payload.totalScore || payload.total_score)) ? { totalScore: Number(payload.totalScore || payload.total_score) } : {}),
      },
    };
  }
  if (step === "storyboard") {
    const source = artifacts.rewrite?.narration || artifacts.precheck?.cleanText || context.inputText;
    const fallbackChars = context.ttsMode === "continuous" ? 28 : 45;
    const fallbackShots = splitText(source, fallbackChars).slice(0, 60).map((text, index) => ({
      id: index + 1,
      text,
      visual: track?.skeletonScenes?.[index % Math.max(1, track.skeletonScenes.length)] || "与字幕内容对应的可执行画面",
      emotion: "克制、自然",
      durationSec: Math.max(2, Math.min(12, Number((text.length / 4.2).toFixed(1)))),
    }));
    const suppliedShots = payload.shots || payload.sentences || payload.storyboard;
    const shots = Array.isArray(suppliedShots) && suppliedShots.length ? suppliedShots : fallbackShots;
    return {
      step,
      data: {
        shots: shots.flatMap((shot, index) => {
          const text = clampString(shot.text || shot.cap || shot.caption || shot.narration || shot.content, fallbackShots[index]?.text || source.slice(0, 55));
          const parts = splitText(text, 55);
          const suppliedDuration = Number(shot.durationSec || shot.duration_sec || shot.duration);
          const totalLength = Math.max(1, parts.reduce((sum, part) => sum + part.length, 0));
          return parts.map((part) => ({
            id: 0,
            text: part,
            visual: clampString(shot.visual || shot.desc_prompt || shot.scene || shot.prompt, fallbackShots[index]?.visual || "与字幕内容对应的可执行画面"),
            emotion: clampString(shot.emotion || shot.mood, "克制、自然"),
            durationSec: Math.max(2, Math.min(12, Number.isFinite(suppliedDuration) ? suppliedDuration * part.length / totalLength : part.length / 4.2)),
          }));
        }).slice(0, 60).map((shot, index) => ({ ...shot, id: index + 1 })),
        characterCard: track?.needsCharacterCard
          ? normalizeCharacterCard(payload.characterCard || payload.character_card || payload.character)
          : undefined,
      },
    };
  }
  const shots = artifacts.storyboard?.shots || [];
  const suppliedPrompts = payload.prompts || payload.sentences || payload.images;
  const prompts = Array.isArray(suppliedPrompts) ? suppliedPrompts : [];
  return {
    step: "prompts",
    data: {
      templateVersion: originalPromptLibrary.sourceVersion,
      trackId: track?.id || "general",
      styleId: style?.id || "realistic",
      prompts: shots.map((shot, index) => {
        const provided = prompts.find((item) => Number(item.shotId || item.id) === shot.id) || prompts[index] || {};
        const fixedCharacter = track?.needsCharacterCard ? characterCardPrompt(artifacts.storyboard?.characterCard) : "";
        const fallbackCore = `${shot.visual}，${shot.emotion}`;
        const suppliedCore = clampString(provided.prompt || provided.desc_prompt || provided.visual_prompt || provided.scene, fallbackCore);
        const narrativeCue = clampString(shot.text).replace(/\s+/g, " ").slice(0, 100);
        const semanticCore = narrativeCue && !suppliedCore.includes(narrativeCue.slice(0, 12))
          ? `${suppliedCore}。本镜叙事内容（仅用于转化成画面，禁止在图中生成文字）：${narrativeCue}`
          : suppliedCore;
        const corePrompt = fixedCharacter && !semanticCore.includes(fixedCharacter.slice(0, 12))
          ? `固定主角设定：${fixedCharacter}。当前画面：${semanticCore}`
          : semanticCore;
        const prefixMarker = clampString(style?.prefix).slice(0, 14);
        const negativePrompt = clampString(provided.negativePrompt || provided.negative_prompt, style?.negativePrompt);
        const positivePrompt = prefixMarker && corePrompt.includes(prefixMarker)
          ? corePrompt
          : composeOriginalImagePrompt(corePrompt, style);
        const prompt = composeOriginalImagePrompt(positivePrompt, undefined, negativePrompt);
        return {
          shotId: shot.id,
          prompt,
          negativePrompt,
        };
      }),
    },
  };
}

function pipelineContextPayload(context, artifacts) {
  const track = originalTrack(context.track);
  const style = originalStyle(context.visualStyle, track);
  const sourceText = artifacts.rewrite?.narration || artifacts.precheck?.cleanText || context.inputText;
  return {
    title: context.title,
    track: { id: track?.id, name: track?.name, needsCharacterCard: track?.needsCharacterCard },
    videoForm: context.videoForm,
    aspectRatio: context.aspectRatio || "9:16",
    style: {
      id: style?.id,
      name: style?.name,
      prefix: style?.prefix,
      suffix: style?.suffix,
      negativePrompt: style?.negativePrompt,
    },
    sourceText,
    precheck: artifacts.precheck,
    rewrite: artifacts.rewrite,
    storyboard: artifacts.storyboard,
    sourceMode: context.sourceMode || "paste",
    creationRequirements: {
      rewriteIntensity: context.rewriteIntensity,
      narrativePov: context.narrativePov,
      targetLength: context.targetLength,
      targetScenes: context.targetScenes,
      fixedIntro: context.fixedIntro,
      outroCta: context.outroCta,
      ttsMode: context.ttsMode,
    },
  };
}

function pipelineMessages(parts, contract, userPayload) {
  return [
    {
      role: "system",
      content: [
        `以下是 ${originalPromptLibrary.sourceVersion} 客户端内置的原版提示词。必须按其规则执行。`,
        "当前运行环境使用本地 REST 状态机代替原客户端工具回调；原提示词里的 submit/transfer 工具调用，在此阶段改为下面的严格 JSON 返回，其他规则保持不变。",
        ...parts.filter(Boolean),
        contract,
        "不要输出 Markdown、解释或思考过程。",
      ].join("\n\n"),
    },
    { role: "user", content: `请处理以下任务上下文：\n${JSON.stringify(userPayload)}` },
  ];
}

async function callLlmJson(config, messages, temperature, label) {
  let lastError;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const requestBody = {
      model: config.model,
      messages: attempt === 0 ? messages : [
        ...messages,
        { role: "user", content: "上一次输出无法解析。请重新执行，只返回使用双引号、属性名完整加引号、无尾逗号的严格 JSON。" },
      ],
      temperature: attempt === 0 ? temperature : 0.1,
      ...(config.provider === "minimax" ? { max_completion_tokens: 8192 } : { max_tokens: 8192, response_format: { type: "json_object" } }),
    };
    try {
      const response = await fetchWithTimeout(
        `${config.baseUrl}/chat/completions`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${config.apiKey}`, "Content-Type": "application/json" },
          body: JSON.stringify(requestBody),
        },
        180000,
      );
      const text = await response.text();
      if (!response.ok) {
        const httpError = new Error(`LLM HTTP ${response.status}: ${text.slice(0, 260)}`);
        if (response.status !== 429 && response.status < 500) throw httpError;
        lastError = httpError;
        continue;
      }
      const payload = parseJsonObject(text);
      const content = payload.choices?.[0]?.message?.content;
      if (!content) throw new Error("LLM 响应缺少 message.content");
      return parseJsonObject(content);
    } catch (error) {
      lastError = error;
    }
  }
  throw new Error(`${label}连续三次调用失败：${providerMessage(lastError, "解析失败")}`);
}

function splitShotsFromAnchors(sourceText, anchors, track) {
  const source = String(sourceText || "").replace(/[“”]/g, "");
  const cleanAnchors = Array.isArray(anchors) ? anchors.map((item) => String(item || "").replace(/[“”]/g, "").trim()).filter(Boolean) : [];
  if (!cleanAnchors.length) return [];
  let cursor = 0;
  const shots = [];
  for (const anchor of cleanAnchors) {
    const position = source.indexOf(anchor, cursor);
    if (position < cursor) return [];
    const end = position + anchor.length;
    const text = source.slice(cursor, end);
    if (!text.trim()) return [];
    for (const part of splitText(text, 55)) {
      shots.push({
        id: shots.length + 1,
        text: part,
        visual: track?.skeletonScenes?.[shots.length % Math.max(1, track?.skeletonScenes?.length || 1)] || "与字幕内容对应的可执行画面",
        emotion: "克制、自然",
        durationSec: Math.max(2, Math.min(12, Number((part.length / 4.2).toFixed(1)))),
      });
      if (shots.length >= 60) break;
    }
    cursor = end;
  }
  if (source.slice(cursor).trim()) return [];
  return shots;
}

async function runLlmPipeline(body) {
  const step = String(body.step || "");
  if (!["precheck", "rewrite", "storyboard", "prompts"].includes(step)) throw new Error("未知 LLM 流水线步骤");
  const config = await resolveLlmConfig(body.config);
  const context = body.context || {};
  if (!String(context.inputText || "").trim()) throw new Error("缺少文案内容");
  const artifacts = body.artifacts || {};
  const track = originalTrack(context.track);
  const base = pipelineContextPayload(context, artifacts);

  if (step === "precheck") {
    const payload = await callLlmJson(config, pipelineMessages(
      [originalPromptLibrary.precheckPrompt],
      `严格只返回 JSON：${JSON.stringify({ title: "", cleanText: "", warnings: [], sensitiveTerms: [] })}`,
      base,
    ), 0.25, "文案预审");
    return normalizePipelineResult(step, payload, context, artifacts);
  }

  if (step === "rewrite") {
    const rewritePayload = await callLlmJson(config, pipelineMessages(
      [originalPromptLibrary.writerAgentPrompt, track?.rewritePrompt],
      `只执行 WriterAgent 的改写与自评阶段，严格返回 JSON：${JSON.stringify({ narration: "完整改写正文", scores: { hook: 0, fluency: 0, empathy: 0, visual: 0, originality: 0, spoken: 0 }, totalScore: 0 })}`,
      base,
    ), 0.52, "WriterAgent 改写");
    const narration = clampString(rewritePayload.narration || rewritePayload.rewritten_text || rewritePayload.content, artifacts.precheck?.cleanText || context.inputText).slice(0, 10000);
    const metadataPayload = await callLlmJson(config, pipelineMessages(
      [track?.metadataPrompt],
      `只执行原版封面标题与发布元数据阶段，严格返回 JSON：${JSON.stringify({ title: "", subtitle: ["", ""], summary: "", tags: [], comments: ["", "", "", "", ""] })}`,
      { ...base, rewrittenText: narration },
    ), 0.48, "封面与发布元数据");
    return normalizePipelineResult(step, { ...metadataPayload, narration, scores: rewritePayload.scores, totalScore: rewritePayload.totalScore || rewritePayload.total_score }, context, artifacts);
  }

  if (step === "storyboard") {
    const source = artifacts.rewrite?.narration || artifacts.precheck?.cleanText || context.inputText;
    const splitPayload = await callLlmJson(config, pipelineMessages(
      [originalPromptLibrary.storyboardAgentPrompt, originalPromptLibrary.sentenceSplitPrompt, context.ttsMode === "continuous" ? tutorialStoryboardPrompt : ""],
      `当前只执行 StoryboardAgent 第一阶段。按原版尾部锚点法，严格返回 JSON：${JSON.stringify({ anchors: ["每个分镜在原文中的最后10-20个字符，最后一项覆盖全文末尾"] })}`,
      { ...base, sourceText: source },
    ), 0.2, "影视分镜锚点拆分");
    let shots = splitShotsFromAnchors(source, splitPayload.anchors || splitPayload.endAnchors || splitPayload.boundaries, track);
    if (!shots.length) {
      shots = splitText(String(source).replace(/[“”]/g, ""), context.ttsMode === "continuous" ? 28 : 45).slice(0, 60).map((text, index) => ({
        id: index + 1,
        text,
        visual: track?.skeletonScenes?.[index % Math.max(1, track?.skeletonScenes?.length || 1)] || "与字幕内容对应的可执行画面",
        emotion: "克制、自然",
        durationSec: Math.max(2, Math.min(12, Number((text.length / 4.2).toFixed(1)))),
      }));
    }
    let characterCard;
    if (track?.needsCharacterCard) {
      const cardPayload = await callLlmJson(config, pipelineMessages(
        [originalPromptLibrary.storyboardAgentPrompt, track?.imagePrompt],
        `当前只提取跨分镜人物一致性卡，严格返回 JSON：${JSON.stringify({ characterCard: { name: "", identity: "", age: "", gender: "", appearance: "", clothing: "" } })}`,
        { ...base, shots },
      ), 0.3, "人物一致性卡");
      characterCard = cardPayload.characterCard || cardPayload.character_card;
    }
    return normalizePipelineResult(step, { shots, characterCard }, context, artifacts);
  }

  const promptPayload = await callLlmJson(config, pipelineMessages(
    [originalPromptLibrary.storyboardAgentPrompt, track?.imagePrompt, context.ttsMode === "continuous" ? tutorialImagePrompt : "", originalPromptLibrary.producerAgentPrompt],
    `执行 StoryboardAgent 第二阶段并交接 ProducerAgent。严格返回 JSON：${JSON.stringify({ prompts: [{ shotId: 1, prompt: "只写画面主体、环境、动作、光影和构图", negativePrompt: "" }] })}。不得修改 shotId 与字幕；prompt 不要重复画风前后缀，系统会按原版逻辑统一拼接。`,
    base,
  ), 0.72, "原版绘图提示词");
  return normalizePipelineResult(step, promptPayload, context, artifacts);
}

async function createAiCopy(body) {
  const context = {
    ...(body.context || {}),
    sourceMode: "ai",
    inputText: String(body.context?.inputText || "").trim(),
  };
  if (context.inputText.length < 2) throw new Error("请先输入创作主题或关键词");
  const result = await runLlmPipeline({
    step: "rewrite",
    config: body.config,
    context,
    artifacts: {
      precheck: {
        title: context.title || "",
        cleanText: `这是从零创作任务，不是改写已有文章。请围绕以下主题和要求创作一篇完整、可直接口播的原创文案：\n${context.inputText}`,
        warnings: [],
        sensitiveTerms: [],
      },
    },
  });
  return result;
}

async function handleTtsApi(request, response, pathname) {
  if (pathname === "/api/tts/status" && request.method === "GET") {
    try {
      sendJson(response, 200, await getTtsStatus());
    } catch (error) {
      sendJson(response, 400, { error: providerMessage(error, "无法读取本地 TTS 凭据") });
    }
    return;
  }
  if (request.method !== "POST") {
    sendJson(response, 405, { error: "只支持 POST" });
    return;
  }
  try {
    const body = await readJson(request);
    if (pathname === "/api/tts/synthesize" || pathname === "/api/tts/test") {
      if (pathname.endsWith("/test")) body.text = "测";
      const result = await synthesize(body);
      const saved = body.taskId && !pathname.endsWith("/test")
        ? await taskStore.saveBuffer(
            body.taskId,
            "audio",
            body.fileName || `${Number(body.shotId || 0) || "full"}.mp3`,
            result.audio,
          )
        : null;
      const alignmentSaved = saved && result.alignment
        ? await taskStore.saveBuffer(
            body.taskId,
            "audio",
            `${saved.fileName.replace(/\.[^.]+$/u, "")}.timestamps.json`,
            Buffer.from(`${JSON.stringify(result.alignment, null, 2)}\n`, "utf8"),
          )
        : null;
      const durationSec = saved ? await probeMediaDuration(saved.path) || result.durationSec : result.durationSec;
      response.writeHead(200, {
        "Content-Type": "audio/mpeg",
        "Content-Length": result.audio.length,
        "X-TTS-Segments": String(result.segments),
        "X-TTS-Duration": String(durationSec),
        ...(saved ? {
          "X-Asset-Url": encodeURIComponent(saved.url),
          "X-Asset-Path": encodeURIComponent(saved.path),
          "X-Asset-File": encodeURIComponent(saved.fileName),
        } : {}),
        ...(alignmentSaved ? { "X-TTS-Alignment-Url": encodeURIComponent(alignmentSaved.url) } : {}),
        "Cache-Control": "no-store",
      });
      response.end(result.audio);
      return;
    }
    if (pathname === "/api/tts/minimax/voices") {
      sendJson(response, 200, { voices: await listMinimaxVoices(body) });
      return;
    }
    if (pathname === "/api/tts/minimax/clone") {
      sendJson(response, 200, { voice: await cloneMinimaxVoice(body) });
      return;
    }
    sendJson(response, 404, { error: "未知 TTS 接口" });
  } catch (error) {
    sendJson(response, 400, { error: providerMessage(error, "TTS 请求失败") });
  }
}

async function handleLlmApi(request, response, pathname) {
  if (pathname === "/api/llm/status" && request.method === "GET") {
    try {
      sendJson(response, 200, await getLlmStatus());
    } catch (error) {
      sendJson(response, 400, { error: providerMessage(error, "无法读取本地 LLM 凭据") });
    }
    return;
  }
  if (request.method !== "POST") {
    sendJson(response, 405, { error: "只支持 POST" });
    return;
  }
  try {
    const body = await readJson(request);
    if (pathname === "/api/llm/pipeline") {
      sendJson(response, 200, await runLlmPipeline(body));
      return;
    }
    if (pathname === "/api/llm/create") {
      sendJson(response, 200, await createAiCopy(body));
      return;
    }
    sendJson(response, 404, { error: "未知 LLM 接口" });
  } catch (error) {
    sendJson(response, 400, { error: providerMessage(error, "LLM 请求失败") });
  }
}

async function handleImageApi(request, response, pathname) {
  if (request.method !== "POST") {
    sendJson(response, 405, { error: "只支持 POST" });
    return;
  }
  try {
    const body = await readJson(request);
    if (pathname === "/api/images/minimax/generate") {
      sendJson(response, 200, await generateMinimaxImages(body));
      return;
    }
    sendJson(response, 404, { error: "未知图片接口" });
  } catch (error) {
    sendJson(response, 400, { error: providerMessage(error, "图片生成失败") });
  }
}

function streamFile(response, file, downloadName) {
  const type = mimeTypes[extname(file).toLowerCase()] || "application/octet-stream";
  response.writeHead(200, {
    "Content-Type": type,
    ...(downloadName ? { "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(downloadName)}` } : {}),
    "Cache-Control": "no-store",
  });
  createReadStream(file).pipe(response);
}

async function handleTaskApi(request, response, pathname) {
  const parts = pathname.split("/").filter(Boolean).map(decodeURIComponent);
  const taskId = parts[2];
  try {
    if (parts.length === 2) {
      if (request.method === "GET") {
        sendJson(response, 200, { tasks: await taskStore.listTasks(), dataRoot: taskStore.dataRoot });
        return;
      }
      if (request.method === "POST") {
        sendJson(response, 201, { task: await taskStore.createTask(await readJson(request)) });
        return;
      }
    }
    if (!taskId) {
      sendJson(response, 404, { error: "任务不存在" });
      return;
    }
    if (parts.length === 3) {
      if (request.method === "GET") {
        const task = await taskStore.readTask(taskId);
        sendJson(response, task ? 200 : 404, task ? { task } : { error: "任务不存在" });
        return;
      }
      if (request.method === "PATCH") {
        sendJson(response, 200, { task: await taskStore.updateTask(taskId, await readJson(request)) });
        return;
      }
      if (request.method === "DELETE") {
        await taskStore.deleteTask(taskId);
        sendJson(response, 200, { ok: true });
        return;
      }
    }
    if (parts[3] === "events") {
      if (request.method === "GET") {
        sendJson(response, 200, { events: await taskStore.readEvents(taskId) });
        return;
      }
      if (request.method === "POST") {
        sendJson(response, 201, { event: await taskStore.appendEvent(taskId, await readJson(request)) });
        return;
      }
    }
    if (parts[3] === "assets" && request.method === "POST") {
      const body = await readJson(request);
      const buffer = Buffer.from(String(body.base64 || ""), "base64");
      if (!buffer.length) throw new Error("上传资源为空");
      const asset = await taskStore.saveBuffer(taskId, body.kind || "uploads", body.fileName, buffer);
      const durationSec = ["audio", "videos"].includes(body.kind) ? await probeMediaDuration(asset.path) : undefined;
      sendJson(response, 201, { asset: durationSec ? { ...asset, durationSec } : asset });
      return;
    }
    if (parts[3] === "files" && parts.length >= 6 && request.method === "GET") {
      const file = taskStore.resolveTaskFile(taskId, parts[4], parts.slice(5).join("-"));
      if (!file || !existsSync(file)) {
        sendJson(response, 404, { error: "资源不存在" });
        return;
      }
      streamFile(response, file);
      return;
    }
    if (parts[3] === "clear-from-step" && request.method === "POST") {
      const body = await readJson(request);
      sendJson(response, 200, { task: await taskStore.clearFromStep(taskId, body.step) });
      return;
    }
    if (parts[3] === "draft" && request.method === "POST") {
      const task = await taskStore.readTask(taskId);
      if (!task) throw new Error("任务不存在");
      const draft = await buildJianyingDraft(taskStore, task);
      const updated = await taskStore.updateTask(taskId, {
        draft,
        status: "completed",
        runState: "completed",
        currentStep: 6,
        stepStatuses: task.stepStatuses.map((status, index) => index === 6 ? "done" : status),
        error: null,
      });
      await taskStore.appendEvent(taskId, { type: "step_complete", step: 6, detail: "剪映草稿已生成", data: draft });
      sendJson(response, 200, { task: updated, draft });
      return;
    }
    if (parts[3] === "draft.zip" && request.method === "GET") {
      const task = await taskStore.readTask(taskId);
      if (!task?.draft?.zipPath || !existsSync(task.draft.zipPath)) {
        sendJson(response, 404, { error: "草稿压缩包不存在，请先重新打包" });
        return;
      }
      streamFile(response, task.draft.zipPath, `${task.draft.projectName || "Storybound草稿"}.zip`);
      return;
    }
    sendJson(response, 404, { error: "未知任务接口" });
  } catch (error) {
    sendJson(response, 400, { error: providerMessage(error, "任务操作失败") });
  }
}

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav",
  ".mp4": "video/mp4",
  ".mov": "video/quicktime",
  ".webm": "video/webm",
  ".zip": "application/zip",
  ".srt": "application/x-subrip; charset=utf-8",
};

async function serveProduction(response, pathname) {
  const dist = resolve(root, "dist");
  const relative = pathname === "/" ? "index.html" : normalize(decodeURIComponent(pathname)).replace(/^[/\\]+/, "");
  let file = resolve(dist, relative);
  if (!file.startsWith(dist) || !existsSync(file) || !(await stat(file)).isFile()) file = join(dist, "index.html");
  response.writeHead(200, { "Content-Type": mimeTypes[extname(file)] || "application/octet-stream" });
  createReadStream(file).pipe(response);
}

function authorizePublicTunnel(request, response, url) {
  const host = String(request.headers.host || "").split(":")[0].toLowerCase();
  if (!host.endsWith(".trycloudflare.com") || !publicAccessToken) return false;
  const cookies = Object.fromEntries(String(request.headers.cookie || "").split(";").map((item) => item.trim().split("=")).filter(([key, value]) => key && value));
  const queryToken = url.searchParams.get("access") || "";
  const bearerToken = String(request.headers.authorization || "").replace(/^Bearer\s+/i, "");
  if (queryToken === publicAccessToken) {
    url.searchParams.delete("access");
    const search = url.searchParams.toString();
    response.writeHead(302, {
      "Set-Cookie": `storybound_access=${encodeURIComponent(publicAccessToken)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=86400`,
      Location: `${url.pathname}${search ? `?${search}` : ""}`,
      "Cache-Control": "no-store",
    });
    response.end();
    return true;
  }
  if (decodeURIComponent(cookies.storybound_access || "") === publicAccessToken || bearerToken === publicAccessToken) return false;
  response.writeHead(401, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" });
  response.end("<!doctype html><html lang=\"zh-CN\"><meta charset=\"utf-8\"><title>需要访问链接</title><body style=\"font-family:system-ui;background:#090d10;color:#e8f0ee;display:grid;place-items:center;min-height:100vh;margin:0\"><main><h1>此检查地址需要访问令牌</h1><p>请使用 Codex 提供的完整链接重新打开。</p></main></body></html>");
  return true;
}

const vite = production
  ? null
  : await (await import("vite")).createServer({ root, server: { middlewareMode: true }, appType: "spa" });

const server = createServer(async (request, response) => {
  const url = new URL(request.url || "/", `http://${request.headers.host || "127.0.0.1"}`);
  if (authorizePublicTunnel(request, response, url)) return;
  const pathname = url.pathname;
  if (pathname.startsWith("/api/tts/")) {
    await handleTtsApi(request, response, pathname);
    return;
  }
  if (pathname.startsWith("/api/llm/")) {
    await handleLlmApi(request, response, pathname);
    return;
  }
  if (pathname.startsWith("/api/images/")) {
    await handleImageApi(request, response, pathname);
    return;
  }
  if (pathname === "/api/tasks" || pathname.startsWith("/api/tasks/")) {
    await handleTaskApi(request, response, pathname);
    return;
  }
  if (vite) {
    vite.middlewares(request, response, () => {
      sendJson(response, 404, { error: "页面不存在" });
    });
    return;
  }
  try {
    await serveProduction(response, pathname);
  } catch {
    sendJson(response, 500, { error: "无法读取构建产物" });
  }
});

server.listen(port, "127.0.0.1", () => {
  process.stdout.write(`Storybound clone: http://127.0.0.1:${port}\n`);
});
