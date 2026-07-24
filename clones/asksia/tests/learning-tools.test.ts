import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { generateLearningArtifact } from "../src/lib/learning-tools/generator";
import {
  deleteLearningArtifact,
  findLearningArtifact,
  loadLearningArtifacts,
  saveLearningArtifact,
} from "../src/lib/learning-tools/storage";
import type { StudySession } from "../src/lib/study/types";

function fixtureSession(): StudySession {
  return {
    version: 1,
    id: "source-session",
    file: { name: "photosynthesis.txt", kind: "txt", type: "text/plain", size: 500, pageCount: 1, uploadedAt: "2026-07-23T00:00:00.000Z" },
    provider: { id: "fixture", mode: "demo", label: "Fixture provider" },
    pages: [{
      page: 1,
      label: "Page 1",
      text: "Photosynthesis captures light energy and stores it as chemical energy in glucose. Chlorophyll absorbs red and blue wavelengths inside chloroplasts. Carbon dioxide and water are transformed while oxygen is released. Cellular respiration later releases stored chemical energy for cell work.",
    }],
    summary: {
      overview: "Photosynthesis stores light energy in glucose and releases oxygen.",
      keyConcepts: ["Photosynthesis and chemical energy", "Chlorophyll absorption", "Carbon dioxide transformation", "Cellular respiration"],
      reviewQuestions: ["How does photosynthesis store energy?", "What does chlorophyll absorb?"],
    },
    messages: [],
    truncated: false,
    createdAt: "2026-07-23T00:00:00.000Z",
    updatedAt: "2026-07-23T00:00:00.000Z",
  };
}

class MemoryStorage {
  data = new Map<string, string>();
  getItem(key: string) { return this.data.get(key) ?? null; }
  setItem(key: string, value: string) { this.data.set(key, value); }
}

describe("source-backed learning tools", () => {
  it("generates a grounded quiz with source citations", () => {
    const artifact = generateLearningArtifact("quiz", fixtureSession(), 3);
    assert.equal(artifact.tool, "quiz");
    assert.equal(artifact.questions.length, 3);
    for (const question of artifact.questions) {
      assert.equal(question.options.length, 4);
      assert.ok(question.options[question.correctIndex].length > 20);
      assert.equal(question.citation.label, "Page 1");
      assert.ok(question.citation.excerpt.length > 20);
    }
  });

  it("generates a guide and flashcards from the same source", () => {
    const guide = generateLearningArtifact("study-guide", fixtureSession());
    assert.equal(guide.tool, "study-guide");
    assert.equal(guide.outline[0].citation.label, "Page 1");
    assert.equal(guide.studyPlan.length, 3);
    const cards = generateLearningArtifact("flashcard", fixtureSession(), 3);
    assert.equal(cards.tool, "flashcard");
    assert.equal(cards.cards.length, 3);
    assert.match(cards.cards[0].back, /Photosynthesis/i);
  });

  it("saves, restores, replaces, and deletes artifacts", () => {
    const storage = new MemoryStorage();
    const artifact = generateLearningArtifact("quiz", fixtureSession(), 3);
    saveLearningArtifact(storage, artifact);
    assert.equal(loadLearningArtifacts(storage).length, 1);
    assert.equal(findLearningArtifact(storage, "quiz", "source-session")?.id, artifact.id);
    saveLearningArtifact(storage, { ...artifact, updatedAt: "2026-07-24T00:00:00.000Z" });
    assert.equal(loadLearningArtifacts(storage).length, 1);
    deleteLearningArtifact(storage, artifact.id);
    assert.equal(loadLearningArtifacts(storage).length, 0);
  });
});
