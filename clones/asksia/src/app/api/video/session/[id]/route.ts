import { NextResponse } from "next/server";
import { deleteServerVideoSession, loadServerVideoSession, VideoSessionStoreError } from "@/lib/video/session-store";

type RouteContext = { params: Promise<{ id: string }> };

function errorResponse(error: unknown) {
  if (error instanceof VideoSessionStoreError) {
    return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
  }
  return NextResponse.json({ error: "无法读取视频学习记录。", code: "video_session_failed" }, { status: 500 });
}

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const session = await loadServerVideoSession(id);
    if (!session) return NextResponse.json({ error: "视频学习记录不存在。", code: "video_session_not_found" }, { status: 404 });
    return NextResponse.json({ session });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const deleted = await deleteServerVideoSession(id);
    return NextResponse.json({ deleted });
  } catch (error) {
    return errorResponse(error);
  }
}
