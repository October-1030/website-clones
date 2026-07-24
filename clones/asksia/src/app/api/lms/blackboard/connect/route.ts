import { NextResponse } from "next/server";
import { CloudAuthError, requireCloudUser } from "@/lib/cloud/server";
import { connectBlackboardAccount } from "@/lib/lms/service";
import { LmsError } from "@/lib/lms/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const context = await requireCloudUser();
    const result = await connectBlackboardAccount(context);
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    if (error instanceof CloudAuthError || error instanceof LmsError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
    }
    return NextResponse.json({ error: "Unable to connect Blackboard.", code: "blackboard_connect_failed" }, { status: 503 });
  }
}
