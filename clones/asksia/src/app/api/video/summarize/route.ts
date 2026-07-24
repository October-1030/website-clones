import { NextResponse } from "next/server";
import { StudyProviderError } from "@/lib/study/provider";
import { saveServerVideoSession, VideoSessionStoreError } from "@/lib/video/session-store";
import { createVideoSession } from "@/lib/video/service";
import { MediaSourceError } from "@/lib/video/source";

function errorResponse(error: unknown) {
  if (error instanceof MediaSourceError || error instanceof StudyProviderError || error instanceof VideoSessionStoreError) {
    return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
  }
  return NextResponse.json({ error: "无法完成视频总结，请稍后重试。", code: "video_summary_failed" }, { status: 500 });
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as { url?: unknown };
    if (typeof body.url !== "string") {
      return NextResponse.json({ error: "请输入视频或播客链接。", code: "invalid_media_url" }, { status: 400 });
    }
    const session = await createVideoSession(body.url);
    await saveServerVideoSession(session);
    return NextResponse.json({ session });
  } catch (error) {
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: "请求内容不是有效 JSON。", code: "invalid_json" }, { status: 400 });
    }
    return errorResponse(error);
  }
}
