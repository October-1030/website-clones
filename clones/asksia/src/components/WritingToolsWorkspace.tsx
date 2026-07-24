"use client";

import type { FormEvent } from "react";
import { useEffect, useState } from "react";
import {
  AlertCircle,
  BarChart3,
  Check,
  Clipboard,
  FilePenLine,
  RefreshCw,
  ScanText,
  Sparkles,
  Trash2,
} from "lucide-react";
import { analyzeWritingSignals, createEssayArtifact } from "@/lib/writing-tools/analyzer";
import {
  deleteWritingArtifact,
  findWritingArtifact,
  saveWritingArtifact,
} from "@/lib/writing-tools/storage";
import { MAX_WRITING_CHARS, type DetectorArtifact, type EssayArtifact } from "@/lib/writing-tools/types";

type WritingTool = "essay" | "detector";

export default function WritingToolsWorkspace({ tool, onToast }: { tool: WritingTool; onToast: (message: string) => void }) {
  const [topic, setTopic] = useState("");
  const [text, setText] = useState("");
  const [essay, setEssay] = useState<EssayArtifact | null>(null);
  const [detector, setDetector] = useState<DetectorArtifact | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      const stored = findWritingArtifact(window.localStorage, tool);
      if (stored?.kind === "essay") {
        setEssay(stored);
        setTopic(stored.topic);
        setText(stored.draft);
      } else if (stored?.kind === "detector") {
        setDetector(stored);
        setText(stored.text);
      }
      setError(null);
    }, 0);
    return () => window.clearTimeout(timeout);
  }, [tool]);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    try {
      if (tool === "essay") {
        const artifact = createEssayArtifact(topic, text);
        setEssay(artifact);
        saveWritingArtifact(window.localStorage, artifact);
        onToast("Essay plan and revision review saved locally.");
      } else {
        const artifact = analyzeWritingSignals(text);
        setDetector(artifact);
        saveWritingArtifact(window.localStorage, artifact);
        onToast("Writing-signal review saved locally.");
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to analyze this text.");
    }
  }

  function clear() {
    const artifact = tool === "essay" ? essay : detector;
    if (artifact) deleteWritingArtifact(window.localStorage, artifact.id);
    if (tool === "essay") {
      setEssay(null);
      setTopic("");
    } else {
      setDetector(null);
    }
    setText("");
    setError(null);
    onToast(`${tool === "essay" ? "Essay review" : "Writing-signal review"} cleared.`);
  }

  async function copy() {
    const content = tool === "essay" && essay
      ? [essay.thesisOptions.join("\n"), ...essay.outline.map((item) => `${item.heading}: ${item.guidance}`), ...essay.feedback.checklist].join("\n\n")
      : detector
        ? [detector.signals.map((signal) => `${signal.label}: ${signal.value} — ${signal.interpretation}`).join("\n"), ...detector.recommendations].join("\n\n")
        : "";
    if (!content) return;
    await navigator.clipboard?.writeText(content);
    onToast("Writing review copied.");
  }

  const artifact = tool === "essay" ? essay : detector;
  return <section className="study-file-workspace writing-workspace" aria-label={`${tool === "essay" ? "Essay" : "AI detector"} workspace`}>
    <header className="study-file-header">
      <div><span className="everywhere-kicker">Responsible writing tools</span><h2>{tool === "essay" ? "Plan and revise an essay" : "Review writing signals"}</h2><p>{tool === "essay" ? "Build an arguable outline and inspect your own draft. StudyPal does not create a submission-ready paper." : "Measure style patterns without pretending they prove who or what wrote the text."}</p></div>
      <span className="demo-mode-badge">{tool === "essay" ? "Academic integrity mode" : "No fake AI probability"}</span>
    </header>
    <form className="writing-form" onSubmit={submit}>
      {tool === "essay" && <label>Essay topic or question<input value={topic} onChange={(event) => setTopic(event.target.value)} maxLength={500} placeholder="e.g. Evaluate how monetary policy affects inflation expectations" /></label>}
      <label>{tool === "essay" ? "Optional draft for revision feedback" : "Text to review"}<textarea value={text} onChange={(event) => setText(event.target.value)} maxLength={MAX_WRITING_CHARS} rows={9} placeholder={tool === "essay" ? "Paste your own draft here. Factual claims and citations will still require manual verification." : "Paste at least 80 characters. This review cannot determine authorship or prove AI use."} /></label>
      <div className="writing-form-footer"><span>{text.length.toLocaleString()}/{MAX_WRITING_CHARS.toLocaleString()} characters</span>{artifact && <button type="button" className="writing-secondary" onClick={clear}><Trash2 size={14} />Clear</button>}<button type="submit" className="writing-submit"><Sparkles size={14} />{artifact ? "Analyze again" : tool === "essay" ? "Build plan" : "Review signals"}</button></div>
    </form>
    {error && <div className="study-error" role="alert"><AlertCircle size={18} /><div><strong>More text is needed</strong><span>{error}</span></div></div>}

    {essay && tool === "essay" && <div className="writing-result">
      <div className="writing-result-header"><div><FilePenLine size={18} /><span><strong>Essay planning workspace</strong><small>{essay.feedback.wordCount} draft words · {essay.feedback.paragraphCount} paragraphs</small></span></div><button type="button" onClick={() => void copy()}><Clipboard size={14} />Copy plan</button></div>
      <section className="thesis-options"><h3>Thesis directions</h3>{essay.thesisOptions.map((option, index) => <article key={option}><span>{index + 1}</span><p>{option}</p></article>)}</section>
      <section className="essay-outline"><h3>Argument outline</h3>{essay.outline.map((item, index) => <article key={item.heading}><i>{index + 1}</i><div><strong>{item.heading}</strong><p>{item.guidance}</p></div></article>)}</section>
      <div className="draft-metrics"><article><span>Avg. sentence</span><strong>{essay.feedback.averageSentenceWords || "—"}</strong><small>words</small></article><article><span>Long sentences</span><strong>{essay.feedback.longSentenceCount}</strong><small>over 35 words</small></article><article><span>Transitions</span><strong>{essay.feedback.transitionCount}</strong><small>detected</small></article><article><span>Citation markers</span><strong>{essay.feedback.citationMarkerCount}</strong><small>verify manually</small></article></div>
      <section className="revision-checklist"><h3>Revision checklist</h3>{essay.feedback.checklist.map((item) => <p key={item}><Check size={14} />{item}</p>)}</section>
    </div>}

    {detector && tool === "detector" && <div className="writing-result">
      <div className="detector-verdict"><ScanText size={22} /><div><span>Authorship result</span><h3>Indeterminate</h3><p>These measurable patterns cannot prove that text is human- or AI-written. Use them for revision, never as misconduct evidence.</p></div></div>
      <div className="writing-result-header"><div><BarChart3 size={18} /><span><strong>Writing-signal report</strong><small>{detector.wordCount} words · {detector.characterCount} characters</small></span></div><button type="button" onClick={() => void copy()}><Clipboard size={14} />Copy report</button></div>
      <div className="signal-grid">{detector.signals.map((signal) => <article className={`signal-${signal.level}`} key={signal.label}><span>{signal.label}</span><strong>{signal.value}</strong><p>{signal.interpretation}</p></article>)}</div>
      {detector.repeatedPhrases.length > 0 && <section className="repeated-phrases"><h3>Repeated phrases</h3>{detector.repeatedPhrases.map((phrase) => <span key={phrase}>{phrase}</span>)}</section>}
      <section className="revision-checklist"><h3>Responsible next steps</h3>{detector.recommendations.map((item) => <p key={item}><Check size={14} />{item}</p>)}</section>
      <button type="button" className="rerun-writing" onClick={() => { setDetector(null); setError(null); }}><RefreshCw size={14} />Edit text and review again</button>
    </div>}
  </section>;
}
