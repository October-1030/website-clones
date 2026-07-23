import { NextResponse } from "next/server";
import { getStudyProvider, StudyProviderError } from "@/lib/study/provider";
import { loadServerStudySession, saveServerStudySession, StudySessionStoreError } from "@/lib/study/session-store";
import type { StudySession, StudySourcePage } from "@/lib/study/types";

export const runtime = "nodejs";

interface AskPayload {
  question?: unknown;
  sessionId?: unknown;
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

function knownError(error: unknown) {
  if (error instanceof StudyProviderError || error instanceof StudySessionStoreError) {
    return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
  }
  return NextResponse.json({ error: "追问处理失败，请稍后重试。", code: "ask_failed" }, { status: 500 });
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
    return NextResponse.json({ error: "问题需要 1–500 个字符。", code: "invalid_question" }, { status: 400 });
  }

  try {
    const provider = getStudyProvider();
    const sessionId = typeof payload.sessionId === "string" ? payload.sessionId.trim() : "";
    let session: StudySession | null = null;
    if (sessionId) {
      session = await loadServerStudySession(sessionId);
      if (!session) return NextResponse.json({ error: "没有找到这条学习记录。", code: "session_not_found" }, { status: 404 });
    }

    const pages = session?.pages ?? payload.pages;
    if (!validPages(pages)) {
      return NextResponse.json({ error: "缺少可用的资料内容。", code: "invalid_document" }, { status: 400 });
    }
    const fileName = session?.file.name ?? (typeof payload.fileName === "string" ? payload.fileName.slice(0, 240) : "学习资料");
    const result = await provider.answer({ pages, fileName }, question);

    if (!session) return NextResponse.json(result);

    const userCreatedAt = new Date().toISOString();
    const assistantCreatedAt = new Date().toISOString();
    const updated: StudySession = {
      ...session,
      provider: result.provider,
      messages: [
        ...session.messages,
        { id: crypto.randomUUID(), role: "user", content: question, createdAt: userCreatedAt },
        { id: crypto.randomUUID(), role: "assistant", content: result.answer, citations: result.citations, createdAt: assistantCreatedAt },
      ],
      updatedAt: assistantCreatedAt,
    };
    await saveServerStudySession(updated);
    return NextResponse.json({ ...result, session: updated });
  } catch (error) {
    return knownError(error);
  }
}
