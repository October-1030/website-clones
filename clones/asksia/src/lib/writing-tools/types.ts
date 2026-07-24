export const WRITING_ARTIFACTS_STORAGE_KEY = "studypal.writing-artifacts.v1";
export const MAX_WRITING_CHARS = 10_000;

export interface EssayArtifact {
  version: 1;
  id: string;
  kind: "essay";
  topic: string;
  draft: string;
  thesisOptions: string[];
  outline: Array<{ heading: string; guidance: string }>;
  feedback: {
    wordCount: number;
    paragraphCount: number;
    averageSentenceWords: number;
    longSentenceCount: number;
    transitionCount: number;
    citationMarkerCount: number;
    checklist: string[];
  };
  createdAt: string;
  updatedAt: string;
}

export interface WritingSignal {
  label: string;
  value: string;
  interpretation: string;
  level: "neutral" | "notice" | "review";
}

export interface DetectorArtifact {
  version: 1;
  id: string;
  kind: "detector";
  text: string;
  wordCount: number;
  characterCount: number;
  verdict: "indeterminate";
  signals: WritingSignal[];
  repeatedPhrases: string[];
  recommendations: string[];
  createdAt: string;
  updatedAt: string;
}

export type WritingArtifact = EssayArtifact | DetectorArtifact;

export function isWritingArtifact(value: unknown): value is WritingArtifact {
  if (!value || typeof value !== "object") return false;
  const artifact = value as Partial<WritingArtifact>;
  return artifact.version === 1
    && typeof artifact.id === "string"
    && (artifact.kind === "essay" || artifact.kind === "detector")
    && typeof artifact.createdAt === "string"
    && typeof artifact.updatedAt === "string";
}
