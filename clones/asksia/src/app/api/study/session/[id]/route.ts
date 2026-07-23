import { NextResponse } from "next/server";
import { deleteServerStudySession, loadServerStudySession, StudySessionStoreError } from "@/lib/study/session-store";

export const runtime = "nodejs";

interface RouteContext {
  params: Promise<{ id: string }>;
}

function storeError(error: unknown) {
  if (error instanceof StudySessionStoreError) {
    return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
  }
  return NextResponse.json({ error: "学习记录操作失败。", code: "session_operation_failed" }, { status: 500 });
}

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const session = await loadServerStudySession(id);
    if (!session) return NextResponse.json({ error: "没有找到这条学习记录。", code: "session_not_found" }, { status: 404 });
    return NextResponse.json({ session });
  } catch (error) {
    return storeError(error);
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const deleted = await deleteServerStudySession(id);
    return NextResponse.json({ deleted });
  } catch (error) {
    return storeError(error);
  }
}
