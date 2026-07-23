import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { validateStudyFile } from "../src/lib/study/file-validation";
import { buildStudyChunks, getStudyProvider, OpenAIResponsesStudyProvider, selectRelevantChunks, studyProvider } from "../src/lib/study/provider";
import { loadStudySession, parseStoredStudySession, saveStudySession } from "../src/lib/study/storage";
import type { StudySession } from "../src/lib/study/types";

const fixturePath = fileURLToPath(new URL("./fixtures/study-notes.txt", import.meta.url));

describe("study file validation", () => {
  it("accepts PDF/TXT and rejects unsafe files", () => {
    assert.deepEqual(validateStudyFile({ name: "notes.txt", size: 120, type: "text/plain" }), { valid: true, kind: "txt" });
    assert.deepEqual(validateStudyFile({ name: "lecture.pdf", size: 500, type: "application/pdf" }), { valid: true, kind: "pdf" });
    assert.equal(validateStudyFile({ name: "notes.docx", size: 120, type: "application/octet-stream" }).valid, false);
    assert.equal(validateStudyFile({ name: "notes.pdf", size: 120, type: "text/plain" }).valid, false);
    assert.equal(validateStudyFile({ name: "notes.txt", size: 0, type: "text/plain" }).valid, false);
    assert.equal(validateStudyFile({ name: "notes.txt", size: 11 * 1024 * 1024, type: "text/plain" }).valid, false);
  });
});

describe("grounded retrieval and demo provider", () => {
  it("builds bounded chunks and ranks relevant evidence", () => {
    const text = `${"Alpha material. ".repeat(150)} Chlorophyll absorbs light energy. ${"Beta material. ".repeat(150)}`;
    const pages = [{ page: 3, label: "第 3 页", text }];
    const chunks = buildStudyChunks(pages);
    assert.ok(chunks.length > 2);
    assert.ok(chunks.every((chunk) => chunk.text.length <= 1_410));
    assert.ok(selectRelevantChunks(pages, "What does chlorophyll absorb?")[0]?.text.toLowerCase().includes("chlorophyll"));
  });

  it("summarizes, cites matching evidence, and refuses unsupported claims", async () => {
    const text = await readFile(fixturePath, "utf8");
    const document = { fileName: "study-notes.txt", pages: [{ page: null, label: "TXT 片段", text }] };
    const summary = await studyProvider.summarize(document);
    assert.ok(summary.overview.includes("Photosynthesis"));
    assert.ok(summary.keyConcepts.length >= 3);
    assert.ok(summary.reviewQuestions.length >= 3);
    const grounded = await studyProvider.answer(document, "What does chlorophyll absorb?");
    assert.equal(grounded.grounded, true);
    assert.equal(grounded.citations[0]?.label, "TXT 片段");
    const unsupported = await studyProvider.answer(document, "Who won the 1978 football final?");
    assert.equal(unsupported.grounded, false);
    assert.match(unsupported.answer, /没有找到足够依据/);
  });
});

describe("OpenAI Responses provider boundary", () => {
  it("uses structured output with remote response storage disabled", async () => {
    const requests: Array<{ url: string; init?: RequestInit }> = [];
    const fetchImpl: typeof fetch = async (input, init) => {
      requests.push({ url: String(input), init });
      return new Response(JSON.stringify({ output: [{ content: [{ type: "output_text", text: JSON.stringify({ overview: "Grounded overview", keyConcepts: ["A", "B", "C"], reviewQuestions: ["Q1?", "Q2?", "Q3?"] }) }] }] }), { status: 200, headers: { "Content-Type": "application/json" } });
    };
    const provider = new OpenAIResponsesStudyProvider({ apiKey: "test-secret", model: "test-model", baseUrl: "https://example.test/v1", fetchImpl });
    assert.equal((await provider.summarize({ fileName: "notes.txt", pages: [{ page: null, label: "TXT 片段", text: "Grounded material." }] })).overview, "Grounded overview");
    const body = JSON.parse(String(requests[0]?.init?.body)) as { store: boolean; text: { format: { type: string } } };
    assert.equal(requests[0]?.url, "https://example.test/v1/responses");
    assert.equal(body.store, false);
    assert.equal(body.text.format.type, "json_schema");
    assert.equal(new Headers(requests[0]?.init?.headers).get("Authorization"), "Bearer test-secret");
  });

  it("uses MiniMax text mode with a JSON contract and accepts fenced JSON", async () => {
    const requests: Array<{ init?: RequestInit }> = [];
    const fetchImpl: typeof fetch = async (_input, init) => {
      requests.push({ init });
      return new Response(JSON.stringify({ output_text: "```json\n{\"overview\":\"M3 overview\",\"keyConcepts\":[\"A\",\"B\",\"C\"],\"reviewQuestions\":[\"Q1?\",\"Q2?\",\"Q3?\"]}\n```" }), { status: 200, headers: { "Content-Type": "application/json" } });
    };
    const provider = new OpenAIResponsesStudyProvider({
      apiKey: "test-secret",
      model: "MiniMax-M3",
      baseUrl: "https://api.minimaxi.com/v1",
      fetchImpl,
      providerIdPrefix: "minimax-responses",
      providerLabel: "MiniMax",
      structuredOutputMode: "prompt_json",
    });
    assert.equal((await provider.summarize({ fileName: "notes.txt", pages: [{ page: null, label: "TXT 片段", text: "Grounded material." }] })).overview, "M3 overview");
    const body = JSON.parse(String(requests[0]?.init?.body)) as { instructions: string; reasoning: { effort: string }; text: { format: { type: string } } };
    assert.equal(body.text.format.type, "text");
    assert.equal(body.reasoning.effort, "none");
    assert.match(body.instructions, /Return only valid JSON/);
  });

  it("maps only retrieved source IDs into citations", async () => {
    const fetchImpl: typeof fetch = async () => new Response(JSON.stringify({ output: [{ content: [{ type: "output_text", text: JSON.stringify({ answer: "Chlorophyll absorbs light.", sourceIds: ["S1", "invented-source"] }) }] }] }), { status: 200, headers: { "Content-Type": "application/json" } });
    const provider = new OpenAIResponsesStudyProvider({ apiKey: "test-secret", model: "test-model", baseUrl: "https://example.test/v1", fetchImpl });
    const result = await provider.answer({ fileName: "notes.txt", pages: [{ page: 2, label: "第 2 页", text: "Chlorophyll absorbs light energy for photosynthesis." }] }, "What does chlorophyll absorb?");
    assert.equal(result.citations.length, 1);
    assert.equal(result.citations[0]?.label, "第 2 页");
  });

  it("selects demo, MiniMax M3, and OpenAI without leaking configuration", () => {
    assert.equal(getStudyProvider({ ...process.env, STUDYPAL_AI_PROVIDER: "demo" }).mode, "demo");
    const minimax = getStudyProvider({ ...process.env, MINIMAX_API_KEY: "minimax-test-secret" });
    assert.equal(minimax.mode, "live");
    assert.equal(minimax.id, "minimax-responses:MiniMax-M3");
    assert.equal(minimax.label, "MiniMax · MiniMax-M3");
    const explicitMiniMax = getStudyProvider({
      ...process.env,
      STUDYPAL_AI_PROVIDER: "minimax",
      MINIMAX_API_KEY: "minimax-test-secret",
      MINIMAX_MODEL: "MiniMax-M3",
      MINIMAX_BASE_URL: "https://api.minimaxi.com/v1",
    });
    assert.equal(explicitMiniMax.id, "minimax-responses:MiniMax-M3");
    assert.throws(() => getStudyProvider({ ...process.env, STUDYPAL_AI_PROVIDER: "minimax", MINIMAX_API_KEY: "" }), /MINIMAX_API_KEY/);
    assert.throws(() => getStudyProvider({ ...process.env, STUDYPAL_AI_PROVIDER: "openai", OPENAI_API_KEY: "", OPENAI_MODEL: "" }), /需要在服务端设置/);
    assert.throws(() => getStudyProvider({ ...process.env, STUDYPAL_AI_PROVIDER: "unknown" }), /demo、minimax 或 openai/);
  });
});

describe("browser study session persistence", () => {
  const session: StudySession = {
    version: 1,
    id: "session-1",
    file: { name: "notes.txt", kind: "txt", type: "text/plain", size: 100, pageCount: 1, uploadedAt: "2026-01-01T00:00:00.000Z" },
    provider: { id: "deterministic-local-v2", mode: "demo", label: "演示模式" },
    pages: [{ page: null, label: "TXT 片段", text: "Grounded content" }],
    summary: { overview: "Overview", keyConcepts: ["Concept"], reviewQuestions: ["Question?"] },
    messages: [],
    truncated: false,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };

  it("saves valid data and rejects corrupt data", () => {
    const values = new Map<string, string>();
    const storage = { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); } };
    saveStudySession(storage, session);
    assert.deepEqual(loadStudySession(storage), session);
    assert.equal(parseStoredStudySession("not-json"), null);
    assert.equal(parseStoredStudySession(JSON.stringify({ version: 2 })), null);
  });
});
