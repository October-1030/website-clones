import { mkdir, readFile, rename, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { CloudStorageError, deleteCloudSession, loadCloudSession, saveCloudSession } from "../cloud/session-repository";
import { parseStoredHomeworkSession } from "./storage";
import type { HomeworkSession } from "./types";

const SESSION_ID_PATTERN = /^[a-zA-Z0-9_-]{1,100}$/;

export class HomeworkSessionStoreError extends Error {
  constructor(message: string, public readonly code: string, public readonly status = 500) {
    super(message);
    this.name = "HomeworkSessionStoreError";
  }
}

function dataDirectory(): string {
  const configured = process.env.STUDYPAL_DATA_DIR?.trim() || ".studypal-data";
  return path.resolve(/* turbopackIgnore: true */ process.cwd(), configured);
}

function sessionPath(id: string): string {
  if (!SESSION_ID_PATTERN.test(id)) throw new HomeworkSessionStoreError("The homework session ID is invalid.", "invalid_homework_session_id", 400);
  return path.join(dataDirectory(), "homework", `${id}.json`);
}

function cloudError(error: unknown): HomeworkSessionStoreError | null {
  return error instanceof CloudStorageError ? new HomeworkSessionStoreError(error.message, error.code, error.status) : null;
}

export async function saveServerHomeworkSession(session: HomeworkSession): Promise<void> {
  const target = sessionPath(session.id);
  try {
    if (await saveCloudSession("homework", session)) return;
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
    throw new HomeworkSessionStoreError("Unable to save the homework session.", "homework_session_write_failed");
  }
}

export async function loadServerHomeworkSession(id: string): Promise<HomeworkSession | null> {
  const target = sessionPath(id);
  try {
    const cloud = await loadCloudSession<HomeworkSession>("homework", id);
    if (cloud.usedCloud) {
      if (!cloud.payload) return null;
      const session = parseStoredHomeworkSession(JSON.stringify(cloud.payload));
      if (!session || session.id !== id) throw new HomeworkSessionStoreError("The cloud homework session is corrupted.", "homework_session_corrupt");
      return session;
    }
    const raw = await readFile(target, "utf8");
    const session = parseStoredHomeworkSession(raw);
    if (!session || session.id !== id) throw new HomeworkSessionStoreError("The local homework session is corrupted.", "homework_session_corrupt");
    return session;
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") return null;
    const cloud = cloudError(error);
    if (cloud) throw cloud;
    if (error instanceof HomeworkSessionStoreError) throw error;
    throw new HomeworkSessionStoreError("Unable to read the homework session.", "homework_session_read_failed");
  }
}

export async function deleteServerHomeworkSession(id: string): Promise<boolean> {
  const target = sessionPath(id);
  try {
    const cloud = await deleteCloudSession("homework", id);
    if (cloud.usedCloud) return cloud.deleted;
    await unlink(target);
    return true;
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") return false;
    const cloud = cloudError(error);
    if (cloud) throw cloud;
    throw new HomeworkSessionStoreError("Unable to delete the homework session.", "homework_session_delete_failed");
  }
}
