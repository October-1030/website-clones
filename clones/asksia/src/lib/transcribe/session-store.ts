import { mkdir, readFile, rename, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { parseStoredTranscribeSession } from "./storage";
import type { TranscribeSession } from "./types";

const SESSION_ID_PATTERN = /^[a-zA-Z0-9_-]{1,100}$/;

export class TranscribeSessionStoreError extends Error {
  constructor(message: string, public readonly code: string, public readonly status = 500) {
    super(message);
    this.name = "TranscribeSessionStoreError";
  }
}

function dataDirectory(): string {
  const configured = process.env.STUDYPAL_DATA_DIR?.trim() || ".studypal-data";
  return path.resolve(/* turbopackIgnore: true */ process.cwd(), configured);
}

function sessionPath(id: string): string {
  if (!SESSION_ID_PATTERN.test(id)) {
    throw new TranscribeSessionStoreError("The transcription session ID is invalid.", "invalid_transcribe_session_id", 400);
  }
  return path.join(dataDirectory(), "transcribe", `${id}.json`);
}

export function transcribeTemporaryDirectory(): string {
  return path.join(dataDirectory(), "transcribe-temp");
}

export async function saveServerTranscribeSession(session: TranscribeSession): Promise<void> {
  const target = sessionPath(session.id);
  await mkdir(path.dirname(target), { recursive: true });
  const temporary = `${target}.${process.pid}.${crypto.randomUUID()}.tmp`;
  try {
    await writeFile(temporary, JSON.stringify(session), { encoding: "utf8", flag: "wx" });
    await rename(temporary, target);
  } catch {
    await unlink(temporary).catch(() => undefined);
    throw new TranscribeSessionStoreError("Unable to save the local transcription session.", "transcribe_session_write_failed");
  }
}

export async function loadServerTranscribeSession(id: string): Promise<TranscribeSession | null> {
  const target = sessionPath(id);
  try {
    const raw = await readFile(target, "utf8");
    const session = parseStoredTranscribeSession(raw);
    if (!session || session.id !== id) {
      throw new TranscribeSessionStoreError("The local transcription session is corrupted.", "transcribe_session_corrupt");
    }
    return session;
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") return null;
    if (error instanceof TranscribeSessionStoreError) throw error;
    throw new TranscribeSessionStoreError("Unable to read the local transcription session.", "transcribe_session_read_failed");
  }
}

export async function deleteServerTranscribeSession(id: string): Promise<boolean> {
  const target = sessionPath(id);
  try {
    await unlink(target);
    return true;
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") return false;
    throw new TranscribeSessionStoreError("Unable to delete the local transcription session.", "transcribe_session_delete_failed");
  }
}
