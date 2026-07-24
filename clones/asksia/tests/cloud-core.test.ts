import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, it } from "node:test";
import { parseCloudProfilePatch } from "../src/lib/cloud/profile";
import { metadataForCloudSession } from "../src/lib/cloud/session-metadata";

describe("StudyPal cloud account core", () => {
  it("validates profile fields without accepting authorization fields", () => {
    const patch = parseCloudProfilePatch({
      displayName: "  Student One  ",
      preferences: {
        preferredLanguage: "zh-CN",
        tone: "concise",
        learningStyles: ["examples", "practice"],
        memoryEnabled: true,
      },
      plan: "pro",
      userId: "another-user",
    });
    assert.equal(patch.displayName, "Student One");
    assert.equal(patch.preferences?.learningStyles.length, 2);
    assert.equal("plan" in patch, false);
    assert.equal("userId" in patch, false);
    assert.throws(() => parseCloudProfilePatch({ displayName: "" }), /1 to 40/);
    assert.throws(() => parseCloudProfilePatch({ preferences: { preferredLanguage: "auto", tone: "clear", learningStyles: ["x"], memoryEnabled: true } }), /learning styles/);
  });

  it("derives bounded metadata from a study session", () => {
    const value = metadataForCloudSession("study", {
      version: 1,
      id: "session-1",
      file: { name: "notes.txt", kind: "txt", type: "text/plain", size: 100, pageCount: 2, uploadedAt: "2026-01-01T00:00:00.000Z" },
      provider: { id: "demo", mode: "demo", label: "Demo" },
      pages: [],
      summary: { overview: "Overview", keyConcepts: ["A", "B"], reviewQuestions: [] },
      messages: [],
      truncated: false,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-02T00:00:00.000Z",
    });
    assert.equal(value.clientId, "session-1");
    assert.equal(value.title, "notes.txt");
    assert.match(value.subtitle, /2 source sections/);
  });

  it("defines indexed RLS policies for every multi-user table", async () => {
    const sql = await readFile(path.resolve("supabase/migrations/20260724010000_cloud_accounts.sql"), "utf8");
    for (const table of ["profiles", "learning_sessions", "learning_artifacts"]) {
      assert.match(sql, new RegExp(`alter table public\\.${table} enable row level security`, "i"));
      assert.match(sql, new RegExp(`alter table public\\.${table} force row level security`, "i"));
    }
    assert.ok((sql.match(/to authenticated/g) || []).length >= 10);
    assert.ok((sql.match(/\(select auth\.uid\(\)\)/g) || []).length >= 9);
    assert.match(sql, /learning_sessions_user_updated_idx/);
    assert.match(sql, /learning_artifacts_user_updated_idx/);
    assert.doesNotMatch(sql, /service[_-]?role/i);
    assert.doesNotMatch(sql, /grant all/i);
  });
});
