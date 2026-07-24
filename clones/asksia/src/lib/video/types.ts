import type { StudyMessage, StudyProviderMode, StudySourcePage, StudySummary } from "../study/types";

export const VIDEO_SESSION_STORAGE_KEY = "studypal.video-session.v1";
export const MAX_MEDIA_URL_CHARS = 2_048;
export const MAX_VIDEO_TRANSCRIPT_CHARS = 180_000;
export const MAX_VIDEO_QUESTION_CHARS = 2_000;

export type MediaSourceKind = "youtube" | "podcast";

export interface VideoTranscriptSegment {
  startSeconds: number | null;
  durationSeconds: number | null;
  label: string;
  text: string;
}

export interface ExtractedMediaSource {
  kind: MediaSourceKind;
  url: string;
  canonicalUrl: string;
  title: string;
  author: string | null;
  durationSeconds: number | null;
  language: string | null;
  transcript: VideoTranscriptSegment[];
  truncated: boolean;
}

export interface VideoSession {
  version: 1;
  id: string;
  source: {
    kind: MediaSourceKind;
    url: string;
    canonicalUrl: string;
    title: string;
    author: string | null;
    durationSeconds: number | null;
    language: string | null;
    transcriptCharacters: number;
    segmentCount: number;
    fetchedAt: string;
  };
  provider: {
    id: string;
    mode: StudyProviderMode;
    label: string;
  };
  pages: StudySourcePage[];
  summary: StudySummary;
  messages: StudyMessage[];
  truncated: boolean;
  createdAt: string;
  updatedAt: string;
}
