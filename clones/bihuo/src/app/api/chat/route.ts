import { acquireGeneration, assertLocalRequest, ChatError, generateReply, getMiniMaxConfig, readMessages } from "@/lib/server/minimax";

export const runtime = "nodejs";
export const maxDuration = 60;

const headers = { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" };

function errorResponse(error: unknown) {
  const failure = error instanceof ChatError ? error : new ChatError(500, "INTERNAL_ERROR", "暂时无法处理请求，请稍后再试。");
  return Response.json({ error: { code: failure.code, message: failure.message } }, { status: failure.status, headers: { ...headers, ...(failure.status === 429 ? { "Retry-After": "60" } : {}) } });
}

export function GET(request: Request) {
  try {
    assertLocalRequest(request);
    const { model } = getMiniMaxConfig();
    return Response.json({ configured: true, provider: "MiniMax", model }, { headers });
  } catch (error) { return errorResponse(error); }
}

export async function POST(request: Request) {
  let release: (() => void) | undefined;
  try {
    assertLocalRequest(request);
    const messages = await readMessages(request);
    getMiniMaxConfig();
    release = acquireGeneration();
    return Response.json(await generateReply(messages, request.signal), { headers });
  } catch (error) { return errorResponse(error); }
  finally { release?.(); }
}
