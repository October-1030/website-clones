import { NextResponse } from "next/server";
import {
  deleteServerTranscribeSession,
  loadServerTranscribeSession,
  TranscribeSessionStoreError,
} from "@/lib/transcribe/session-store";

type RouteContext = { params: Promise<{ id: string }> };

function errorResponse(error: unknown) {
  if (error instanceof TranscribeSessionStoreError) {
    return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
  }
  return NextResponse.json({ error: "Unable to read this transcription session.", code: "transcribe_session_failed" }, { status: 500 });
}

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const session = await loadServerTranscribeSession(id);
    if (!session) {
      return NextResponse.json({ error: "Transcription session not found.", code: "transcribe_session_not_found" }, { status: 404 });
    }
    return NextResponse.json({ session }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    return NextResponse.json({ deleted: await deleteServerTranscribeSession(id) });
  } catch (error) {
    return errorResponse(error);
  }
}
