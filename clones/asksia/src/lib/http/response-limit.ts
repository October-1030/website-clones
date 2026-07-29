export class ResponseLimitError extends Error {
  constructor(message: string, public readonly code = "response_too_large", public readonly status = 502) {
    super(message);
    this.name = "ResponseLimitError";
  }
}

export async function readResponseBytes(response: Response, maximumBytes: number): Promise<Uint8Array> {
  if (!Number.isSafeInteger(maximumBytes) || maximumBytes <= 0) {
    throw new TypeError("maximumBytes must be a positive integer.");
  }
  const declared = Number(response.headers.get("content-length") || "0");
  if (Number.isFinite(declared) && declared > maximumBytes) throw new ResponseLimitError("The remote response is too large.");
  if (!response.body) return new Uint8Array();

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maximumBytes) {
        await reader.cancel("response size limit exceeded").catch(() => undefined);
        throw new ResponseLimitError("The remote response is too large.");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const output = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    output.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return output;
}

export async function readResponseText(response: Response, maximumBytes: number): Promise<string> {
  return new TextDecoder("utf-8", { fatal: false }).decode(await readResponseBytes(response, maximumBytes));
}

export async function readResponseJson<T>(response: Response, maximumBytes: number): Promise<T> {
  return JSON.parse(await readResponseText(response, maximumBytes)) as T;
}
