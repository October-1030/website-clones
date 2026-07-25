import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, it } from "node:test";
import { hashExtensionToken } from "../src/lib/extension/service";
import {
  extensionCorsHeaders,
  isAllowedExtensionOrigin,
  parseExtensionCaptureInput,
  parseExtensionLabel,
  parseExtensionToken,
  readExtensionBearerToken,
  requireSameOriginMutation,
} from "../src/lib/extension/validation";

const validToken = `spx_${"A".repeat(43)}`;
const captureId = "b57b04c5-20c7-54a8-a72d-8a5b90b86ec0";

describe("browser extension sync core", () => {
  it("validates pairing tokens and hashes them without retaining plaintext", () => {
    assert.equal(parseExtensionToken(` ${validToken} `), validToken);
    assert.equal(readExtensionBearerToken(`Bearer ${validToken}`), validToken);
    assert.match(hashExtensionToken(validToken), /^[0-9a-f]{64}$/);
    assert.notEqual(hashExtensionToken(validToken), validToken);
    for (const value of ["", "spx_short", `bad_${"A".repeat(43)}`]) {
      assert.throws(() => parseExtensionToken(value), /token/i);
    }
    assert.equal(parseExtensionLabel("  My Chrome  "), "My Chrome");
  });

  it("normalizes a bounded capture and ignores client ownership or metadata expansion", () => {
    const now = Date.parse("2026-07-24T20:00:00.000Z");
    const capture = parseExtensionCaptureInput({
      clientCaptureId: captureId,
      sourceUrl: "https://example.edu/lesson#private-fragment",
      title: "  Biology   Lesson  ",
      textContent: `  Cells   store information.\n\n${"Membranes regulate transport. ".repeat(8)}`,
      capturedAt: "2026-07-24T19:59:00.000Z",
      userId: "another-user",
      metadata: {
        scope: "selection",
        truncated: true,
        language: "en-US",
        description: " Lesson description ",
        arbitrarySecret: "must not persist",
      },
    }, now);
    assert.equal(capture.sourceUrl, "https://example.edu/lesson");
    assert.equal(capture.title, "Biology Lesson");
    assert.equal(capture.metadata.scope, "selection");
    assert.equal(capture.metadata.truncated, true);
    assert.ok(capture.metadata.wordCount > 10);
    assert.equal("userId" in capture, false);
    assert.equal("arbitrarySecret" in capture.metadata, false);
  });

  it("blocks unsafe URLs, stale timestamps, tiny text, and oversized content", () => {
    const now = Date.parse("2026-07-24T20:00:00.000Z");
    const base = {
      clientCaptureId: captureId,
      sourceUrl: "https://example.edu/lesson",
      title: "Lesson",
      textContent: "A sufficiently detailed lesson page with more than fifty readable characters for validation.",
      capturedAt: "2026-07-24T19:59:00.000Z",
      metadata: {},
    };
    assert.throws(() => parseExtensionCaptureInput({ ...base, sourceUrl: "file:///etc/passwd" }, now), /HTTP/i);
    assert.throws(() => parseExtensionCaptureInput({ ...base, sourceUrl: "https://user:pass@example.edu" }, now), /HTTP/i);
    assert.throws(() => parseExtensionCaptureInput({ ...base, textContent: "too short" }, now), /50/);
    assert.throws(() => parseExtensionCaptureInput({ ...base, textContent: "x".repeat(120_001) }, now), /120,000/);
    assert.throws(() => parseExtensionCaptureInput({ ...base, capturedAt: "2026-07-10T00:00:00.000Z" }, now), /timestamp/i);
  });

  it("reflects only well-formed Chrome extension origins for CORS", () => {
    const origin = `chrome-extension://${"a".repeat(32)}`;
    assert.equal(isAllowedExtensionOrigin(origin), true);
    assert.equal(extensionCorsHeaders(origin)["Access-Control-Allow-Origin"], origin);
    assert.equal(isAllowedExtensionOrigin("https://evil.example"), false);
    assert.equal(isAllowedExtensionOrigin("chrome-extension://invalid"), false);
    assert.equal(extensionCorsHeaders("https://evil.example")["Access-Control-Allow-Origin"], undefined);
  });

  it("blocks cross-site authenticated mutations", () => {
    const sameOrigin = new Request("http://127.0.0.1:3000/api/extension/tokens", {
      method: "POST",
      headers: { Origin: "http://127.0.0.1:3000", "Sec-Fetch-Site": "same-origin" },
    });
    assert.doesNotThrow(() => requireSameOriginMutation(sameOrigin));
    const reconstructedLocalOrigin = new Request("http://localhost:3000/api/extension/tokens", {
      method: "POST",
      headers: { Origin: "http://127.0.0.1:3000", Host: "127.0.0.1:3000", "Sec-Fetch-Site": "same-origin" },
    });
    assert.doesNotThrow(() => requireSameOriginMutation(reconstructedLocalOrigin));
    const crossSite = new Request("http://127.0.0.1:3000/api/extension/tokens", {
      method: "POST",
      headers: { Origin: "https://evil.example", "Sec-Fetch-Site": "cross-site" },
    });
    assert.throws(() => requireSameOriginMutation(crossSite), /StudyPal/i);
    const noOrigin = new Request("http://127.0.0.1:3000/api/extension/tokens", { method: "POST" });
    assert.throws(() => requireSameOriginMutation(noOrigin), /StudyPal/i);
  });
  it("defines forced RLS and a narrow security-definer ingestion function", async () => {
    const sql = await readFile(path.resolve("supabase/migrations/20260724080000_extension_page_sync.sql"), "utf8");
    assert.match(sql, /extension_pairing_tokens force row level security/i);
    assert.match(sql, /extension_captures force row level security/i);
    assert.match(sql, /revoke all on table public\.extension_pairing_tokens from anon, authenticated/i);
    assert.match(sql, /revoke all on table public\.extension_captures from anon, authenticated/i);
    assert.match(sql, /grant select, delete on public\.extension_captures to authenticated/i);
    assert.doesNotMatch(sql, /grant insert[^;]+extension_captures to authenticated/i);
    assert.match(sql, /security definer\s+set search_path = ''/i);
    assert.match(sql, /grant execute on function public\.ingest_extension_capture[^;]+to anon;/i);
    assert.match(sql, /created_at > now\(\) - interval '1 minute'/i);
    const hardening = await readFile(path.resolve("supabase/migrations/20260724081000_harden_extension_table_grants.sql"), "utf8");
    assert.match(hardening, /revoke all on table public\.extension_captures from anon, authenticated/i);
    assert.doesNotMatch(hardening, /grant\s+(?:all|insert|update|truncate|references|trigger)[^;]+extension_captures/i);
    const restricted = await readFile(path.resolve("supabase/migrations/20260724082000_restrict_extension_ingest_execute.sql"), "utf8");
    assert.match(restricted, /revoke execute[^;]+from authenticated/i);
  });

  it("ships a minimum-permission Manifest V3 extension with no background page access", async () => {
    const manifest = JSON.parse(await readFile(path.resolve("extension/manifest.json"), "utf8")) as {
      manifest_version: number;
      permissions: string[];
      host_permissions: string[];
    };
    assert.equal(manifest.manifest_version, 3);
    assert.deepEqual([...manifest.permissions].sort(), ["activeTab", "scripting", "sidePanel", "storage"]);
    assert.deepEqual([...manifest.host_permissions].sort(), ["http://127.0.0.1:3000/*", "http://localhost:3000/*"]);
    assert.equal(JSON.stringify(manifest).includes("<all_urls>"), false);
    assert.equal(manifest.permissions.includes("tabs"), false);
    const worker = await readFile(path.resolve("extension/service-worker.js"), "utf8");
    assert.match(worker, /chrome\.storage\.local/);
    assert.match(worker, /form,input,textarea,select,button/);
    assert.doesNotMatch(worker, /chrome\.history|chrome\.cookies|chrome\.webRequest/);
  });
});
