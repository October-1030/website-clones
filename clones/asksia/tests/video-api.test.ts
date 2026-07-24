import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, before, beforeEach, describe, it } from "node:test";
import { POST as summarizePost } from "../src/app/api/video/summarize/route";
import { POST as askPost } from "../src/app/api/video/ask/route";
import { DELETE as sessionDelete, GET as sessionGet } from "../src/app/api/video/session/[id]/route";
import type { VideoSession } from "../src/lib/video/types";

const videoId = "api1234XYZ0";
const originalFetch = globalThis.fetch;
const previousProvider = process.env.STUDYPAL_AI_PROVIDER;
const previousDataDir = process.env.STUDYPAL_DATA_DIR;
let testDataDir = "";

function fixtureFetch(input: string | URL | Request): Promise<Response> {
  const url = new URL(input instanceof Request ? input.url : input.toString());
  if (url.pathname === "/watch") {
    const captionUrl = `https://www.youtube.com/api/timedtext?v=${videoId}&lang=en`;
    const html = `<meta property="og:title" content="API Fixture Lecture"><meta name="author" content="StudyPal Tests"><script>{"captionTracks":[{"baseUrl":"${captionUrl.replaceAll("&", "\\u0026")}","languageCode":"en"}],"lengthSeconds":"90"}</script>`;
    return Promise.resolve(new Response(html, { status: 200, headers: { "Content-Type": "text/html" } }));
  }
  if (url.pathname === "/api/timedtext") {
    return Promise.resolve(new Response(JSON.stringify({
      events: [
        { tStartMs: 0, dDurationMs: 5_000, segs: [{ utf8: "Photosynthesis captures light energy and stores it as chemical energy in glucose." }] },
        { tStartMs: 5_000, dDurationMs: 5_000, segs: [{ utf8: "Chlorophyll absorbs light while carbon dioxide and water supply atoms for the reaction." }] },
      ],
    }), { status: 200, headers: { "Content-Type": "application/json" } }));
  }
  return Promise.resolve(new Response("not found", { status: 404 }));
}

before(async () => {
  testDataDir = await mkdtemp(path.join(tmpdir(), "studypal-video-api-"));
  process.env.STUDYPAL_AI_PROVIDER = "demo";
  process.env.STUDYPAL_DATA_DIR = testDataDir;
  globalThis.fetch = fixtureFetch as typeof fetch;
});

beforeEach(async () => {
  await rm(path.join(testDataDir, "video"), { recursive: true, force: true });
});

after(async () => {
  globalThis.fetch = originalFetch;
  if (previousProvider === undefined) delete process.env.STUDYPAL_AI_PROVIDER;
  else process.env.STUDYPAL_AI_PROVIDER = previousProvider;
  if (previousDataDir === undefined) delete process.env.STUDYPAL_DATA_DIR;
  else process.env.STUDYPAL_DATA_DIR = previousDataDir;
  await rm(testDataDir, { recursive: true, force: true });
});

function jsonRequest(url: string, body: unknown) {
  return new Request(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("Video Link Summary API", () => {
  it("summarizes, answers with citations, restores, and deletes a session", async () => {
    const summarized = await summarizePost(jsonRequest("http://localhost/api/video/summarize", {
      url: `https://www.youtube.com/watch?v=${videoId}`,
    }));
    const summaryPayload = await summarized.json() as { session: VideoSession };
    assert.equal(summarized.status, 200);
    assert.equal(summaryPayload.session.source.title, "API Fixture Lecture");
    assert.equal(summaryPayload.session.provider.mode, "demo");

    const answered = await askPost(jsonRequest("http://localhost/api/video/ask", {
      sessionId: summaryPayload.session.id,
      question: "What does chlorophyll absorb?",
    }));
    const answerPayload = await answered.json() as { session: VideoSession; result: { grounded: boolean } };
    assert.equal(answered.status, 200);
    assert.equal(answerPayload.result.grounded, true);
    assert.equal(answerPayload.session.messages.length, 2);
    assert.ok(answerPayload.session.messages[1].citations?.length);

    const restored = await sessionGet(new Request("http://localhost"), { params: Promise.resolve({ id: summaryPayload.session.id }) });
    assert.equal(restored.status, 200);
    assert.equal((await restored.json() as { session: VideoSession }).session.messages.length, 2);

    const deleted = await sessionDelete(new Request("http://localhost", { method: "DELETE" }), { params: Promise.resolve({ id: summaryPayload.session.id }) });
    assert.equal(deleted.status, 200);
    assert.equal((await deleted.json() as { deleted: boolean }).deleted, true);
  });

  it("rejects malformed URLs, questions, JSON, and unsafe session IDs", async () => {
    assert.equal((await summarizePost(jsonRequest("http://localhost/api/video/summarize", { url: "http://127.0.0.1/private" }))).status, 400);
    assert.equal((await summarizePost(jsonRequest("http://localhost/api/video/summarize", { url: 42 }))).status, 400);
    assert.equal((await askPost(jsonRequest("http://localhost/api/video/ask", { sessionId: "missing", question: "x" }))).status, 404);
    const invalidJson = await summarizePost(new Request("http://localhost/api/video/summarize", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{",
    }));
    assert.equal(invalidJson.status, 400);
    const unsafeId = await sessionGet(new Request("http://localhost"), { params: Promise.resolve({ id: "../escape" }) });
    assert.equal(unsafeId.status, 400);
  });
});
