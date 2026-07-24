import type { StudyCitation } from "../study/types";

export const LEARNING_ARTIFACTS_STORAGE_KEY = "studypal.learning-artifacts.v1";

export type LearningToolKey = "quiz" | "study-guide" | "flashcard";

interface ArtifactBase {
  version: 1;
  id: string;
  tool: LearningToolKey;
  sourceSessionId: string;
  sourceName: string;
  createdAt: string;
  updatedAt: string;
}

export interface QuizQuestion {
  id: string;
  prompt: string;
  options: string[];
  correctIndex: number;
  explanation: string;
  citation: StudyCitation;
}

export interface QuizArtifact extends ArtifactBase {
  tool: "quiz";
  title: string;
  questions: QuizQuestion[];
  answers: Record<string, number>;
}

export interface StudyGuideArtifact extends ArtifactBase {
  tool: "study-guide";
  title: string;
  overview: string;
  keyConcepts: string[];
  outline: Array<{ heading: string; notes: string; citation: StudyCitation }>;
  reviewQuestions: string[];
  studyPlan: Array<{ title: string; task: string; completed: boolean }>;
}

export interface FlashcardItem {
  id: string;
  front: string;
  back: string;
  citation: StudyCitation;
}

export interface FlashcardArtifact extends ArtifactBase {
  tool: "flashcard";
  title: string;
  cards: FlashcardItem[];
}

export type LearningArtifact = QuizArtifact | StudyGuideArtifact | FlashcardArtifact;

export function isLearningArtifact(value: unknown): value is LearningArtifact {
  if (!value || typeof value !== "object") return false;
  const artifact = value as Partial<LearningArtifact>;
  return artifact.version === 1
    && typeof artifact.id === "string"
    && (artifact.tool === "quiz" || artifact.tool === "study-guide" || artifact.tool === "flashcard")
    && typeof artifact.sourceSessionId === "string"
    && typeof artifact.sourceName === "string"
    && typeof artifact.createdAt === "string"
    && typeof artifact.updatedAt === "string";
}
