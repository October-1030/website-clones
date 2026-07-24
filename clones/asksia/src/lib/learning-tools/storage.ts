import {
  isLearningArtifact,
  LEARNING_ARTIFACTS_STORAGE_KEY,
  type LearningArtifact,
  type LearningToolKey,
} from "./types";

const MAX_STORED_ARTIFACTS = 20;

export function parseLearningArtifacts(raw: string | null): LearningArtifact[] {
  if (!raw) return [];
  try {
    const value: unknown = JSON.parse(raw);
    return Array.isArray(value) ? value.filter(isLearningArtifact).slice(0, MAX_STORED_ARTIFACTS) : [];
  } catch {
    return [];
  }
}

export function loadLearningArtifacts(storage: Pick<Storage, "getItem">): LearningArtifact[] {
  return parseLearningArtifacts(storage.getItem(LEARNING_ARTIFACTS_STORAGE_KEY));
}

export function saveLearningArtifact(storage: Pick<Storage, "getItem" | "setItem">, artifact: LearningArtifact): void {
  const existing = loadLearningArtifacts(storage).filter((item) => item.id !== artifact.id);
  storage.setItem(LEARNING_ARTIFACTS_STORAGE_KEY, JSON.stringify([artifact, ...existing].slice(0, MAX_STORED_ARTIFACTS)));
}

export function findLearningArtifact(
  storage: Pick<Storage, "getItem">,
  tool: LearningToolKey,
  sourceSessionId: string,
): LearningArtifact | null {
  return loadLearningArtifacts(storage).find((item) => item.tool === tool && item.sourceSessionId === sourceSessionId) ?? null;
}

export function deleteLearningArtifact(storage: Pick<Storage, "getItem" | "setItem">, id: string): void {
  storage.setItem(
    LEARNING_ARTIFACTS_STORAGE_KEY,
    JSON.stringify(loadLearningArtifacts(storage).filter((item) => item.id !== id)),
  );
}
