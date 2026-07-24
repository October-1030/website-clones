import { NextResponse } from "next/server";
import { parseCloudProfilePatch } from "@/lib/cloud/profile";
import { CloudAuthError, requireCloudUser } from "@/lib/cloud/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(request: Request) {
  try {
    const contentLength = Number(request.headers.get("content-length") || "0");
    if (contentLength > 8_192) {
      return NextResponse.json({ error: "Profile update is too large.", code: "request_too_large" }, { status: 413 });
    }
    const patch = parseCloudProfilePatch(await request.json());
    const context = await requireCloudUser();
    const values: Record<string, unknown> = {};
    if (patch.displayName) values.display_name = patch.displayName;
    if (patch.preferences) values.preferences = patch.preferences;
    const { data, error } = await context.client
      .from("profiles")
      .update(values)
      .eq("user_id", context.user.id)
      .select("display_name,preferences,plan,updated_at")
      .single();
    if (error) throw error;
    return NextResponse.json({ profile: data });
  } catch (error) {
    if (error instanceof CloudAuthError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
    }
    const message = error instanceof Error ? error.message : "Unable to update the cloud profile.";
    const invalid = /invalid|must|choose|provided/i.test(message);
    return NextResponse.json({ error: message, code: invalid ? "invalid_profile" : "cloud_profile_failed" }, { status: invalid ? 400 : 503 });
  }
}
