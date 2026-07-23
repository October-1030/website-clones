import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, before, beforeEach, describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { POST as askPost } from "../src/app/api/study/ask/route";
import { POST as extractPost } from "../src/app/api/study/extract/route";
import { DELETE as sessionDelete, GET as sessionGet } from "../src/app/api/study/session/[id]/route";
import type { StudySession } from "../src/lib/study/types";
import { createPdfFixture } from "./helpers/pdf-fixture";

const fixturePath = fileURLToPath(new URL("./fixtures/study-notes.txt", import.meta.url));
let testDataDir = "";
const previousProvider = process.env.STUDYPAL_AI_PROVIDER;
const previousDataDir = process.env.STUDYPAL_DATA_DIR;

before(async () => {
  testDataDir = await mkdtemp(path.join(tmpdir(), "studypal-api-"));
  process.env.STUDYPAL_AI_PROVIDER = "demo";
  process.env.STUDYPAL_DATA_DIR = testDataDir;
});

beforeEach(async () => {
  await rm(path.join(testDataDir, "sessions"), { recursive: true, force: true });
});

after(async () => {
  if (previousProvider === undefined) delete process.env.STUDYPAL_AI_PROVIDER;
  else process.env.STUDYPAL_AI_PROVIDER = previousProvider;
  if (previousDataDir === undefined) delete process.env.STUDYPAL_DATA_DIR;
  else process.env.STUDYPAL_DATA_DIR = previousDataDir;
  await rm(testDataDir, { recursive: true, force: true });
});

async function upload(file: File) {
  const body = new FormData();
  body.append("file", file);
  return extractPost(new Request("http://localhost/api/study/extract", { method: "POST", body }));
}

describe("study extraction API", () => {
  it("extracts, summarizes, and saves a real TXT upload", async () => {
    const text = await readFile(fixturePath, "utf8");
    const response = await upload(new File([text], "study-notes.txt", { type: "text/plain" }));
    const payload = await response.json() as { session: StudySession };
    assert.equal(response.status, 200);
    assert.equal(payload.session.provider.mode, "demo");
    assert.equal(payload.session.pages[0]?.label, "TXT 片段");

    const restore = await sessionGet(new Request("http://localhost"), { params: Promise.resolve({ id: payload.session.id }) });
    const restored = await restore.json() as { session: StudySession };
    assert.equal(restore.status, 200);
    assert.equal(restored.session.id, payload.session.id);
  });

  it("extracts text and page references from a valid PDF", async () => {
    const pdf = createPdfFixture(["Photosynthesis converts light energy into chemical energy.", "Chlorophyll absorbs light and helps plants build glucose."]);
    const pdfArrayBuffer = pdf.buffer.slice(pdf.byteOffset, pdf.byteOffset + pdf.byteLength) as ArrayBuffer;
    const response = await upload(new File([pdfArrayBuffer], "lecture.pdf", { type: "application/pdf" }));
    const payload = await response.json() as { session: StudySession };
    assert.equal(response.status, 200);
    assert.equal(payload.session.file.kind, "pdf");
    assert.equal(payload.session.pages[0]?.label, "第 1 页");
    assert.ok(payload.session.pages[0]?.text.includes("Chlorophyll"));
  });

  it("rejects unsupported formats and corrupt PDFs", async () => {
    const unsupported = await upload(new File(["content"], "notes.docx", { type: "application/octet-stream" }));
    assert.equal(unsupported.status, 400);
    assert.equal((await unsupported.json() as { code: string }).code, "unsupported");
    const broken = await upload(new File(["%PDF-1.4\nnot a real document"], "broken.pdf", { type: "application/pdf" }));
    assert.equal(broken.status, 422);
    assert.equal((await broken.json() as { code: string }).code, "pdf_parse_failed");
  });

  it("reports missing live provider configuration without exposing secrets", async () => {
    process.env.STUDYPAL_AI_PROVIDER = "openai";
    delete process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_MODEL;
    const response = await upload(new File(["Grounded notes"], "notes.txt", { type: "text/plain" }));
    const payload = await response.json() as { code: string; error: string };
    assert.equal(response.status, 503);
    assert.equal(payload.code, "live_not_configured");
    assert.doesNotMatch(payload.error, /Bearer|sk-/);
    process.env.STUDYPAL_AI_PROVIDER = "demo";
  });
});

describe("server-backed grounded question API", () => {
  it("answers from the saved session and persists both messages", async () => {
    const text = await readFile(fixturePath, "utf8");
    const uploaded = await upload(new File([text], "study-notes.txt", { type: "text/plain" }));
    const created = await uploaded.json() as { session: StudySession };
    const response = await askPost(new Request("http://localhost/api/study/ask", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question: "What does chlorophyll absorb?", sessionId: created.session.id }),
    }));
    const payload = await response.json() as { grounded: boolean; citations: Array<{ label: string }>; session: StudySession };
    assert.equal(response.status, 200);
    assert.equal(payload.grounded, true);
    assert.equal(payload.citations[0]?.label, "TXT 片段");
    assert.equal(payload.session.messages.length, 2);

    const restore = await sessionGet(new Request("http://localhost"), { params: Promise.resolve({ id: created.session.id }) });
    const restored = await restore.json() as { session: StudySession };
    assert.equal(restored.session.messages.length, 2);
  });

  it("deletes a local server session", async () => {
    const text = await readFile(fixturePath, "utf8");
    const uploaded = await upload(new File([text], "study-notes.txt", { type: "text/plain" }));
    const created = await uploaded.json() as { session: StudySession };
    const removed = await sessionDelete(new Request("http://localhost", { method: "DELETE" }), { params: Promise.resolve({ id: created.session.id }) });
    assert.equal(removed.status, 200);
    const missing = await sessionGet(new Request("http://localhost"), { params: Promise.resolve({ id: created.session.id }) });
    assert.equal(missing.status, 404);
  });

  it("rejects unknown sessions and questions without source material", async () => {
    const missing = await askPost(new Request("http://localhost/api/study/ask", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question: "Explain this", sessionId: "missing-session" }),
    }));
    assert.equal(missing.status, 404);
    const noMaterial = await askPost(new Request("http://localhost/api/study/ask", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question: "Explain this", pages: [] }),
    }));
    assert.equal(noMaterial.status, 400);
  });
});
