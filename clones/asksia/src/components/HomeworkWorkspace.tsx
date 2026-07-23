"use client";

import type { FormEvent } from "react";
import { useEffect, useRef, useState } from "react";
import { AlertCircle, BookOpenCheck, Check, Clipboard, Eraser, FlaskConical, LoaderCircle, RefreshCw, Send, Sparkles, Trash2 } from "lucide-react";
import { clearHomeworkSession, loadHomeworkSession, saveHomeworkSession } from "@/lib/homework/storage";
import { MAX_HOMEWORK_PROBLEM_CHARS, type HomeworkSession } from "@/lib/homework/types";

type RestoreSource = "local" | "server" | null;

const exampleProblem = "Evaluate the definite integral ∫₀¹ x·e^(x²) dx, then verify the result by differentiating an antiderivative.";

function responseError(payload: unknown, fallback: string): string {
  if (payload && typeof payload === "object" && "error" in payload && typeof payload.error === "string") return payload.error;
  return fallback;
}

function setSessionInUrl(id: string | null) {
  const url = new URL(window.location.href);
  if (id) {
    url.searchParams.set("homeworkSession", id);
    url.searchParams.delete("session");
  } else {
    url.searchParams.delete("homeworkSession");
  }
  window.history.replaceState(null, "", url);
}

export default function HomeworkWorkspace({ onToast }: { onToast: (message: string) => void }) {
  const abortRef = useRef<AbortController | null>(null);
  const [problem, setProblem] = useState("");
  const [session, setSession] = useState<HomeworkSession | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [restoreSource, setRestoreSource] = useState<RestoreSource>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let active = true;
    const stored = loadHomeworkSession(window.localStorage);
    if (stored) {
      setSession(stored);
      setProblem(stored.problem);
      setRestoreSource("local");
    }

    const urlId = new URLSearchParams(window.location.search).get("homeworkSession");
    const sessionId = urlId || stored?.id;
    if (sessionId) {
      void fetch(`/api/homework/session/${encodeURIComponent(sessionId)}`)
        .then(async (response) => {
          if (!response.ok) return null;
          const payload = await response.json() as { session?: HomeworkSession };
          return payload.session ?? null;
        })
        .then((serverSession) => {
          if (!active || !serverSession) return;
          setSession(serverSession);
          setProblem(serverSession.problem);
          setRestoreSource("server");
          saveHomeworkSession(window.localStorage, serverSession);
          setSessionInUrl(serverSession.id);
        })
        .catch(() => undefined);
    }

    return () => {
      active = false;
      abortRef.current?.abort();
    };
  }, []);

  function persist(next: HomeworkSession) {
    setSession(next);
    setProblem(next.problem);
    setSessionInUrl(next.id);
    try {
      saveHomeworkSession(window.localStorage, next);
    } catch {
      onToast("作业记录已由本机服务保存，但浏览器本地空间不足。");
    }
  }

  async function solve(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const cleanProblem = problem.trim();
    if (busy) return;
    if (cleanProblem.length < 3) {
      setError("请至少输入 3 个字符的完整题目。");
      return;
    }
    if (cleanProblem.length > MAX_HOMEWORK_PROBLEM_CHARS) {
      setError(`题目不能超过 ${MAX_HOMEWORK_PROBLEM_CHARS.toLocaleString()} 个字符。`);
      return;
    }

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setBusy(true);
    setError(null);
    setCopied(false);
    setRestoreSource(null);

    try {
      const response = await fetch("/api/homework/solve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ problem: cleanProblem }),
        signal: controller.signal,
      });
      const payload = await response.json() as { session?: HomeworkSession; error?: string };
      if (!response.ok || !payload.session) throw new Error(responseError(payload, "解题失败，请重试。"));
      persist(payload.session);
      onToast("分步解答和验算已保存");
    } catch (caught) {
      if (caught instanceof DOMException && caught.name === "AbortError") {
        setError("已停止本次解题。");
      } else {
        setError(caught instanceof Error ? caught.message : "解题失败，请重试。");
      }
    } finally {
      setBusy(false);
      abortRef.current = null;
    }
  }

  async function resetSession() {
    const sessionId = session?.id;
    abortRef.current?.abort();
    clearHomeworkSession(window.localStorage);
    setSessionInUrl(null);
    setSession(null);
    setProblem("");
    setError(null);
    setRestoreSource(null);
    setCopied(false);
    if (sessionId) {
      try {
        await fetch(`/api/homework/session/${encodeURIComponent(sessionId)}`, { method: "DELETE" });
      } catch {
        onToast("浏览器记录已清除，但本机服务记录暂时无法删除。");
        return;
      }
    }
    onToast("作业记录已清除");
  }

  async function copySolution() {
    if (!session) return;
    const text = [
      session.solution.problemRestatement,
      ...session.solution.steps.map((step, index) => `${index + 1}. ${step.title}\n${step.explanation}\n${step.expression}`),
      `最终答案：${session.solution.finalAnswer}`,
      `验算：${session.solution.verification}`,
    ].join("\n\n");
    await navigator.clipboard?.writeText(text);
    setCopied(true);
    onToast("解答已复制");
  }

  return <section className="study-file-workspace homework-workspace" aria-label="作业解题工作区">
    <header className="study-file-header">
      <div><span className="everywhere-kicker">P3 Homework Solver</span><h2>分步理解一道作业题</h2><p>输入完整题目，StudyPal 会给出方法、计算过程、最终答案和独立验算。请遵守课程的学术诚信要求。</p></div>
      <span className="demo-mode-badge">{session?.provider.mode === "live" ? "真实 AI 模式" : session ? "演示解题引擎" : "MiniMax M3 已连接"}</span>
    </header>

    <form className="homework-problem-form" onSubmit={solve}>
      <label htmlFor="homework-problem">作业题目</label>
      <textarea
        id="homework-problem"
        aria-label="作业题目"
        value={problem}
        onChange={(event) => setProblem(event.target.value)}
        rows={5}
        maxLength={MAX_HOMEWORK_PROBLEM_CHARS}
        disabled={busy}
        placeholder="粘贴数学、物理、化学或其他课程题目。请包含所有已知条件和单位。"
      />
      <div className="homework-form-footer">
        <span>{problem.length}/{MAX_HOMEWORK_PROBLEM_CHARS}</span>
        <button type="button" className="homework-secondary-button" onClick={() => { setProblem(exampleProblem); setError(null); }} disabled={busy}><FlaskConical size={14} />填入测试题</button>
        {busy && <button type="button" className="homework-secondary-button" onClick={() => abortRef.current?.abort()}><Eraser size={14} />停止</button>}
        <button type="submit" className="homework-solve-button" disabled={busy || problem.trim().length < 3}>{busy ? <LoaderCircle size={15} className="spin" /> : <Send size={15} />}{busy ? "M3 正在分步解题…" : "开始解题"}</button>
      </div>
    </form>

    {error && <div className="study-error" role="alert"><AlertCircle size={18} /><div><strong>暂时无法完成</strong><span>{error}</span></div>{problem.trim().length >= 3 && !busy && <button type="button" onClick={(event) => void solve(event as unknown as FormEvent<HTMLFormElement>)}><RefreshCw size={14} />重试</button>}</div>}

    {session && <div className="homework-result">
      <div className="study-session-meta">
        <div className="study-file-icon"><BookOpenCheck size={20} /></div>
        <div><strong>{session.solution.subject || "Homework"}</strong><span>{session.provider.label} · {new Date(session.updatedAt).toLocaleString()}</span></div>
        <div className="study-session-actions">{restoreSource && <span className="restored-badge"><Check size={13} />{restoreSource === "server" ? "已从本机服务恢复" : "已从浏览器恢复"}</span>}<button type="button" onClick={() => void copySolution()}><Clipboard size={14} />{copied ? "已复制" : "复制"}</button><button type="button" onClick={() => void resetSession()}><Trash2 size={14} />清除</button></div>
      </div>
      <div className="study-result-note homework-provider"><Check size={15} /><span><strong>真实解题结果</strong> · {session.provider.label}。答案已按“方法 → 步骤 → 验算”保存到本机。</span></div>

      <article className="homework-problem-card"><span>题意整理</span><p>{session.solution.problemRestatement}</p></article>
      <div className="homework-context-grid">
        <article><span>已知条件</span>{session.solution.knowns.length ? <ul>{session.solution.knowns.map((item) => <li key={item}>{item}</li>)}</ul> : <p>题目未给出额外已知量。</p>}</article>
        <article><span>解题方法</span><p>{session.solution.method}</p></article>
      </div>
      <div className="homework-steps" aria-label="解题步骤">
        <div className="homework-section-heading"><Sparkles size={16} /><div><strong>分步过程</strong><span>每一步都保留理由和计算式</span></div></div>
        <ol>{session.solution.steps.map((step, index) => <li key={`${step.title}-${index}`}><span>{index + 1}</span><div><h3>{step.title}</h3><p>{step.explanation}</p>{step.expression && <pre>{step.expression}</pre>}</div></li>)}</ol>
      </div>
      <div className="homework-answer-grid">
        <article className="homework-final-answer"><span>最终答案</span><p>{session.solution.finalAnswer}</p></article>
        <article className="homework-verification"><span>独立验算</span><p>{session.solution.verification}</p></article>
      </div>
      {session.solution.assumptions.length > 0 && <div className="study-warning"><AlertCircle size={15} /><span><strong>假设与限制：</strong>{session.solution.assumptions.join("；")}</span></div>}
    </div>}
  </section>;
}
