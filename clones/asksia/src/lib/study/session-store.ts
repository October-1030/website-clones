import { mkdir, readFile, rename, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
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

export async function saveServerStudySession(session: StudySession): Promise<void> {
  const target = sessionPath(session.id);
  await mkdir(path.dirname(target), { recursive: true });
  const temporary = `${target}.${process.pid}.${crypto.randomUUID()}.tmp`;
  try {
    await writeFile(temporary, JSON.stringify(session), { encoding: "utf8", flag: "wx" });
    await rename(temporary, target);
  } catch (error) {
    await unlink(temporary).catch(() => undefined);
    if (error instanceof StudySessionStoreError) throw error;
    throw new StudySessionStoreError("无法保存本机学习记录，请检查磁盘空间和目录权限。", "session_write_failed");
  }
}

export async function loadServerStudySession(id: string): Promise<StudySession | null> {
  const target = sessionPath(id);
  try {
    const raw = await readFile(target, "utf8");
    const session = parseStoredStudySession(raw);
    if (!session || session.id !== id) throw new StudySessionStoreError("本机学习记录已损坏。", "session_corrupt", 500);
    return session;
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") return null;
    if (error instanceof StudySessionStoreError) throw error;
    throw new StudySessionStoreError("无法读取本机学习记录。", "session_read_failed");
  }
}

export async function deleteServerStudySession(id: string): Promise<boolean> {
  const target = sessionPath(id);
  try {
    await unlink(target);
    return true;
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") return false;
    throw new StudySessionStoreError("无法删除本机学习记录。", "session_delete_failed");
  }
}
