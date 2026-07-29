import { NextResponse } from "next/server";
import { createStudyPalServerClient } from "@/lib/cloud/server";
import { safeLocalRedirect } from "@/lib/http/safe-redirect";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = safeLocalRedirect(url.searchParams.get("next"));
  const redirect = new URL(next, url.origin);
  if (!code) {
    redirect.searchParams.set("cloudAuthError", "missing_code");
    return NextResponse.redirect(redirect);
  }
  const client = await createStudyPalServerClient();
  if (!client) {
    redirect.searchParams.set("cloudAuthError", "not_configured");
    return NextResponse.redirect(redirect);
  }
  const { error } = await client.auth.exchangeCodeForSession(code);
  if (error) redirect.searchParams.set("cloudAuthError", "exchange_failed");
  else redirect.searchParams.set("cloudAuth", "success");
  return NextResponse.redirect(redirect);
}
