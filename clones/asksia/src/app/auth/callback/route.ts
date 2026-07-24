import { NextResponse } from "next/server";
import { createStudyPalServerClient } from "@/lib/cloud/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function safeNext(value: string | null): string {
  return value && value.startsWith("/") && !value.startsWith("//") ? value : "/pro/session";
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = safeNext(url.searchParams.get("next"));
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
