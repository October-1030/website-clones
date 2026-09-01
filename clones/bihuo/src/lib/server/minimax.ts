import "server-only";

import { MAX_HISTORY_CHARS, MAX_HISTORY_MESSAGES, MAX_MESSAGE_CHARS, type ChatMessage, type ChatReply } from "@/lib/chat";

const supportedModels = new Set(["MiniMax-M2", "MiniMax-M2.1", "MiniMax-M2.1-highspeed", "MiniMax-M2.5", "MiniMax-M2.5-highspeed", "MiniMax-M2.7", "MiniMax-M2.7-highspeed", "MiniMax-M3"]);
const maxBodyBytes = 96 * 1024;
const systemPrompt = `你是必火 GEO 工作台的中文 AI 助手，由 MiniMax 提供文本能力。
你可以协助用户制定 GEO 内容计划、拓展搜索问题、起草营销文章，并解释工作台的操作流程：准备公司和知识库、创作内容、发布分发、验证收录。
这个站点可以在单次请求中把用户选择的本机公司、GEO 项目、知识资料、问题和统计文本提供给你。只能使用请求中明确给出的资料，不得假定你能读取浏览器本地存储或其他页面。
你没有联网搜索、浏览器、第三方平台、支付、短信、数据库或发布工具，不能查询实际收录，也不能授权账号、向媒体发布内容、发送短信或扣费。不得声称已经执行这些操作，不能编造查询结果、公司资料、案例或业绩。
如果资料不足，指出缺口，或明确标记示例和待填写内容。回答清楚、简洁，优先中文。不输出内部思考过程。`;

export class ChatError extends Error {
  constructor(public readonly status: number, public readonly code: string, message: string) {
    super(message);
    this.name = "ChatError";
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function assertLocalRequest(request: Request) {
  const localHosts = new Set(["localhost", "127.0.0.1", "[::1]"]);
  try {
    const url = new URL(request.url);
    const host = new URL(`${url.protocol}//${request.headers.get("host") || url.host}`);
    if (!localHosts.has(url.hostname) || !localHosts.has(host.hostname) || host.username || host.password) throw new Error();
    const origin = request.headers.get("origin");
    if (origin && new URL(origin).origin !== host.origin) throw new Error();
    if (request.headers.get("sec-fetch-site") === "cross-site") throw new Error();
  } catch {
    throw new ChatError(403, "LOCAL_ONLY", "此 AI 接口仅允许本机同源访问，未开放公网调用。");
  }
}

export function getMiniMaxConfig() {
  const apiKey = process.env.MINIMAX_API_KEY?.trim();
  const model = process.env.MINIMAX_MODEL?.trim() || "MiniMax-M3";
  if (!apiKey || apiKey === "replace_with_your_minimax_key") throw new ChatError(503, "NOT_CONFIGURED", "尚未配置 MiniMax 服务端密钥。");
  let base: URL;
  try {
    base = new URL(process.env.MINIMAX_BASE_URL || "https://api.minimaxi.com/v1");
    if (base.protocol !== "https:" || !["api.minimaxi.com", "api.minimax.io"].includes(base.hostname) || base.pathname.replace(/\/$/, "") !== "/v1" || base.username || base.password || base.search || base.hash || base.port || !supportedModels.has(model)) throw new Error();
  } catch {
    throw new ChatError(503, "INVALID_CONFIG", "MiniMax 地址或模型配置不正确，请检查服务端环境变量。");
  }
  return { apiKey, model, endpoint: `${base.href.replace(/\/$/, "")}/chat/completions` };
}

export async function readMessages(request: Request): Promise<ChatMessage[]> {
  if (request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "application/json") throw new ChatError(415, "JSON_REQUIRED", "请求必须使用 application/json。");
  if (Number(request.headers.get("content-length")) > maxBodyBytes) throw new ChatError(413, "BODY_TOO_LARGE", "请求内容过长，请缩短对话。");
  const reader = request.body?.getReader();
  if (!reader) throw new ChatError(400, "INVALID_BODY", "缺少对话内容。");
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > maxBodyBytes) {
        await reader.cancel();
        throw new ChatError(413, "BODY_TOO_LARGE", "请求内容过长，请缩短对话。");
      }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }

  let payload: unknown;
  try { payload = JSON.parse(Buffer.concat(chunks).toString("utf8")); }
  catch { throw new ChatError(400, "INVALID_JSON", "请求不是有效的 JSON。"); }
  if (!isRecord(payload) || !Array.isArray(payload.messages) || payload.messages.length < 1 || payload.messages.length > MAX_HISTORY_MESSAGES) throw new ChatError(400, "INVALID_MESSAGES", "请提供有效的对话记录。");

  let total = 0;
  const messages = payload.messages.map((message): ChatMessage => {
    if (!isRecord(message) || (message.role !== "user" && message.role !== "assistant") || typeof message.content !== "string") throw new ChatError(400, "INVALID_MESSAGE", "消息只能包含 user 或 assistant 文本。");
    const content = message.content.trim();
    const limit = message.role === "user" ? MAX_MESSAGE_CHARS : 12000;
    if (!content || content.length > limit) throw new ChatError(400, "MESSAGE_TOO_LONG", `单条输入不能超过 ${MAX_MESSAGE_CHARS} 个字符，且不能为空。`);
    total += content.length;
    return { role: message.role, content };
  });
  if (total > MAX_HISTORY_CHARS) throw new ChatError(400, "HISTORY_TOO_LONG", "对话内容过长，请开始一段新对话。");
  if (messages.at(-1)?.role !== "user") throw new ChatError(400, "USER_MESSAGE_REQUIRED", "最后一条消息必须来自用户。");
  return messages;
}

// A single local user: one in-flight generation and at most 8 attempts per minute.
let busy = false;
const attempts: number[] = [];
export function acquireGeneration(): () => void {
  const now = Date.now();
  while (attempts.length && attempts[0] <= now - 60000) attempts.shift();
  if (busy) throw new ChatError(429, "GENERATION_BUSY", "已有回复正在生成，请等待或停止后再发送。");
  if (attempts.length >= 8) throw new ChatError(429, "RATE_LIMITED", "请求过于频繁，每分钟最多 8 次，请稍后再试。");
  attempts.push(now);
  busy = true;
  return () => { busy = false; };
}

export async function generateReply(messages: ChatMessage[], signal: AbortSignal): Promise<ChatReply> {
  const config = getMiniMaxConfig();
  let response: Response;
  let payload: unknown;
  try {
    response = await fetch(config.endpoint, {
      method: "POST",
      redirect: "error",
      cache: "no-store",
      headers: { Authorization: `Bearer ${config.apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: config.model, messages: [{ role: "system", content: systemPrompt }, ...messages], max_tokens: 2048, temperature: 0.7, reasoning_split: true, stream: false }),
      signal: AbortSignal.any([signal, AbortSignal.timeout(55000)]),
    });
    payload = await response.json();
  } catch {
    if (signal.aborted) throw new ChatError(499, "CANCELLED", "已停止生成。");
    throw new ChatError(502, "PROVIDER_UNREACHABLE", "MiniMax 连接失败或超时，请稍后再试。");
  }

  const baseResponse = isRecord(payload) && isRecord(payload.base_resp) ? payload.base_resp : null;
  const providerCode = baseResponse?.status_code;
  if (!response.ok || (typeof providerCode === "number" && providerCode !== 0) || (isRecord(payload) && payload.error)) {
    if ([401, 403].includes(response.status) || providerCode === 1004) throw new ChatError(502, "PROVIDER_AUTH", "MiniMax 密钥无效或无模型权限，请检查服务端配置。");
    if (response.status === 429 || [1002, 1008, 1010].includes(Number(providerCode))) throw new ChatError(429, "PROVIDER_QUOTA", "MiniMax 当前额度不足或触发限流，请检查订阅额度并稍后再试。");
    throw new ChatError(502, "PROVIDER_ERROR", "MiniMax 暂时无法完成这次请求，请稍后重试。");
  }

  const choice = isRecord(payload) && Array.isArray(payload.choices) ? payload.choices[0] : null;
  const message = isRecord(choice) && isRecord(choice.message) ? choice.message : null;
  if (typeof message?.content !== "string") throw new ChatError(502, "EMPTY_REPLY", "MiniMax 没有返回有效文本，请缩短问题后再试。");
  const reply = message.content.replace(/<think>[\s\S]*?<\/think>/g, "").replace(/<think>[\s\S]*$/g, "").trim();
  if (!reply) throw new ChatError(502, "EMPTY_REPLY", "MiniMax 没有返回有效文本，请缩短问题后再试。");
  const usage = isRecord(payload) && isRecord(payload.usage) ? payload.usage : null;
  const usageValues = usage ? [usage.prompt_tokens, usage.completion_tokens, usage.total_tokens] : [];
  const safeUsage = usageValues.length === 3 && usageValues.every((value) => typeof value === "number" && Number.isFinite(value) && value >= 0) ? { promptTokens: usageValues[0] as number, completionTokens: usageValues[1] as number, totalTokens: usageValues[2] as number } : undefined;
  return { reply: reply.slice(0, 12000), model: config.model, usage: safeUsage };
}
