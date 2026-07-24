import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { analyzeWritingSignals, createEssayArtifact } from "../src/lib/writing-tools/analyzer";
import { findWritingArtifact, loadWritingArtifacts, saveWritingArtifact } from "../src/lib/writing-tools/storage";

class MemoryStorage {
  data = new Map<string, string>();
  getItem(key: string) { return this.data.get(key) ?? null; }
  setItem(key: string, value: string) { this.data.set(key, value); }
}

const sample = "Photosynthesis captures light energy and stores it as chemical energy. However, the process depends on chlorophyll and a reliable supply of carbon dioxide. Researchers compare measured oxygen production across different wavelengths to test which colors are absorbed most effectively. Therefore, every factual claim should be linked to the original experiment rather than inferred from writing style alone.";

describe("responsible writing tools", () => {
  it("creates an essay outline and concrete revision metrics", () => {
    const artifact = createEssayArtifact("How does light wavelength affect photosynthesis?", sample);
    assert.equal(artifact.kind, "essay");
    assert.equal(artifact.outline.length, 6);
    assert.equal(artifact.thesisOptions.length, 3);
    assert.ok(artifact.feedback.wordCount > 40);
    assert.ok(artifact.feedback.transitionCount >= 2);
    assert.ok(artifact.feedback.checklist.some((item) => /citation/i.test(item)));
  });

  it("reports measurable signals without inventing an AI probability", () => {
    const artifact = analyzeWritingSignals(sample);
    assert.equal(artifact.verdict, "indeterminate");
    assert.equal(artifact.signals.length, 4);
    assert.ok(artifact.signals.every((signal) => !signal.label.toLowerCase().includes("ai probability")));
    assert.ok(artifact.recommendations.some((item) => /misconduct/i.test(item)));
  });

  it("rejects insufficient samples and restores saved reports", () => {
    assert.throws(() => analyzeWritingSignals("Too short."), /80 characters/);
    const storage = new MemoryStorage();
    const artifact = analyzeWritingSignals(sample);
    saveWritingArtifact(storage, artifact);
    assert.equal(loadWritingArtifacts(storage).length, 1);
    assert.equal(findWritingArtifact(storage, "detector")?.id, artifact.id);
  });
});
