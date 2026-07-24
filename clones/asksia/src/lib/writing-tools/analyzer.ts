import { MAX_WRITING_CHARS, type DetectorArtifact, type EssayArtifact } from "./types";

const transitions = new Set([
  "however", "therefore", "furthermore", "moreover", "consequently", "although", "because",
  "first", "second", "finally", "in contrast", "for example", "for instance", "nevertheless",
]);

function normalize(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function words(value: string): string[] {
  return value.toLowerCase().match(/[a-z0-9][a-z0-9'-]*|[\p{Script=Han}]/gu) ?? [];
}

function sentences(value: string): string[] {
  return value
    .split(/(?<=[.!?。！？])\s+|\n+/u)
    .map(normalize)
    .filter(Boolean);
}

function topicLabel(topic: string, draft: string): string {
  const cleaned = normalize(topic);
  if (cleaned) return cleaned.slice(0, 180);
  const first = sentences(draft)[0] || "the selected topic";
  return first.slice(0, 180);
}

export function createEssayArtifact(topic: string, draft: string): EssayArtifact {
  const safeTopic = normalize(topic).slice(0, 500);
  const safeDraft = draft.trim().slice(0, MAX_WRITING_CHARS);
  if (safeTopic.length < 3 && safeDraft.length < 30) throw new Error("Add a topic or at least 30 characters of draft text.");
  const label = topicLabel(safeTopic, safeDraft);
  const draftWords = words(safeDraft);
  const draftSentences = sentences(safeDraft);
  const paragraphCount = safeDraft ? safeDraft.split(/\n\s*\n/).filter((paragraph) => paragraph.trim()).length : 0;
  const averageSentenceWords = draftSentences.length
    ? Math.round(draftSentences.reduce((total, sentence) => total + words(sentence).length, 0) / draftSentences.length)
    : 0;
  const lowerDraft = safeDraft.toLowerCase();
  const transitionCount = [...transitions].reduce((total, phrase) => total + (lowerDraft.match(new RegExp(`\\b${phrase.replace(" ", "\\s+")}\\b`, "g"))?.length ?? 0), 0);
  const citationMarkerCount = (safeDraft.match(/\([A-Z][^)]*,\s*\d{4}[a-z]?\)|\[\d+\]|doi:|https?:\/\//gi) ?? []).length;
  const checklist = [
    paragraphCount < 3 ? "Separate the argument into an introduction, focused body paragraphs, and a conclusion." : "Check that every paragraph begins with one clear claim.",
    averageSentenceWords > 28 ? "Split long sentences where more than one main claim is doing work." : "Vary sentence length while keeping the main claim easy to find.",
    transitionCount === 0 ? "Add explicit transitions where the argument changes direction or adds evidence." : "Verify that each transition describes the real logical relationship.",
    citationMarkerCount === 0 ? "Add citations for factual claims and evidence; never invent a source." : "Check every citation against the original source and required style.",
    "Write the counterargument in its strongest fair form before responding to it.",
    "Compare the conclusion with the thesis: it should answer the same question without merely repeating it.",
  ];
  const now = new Date().toISOString();
  return {
    version: 1,
    id: crypto.randomUUID(),
    kind: "essay",
    topic: safeTopic,
    draft: safeDraft,
    thesisOptions: [
      `${label} matters because its causes, evidence, and consequences reveal a larger academic problem that requires a clear evaluation.`,
      `A strong analysis of ${label} should compare the leading explanations, test them against evidence, and defend the interpretation with the best support.`,
      `Although common accounts of ${label} emphasize one factor, a more complete argument must consider competing evidence and practical implications.`,
    ],
    outline: [
      { heading: "Introduction", guidance: "Define the precise question, establish why it matters, and end with one arguable thesis." },
      { heading: "Context and terms", guidance: "Define essential concepts and give only the background needed to understand the argument." },
      { heading: "Evidence section 1", guidance: "Make one claim, present a verified source, and explain how the evidence supports the thesis." },
      { heading: "Evidence section 2", guidance: "Add a distinct line of evidence instead of repeating the first section." },
      { heading: "Counterargument", guidance: "Present the strongest reasonable objection, then answer it with evidence or limits." },
      { heading: "Conclusion", guidance: "Synthesize the result, state its implications, and avoid introducing unsupported claims." },
    ],
    feedback: {
      wordCount: draftWords.length,
      paragraphCount,
      averageSentenceWords,
      longSentenceCount: draftSentences.filter((sentence) => words(sentence).length > 35).length,
      transitionCount,
      citationMarkerCount,
      checklist,
    },
    createdAt: now,
    updatedAt: now,
  };
}

function coefficientOfVariation(values: number[]): number {
  if (values.length < 2) return 0;
  const average = values.reduce((total, value) => total + value, 0) / values.length;
  if (average === 0) return 0;
  const variance = values.reduce((total, value) => total + ((value - average) ** 2), 0) / values.length;
  return Math.sqrt(variance) / average;
}

function repeatedPhrases(tokens: string[]): string[] {
  const counts = new Map<string, number>();
  for (let index = 0; index < tokens.length - 2; index += 1) {
    const phrase = tokens.slice(index, index + 3).join(" ");
    counts.set(phrase, (counts.get(phrase) ?? 0) + 1);
  }
  return [...counts.entries()]
    .filter(([, count]) => count >= 3)
    .sort((left, right) => right[1] - left[1])
    .slice(0, 5)
    .map(([phrase, count]) => `${phrase} · ${count} times`);
}

export function analyzeWritingSignals(input: string): DetectorArtifact {
  const text = input.trim().slice(0, MAX_WRITING_CHARS);
  if (text.length < 80) throw new Error("Add at least 80 characters for a useful writing-signal review.");
  const tokenList = words(text);
  const sentenceList = sentences(text);
  const sentenceLengths = sentenceList.map((sentence) => words(sentence).length).filter(Boolean);
  const uniqueRatio = tokenList.length ? new Set(tokenList).size / tokenList.length : 0;
  const variation = coefficientOfVariation(sentenceLengths);
  const repetitions = repeatedPhrases(tokenList);
  const averageSentence = sentenceLengths.length ? sentenceLengths.reduce((total, value) => total + value, 0) / sentenceLengths.length : 0;
  const now = new Date().toISOString();
  return {
    version: 1,
    id: crypto.randomUUID(),
    kind: "detector",
    text,
    wordCount: tokenList.length,
    characterCount: text.length,
    verdict: "indeterminate",
    signals: [
      {
        label: "Sentence-length variation",
        value: variation.toFixed(2),
        interpretation: variation < 0.25 ? "Sentence lengths are unusually uniform. Review rhythm, but this does not identify authorship." : "Sentence lengths show natural variation.",
        level: variation < 0.25 ? "notice" : "neutral",
      },
      {
        label: "Lexical diversity",
        value: `${Math.round(uniqueRatio * 100)}%`,
        interpretation: uniqueRatio < 0.35 ? "Vocabulary repeats often; revise repeated wording where clarity allows." : "Vocabulary is reasonably varied for this sample.",
        level: uniqueRatio < 0.35 ? "notice" : "neutral",
      },
      {
        label: "Average sentence length",
        value: `${averageSentence.toFixed(1)} words`,
        interpretation: averageSentence > 30 ? "Long average sentences may hide multiple claims." : averageSentence < 8 ? "Very short average sentences may make the prose feel abrupt." : "Average sentence length is within a broadly readable range.",
        level: averageSentence > 30 || averageSentence < 8 ? "review" : "neutral",
      },
      {
        label: "Repeated three-word phrases",
        value: String(repetitions.length),
        interpretation: repetitions.length ? "Repeated phrase patterns were found and are listed below." : "No three-word phrase appears three or more times.",
        level: repetitions.length ? "notice" : "neutral",
      },
    ],
    repeatedPhrases: repetitions,
    recommendations: [
      "Verify facts, quotations, and citations against original sources.",
      "Read the text aloud and revise rhythm, repetition, and vague transitions.",
      "Keep drafts or revision history if authorship evidence matters.",
      "Do not use automated detector output as proof of academic misconduct.",
    ],
    createdAt: now,
    updatedAt: now,
  };
}
