import { NextResponse } from "next/server";
import { getDeploymentMode } from "@/lib/cloud/config";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(
    {
      status: "ok",
      service: "studypal-ai",
      mode: getDeploymentMode(),
      timestamp: new Date().toISOString(),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
