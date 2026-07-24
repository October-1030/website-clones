import type { StudyCitation, StudySession, StudySourcePage } from "../study/types";
import type {
  FlashcardArtifact,
  LearningArtifact,
  LearningToolKey,
  QuizArtifact,
  QuizQuestion,
  StudyGuideArtifact,
} from "./types";

function clean(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function clip(value: string, length = 220): string {
  const normalized = clean(value);
  return normalized.length > length ? `${normalized.slice(0, length - 1)}…` : normalized;
}

function sentenceCandidates(pages: StudySourcePage[]): Array<{ text: string; citation: StudyCitation }> {
  const candidates: Array<{ text: string; citation: StudyCitation }> = [];
  for (const page of pages) {
    const sentences = page.text
      .split(/(?<=[.!?。！？])\s+|\n+/u)
      .map(clean)
      .filter((sentence) => sentence.length >= 30);
    for (const sentence of sentences) {
      candidates.push({
        text: clip(sentence, 260),
        citation: { page: page.page, label: page.label, excerpt: clip(sentence, 260) },
      });
    }
  }
  if (candidates.length > 0) return candidates;
  return pages
    .map((page) => clean(page.text))
    .filter(Boolean)
    .map((text, index) => ({
      text: clip(text, 260),
      citation: { page: pages[index].page, label: pages[index].label, excerpt: clip(text, 260) },
    }));
}

function evidenceForConcept(
  concept: string,
  candidates: Array<{ text: string; citation: StudyCitation }>,
  fallbackIndex: number,
) {
  const terms = concept.toLowerCase().match(/[a-z0-9-]{3,}|[\p{Script=Han}]{2,}/gu) ?? [];
  return candidates.find((candidate) => terms.some((term) => candidate.text.toLowerCase().includes(term)))
    ?? candidates[fallbackIndex % candidates.length];
}

function base<T extends LearningToolKey>(tool: T, session: StudySession) {
  const now = new Date().toISOString();
  return {
    version: 1 as const,
    id: crypto.randomUUID(),
    tool,
    sourceSessionId: session.id,
    sourceName: session.file.name,
    createdAt: now,
    updatedAt: now,
  };
}

function buildQuiz(session: StudySession, questionCount: number): QuizArtifact {
  const candidates = sentenceCandidates(session.pages);
  const concepts = session.summary.keyConcepts.length > 0
    ? session.summary.keyConcepts
    : session.summary.reviewQuestions;
  const available = concepts.length > 0 ? concepts : candidates.map((candidate) => candidate.text.slice(0, 60));
  const count = Math.max(3, Math.min(questionCount, Math.max(3, available.length), 10));
  const questions: QuizQuestion[] = [];
  for (let index = 0; index < count; index += 1) {
    const concept = available[index % available.length];
    const correct = evidenceForConcept(concept, candidates, index);
    const distractors = candidates
      .filter((candidate) => candidate.text !== correct.text)
      .filter((candidate, candidateIndex, array) => array.findIndex((item) => item.text === candidate.text) === candidateIndex)
      .slice(index % Math.max(1, candidates.length - 1), index % Math.max(1, candidates.length - 1) + 3);
    while (distractors.length < 3) {
      distractors.push({
        text: `This statement is not supported by the selected material (${distractors.length + 1}).`,
        citation: correct.citation,
      });
    }
    const correctIndex = index % 4;
    const options = distractors.slice(0, 3).map((item) => item.text);
    options.splice(correctIndex, 0, correct.text);
    questions.push({
      id: crypto.randomUUID(),
      prompt: `Which excerpt from the material best supports this concept?\n${clip(concept, 160)}`,
      options,
      correctIndex,
      explanation: `The correct option is quoted from ${correct.citation.label}.`,
      citation: correct.citation,
    });
  }
  return {
    ...base("quiz", session),
    title: `Quiz · ${session.file.name}`,
    questions,
    answers: {},
  };
}

function buildStudyGuide(session: StudySession): StudyGuideArtifact {
  const candidates = sentenceCandidates(session.pages);
  const outline = session.pages.slice(0, 8).map((page, index) => {
    const excerpt = candidates.find((candidate) => candidate.citation.label === page.label)
      ?? { text: clip(page.text, 260), citation: { page: page.page, label: page.label, excerpt: clip(page.text, 260) } };
    return {
      heading: page.page ? `Page ${page.page}` : `Section ${index + 1}`,
      notes: excerpt.text,
      citation: excerpt.citation,
    };
  });
  return {
    ...base("study-guide", session),
    title: `Study guide · ${session.file.name}`,
    overview: session.summary.overview,
    keyConcepts: session.summary.keyConcepts,
    outline,
    reviewQuestions: session.summary.reviewQuestions,
    studyPlan: [
      { title: "Pass 1 · Understand", task: "Read the overview and explain each key concept in your own words.", completed: false },
      { title: "Pass 2 · Retrieve", task: "Answer every review question without looking at the notes.", completed: false },
      { title: "Pass 3 · Verify", task: "Reopen the cited source sections and correct any weak answers.", completed: false },
    ],
  };
}

function buildFlashcards(session: StudySession, cardCount: number): FlashcardArtifact {
  const candidates = sentenceCandidates(session.pages);
  const concepts = session.summary.keyConcepts.length > 0
    ? session.summary.keyConcepts
    : session.summary.reviewQuestions;
  const available = concepts.length > 0 ? concepts : candidates.map((candidate) => candidate.text.slice(0, 80));
  const count = Math.max(3, Math.min(cardCount, Math.max(3, available.length), 20));
  const cards = Array.from({ length: count }, (_, index) => {
    const concept = available[index % available.length];
    const evidence = evidenceForConcept(concept, candidates, index);
    return {
      id: crypto.randomUUID(),
      front: clip(concept, 180),
      back: evidence.text,
      citation: evidence.citation,
    };
  });
  return {
    ...base("flashcard", session),
    title: `Flashcards · ${session.file.name}`,
    cards,
  };
}

export function generateLearningArtifact(
  tool: LearningToolKey,
  session: StudySession,
  count = 5,
): LearningArtifact {
  if (session.pages.length === 0) throw new Error("The source session has no extracted material.");
  if (tool === "quiz") return buildQuiz(session, count);
  if (tool === "study-guide") return buildStudyGuide(session);
  return buildFlashcards(session, count);
}
