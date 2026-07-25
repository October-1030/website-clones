import { NextResponse } from "next/server";
import { CloudAuthError, requireCloudUser } from "@/lib/cloud/server";
import { summarizeExtensionCapture } from "@/lib/extension/service";
import { ExtensionSyncError } from "@/lib/extension/types";
import { parseExtensionId, requireSameOriginMutation } from "@/lib/extension/validation";
import { StudyProviderError } from "@/lib/study/provider";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: RouteContext) {
  try {
    requireSameOriginMutation(request);
    const { id } = await context.params;
    const cloud = await requireCloudUser();
    const result = await summarizeExtensionCapture(cloud, parseExtensionId(id));
    return NextResponse.json({ sessionId: result.session.id, href: result.href });
  } catch (error) {
    if (error instanceof CloudAuthError || error instanceof ExtensionSyncError || error instanceof StudyProviderError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
    }
    return NextResponse.json({ error: "Unable to summarize the captured webpage.", code: "extension_summary_failed" }, { status: 503 });
  }
}
