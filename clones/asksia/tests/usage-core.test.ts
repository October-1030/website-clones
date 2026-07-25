import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, it } from "node:test";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { POST as detectorPost } from "../src/app/api/writing/detector/route";
import type { CloudAuthContext } from "../src/lib/cloud/server";
import { requireSameOriginMutation } from "../src/lib/http/same-origin";
import {
  consumeAccountUsage,
  currentUsagePeriod,
  getAccountUsageStatus,
  normalizeUsageChanges,
  UsageAccountingError,
} from "../src/lib/usage/service";

const user = { id: "52ac32ce-a25a-4c91-a0e2-0948dc235530" } as User;

function authenticatedContext(client: unknown): CloudAuthContext {
  return { state: "authenticated", client: client as SupabaseClient, user };
}

describe("account usage accounting", () => {
  it("uses UTC calendar months and explicit free limits", () => {
    assert.deepEqual(currentUsagePeriod(new Date("2026-12-31T23:59:59.000Z")), { start: "2026-12-01", end: "2027-01-01" });
  });

  it("keeps anonymous local mode explicitly unmetered", async () => {
    const status = await getAccountUsageStatus(async () => ({ state: "anonymous", client: {} as SupabaseClient, user: null }));
    assert.equal(status.authenticated, false);
    assert.equal(status.metered, false);
    assert.equal(status.planId, "local");
    assert.equal(status.meters.aiRequests, null);
  });

  it("reads only the authenticated user's current usage row", async () => {
    const calls: unknown[][] = [];
    const query = {
      select(value: string) { calls.push(["select", value]); return this; },
      eq(column: string, value: string) { calls.push(["eq", column, value]); return this; },
      async maybeSingle() {
        return { data: { plan_id: "free", period_start: currentUsagePeriod().start, ai_requests_used: 3, file_pages_used: 12, recording_seconds_used: 65, ai_detection_chars_used: 900 }, error: null };
      },
    };
    const client = { from(table: string) { calls.push(["from", table]); return query; } };
    const status = await getAccountUsageStatus(async () => authenticatedContext(client));
    assert.deepEqual(calls[0], ["from", "account_usage_periods"]);
    assert.ok(calls.some((call) => call[0] === "eq" && call[1] === "user_id" && call[2] === user.id));
    assert.equal(status.meters.aiRequests?.remaining, 7);
    assert.equal(status.meters.filePages?.remaining, 88);
    assert.equal(status.meters.recordingSeconds?.remaining, 535);
  });

  it("normalizes known positive integer dimensions and rejects abuse-shaped values", () => {
    assert.deepEqual(normalizeUsageChanges({ aiRequests: 1, filePages: 2 }), {
      ai_requests: 1,
      file_pages: 2,
      recording_seconds: 0,
      ai_detection_chars: 0,
    });
    for (const changes of [{}, { aiRequests: 0 }, { aiRequests: 1.5 }, { filePages: 501 }, { aiDetectionChars: 10_001 }]) {
      assert.throws(() => normalizeUsageChanges(changes), UsageAccountingError);
    }
  });

  it("calls one atomic RPC without accepting a user ID", async () => {
    const calls: unknown[][] = [];
    const client = {
      async rpc(name: string, args: unknown) {
        calls.push([name, args]);
        return { data: { plan_id: "free", period_start: currentUsagePeriod().start, period_end: currentUsagePeriod().end, ai_requests_used: 1, file_pages_used: 4, recording_seconds_used: 0, ai_detection_chars_used: 0 }, error: null };
      },
    };
    const status = await consumeAccountUsage({ aiRequests: 1, filePages: 4 }, async () => authenticatedContext(client));
    assert.deepEqual(calls, [["consume_account_usage", { p_changes: { ai_requests: 1, file_pages: 4 } }]]);
    assert.equal(JSON.stringify(calls).includes(user.id), false);
    assert.equal(status.meters.aiRequests?.remaining, 9);
  });

  it("maps quota rejection to a bounded 429 error", async () => {
    const client = { async rpc() { return { data: null, error: { code: "P0001", message: "usage quota exceeded", details: "file_pages" } }; } };
    await assert.rejects(
      () => consumeAccountUsage({ filePages: 1 }, async () => authenticatedContext(client)),
      (error: unknown) => error instanceof UsageAccountingError && error.status === 429 && error.dimension === "file_pages",
    );
  });

  it("protects the writing detector with same-origin validation while preserving local mode", async () => {
    const text = "This writing sample contains enough material for a responsible signal review. It varies sentence length and repeats no unsupported authorship claims.";
    const request = new Request("http://localhost/api/writing/detector", {
      method: "POST",
      headers: { Origin: "http://localhost", "Sec-Fetch-Site": "same-origin", "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    assert.doesNotThrow(() => requireSameOriginMutation(request));
    const response = await detectorPost(request);
    const payload = await response.json();
    assert.equal(response.status, 200);
    assert.equal(payload.artifact.kind, "detector");
    assert.equal(payload.usage.metered, false);

    const blocked = await detectorPost(new Request("http://localhost/api/writing/detector", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    }));
    assert.equal(blocked.status, 403);
  });

  it("defines forced RLS, least privilege, and row-locked atomic accounting", async () => {
    const sql = await readFile(path.resolve("supabase/migrations/20260724090000_account_usage_quotas.sql"), "utf8");
    assert.match(sql, /account_usage_periods force row level security/i);
    assert.match(sql, /revoke all on table public\.account_usage_periods from anon, authenticated/i);
    assert.match(sql, /grant select on table public\.account_usage_periods to authenticated/i);
    assert.doesNotMatch(sql, /grant\s+(?:all|insert|update|delete|truncate)[^;]+account_usage_periods to authenticated/i);
    assert.match(sql, /security definer\s+set search_path = ''/i);
    assert.match(sql, /v_user_id uuid := \(select auth\.uid\(\)\)/i);
    assert.doesNotMatch(sql, /consume_account_usage\s*\(\s*p_user_id/i);
    assert.match(sql, /for update/i);
    assert.match(sql, /revoke all on function public\.consume_account_usage\(jsonb\) from public, anon, authenticated/i);
    assert.match(sql, /grant execute on function public\.consume_account_usage\(jsonb\) to authenticated/i);
    const hardeningSql = await readFile(path.resolve("supabase/migrations/20260724091500_account_usage_quota_grant_hardening.sql"), "utf8");
    assert.match(hardeningSql, /revoke all on function public\.consume_account_usage\(jsonb\) from public, anon, authenticated/i);
    assert.doesNotMatch(sql, /grant execute[^;]+consume_account_usage[^;]+to anon/i);
  });
});