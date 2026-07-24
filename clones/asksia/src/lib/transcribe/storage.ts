import { isTranscribeSession, TRANSCRIBE_SESSION_STORAGE_KEY, type TranscribeSession } from "./types";

export function parseStoredTranscribeSession(raw: string | null): TranscribeSession | null {
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    return isTranscribeSession(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function loadTranscribeSession(storage: Pick<Storage, "getItem">): TranscribeSession | null {
  return parseStoredTranscribeSession(storage.getItem(TRANSCRIBE_SESSION_STORAGE_KEY));
}

export function saveTranscribeSession(storage: Pick<Storage, "setItem">, session: TranscribeSession): void {
  storage.setItem(TRANSCRIBE_SESSION_STORAGE_KEY, JSON.stringify(session));
}

export function clearTranscribeSession(storage: Pick<Storage, "removeItem">): void {
  storage.removeItem(TRANSCRIBE_SESSION_STORAGE_KEY);
}
