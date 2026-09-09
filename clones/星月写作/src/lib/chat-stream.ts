// SSE events may split across UTF-8 characters, lines and arbitrary network chunks.
export async function* readSseData(body: ReadableStream<Uint8Array>) {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  try {
    while (true) {
      const { done, value } = await reader.read();
      buffer += done ? decoder.decode() : decoder.decode(value, { stream: true });
      let boundary: RegExpExecArray | null;
      while ((boundary = /\r?\n\r?\n/.exec(buffer))) {
        const event = buffer.slice(0, boundary.index);
        buffer = buffer.slice(boundary.index + boundary[0].length);
        const data = event.split(/\r?\n/).filter(line => line.startsWith("data:")).map(line => line.slice(5).trimStart()).join("\n");
        if (data) yield data;
      }
      if (buffer.length > 1_000_000) throw new Error("模型返回的数据过大。");
      if (done) break;
    }
  } finally {
    void reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}
