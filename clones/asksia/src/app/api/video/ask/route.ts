import { NextResponse } from "next/server";
import { StudyProviderError } from "@/lib/study/provider";
import { loadServerVideoSession, saveServerVideoSession, VideoSessionStoreError } from "@/lib/video/session-store";
import { askVideoSession } from "@/lib/video/service";

function errorResponse(error: unknown) {
  if (error instanceof StudyProviderError || error instanceof VideoSessionStoreError) {
    return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
  }
  if (error instanceof RangeError) {
    return NextResponse.json({ error: error.message, code: "invalid_video_question" }, { status: 400 });
  }
  return NextResponse.json({ error: "无法回答该问题，请稍后重试。", code: "video_question_failed" }, { status: 500 });
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as { sessionId?: unknown; question?: unknown };
    if (typeof body.sessionId !== "string" || typeof body.question !== "string") {
      return NextResponse.json({ error: "学习记录和问题不能为空。", code: "invalid_video_question" }, { status: 400 });
    }
    const session = await loadServerVideoSession(body.sessionId);
    if (!session) return NextResponse.json({ error: "视频学习记录不存在。", code: "video_session_not_found" }, { status: 404 });
    const result = await askVideoSession(session, body.question);
    await saveServerVideoSession(result.session);
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: "请求内容不是有效 JSON。", code: "invalid_json" }, { status: 400 });
    }
    return errorResponse(error);
  }
}
