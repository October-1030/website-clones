import { MAX_STUDY_FILE_BYTES, type StudyFileKind, type StudyFileMetadata } from "./types";

export type StudyFileValidation =
  | { valid: true; kind: StudyFileKind }
  | { valid: false; error: string; code: "missing" | "empty" | "too_large" | "unsupported" | "type_mismatch" };

const allowedMimeTypes: Record<StudyFileKind, Set<string>> = {
  pdf: new Set(["application/pdf"]),
  txt: new Set(["text/plain", "application/octet-stream"]),
};

export function validateStudyFile(file: StudyFileMetadata | null | undefined): StudyFileValidation {
  if (!file) return { valid: false, code: "missing", error: "请选择一份 PDF 或 TXT 学习资料。" };
  if (file.size <= 0) return { valid: false, code: "empty", error: "文件为空，请重新选择。" };
  if (file.size > MAX_STUDY_FILE_BYTES) return { valid: false, code: "too_large", error: "文件不能超过 10 MB。" };

  const extension = file.name.toLowerCase().split(".").pop();
  const kind: StudyFileKind | null = extension === "pdf" ? "pdf" : extension === "txt" ? "txt" : null;
  if (!kind) return { valid: false, code: "unsupported", error: "目前仅支持 PDF 和 TXT 文件。" };

  const normalizedType = file.type.toLowerCase().trim();
  if (normalizedType && !allowedMimeTypes[kind].has(normalizedType)) {
    return { valid: false, code: "type_mismatch", error: "文件扩展名与内容类型不匹配，请检查后重试。" };
  }
  return { valid: true, kind };
}

export function assertPdfSignature(bytes: Uint8Array): void {
  const signature = new TextDecoder("ascii").decode(bytes.slice(0, 5));
  if (signature !== "%PDF-") throw new StudyFileError("这不是有效的 PDF 文件。", "invalid_pdf", 422);
}

export function assertPlainText(bytes: Uint8Array): string {
  if (bytes.includes(0)) throw new StudyFileError("TXT 文件包含二进制内容，无法解析。", "invalid_text", 422);
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes).replace(/^\uFEFF/, "");
  } catch {
    throw new StudyFileError("TXT 文件必须使用 UTF-8 编码。", "invalid_text_encoding", 422);
  }
}

export class StudyFileError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly status = 400,
  ) {
    super(message);
    this.name = "StudyFileError";
  }
}
