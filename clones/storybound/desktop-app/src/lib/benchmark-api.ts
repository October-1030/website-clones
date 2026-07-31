export interface BenchmarkProviderStatus {
  singleVideoParser: {
    available: boolean;
    provider: string;
  };
  accountSync: {
    configured: boolean;
    provider: string;
    requiresOriginalAccount: boolean;
    mayConsumeCredits: boolean;
  };
}

export interface ParsedBenchmarkVideo {
  sourceUrl: string;
  title: string;
  description: string;
  authorName: string;
  authorAvatar: string;
  coverUrl: string;
  mediaUrl: string;
  quality: string;
  format: string;
  codec: string;
  publishTime: number;
  expiresAt: string;
  likes: number;
  favorites: number;
  comments: number;
  forwards: number;
  plays: number;
  parser: string;
  parserWebsite: string;
}

export interface ResolvedBenchmarkAccount {
  sourceUrl: string;
  remoteId: string;
  name: string;
  objectId: string;
}

export interface SyncedBenchmarkWork {
  remoteWorkId: string;
  title: string;
  coverUrl: string;
  mediaUrl: string;
  decodeKey: string;
  sourceUrl: string;
  forwards: number;
  likes: number;
  comments: number;
  favorites: number;
  duration: number;
  publishTime: number;
}

export interface SyncedBenchmarkResult {
  remoteId: string;
  accountName: string;
  avatar: string;
  lastBuffer: string;
  continueFlag: number;
  cost: number;
  works: SyncedBenchmarkWork[];
}

async function responseError(response: Response): Promise<string> {
  try {
    const payload = await response.json() as { error?: string };
    return payload.error || `请求失败（HTTP ${response.status}）`;
  } catch {
    return `请求失败（HTTP ${response.status}）`;
  }
}

async function postJson<T>(pathname: string, body: object): Promise<T> {
  const response = await fetch(pathname, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error(await responseError(response));
  return response.json() as Promise<T>;
}

export async function fetchBenchmarkProviderStatus(): Promise<BenchmarkProviderStatus> {
  const response = await fetch("/api/benchmark/status", { cache: "no-store" });
  if (!response.ok) throw new Error(await responseError(response));
  return response.json() as Promise<BenchmarkProviderStatus>;
}

export async function parseBenchmarkVideo(url: string): Promise<ParsedBenchmarkVideo> {
  const payload = await postJson<{ video: ParsedBenchmarkVideo }>("/api/benchmark/parse-video", { url });
  return payload.video;
}

export async function resolveBenchmarkAccount(url: string): Promise<ResolvedBenchmarkAccount> {
  const payload = await postJson<{ account: ResolvedBenchmarkAccount }>("/api/benchmark/resolve-account", { url });
  return payload.account;
}

export async function fetchBenchmarkWorks(
  remoteId: string,
  lastBuffer = "",
): Promise<SyncedBenchmarkResult> {
  const payload = await postJson<{ result: SyncedBenchmarkResult }>("/api/benchmark/fetch-works", {
    remoteId,
    lastBuffer,
  });
  return payload.result;
}
