"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { DashIcon } from "@/components/dashboard-icons";
import { conversationWindow, MAX_MESSAGE_CHARS, type ChatMessage } from "@/lib/chat";

const suggestions = [
  ["帮我写一篇文章", "根据你提供的品牌与产品资料起草内容"],
  ["帮我查内容收录", "了解检查方法，实际收录查询尚未接入"],
  ["带我快速上手", "用简单的话解释这里能做什么"],
];

interface AssistantCompany {
  id: string;
  name: string;
  projects: { id: string; name: string }[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function DashboardAssistant({ isOpen, companies, selectedCompanyId, onSelectCompany, onClose, onTutorial }: { isOpen: boolean; companies: AssistantCompany[]; selectedCompanyId?: string; onSelectCompany: (id: string) => void; onClose: () => void; onTutorial: () => void }) {
  const [draft, setDraft] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [model, setModel] = useState("");
  const [connection, setConnection] = useState("正在检查连接");
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const requestRef = useRef<AbortController | null>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const isLoading = pending !== null;
  const selectedCompany = companies.find((company) => company.id === selectedCompanyId) || null;
  const companyName = selectedCompany?.name;

  useEffect(() => {
    if (!selectedCompany?.projects.some((project) => project.id === selectedProjectId)) setSelectedProjectId("");
  }, [selectedCompany, selectedProjectId]);

  useEffect(() => {
    if (!isOpen) return;
    const controller = new AbortController();
    async function checkConnection() {
      try {
        const response = await fetch("/api/chat", { cache: "no-store", signal: controller.signal });
        const result: unknown = await response.json();
        if (!response.ok || !isRecord(result) || typeof result.model !== "string") throw new Error();
        setModel(result.model);
        setConnection("文本对话已接入");
      } catch { if (!controller.signal.aborted) setConnection("连接不可用，请检查配置"); }
    }
    void checkConnection();
    return () => controller.abort();
  }, [isOpen]);

  useEffect(() => () => requestRef.current?.abort(), []);

  useEffect(() => {
    const content = contentRef.current;
    if (isOpen && content) content.scrollTo({ top: content.scrollHeight });
  }, [messages, pending, error, isOpen]);

  async function send(text: string) {
    const content = text.trim();
    if (!content || requestRef.current) return;
    if (content.length > MAX_MESSAGE_CHARS) { setError(`每条消息最多 ${MAX_MESSAGE_CHARS} 个字符。`); return; }
    const userMessage: ChatMessage = { role: "user", content };
    const controller = new AbortController();
    requestRef.current = controller;
    setError("");
    setPending(content);
    setDraft("");
    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: conversationWindow([...messages, userMessage]) }),
        signal: controller.signal,
      });
      const result: unknown = await response.json();
      if (!response.ok) {
        const detail = isRecord(result) && isRecord(result.error) ? result.error.message : null;
        throw new Error(typeof detail === "string" ? detail : "请求失败，请稍后再试。");
      }
      if (!isRecord(result) || typeof result.reply !== "string" || !result.reply.trim()) throw new Error("没有收到有效回复，请重试。");
      const reply = result.reply;
      setMessages((items) => [...items, userMessage, { role: "assistant", content: reply }]);
      if (typeof result.model === "string") setModel(result.model);
      setConnection("文本对话已接入");
    } catch (failure) {
      setError(controller.signal.aborted ? "已停止生成。已发送的请求可能仍产生用量。" : failure instanceof Error ? failure.message : "网络连接失败，请稍后再试。");
      setDraft((current) => current || content);
    } finally {
      requestRef.current = null;
      setPending(null);
    }
  }

  if (!isOpen) return null;

  return (
    <aside className="geo-assistant" aria-label="GEO 助理">
      <header className="assistant-header">
        <DashIcon name="robot" className="text-[20px] text-(--ink-400)" />
        <Image src="/images/geo-agent-CtRbLfrG.png" alt="GEO" width={36} height={44} unoptimized />
        <div className="min-w-0 flex-1"><strong>GEO 助理</strong><p>{isLoading ? "MiniMax 正在生成回复…" : `${model || "MiniMax"} · ${connection}`}</p></div>
        <button aria-label="折叠" title="折叠" onClick={onClose} className="text-xl text-(--ink-400)">×</button>
      </header>
      <div className="assistant-scope">
        <div className="flex gap-2">
          <label className="assistant-scope-selector"><span>公司</span><select aria-label="助手公司" value={selectedCompanyId || ""} onChange={(event) => { onSelectCompany(event.target.value); setSelectedProjectId(""); setError(""); }}><option value="">请选择公司</option>{companies.map((company) => <option key={company.id} value={company.id}>{company.name}</option>)}</select><DashIcon name="chevronDown" /></label>
          <label className="assistant-scope-selector"><span>GEO项目</span><select aria-label="助手 GEO 项目" disabled={!selectedCompany} value={selectedProjectId} onChange={(event) => { setSelectedProjectId(event.target.value); setError(""); }}><option value="">{selectedCompany ? "请选择项目" : "请先选公司"}</option>{selectedCompany?.projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}</select><DashIcon name="chevronDown" /></label>
        </div>
        <p>{companyName ? "已关联本机选择，资料不会自动发送给模型" : "可根据你在对话中提供的品牌资料回答"}</p>
      </div>
      <div className="assistant-content" ref={contentRef} aria-live="polite" aria-busy={isLoading}>
        {messages.length === 0 && !isLoading ? <>
          <h2>这页有什么需要我帮忙？</h2>
          <p>可以聊内容策划、搜索问题和文章写作，由 MiniMax 为你回答。</p>
          <div className="assistant-suggestions">{suggestions.map(([title, subtitle], index) => <button key={title} onClick={() => index === 2 ? onTutorial() : void send(title)}><strong>{title}</strong><span>{subtitle}</span></button>)}</div>
          <p className="assistant-notice"><DashIcon name="info" />目前仅支持文本对话，不会查询真实收录、发布内容或操作账户。</p>
        </> : messages.map((message, index) => <p key={index} className={`assistant-message ${message.role === "user" ? "from-user" : ""}`}>{message.content}</p>)}
        {pending && <><p className="assistant-message from-user">{pending}</p><p className="assistant-loading" role="status"><DashIcon name="refresh" className="motion-safe:animate-spin" />MiniMax 正在思考，请稍候…</p></>}
        {error && <p className="assistant-error" role="alert">{error}</p>}
      </div>
      <form className="assistant-compose" onSubmit={(event) => { event.preventDefault(); void send(draft); }}>
        <textarea aria-label="告诉我你想完成什么" placeholder="告诉我你想完成什么..." maxLength={MAX_MESSAGE_CHARS} value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing && event.nativeEvent.keyCode !== 229) { event.preventDefault(); void send(draft); } }} />
        <div><button type="button" onClick={() => setDraft("请介绍当前页面的能力")}>／ 选择能力</button><span>Enter 发送 · Shift+Enter 换行</span>{isLoading ? <button type="button" onClick={() => requestRef.current?.abort()}>停止</button> : <button type="submit" disabled={!draft.trim()}><DashIcon name="send" />发送</button>}</div>
        <p className="mt-1 text-[10px] leading-[1.5] text-(--ink-400)">消息将发送至 MiniMax · 请勿输入密钥等敏感信息</p>
      </form>
    </aside>
  );
}
