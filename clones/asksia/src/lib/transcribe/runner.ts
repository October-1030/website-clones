import { spawn } from "node:child_process";
import type { TranscribeSegment } from "./types";

const MAX_OUTPUT_BYTES = 2 * 1024 * 1024;
const DEFAULT_TIMEOUT_MS = 5 * 60 * 1000;

export interface TranscribeRunnerResult {
  text: string;
  language: string | null;
  languageProbability: number | null;
  durationSeconds: number;
  segments: TranscribeSegment[];
  provider: {
    id: string;
    label: string;
    device: string;
  };
}

export class TranscribeRunnerError extends Error {
  constructor(message: string, public readonly code: string, public readonly status = 500) {
    super(message);
    this.name = "TranscribeRunnerError";
  }
}

function pythonExecutable(): string {
  const configured = process.env.STUDYPAL_TRANSCRIBE_PYTHON?.trim();
  if (configured) return configured;
  if (process.platform === "win32" && process.env.LOCALAPPDATA) {
    return `${process.env.LOCALAPPDATA}\\Programs\\Python\\Python313\\python.exe`;
  }
  return process.platform === "win32" ? "python.exe" : "python3";
}

function parseResult(raw: string, model: string, device: string): TranscribeRunnerResult {
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    throw new TranscribeRunnerError("The local speech engine returned invalid output.", "transcribe_invalid_output");
  }
  if (!value || typeof value !== "object") {
    throw new TranscribeRunnerError("The local speech engine returned no transcript.", "transcribe_empty_output");
  }
  const result = value as {
    text?: unknown;
    language?: unknown;
    languageProbability?: unknown;
    durationSeconds?: unknown;
    segments?: unknown;
  };
  if (typeof result.text !== "string" || typeof result.durationSeconds !== "number" || !Array.isArray(result.segments)) {
    throw new TranscribeRunnerError("The local speech engine returned an incomplete transcript.", "transcribe_invalid_output");
  }
  const segments = result.segments.filter((segment): segment is TranscribeSegment => {
    if (!segment || typeof segment !== "object") return false;
    const item = segment as Partial<TranscribeSegment>;
    return typeof item.startSeconds === "number" && typeof item.endSeconds === "number" && typeof item.text === "string";
  });
  return {
    text: result.text.trim(),
    language: typeof result.language === "string" ? result.language : null,
    languageProbability: typeof result.languageProbability === "number" ? result.languageProbability : null,
    durationSeconds: result.durationSeconds,
    segments,
    provider: {
      id: `faster-whisper:${model}`,
      label: `Faster-Whisper · ${model}`,
      device,
    },
  };
}

export async function transcribeAudio(audioPath: string, signal?: AbortSignal): Promise<TranscribeRunnerResult> {
  const executable = pythonExecutable();
  const script = process.env.STUDYPAL_TRANSCRIBE_SCRIPT?.trim() || "scripts/transcribe-audio.py";
  const model = process.env.STUDYPAL_TRANSCRIBE_MODEL?.trim() || "small";
  const device = process.env.STUDYPAL_TRANSCRIBE_DEVICE?.trim() || "cpu";
  const computeType = process.env.STUDYPAL_TRANSCRIBE_COMPUTE_TYPE?.trim() || "int8";
  const language = process.env.STUDYPAL_TRANSCRIBE_LANGUAGE?.trim();
  const args = [script, audioPath, "--model", model, "--device", device, "--compute-type", computeType];
  if (language) args.push("--language", language);

  return await new Promise<TranscribeRunnerResult>((resolve, reject) => {
    const child = spawn(executable, args, {
      windowsHide: true,
      shell: false,
      signal,
      env: {
        ...process.env,
        HF_HUB_OFFLINE: "1",
        HF_HUB_DISABLE_TELEMETRY: "1",
      },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let overflow = false;
    const timeout = setTimeout(() => {
      child.kill();
      reject(new TranscribeRunnerError("Local transcription timed out.", "transcribe_timeout", 504));
    }, Number(process.env.STUDYPAL_TRANSCRIBE_TIMEOUT_MS) || DEFAULT_TIMEOUT_MS);

    child.stdout.on("data", (chunk: Buffer) => {
      if (stdout.length + chunk.length > MAX_OUTPUT_BYTES) {
        overflow = true;
        child.kill();
        return;
      }
      stdout += chunk.toString("utf8");
    });
    child.stderr.resume();
    child.on("error", (error) => {
      clearTimeout(timeout);
      if (error.name === "AbortError") {
        reject(new TranscribeRunnerError("Transcription was cancelled.", "transcribe_cancelled", 499));
        return;
      }
      reject(new TranscribeRunnerError("The local Faster-Whisper runtime is unavailable.", "transcribe_runtime_unavailable", 503));
    });
    child.on("close", (code) => {
      clearTimeout(timeout);
      if (overflow) {
        reject(new TranscribeRunnerError("The local speech engine returned too much output.", "transcribe_output_too_large"));
        return;
      }
      if (code !== 0) {
        reject(new TranscribeRunnerError("Local transcription failed. Check the server runtime configuration.", "transcribe_process_failed", 502));
        return;
      }
      try {
        resolve(parseResult(stdout, model, device));
      } catch (error) {
        reject(error);
      }
    });
  });
}
