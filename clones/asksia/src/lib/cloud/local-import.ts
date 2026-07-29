import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { parseStoredHomeworkSession } from "../homework/storage";
import { parseStoredStudySession } from "../study/storage";
import { parseStoredTranscribeSession } from "../transcribe/storage";
import { parseStoredVideoSession } from "../video/storage";
import { requireCloudUser } from "./server";
import { saveCloudSession } from "./session-repository";
import type { CloudSessionKind, CloudSessionPayload } from "./session-metadata";

const MAX_FILES_PER_KIND = 100;
const MAX_FILE_BYTES = 5 * 1024 * 1024;

function dataDirectory(): string {
  const configured = process.env.STUDYPAL_DATA_DIR?.trim() || ".studypal-data";
  return path.resolve(/* turbopackIgnore: true */ process.cwd(), configured);
}

function parse(kind: CloudSessionKind, raw: string): CloudSessionPayload | null {
  if (kind === "study") return parseStoredStudySession(raw);
  if (kind === "homework") return parseStoredHomeworkSession(raw);
  if (kind === "video") return parseStoredVideoSession(raw);
  return parseStoredTranscribeSession(raw);
}

async function sessionsFor(kind: CloudSessionKind): Promise<CloudSessionPayload[]> {
  const directory = path.join(/* turbopackIgnore: true */ dataDirectory(), kind === "study" ? "sessions" : kind);
  let names: string[];
  try {
    names = (await readdir(directory, { withFileTypes: true }))
      .filter((entry) => entry.isFile() && /^[a-zA-Z0-9_-]{1,100}\.json$/.test(entry.name))
      .slice(0, MAX_FILES_PER_KIND)
      .map((entry) => entry.name);
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") return [];
    throw error;
  }
  const values = await Promise.all(names.map(async (name) => {
    const filePath = path.join(/* turbopackIgnore: true */ directory, name);
    try {
      const metadata = await stat(filePath);
      if (!metadata.isFile() || metadata.size > MAX_FILE_BYTES) return null;
      return parse(kind, await readFile(filePath, "utf8"));
    } catch {
      return null;
    }
  }));
  return values.filter((value): value is CloudSessionPayload => Boolean(value));
}

export async function importLocalSessionsToCloud(): Promise<Record<CloudSessionKind, number>> {
  const context = await requireCloudUser();
  const counts: Record<CloudSessionKind, number> = { study: 0, homework: 0, video: 0, transcribe: 0 };
  for (const kind of Object.keys(counts) as CloudSessionKind[]) {
    const sessions = await sessionsFor(kind);
    for (const session of sessions) {
      const saved = await saveCloudSession(kind, session, async () => context);
      if (saved) counts[kind] += 1;
    }
  }
  return counts;
}
