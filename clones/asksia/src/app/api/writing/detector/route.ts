import { NextResponse } from "next/server";
import { RequestOriginError, requireSameOriginMutation } from "@/lib/http/same-origin";
import { consumeAccountUsage, UsageAccountingError } from "@/lib/usage/service";
import { analyzeWritingSignals } from "@/lib/writing-tools/analyzer";
import { MAX_WRITING_CHARS } from "@/lib/writing-tools/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    requireSameOriginMutation(request);
    const contentLength = Number(request.headers.get("content-length") || "0");
    if (Number.isFinite(contentLength) && contentLength > MAX_WRITING_CHARS + 2_048) {
      return NextResponse.json({ error: "Writing sample is too large.", code: "request_too_large" }, { status: 413 });
    }
    const body = await request.json().catch(() => null) as { text?: unknown } | null;
    const text = typeof body?.text === "string" ? body.text.trim() : "";
    if (text.length < 80 || text.length > MAX_WRITING_CHARS) {
      return NextResponse.json({ error: `Writing sample must contain 80 to ${MAX_WRITING_CHARS.toLocaleString()} characters.`, code: "invalid_writing_sample" }, { status: 400 });
    }
    const artifact = analyzeWritingSignals(text);
    const usage = await consumeAccountUsage({ aiDetectionChars: artifact.characterCount });
    return NextResponse.json({ artifact, usage }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof RequestOriginError || error instanceof UsageAccountingError) {
      return NextResponse.json({ error: error.message, code: error.code, dimension: error instanceof UsageAccountingError ? error.dimension : null }, { status: error.status });
    }
    return NextResponse.json({ error: "Unable to review writing signals.", code: "writing_detector_failed" }, { status: 500 });
  }
}