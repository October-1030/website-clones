import { NextResponse } from "next/server";
import { CloudAuthError } from "@/lib/cloud/server";
import { getAccountUsageStatus, UsageAccountingError } from "@/lib/usage/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json(await getAccountUsageStatus(), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof CloudAuthError || error instanceof UsageAccountingError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
    }
    return NextResponse.json({ error: "Unable to load account usage.", code: "usage_status_failed" }, { status: 503 });
  }
}