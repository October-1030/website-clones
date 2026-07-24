import { isWritingArtifact, WRITING_ARTIFACTS_STORAGE_KEY, type WritingArtifact } from "./types";

export function parseWritingArtifacts(raw: string | null): WritingArtifact[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(isWritingArtifact).slice(0, 10) : [];
  } catch {
    return [];
  }
}

export function loadWritingArtifacts(storage: Pick<Storage, "getItem">): WritingArtifact[] {
  return parseWritingArtifacts(storage.getItem(WRITING_ARTIFACTS_STORAGE_KEY));
}

export function saveWritingArtifact(storage: Pick<Storage, "getItem" | "setItem">, artifact: WritingArtifact): void {
  const other = loadWritingArtifacts(storage).filter((item) => item.id !== artifact.id && item.kind !== artifact.kind);
  storage.setItem(WRITING_ARTIFACTS_STORAGE_KEY, JSON.stringify([artifact, ...other].slice(0, 10)));
}

export function findWritingArtifact(storage: Pick<Storage, "getItem">, kind: WritingArtifact["kind"]): WritingArtifact | null {
  return loadWritingArtifacts(storage).find((item) => item.kind === kind) ?? null;
}

export function deleteWritingArtifact(storage: Pick<Storage, "getItem" | "setItem">, id: string): void {
  storage.setItem(WRITING_ARTIFACTS_STORAGE_KEY, JSON.stringify(loadWritingArtifacts(storage).filter((item) => item.id !== id)));
}
