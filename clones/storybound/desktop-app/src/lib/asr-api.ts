export interface AsrStatus {
  available: boolean;
  provider: string | null;
  accepts: string[];
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error(`无法读取 ${file.name}`));
    reader.onload = () => resolve(String(reader.result || "").split(",")[1] || "");
    reader.readAsDataURL(file);
  });
}

async function responseError(response: Response): Promise<string> {
  try {
    const payload = await response.json() as { error?: string };
    return payload.error || `请求失败（HTTP ${response.status}）`;
  } catch {
    return `请求失败（HTTP ${response.status}）`;
  }
}

export async function fetchAsrStatus(): Promise<AsrStatus> {
  const response = await fetch("/api/asr/status", { cache: "no-store" });
  if (!response.ok) throw new Error(await responseError(response));
  return response.json() as Promise<AsrStatus>;
}

export async function transcribeMedia(file: File): Promise<string> {
  const response = await fetch("/api/asr/transcribe", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      fileName: file.name,
      mediaType: file.type,
      base64: await fileToBase64(file),
    }),
  });
  if (!response.ok) throw new Error(await responseError(response));
  const payload = await response.json() as { text?: string };
  return String(payload.text || "");
}
