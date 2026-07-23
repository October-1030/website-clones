import { mkdir, readFile, rename, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
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
  if (!SESSION_ID_PATTERN.test(id)) throw new HomeworkSessionStoreError("作业记录 ID 无效。", "invalid_homework_session_id", 400);
  return path.join(dataDirectory(), "homework", `${id}.json`);
}

export async function saveServerHomeworkSession(session: HomeworkSession): Promise<void> {
  const target = sessionPath(session.id);
  await mkdir(path.dirname(target), { recursive: true });
  const temporary = `${target}.${process.pid}.${crypto.randomUUID()}.tmp`;
  try {
    await writeFile(temporary, JSON.stringify(session), { encoding: "utf8", flag: "wx" });
    await rename(temporary, target);
  } catch {
    await unlink(temporary).catch(() => undefined);
    throw new HomeworkSessionStoreError("无法保存本机作业记录，请检查磁盘空间和目录权限。", "homework_session_write_failed");
  }
}

export async function loadServerHomeworkSession(id: string): Promise<HomeworkSession | null> {
  const target = sessionPath(id);
  try {
    const raw = await readFile(target, "utf8");
    const session = parseStoredHomeworkSession(raw);
    if (!session || session.id !== id) throw new HomeworkSessionStoreError("本机作业记录已损坏。", "homework_session_corrupt");
    return session;
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") return null;
    if (error instanceof HomeworkSessionStoreError) throw error;
    throw new HomeworkSessionStoreError("无法读取本机作业记录。", "homework_session_read_failed");
  }
}

export async function deleteServerHomeworkSession(id: string): Promise<boolean> {
  const target = sessionPath(id);
  try {
    await unlink(target);
    return true;
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") return false;
    throw new HomeworkSessionStoreError("无法删除本机作业记录。", "homework_session_delete_failed");
  }
}
