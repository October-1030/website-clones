export const runtime = "nodejs";
export const maxDuration = 180;

export async function POST(request: Request) {
  const fail = (error: string, status = 400) => Response.json({ error }, { status });
  const origin = request.headers.get("origin");
  const url = new URL(request.url);
  url.host = request.headers.get("host") || url.host;
  if (origin && origin !== url.origin) return fail("请求来源不匹配。", 403);
  const key = process.env.MINIMAX_API_KEY?.trim() || process.env.WRITING_API_KEY?.trim();
  if (!key) return fail("服务器尚未配置 MiniMax 密钥。", 503);
  try {
    const reader = request.body?.getReader();
    if (!reader) return fail("请填写画面描述。");
    let raw = "";
    let bytes = 0;
    const decoder = new TextDecoder();
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > 16000) { await reader.cancel(); return fail("请求过长。", 413); }
      raw += decoder.decode(value, { stream: true });
    }
    raw += decoder.decode();
    const input = JSON.parse(raw);
    if (!input || typeof input.prompt !== "string" || !input.prompt.trim() || input.prompt.length > 1500) return fail("画面描述须为1至1500字符。");
    if (!["1:1", "2:3", "3:4", "16:9", "9:16", "4:3", "3:2", "21:9"].includes(input.aspect_ratio)) return fail("请选择有效的图片比例。");
    if (!Number.isInteger(input.n) || input.n < 1 || input.n > 9) return fail("一次可生成1至9张图片。");
    const response = await fetch("https://api.minimaxi.com/v1/image_generation", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: "image-01", prompt: input.prompt.trim(), aspect_ratio: input.aspect_ratio, n: input.n, response_format: "base64", prompt_optimizer: input.prompt_optimizer === true }),
      signal: AbortSignal.any([request.signal, AbortSignal.timeout(175000)]),
    });
    if (!response.ok) return fail(`MiniMax 生图请求失败（HTTP ${response.status}），请检查账户权限和额度。`, 502);
    const data = await response.json();
    if (data.base_resp?.status_code !== 0) return fail(`MiniMax 生图未成功（错误码 ${data.base_resp?.status_code ?? "未知"}），请检查生图权限、额度或调整描述。`, 502);
    const images: unknown = data.data?.image_base64;
    if (!Array.isArray(images) || !images.length || !images.every(item => typeof item === "string" && /^[A-Za-z0-9+/=\r\n]+$/.test(item))) return fail("未收到有效图片，请调整描述后重试。", 502);
    return Response.json({ images, failedCount: Number(data.metadata?.failed_count || 0) }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return fail(error instanceof SyntaxError ? "提交格式错误。" : "生图连接中断或超时，请稍后重试。", 502);
  }
}
