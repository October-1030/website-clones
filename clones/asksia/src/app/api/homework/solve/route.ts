import { NextResponse } from "next/server";
import { HomeworkSessionStoreError, saveServerHomeworkSession } from "@/lib/homework/session-store";
import { MAX_HOMEWORK_PROBLEM_CHARS, type HomeworkSession } from "@/lib/homework/types";
import { getStudyProvider, StudyProviderError } from "@/lib/study/provider";

export const runtime = "nodejs";

export async function POST(request: Request) {
  let payload: { problem?: unknown };
  try {
    payload = await request.json() as { problem?: unknown };
  } catch {
    return NextResponse.json({ error: "请求格式无效。", code: "invalid_json" }, { status: 400 });
  }

  const problem = typeof payload.problem === "string" ? payload.problem.trim() : "";
  if (problem.length < 3 || problem.length > MAX_HOMEWORK_PROBLEM_CHARS) {
    return NextResponse.json({ error: `题目需要 3–${MAX_HOMEWORK_PROBLEM_CHARS.toLocaleString()} 个字符。`, code: "invalid_problem" }, { status: 400 });
  }

  try {
    const provider = getStudyProvider();
    const solution = await provider.solveHomework(problem);
    const now = new Date().toISOString();
    const session: HomeworkSession = {
      version: 1,
      id: crypto.randomUUID(),
      problem,
      solution,
      provider: { id: provider.id, mode: provider.mode, label: provider.label },
      createdAt: now,
      updatedAt: now,
    };
    await saveServerHomeworkSession(session);
    return NextResponse.json({ session });
  } catch (error) {
    if (error instanceof StudyProviderError || error instanceof HomeworkSessionStoreError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
    }
    return NextResponse.json({ error: "作业解题失败，请稍后重试。", code: "homework_failed" }, { status: 500 });
  }
}
