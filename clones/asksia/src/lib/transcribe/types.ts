export const TRANSCRIBE_SESSION_STORAGE_KEY = "studypal.transcribe-session.v1";
export const MAX_TRANSCRIBE_FILE_BYTES = 50 * 1024 * 1024;
export const MAX_TRANSCRIBE_DURATION_SECONDS = 10 * 60;

export type TranscribeSourceKind = "microphone" | "browser-tab";

export interface TranscribeSegment {
  startSeconds: number;
  endSeconds: number;
  text: string;
}

export interface TranscribeSession {
  version: 1;
  id: string;
  source: {
    kind: TranscribeSourceKind;
    fileName: string;
    mimeType: string;
    sizeBytes: number;
    durationSeconds: number;
    capturedAt: string;
  };
  provider: {
    id: string;
    label: string;
    device: string;
  };
  language: string | null;
  languageProbability: number | null;
  text: string;
  segments: TranscribeSegment[];
  createdAt: string;
  updatedAt: string;
}

export function isTranscribeSession(value: unknown): value is TranscribeSession {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<TranscribeSession>;
  return candidate.version === 1
    && typeof candidate.id === "string"
    && typeof candidate.text === "string"
    && Array.isArray(candidate.segments)
    && Boolean(candidate.source && typeof candidate.source.kind === "string")
    && Boolean(candidate.provider && typeof candidate.provider.label === "string")
    && typeof candidate.createdAt === "string"
    && typeof candidate.updatedAt === "string";
}
