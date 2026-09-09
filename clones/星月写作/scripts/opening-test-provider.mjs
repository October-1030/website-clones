// Local QA fixture only. Never used by the app unless WRITING_BASE_URL points here.
import http from "node:http";

http.createServer(async (request, response) => {
  if (request.url !== "/chat/completions") { response.writeHead(404).end(); return; }
  let raw = "";
  for await (const chunk of request) raw += chunk;
  const body = JSON.parse(raw);
  const prompt = body.messages?.at(-1)?.content || "";
  if (prompt.includes("QA_AUTH_ERROR")) { response.writeHead(401).end("test authentication failure"); return; }
  response.writeHead(200, { "Content-Type": "text/event-stream" });
  const segments = ["第一章 测试开篇\n\n", "这是本地接口测试文本，不是 AI 生成内容。", "\n用于验证中文流式传输、保存和刷新后的持久化。"];
  const event = data => response.write(`data: ${JSON.stringify(data)}\r\n\r\n`);
  let index = 0;
  const timer = setInterval(() => {
    if (index < segments.length) event({ choices: [{ delta: { content: segments[index++] } }] });
    else {
      if (!prompt.includes("QA_TRUNCATED")) { event({ choices: [{ delta: {}, finish_reason: "stop" }] }); response.write("data: [DONE]\n\n"); }
      response.end(); clearInterval(timer);
    }
  }, prompt.includes("QA_SLOW") ? 5000 : 120);
  response.on("close", () => clearInterval(timer));
}).listen(3039, "127.0.0.1", () => console.log("Local QA provider on 127.0.0.1:3039; fixture output only."));
