import { mkdir, readFile, rename, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { parseStoredVideoSession } from "./storage";
import type { VideoSession } from "./types";

const SESSION_ID_PATTERN = /^[a-zA-Z0-9_-]{1,100}$/;

export class VideoSessionStoreError extends Error {
  constructor(message: string, public readonly code: string, public readonly status = 500) {
    super(message);
    this.name = "VideoSessionStoreError";
  }
}

function dataDirectory(): string {
  const configured = process.env.STUDYPAL_DATA_DIR?.trim() || ".studypal-data";
  return path.resolve(/* turbopackIgnore: true */ process.cwd(), configured);
}

function sessionPath(id: string): string {
  if (!SESSION_ID_PATTERN.test(id)) throw new VideoSessionStoreError("视频学习记录 ID 无效。", "invalid_video_session_id", 400);
  return path.join(dataDirectory(), "video", `${id}.json`);
}

export async function saveServerVideoSession(session: VideoSession): Promise<void> {
  const target = sessionPath(session.id);
  await mkdir(path.dirname(target), { recursive: true });
  const temporary = `${target}.${process.pid}.${crypto.randomUUID()}.tmp`;
  try {
    await writeFile(temporary, JSON.stringify(session), { encoding: "utf8", flag: "wx" });
    await rename(temporary, target);
  } catch {
    await unlink(temporary).catch(() => undefined);
    throw new VideoSessionStoreError("无法保存本机视频学习记录，请检查磁盘空间和目录权限。", "video_session_write_failed");
  }
}

export async function loadServerVideoSession(id: string): Promise<VideoSession | null> {
  const target = sessionPath(id);
  try {
    const raw = await readFile(target, "utf8");
    const session = parseStoredVideoSession(raw);
    if (!session || session.id !== id) throw new VideoSessionStoreError("本机视频学习记录已损坏。", "video_session_corrupt");
    return session;
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") return null;
    if (error instanceof VideoSessionStoreError) throw error;
    throw new VideoSessionStoreError("无法读取本机视频学习记录。", "video_session_read_failed");
  }
}

export async function deleteServerVideoSession(id: string): Promise<boolean> {
  const target = sessionPath(id);
  try {
    await unlink(target);
    return true;
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") return false;
    throw new VideoSessionStoreError("无法删除本机视频学习记录。", "video_session_delete_failed");
  }
}
