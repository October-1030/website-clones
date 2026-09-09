"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { BookOpen, Copy, Download, LoaderCircle, Settings2, Sparkles, Square } from "lucide-react";
import { Modal } from "./Modal";
import { ContextPicker } from "./ContextPicker";
import { defaultOpening, formatWritingLength, type WritingLanguage } from "@/lib/golden-opening";
import { useLocalState } from "@/lib/use-local-state";
import { findAITool } from "@/lib/ai-tools";
import type { Book } from "@/types/workspace";

interface AIToolDialogProps {
  name: string;
  books: Book[];
  initialInput?: string;
  initialBookId?: string;
  onClose: () => void;
  onSave?: (bookId: string, text: string) => void;
  onUseResult?: (text: string) => void | boolean;
}

interface StreamItem { type: string; text?: string; error?: string; warning?: string }

export function AIToolDialog({ name, books, initialInput = "", initialBookId = "", onClose, onSave, onUseResult }: AIToolDialogProps) {
  const tool = findAITool(name);
  const [input, setInput] = useState(initialInput);
  const [extra, setExtra] = useState("");
  const [context, setContext] = useState("");
  const [bookId, setBookId] = useState(initialBookId);
  const [words, setWords] = useState(tool.defaultWords);
  const [language, setLanguage] = useLocalState<WritingLanguage>("xingyue-output-language", "zh");
  const [result, setResult] = useState("");
  const [view, setView] = useState<"form" | "result">("form");
  const [connection, setConnection] = useState("deepseek");
  const [model, setModel] = useState("deepseek-v4-flash");
  const [apiKey, setApiKey] = useState("");
  const [server, setServer] = useState<{ configured: boolean; model: string | null }>({ configured: false, model: null });
  const [settings, setSettings] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const controllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    let active = true;
    fetch("/api/golden-opening", { cache: "no-store" }).then(response => response.json()).then((status: { configured: boolean; model: string | null }) => {
      if (!active) return;
      setServer(status);
      if (status.configured) setConnection("server");
    }).catch(() => {});
    return () => { active = false; controllerRef.current?.abort(); };
  }, []);

  function stop() {
    controllerRef.current?.abort();
    controllerRef.current = null;
    setBusy(false);
    setMessage(result ? "已停止生成，已收到的内容已保留。" : "已停止生成。");
  }

  async function copy() {
    try { await navigator.clipboard.writeText(result); setMessage("结果已复制"); }
    catch { setError("复制失败，请选中文字后手动复制。"); }
  }

  function download() {
    const url = URL.createObjectURL(new Blob([result], { type: "text/plain;charset=utf-8" }));
    const link = document.createElement("a"); link.href = url; link.download = `${name}.txt`; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  async function generate(event: FormEvent) {
    event.preventDefault();
    if (!input.trim()) { setError(`请填写${tool.inputLabel}。`); return; }
    if ((connection === "deepseek" && !apiKey.trim()) || (connection === "server" && !server.configured)) {
      setError("请先在模型设置中填写 API Key，再开始生成。"); setSettings(true); return;
    }
    if (context.length > 6000) { setError("参考资料超过6000字符，请减少关联内容。"); return; }
    const controller = new AbortController(); controllerRef.current = controller;
    setBusy(true); setError(""); setMessage(""); setResult(""); setView("result");
    try {
      const response = await fetch("/api/golden-opening", {
        method: "POST", headers: { "Content-Type": "application/json" }, signal: controller.signal,
        body: JSON.stringify({ task: "tool", connection, ...(connection === "deepseek" ? { apiKey, model } : {}), input: {
          ...defaultOpening, title: name.slice(0,30), theme: input.trim().slice(0,500), extra: extra.trim().slice(0,1000), words, language,
          customPrompt: `${tool.instruction}\n\n用户素材：\n${input.trim()}${extra.trim() ? `\n\n补充要求：\n${extra.trim()}` : ""}`,
          useCustom: true, context,
        } }),
      });
      if (controllerRef.current !== controller) return;
      if (!response.ok) { const body = await response.json().catch(() => null) as { error?: string } | null; throw new Error(body?.error || "生成请求失败，请稍后重试。"); }
      if (!response.body) throw new Error("模型未返回内容，请重试。");
      const reader = response.body.getReader(); const decoder = new TextDecoder(); let pending = ""; let output = ""; let doneEvent = false;
      while (true) {
        const chunk = await reader.read(); pending += chunk.done ? decoder.decode() : decoder.decode(chunk.value, { stream: true });
        if (controllerRef.current !== controller) return;
        const lines = pending.split("\n"); pending = lines.pop() || "";
        for (const line of lines) {
          if (!line.trim()) continue;
          const item = JSON.parse(line) as StreamItem;
          if (item.type === "error") throw new Error(item.error || "生成中断，请重试。");
          if (item.type === "delta" && item.text) { output += item.text; setResult(output); }
          if (item.type === "done") { doneEvent = true; setMessage(item.warning || "生成完成，可以继续编辑、导出或保存到作品。"); }
        }
        if (chunk.done) break;
      }
      if (!doneEvent) throw new Error("连接中断，已保留收到的内容。");
    } catch (cause) {
      if (controllerRef.current === controller && !controller.signal.aborted) setError(cause instanceof Error ? cause.message : "生成失败，请重试。");
    } finally {
      if (controllerRef.current === controller) { controllerRef.current = null; setBusy(false); }
    }
  }

  return <Modal title={name} onClose={() => { stop(); onClose(); }} wide className="ai-tool-modal">
    <form className="ai-tool-layout" onSubmit={generate}>
      <div className="ai-tool-tabs"><button type="button" className={view === "form" ? "active" : ""} onClick={() => setView("form")}>创作设定</button><button type="button" className={view === "result" ? "active" : ""} disabled={!result && !busy} onClick={() => setView("result")}>生成结果</button><button type="button" className="ml-auto" onClick={() => { setSettings(!settings); setView("form"); }}><Settings2 size={14} />模型设置</button></div>
      {error && <p className="ai-error" role="alert">{error}</p>}
      {message && <p className="ai-message" role="status">{message}</p>}
      {view === "form" ? <div className="ai-tool-form">
        <p className="text-sm leading-7 text-muted">{tool.description}</p>
        {settings && <section className="ai-settings"><label>连接方式<select className="form-input" value={connection} onChange={event => setConnection(event.target.value)}><option value="deepseek">DeepSeek</option><option value="server" disabled={!server.configured}>{server.configured ? `服务器模型 · ${server.model}` : "服务器模型（未配置）"}</option></select></label>{connection === "deepseek" && <><label>AI 模型<select className="form-input" value={model} onChange={event => setModel(event.target.value)}><option value="deepseek-v4-flash">DeepSeek V4 Flash</option><option value="deepseek-v4-pro">DeepSeek V4 Pro</option></select></label><label>API Key<input className="form-input" type="password" autoComplete="off" maxLength={512} value={apiKey} onChange={event => setApiKey(event.target.value)} placeholder="填写你的 DeepSeek API Key" /></label><small>密钥只保留在本次打开期间，内容会发送到所选模型。</small></>}</section>}
        <label>{tool.inputLabel}<textarea autoFocus className="form-input ai-main-input" maxLength={24000} value={input} onChange={event => setInput(event.target.value)} placeholder={tool.inputHint} /></label>
        <label>补充要求<textarea className="form-input min-h-24" maxLength={2000} value={extra} onChange={event => setExtra(event.target.value)} placeholder="文风、视角、平台、格式、需要避免的内容……" /></label>
        <ContextPicker books={books} initialBookId={initialBookId} onApply={setContext} />
        <label>参考资料<textarea className="form-input min-h-24" value={context} onChange={event => setContext(event.target.value)} /><small>{context.length}/6000 字符</small></label>
        <label>输出语言<select className="form-input" value={language} disabled={busy} onChange={event => { try { setLanguage(event.target.value as WritingLanguage); } catch { setError("语言设置保存失败，请检查浏览器存储空间。"); } }}><option value="zh">中文</option><option value="en">English（英文）</option></select></label>
        <div className="ai-form-row"><label>目标长度<select className="form-input" value={words} onChange={event => setWords(Number(event.target.value))}>{[1000, 2000, 3000, 6000].map(value => <option key={value} value={value}>约 {formatWritingLength(value, language)}</option>)}</select></label>{onSave && <label>保存目标作品<select className="form-input" value={bookId} onChange={event => setBookId(event.target.value)}><option value="">暂不选择保存作品</option>{books.filter(book => book.status === "active").map(book => <option key={book.id} value={book.id}>{book.title}</option>)}</select></label>}</div>
      </div> : <div className="ai-result-view">{busy && <p className="flex items-center gap-2 text-primary"><LoaderCircle className="animate-spin" size={16} />正在生成……</p>}<textarea className="form-input ai-result" aria-label="生成结果" value={result} readOnly={busy} onChange={event => setResult(event.target.value)} placeholder="生成的内容会出现在这里" /><div className="flex flex-wrap gap-2"><button type="button" className="subtle-button" disabled={!result} onClick={copy}><Copy size={14} />复制</button><button type="button" className="subtle-button" disabled={!result} onClick={download}><Download size={14} />导出 TXT</button>{onUseResult && <button type="button" className="primary-button" disabled={!result || busy} onClick={() => { try { const applied = onUseResult(result); if (applied !== false) setMessage("结果已应用到当前内容。"); } catch (cause) { setError(cause instanceof Error ? cause.message : "结果应用失败，请检查生成格式。"); } }}><Sparkles size={14} />应用结果</button>}{bookId && onSave && <button type="button" className="subtle-button" disabled={!result || busy} onClick={() => { onSave(bookId, result); setMessage("已追加到所选作品的新章节。"); }}><BookOpen size={14} />保存到作品</button>}</div></div>}
      <footer className="ai-tool-footer"><span>{connection === "server" && server.configured ? server.model : apiKey ? model : "尚未配置模型"}</span>{busy ? <button type="button" className="subtle-button text-red-600" onClick={stop}><Square size={14} />停止生成</button> : <button type="submit" className="primary-button"><Sparkles size={15} />{result ? "重新生成" : "开始生成"}</button>}</footer>
    </form>
  </Modal>;
}
