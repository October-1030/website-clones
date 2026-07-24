import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { listCloudSessions } from "../cloud/session-repository";
import { parseStoredHomeworkSession } from "../homework/storage";
import { parseStoredStudySession } from "../study/storage";
import { parseStoredTranscribeSession } from "../transcribe/storage";
import { parseStoredVideoSession } from "../video/storage";
import type { LibraryItem, LibraryItemKind } from "./types";

const MAX_LIBRARY_FILES_PER_KIND = 100;
const MAX_SESSION_FILE_BYTES = 5 * 1024 * 1024;

function dataDirectory(): string {
  const configured = process.env.STUDYPAL_DATA_DIR?.trim() || ".studypal-data";
  return path.resolve(/* turbopackIgnore: true */ process.cwd(), configured);
}

function clip(value: string, length = 100): string {
  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized.length > length ? `${normalized.slice(0, length - 1)}…` : normalized;
}

async function readSessionFiles(directory: string): Promise<string[]> {
  try {
    const entries = await readdir(path.join(dataDirectory(), directory), { withFileTypes: true });
    return entries
      .filter((entry) => entry.isFile() && /^[a-zA-Z0-9_-]{1,100}\.json$/.test(entry.name))
      .slice(0, MAX_LIBRARY_FILES_PER_KIND)
      .map((entry) => path.join(dataDirectory(), directory, entry.name));
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") return [];
    throw error;
  }
}

async function safeRead(filePath: string): Promise<string | null> {
  try {
    const metadata = await stat(filePath);
    if (!metadata.isFile() || metadata.size > MAX_SESSION_FILE_BYTES) return null;
    return await readFile(filePath, "utf8");
  } catch {
    return null;
  }
}

async function itemsForKind(kind: LibraryItemKind): Promise<LibraryItem[]> {
  const directory = kind === "study" ? "sessions" : kind;
  const files = await readSessionFiles(directory);
  const rows = await Promise.all(files.map(async (filePath): Promise<LibraryItem | null> => {
    const raw = await safeRead(filePath);
    if (!raw) return null;
    if (kind === "study") {
      const session = parseStoredStudySession(raw);
      return session ? {
        id: session.id,
        kind,
        title: session.file.name,
        subtitle: `${session.file.pageCount} source section${session.file.pageCount === 1 ? "" : "s"} · ${session.summary.keyConcepts.length} concepts`,
        providerLabel: session.provider.label,
        updatedAt: session.updatedAt,
        href: `/pro/session?session=${encodeURIComponent(session.id)}`,
      } : null;
    }
    if (kind === "homework") {
      const session = parseStoredHomeworkSession(raw);
      return session ? {
        id: session.id,
        kind,
        title: clip(session.problem, 110),
        subtitle: `${session.solution.subject} · ${session.solution.steps.length} solution steps`,
        providerLabel: session.provider.label,
        updatedAt: session.updatedAt,
        href: `/pro/session?homeworkSession=${encodeURIComponent(session.id)}`,
      } : null;
    }
    if (kind === "video") {
      const session = parseStoredVideoSession(raw);
      return session ? {
        id: session.id,
        kind,
        title: session.source.title,
        subtitle: `${session.source.segmentCount} transcript segments${session.source.author ? ` · ${session.source.author}` : ""}`,
        providerLabel: session.provider.label,
        updatedAt: session.updatedAt,
        href: `/pro/session?videoSession=${encodeURIComponent(session.id)}`,
      } : null;
    }
    const session = parseStoredTranscribeSession(raw);
    return session ? {
      id: session.id,
      kind,
      title: session.source.kind === "microphone" ? "Microphone transcript" : "Browser-tab transcript",
      subtitle: `${session.segments.length} timestamped segments · ${Math.round(session.source.durationSeconds)} seconds`,
      providerLabel: session.provider.label,
      updatedAt: session.updatedAt,
      href: `/pro/session?transcribeSession=${encodeURIComponent(session.id)}`,
    } : null;
  }));
  return rows.filter((item): item is LibraryItem => Boolean(item));
}

export async function listLibraryItems(): Promise<LibraryItem[]> {
  const cloudRows = await listCloudSessions();
  if (cloudRows) {
    return cloudRows.map((row) => ({
      id: row.client_id,
      kind: row.kind,
      title: row.title,
      subtitle: row.subtitle,
      providerLabel: row.provider_label,
      updatedAt: row.updated_at,
      href: row.kind === "study"
        ? `/pro/session?session=${encodeURIComponent(row.client_id)}`
        : row.kind === "homework"
          ? `/pro/session?homeworkSession=${encodeURIComponent(row.client_id)}`
          : row.kind === "video"
            ? `/pro/session?videoSession=${encodeURIComponent(row.client_id)}`
            : `/pro/session?transcribeSession=${encodeURIComponent(row.client_id)}`,
    }));
  }
  const groups = await Promise.all([
    itemsForKind("study"),
    itemsForKind("homework"),
    itemsForKind("video"),
    itemsForKind("transcribe"),
  ]);
  return groups.flat().sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
}
