import { NextResponse } from "next/server";
import { CloudAuthError, requireCloudUser } from "@/lib/cloud/server";
import { connectMoodleAccount } from "@/lib/lms/service";
import { LmsError } from "@/lib/lms/types";
import { parseMoodleConnectionInput } from "@/lib/lms/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const context = await requireCloudUser();
    const body = await request.json().catch(() => null);
    const input = parseMoodleConnectionInput(body);
    const result = await connectMoodleAccount(context, input);
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    if (error instanceof CloudAuthError || error instanceof LmsError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
    }
    return NextResponse.json({ error: "Unable to connect Moodle.", code: "moodle_connect_failed" }, { status: 503 });
  }
}