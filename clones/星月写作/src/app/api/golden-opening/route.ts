import { buildOpeningPrompt, buildToolPrompt, buildWritingSystemPrompt, validateOpening } from "@/lib/golden-opening";
import { readSseData } from "@/lib/chat-stream";

export const runtime = "nodejs";
export const maxDuration = 180;

function serverConfig() {
  return {
    key: process.env.WRITING_API_KEY?.trim() || "",
    model: process.env.WRITING_MODEL?.trim() || "deepseek-v4-flash",
    baseUrl: process.env.WRITING_BASE_URL?.trim() || "https://api.deepseek.com",
  };
}

export async function GET() {
  const config = serverConfig();
  return Response.json({ configured: Boolean(config.key), model: config.key ? config.model : null }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  const jsonError = (error: string, status = 400) => Response.json({ error }, { status });
  const origin = request.headers.get("origin");
  // Next can use the bind address (0.0.0.0) in request.url. The Host header
  // identifies the address actually requested by the browser (e.g. localhost).
  const publicUrl = new URL(request.url);
  const host = request.headers.get("host");
  if (host) publicUrl.host = host;
  if (origin && origin !== publicUrl.origin) return jsonError("请求来源不匹配，请刷新后重试。", 403);

  let payload: Record<string, unknown>;
  let prompt: string;
  let words: number;
  let systemPrompt: string;
  let task: "opening" | "tool" = "opening";
  try {
    // Bound the streamed body too; Content-Length is not always present.
    const reader = request.body?.getReader();
    if (!reader) return jsonError("请填写故事设定。");
    const decoder = new TextDecoder();
    let size = 0;
    let raw = "";
    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > 160_000) { await reader.cancel(); return jsonError("提交内容过长。", 413); }
        raw += decoder.decode(value, { stream: true });
      }
      raw += decoder.decode();
    } finally { reader.releaseLock(); }
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return jsonError("提交格式有误。");
    payload = parsed as Record<string, unknown>;
    if (payload.task !== undefined && payload.task !== "opening" && payload.task !== "tool") return jsonError("请选择有效的创作任务。");
    task = payload.task === "tool" ? "tool" : "opening";
    const input = validateOpening(payload.input);
    if (task === "tool" && !input.useCustom) return jsonError("请填写工具任务要求。");
    prompt = task === "tool" ? buildToolPrompt(input) : buildOpeningPrompt(input);
    words = input.words;
    systemPrompt = buildWritingSystemPrompt(task, input.language);
  } catch (error) {
    return jsonError(error instanceof SyntaxError ? "提交格式有误。" : error instanceof Error ? error.message : "请检查故事设定。");
  }

  // A browser-supplied key is sent only to the fixed DeepSeek endpoint.
  // The server key's host and model can only be configured on the server.
  let config = serverConfig();
  if (payload.connection === "deepseek") {
    if (typeof payload.apiKey !== "string" || !payload.apiKey.trim() || payload.apiKey.length > 512 || /[\r\n]/.test(payload.apiKey)) return jsonError("请在模型设置中填写有效的 API Key。");
    const model = payload.model;
    if (model !== "deepseek-v4-flash" && model !== "deepseek-v4-pro") return jsonError("请选择有效的 DeepSeek 模型。");
    config = { key: payload.apiKey.trim(), model, baseUrl: "https://api.deepseek.com" };
  } else if (payload.connection !== "server") {
    return jsonError("请选择模型连接方式。");
  }
  if (!config.key) return jsonError("尚未配置模型。请打开模型设置，填写 DeepSeek API Key 后再生成。", 503);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 175_000);
  const signal = AbortSignal.any([request.signal, controller.signal]);
  let upstream: Response;
  try {
    const endpoint = new URL(`${config.baseUrl.replace(/\/+$/, "")}/chat/completions`);
    const isMiniMax = ["api.minimaxi.com", "api.minimax.cn", "api.minimax.io"].includes(endpoint.hostname);
    upstream = await fetch(endpoint, {
      method: "POST", signal, redirect: "error",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${config.key}` },
      body: JSON.stringify({ model: config.model, stream: true, max_tokens: Math.min(16000, words * 3), messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: prompt },
      ],
      ...(isMiniMax ? { reasoning_split: true } : {}),
      ...(endpoint.hostname === "api.deepseek.com" || (isMiniMax && config.model === "MiniMax-M3") ? { thinking: { type: "disabled" } } : {}),
      }),
    });
  } catch {
    clearTimeout(timeout);
    return jsonError(signal.aborted ? "生成已停止或等待超时，请重试。" : "无法连接模型服务，请检查网络和模型配置。", 502);
  }
  if (!upstream.ok || !upstream.body) {
    clearTimeout(timeout);
    await upstream.body?.cancel();
    const error = upstream.status === 401 || upstream.status === 403 ? "模型鉴权失败，请检查 API Key。"
      : upstream.status === 402 ? "模型账户余额不足，请检查服务商账户。"
      : upstream.status === 429 ? "请求过于频繁，请稍后再试。"
      : "模型服务暂时不可用，请检查模型名称或稍后重试。";
    return jsonError(error, 502);
  }

  const body = upstream.body;
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(output) {
      let completed = false;
      let hasContent = false;
      let finishReason = "";
      const send = (event: object) => output.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
      try {
        for await (const data of readSseData(body)) {
          if (data === "[DONE]") { completed = true; break; }
          const chunk = JSON.parse(data) as { error?: unknown; choices?: { delta?: { content?: unknown }; finish_reason?: string | null }[] };
          if (chunk.error) throw new Error("模型中断了生成，请重试。");
          const choice = chunk.choices?.[0];
          if (typeof choice?.delta?.content === "string" && choice.delta.content) {
            hasContent = true;
            send({ type: "delta", text: choice.delta.content });
          }
          if (choice?.finish_reason) finishReason = choice.finish_reason;
        }
        if (!completed && !finishReason) throw new Error("连接中断，已保留收到的正文，请重试。");
        if (!hasContent) throw new Error("模型没有返回正文，请调整设定后重试。");
        send({ type: "done", warning: finishReason === "length" ? "达到输出上限，正文可能不完整。可减少目标字数后重新生成。" : finishReason && finishReason !== "stop" ? "模型提前结束了生成，请检查正文是否完整。" : "" });
      } catch (error) {
        if (!request.signal.aborted) {
          try { send({ type: "error", error: signal.aborted ? "生成超时，已保留收到的正文。" : error instanceof SyntaxError ? "模型返回格式异常，请检查模型配置。" : error instanceof Error ? error.message : "生成中断，请重试。" }); } catch { /* Reader was closed. */ }
        }
      } finally {
        clearTimeout(timeout);
        controller.abort();
        try { output.close(); } catch { /* Reader was cancelled. */ }
      }
    },
    cancel() { controller.abort(); clearTimeout(timeout); },
  });
  return new Response(stream, { headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store", "X-Accel-Buffering": "no" } });
}
