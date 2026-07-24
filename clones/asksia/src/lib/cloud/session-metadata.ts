import type { HomeworkSession } from "../homework/types";
import type { StudySession } from "../study/types";
import type { TranscribeSession } from "../transcribe/types";
import type { VideoSession } from "../video/types";

export type CloudSessionKind = "study" | "homework" | "video" | "transcribe";
export type CloudSessionPayload = StudySession | HomeworkSession | VideoSession | TranscribeSession;

export interface CloudSessionMetadata {
  clientId: string;
  title: string;
  subtitle: string;
  providerLabel: string;
  createdAt: string;
  updatedAt: string;
}

function clip(value: string, length: number): string {
  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized.length > length ? `${normalized.slice(0, length - 1)}…` : normalized;
}

export function metadataForCloudSession(kind: CloudSessionKind, payload: CloudSessionPayload): CloudSessionMetadata {
  if (kind === "study") {
    const session = payload as StudySession;
    return {
      clientId: session.id,
      title: session.file.name,
      subtitle: `${session.file.pageCount} source section${session.file.pageCount === 1 ? "" : "s"} · ${session.summary.keyConcepts.length} concepts`,
      providerLabel: session.provider.label,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
    };
  }
  if (kind === "homework") {
    const session = payload as HomeworkSession;
    return {
      clientId: session.id,
      title: clip(session.problem, 300),
      subtitle: `${session.solution.subject} · ${session.solution.steps.length} solution steps`,
      providerLabel: session.provider.label,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
    };
  }
  if (kind === "video") {
    const session = payload as VideoSession;
    return {
      clientId: session.id,
      title: session.source.title,
      subtitle: `${session.source.segmentCount} transcript segments${session.source.author ? ` · ${session.source.author}` : ""}`,
      providerLabel: session.provider.label,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
    };
  }
  const session = payload as TranscribeSession;
  return {
    clientId: session.id,
    title: session.source.kind === "microphone" ? "Microphone transcript" : "Browser-tab transcript",
    subtitle: `${session.segments.length} timestamped segments · ${Math.round(session.source.durationSeconds)} seconds`,
    providerLabel: session.provider.label,
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
  };
}
