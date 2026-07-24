"use client";

import { useEffect, useMemo, useState } from "react";
import {
  BookOpenCheck,
  Check,
  ChevronLeft,
  ChevronRight,
  Clipboard,
  FileQuestion,
  Layers3,
  RefreshCw,
  RotateCcw,
  Sparkles,
  Trash2,
} from "lucide-react";
import { generateLearningArtifact } from "@/lib/learning-tools/generator";
import {
  deleteLearningArtifact,
  findLearningArtifact,
  saveLearningArtifact,
} from "@/lib/learning-tools/storage";
import type {
  FlashcardArtifact,
  LearningArtifact,
  LearningToolKey,
  QuizArtifact,
  StudyGuideArtifact,
} from "@/lib/learning-tools/types";
import { loadStudySession } from "@/lib/study/storage";
import type { StudySession } from "@/lib/study/types";

const labels: Record<LearningToolKey, { title: string; description: string }> = {
  quiz: { title: "Quiz", description: "Test recall with questions whose correct evidence comes from your saved material." },
  "study-guide": { title: "Study guide", description: "Turn the saved summary, source sections, and review prompts into a focused plan." },
  flashcard: { title: "Flashcards", description: "Review key concepts with source-backed answers and citations." },
};

function updateArtifact(
  artifact: LearningArtifact,
  update: (current: LearningArtifact) => LearningArtifact,
): LearningArtifact {
  return { ...update(artifact), updatedAt: new Date().toISOString() };
}

export default function LearningToolsWorkspace({
  tool,
  onToast,
  onOpenFileSummary,
}: {
  tool: LearningToolKey;
  onToast: (message: string) => void;
  onOpenFileSummary: () => void;
}) {
  const [source, setSource] = useState<StudySession | null>(null);
  const [artifact, setArtifact] = useState<LearningArtifact | null>(null);
  const [count, setCount] = useState(5);
  const [cardIndex, setCardIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      const storedSource = loadStudySession(window.localStorage);
      setSource(storedSource);
      setArtifact(storedSource ? findLearningArtifact(window.localStorage, tool, storedSource.id) : null);
      setCardIndex(0);
      setFlipped(false);
    }, 0);
    return () => window.clearTimeout(timeout);
  }, [tool]);

  const answeredCount = useMemo(() => artifact?.tool === "quiz" ? Object.keys(artifact.answers).length : 0, [artifact]);
  const score = useMemo(() => {
    if (artifact?.tool !== "quiz") return 0;
    return artifact.questions.reduce((total, question) => total + (artifact.answers[question.id] === question.correctIndex ? 1 : 0), 0);
  }, [artifact]);

  function persist(next: LearningArtifact) {
    setArtifact(next);
    saveLearningArtifact(window.localStorage, next);
  }

  function generate() {
    if (!source) return;
    const next = generateLearningArtifact(tool, source, count);
    persist(next);
    setCardIndex(0);
    setFlipped(false);
    onToast(`${labels[tool].title} generated from ${source.file.name}.`);
  }

  function answer(questionId: string, optionIndex: number) {
    if (artifact?.tool !== "quiz") return;
    persist(updateArtifact(artifact, (current) => ({
      ...(current as QuizArtifact),
      answers: { ...(current as QuizArtifact).answers, [questionId]: optionIndex },
    })));
  }

  function resetQuiz() {
    if (artifact?.tool !== "quiz") return;
    persist(updateArtifact(artifact, (current) => ({ ...(current as QuizArtifact), answers: {} })));
  }

  function togglePlan(index: number) {
    if (artifact?.tool !== "study-guide") return;
    persist(updateArtifact(artifact, (current) => ({
      ...(current as StudyGuideArtifact),
      studyPlan: (current as StudyGuideArtifact).studyPlan.map((item, itemIndex) => itemIndex === index ? { ...item, completed: !item.completed } : item),
    })));
  }

  function clear() {
    if (!artifact) return;
    deleteLearningArtifact(window.localStorage, artifact.id);
    setArtifact(null);
    setCardIndex(0);
    setFlipped(false);
    onToast(`${labels[tool].title} cleared.`);
  }

  async function copy() {
    if (!artifact) return;
    let text = "";
    if (artifact.tool === "quiz") {
      text = artifact.questions.map((question, index) => `${index + 1}. ${question.prompt}\nAnswer: ${question.options[question.correctIndex]}\nSource: ${question.citation.label}`).join("\n\n");
    } else if (artifact.tool === "study-guide") {
      text = [artifact.title, artifact.overview, ...artifact.keyConcepts, ...artifact.reviewQuestions].join("\n\n");
    } else {
      text = artifact.cards.map((card) => `${card.front}\n${card.back}\nSource: ${card.citation.label}`).join("\n\n");
    }
    await navigator.clipboard?.writeText(text);
    onToast(`${labels[tool].title} copied.`);
  }

  if (!source) {
    return <section className="study-file-workspace learning-tool-workspace" aria-label={`${labels[tool].title} workspace`}>
      <header className="study-file-header"><div><span className="everywhere-kicker">Source required</span><h2>{labels[tool].title}</h2><p>{labels[tool].description}</p></div></header>
      <div className="learning-source-empty"><FileQuestion size={24} /><div><strong>Start with your own study material</strong><span>Upload and summarize a PDF or TXT first. StudyPal will use that extracted text as the only source.</span></div><button type="button" onClick={onOpenFileSummary}>Open File summary</button></div>
    </section>;
  }

  return <section className="study-file-workspace learning-tool-workspace" aria-label={`${labels[tool].title} workspace`}>
    <header className="study-file-header">
      <div><span className="everywhere-kicker">Source-backed study tool</span><h2>{labels[tool].title}</h2><p>{labels[tool].description}</p></div>
      <span className="demo-mode-badge">Using {source.file.name}</span>
    </header>
    <div className="learning-generator-bar">
      <div><BookOpenCheck size={17} /><span><strong>{source.file.name}</strong><small>{source.file.pageCount} source section{source.file.pageCount === 1 ? "" : "s"} · {source.provider.label}</small></span></div>
      {tool !== "study-guide" && <label>Items<select aria-label="Item count" value={count} onChange={(event) => setCount(Number(event.target.value))}><option value={3}>3</option><option value={5}>5</option><option value={8}>8</option></select></label>}
      <button type="button" className="learning-generate-button" onClick={generate}>{artifact ? <RefreshCw size={14} /> : <Sparkles size={14} />}{artifact ? "Regenerate" : "Generate"}</button>
    </div>

    {artifact && <div className="learning-artifact">
      <div className="learning-artifact-header"><div><strong>{artifact.tool === "flashcard" ? (artifact as FlashcardArtifact).title : artifact.title}</strong><span>Saved locally · grounded in {artifact.sourceName}</span></div><div><button type="button" onClick={() => void copy()}><Clipboard size={14} />Copy</button><button type="button" onClick={clear}><Trash2 size={14} />Clear</button></div></div>

      {artifact.tool === "quiz" && <div className="quiz-workspace">
        <div className="quiz-score"><span>{answeredCount}/{artifact.questions.length} answered</span><strong>{answeredCount === artifact.questions.length ? `${score}/${artifact.questions.length} correct` : "Complete every question to see your score"}</strong><button type="button" onClick={resetQuiz}><RotateCcw size={13} />Reset answers</button></div>
        {artifact.questions.map((question, questionIndex) => {
          const selected = artifact.answers[question.id];
          return <article className="quiz-question" key={question.id}><span>Question {questionIndex + 1}</span><h3>{question.prompt}</h3><div className="quiz-options">{question.options.map((option, optionIndex) => {
            const answered = selected !== undefined;
            const className = answered && optionIndex === question.correctIndex ? "quiz-option-correct" : answered && optionIndex === selected ? "quiz-option-wrong" : "";
            return <button type="button" className={className} key={`${question.id}-${optionIndex}`} onClick={() => answer(question.id, optionIndex)} disabled={answered}><i>{String.fromCharCode(65 + optionIndex)}</i>{option}</button>;
          })}</div>{selected !== undefined && <div className="quiz-explanation"><Check size={14} /><span><strong>{selected === question.correctIndex ? "Correct." : "Review this one."}</strong> {question.explanation} <em>{question.citation.excerpt}</em></span></div>}</article>;
        })}
      </div>}

      {artifact.tool === "study-guide" && <div className="study-guide-workspace">
        <article className="guide-overview"><span>Overview</span><p>{artifact.overview}</p></article>
        <div className="guide-columns"><article><span>Key concepts</span><ul>{artifact.keyConcepts.map((concept) => <li key={concept}>{concept}</li>)}</ul></article><article><span>Review questions</span><ol>{artifact.reviewQuestions.map((question) => <li key={question}>{question}</li>)}</ol></article></div>
        <section className="guide-outline"><h3>Source outline</h3>{artifact.outline.map((section) => <article key={`${section.heading}-${section.citation.label}`}><strong>{section.heading}</strong><p>{section.notes}</p><small>Source · {section.citation.label}</small></article>)}</section>
        <section className="guide-plan"><h3>Three-pass review plan</h3>{artifact.studyPlan.map((item, index) => <button type="button" className={item.completed ? "guide-plan-complete" : ""} key={item.title} onClick={() => togglePlan(index)}><i>{item.completed ? <Check size={13} /> : index + 1}</i><span><strong>{item.title}</strong><small>{item.task}</small></span></button>)}</section>
      </div>}

      {artifact.tool === "flashcard" && <div className="flashcard-workspace">
        <div className="flashcard-progress"><span>Card {cardIndex + 1} of {artifact.cards.length}</span><div><i style={{ width: `${((cardIndex + 1) / artifact.cards.length) * 100}%` }} /></div></div>
        <button type="button" className={`flashcard${flipped ? " flashcard-flipped" : ""}`} aria-label="Flip flashcard" onClick={() => setFlipped(!flipped)}>
          <span>{flipped ? "Answer" : "Concept"}</span><strong>{flipped ? artifact.cards[cardIndex].back : artifact.cards[cardIndex].front}</strong><small>{flipped ? `Source · ${artifact.cards[cardIndex].citation.label}` : "Click to reveal the source-backed answer"}</small>
        </button>
        <div className="flashcard-controls"><button type="button" onClick={() => { setCardIndex((current) => Math.max(0, current - 1)); setFlipped(false); }} disabled={cardIndex === 0}><ChevronLeft size={15} />Previous</button><button type="button" onClick={() => setFlipped(!flipped)}><Layers3 size={15} />Flip</button><button type="button" onClick={() => { setCardIndex((current) => Math.min(artifact.cards.length - 1, current + 1)); setFlipped(false); }} disabled={cardIndex === artifact.cards.length - 1}>Next<ChevronRight size={15} /></button></div>
      </div>}
    </div>}
  </section>;
}
