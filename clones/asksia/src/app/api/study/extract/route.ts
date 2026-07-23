import { NextResponse } from "next/server";
import { extractStudyDocument } from "@/lib/study/extract";
import { StudyFileError, validateStudyFile } from "@/lib/study/file-validation";
import { studyProvider } from "@/lib/study/provider";
import type { StudySession } from "@/lib/study/types";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "请选择一份 PDF 或 TXT 学习资料。", code: "missing" }, { status: 400 });
    }

    const validation = validateStudyFile(file);
    if (!validation.valid) {
      return NextResponse.json({ error: validation.error, code: validation.code }, { status: 400 });
    }

    const bytes = new Uint8Array(await file.arrayBuffer());
    const extracted = await extractStudyDocument(bytes, validation.kind);
    const document = { pages: extracted.pages, fileName: file.name };
    const summary = await studyProvider.summarize(document);
    const now = new Date().toISOString();
    const session: StudySession = {
      version: 1,
      id: crypto.randomUUID(),
      file: {
        name: file.name,
        kind: validation.kind,
        type: file.type || (validation.kind === "pdf" ? "application/pdf" : "text/plain"),
        size: file.size,
        pageCount: extracted.pageCount,
        uploadedAt: now,
      },
      provider: { id: studyProvider.id, mode: studyProvider.mode, label: studyProvider.label },
      pages: extracted.pages,
      summary,
      messages: [],
      truncated: extracted.truncated,
      createdAt: now,
      updatedAt: now,
    };

    return NextResponse.json({ session });
  } catch (error) {
    if (error instanceof StudyFileError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
    }
    return NextResponse.json({ error: "资料处理失败，请稍后重试。", code: "processing_failed" }, { status: 500 });
  }
}
