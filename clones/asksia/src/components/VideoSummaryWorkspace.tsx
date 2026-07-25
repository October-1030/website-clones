"use client";

import { notifyUsageChanged } from "@/lib/usage/client";

import type { FormEvent } from "react";
import { useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  Check,
  Clipboard,
  ExternalLink,
  Film,
  FlaskConical,
  LoaderCircle,
  MessageSquareText,
  RefreshCw,
  Send,
  Trash2,
} from "lucide-react";
import { clearVideoSession, loadVideoSession, saveVideoSession } from "@/lib/video/storage";
import {
  MAX_MEDIA_URL_CHARS,
  MAX_VIDEO_QUESTION_CHARS,
  type VideoSession,
} from "@/lib/video/types";

type BusyPhase = "summarizing" | "asking" | null;
type RestoreSource = "local" | "server" | null;

const exampleUrl = "https://www.youtube.com/watch?v=aircAruvnKk";

function responseError(payload: unknown, fallback: string): string {
  if (payload && typeof payload === "object" && "error" in payload && typeof payload.error === "string") return payload.error;
  return fallback;
}

function setSessionInUrl(id: string | null) {
  const url = new URL(window.location.href);
  if (id) {
    url.searchParams.set("videoSession", id);
    url.searchParams.delete("homeworkSession");
    url.searchParams.delete("session");
  } else {
    url.searchParams.delete("videoSession");
  }
  window.history.replaceState(null, "", url);
}

function durationLabel(seconds: number | null): string {
  if (!seconds) return "时长未知";
  const totalMinutes = Math.floor(seconds / 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return hours > 0 ? `${hours} 小时 ${minutes} 分钟` : `${minutes} 分钟`;
}

export default function VideoSummaryWorkspace({ onToast }: { onToast: (message: string) => void }) {
  const abortRef = useRef<AbortController | null>(null);
  const [url, setUrl] = useState("");
  const [question, setQuestion] = useState("");
  const [session, setSession] = useState<VideoSession | null>(null);
  const [busy, setBusy] = useState<BusyPhase>(null);
  const [error, setError] = useState<string | null>(null);
  const [restoreSource, setRestoreSource] = useState<RestoreSource>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let active = true;
    const stored = loadVideoSession(window.localStorage);
    if (stored) {
      setSession(stored);
      setUrl(stored.source.canonicalUrl);
      setRestoreSource("local");
    }
    const urlId = new URLSearchParams(window.location.search).get("videoSession");
    const sessionId = urlId || stored?.id;
    if (sessionId) {
      void fetch(`/api/video/session/${encodeURIComponent(sessionId)}`)
        .then(async (response) => {
          if (!response.ok) return null;
          const payload = await response.json() as { session?: VideoSession };
          return payload.session ?? null;
        })
        .then((serverSession) => {
          if (!active || !serverSession) return;
          setSession(serverSession);
          setUrl(serverSession.source.canonicalUrl);
          setRestoreSource("server");
          saveVideoSession(window.localStorage, serverSession);
          setSessionInUrl(serverSession.id);
        })
        .catch(() => undefined);
    }
    return () => {
      active = false;
      abortRef.current?.abort();
    };
  }, []);

  function persist(next: VideoSession) {
    setSession(next);
    setUrl(next.source.canonicalUrl);
    setSessionInUrl(next.id);
    try {
      saveVideoSession(window.localStorage, next);
    } catch {
      onToast("记录已保存在本机服务，但浏览器本地空间不足。");
    }
  }

  async function summarize(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const cleanUrl = url.trim();
    if (busy) return;
    if (!cleanUrl || cleanUrl.length > MAX_MEDIA_URL_CHARS) {
      setError("请输入完整且长度合理的 HTTPS 视频或播客链接。");
      return;
    }
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setBusy("summarizing");
    setError(null);
    setRestoreSource(null);
    setCopied(false);
    try {
      const response = await fetch("/api/video/summarize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: cleanUrl }),
        signal: controller.signal,
      });
      const payload = await response.json() as { session?: VideoSession; error?: string };
      if (!response.ok || !payload.session) throw new Error(responseError(payload, "视频总结失败，请重试。"));
      persist(payload.session);
      notifyUsageChanged();
      onToast("字幕总结和时间戳来源已保存");
    } catch (caught) {
      if (caught instanceof DOMException && caught.name === "AbortError") setError("已停止本次视频读取。");
      else setError(caught instanceof Error ? caught.message : "视频总结失败，请重试。");
    } finally {
      setBusy(null);
      abortRef.current = null;
    }
  }

  async function ask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const cleanQuestion = question.trim();
    if (!session || busy || cleanQuestion.length < 2 || cleanQuestion.length > MAX_VIDEO_QUESTION_CHARS) return;
    const controller = new AbortController();
    abortRef.current = controller;
    setBusy("asking");
    setError(null);
    try {
      const response = await fetch("/api/video/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: session.id, question: cleanQuestion }),
        signal: controller.signal,
      });
      const payload = await response.json() as { session?: VideoSession; error?: string };
      if (!response.ok || !payload.session) throw new Error(responseError(payload, "无法回答该问题，请重试。"));
      persist(payload.session);
      notifyUsageChanged();
      setQuestion("");
    } catch (caught) {
      if (caught instanceof DOMException && caught.name === "AbortError") setError("已停止本次追问。");
      else setError(caught instanceof Error ? caught.message : "无法回答该问题，请重试。");
    } finally {
      setBusy(null);
      abortRef.current = null;
    }
  }

  async function resetSession() {
    const sessionId = session?.id;
    abortRef.current?.abort();
    clearVideoSession(window.localStorage);
    setSessionInUrl(null);
    setSession(null);
    setUrl("");
    setQuestion("");
    setError(null);
    setRestoreSource(null);
    setCopied(false);
    if (sessionId) {
      try {
        await fetch(`/api/video/session/${encodeURIComponent(sessionId)}`, { method: "DELETE" });
      } catch {
        onToast("浏览器记录已清除，但本机服务记录暂时无法删除。");
        return;
      }
    }
    onToast("视频学习记录已清除");
  }

  async function copySummary() {
    if (!session) return;
    const text = [
      session.source.title,
      session.summary.overview,
      "关键概念",
      ...session.summary.keyConcepts.map((item) => `- ${item}`),
      "复习问题",
      ...session.summary.reviewQuestions.map((item) => `- ${item}`),
    ].join("\n\n");
    await navigator.clipboard?.writeText(text);
    setCopied(true);
    onToast("视频总结已复制");
  }

  return <section className="study-file-workspace video-summary-workspace" aria-label="视频链接总结工作区">
    <header className="study-file-header">
      <div>
        <span className="everywhere-kicker">P4 Video Link Summary</span>
        <h2>把一段视频变成可追问的学习资料</h2>
        <p>读取公开字幕后再调用 MiniMax M3。没有字幕时会明确停止，不会拿标题或简介冒充完整内容。</p>
      </div>
      <span className="demo-mode-badge">{session?.provider.mode === "live" ? "真实 AI 模式" : session ? "演示总结引擎" : "MiniMax M3 已连接"}</span>
    </header>

    <form className="video-url-form" onSubmit={summarize}>
      <label htmlFor="video-url">视频或播客链接</label>
      <div className="video-url-input">
        <input
          id="video-url"
          type="url"
          aria-label="视频或播客链接"
          placeholder="https://www.youtube.com/watch?v=..."
          value={url}
          onChange={(event) => setUrl(event.target.value)}
          maxLength={MAX_MEDIA_URL_CHARS}
          disabled={Boolean(busy)}
        />
        <button type="submit" className="video-summary-button" disabled={Boolean(busy) || !url.trim()}>
          {busy === "summarizing" ? <LoaderCircle size={15} className="spin" /> : <Film size={15} />}
          {busy === "summarizing" ? "读取字幕并总结…" : "生成学习总结"}
        </button>
      </div>
      <div className="video-form-help">
        <span>支持 YouTube 公开字幕，以及含结构化 transcript 的白名单播客页面。</span>
        <button type="button" onClick={() => { setUrl(exampleUrl); setError(null); }} disabled={Boolean(busy)}>
          <FlaskConical size={13} />填入示例链接
        </button>
        {busy === "summarizing" && <button type="button" onClick={() => abortRef.current?.abort()}>停止</button>}
      </div>
    </form>

    {error && <div className="study-error" role="alert">
      <AlertCircle size={18} />
      <div><strong>暂时无法完成</strong><span>{error}</span></div>
      {url.trim() && !busy && <button type="button" onClick={(event) => void summarize(event as unknown as FormEvent<HTMLFormElement>)}><RefreshCw size={14} />重试</button>}
    </div>}

    {session && <div className="video-summary-result">
      <div className="study-session-meta">
        <div className="study-file-icon"><Film size={20} /></div>
        <div>
          <strong>{session.source.title}</strong>
          <span>{session.source.author || "公开字幕"} · {durationLabel(session.source.durationSeconds)} · {session.provider.label}</span>
        </div>
        <div className="study-session-actions">
          {restoreSource && <span className="restored-badge"><Check size={13} />{restoreSource === "server" ? "已从本机服务恢复" : "已从浏览器恢复"}</span>}
          <a href={session.source.canonicalUrl} target="_blank" rel="noreferrer"><ExternalLink size={14} />原始页面</a>
          <button type="button" onClick={() => void copySummary()}><Clipboard size={14} />{copied ? "已复制" : "复制"}</button>
          <button type="button" onClick={() => void resetSession()}><Trash2 size={14} />清除</button>
        </div>
      </div>
      <div className="study-result-note"><Check size={15} /><span><strong>字幕驱动总结</strong> · 已读取 {session.source.segmentCount} 个字幕片段，引用会显示时间范围或 transcript 段落。</span></div>
      {session.truncated && <div className="study-warning"><AlertCircle size={15} />字幕过长，本次只使用前 {session.source.transcriptCharacters.toLocaleString()} 个字符。</div>}

      <div className="study-summary-grid">
        <article className="study-overview"><span>内容摘要</span><p>{session.summary.overview}</p></article>
        <article><span>关键概念</span><ul>{session.summary.keyConcepts.map((item) => <li key={item}>{item}</li>)}</ul></article>
        <article><span>复习问题</span><div className="review-question-list">{session.summary.reviewQuestions.map((item) => <button type="button" key={item} onClick={() => setQuestion(item)}>{item}</button>)}</div></article>
      </div>

      <section className="video-question-section" aria-label="基于字幕追问">
        <div className="homework-section-heading"><MessageSquareText size={16} /><div><strong>基于字幕继续追问</strong><span>答案只使用已提取字幕，并附上时间范围或 transcript 片段。</span></div></div>
        {session.messages.length > 0 && <div className="study-message-list">{session.messages.map((message) => <div className={`study-message study-message-${message.role}`} key={message.id}><span>{message.role === "user" ? "你" : "StudyPal"}</span><p>{message.content}</p>{message.citations && message.citations.length > 0 && <div className="study-citations">{message.citations.map((citation, index) => <details key={`${message.id}-${index}`}><summary>来源：{citation.label}</summary><blockquote>{citation.excerpt}</blockquote></details>)}</div>}</div>)}</div>}
        <form className="study-question-form" onSubmit={ask}>
          <textarea
            aria-label="基于字幕提问"
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            maxLength={MAX_VIDEO_QUESTION_CHARS}
            rows={2}
            placeholder="例如：视频如何解释神经网络中的权重和偏置？"
            disabled={Boolean(busy)}
          />
          <button type="submit" disabled={Boolean(busy) || question.trim().length < 2}>
            {busy === "asking" ? <LoaderCircle size={14} className="spin" /> : <Send size={14} />}
            {busy === "asking" ? "M3 正在查找字幕…" : "发送"}
          </button>
        </form>
      </section>
    </div>}
  </section>;
}
