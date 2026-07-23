import { HOMEWORK_SESSION_STORAGE_KEY, type HomeworkSession } from "./types";

export function parseStoredHomeworkSession(raw: string | null): HomeworkSession | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Partial<HomeworkSession>;
    if (
      value.version !== 1
      || typeof value.id !== "string"
      || typeof value.problem !== "string"
      || !value.solution
      || typeof value.solution.problemRestatement !== "string"
      || !Array.isArray(value.solution.knowns)
      || !Array.isArray(value.solution.steps)
      || typeof value.solution.finalAnswer !== "string"
      || typeof value.solution.verification !== "string"
      || !value.provider
      || typeof value.provider.id !== "string"
    ) return null;
    return value as HomeworkSession;
  } catch {
    return null;
  }
}

export function loadHomeworkSession(storage: Pick<Storage, "getItem">): HomeworkSession | null {
  return parseStoredHomeworkSession(storage.getItem(HOMEWORK_SESSION_STORAGE_KEY));
}

export function saveHomeworkSession(storage: Pick<Storage, "setItem">, session: HomeworkSession): void {
  storage.setItem(HOMEWORK_SESSION_STORAGE_KEY, JSON.stringify(session));
}

export function clearHomeworkSession(storage: Pick<Storage, "removeItem">): void {
  storage.removeItem(HOMEWORK_SESSION_STORAGE_KEY);
}
