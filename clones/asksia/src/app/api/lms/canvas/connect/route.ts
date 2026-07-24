import { NextResponse } from "next/server";
import { CloudAuthError, requireCloudUser } from "@/lib/cloud/server";
import { connectCanvasAccount } from "@/lib/lms/service";
import { LmsError } from "@/lib/lms/types";
import { parseCanvasConnectionInput } from "@/lib/lms/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const contentLength = Number(request.headers.get("content-length") || "0");
    if (contentLength > 12_000) {
      return NextResponse.json({ error: "Canvas connection request is too large.", code: "request_too_large" }, { status: 413 });
    }
    const input = parseCanvasConnectionInput(await request.json());
    const context = await requireCloudUser();
    const result = await connectCanvasAccount(context, input);
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    if (error instanceof CloudAuthError || error instanceof LmsError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
    }
    return NextResponse.json({ error: "Unable to connect Canvas.", code: "canvas_connect_failed" }, { status: 503 });
  }
}
