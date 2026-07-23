"use client";

import type { ChangeEvent, DragEvent, FormEvent } from "react";
import { useEffect, useRef, useState } from "react";
import { AlertCircle, BookOpenCheck, Check, FileText, LoaderCircle, MessageSquareText, RefreshCw, Trash2, Upload, X } from "lucide-react";
import { validateStudyFile } from "@/lib/study/file-validation";
import { clearStudySession, loadStudySession, saveStudySession } from "@/lib/study/storage";
import type { StudyQuestionResult, StudySession } from "@/lib/study/types";

type ProcessingPhase = "idle" | "validating" | "uploading" | "parsing" | "summarizing" | "done" | "error" | "cancelled";

const phaseCopy: Record<ProcessingPhase, string> = {
  idle: "等待选择资料",
  validating: "正在校验文件",
  uploading: "正在发送到本机解析服务",
  parsing: "正在提取资料文字",
  summarizing: "正在生成结构化总结",
  done: "资料已准备好",
  error: "处理失败",
  cancelled: "已取消",
};

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function responseError(payload: unknown, fallback: string): string {
  if (payload && typeof payload === "object" && "error" in payload && typeof payload.error === "string") return payload.error;
  return fallback;
}

export default function StudyFileWorkspace({ onToast }: { onToast: (message: string) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const progressTimerRef = useRef<number | null>(null);
  const [phase, setPhase] = useState<ProcessingPhase>("idle");
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [session, setSession] = useState<StudySession | null>(null);
  const [restored, setRestored] = useState(false);
  const [lastFile, setLastFile] = useState<File | null>(null);
  const [question, setQuestion] = useState("");
  const [asking, setAsking] = useState(false);
  const [dragActive, setDragActive] = useState(false);

  useEffect(() => {
    const stored = loadStudySession(window.localStorage);
    if (stored) {
      setSession(stored);
      setPhase("done");
      setProgress(100);
      setRestored(true);
    }
    return () => {
      abortRef.current?.abort();
      if (progressTimerRef.current !== null) window.clearInterval(progressTimerRef.current);
    };
  }, []);

  function persist(next: StudySession) {
    setSession(next);
    try {
      saveStudySession(window.localStorage, next);
    } catch {
      onToast("资料已处理，但浏览器本地空间不足，无法保存恢复记录");
    }
  }

  function clearTimer() {
    if (progressTimerRef.current !== null) {
      window.clearInterval(progressTimerRef.current);
      progressTimerRef.current = null;
    }
  }

  async function processFile(file: File) {
    abortRef.current?.abort();
    clearTimer();
    setRestored(false);
    setLastFile(file);
    setError(null);
    setSession(null);
    setPhase("validating");
    setProgress(6);

    const validation = validateStudyFile(file);
    if (!validation.valid) {
      setError(validation.error);
      setPhase("error");
      setProgress(0);
      return;
    }

    const controller = new AbortController();
    abortRef.current = controller;
    setPhase("uploading");
    setProgress(16);
    progressTimerRef.current = window.setInterval(() => {
      setProgress((current) => {
        const next = Math.min(88, current + (current < 50 ? 8 : 4));
        if (next >= 66) setPhase("summarizing");
        else if (next >= 38) setPhase("parsing");
        return next;
      });
    }, 320);

    try {
      const formData = new FormData();
      formData.append("file", file);
      const response = await fetch("/api/study/extract", { method: "POST", body: formData, signal: controller.signal });
      const payload = await response.json() as { session?: StudySession; error?: string };
      if (!response.ok || !payload.session) throw new Error(responseError(payload, "资料处理失败，请重试。"));
      clearTimer();
      setProgress(100);
      setPhase("done");
      persist(payload.session);
      onToast("资料已提取、总结并保存在本机");
    } catch (caught) {
      clearTimer();
      if (caught instanceof DOMException && caught.name === "AbortError") {
        setPhase("cancelled");
        setError("已取消本次处理。你可以重新选择文件。 ");
      } else {
        setPhase("error");
        setError(caught instanceof Error ? caught.message : "资料处理失败，请重试。");
      }
      setProgress(0);
    } finally {
      abortRef.current = null;
    }
  }

  function selectFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (file) void processFile(file);
    event.target.value = "";
  }

  function dropFile(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragActive(false);
    const file = event.dataTransfer.files?.[0];
    if (file) void processFile(file);
  }

  function cancelProcessing() {
    abortRef.current?.abort();
  }

  function resetSession() {
    abortRef.current?.abort();
    clearTimer();
    clearStudySession(window.localStorage);
    setSession(null);
    setLastFile(null);
    setQuestion("");
    setError(null);
    setProgress(0);
    setPhase("idle");
    setRestored(false);
    onToast("本机学习记录已清除");
  }

  async function askQuestion(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const cleanQuestion = question.trim();
    if (!session || !cleanQuestion || asking) return;
    setAsking(true);
    setError(null);
    const now = new Date().toISOString();
    const userMessage = { id: crypto.randomUUID(), role: "user" as const, content: cleanQuestion, createdAt: now };
    const pendingSession = { ...session, messages: [...session.messages, userMessage], updatedAt: now };
    persist(pendingSession);
    setQuestion("");

    try {
      const response = await fetch("/api/study/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: cleanQuestion, fileName: session.file.name, pages: session.pages }),
      });
      const payload = await response.json() as StudyQuestionResult & { error?: string };
      if (!response.ok) throw new Error(responseError(payload, "追问失败，请重试。"));
      const assistantMessage = {
        id: crypto.randomUUID(),
        role: "assistant" as const,
        content: payload.answer,
        citations: payload.citations,
        createdAt: new Date().toISOString(),
      };
      persist({ ...pendingSession, messages: [...pendingSession.messages, assistantMessage], updatedAt: assistantMessage.createdAt });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "追问失败，请重试。");
    } finally {
      setAsking(false);
    }
  }

  const busy = ["validating", "uploading", "parsing", "summarizing"].includes(phase);

  return <section className="study-file-workspace" aria-label="资料学习工作区">
    <header className="study-file-header">
      <div><span className="everywhere-kicker">P1 核心学习闭环</span><h2>用你的资料开始学习</h2><p>支持 PDF 与 UTF-8 TXT，单个文件不超过 10 MB。文件只发送到本机服务处理，不上传第三方。</p></div>
      <span className="demo-mode-badge">演示总结引擎</span>
    </header>

    {!session && <>
      <div
        className={`study-dropzone${dragActive ? " study-dropzone-active" : ""}`}
        onDragEnter={(event) => { event.preventDefault(); setDragActive(true); }}
        onDragOver={(event) => event.preventDefault()}
        onDragLeave={() => setDragActive(false)}
        onDrop={dropFile}
      >
        <input ref={inputRef} type="file" accept=".pdf,.txt,application/pdf,text/plain" onChange={selectFile} />
        <div className="study-upload-icon"><Upload size={22} /></div>
        <strong>{lastFile ? lastFile.name : "拖放学习资料到这里"}</strong>
        <span>PDF / TXT · 最大 10 MB</span>
        <button type="button" onClick={() => inputRef.current?.click()}>{lastFile ? "重新选择" : "选择文件"}</button>
      </div>

      {busy && <div className="study-progress-card" aria-live="polite">
        <div><LoaderCircle size={17} className="spin" /><strong>{phaseCopy[phase]}</strong><span>{progress}%</span></div>
        <div className="study-progress-track" role="progressbar" aria-label={phaseCopy[phase]} aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress}><i style={{ width: `${progress}%` }} /></div>
        <button type="button" onClick={cancelProcessing}><X size={14} />取消</button>
      </div>}

      {error && <div className="study-error" role="alert"><AlertCircle size={18} /><div><strong>{phaseCopy[phase]}</strong><span>{error}</span></div>{lastFile && <button type="button" onClick={() => void processFile(lastFile)}><RefreshCw size={14} />重试</button>}</div>}
    </>}

    {session && <div className="study-session">
      <div className="study-session-meta">
        <div className="study-file-icon"><FileText size={20} /></div>
        <div><strong>{session.file.name}</strong><span>{session.file.kind.toUpperCase()} · {formatBytes(session.file.size)} · {session.file.pageCount} {session.file.kind === "pdf" ? "页" : "份文本"}</span></div>
        <div className="study-session-actions">{restored && <span className="restored-badge"><Check size={13} />已从本机恢复</span>}<button type="button" onClick={() => inputRef.current?.click()}><RefreshCw size={14} />换一份</button><button type="button" onClick={resetSession}><Trash2 size={14} />清除</button></div>
        <input ref={inputRef} type="file" accept=".pdf,.txt,application/pdf,text/plain" onChange={selectFile} />
      </div>
      <div className="study-result-note"><Check size={15} /><span><strong>真实文件解析结果</strong> · {session.provider.label}。总结与回答尚未调用外部 AI。</span></div>
      {session.truncated && <div className="study-warning"><AlertCircle size={15} />资料文字较长，本次仅使用前 350,000 个字符。</div>}

      <div className="study-summary-grid">
        <article className="study-overview"><span><BookOpenCheck size={15} />资料摘要</span><p>{session.summary.overview}</p></article>
        <article><span>关键概念</span><ul>{session.summary.keyConcepts.map((concept) => <li key={concept}>{concept}</li>)}</ul></article>
        <article><span>复习问题</span><div className="review-question-list">{session.summary.reviewQuestions.map((item) => <button type="button" key={item} onClick={() => setQuestion(item)}>{item}</button>)}</div></article>
      </div>

      <div className="study-chat">
        <div className="study-chat-heading"><MessageSquareText size={17} /><div><strong>基于资料追问</strong><span>回答只引用已提取内容；找不到依据时会明确说明。</span></div></div>
        {session.messages.length > 0 && <div className="study-message-list">{session.messages.map((message) => <div className={`study-message study-message-${message.role}`} key={message.id}><span>{message.role === "user" ? "你" : "StudyPal"}</span><p>{message.content}</p>{message.citations && message.citations.length > 0 && <div className="study-citations">{message.citations.map((citation, index) => <details key={`${message.id}-${index}`}><summary>来源：{citation.label}</summary><blockquote>{citation.excerpt}</blockquote></details>)}</div>}</div>)}</div>}
        <form className="study-question-form" onSubmit={askQuestion}>
          <textarea value={question} onChange={(event) => setQuestion(event.target.value)} maxLength={500} rows={2} placeholder="例如：资料如何解释这个概念？" aria-label="基于资料追问" disabled={asking} />
          <button type="submit" disabled={!question.trim() || asking}>{asking ? <LoaderCircle size={15} className="spin" /> : <MessageSquareText size={15} />}{asking ? "查找资料中…" : "发送追问"}</button>
        </form>
        {error && <div className="study-error compact" role="alert"><AlertCircle size={16} /><span>{error}</span></div>}
      </div>
    </div>}
  </section>;
}
