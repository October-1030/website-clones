// One short, billable connectivity check. Never prints the API key or reasoning.
import { existsSync } from "node:fs";

if (existsSync(".env.local")) process.loadEnvFile(".env.local");
const base = new URL(process.env.MINIMAX_BASE_URL || "https://api.minimaxi.com/v1");
if (base.protocol !== "https:" || !["api.minimaxi.com", "api.minimax.io"].includes(base.hostname) || base.pathname.replace(/\/$/, "") !== "/v1" || base.username || base.password || base.search || base.hash || base.port) {
  throw new Error("MiniMax endpoint must be an official HTTPS /v1 endpoint.");
}
const key = process.env.MINIMAX_API_KEY;
if (!key) throw new Error("MINIMAX_API_KEY is missing from server configuration.");
const started = Date.now();
try {
  const response = await fetch(`${base.href.replace(/\/$/, "")}/chat/completions`, {
    method: "POST",
    redirect: "error",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model: process.env.MINIMAX_MODEL || "MiniMax-M2.5",
      messages: [{ role: "user", content: "请只回复：MiniMax连接成功。" }],
      max_tokens: 256,
      temperature: 0.2,
      reasoning_split: true,
      stream: false,
    }),
    signal: AbortSignal.timeout(45000),
  });
  const payload = await response.json();
  const reply = payload.choices?.[0]?.message?.content;
  const report = {
    httpStatus: response.status,
    providerCode: payload.base_resp?.status_code,
    providerErrorType: payload.error?.type,
    model: payload.model,
    reply: typeof reply === "string" ? reply.replaceAll(key, "[redacted]").replace(/<think>[\s\S]*?<\/think>/g, "").trim().slice(0, 150) : null,
    usage: payload.usage ? { promptTokens: payload.usage.prompt_tokens, completionTokens: payload.usage.completion_tokens, totalTokens: payload.usage.total_tokens } : null,
    elapsedMs: Date.now() - started,
  };
  console.log(JSON.stringify(report, null, 2));
  if (!response.ok || (payload.base_resp?.status_code ?? 0) !== 0 || !reply) process.exitCode = 1;
} catch (error) {
  console.log(JSON.stringify({ networkError: error.name, causeCode: error.cause?.code, elapsedMs: Date.now() - started }));
  process.exitCode = 1;
}
