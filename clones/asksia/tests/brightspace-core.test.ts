import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, it } from "node:test";
import {
  BrightspaceClient,
  buildBrightspaceAuthorizationUrl,
  exchangeBrightspaceAuthorizationCode,
  getBrightspaceOauthConfig,
  refreshBrightspaceAccessToken,
} from "../src/lib/lms/brightspace";
import { normalizeBrightspaceInstanceUrl } from "../src/lib/lms/validation";

describe("D2L Brightspace connector", () => {
  const environment = {
    NODE_ENV: "test",
    BRIGHTSPACE_INSTANCE_URL: "https://school.brightspace.com",
    BRIGHTSPACE_CLIENT_ID: "client-id",
    BRIGHTSPACE_CLIENT_SECRET: "client-secret",
    BRIGHTSPACE_REDIRECT_URI: "http://127.0.0.1:3000/api/lms/brightspace/oauth/callback",
    BRIGHTSPACE_LP_VERSION: "1.49",
    BRIGHTSPACE_LE_VERSION: "1.82",
  } as NodeJS.ProcessEnv;

  it("allows approved Brightspace hosts and blocks SSRF-shaped instances", () => {
    assert.equal(normalizeBrightspaceInstanceUrl("https://school.brightspace.com/d2l/home"), "https://school.brightspace.com");
    assert.equal(
      normalizeBrightspaceInstanceUrl("https://learn.example.edu", {
        NODE_ENV: "test",
        STUDYPAL_LMS_ALLOWED_HOSTS: "learn.example.edu",
      } as NodeJS.ProcessEnv),
      "https://learn.example.edu",
    );
    for (const value of [
      "http://school.brightspace.com",
      "https://localhost",
      "https://10.0.0.1",
      "https://unapproved.example.edu",
      "https://user:pass@school.brightspace.com",
    ]) {
      assert.throws(() => normalizeBrightspaceInstanceUrl(value), /Brightspace|approved/);
    }
  });

  it("builds a read-only OAuth request and rotates refresh tokens with Basic client authentication", async () => {
    const config = getBrightspaceOauthConfig(environment);
    assert.ok(config);
    const authorization = new URL(buildBrightspaceAuthorizationUrl(config, "state-value"));
    assert.equal(authorization.origin, "https://auth.brightspace.com");
    assert.equal(authorization.searchParams.get("state"), "state-value");
    assert.match(authorization.searchParams.get("scope") || "", /content:toc:read/);
    assert.doesNotMatch(authorization.search, /client-secret/);

    const grants: string[] = [];
    const tokenFetch: typeof fetch = async (_input, init) => {
      const headers = new Headers(init?.headers);
      assert.equal(headers.get("authorization"), `Basic ${Buffer.from("client-id:client-secret").toString("base64")}`);
      grants.push(String(init?.body));
      return new Response(JSON.stringify({
        access_token: grants.length === 1 ? "access-one" : "access-two",
        refresh_token: grants.length === 1 ? "refresh-one" : "refresh-two",
        expires_in: 3600,
      }), { status: 200, headers: { "Content-Type": "application/json" } });
    };
    const initial = await exchangeBrightspaceAuthorizationCode(config, "authorization-code", tokenFetch);
    assert.equal(initial.refreshToken, "refresh-one");
    const rotated = await refreshBrightspaceAccessToken(config, initial.refreshToken || "", tokenFetch);
    assert.equal(rotated.accessToken, "access-two");
    assert.equal(rotated.refreshToken, "refresh-two");
    assert.match(grants[0], /grant_type=authorization_code/);
    assert.match(grants[1], /grant_type=refresh_token/);
  });

  it("paginates current-user course offerings and maps nested course content", async () => {
    const config = getBrightspaceOauthConfig(environment);
    assert.ok(config);
    const requests: string[] = [];
    const fetchImpl: typeof fetch = async (input, init) => {
      const url = new URL(input instanceof Request ? input.url : input.toString());
      requests.push(url.toString());
      assert.equal(new Headers(init?.headers).get("authorization"), "Bearer brightspace-token");
      const json = (value: unknown) => new Response(JSON.stringify(value), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
      if (url.pathname.endsWith("/users/whoami")) {
        return json({ Identifier: "7", UniqueName: "student", FirstName: "Test", LastName: "Student" });
      }
      if (url.pathname.endsWith("/enrollments/myenrollments/")) {
        if (url.searchParams.get("bookmark") === "11") {
          return json({
            PagingInfo: { Bookmark: "21", HasMoreItems: false },
            Items: [{
              OrgUnit: { Id: 21, Type: { Id: 3, Code: "Course Offering", Name: "Course Offering" }, Name: "History", Code: "HIS-21" },
              Access: { IsActive: true, CanAccess: true, ClasslistRoleName: "Learner" },
            }],
          });
        }
        return json({
          PagingInfo: { Bookmark: "11", HasMoreItems: true },
          Items: [
            {
              OrgUnit: { Id: 11, Type: { Id: 3, Code: "Course Offering", Name: "Course Offering" }, Name: "Biology", Code: "BIO-11" },
              Access: { IsActive: true, CanAccess: true, ClasslistRoleName: "Learner", StartDate: "2026-07-01T00:00:00Z" },
            },
            {
              OrgUnit: { Id: 1, Type: { Id: 1, Code: "Organization", Name: "Organization" }, Name: "School" },
              Access: { IsActive: true, CanAccess: true },
            },
          ],
        });
      }
      if (url.pathname.endsWith("/11/content/toc")) {
        return json({
          Modules: [{
            ModuleId: 100,
            Title: "Week 1",
            SortOrder: 1,
            Topics: [
              { TopicId: 101, Title: "Cells.pdf", Url: "/content/enforced/11/cells.pdf", SortOrder: 1, ActivityType: 1 },
              { TopicId: 102, Title: "Lab report", Url: "/d2l/le/dropbox/11/102", SortOrder: 2, ActivityType: 3 },
            ],
            Modules: [{
              ModuleId: 110,
              Title: "Extra",
              Topics: [{ TopicId: 111, Title: "Reference", Url: "https://example.edu/reference", ActivityType: 2 }],
            }],
          }],
        });
      }
      return new Response("not found", { status: 404 });
    };

    const client = new BrightspaceClient(config.instanceUrl, "brightspace-token", config, { fetchImpl });
    assert.equal((await client.verifyConnection()).displayName, "Test Student");
    const courses = await client.listCourses();
    assert.equal(courses.length, 2);
    assert.equal(courses[0].courseCode, "BIO-11");
    const snapshot = await client.loadCourseSnapshot(courses[0]);
    assert.equal(snapshot.materials.length, 5);
    assert.equal(snapshot.materials.find((value) => value.externalId === "101")?.kind, "file");
    assert.equal(snapshot.materials.find((value) => value.externalId === "102")?.kind, "assignment");
    assert.equal(snapshot.materials.find((value) => value.externalId === "111")?.moduleName, "Week 1 / Extra");
    assert.ok(requests.every((value) => new URL(value).origin === "https://school.brightspace.com"));
  });

  it("extends the provider constraint without weakening existing RLS", async () => {
    const sql = await readFile(
      path.resolve("supabase/migrations/20260724060000_add_brightspace_provider.sql"),
      "utf8",
    );
    assert.match(sql, /provider in \('canvas', 'blackboard', 'brightspace'\)/i);
    assert.doesNotMatch(sql, /disable row level security/i);
  });
});