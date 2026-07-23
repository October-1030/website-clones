import { NextResponse } from "next/server";
import { deleteServerHomeworkSession, HomeworkSessionStoreError, loadServerHomeworkSession } from "@/lib/homework/session-store";

export const runtime = "nodejs";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const session = await loadServerHomeworkSession(id);
    if (!session) return NextResponse.json({ error: "没有找到这条作业记录。", code: "homework_session_not_found" }, { status: 404 });
    return NextResponse.json({ session });
  } catch (error) {
    if (error instanceof HomeworkSessionStoreError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
    }
    return NextResponse.json({ error: "无法读取作业记录。", code: "homework_session_read_failed" }, { status: 500 });
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const deleted = await deleteServerHomeworkSession(id);
    return NextResponse.json({ deleted });
  } catch (error) {
    if (error instanceof HomeworkSessionStoreError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
    }
    return NextResponse.json({ error: "无法删除作业记录。", code: "homework_session_delete_failed" }, { status: 500 });
  }
}
