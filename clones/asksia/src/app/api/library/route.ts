import { NextResponse } from "next/server";
import { listLibraryItems } from "@/lib/library";

export const runtime = "nodejs";

export async function GET() {
  try {
    const items = await listLibraryItems();
    return NextResponse.json({ items }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Unable to read the local library.", code: "library_read_failed" }, { status: 500 });
  }
}
