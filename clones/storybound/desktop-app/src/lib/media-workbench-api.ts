import type {
  CreateMediaJobInput,
  MediaAssetKind,
  MediaWorkbenchAsset,
  MediaWorkbenchAssetResponse,
  MediaWorkbenchCapabilities,
  MediaWorkbenchJob,
  MediaWorkbenchJobResponse,
  MediaWorkbenchListResponse,
  MediaWorkbenchManifest,
  RenderMediaJobInput,
  UpdateMediaJobInput,
} from "../types/media-workbench";

async function responseError(response: Response): Promise<string> {
  try {
    const payload = (await response.json()) as { error?: string };
    return payload.error || `请求失败（HTTP ${response.status}）`;
  } catch {
    return `请求失败（HTTP ${response.status}）`;
  }
}

async function jsonRequest<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  if (!response.ok) throw new Error(await responseError(response));
  return response.json() as Promise<T>;
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error(`无法读取 ${file.name}`));
    reader.onload = () => resolve(String(reader.result || "").split(",")[1] || "");
    reader.readAsDataURL(file);
  });
}

export function createMediaJob(input: CreateMediaJobInput, signal?: AbortSignal): Promise<MediaWorkbenchJob> {
  return jsonRequest<MediaWorkbenchJobResponse>("/api/media-workbench/jobs", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
    signal,
  }).then((payload) => payload.job);
}

export function listMediaJobs(signal?: AbortSignal): Promise<MediaWorkbenchListResponse> {
  return jsonRequest("/api/media-workbench/jobs", { cache: "no-store", signal });
}

export function getMediaJob<TManifest extends MediaWorkbenchManifest>(
  jobId: string,
  signal?: AbortSignal,
): Promise<MediaWorkbenchJob<TManifest>> {
  return jsonRequest<MediaWorkbenchJobResponse<TManifest>>(
    `/api/media-workbench/jobs/${encodeURIComponent(jobId)}`,
    { cache: "no-store", signal },
  ).then((payload) => payload.job);
}

export function updateMediaJob<TManifest extends MediaWorkbenchManifest>(
  jobId: string,
  patch: UpdateMediaJobInput,
  signal?: AbortSignal,
): Promise<MediaWorkbenchJob<TManifest>> {
  return jsonRequest<MediaWorkbenchJobResponse<TManifest>>(
    `/api/media-workbench/jobs/${encodeURIComponent(jobId)}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
      signal,
    },
  ).then((payload) => payload.job);
}

export async function uploadMediaAsset(
  jobId: string,
  file: File,
  kind: MediaAssetKind,
  signal?: AbortSignal,
): Promise<MediaWorkbenchAsset> {
  const payload = await jsonRequest<MediaWorkbenchAssetResponse>(
    `/api/media-workbench/jobs/${encodeURIComponent(jobId)}/assets`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        kind,
        fileName: file.name,
        mimeType: file.type || "application/octet-stream",
        base64: await fileToBase64(file),
      }),
      signal,
    },
  );
  return payload.asset;
}

export function renderMediaJob<TManifest extends MediaWorkbenchManifest>(
  jobId: string,
  input: RenderMediaJobInput,
  signal?: AbortSignal,
): Promise<MediaWorkbenchJob<TManifest>> {
  return jsonRequest<MediaWorkbenchJobResponse<TManifest>>(
    `/api/media-workbench/jobs/${encodeURIComponent(jobId)}/render`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
      signal,
    },
  ).then((payload) => payload.job);
}

export function cancelMediaJob<TManifest extends MediaWorkbenchManifest>(
  jobId: string,
): Promise<MediaWorkbenchJob<TManifest>> {
  return jsonRequest<MediaWorkbenchJobResponse<TManifest>>(
    `/api/media-workbench/jobs/${encodeURIComponent(jobId)}/cancel`,
    { method: "POST" },
  ).then((payload) => payload.job);
}

export function fetchMediaWorkbenchCapabilities(signal?: AbortSignal): Promise<MediaWorkbenchCapabilities> {
  return jsonRequest("/api/media-workbench/capabilities", { cache: "no-store", signal });
}
