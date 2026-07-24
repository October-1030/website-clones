import { VIDEO_SESSION_STORAGE_KEY, type VideoSession } from "./types";

export function parseStoredVideoSession(raw: string | null): VideoSession | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Partial<VideoSession>;
    if (
      value.version !== 1
      || typeof value.id !== "string"
      || !value.source
      || typeof value.source.title !== "string"
      || typeof value.source.canonicalUrl !== "string"
      || !value.provider
      || typeof value.provider.id !== "string"
      || !Array.isArray(value.pages)
      || !value.summary
      || !Array.isArray(value.summary.keyConcepts)
      || !Array.isArray(value.summary.reviewQuestions)
      || !Array.isArray(value.messages)
    ) return null;
    return value as VideoSession;
  } catch {
    return null;
  }
}

export function loadVideoSession(storage: Pick<Storage, "getItem">): VideoSession | null {
  return parseStoredVideoSession(storage.getItem(VIDEO_SESSION_STORAGE_KEY));
}

export function saveVideoSession(storage: Pick<Storage, "setItem">, session: VideoSession): void {
  storage.setItem(VIDEO_SESSION_STORAGE_KEY, JSON.stringify(session));
}

export function clearVideoSession(storage: Pick<Storage, "removeItem">): void {
  storage.removeItem(VIDEO_SESSION_STORAGE_KEY);
}
