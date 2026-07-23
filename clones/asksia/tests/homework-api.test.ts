import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, before, beforeEach, describe, it } from "node:test";
import { POST as solvePost } from "../src/app/api/homework/solve/route";
import { DELETE as sessionDelete, GET as sessionGet } from "../src/app/api/homework/session/[id]/route";
import type { HomeworkSession } from "../src/lib/homework/types";

let testDataDir = "";
const previousProvider = process.env.STUDYPAL_AI_PROVIDER;
const previousDataDir = process.env.STUDYPAL_DATA_DIR;

before(async () => {
  testDataDir = await mkdtemp(path.join(tmpdir(), "studypal-homework-api-"));
  process.env.STUDYPAL_AI_PROVIDER = "demo";
  process.env.STUDYPAL_DATA_DIR = testDataDir;
});

beforeEach(async () => {
  await rm(path.join(testDataDir, "homework"), { recursive: true, force: true });
});

after(async () => {
  if (previousProvider === undefined) delete process.env.STUDYPAL_AI_PROVIDER;
  else process.env.STUDYPAL_AI_PROVIDER = previousProvider;
  if (previousDataDir === undefined) delete process.env.STUDYPAL_DATA_DIR;
  else process.env.STUDYPAL_DATA_DIR = previousDataDir;
  await rm(testDataDir, { recursive: true, force: true });
});

function solveRequest(problem: unknown) {
  return solvePost(new Request("http://localhost/api/homework/solve", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ problem }),
  }));
}

describe("Homework Solver API", () => {
  it("solves, stores, restores, and deletes a session", async () => {
    const response = await solveRequest("Evaluate ∫₀¹ x·e^(x²) dx.");
    const payload = await response.json() as { session: HomeworkSession };
    assert.equal(response.status, 200);
    assert.equal(payload.session.provider.mode, "demo");
    assert.ok(payload.session.solution.steps.length >= 2);

    const restoredResponse = await sessionGet(new Request("http://localhost"), { params: Promise.resolve({ id: payload.session.id }) });
    const restored = await restoredResponse.json() as { session: HomeworkSession };
    assert.equal(restoredResponse.status, 200);
    assert.equal(restored.session.id, payload.session.id);
    assert.equal(restored.session.problem, payload.session.problem);

    const deleted = await sessionDelete(new Request("http://localhost", { method: "DELETE" }), { params: Promise.resolve({ id: payload.session.id }) });
    assert.equal(deleted.status, 200);
    assert.equal((await deleted.json() as { deleted: boolean }).deleted, true);
    const missing = await sessionGet(new Request("http://localhost"), { params: Promise.resolve({ id: payload.session.id }) });
    assert.equal(missing.status, 404);
  });

  it("rejects malformed and out-of-range problems", async () => {
    assert.equal((await solveRequest("x")).status, 400);
    assert.equal((await solveRequest("x".repeat(4_001))).status, 400);
    assert.equal((await solveRequest(42)).status, 400);
    const invalidJson = await solvePost(new Request("http://localhost/api/homework/solve", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{",
    }));
    assert.equal(invalidJson.status, 400);
  });

  it("rejects unsafe session IDs", async () => {
    const response = await sessionGet(new Request("http://localhost"), { params: Promise.resolve({ id: "../escape" }) });
    assert.equal(response.status, 400);
    assert.equal((await response.json() as { code: string }).code, "invalid_homework_session_id");
  });
});
