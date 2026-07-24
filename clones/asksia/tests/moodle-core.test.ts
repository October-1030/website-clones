import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, it } from "node:test";
import { MoodleClient } from "../src/lib/lms/moodle";
import { normalizeMoodleInstanceUrl, parseMoodleConnectionInput } from "../src/lib/lms/validation";

describe("Moodle connector", () => {
  it("allows MoodleCloud and explicitly approved self-hosted domains while blocking unsafe hosts", () => {
    assert.equal(
      normalizeMoodleInstanceUrl("https://school.moodlecloud.com/my/"),
      "https://school.moodlecloud.com/my",
    );
    assert.equal(
      normalizeMoodleInstanceUrl("https://learn.example.edu/moodle", {
        NODE_ENV: "test",
        STUDYPAL_LMS_ALLOWED_HOSTS: "learn.example.edu",
      } as NodeJS.ProcessEnv),
      "https://learn.example.edu/moodle",
    );
    for (const value of [
      "http://school.moodlecloud.com",
      "https://localhost",
      "https://192.168.1.5",
      "https://unapproved.example.edu",
      "https://user:pass@school.moodlecloud.com",
    ]) {
      assert.throws(() => normalizeMoodleInstanceUrl(value), /Moodle|approved/);
    }
  });

  it("validates manual token input without accepting ownership fields", () => {
    const input = parseMoodleConnectionInput({
      instanceUrl: "https://school.moodlecloud.com",
      accessToken: " token ",
      accountLabel: " Biology ",
      userId: "other-user",
    });
    assert.deepEqual(input, {
      instanceUrl: "https://school.moodlecloud.com",
      accessToken: "token",
      accountLabel: "Biology",
    });
    assert.equal("userId" in input, false);
  });

  it("uses a POST body for the token and maps current-user courses and contents", async () => {
    const requests: Array<{ url: string; body: URLSearchParams }> = [];
    const fetchImpl: typeof fetch = async (input, init) => {
      const url = new URL(input instanceof Request ? input.url : input.toString());
      const body = new URLSearchParams(String(init?.body));
      requests.push({ url: url.toString(), body });
      assert.equal(init?.method, "POST");
      assert.equal(url.searchParams.has("wstoken"), false);
      assert.equal(body.get("wstoken"), "moodle-token");
      const json = (value: unknown) => new Response(JSON.stringify(value), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
      if (body.get("wsfunction") === "core_webservice_get_site_info") {
        return json({
          sitename: "Test Moodle",
          userid: 7,
          fullname: "Test Student",
          functions: [
            { name: "core_webservice_get_site_info" },
            { name: "core_enrol_get_users_courses" },
            { name: "core_course_get_contents" },
          ],
        });
      }
      if (body.get("wsfunction") === "core_enrol_get_users_courses") {
        assert.equal(body.get("userid"), "7");
        return json([
          { id: 11, shortname: "BIO-11", fullname: "Biology", visible: 1, startdate: 1782864000 },
          { id: 12, shortname: "HIDDEN", fullname: "Hidden", visible: 0 },
        ]);
      }
      if (body.get("wsfunction") === "core_course_get_contents") {
        assert.equal(body.get("courseid"), "11");
        return json([{
          id: 100,
          name: "Week 1",
          visible: 1,
          summary: "<p>Cells and membranes.</p>",
          section: 1,
          modules: [
            {
              id: 101,
              name: "Cells.pdf",
              modname: "resource",
              visible: 1,
              uservisible: true,
              url: "https://school.moodlecloud.com/mod/resource/view.php?id=101",
              contents: [{
                type: "file",
                filename: "cells.pdf",
                filepath: "/",
                fileurl: "https://school.moodlecloud.com/webservice/pluginfile.php/1/cells.pdf?token=secret-in-url",
                filesize: 2048,
                mimetype: "application/pdf",
              }],
            },
            {
              id: 102,
              name: "Lab report",
              modname: "assign",
              description: "<p>Compare cell types.</p>",
              dates: [{ label: "Due", timestamp: 1785542400 }],
            },
            {
              id: 103,
              name: "Reference",
              modname: "url",
              url: "https://example.edu/reference",
            },
          ],
        }]);
      }
      return json({ exception: "invalid_parameter_exception", errorcode: "invalidparameter", message: "bad request" });
    };

    const client = new MoodleClient("https://school.moodlecloud.com", "moodle-token", { fetchImpl });
    assert.equal((await client.verifyConnection()).displayName, "Test Student");
    const courses = await client.listCourses();
    assert.equal(courses.length, 1);
    assert.equal(courses[0].courseCode, "BIO-11");
    const snapshot = await client.loadCourseSnapshot(courses[0]);
    assert.equal(snapshot.materials.length, 5);
    assert.equal(snapshot.materials.find((value) => value.externalId === "102")?.kind, "assignment");
    assert.equal(snapshot.materials.find((value) => value.externalId === "102")?.textContent, "Compare cell types.");
    assert.equal(snapshot.materials.find((value) => value.externalId === "103")?.kind, "external-link");
    const childFile = snapshot.materials.find((value) => value.externalId.startsWith("101:file:"));
    assert.equal(childFile?.mimeType, "application/pdf");
    assert.doesNotMatch(childFile?.sourceUrl || "", /token=/);
    assert.ok(requests.every((value) => new URL(value.url).pathname === "/webservice/rest/server.php"));
  });

  it("maps Moodle token failures without reflecting server error details", async () => {
    const client = new MoodleClient("https://school.moodlecloud.com", "bad-token", {
      fetchImpl: async () => new Response(JSON.stringify({
        exception: "moodle_exception",
        errorcode: "invalidtoken",
        message: "Invalid token - token not found",
      }), { status: 200, headers: { "Content-Type": "application/json" } }),
    });
    await assert.rejects(() => client.verifyConnection(), (error: unknown) => {
      assert.equal((error as { code?: string }).code, "moodle_token_rejected");
      assert.doesNotMatch((error as Error).message, /not found/i);
      return true;
    });
  });

  it("extends the provider constraint without weakening existing RLS", async () => {
    const sql = await readFile(
      path.resolve("supabase/migrations/20260724070000_add_moodle_provider.sql"),
      "utf8",
    );
    assert.match(sql, /provider in \('canvas', 'blackboard', 'brightspace', 'moodle'\)/i);
    assert.doesNotMatch(sql, /disable row level security/i);
  });
});