import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import {
  deleteCloudSession,
  listCloudSessions,
  loadCloudSession,
  saveCloudSession,
  type CloudContextProvider,
} from "../src/lib/cloud/session-repository";
import type { StudySession } from "../src/lib/study/types";

const session: StudySession = {
  version: 1,
  id: "cloud-session-1",
  file: { name: "notes.txt", kind: "txt", type: "text/plain", size: 10, pageCount: 1, uploadedAt: "2026-01-01T00:00:00.000Z" },
  provider: { id: "demo", mode: "demo", label: "Demo" },
  pages: [{ page: 1, label: "Page 1", text: "Source text." }],
  summary: { overview: "Overview", keyConcepts: ["Source"], reviewQuestions: ["What is the source?"] },
  messages: [],
  truncated: false,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-02T00:00:00.000Z",
};

class FakeQuery {
  filters: Array<[string, unknown]> = [];
  upsertValue: unknown = null;
  operation = "";
  selectValue = "";
  rows: unknown[] = [];
  singleRow: unknown = null;
  error: { message: string } | null = null;

  upsert(value: unknown) {
    this.operation = "upsert";
    this.upsertValue = value;
    return Promise.resolve({ error: this.error });
  }
  select(value: string) {
    this.selectValue = value;
    return this;
  }
  eq(column: string, value: unknown) {
    this.filters.push([column, value]);
    return this;
  }
  maybeSingle() {
    return Promise.resolve({ data: this.singleRow, error: this.error });
  }
  delete() {
    this.operation = "delete";
    return this;
  }
  order() {
    return this;
  }
  limit() {
    return Promise.resolve({ data: this.rows, error: this.error });
  }
  then(resolve: (value: { data: unknown[]; error: { message: string } | null }) => unknown) {
    return Promise.resolve({ data: this.rows, error: this.error }).then(resolve);
  }
}

function authenticatedProvider(query: FakeQuery, userId = "00000000-0000-0000-0000-000000000001"): CloudContextProvider {
  const client = { from: () => query } as unknown as SupabaseClient;
  const user = { id: userId } as User;
  return async () => ({ state: "authenticated", client, user });
}

const anonymousProvider: CloudContextProvider = async () => ({
  state: "disabled",
  client: null,
  user: null,
});

describe("cloud session repository", () => {
  it("writes the authenticated user ID and never accepts one from the payload", async () => {
    const query = new FakeQuery();
    const usedCloud = await saveCloudSession("study", session, authenticatedProvider(query));
    assert.equal(usedCloud, true);
    const value = query.upsertValue as Record<string, unknown>;
    assert.equal(value.user_id, "00000000-0000-0000-0000-000000000001");
    assert.equal(value.client_id, session.id);
    assert.equal(value.kind, "study");
    assert.equal((value.payload as StudySession).id, session.id);
  });

  it("scopes reads and deletes by kind and client ID while RLS scopes the user", async () => {
    const loadQuery = new FakeQuery();
    loadQuery.singleRow = { payload: session };
    const loaded = await loadCloudSession<StudySession>("study", session.id, authenticatedProvider(loadQuery));
    assert.equal(loaded.usedCloud, true);
    assert.equal(loaded.payload?.id, session.id);
    assert.deepEqual(loadQuery.filters, [["kind", "study"], ["client_id", session.id]]);

    const deleteQuery = new FakeQuery();
    deleteQuery.rows = [{ id: 1 }];
    const deleted = await deleteCloudSession("study", session.id, authenticatedProvider(deleteQuery));
    assert.deepEqual(deleted, { usedCloud: true, deleted: true });
    assert.deepEqual(deleteQuery.filters, [["kind", "study"], ["client_id", session.id]]);
  });

  it("preserves local mode when cloud is disabled and returns metadata only for Library", async () => {
    assert.equal(await saveCloudSession("study", session, anonymousProvider), false);
    assert.deepEqual(await loadCloudSession("study", session.id, anonymousProvider), { usedCloud: false, payload: null });

    const query = new FakeQuery();
    query.rows = [{
      client_id: session.id,
      kind: "study",
      title: "notes.txt",
      subtitle: "1 source section",
      provider_label: "Demo",
      updated_at: session.updatedAt,
    }];
    const rows = await listCloudSessions(authenticatedProvider(query));
    assert.equal(rows?.length, 1);
    assert.equal(query.selectValue.includes("payload"), false);
  });
});
