import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { validateStudyFile } from "../src/lib/study/file-validation";
import { studyProvider } from "../src/lib/study/provider";
import { loadStudySession, parseStoredStudySession, saveStudySession } from "../src/lib/study/storage";
import type { StudySession } from "../src/lib/study/types";

const fixturePath = fileURLToPath(new URL("./fixtures/study-notes.txt", import.meta.url));

describe("study file validation", () => {
  it("accepts supported PDF and TXT files", () => {
    assert.deepEqual(validateStudyFile({ name: "notes.txt", size: 120, type: "text/plain" }), { valid: true, kind: "txt" });
    assert.deepEqual(validateStudyFile({ name: "lecture.pdf", size: 500, type: "application/pdf" }), { valid: true, kind: "pdf" });
  });

  it("rejects invalid formats, MIME mismatches, empty files, and oversized files", () => {
    assert.equal(validateStudyFile({ name: "notes.docx", size: 120, type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" }).valid, false);
    assert.equal(validateStudyFile({ name: "notes.pdf", size: 120, type: "text/plain" }).valid, false);
    assert.equal(validateStudyFile({ name: "notes.txt", size: 0, type: "text/plain" }).valid, false);
    assert.equal(validateStudyFile({ name: "notes.txt", size: 11 * 1024 * 1024, type: "text/plain" }).valid, false);
  });
});

describe("deterministic grounded provider", () => {
  it("creates all required summary sections", async () => {
    const text = await readFile(fixturePath, "utf8");
    const document = { fileName: "study-notes.txt", pages: [{ page: null, label: "TXT 片段", text }] };
    const summary = await studyProvider.summarize(document);
    assert.ok(summary.overview.includes("Photosynthesis"));
    assert.ok(summary.keyConcepts.length >= 3);
    assert.ok(summary.reviewQuestions.length >= 3);
  });

  it("answers from matching evidence and returns source fragments", async () => {
    const text = await readFile(fixturePath, "utf8");
    const document = { fileName: "study-notes.txt", pages: [{ page: null, label: "TXT 片段", text }] };
    const result = await studyProvider.answer(document, "What does chlorophyll absorb?");
    assert.equal(result.grounded, true);
    assert.ok(result.answer.toLowerCase().includes("chlorophyll"));
    assert.equal(result.citations[0]?.label, "TXT 片段");
    assert.ok(result.citations[0]?.excerpt.toLowerCase().includes("light"));
  });

  it("refuses to invent an answer when the source has no matching evidence", async () => {
    const text = await readFile(fixturePath, "utf8");
    const result = await studyProvider.answer({ fileName: "study-notes.txt", pages: [{ page: null, label: "TXT 片段", text }] }, "Who won the 1978 football final?");
    assert.equal(result.grounded, false);
    assert.deepEqual(result.citations, []);
    assert.match(result.answer, /没有找到足够依据/);
  });
});

describe("local study session persistence", () => {
  const session: StudySession = {
    version: 1,
    id: "session-1",
    file: { name: "notes.txt", kind: "txt", type: "text/plain", size: 100, pageCount: 1, uploadedAt: "2026-01-01T00:00:00.000Z" },
    provider: { id: "deterministic-local-v1", mode: "demo", label: "演示模式" },
    pages: [{ page: null, label: "TXT 片段", text: "Grounded content" }],
    summary: { overview: "Overview", keyConcepts: ["Concept"], reviewQuestions: ["Question?"] },
    messages: [],
    truncated: false,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };

  it("saves and restores a valid session", () => {
    const values = new Map<string, string>();
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => { values.set(key, value); },
    };
    saveStudySession(storage, session);
    assert.deepEqual(loadStudySession(storage), session);
  });

  it("ignores corrupt or incompatible stored data", () => {
    assert.equal(parseStoredStudySession("not-json"), null);
    assert.equal(parseStoredStudySession(JSON.stringify({ version: 2 })), null);
  });
});
