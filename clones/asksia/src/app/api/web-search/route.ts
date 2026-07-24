import { NextResponse } from "next/server";
import { searchPublicKnowledge } from "@/lib/web-search/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const contentLength = Number(request.headers.get("content-length") || "0");
    if (contentLength > 4_096) {
      return NextResponse.json({ error: "Search request is too large.", code: "request_too_large" }, { status: 413 });
    }
    const body = await request.json() as { query?: unknown };
    if (typeof body.query !== "string") {
      return NextResponse.json({ error: "A search query is required.", code: "invalid_query" }, { status: 400 });
    }
    const result = await searchPublicKnowledge(body.query);
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Public search is unavailable.";
    const status = /2 to 200/.test(message) ? 400 : 502;
    return NextResponse.json({ error: message, code: status === 400 ? "invalid_query" : "search_unavailable" }, { status });
  }
}
