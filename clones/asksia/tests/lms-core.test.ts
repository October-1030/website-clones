import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, it } from "node:test";
import { CanvasClient } from "../src/lib/lms/canvas";
import { decryptLmsToken, encryptLmsToken } from "../src/lib/lms/crypto";
import {
  buildCanvasAuthorizationUrl,
  exchangeCanvasAuthorizationCode,
  getCanvasOauthConfig,
} from "../src/lib/lms/oauth";
import { normalizeCanvasInstanceUrl, parseCanvasConnectionInput } from "../src/lib/lms/validation";

const encryptionEnvironment = {
  NODE_ENV: "test",
  STUDYPAL_LMS_ENCRYPTION_KEY: Buffer.alloc(32, 7).toString("base64"),
} as NodeJS.ProcessEnv;

describe("LMS connector core", () => {
  it("encrypts LMS tokens with authenticated encryption", () => {
    const encrypted = encryptLmsToken("secret-canvas-token", encryptionEnvironment);
    assert.match(encrypted, /^v1\./);
    assert.equal(encrypted.includes("secret-canvas-token"), false);
    assert.equal(decryptLmsToken(encrypted, encryptionEnvironment), "secret-canvas-token");
    const envelope = encrypted.split(".");
    const tamperedBytes = Buffer.from(envelope[3], "base64url");
    tamperedBytes[0] ^= 1;
    const tampered = [envelope[0], envelope[1], envelope[2], tamperedBytes.toString("base64url")].join(".");
    assert.throws(() => decryptLmsToken(tampered, encryptionEnvironment), /could not be decrypted/);
    assert.throws(
      () => encryptLmsToken("token", { NODE_ENV: "test", STUDYPAL_LMS_ENCRYPTION_KEY: "bad" } as NodeJS.ProcessEnv),
      /32 random bytes/,
    );
  });

  it("allows approved Canvas hosts and blocks SSRF-shaped instances", () => {
    assert.equal(
      normalizeCanvasInstanceUrl("https://school.instructure.com/courses/1"),
      "https://school.instructure.com",
    );
    assert.equal(
      normalizeCanvasInstanceUrl("https://canvas.example.edu", {
        NODE_ENV: "test",
        STUDYPAL_LMS_ALLOWED_HOSTS: "canvas.example.edu",
      } as NodeJS.ProcessEnv),
      "https://canvas.example.edu",
    );
    for (const value of [
      "http://school.instructure.com",
      "https://localhost",
      "https://127.0.0.1",
      "https://192.168.1.5",
      "https://canvas.evil.example",
      "https://user:pass@school.instructure.com",
    ]) {
      assert.throws(() => normalizeCanvasInstanceUrl(value), /Canvas|approved/);
    }
  });

  it("validates connection input without accepting ownership fields", () => {
    const input = parseCanvasConnectionInput({
      instanceUrl: "https://school.instructure.com",
      accessToken: " token ",
      accountLabel: " Biology ",
      userId: "other-user",
    });
    assert.deepEqual(input, {
      instanceUrl: "https://school.instructure.com",
      accessToken: "token",
      accountLabel: "Biology",
    });
    assert.equal("userId" in input, false);
  });

  it("reads paginated Canvas courses and material metadata without following redirects", async () => {
    const requests: Array<{ url: string; authorization: string | null }> = [];
    const fetchImpl: typeof fetch = async (input, init) => {
      const url = new URL(input instanceof Request ? input.url : input.toString());
      const headers = new Headers(init?.headers);
      requests.push({ url: url.toString(), authorization: headers.get("authorization") });
      const json = (value: unknown, extra?: HeadersInit) => new Response(JSON.stringify(value), {
        status: 200,
        headers: { "Content-Type": "application/json", ...(extra || {}) },
      });
      if (url.pathname === "/api/v1/users/self/profile") {
        return json({ id: 9, name: "Test Student", primary_email: "student@example.test" });
      }
      if (url.pathname === "/api/v1/courses" && url.searchParams.get("page") === "2") {
        return json([{ id: 22, name: "History", course_code: "HIS-22", enrollment_state: "active" }]);
      }
      if (url.pathname === "/api/v1/courses") {
        return json(
          [{ id: 11, name: "Biology", course_code: "BIO-11", enrollment_state: "active" }],
          { Link: "<https://school.instructure.com/api/v1/courses?page=2>; rel=\"next\"" },
        );
      }
      if (url.pathname === "/api/v1/courses/11/modules") {
        return json([{
          id: 101,
          name: "Week 1",
          position: 1,
          items: [
            { id: 201, type: "Page", page_url: "cells", title: "Cells", position: 1 },
            { id: 202, type: "Assignment", content_id: 301, title: "Lab report", position: 2 },
            { id: 203, type: "File", content_id: 401, title: "Slides", position: 3 },
            { id: 204, type: "ExternalUrl", external_url: "https://example.edu/reference", title: "Reference", position: 4 },
          ],
        }]);
      }
      if (url.pathname === "/api/v1/courses/11/assignments") {
        return json([{ id: 301, name: "Lab report", description: "<p>Compare plant and animal cells.</p>", due_at: "2026-08-01T12:00:00Z", html_url: "https://school.instructure.com/courses/11/assignments/301", position: 2 }]);
      }
      if (url.pathname === "/api/v1/courses/11/files") {
        return json([{ id: 401, display_name: "week-1.pdf", url: "https://school.instructure.com/files/401/download", size: 4000, "content-type": "application/pdf" }]);
      }
      if (url.pathname === "/api/v1/courses/11/pages/cells") {
        return json({ page_id: 501, title: "Cells", body: "<h1>Cell membrane</h1><p>Controls transport.</p>", html_url: "https://school.instructure.com/courses/11/pages/cells" });
      }
      if (url.pathname === "/api/v1/courses/22/modules" || url.pathname === "/api/v1/courses/22/assignments" || url.pathname === "/api/v1/courses/22/files") {
        return json([]);
      }
      return new Response("not found", { status: 404 });
    };

    const client = new CanvasClient("https://school.instructure.com", "canvas-token", { fetchImpl });
    assert.equal((await client.verifyConnection()).displayName, "Test Student");
    const courses = await client.listCourses();
    assert.equal(courses.length, 2);
    const snapshot = await client.loadCourseSnapshot(courses[0]);
    assert.equal(snapshot.materials.filter((value) => value.kind === "module").length, 1);
    assert.equal(snapshot.materials.filter((value) => value.kind === "page")[0]?.textContent, "Cell membrane\nControls transport.");
    assert.equal(snapshot.materials.filter((value) => value.kind === "assignment")[0]?.dueAt, "2026-08-01T12:00:00.000Z");
    assert.equal(snapshot.materials.filter((value) => value.kind === "file")[0]?.mimeType, "application/pdf");
    assert.equal(snapshot.materials.filter((value) => value.kind === "external-link").length, 1);
    assert.ok(requests.every((value) => value.authorization === "Bearer canvas-token"));
    assert.ok(requests.every((value) => new URL(value.url).origin === "https://school.instructure.com"));
  });

  it("builds a read-only OAuth request and exchanges the code without leaking the secret", async () => {
    const environment = {
      NODE_ENV: "test",
      CANVAS_INSTANCE_URL: "https://school.instructure.com",
      CANVAS_CLIENT_ID: "client-id",
      CANVAS_CLIENT_SECRET: "client-secret",
      CANVAS_REDIRECT_URI: "http://127.0.0.1:3000/api/lms/canvas/oauth/callback",
    } as NodeJS.ProcessEnv;
    const config = getCanvasOauthConfig(environment);
    assert.ok(config);
    const authorization = new URL(buildCanvasAuthorizationUrl(config, "state-value"));
    assert.equal(authorization.pathname, "/login/oauth2/auth");
    assert.equal(authorization.searchParams.get("state"), "state-value");
    assert.match(authorization.searchParams.get("scope") || "", /url:GET/);
    assert.equal(authorization.searchParams.has("client_secret"), false);

    let submitted = "";
    const token = await exchangeCanvasAuthorizationCode(config, "code-value", async (_input, init) => {
      submitted = String(init?.body);
      return new Response(JSON.stringify({
        access_token: "oauth-access",
        refresh_token: "oauth-refresh",
        expires_in: 3600,
        user: { name: "Canvas Student" },
      }), { status: 200, headers: { "Content-Type": "application/json" } });
    });
    assert.equal(token.accessToken, "oauth-access");
    assert.equal(token.refreshToken, "oauth-refresh");
    assert.match(submitted, /client_secret=client-secret/);
  });

  it("defines forced RLS and least-privilege grants for every LMS table", async () => {
    const sql = await readFile(
      path.resolve("supabase/migrations/20260724030000_lms_connector.sql"),
      "utf8",
    );
    for (const table of ["lms_connections", "lms_courses", "lms_materials", "lms_sync_runs"]) {
      assert.match(sql, new RegExp(`alter table public\\.${table} enable row level security`, "i"));
      assert.match(sql, new RegExp(`alter table public\\.${table} force row level security`, "i"));
      assert.match(sql, new RegExp(`revoke all on public\\.${table} from anon`, "i"));
    }
    assert.ok((sql.match(/\(select auth\.uid\(\)\)/g) || []).length >= 10);
    assert.match(sql, /lms_connections_user_updated_idx/);
    assert.match(sql, /lms_materials_user_course_idx/);
    assert.doesNotMatch(sql, /service[_-]?role/i);
    assert.doesNotMatch(sql, /grant all/i);
  });
});
