import { NextResponse } from "next/server";
import { getCloudAuthContext } from "@/lib/cloud/server";
import { getSupabasePublicConfig } from "@/lib/cloud/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const configured = Boolean(getSupabasePublicConfig());
    if (!configured) return NextResponse.json({ configured: false, authenticated: false });
    const context = await getCloudAuthContext();
    if (context.state !== "authenticated") {
      return NextResponse.json({ configured: true, authenticated: false });
    }
    const { data, error } = await context.client
      .from("profiles")
      .select("display_name,preferences,plan,updated_at")
      .eq("user_id", context.user.id)
      .maybeSingle();
    if (error) throw error;
    return NextResponse.json({
      configured: true,
      authenticated: true,
      user: { id: context.user.id, email: context.user.email || null },
      profile: data || null,
    }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Unable to read cloud account status.", code: "cloud_status_failed" }, { status: 503 });
  }
}
