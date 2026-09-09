"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { ArrowLeft, BookOpen, Copy, Download, LoaderCircle, Settings2, Sparkles, Square } from "lucide-react";
import { Modal } from "./Modal";
import { ContextPicker } from "./ContextPicker";
import { PromptPicker } from "./PromptPicker";
import { buildOpeningPrompt, countWritingUnits, defaultOpening, formatWritingLength, openingPresets, validateOpening, type OpeningInput, type WritingLanguage } from "@/lib/golden-opening";
import { useLocalState } from "@/lib/use-local-state";
import type { Book } from "@/types/workspace";

const fields = [
  { key: "theme", label: "选择主题", hint: "男频、女频、玄幻、都市、历史、悬疑、仙侠、言情……", required: true },
  { key: "setting", label: "选择背景", hint: "东方古代、西方古代、现代都市、赛博朋克……" },
  { key: "tags", label: "选择多个标签", hint: "脑洞、穿越、重生、系统、种田、无敌、架空……" },
  { key: "genre", label: "选择一个流派", hint: "升级流、苟道流、凡人流、幕后流、无敌流……" },
  { key: "ability", label: "选择一个金手指", hint: "主角的特殊能力、限制与代价，也可以不设置金手指" },
  { key: "protagonist", label: "主角人设与核心情节", hint: "主角是谁？想要什么？开篇会遇到怎样的困境？" },
] as const;

function cancelRequest(controller: AbortController | null, reader: ReadableStreamDefaultReader<Uint8Array> | null) {
  // Best-effort transport cleanup must not interrupt the form's state cleanup.
  try { controller?.abort(); } catch { /* Request is already aborted. */ }
  try { void reader?.cancel().catch(() => {}); } catch { /* Reader is already closed. */ }
}

export function GoldenOpeningDialog({ books, onClose, onSave }: {
  books: Book[]; onClose: () => void; onSave: (title: string, description: string, content: string) => void;
}) {
  const [draft, setDraft] = useLocalState<OpeningInput>("xingyue-opening-draft", defaultOpening);
  const [language, setLanguage] = useLocalState<WritingLanguage>("xingyue-output-language", "zh");
  const [savedResult, setSavedResult] = useLocalState("xingyue-opening-result", "");
  const [result, setResult] = useState(savedResult);
  const [view, setView] = useState<"form" | "result">("form");
  const [connection, setConnection] = useState("deepseek");
  const [model, setModel] = useState("deepseek-v4-flash");
  const [server, setServer] = useState<{ configured: boolean; model: string | null } | null>(null);
  const [apiKey, setApiKey] = useState("");
  const [showSettings, setShowSettings] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [promptOpen, setPromptOpen] = useState(false);
  const [presetDetail, setPresetDetail] = useState<string | null>(null);
  const controllerRef = useRef<AbortController | null>(null);
  const readerRef = useRef<ReadableStreamDefaultReader<Uint8Array> | null>(null);
  const keyRef = useRef<HTMLInputElement>(null);
  const mainRef = useRef<HTMLDivElement>(null);
  const lastResult = useRef(savedResult);

  useEffect(() => {
    let active = true;
    fetch("/api/golden-opening", { cache: "no-store" })
      .then(response => { if (!response.ok) throw new Error(); return response.json(); })
      .then((status: { configured: boolean; model: string | null }) => {
        if (!active) return;
        setServer(status);
        if (status.configured) setConnection("server");
      }).catch(() => { if (active) setServer({ configured: false, model: null }); });
    return () => { active = false; const controller = controllerRef.current; controllerRef.current = null; cancelRequest(controller, readerRef.current); };
  }, []);

  useEffect(() => { mainRef.current?.scrollTo({ top: 0 }); }, [error, view, showSettings]);

  function updateDraft(patch: Partial<OpeningInput>) {
    try { setDraft({ ...draft, ...patch }); }
    catch { setError("草稿保存失败，请检查浏览器本地存储空间。"); }
  }
  function persistResult(text: string) {
    lastResult.current = text;
    try { setSavedResult(text); }
    catch { setError("正文已生成，但本地存储空间不足。请先复制或导出正文。"); }
  }
  function close() {
    stop();
    persistResult(lastResult.current);
    onClose();
  }
  function stop() {
    const controller = controllerRef.current;
    if (!controller) return;
    // Release controls immediately, even if a browser extension delays stream
    // cancellation. A stopped request must not update a later generation.
    controllerRef.current = null;
    const reader = readerRef.current;
    readerRef.current = null;
    setBusy(false);
    persistResult(lastResult.current);
    setMessage(lastResult.current ? "已停止生成，已收到的正文已保留。" : "已停止生成。");
    cancelRequest(controller, reader);
  }
  async function copy(text: string, label: string) {
    try { await navigator.clipboard.writeText(text); setMessage(`${label}已复制`); }
    catch { setError("复制失败，请选中文字后手动复制。"); }
  }
  function download() {
    const url = URL.createObjectURL(new Blob([result], { type: "text/plain;charset=utf-8" }));
    const link = document.createElement("a"); link.href = url; link.download = `${draft.title.trim() || "黄金开篇"}.txt`; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  async function generate(event?: FormEvent) {
    event?.preventDefault();
    if (controllerRef.current) return;
    mainRef.current?.scrollTo({ top: 0 });
    setError(""); setMessage("");
    let input: OpeningInput;
    try { input = validateOpening({ ...draft, language }); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "请检查故事设定。"); setView("form"); return; }
    if ((connection === "deepseek" && !apiKey.trim()) || (connection === "server" && !server?.configured)) {
      setError("请先在模型设置中填写 API Key，再开始生成。");
      setShowSettings(true); setView("form");
      requestAnimationFrame(() => keyRef.current?.focus());
      return;
    }
    const controller = new AbortController();
    controllerRef.current = controller;
    setBusy(true); setView("result");
    let generated = "";
    let finished = false;
    try {
      const response = await fetch("/api/golden-opening", {
        method: "POST", headers: { "Content-Type": "application/json" }, signal: controller.signal,
        body: JSON.stringify({ input, connection, ...(connection === "deepseek" ? { apiKey, model } : {}) }),
      });
      if (controllerRef.current !== controller) return;
      if (!response.ok) {
        const failure = await response.json().catch(() => null) as { error?: string } | null;
        throw new Error(failure?.error || "生成请求失败，请稍后重试。");
      }
      if (!response.body) throw new Error("模型未返回正文，请重试。");
      const reader = response.body.getReader();
      readerRef.current = reader;
      const decoder = new TextDecoder();
      let pending = "";
      try {
        while (true) {
          const { value, done } = await reader.read();
          if (controllerRef.current !== controller) return;
          pending += done ? decoder.decode() : decoder.decode(value, { stream: true });
          const lines = pending.split("\n"); pending = lines.pop() || "";
          for (const line of lines) {
            if (!line.trim()) continue;
            const item = JSON.parse(line) as { type: string; text?: string; error?: string; warning?: string };
            if (item.type === "error") throw new Error(item.error || "生成中断，请重试。");
            if (item.type === "delta" && item.text) {
              generated += item.text; lastResult.current = generated; setResult(generated);
            }
            if (item.type === "done") { finished = true; setMessage(item.warning || "生成完成，可以修改正文后保存为作品。"); }
          }
          if (done) break;
        }
      } finally {
        // A browser extension may tee the response; cancellation can wait for its
        // other reader. Release our UI without waiting for that external reader.
        void reader.cancel().catch(() => {});
        reader.releaseLock();
        if (readerRef.current === reader) readerRef.current = null;
      }
      if (!finished) throw new Error("连接中断，已保留收到的正文。请重新生成。");
    } catch (cause) {
      if (controllerRef.current !== controller) return;
      if (controller.signal.aborted) setMessage(generated ? "已停止生成，已收到的正文已保留。" : "已停止生成。");
      else setError(cause instanceof Error ? cause.message : "生成失败，请检查网络后重试。");
    } finally {
      if (controllerRef.current === controller) {
        if (generated) persistResult(generated);
        setBusy(false); controllerRef.current = null;
      }
    }
  }
  function save() {
    if (!result.trim()) return;
    if (!draft.title.trim()) { setError("请为作品填写书名。"); return; }
    try { onSave(draft.title.trim(), draft.theme, result); }
    catch { setError("保存失败，请先复制或导出正文，再检查浏览器存储空间。"); }
  }

  return <Modal title="黄金开篇生成器" onClose={close} wide className="opening-modal">
    <form className="opening-layout" onSubmit={generate}>
      <aside className="opening-presets" aria-label="开篇方案">
        <div className="mb-3 flex items-center gap-2 text-xs text-muted"><Sparkles size={15} />内置写作方案</div>
        {openingPresets.map(preset => <div key={preset.id}><button type="button" disabled={busy} aria-pressed={!draft.useCustom && draft.preset === preset.id} className={`opening-preset ${!draft.useCustom && draft.preset === preset.id ? "active" : ""}`} onClick={() => { updateDraft({ preset: preset.id, useCustom: false, words: preset.id === "three" ? 6000 : 2000 }); setView("form"); }}><span>{preset.name}</span><small>{preset.description}</small></button><button type="button" className="mb-2 text-xs text-primary" onClick={() => setPresetDetail(presetDetail === preset.id ? null : preset.id)}>{presetDetail === preset.id ? "收起详情" : "详情"}</button>{presetDetail === preset.id && <p className="mb-3 text-xs leading-6 text-muted">{preset.instruction}</p>}</div>)}
        <p className="mt-auto pt-6 text-xs leading-6 text-muted">从一个困境开始，让人物用行动回应。<br />填写故事设定，让开篇更贴近你的想法。</p>
        <button type="button" className="subtle-button mt-3" onClick={() => { setShowSettings(!showSettings); setView("form"); }}><Settings2 size={14} />模型设置</button>
      </aside>
      <div ref={mainRef} className="opening-main">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex gap-2"><button type="button" className={`subtle-button ${view === "form" ? "bg-background text-primary" : ""}`} onClick={() => setView("form")}>故事设定</button><button type="button" className={`subtle-button ${view === "result" ? "bg-background text-primary" : ""}`} disabled={!result && !busy} onClick={() => setView("result")}>生成结果{result ? ` · ${formatWritingLength(countWritingUnits(result, language), language)}` : ""}</button></div>
          <button type="button" className="flex items-center gap-1 text-xs text-primary" onClick={() => { setShowSettings(!showSettings); setView("form"); }}><Settings2 size={13} />{connection === "server" && server?.configured ? server.model : apiKey ? model : "未配置模型"}</button>
        </div>
        {error && <p role="alert" className="mb-4 rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        {message && <p role="status" className="mb-4 rounded-lg bg-background p-3 text-sm text-primary">{message}</p>}
        <div hidden={view !== "form"}>
          {showSettings && <section aria-label="模型设置" className="mb-5 rounded-lg border border-border bg-background p-4">
            <div className="mb-3 flex items-center justify-between"><strong className="text-sm">模型设置</strong><button type="button" className="text-xs text-primary" onClick={() => setShowSettings(false)}>收起</button></div>
            <label className="opening-label">连接方式<select className="form-input" value={connection} disabled={busy} onChange={event => setConnection(event.target.value)}><option value="deepseek">DeepSeek</option><option value="server" disabled={!server?.configured}>{server?.configured ? `服务器模型 · ${server.model}` : "服务器模型（未配置）"}</option></select></label>
            {connection === "deepseek" && <><label className="opening-label mt-3">AI模型<select className="form-input" value={model} disabled={busy} onChange={event => setModel(event.target.value)}><option value="deepseek-v4-flash">DeepSeek V4 Flash</option><option value="deepseek-v4-pro">DeepSeek V4 Pro</option></select></label><label className="opening-label mt-3">API Key<input ref={keyRef} type="password" autoComplete="off" className="form-input" placeholder="填写你的 DeepSeek API Key" value={apiKey} disabled={busy} onChange={event => setApiKey(event.target.value)} maxLength={512} /></label><p className="mt-2 text-xs leading-6 text-muted">密钥仅在本次打开期间使用，关闭后清除。生成时将故事设定和所选参考资料发送至 DeepSeek，按你的 API 账户计费。<a href="https://platform.deepseek.com/api_keys" target="_blank" rel="noreferrer" className="ml-1 text-primary underline">获取密钥</a></p></>}
          </section>}
          <fieldset disabled={busy} className="min-w-0 space-y-5">
            <PromptPicker toolName="黄金开篇生成器" onApply={(content) => { updateDraft({ customPrompt: content, useCustom: true }); setMessage("已应用所选提示词，可在自定义区域修改。"); }} />
            <div className="opening-mobile-preset"><label className="opening-label">开篇方案<select className="form-input" value={draft.preset} onChange={event => updateDraft({ preset: event.target.value, useCustom: false, words: event.target.value === "three" ? 6000 : 2000 })}>{openingPresets.map(preset => <option key={preset.id} value={preset.id}>{preset.name}</option>)}</select></label></div>
            <div><span className="opening-label">提示词</span><div className="mb-2 flex gap-2" role="group" aria-label="提示词模式"><button type="button" className="subtle-button" aria-pressed={!draft.useCustom} onClick={() => updateDraft({ useCustom: false })}>快捷选项</button><button type="button" className="subtle-button" aria-pressed={draft.useCustom} onClick={() => updateDraft({ useCustom: true })}>自定义</button></div>{draft.useCustom ? <label className="opening-label">自定义提示词<textarea className="form-input min-h-28" maxLength={30000} value={draft.customPrompt} placeholder="输入开篇结构、叙事风格和其他写作要求……" onChange={event => updateDraft({ customPrompt: event.target.value })} /></label> : <p className="rounded border border-border px-3 py-2 text-sm">{openingPresets.find(preset => preset.id === draft.preset)?.name}<span className="ml-2 text-xs text-muted">内置方案，可预览完整提示词</span></p>}</div>
            <label className="opening-label">输出语言<select className="form-input" value={language} onChange={event => { try { setLanguage(event.target.value as WritingLanguage); } catch { setError("语言设置保存失败，请检查浏览器存储空间。"); } }}><option value="zh">中文</option><option value="en">English（英文）</option></select><span className="text-xs font-normal text-muted">故事设定可用中文或英文填写，正文按所选语言生成。</span></label>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2"><label className="opening-label">作品名称<input className="form-input" value={draft.title} maxLength={30} placeholder="可生成后再取名" onChange={event => updateDraft({ title: event.target.value })} /></label><label className="opening-label">{language === "en" ? "目标总词数" : "目标总字数"}<select className="form-input" value={draft.words} onChange={event => updateDraft({ words: Number(event.target.value) })}>{[1000, 2000, 3000, 6000].map(words => <option key={words} value={words}>约 {formatWritingLength(words, language)}</option>)}</select></label></div>
            {fields.map(field => <label className="opening-label" key={field.key}>{field.label}{"required" in field && <span className="text-red-500"> *</span>}<textarea className="form-input min-h-16 resize-y" aria-label={field.label} maxLength={500} value={draft[field.key]} placeholder={field.hint} onChange={event => updateDraft({ [field.key]: event.target.value })} /><span className="block text-right text-xs font-normal text-muted">{draft[field.key].length}/500</span></label>)}
            <label className="opening-label">补充信息<textarea className="form-input min-h-20" maxLength={1000} value={draft.extra} placeholder="视角、文风、开篇节奏、需要避免的情节……" onChange={event => updateDraft({ extra: event.target.value })} /><span className="block text-right text-xs font-normal text-muted">{draft.extra.length}/1000</span></label>
            <ContextPicker books={books} onApply={context => updateDraft({ context })} />
            <label className="opening-label">参考资料（可编辑）<textarea className="form-input min-h-24" maxLength={6000} value={draft.context} placeholder="可补充世界观、角色和前文信息" onChange={event => updateDraft({ context: event.target.value })} /><span className="block text-right text-xs font-normal text-muted">{draft.context.length}/6000 · 随本次生成发送</span></label>
          </fieldset>
          <button type="button" className="mt-4 text-xs text-primary underline" onClick={() => setPromptOpen(!promptOpen)}>{promptOpen ? "收起提示词预览" : "预览完整提示词"}</button>
          {promptOpen && <div className="mt-3"><textarea aria-label="完整提示词" className="form-input h-52 text-xs" readOnly value={buildOpeningPrompt({ ...draft, language })} /><button type="button" className="subtle-button mt-2" onClick={() => copy(buildOpeningPrompt({ ...draft, language }), "提示词")}><Copy size={14} />复制提示词</button></div>}
        </div>
        {view === "result" && <div className="flex min-h-full flex-col gap-3">
          {busy && <p role="status" className="flex items-center gap-2 text-sm text-primary"><LoaderCircle size={16} className="animate-spin" />正在生成，请稍候……{!lastResult.current && "首段文字即将显示"}</p>}
          {result ? <><textarea className="opening-result form-input" aria-label="生成的开篇正文" readOnly={busy} value={result} onChange={event => { setResult(event.target.value); persistResult(event.target.value); }} /><div className="flex flex-wrap gap-2"><button type="button" className="subtle-button" onClick={() => copy(result, "正文")}><Copy size={14} />复制正文</button><button type="button" className="subtle-button" onClick={download}><Download size={14} />导出 TXT</button></div><label className="opening-label">保存为新作品<input className="form-input" aria-label="保存作品名称" placeholder="请输入作品名称" value={draft.title} maxLength={30} disabled={busy} onChange={event => updateDraft({ title: event.target.value })} /></label><button type="button" className="primary-button self-start" disabled={busy || !result.trim()} onClick={save}><BookOpen size={16} />保存为作品并打开</button></> : <div className="flex min-h-64 flex-col items-center justify-center gap-3 text-muted"><Sparkles size={36} strokeWidth={1} /><p>{busy ? "正在构思你的故事开篇" : "生成的正文会出现在这里"}</p></div>}
        </div>}
      </div>
      <footer className="opening-footer"><span className="text-xs text-muted">{busy ? "可随时停止，已生成的内容会保留" : "AI 生成内容仅供参考，可编辑后保存"}</span><div className="flex gap-2">{view === "result" && <button type="button" className="subtle-button" onClick={() => setView("form")}><ArrowLeft size={14} />设定</button>}{busy ? <button key="stop" type="button" className="subtle-button text-red-600" onClick={event => { event.preventDefault(); stop(); }}><Square size={14} />停止生成</button> : <button key="generate" type="submit" className="primary-button"><Sparkles size={16} />{result ? "重新生成" : "生成"}</button>}</div></footer>
    </form>
  </Modal>;
}
