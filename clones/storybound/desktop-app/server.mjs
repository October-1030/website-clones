import { createReadStream, existsSync } from "node:fs";
import { readFile, stat } from "node:fs/promises";
import { createServer } from "node:http";
import { basename, dirname, extname, join, normalize, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));
const production = process.argv.includes("--production");
const port = Number(process.env.PORT || 5173);
const maxJsonBytes = 24 * 1024 * 1024;
const volcengineEndpoint = "https://openspeech.bytedance.com/api/v3/tts/unidirectional";
const minimaxBase = "https://api.minimaxi.com";
const llmProviderDefaults = {
  openai: { baseUrl: "https://api.openai.com/v1", model: "gpt-4.1-mini" },
  deepseek: { baseUrl: "https://api.deepseek.com/v1", model: "deepseek-chat" },
  siliconflow: { baseUrl: "https://api.siliconflow.cn/v1", model: "Qwen/Qwen3-32B" },
  custom: { baseUrl: "", model: "" },
};
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
  return Object.hasOwn(llmProviderDefaults, provider) ? provider : "deepseek";
}

async function findLocalLlmCredential() {
  const envApiKey = process.env.STORYBOUND_LLM_API_KEY
    || process.env.LLM_API_KEY
    || process.env.DEEPSEEK_API_KEY
    || process.env.OPENAI_API_KEY
    || process.env.SILICONFLOW_API_KEY;
  if (envApiKey) {
    const provider = normalizeLlmProvider(process.env.STORYBOUND_LLM_PROVIDER || (process.env.OPENAI_API_KEY ? "openai" : "deepseek"));
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
        || values.DEEPSEEK_API_KEY
        || values.OPENAI_API_KEY
        || values.SILICONFLOW_API_KEY;
      if (!apiKey) continue;
      const provider = normalizeLlmProvider(values.STORYBOUND_LLM_PROVIDER || values.LLM_PROVIDER || (values.OPENAI_API_KEY ? "openai" : "deepseek"));
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
  return null;
}

async function getLlmStatus() {
  const local = await findLocalLlmCredential();
  return {
    available: Boolean(local),
    source: local?.source || null,
    provider: local?.provider || null,
    baseUrl: local?.baseUrl || null,
    model: local?.model || null,
  };
}

async function resolveLlmConfig(input) {
  const provider = normalizeLlmProvider(input?.provider);
  const defaults = llmProviderDefaults[provider];
  const local = await findLocalLlmCredential();
  const apiKey = String(input?.apiKey || "").trim() || local?.apiKey;
  const baseUrl = String(input?.baseUrl || "").trim() || local?.baseUrl || defaults.baseUrl;
  const model = String(input?.model || "").trim() || local?.model || defaults.model;
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

async function synthesizeMinimax(text, voiceId, speed, config) {
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
    output_format: "hex",
  });
  const hex = payload.data?.audio;
  if (!hex || typeof hex !== "string") throw new Error("MiniMax 响应缺少 audio 字段");
  return Buffer.from(hex, "hex");
}

async function synthesize(body) {
  const provider = body.provider;
  const text = String(body.text || "").trim();
  const voiceId = String(body.voiceId || "").trim();
  if (!text) throw new Error("请输入配音文本");
  if (text.length > 10000) throw new Error("配音文本最多 10000 字");
  if (!voiceId) throw new Error("请选择配音员");
  const maxLength = provider === "minimax" ? 2000 : 500;
  const parts = splitText(text, maxLength);
  const buffers = await mapLimit(parts, 3, (part) =>
    provider === "minimax"
      ? synthesizeMinimax(part, voiceId, body.speed, body.config)
      : synthesizeVolcengine(part, voiceId, body.speed, body.config),
  );
  return { audio: Buffer.concat(buffers), segments: parts.length };
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

function parseJsonObject(text) {
  const raw = String(text || "").trim();
  try {
    return JSON.parse(raw);
  } catch {
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("LLM 未返回 JSON");
    return JSON.parse(match[0]);
  }
}

function clampString(value, fallback = "") {
  return String(value || fallback).trim();
}

function normalizePipelineResult(step, payload, context, artifacts) {
  if (step === "precheck") {
    const cleanText = clampString(payload.cleanText, context.inputText).slice(0, 8000);
    return {
      step,
      data: {
        title: clampString(payload.title, context.title || cleanText.slice(0, 18)),
        cleanText,
        warnings: Array.isArray(payload.warnings) ? payload.warnings.map(String).slice(0, 8) : [],
        sensitiveTerms: Array.isArray(payload.sensitiveTerms) ? payload.sensitiveTerms.map(String).slice(0, 12) : [],
      },
    };
  }
  if (step === "rewrite") {
    const source = artifacts.precheck?.cleanText || context.inputText;
    const narration = clampString(payload.narration, source).slice(0, 8000);
    return {
      step,
      data: {
        title: clampString(payload.title, artifacts.precheck?.title || context.title || narration.slice(0, 18)),
        narration,
        publishCopy: clampString(payload.publishCopy, narration.slice(0, 240)),
        tags: Array.isArray(payload.tags) ? payload.tags.map(String).slice(0, 8) : [context.track].filter(Boolean),
        pinnedComment: clampString(payload.pinnedComment, "你觉得这个故事最打动你的地方是什么？"),
      },
    };
  }
  if (step === "storyboard") {
    const source = artifacts.rewrite?.narration || artifacts.precheck?.cleanText || context.inputText;
    const fallbackShots = splitText(source, 85).slice(0, 12).map((text, index) => ({
      id: index + 1,
      text,
      visual: "电影感人物叙事画面",
      emotion: "克制、有悬念",
      durationSec: Math.max(3, Math.min(8, Math.round(text.length / 12))),
    }));
    const shots = Array.isArray(payload.shots) ? payload.shots : fallbackShots;
    return {
      step,
      data: {
        shots: shots.slice(0, 18).map((shot, index) => ({
          id: Number(shot.id || index + 1),
          text: clampString(shot.text, fallbackShots[index]?.text || source.slice(0, 80)),
          visual: clampString(shot.visual, "电影感人物叙事画面"),
          emotion: clampString(shot.emotion, "克制、有悬念"),
          durationSec: Math.max(2, Math.min(12, Number(shot.durationSec || 5))),
        })),
      },
    };
  }
  const shots = artifacts.storyboard?.shots || [];
  const prompts = Array.isArray(payload.prompts) ? payload.prompts : [];
  return {
    step: "prompts",
    data: {
      prompts: shots.map((shot, index) => {
        const provided = prompts.find((item) => Number(item.shotId) === shot.id) || prompts[index] || {};
        return {
          shotId: shot.id,
          prompt: clampString(provided.prompt, `${context.visualStyle}，${shot.visual}，${shot.emotion}，电影光影，细节丰富`),
          negativePrompt: clampString(provided.negativePrompt, "低清晰度，畸形手指，文字水印，过曝，模糊"),
        };
      }),
    },
  };
}

function buildPipelineMessages(step, context, artifacts) {
  const system = [
    "你是短视频生产流水线的编导和提示词工程师。",
    "只返回合法 JSON，不要输出 Markdown，不要解释。",
    "内容面向中文短视频，要求节奏清楚、画面可执行、口播自然。",
  ].join("\n");
  const base = {
    title: context.title,
    track: context.track,
    videoForm: context.videoForm,
    visualStyle: context.visualStyle,
    inputText: context.inputText,
    artifacts,
  };
  const instructions = {
    precheck: "清理输入文案中的广告、明显口误、重复空白和不适合配音的符号。返回 {title, cleanText, warnings, sensitiveTerms}。",
    rewrite: "把 cleanText 改写成适合 60 秒内短视频的中文旁白，保留核心故事张力。返回 {title, narration, publishCopy, tags, pinnedComment}。",
    storyboard: "把 narration 拆成 6 到 12 个可配图镜头。每镜头文本应适合 TTS。返回 {shots:[{id,text,visual,emotion,durationSec}]}。",
    prompts: "根据 storyboard 为每个镜头写中文绘图 prompt，风格必须遵守 visualStyle。返回 {prompts:[{shotId,prompt,negativePrompt}]}。",
  };
  return [
    { role: "system", content: system },
    { role: "user", content: `${instructions[step]}\n\n上下文 JSON：\n${JSON.stringify(base)}` },
  ];
}

async function runLlmPipeline(body) {
  const step = String(body.step || "");
  if (!["precheck", "rewrite", "storyboard", "prompts"].includes(step)) throw new Error("未知 LLM 流水线步骤");
  const config = await resolveLlmConfig(body.config);
  const context = body.context || {};
  if (!String(context.inputText || "").trim()) throw new Error("缺少文案内容");
  const artifacts = body.artifacts || {};
  const response = await fetchWithTimeout(
    `${config.baseUrl}/chat/completions`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${config.apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: config.model,
        messages: buildPipelineMessages(step, context, artifacts),
        temperature: step === "prompts" ? 0.8 : 0.55,
        response_format: { type: "json_object" },
      }),
    },
    120000,
  );
  const text = await response.text();
  if (!response.ok) throw new Error(`LLM HTTP ${response.status}: ${text.slice(0, 260)}`);
  const payload = parseJsonObject(text);
  const content = payload.choices?.[0]?.message?.content;
  if (!content) throw new Error("LLM 响应缺少 message.content");
  return normalizePipelineResult(step, parseJsonObject(content), context, artifacts);
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
      response.writeHead(200, {
        "Content-Type": "audio/mpeg",
        "Content-Length": result.audio.length,
        "X-TTS-Segments": String(result.segments),
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
    sendJson(response, 404, { error: "未知 LLM 接口" });
  } catch (error) {
    sendJson(response, 400, { error: providerMessage(error, "LLM 请求失败") });
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
};

async function serveProduction(response, pathname) {
  const dist = resolve(root, "dist");
  const relative = pathname === "/" ? "index.html" : normalize(decodeURIComponent(pathname)).replace(/^[/\\]+/, "");
  let file = resolve(dist, relative);
  if (!file.startsWith(dist) || !existsSync(file) || !(await stat(file)).isFile()) file = join(dist, "index.html");
  response.writeHead(200, { "Content-Type": mimeTypes[extname(file)] || "application/octet-stream" });
  createReadStream(file).pipe(response);
}

const vite = production
  ? null
  : await (await import("vite")).createServer({ root, server: { middlewareMode: true }, appType: "spa" });

const server = createServer(async (request, response) => {
  const pathname = new URL(request.url || "/", `http://${request.headers.host || "127.0.0.1"}`).pathname;
  if (pathname.startsWith("/api/tts/")) {
    await handleTtsApi(request, response, pathname);
    return;
  }
  if (pathname.startsWith("/api/llm/")) {
    await handleLlmApi(request, response, pathname);
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
