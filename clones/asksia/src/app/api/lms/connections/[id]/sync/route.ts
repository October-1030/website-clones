import { NextResponse } from "next/server";
import { CloudAuthError, requireCloudUser } from "@/lib/cloud/server";
import { syncLmsConnection } from "@/lib/lms/service";
import { LmsError } from "@/lib/lms/types";
import { parseConnectionId } from "@/lib/lms/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const connectionId = parseConnectionId(id);
    const cloud = await requireCloudUser();
    return NextResponse.json(await syncLmsConnection(cloud, connectionId));
  } catch (error) {
    if (error instanceof CloudAuthError || error instanceof LmsError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
    }
    return NextResponse.json({ error: "Unable to synchronize the LMS connection.", code: "lms_sync_failed" }, { status: 503 });
  }
}
