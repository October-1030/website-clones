import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import { listLibraryItems } from "../src/lib/library";
import type { HomeworkSession } from "../src/lib/homework/types";
import type { StudySession } from "../src/lib/study/types";

let root = "";
const previous = process.env.STUDYPAL_DATA_DIR;

before(async () => {
  root = await mkdtemp(path.join(tmpdir(), "studypal-library-"));
  process.env.STUDYPAL_DATA_DIR = root;
  await mkdir(path.join(root, "sessions"), { recursive: true });
  await mkdir(path.join(root, "homework"), { recursive: true });
  const study: StudySession = {
    version: 1,
    id: "study-one",
    file: { name: "lecture.txt", kind: "txt", type: "text/plain", size: 100, pageCount: 1, uploadedAt: "2026-07-20T00:00:00.000Z" },
    provider: { id: "fixture", mode: "demo", label: "Fixture" },
    pages: [{ page: 1, label: "Page 1", text: "Material" }],
    summary: { overview: "Overview", keyConcepts: ["Energy"], reviewQuestions: ["What is energy?"] },
    messages: [],
    truncated: false,
    createdAt: "2026-07-20T00:00:00.000Z",
    updatedAt: "2026-07-21T00:00:00.000Z",
  };
  const homework: HomeworkSession = {
    version: 1,
    id: "homework-one",
    problem: "Calculate the acceleration of a two kilogram object.",
    solution: { subject: "Physics", problemRestatement: "Problem", knowns: [], method: "Newton", steps: [{ title: "Apply", explanation: "Use F=ma", expression: "a=F/m" }], finalAnswer: "3 m/s2", verification: "Checked", assumptions: [] },
    provider: { id: "fixture", mode: "demo", label: "Fixture" },
    createdAt: "2026-07-22T00:00:00.000Z",
    updatedAt: "2026-07-23T00:00:00.000Z",
  };
  await writeFile(path.join(root, "sessions", "study-one.json"), JSON.stringify(study));
  await writeFile(path.join(root, "homework", "homework-one.json"), JSON.stringify(homework));
  await writeFile(path.join(root, "sessions", "bad.json"), "{");
});

after(async () => {
  if (previous === undefined) delete process.env.STUDYPAL_DATA_DIR;
  else process.env.STUDYPAL_DATA_DIR = previous;
  await rm(root, { recursive: true, force: true });
});

describe("local library index", () => {
  it("lists valid session metadata, ignores corruption, and sorts newest first", async () => {
    const items = await listLibraryItems();
    assert.equal(items.length, 2);
    assert.equal(items[0].kind, "homework");
    assert.match(items[0].href, /homeworkSession=homework-one/);
    assert.equal(items[1].title, "lecture.txt");
    assert.match(items[1].href, /session=study-one/);
    assert.ok(items.every((item) => !JSON.stringify(item).includes("Material")));
  });
});
