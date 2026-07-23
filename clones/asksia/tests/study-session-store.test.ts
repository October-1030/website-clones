import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, before, describe, it } from "node:test";
import { deleteServerStudySession, loadServerStudySession, saveServerStudySession } from "../src/lib/study/session-store";
import type { StudySession } from "../src/lib/study/types";

let dataDir = "";
const previousDataDir = process.env.STUDYPAL_DATA_DIR;

before(async () => {
  dataDir = await mkdtemp(path.join(tmpdir(), "studypal-store-"));
  process.env.STUDYPAL_DATA_DIR = dataDir;
});

after(async () => {
  if (previousDataDir === undefined) delete process.env.STUDYPAL_DATA_DIR;
  else process.env.STUDYPAL_DATA_DIR = previousDataDir;
  await rm(dataDir, { recursive: true, force: true });
});

const session: StudySession = {
  version: 1,
  id: "server-session-1",
  file: { name: "notes.txt", kind: "txt", type: "text/plain", size: 12, pageCount: 1, uploadedAt: "2026-01-01T00:00:00.000Z" },
  provider: { id: "deterministic-local-v2", mode: "demo", label: "演示模式" },
  pages: [{ page: null, label: "TXT 片段", text: "Grounded notes" }],
  summary: { overview: "Overview", keyConcepts: ["Concept"], reviewQuestions: ["Question?"] },
  messages: [],
  truncated: false,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

describe("server study session store", () => {
  it("atomically saves, loads, and deletes a session", async () => {
    await saveServerStudySession(session);
    assert.deepEqual(await loadServerStudySession(session.id), session);
    assert.equal(await deleteServerStudySession(session.id), true);
    assert.equal(await loadServerStudySession(session.id), null);
  });

  it("rejects unsafe session IDs", async () => {
    await assert.rejects(() => loadServerStudySession("../outside"), /ID 无效/);
  });
});
