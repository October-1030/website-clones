import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { POST as askPost } from "../src/app/api/study/ask/route";
import { POST as extractPost } from "../src/app/api/study/extract/route";
import type { StudySession } from "../src/lib/study/types";
import { createPdfFixture } from "./helpers/pdf-fixture";

const fixturePath = fileURLToPath(new URL("./fixtures/study-notes.txt", import.meta.url));

async function upload(file: File) {
  const body = new FormData();
  body.append("file", file);
  return extractPost(new Request("http://localhost/api/study/extract", { method: "POST", body }));
}

describe("study extraction API", () => {
  it("extracts and summarizes a real TXT upload", async () => {
    const text = await readFile(fixturePath, "utf8");
    const response = await upload(new File([text], "study-notes.txt", { type: "text/plain" }));
    const payload = await response.json() as { session: StudySession };
    assert.equal(response.status, 200);
    assert.equal(payload.session.file.kind, "txt");
    assert.equal(payload.session.provider.mode, "demo");
    assert.ok(payload.session.pages[0]?.text.includes("Photosynthesis"));
    assert.ok(payload.session.summary.reviewQuestions.length >= 3);
  });

  it("extracts text and page references from a valid PDF", async () => {
    const pdf = createPdfFixture([
      "Photosynthesis converts light energy into chemical energy.",
      "Chlorophyll absorbs light and helps plants build glucose.",
    ]);
    const pdfArrayBuffer = pdf.buffer.slice(pdf.byteOffset, pdf.byteOffset + pdf.byteLength) as ArrayBuffer;
    const response = await upload(new File([pdfArrayBuffer], "lecture.pdf", { type: "application/pdf" }));
    const payload = await response.json() as { session: StudySession };
    assert.equal(response.status, 200);
    assert.equal(payload.session.file.kind, "pdf");
    assert.equal(payload.session.file.pageCount, 1);
    assert.equal(payload.session.pages[0]?.label, "第 1 页");
    assert.ok(payload.session.pages[0]?.text.includes("Chlorophyll"));
  });

  it("rejects unsupported formats", async () => {
    const response = await upload(new File(["content"], "notes.docx", { type: "application/octet-stream" }));
    const payload = await response.json() as { code: string };
    assert.equal(response.status, 400);
    assert.equal(payload.code, "unsupported");
  });

  it("reports a parse failure for a corrupt PDF", async () => {
    const response = await upload(new File(["%PDF-1.4\nnot a real document"], "broken.pdf", { type: "application/pdf" }));
    const payload = await response.json() as { code: string };
    assert.equal(response.status, 422);
    assert.equal(payload.code, "pdf_parse_failed");
  });
});

describe("grounded question API", () => {
  it("answers a question with a citation from the supplied material", async () => {
    const text = await readFile(fixturePath, "utf8");
    const response = await askPost(new Request("http://localhost/api/study/ask", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question: "What does chlorophyll absorb?", fileName: "study-notes.txt", pages: [{ page: null, label: "TXT 片段", text }] }),
    }));
    const payload = await response.json() as { grounded: boolean; citations: Array<{ label: string }> };
    assert.equal(response.status, 200);
    assert.equal(payload.grounded, true);
    assert.equal(payload.citations[0]?.label, "TXT 片段");
  });

  it("rejects a question without source material", async () => {
    const response = await askPost(new Request("http://localhost/api/study/ask", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question: "Explain this", pages: [] }),
    }));
    assert.equal(response.status, 400);
  });
});
