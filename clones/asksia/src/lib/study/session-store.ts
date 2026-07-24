import { mkdir, readFile, rename, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { CloudStorageError, deleteCloudSession, loadCloudSession, saveCloudSession } from "../cloud/session-repository";
import { parseStoredStudySession } from "./storage";
import type { StudySession } from "./types";

const SESSION_ID_PATTERN = /^[a-zA-Z0-9_-]{1,100}$/;

export class StudySessionStoreError extends Error {
  constructor(message: string, public readonly code: string, public readonly status = 500) {
    super(message);
    this.name = "StudySessionStoreError";
  }
}

function dataDirectory(): string {
  const configured = process.env.STUDYPAL_DATA_DIR?.trim() || ".studypal-data";
  return path.resolve(/* turbopackIgnore: true */ process.cwd(), configured);
}

function sessionPath(id: string): string {
  if (!SESSION_ID_PATTERN.test(id)) throw new StudySessionStoreError("学习记录 ID 无效。", "invalid_session_id", 400);
  return path.join(dataDirectory(), "sessions", `${id}.json`);
}

function cloudError(error: unknown): StudySessionStoreError | null {
  return error instanceof CloudStorageError ? new StudySessionStoreError(error.message, error.code, error.status) : null;
}

export async function saveServerStudySession(session: StudySession): Promise<void> {
  const target = sessionPath(session.id);
  try {
    if (await saveCloudSession("study", session)) return;
    await mkdir(path.dirname(target), { recursive: true });
    const temporary = `${target}.${process.pid}.${crypto.randomUUID()}.tmp`;
    try {
      await writeFile(temporary, JSON.stringify(session), { encoding: "utf8", flag: "wx" });
      await rename(temporary, target);
    } catch (error) {
      await unlink(temporary).catch(() => undefined);
      throw error;
    }
  } catch (error) {
    const cloud = cloudError(error);
    if (cloud) throw cloud;
    if (error instanceof StudySessionStoreError) throw error;
    throw new StudySessionStoreError("Unable to save the study session.", "session_write_failed");
  }
}

export async function loadServerStudySession(id: string): Promise<StudySession | null> {
  const target = sessionPath(id);
  try {
    const cloud = await loadCloudSession<StudySession>("study", id);
    if (cloud.usedCloud) {
      if (!cloud.payload) return null;
      const session = parseStoredStudySession(JSON.stringify(cloud.payload));
      if (!session || session.id !== id) throw new StudySessionStoreError("The cloud study session is corrupted.", "session_corrupt");
      return session;
    }
    const raw = await readFile(target, "utf8");
    const session = parseStoredStudySession(raw);
    if (!session || session.id !== id) throw new StudySessionStoreError("The local study session is corrupted.", "session_corrupt");
    return session;
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") return null;
    const cloud = cloudError(error);
    if (cloud) throw cloud;
    if (error instanceof StudySessionStoreError) throw error;
    throw new StudySessionStoreError("Unable to read the study session.", "session_read_failed");
  }
}

export async function deleteServerStudySession(id: string): Promise<boolean> {
  const target = sessionPath(id);
  try {
    const cloud = await deleteCloudSession("study", id);
    if (cloud.usedCloud) return cloud.deleted;
    await unlink(target);
    return true;
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") return false;
    const cloud = cloudError(error);
    if (cloud) throw cloud;
    throw new StudySessionStoreError("Unable to delete the study session.", "session_delete_failed");
  }
}
