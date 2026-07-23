import { STUDY_SESSION_STORAGE_KEY, type StudySession } from "./types";

export function parseStoredStudySession(raw: string | null): StudySession | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Partial<StudySession>;
    if (
      value.version !== 1 ||
      typeof value.id !== "string" ||
      !value.file ||
      typeof value.file.name !== "string" ||
      !Array.isArray(value.pages) ||
      !value.summary ||
      !Array.isArray(value.summary.keyConcepts) ||
      !Array.isArray(value.summary.reviewQuestions) ||
      !Array.isArray(value.messages)
    ) return null;
    return value as StudySession;
  } catch {
    return null;
  }
}

export function loadStudySession(storage: Pick<Storage, "getItem">): StudySession | null {
  return parseStoredStudySession(storage.getItem(STUDY_SESSION_STORAGE_KEY));
}

export function saveStudySession(storage: Pick<Storage, "setItem">, session: StudySession): void {
  storage.setItem(STUDY_SESSION_STORAGE_KEY, JSON.stringify(session));
}

export function clearStudySession(storage: Pick<Storage, "removeItem">): void {
  storage.removeItem(STUDY_SESSION_STORAGE_KEY);
}
