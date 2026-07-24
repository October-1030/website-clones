import assert from "node:assert/strict";
import { after, before, beforeEach, describe, it } from "node:test";
import { mkdtemp, readdir, rm } from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import { handleTranscribeRequest } from "../src/app/api/transcribe/route";
import {
  deleteServerTranscribeSession,
  loadServerTranscribeSession,
} from "../src/lib/transcribe/session-store";
import { parseStoredTranscribeSession } from "../src/lib/transcribe/storage";
import type { TranscribeRunnerResult } from "../src/lib/transcribe/runner";
import type { TranscribeSession } from "../src/lib/transcribe/types";
import { validateAudioBytes } from "../src/lib/transcribe/validation";

let dataDirectory = "";
const previousDataDirectory = process.env.STUDYPAL_DATA_DIR;

function wavBytes(): Uint8Array {
  const bytes = new Uint8Array(48);
  bytes.set([0x52, 0x49, 0x46, 0x46], 0);
  bytes.set([0x57, 0x41, 0x56, 0x45], 8);
  return bytes;
}

function requestWith(file: File, sourceKind = "microphone") {
  const body = new FormData();
  body.append("audio", file);
  body.append("sourceKind", sourceKind);
  return new Request("http://localhost/api/transcribe", { method: "POST", body });
}

const fakeResult: TranscribeRunnerResult = {
  text: "Photosynthesis captures light energy.",
  language: "en",
  languageProbability: 0.99,
  durationSeconds: 4.2,
  segments: [{ startSeconds: 0, endSeconds: 4.2, text: "Photosynthesis captures light energy." }],
  provider: { id: "faster-whisper:small", label: "Faster-Whisper · small", device: "cpu" },
};

before(async () => {
  dataDirectory = await mkdtemp(path.join(tmpdir(), "studypal-transcribe-"));
  process.env.STUDYPAL_DATA_DIR = dataDirectory;
});

beforeEach(async () => {
  await rm(path.join(dataDirectory, "transcribe"), { recursive: true, force: true });
  await rm(path.join(dataDirectory, "transcribe-temp"), { recursive: true, force: true });
});

after(async () => {
  if (previousDataDirectory === undefined) delete process.env.STUDYPAL_DATA_DIR;
  else process.env.STUDYPAL_DATA_DIR = previousDataDirectory;
  await rm(dataDirectory, { recursive: true, force: true });
});

describe("Live Transcribe core", () => {
  it("validates file signatures instead of trusting MIME labels", () => {
    assert.equal(validateAudioBytes(wavBytes(), "audio/wav"), "audio/wav");
    assert.throws(() => validateAudioBytes(new Uint8Array([1, 2, 3]), "audio/wav"), /signature/);
    assert.throws(() => validateAudioBytes(wavBytes(), "application/octet-stream"), /WAV/);
  });

  it("creates, restores, and deletes a transcript while removing temporary audio", async () => {
    let observedTemporaryPath = "";
    const response = await handleTranscribeRequest(
      requestWith(new File([wavBytes().buffer as ArrayBuffer], "lecture.wav", { type: "audio/wav" })),
      async (temporaryPath) => {
        observedTemporaryPath = temporaryPath;
        return fakeResult;
      },
    );
    assert.equal(response.status, 200);
    const session = (await response.json() as { session: TranscribeSession }).session;
    assert.equal(session.text, fakeResult.text);
    assert.equal(session.source.kind, "microphone");
    assert.equal(parseStoredTranscribeSession(JSON.stringify(session))?.id, session.id);
    assert.equal((await loadServerTranscribeSession(session.id))?.segments.length, 1);
    assert.ok(observedTemporaryPath.includes("transcribe-temp"));
    const remainingTemporaryFiles = await readdir(path.join(dataDirectory, "transcribe-temp"));
    assert.deepEqual(remainingTemporaryFiles, []);
    assert.equal(await deleteServerTranscribeSession(session.id), true);
    assert.equal(await loadServerTranscribeSession(session.id), null);
  });

  it("rejects missing, unsafe, empty, and overlong recordings", async () => {
    const missing = await handleTranscribeRequest(new Request("http://localhost/api/transcribe", {
      method: "POST",
      body: new FormData(),
    }), async () => fakeResult);
    assert.equal(missing.status, 400);

    const badSource = await handleTranscribeRequest(
      requestWith(new File([wavBytes().buffer as ArrayBuffer], "lecture.wav", { type: "audio/wav" }), "system"),
      async () => fakeResult,
    );
    assert.equal(badSource.status, 400);

    const overlong = await handleTranscribeRequest(
      requestWith(new File([wavBytes().buffer as ArrayBuffer], "lecture.wav", { type: "audio/wav" })),
      async () => ({ ...fakeResult, durationSeconds: 700 }),
    );
    assert.equal(overlong.status, 413);

    const silent = await handleTranscribeRequest(
      requestWith(new File([wavBytes().buffer as ArrayBuffer], "lecture.wav", { type: "audio/wav" })),
      async () => ({ ...fakeResult, text: "", segments: [] }),
    );
    assert.equal(silent.status, 422);
  });
});
