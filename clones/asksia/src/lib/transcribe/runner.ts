import { spawn } from "node:child_process";
import type { TranscribeSegment } from "./types";

const MAX_OUTPUT_BYTES = 2 * 1024 * 1024;
const DEFAULT_TIMEOUT_MS = 5 * 60 * 1000;
const PROBE_TIMEOUT_MS = 30_000;

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

function childEnvironment(): NodeJS.ProcessEnv {
  const keys = [
    "PATH",
    "Path",
    "SystemRoot",
    "WINDIR",
    "COMSPEC",
    "PATHEXT",
    "TEMP",
    "TMP",
    "USERPROFILE",
    "HOME",
    "LOCALAPPDATA",
    "APPDATA",
    "PROGRAMDATA",
    "PYTHONPATH",
    "PYTHONIOENCODING",
    "HF_HOME",
    "HUGGINGFACE_HUB_CACHE",
    "TRANSFORMERS_CACHE",
    "XDG_CACHE_HOME",
  ];
  const environment: NodeJS.ProcessEnv = { NODE_ENV: process.env.NODE_ENV || "production" };
  for (const key of keys) {
    const value = process.env[key];
    if (value) environment[key] = value;
  }
  environment.HF_HUB_OFFLINE = "1";
  environment.HF_HUB_DISABLE_TELEMETRY = "1";
  environment.PYTHONIOENCODING = "utf-8";
  return environment;
}

function scriptPath(): string {
  const configured = process.env.STUDYPAL_TRANSCRIBE_SCRIPT?.trim();
  if (!configured) {
    throw new TranscribeRunnerError(
      "The transcription script path is not configured.",
      "transcribe_runtime_unavailable",
      503,
    );
  }
  return configured;
}

async function runPython(args: string[], timeoutMs: number, signal?: AbortSignal): Promise<string> {
  return await new Promise<string>((resolve, reject) => {
    const child = spawn(pythonExecutable(), args, {
      windowsHide: true,
      shell: false,
      signal,
      env: childEnvironment(),
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let overflow = false;
    let settled = false;
    const finish = (callback: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      callback();
    };
    const timeout = setTimeout(() => {
      child.kill();
      finish(() => reject(new TranscribeRunnerError("Local speech processing timed out.", "transcribe_timeout", 504)));
    }, timeoutMs);

    child.stdout.on("data", (chunk: Buffer) => {
      if (Buffer.byteLength(stdout, "utf8") + chunk.length > MAX_OUTPUT_BYTES) {
        overflow = true;
        child.kill();
        return;
      }
      stdout += chunk.toString("utf8");
    });
    child.stderr.resume();
    child.on("error", (error) => {
      finish(() => {
        if (error.name === "AbortError") {
          reject(new TranscribeRunnerError("Transcription was cancelled.", "transcribe_cancelled", 499));
          return;
        }
        reject(new TranscribeRunnerError(
          "The local Faster-Whisper runtime is unavailable.",
          "transcribe_runtime_unavailable",
          503,
        ));
      });
    });
    child.on("close", (code) => {
      finish(() => {
        if (overflow) {
          reject(new TranscribeRunnerError(
            "The local speech engine returned too much output.",
            "transcribe_output_too_large",
          ));
          return;
        }
        if (code !== 0) {
          reject(new TranscribeRunnerError(
            "Local speech processing failed. Check the server runtime configuration.",
            "transcribe_process_failed",
            502,
          ));
          return;
        }
        resolve(stdout);
      });
    });
  });
}

function parseJson(raw: string): Record<string, unknown> {
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    throw new TranscribeRunnerError("The local speech engine returned invalid output.", "transcribe_invalid_output");
  }
  if (!value || typeof value !== "object") {
    throw new TranscribeRunnerError("The local speech engine returned no output.", "transcribe_empty_output");
  }
  return value as Record<string, unknown>;
}

function parseResult(raw: string, model: string, device: string): TranscribeRunnerResult {
  const result = parseJson(raw);
  if (typeof result.text !== "string" || typeof result.durationSeconds !== "number" || !Array.isArray(result.segments)) {
    throw new TranscribeRunnerError("The local speech engine returned an incomplete transcript.", "transcribe_invalid_output");
  }
  const segments = result.segments.filter((segment): segment is TranscribeSegment => {
    if (!segment || typeof segment !== "object") return false;
    const item = segment as Partial<TranscribeSegment>;
    return typeof item.startSeconds === "number"
      && typeof item.endSeconds === "number"
      && typeof item.text === "string";
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

export async function probeAudioDuration(audioPath: string, signal?: AbortSignal): Promise<number> {
  const raw = await runPython([scriptPath(), audioPath, "--probe-only"], PROBE_TIMEOUT_MS, signal);
  const result = parseJson(raw);
  if (
    typeof result.durationSeconds !== "number"
    || !Number.isFinite(result.durationSeconds)
    || result.durationSeconds < 0
  ) {
    throw new TranscribeRunnerError("The local speech engine could not determine audio duration.", "audio_probe_failed", 422);
  }
  return result.durationSeconds;
}

export async function transcribeAudio(audioPath: string, signal?: AbortSignal): Promise<TranscribeRunnerResult> {
  const model = process.env.STUDYPAL_TRANSCRIBE_MODEL?.trim() || "small";
  const device = process.env.STUDYPAL_TRANSCRIBE_DEVICE?.trim() || "cpu";
  const computeType = process.env.STUDYPAL_TRANSCRIBE_COMPUTE_TYPE?.trim() || "int8";
  const language = process.env.STUDYPAL_TRANSCRIBE_LANGUAGE?.trim();
  const args = [scriptPath(), audioPath, "--model", model, "--device", device, "--compute-type", computeType];
  if (language) args.push("--language", language);
  const timeout = Number(process.env.STUDYPAL_TRANSCRIBE_TIMEOUT_MS) || DEFAULT_TIMEOUT_MS;
  return parseResult(await runPython(args, timeout, signal), model, device);
}
