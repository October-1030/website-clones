import { NextResponse } from "next/server";
import { CloudAuthError, requireCloudUser } from "@/lib/cloud/server";
import { disconnectLmsConnection } from "@/lib/lms/service";
import { LmsError } from "@/lib/lms/types";
import { parseConnectionId } from "@/lib/lms/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const body = await request.json().catch(() => null) as { confirmation?: unknown } | null;
    if (body?.confirmation !== "DISCONNECT_LMS") {
      return NextResponse.json({
        error: "Disconnect confirmation is required.",
        code: "lms_disconnect_confirmation_required",
      }, { status: 400 });
    }
    const { id } = await context.params;
    const connectionId = parseConnectionId(id);
    const cloud = await requireCloudUser();
    await disconnectLmsConnection(cloud, connectionId);
    return NextResponse.json({ disconnected: true });
  } catch (error) {
    if (error instanceof CloudAuthError || error instanceof LmsError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
    }
    return NextResponse.json({ error: "Unable to disconnect the LMS account.", code: "lms_disconnect_failed" }, { status: 503 });
  }
}
