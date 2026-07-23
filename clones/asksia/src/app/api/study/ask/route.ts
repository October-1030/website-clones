import { NextResponse } from "next/server";
import { studyProvider } from "@/lib/study/provider";
import type { StudySourcePage } from "@/lib/study/types";

export const runtime = "nodejs";

interface AskPayload {
  question?: unknown;
  fileName?: unknown;
  pages?: unknown;
}

function validPages(value: unknown): value is StudySourcePage[] {
  return Array.isArray(value) && value.length > 0 && value.length <= 500 && value.every((page) => {
    if (!page || typeof page !== "object") return false;
    const candidate = page as Partial<StudySourcePage>;
    return (candidate.page === null || typeof candidate.page === "number")
      && typeof candidate.label === "string"
      && typeof candidate.text === "string"
      && candidate.text.length <= 350_000;
  });
}

export async function POST(request: Request) {
  let payload: AskPayload;
  try {
    payload = await request.json() as AskPayload;
  } catch {
    return NextResponse.json({ error: "请求格式无效。", code: "invalid_json" }, { status: 400 });
  }

  const question = typeof payload.question === "string" ? payload.question.trim() : "";
  if (!question || question.length > 500) {
    return NextResponse.json({ error: "问题需为 1–500 个字符。", code: "invalid_question" }, { status: 400 });
  }
  if (!validPages(payload.pages)) {
    return NextResponse.json({ error: "缺少可用的资料内容。", code: "invalid_document" }, { status: 400 });
  }

  const fileName = typeof payload.fileName === "string" ? payload.fileName.slice(0, 240) : "学习资料";
  const result = await studyProvider.answer({ pages: payload.pages, fileName }, question);
  return NextResponse.json(result);
}
