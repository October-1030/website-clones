import { MAX_TRANSCRIBE_FILE_BYTES, type TranscribeSourceKind } from "./types";

const MIME_TYPES = new Set([
  "audio/wav",
  "audio/x-wav",
  "audio/webm",
  "audio/ogg",
  "audio/mpeg",
  "audio/mp3",
  "audio/mp4",
  "audio/x-m4a",
  "video/webm",
]);

export class TranscribeValidationError extends Error {
  constructor(message: string, public readonly code: string, public readonly status = 400) {
    super(message);
    this.name = "TranscribeValidationError";
  }
}

export function normalizeMimeType(value: string): string {
  return value.toLowerCase().split(";", 1)[0].trim();
}

export function validateSourceKind(value: unknown): TranscribeSourceKind {
  if (value === "microphone" || value === "browser-tab") return value;
  throw new TranscribeValidationError("Choose either microphone or browser-tab audio.", "invalid_audio_source");
}

function hasMagic(bytes: Uint8Array, expected: number[], offset = 0): boolean {
  return expected.every((byte, index) => bytes[offset + index] === byte);
}

export function validateAudioBytes(bytes: Uint8Array, mimeType: string): string {
  const normalized = normalizeMimeType(mimeType);
  if (!MIME_TYPES.has(normalized)) {
    throw new TranscribeValidationError("Use WAV, WebM, OGG, MP3, MP4, or M4A audio.", "unsupported_audio_type", 415);
  }
  if (bytes.byteLength === 0) throw new TranscribeValidationError("The recording is empty.", "empty_audio");
  if (bytes.byteLength > MAX_TRANSCRIBE_FILE_BYTES) {
    throw new TranscribeValidationError("The recording is larger than 50 MB.", "audio_too_large", 413);
  }

  const signatureMatches =
    ((normalized === "audio/wav" || normalized === "audio/x-wav")
      && hasMagic(bytes, [0x52, 0x49, 0x46, 0x46])
      && hasMagic(bytes, [0x57, 0x41, 0x56, 0x45], 8))
    || ((normalized === "audio/webm" || normalized === "video/webm")
      && hasMagic(bytes, [0x1a, 0x45, 0xdf, 0xa3]))
    || (normalized === "audio/ogg" && hasMagic(bytes, [0x4f, 0x67, 0x67, 0x53]))
    || ((normalized === "audio/mpeg" || normalized === "audio/mp3")
      && (hasMagic(bytes, [0x49, 0x44, 0x33]) || (bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0)))
    || ((normalized === "audio/mp4" || normalized === "audio/x-m4a")
      && hasMagic(bytes, [0x66, 0x74, 0x79, 0x70], 4));

  if (!signatureMatches) {
    throw new TranscribeValidationError("The file signature does not match its audio type.", "invalid_audio_signature", 415);
  }
  return normalized;
}

export function extensionForMime(mimeType: string): string {
  const normalized = normalizeMimeType(mimeType);
  if (normalized === "audio/wav" || normalized === "audio/x-wav") return ".wav";
  if (normalized === "audio/ogg") return ".ogg";
  if (normalized === "audio/mpeg" || normalized === "audio/mp3") return ".mp3";
  if (normalized === "audio/mp4" || normalized === "audio/x-m4a") return ".m4a";
  return ".webm";
}
