import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { consumeAccountUsage, UsageAccountingError } from "@/lib/usage/service";
import {
  probeAudioDuration,
  transcribeAudio,
  TranscribeRunnerError,
  type TranscribeRunnerResult,
} from "@/lib/transcribe/runner";
import {
  saveServerTranscribeSession,
  transcribeTemporaryDirectory,
  TranscribeSessionStoreError,
} from "@/lib/transcribe/session-store";
import {
  MAX_TRANSCRIBE_DURATION_SECONDS,
  MAX_TRANSCRIBE_FILE_BYTES,
  type TranscribeSession,
} from "@/lib/transcribe/types";
import {
  extensionForMime,
  TranscribeValidationError,
  validateAudioBytes,
  validateSourceKind,
} from "@/lib/transcribe/validation";

type Transcriber = (audioPath: string, signal?: AbortSignal) => Promise<TranscribeRunnerResult>;
type AudioProber = (audioPath: string, signal?: AbortSignal) => Promise<number>;

function errorResponse(error: unknown) {
  if (
    error instanceof TranscribeValidationError
    || error instanceof TranscribeRunnerError
    || error instanceof TranscribeSessionStoreError
    || error instanceof UsageAccountingError
  ) {
    return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
  }
  return NextResponse.json(
    { error: "Unable to transcribe this recording.", code: "transcribe_failed" },
    { status: 500 },
  );
}

export async function handleTranscribeRequest(
  request: Request,
  transcriber: Transcriber = transcribeAudio,
  prober?: AudioProber,
) {
  let temporaryPath: string | null = null;
  try {
    const contentLength = Number(request.headers.get("content-length") || "0");
    if (Number.isFinite(contentLength) && contentLength > MAX_TRANSCRIBE_FILE_BYTES + 1024 * 1024) {
      throw new TranscribeValidationError(
        "The recording request is larger than 51 MB.",
        "audio_request_too_large",
        413,
      );
    }
    const formData = await request.formData();
    const audio = formData.get("audio");
    if (!(audio instanceof File)) {
      throw new TranscribeValidationError("Attach one audio recording.", "missing_audio");
    }
    const sourceKind = validateSourceKind(formData.get("sourceKind"));
    const bytes = new Uint8Array(await audio.arrayBuffer());
    const mimeType = validateAudioBytes(bytes, audio.type);
    const temporaryDirectory = transcribeTemporaryDirectory();
    await mkdir(temporaryDirectory, { recursive: true });
    temporaryPath = path.join(
      temporaryDirectory,
      `${crypto.randomUUID()}${extensionForMime(mimeType)}`,
    );
    await writeFile(temporaryPath, bytes, { flag: "wx" });

    const durationProbe = prober ?? (transcriber === transcribeAudio ? probeAudioDuration : null);
    const probedDuration = durationProbe
      ? await durationProbe(temporaryPath, request.signal)
      : null;
    if (probedDuration !== null && probedDuration > MAX_TRANSCRIBE_DURATION_SECONDS + 5) {
      throw new TranscribeValidationError(
        "Recordings are limited to 10 minutes.",
        "audio_too_long",
        413,
      );
    }

    let usage = probedDuration === null
      ? null
      : await consumeAccountUsage({ recordingSeconds: Math.max(1, Math.ceil(probedDuration)) });
    const result = await transcriber(temporaryPath, request.signal);
    if (result.durationSeconds > MAX_TRANSCRIBE_DURATION_SECONDS + 5) {
      throw new TranscribeValidationError(
        "Recordings are limited to 10 minutes.",
        "audio_too_long",
        413,
      );
    }
    if (
      probedDuration !== null
      && result.durationSeconds > probedDuration + 10
    ) {
      throw new TranscribeValidationError(
        "The recording duration changed during processing.",
        "audio_duration_mismatch",
        422,
      );
    }
    if (!result.text || result.segments.length === 0) {
      throw new TranscribeValidationError(
        "No speech was detected in this recording.",
        "no_speech_detected",
        422,
      );
    }
    usage ??= await consumeAccountUsage({
      recordingSeconds: Math.max(1, Math.ceil(result.durationSeconds)),
    });
    const now = new Date().toISOString();
    const session: TranscribeSession = {
      version: 1,
      id: crypto.randomUUID(),
      source: {
        kind: sourceKind,
        fileName: audio.name.slice(0, 200) || `recording${extensionForMime(mimeType)}`,
        mimeType,
        sizeBytes: audio.size,
        durationSeconds: result.durationSeconds,
        capturedAt: now,
      },
      provider: result.provider,
      language: result.language,
      languageProbability: result.languageProbability,
      text: result.text,
      segments: result.segments,
      createdAt: now,
      updatedAt: now,
    };
    await saveServerTranscribeSession(session);
    return NextResponse.json(
      { session, usage },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return errorResponse(error);
  } finally {
    if (temporaryPath) {
      await unlink(temporaryPath).catch(() => {
        console.warn("StudyPal could not remove a temporary transcription file.");
      });
    }
  }
}
