export const STUDY_SESSION_STORAGE_KEY = "studypal.study-session.v1";
export const MAX_STUDY_FILE_BYTES = 10 * 1024 * 1024;
export const MAX_EXTRACTED_CHARS = 350_000;

export type StudyFileKind = "pdf" | "txt";
export type StudyProviderMode = "demo" | "live";

export interface StudySourcePage {
  page: number | null;
  label: string;
  text: string;
}

export interface StudySummary {
  overview: string;
  keyConcepts: string[];
  reviewQuestions: string[];
}

export interface StudyCitation {
  page: number | null;
  label: string;
  excerpt: string;
}

export interface StudyMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  citations?: StudyCitation[];
  createdAt: string;
}

export interface StudySession {
  version: 1;
  id: string;
  file: {
    name: string;
    kind: StudyFileKind;
    type: string;
    size: number;
    pageCount: number;
    uploadedAt: string;
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

export interface StudyQuestionResult {
  answer: string;
  citations: StudyCitation[];
  grounded: boolean;
  provider: StudySession["provider"];
}

export interface StudyFileMetadata {
  name: string;
  size: number;
  type: string;
}
