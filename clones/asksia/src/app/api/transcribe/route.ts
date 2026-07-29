import { handleTranscribeRequest } from "@/lib/transcribe/route-handler";

export const runtime = "nodejs";

export async function POST(request: Request) {
  return handleTranscribeRequest(request);
}
