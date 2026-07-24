import { mkdir, readFile, rename, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { CloudStorageError, deleteCloudSession, loadCloudSession, saveCloudSession } from "../cloud/session-repository";
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
  if (!SESSION_ID_PATTERN.test(id)) throw new VideoSessionStoreError("The video session ID is invalid.", "invalid_video_session_id", 400);
  return path.join(dataDirectory(), "video", `${id}.json`);
}

function cloudError(error: unknown): VideoSessionStoreError | null {
  return error instanceof CloudStorageError ? new VideoSessionStoreError(error.message, error.code, error.status) : null;
}

export async function saveServerVideoSession(session: VideoSession): Promise<void> {
  const target = sessionPath(session.id);
  try {
    if (await saveCloudSession("video", session)) return;
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
    throw new VideoSessionStoreError("Unable to save the video session.", "video_session_write_failed");
  }
}

export async function loadServerVideoSession(id: string): Promise<VideoSession | null> {
  const target = sessionPath(id);
  try {
    const cloud = await loadCloudSession<VideoSession>("video", id);
    if (cloud.usedCloud) {
      if (!cloud.payload) return null;
      const session = parseStoredVideoSession(JSON.stringify(cloud.payload));
      if (!session || session.id !== id) throw new VideoSessionStoreError("The cloud video session is corrupted.", "video_session_corrupt");
      return session;
    }
    const raw = await readFile(target, "utf8");
    const session = parseStoredVideoSession(raw);
    if (!session || session.id !== id) throw new VideoSessionStoreError("The local video session is corrupted.", "video_session_corrupt");
    return session;
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") return null;
    const cloud = cloudError(error);
    if (cloud) throw cloud;
    if (error instanceof VideoSessionStoreError) throw error;
    throw new VideoSessionStoreError("Unable to read the video session.", "video_session_read_failed");
  }
}

export async function deleteServerVideoSession(id: string): Promise<boolean> {
  const target = sessionPath(id);
  try {
    const cloud = await deleteCloudSession("video", id);
    if (cloud.usedCloud) return cloud.deleted;
    await unlink(target);
    return true;
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") return false;
    const cloud = cloudError(error);
    if (cloud) throw cloud;
    throw new VideoSessionStoreError("Unable to delete the video session.", "video_session_delete_failed");
  }
}
