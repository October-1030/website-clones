import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, it } from "node:test";
import {
  BlackboardClient,
  getBlackboardConfig,
  requestBlackboardAccessToken,
} from "../src/lib/lms/blackboard";
import { normalizeBlackboardInstanceUrl } from "../src/lib/lms/validation";

describe("Blackboard Learn connector", () => {
  it("allows hosted and explicitly approved Blackboard domains while blocking unsafe hosts", () => {
    assert.equal(
      normalizeBlackboardInstanceUrl("https://school.blackboard.com/ultra"),
      "https://school.blackboard.com",
    );
    assert.equal(
      normalizeBlackboardInstanceUrl("https://learn.example.edu", {
        NODE_ENV: "test",
        STUDYPAL_LMS_ALLOWED_HOSTS: "learn.example.edu",
      } as NodeJS.ProcessEnv),
      "https://learn.example.edu",
    );
    for (const value of [
      "http://school.blackboard.com",
      "https://localhost",
      "https://10.0.0.1",
      "https://unapproved.example.edu",
      "https://user:pass@school.blackboard.com",
    ]) {
      assert.throws(() => normalizeBlackboardInstanceUrl(value), /Blackboard|approved/);
    }
  });

  it("requests a short-lived token with client credentials only on the server", async () => {
    const config = getBlackboardConfig({
      NODE_ENV: "test",
      BLACKBOARD_INSTANCE_URL: "https://school.blackboard.com",
      BLACKBOARD_APP_KEY: "app-key",
      BLACKBOARD_APP_SECRET: "app-secret",
    } as NodeJS.ProcessEnv);
    assert.ok(config);
    let authorization = "";
    let body = "";
    const token = await requestBlackboardAccessToken(config, async (input, init) => {
      assert.equal(new URL(input instanceof Request ? input.url : input.toString()).pathname, "/learn/api/public/v1/oauth2/token");
      const headers = new Headers(init?.headers);
      authorization = headers.get("authorization") || "";
      body = String(init?.body);
      return new Response(JSON.stringify({ access_token: "blackboard-token", expires_in: 3600 }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    });
    assert.equal(authorization, `Basic ${Buffer.from("app-key:app-secret").toString("base64")}`);
    assert.equal(body, "grant_type=client_credentials");
    assert.equal(token.accessToken, "blackboard-token");
    assert.ok(new Date(token.expiresAt).valueOf() > Date.now());
  });

  it("discovers current-user courses and recursively maps read-only course content", async () => {
    const requests: string[] = [];
    const fetchImpl: typeof fetch = async (input, init) => {
      const url = new URL(input instanceof Request ? input.url : input.toString());
      const headers = new Headers(init?.headers);
      assert.equal(headers.get("authorization"), "Bearer blackboard-token");
      requests.push(url.toString());
      const json = (value: unknown) => new Response(JSON.stringify(value), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
      if (url.pathname === "/learn/api/public/v1/users/me") {
        return json({ id: "_10_1", userName: "student", name: { given: "Test", family: "Student" }, contact: { email: "student@example.test" } });
      }
      if (url.pathname === "/learn/api/public/v1/users/me/courses") {
        return json({
          results: [{
            courseId: "_20_1",
            courseRoleId: "Student",
            course: {
              id: "_20_1",
              courseId: "BIO-20",
              name: "Biology",
              availability: { available: "Yes", duration: { start: "2026-07-01T00:00:00Z", end: "2026-12-01T00:00:00Z" } },
            },
          }],
        });
      }
      if (url.pathname === "/learn/api/public/v1/courses/_20_1/contents") {
        return json({
          results: [
            { id: "_30_1", title: "Week 1", position: 1, hasChildren: true, contentHandler: { id: "resource/x-bb-folder" } },
            { id: "_31_1", title: "Welcome", body: "<p>Course overview</p>", position: 2, contentHandler: { id: "resource/x-bb-document" }, links: [{ rel: "alternate", href: "/ultra/courses/_20_1/outline/edit/document/_31_1", type: "text/html" }] },
          ],
        });
      }
      if (url.pathname === "/learn/api/public/v1/courses/_20_1/contents/_30_1/children") {
        return json({
          results: [
            { id: "_32_1", title: "Reading", body: "<h2>Cells</h2><p>Cells contain membranes.</p>", position: 1, contentHandler: { id: "resource/x-bb-document" } },
            { id: "_33_1", title: "Lab", description: "<p>Submit the lab report.</p>", position: 2, contentHandler: { id: "resource/x-bb-assignment" } },
          ],
        });
      }
      return new Response("not found", { status: 404 });
    };

    const client = new BlackboardClient("https://school.blackboard.com", "blackboard-token", { fetchImpl });
    assert.equal((await client.verifyConnection()).displayName, "Test Student");
    const courses = await client.listCourses();
    assert.equal(courses.length, 1);
    assert.equal(courses[0].courseCode, "BIO-20");
    const snapshot = await client.loadCourseSnapshot(courses[0]);
    assert.equal(snapshot.materials.length, 4);
    assert.equal(snapshot.materials.find((value) => value.externalId === "_32_1")?.moduleName, "Week 1");
    assert.equal(snapshot.materials.find((value) => value.externalId === "_32_1")?.textContent, "Cells\nCells contain membranes.");
    assert.equal(snapshot.materials.find((value) => value.externalId === "_33_1")?.kind, "assignment");
    assert.ok(requests.every((value) => new URL(value).origin === "https://school.blackboard.com"));
  });

  it("extends the provider constraint without weakening existing RLS", async () => {
    const sql = await readFile(
      path.resolve("supabase/migrations/20260724050000_add_blackboard_provider.sql"),
      "utf8",
    );
    assert.match(sql, /provider in \('canvas', 'blackboard'\)/i);
    const base = await readFile(
      path.resolve("supabase/migrations/20260724030000_lms_connector.sql"),
      "utf8",
    );
    assert.match(base, /alter table public\.lms_connections force row level security/i);
    assert.doesNotMatch(sql, /disable row level security/i);
  });
});
