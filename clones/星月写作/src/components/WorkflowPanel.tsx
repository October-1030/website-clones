"use client";

import {
  ArrowLeft,
  BookOpen,
  Check,
  Clock3,
  Copy,
  Download,
  Edit3,
  ExternalLink,
  FileText,
  Heart,
  History,
  LoaderCircle,
  Play,
  Plus,
  RotateCcw,
  Save,
  Search,
  Settings2,
  Sparkles,
  Square,
  Star,
  Trash2,
  Users,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import { Modal } from "./Modal";
import { ContextPicker } from "./ContextPicker";
import { useLocalState } from "@/lib/use-local-state";
import { countWritingUnits, formatWritingLength, type WritingLanguage } from "@/lib/golden-opening";
import type { Book } from "@/types/workspace";
import { appendWorkflowChapters, appendWorkflowOutput } from "@/lib/workflow-save";
import { buildWorkflowRoundPrompt } from "@/lib/workflow-rounds";
import "./workflow-panel.css";

type WorkflowTab = "最热" | "最新" | "精选" | "我的工作流" | "我的收藏";
type WorkflowVisibility = "public" | "private";

interface WorkflowDefinition {
  id: string;
  name: string;
  description: string;
  category: string;
  systemInstruction: string;
  userTemplate: string;
  outputLength: 1000 | 2000 | 3000 | 6000;
  visibility: WorkflowVisibility;
  createdAt: string;
  uses: number;
  rating: number;
  featured: boolean;
  custom: boolean;
}

interface WorkflowHistoryEntry {
  id: string;
  workflowId: string;
  workflowName: string;
  input: string;
  output: string;
  error: string;
  timestamp: string;
  bookId: string;
  chapterId: string;
  language?: WritingLanguage;
  context?: string;
  rounds?: string[];
  roundCount?: number;
}

interface WorkflowDraft {
  name: string;
  description: string;
  category: string;
  systemInstruction: string;
  userTemplate: string;
  outputLength: 1000 | 2000 | 3000 | 6000;
  visibility: WorkflowVisibility;
}

interface WorkflowPanelProps {
  onBack?: () => void;
  books?: Book[];
}

const emptyBooks: Book[] = [];
const emptyWorkflows: WorkflowDefinition[] = [];
const emptyFavorites: string[] = [];
const emptyHistory: WorkflowHistoryEntry[] = [];
const tabs: WorkflowTab[] = ["最热", "最新", "精选", "我的工作流", "我的收藏"];
const categories = ["长篇创作", "短篇创作", "章节优化", "设定管理", "通用写作"];

const publicWorkflows: WorkflowDefinition[] = [
  {
    id: "public-opening-plan",
    name: "黄金前三章规划",
    description: "从人物目标、首次困境和阶段回报三个层次，整理可直接写作的前三章推进方案。",
    category: "长篇创作",
    systemInstruction: "你是一位擅长中文类型小说结构的编辑。请给出具体、连贯、可执行的前三章规划，每章包含目标、冲突、转折和章末悬念。",
    userTemplate: "请依据下面的故事设定规划黄金前三章：\n{{input}}",
    outputLength: 2000,
    visibility: "public",
    createdAt: "2026-08-21T10:00:00.000Z",
    uses: 28640,
    rating: 4.82,
    featured: true,
    custom: false,
  },
  {
    id: "public-suspense-check",
    name: "悬念升级检查",
    description: "检查现有章节中的线索、信息差和风险递进，给出不破坏原设定的增强建议。",
    category: "章节优化",
    systemInstruction: "你是一位悬疑小说编辑。分析文本中的已知信息、隐藏信息、线索回收和风险升级，只基于文本给出修改方案，不虚构作者没有提供的事实。",
    userTemplate: "检查以下章节的悬念设计，并按问题、原因、修改示例输出：\n{{input}}",
    outputLength: 2000,
    visibility: "public",
    createdAt: "2026-08-28T09:30:00.000Z",
    uses: 19780,
    rating: 4.74,
    featured: true,
    custom: false,
  },
  {
    id: "public-dialogue-polish",
    name: "人物对话自然化",
    description: "保留剧情信息与人物立场，减少解释式台词，让对话更像人物在具体情境中的真实交流。",
    category: "章节优化",
    systemInstruction: "你是一位中文小说文字编辑。保持人物目的、事实和情节顺序不变，通过停顿、动作、言外之意和措辞差异改善对话。只输出修改后的文本和极简修改说明。",
    userTemplate: "请自然化下面的小说对话：\n{{input}}",
    outputLength: 1000,
    visibility: "public",
    createdAt: "2026-08-30T16:20:00.000Z",
    uses: 15320,
    rating: 4.67,
    featured: true,
    custom: false,
  },
  {
    id: "public-chapter-summary",
    name: "章节摘要提炼",
    description: "提炼章节事件、角色状态变化、未回收伏笔和下一章必须承接的信息。",
    category: "通用写作",
    systemInstruction: "你是一位小说资料编辑。忠实总结用户提供的正文，不补写情节。分别列出事件链、角色变化、设定信息、伏笔和待承接事项。",
    userTemplate: "为以下章节生成结构化摘要：\n{{input}}",
    outputLength: 1000,
    visibility: "public",
    createdAt: "2026-08-26T12:00:00.000Z",
    uses: 12690,
    rating: 4.61,
    featured: false,
    custom: false,
  },
  {
    id: "public-world-check",
    name: "世界观一致性核对",
    description: "从时间、地点、能力边界、组织关系和资源规则中寻找冲突，并给出最小改动方案。",
    category: "设定管理",
    systemInstruction: "你是一位小说设定审校员。逐条核对材料中的规则与事实，指出有文本证据的冲突、模糊处和潜在风险，并提供尽量少改动原文的修复方案。",
    userTemplate: "核对以下世界观与正文信息的一致性：\n{{input}}",
    outputLength: 2000,
    visibility: "public",
    createdAt: "2026-08-24T08:00:00.000Z",
    uses: 9840,
    rating: 4.58,
    featured: true,
    custom: false,
  },
  {
    id: "public-short-outline",
    name: "短篇故事大纲",
    description: "将一个核心想法扩展为人物欲望、关键选择、转折和结局闭环清晰的短篇大纲。",
    category: "短篇创作",
    systemInstruction: "你是一位中文短篇小说策划。围绕单一核心矛盾设计紧凑故事，确保人物选择推动情节，转折有前置依据，结局回应开篇问题。",
    userTemplate: "把下面的想法扩展为可写作的短篇大纲：\n{{input}}",
    outputLength: 2000,
    visibility: "public",
    createdAt: "2026-08-31T07:30:00.000Z",
    uses: 7540,
    rating: 4.51,
    featured: false,
    custom: false,
  },
];

const blankDraft: WorkflowDraft = {
  name: "",
  description: "",
  category: categories[0],
  systemInstruction: "",
  userTemplate: "请根据以下内容完成任务：\n{{input}}",
  outputLength: 2000,
  visibility: "private",
};

function sanitizeFilename(value: string): string {
  return value.replace(/[\\/:*?"<>|]/g, "-").trim().slice(0, 60) || "工作流结果";
}

function downloadText(filename: string, content: string): void {
  const url = URL.createObjectURL(new Blob([content], { type: "text/plain;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = `${sanitizeFilename(filename)}.txt`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function applyTemplate(template: string, input: string): string {
  return template.replace(/{{\s*input\s*}}/g, input);
}

function formatTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "未知时间";
  return new Intl.DateTimeFormat("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).format(date);
}

function cancelRequest(controller: AbortController | null, reader: ReadableStreamDefaultReader<Uint8Array> | null): void {
  try { controller?.abort(); } catch { /* The request may already be closed. */ }
  try { void reader?.cancel().catch(() => {}); } catch { /* The stream may already be released. */ }
}

function BuilderModal({ workflow, onClose, onSave }: {
  workflow: WorkflowDefinition | null;
  onClose: () => void;
  onSave: (draft: WorkflowDraft) => void;
}): ReactNode {
  const [draft, setDraft] = useState<WorkflowDraft>(() => workflow ? {
    name: workflow.name,
    description: workflow.description,
    category: workflow.category,
    systemInstruction: workflow.systemInstruction,
    userTemplate: workflow.userTemplate,
    outputLength: workflow.outputLength,
    visibility: workflow.visibility,
  } : blankDraft);
  const [previewInput, setPreviewInput] = useState("一名守夜人在封闭车站发现了不属于任何乘客的行李。 ");
  const [preview, setPreview] = useState("");
  const [error, setError] = useState("");

  function submit(event: FormEvent): void {
    event.preventDefault();
    const name = draft.name.trim();
    const description = draft.description.trim();
    const systemInstruction = draft.systemInstruction.trim();
    const userTemplate = draft.userTemplate.trim();
    if (!name) { setError("请填写工作流名称。"); return; }
    if (!description) { setError("请填写工作流说明。"); return; }
    if (!systemInstruction) { setError("请填写系统指令。"); return; }
    if (!userTemplate) { setError("请填写用户输入模板。"); return; }
    if (!userTemplate.includes("{{input}}")) { setError("用户输入模板必须包含 {{input}} 变量。"); return; }
    onSave({ ...draft, name, description, systemInstruction, userTemplate });
  }

  function showPreview(): void {
    if (!draft.userTemplate.includes("{{input}}")) { setError("模板中缺少 {{input}} 变量。"); setPreview(""); return; }
    setError("");
    setPreview(applyTemplate(draft.userTemplate, previewInput.trim() || "这里会代入运行时输入"));
  }

  return <Modal title={workflow ? "编辑工作流" : "创建工作流"} onClose={onClose} wide className="workflow-builder-modal">
    <form className="workflow-builder" onSubmit={submit}>
      {error && <p className="workflow-alert error" role="alert">{error}</p>}
      <div className="workflow-builder-grid">
        <section className="workflow-builder-fields" aria-label="工作流配置">
          <label>工作流名称<span aria-hidden="true"> *</span><input autoFocus className="form-input" maxLength={60} value={draft.name} onChange={event => setDraft({ ...draft, name: event.target.value })} placeholder="例如：章节悬念检查" /></label>
          <label>工作流说明<span aria-hidden="true"> *</span><textarea className="form-input" maxLength={300} value={draft.description} onChange={event => setDraft({ ...draft, description: event.target.value })} placeholder="说明这个工作流适合解决什么问题" /><small>{draft.description.length}/300</small></label>
          <div className="workflow-builder-row">
            <label>分类<select className="form-input" value={draft.category} onChange={event => setDraft({ ...draft, category: event.target.value })}>{categories.map(category => <option key={category}>{category}</option>)}</select></label>
            <label>输出长度<select className="form-input" value={draft.outputLength} onChange={event => setDraft({ ...draft, outputLength: Number(event.target.value) as WorkflowDraft["outputLength"] })}><option value={1000}>约 1000 字</option><option value={2000}>约 2000 字</option><option value={3000}>约 3000 字</option><option value={6000}>约 6000 字</option></select></label>
          </div>
          <label>系统指令<span aria-hidden="true"> *</span><textarea className="form-input workflow-instruction" maxLength={3000} value={draft.systemInstruction} onChange={event => setDraft({ ...draft, systemInstruction: event.target.value })} placeholder="描述 AI 的角色、任务边界和输出要求" /><small>{draft.systemInstruction.length}/3000</small></label>
          <label>用户输入模板<span aria-hidden="true"> *</span><textarea className="form-input workflow-template" maxLength={3000} value={draft.userTemplate} onChange={event => setDraft({ ...draft, userTemplate: event.target.value })} placeholder="使用 {{input}} 表示用户运行时填写的内容" /><small>{draft.userTemplate.length}/3000</small></label>
          <fieldset className="workflow-visibility">
            <legend>可见范围</legend>
            <label><input type="radio" name="visibility" checked={draft.visibility === "private"} onChange={() => setDraft({ ...draft, visibility: "private" })} />仅自己可见</label>
            <label><input type="radio" name="visibility" checked={draft.visibility === "public"} onChange={() => setDraft({ ...draft, visibility: "public" })} />本地列表展示</label>
          </fieldset>
        </section>
        <aside className="workflow-preview" aria-label="模板预览">
          <div><Sparkles size={18} /><strong>模板预览</strong></div>
          <p><code>{"{{input}}"}</code> 会在运行时替换为用户输入。预览只做本地替换，不会调用模型或消耗额度。</p>
          <label>示例输入<textarea className="form-input" value={previewInput} onChange={event => setPreviewInput(event.target.value)} maxLength={1000} /></label>
          <button type="button" className="subtle-button" onClick={showPreview}><Play size={14} />生成本地预览</button>
          <div className="workflow-preview-result" aria-live="polite">{preview || "点击“生成本地预览”查看替换结果。"}</div>
        </aside>
      </div>
      <footer className="workflow-modal-footer"><button type="button" className="subtle-button" onClick={onClose}>取消</button><button type="submit" className="primary-button"><Save size={15} />{workflow ? "保存修改" : "创建工作流"}</button></footer>
    </form>
  </Modal>;
}

function RunnerModal({ workflow, books, initialInput, initialOutput, initialEntry, onClose, onHistory }: {
  workflow: WorkflowDefinition;
  books: Book[];
  initialInput?: string;
  initialOutput?: string;
  initialEntry?: WorkflowHistoryEntry;
  onClose: () => void;
  onHistory: (entry: WorkflowHistoryEntry) => void;
}): ReactNode {
  const activeBooks = books.filter(book => book.status === "active");
  const [input, setInput] = useState(initialInput || "");
  const [context, setContext] = useState(initialEntry?.context || "");
  const [roundCount, setRoundCount] = useState(initialEntry?.roundCount || 1);
  const [completedRounds, setCompletedRounds] = useState<string[]>(initialEntry?.rounds || []);
  const [savedRounds, setSavedRounds] = useState(0);
  const latestRounds = useRef(initialEntry?.rounds || []);
  const [language, setLanguage] = useLocalState<WritingLanguage>("xingyue-output-language", "zh");
  const [output, setOutput] = useState(initialOutput || "");
  const [bookId, setBookId] = useState(initialEntry?.bookId || activeBooks[0]?.id || "");
  const selectedBook = activeBooks.find(book => book.id === bookId);
  const [chapterId, setChapterId] = useState(initialEntry?.chapterId || "");
  const [server, setServer] = useState<{ configured: boolean; model: string | null } | null>(null);
  const [connection, setConnection] = useState<"server" | "deepseek">("deepseek");
  const [model, setModel] = useState<"deepseek-v4-flash" | "deepseek-v4-pro">("deepseek-v4-flash");
  const [apiKey, setApiKey] = useState("");
  const [showSettings, setShowSettings] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const controllerRef = useRef<AbortController | null>(null);
  const readerRef = useRef<ReadableStreamDefaultReader<Uint8Array> | null>(null);
  const latestOutput = useRef(initialOutput || "");
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    let active = true;
    fetch("/api/golden-opening", { cache: "no-store" })
      .then(response => { if (!response.ok) throw new Error(); return response.json(); })
      .then((status: { configured: boolean; model: string | null }) => {
        if (!active) return;
        setServer(status);
        if (status.configured) setConnection("server");
      })
      .catch(() => { if (active) setServer({ configured: false, model: null }); });
    return () => {
      active = false;
      const controller = controllerRef.current;
      controllerRef.current = null;
      cancelRequest(controller, readerRef.current);
    };
  }, []);

  function addHistory(result: { output?: string; error?: string }): void {
    onHistory({
      id: crypto.randomUUID(),
      workflowId: workflow.id,
      workflowName: workflow.name,
      input,
      output: result.output || "",
      error: result.error || "",
      timestamp: new Date().toISOString(),
      bookId,
      chapterId,
      language,
      context,
      rounds: [...latestRounds.current],
      roundCount,
    });
  }

  function stop(): void {
    const controller = controllerRef.current;
    if (!controller) return;
    controllerRef.current = null;
    const reader = readerRef.current;
    readerRef.current = null;
    setBusy(false);
    const partial = latestOutput.current;
    setMessage(partial ? "已停止生成，收到的内容已保留。" : "已停止生成。");
    addHistory(partial ? { output: partial, error: "用户停止生成" } : { error: "用户停止生成" });
    cancelRequest(controller, reader);
  }

  async function run(event?: FormEvent, resume = false): Promise<void> {
    event?.preventDefault();
    if (controllerRef.current) return;
    const cleanInput = input.trim();
    if (!cleanInput) { setError("请填写运行输入。"); inputRef.current?.focus(); return; }
    if (connection === "deepseek" && !apiKey.trim()) { setError("请先在模型设置中填写 DeepSeek API Key。"); setShowSettings(true); return; }
    if (connection === "server" && !server?.configured) { setError("服务器尚未配置模型，请改用 DeepSeek 并填写 API Key。"); setShowSettings(true); return; }

    const controller = new AbortController();
    controllerRef.current = controller;
    const completed: string[] = resume ? [...latestRounds.current] : [];
    let generated = completed.join("\n\n");
    latestOutput.current = generated;
    setOutput(generated);
    setError("");
    setMessage("");
    setBusy(true);
    setCompletedRounds(completed);
    if (!resume) setSavedRounds(0);
    latestRounds.current = completed;
    const bookContext = context;
    const substituted = applyTemplate(workflow.userTemplate, cleanInput);
    const basePrompt = `${workflow.systemInstruction}\n\n请严格执行以下工作流输入模板：\n${substituted}\n\n只输出任务结果，不要复述指令。`;

    try {
      for (let round = completed.length + 1; round <= roundCount; round++) {
      if (controllerRef.current !== controller) return;
      const customPrompt = buildWorkflowRoundPrompt(basePrompt, completed.at(-1) || "", round, roundCount);
      let finished = false;
      let roundOutput = "";
      if (round > 1) generated += "\n\n";
      setMessage(`正在运行第${round}/${roundCount}轮，已完成${completed.length}轮。`);
      const response = await fetch("/api/golden-opening", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          task: "tool",
          connection,
          ...(connection === "deepseek" ? { apiKey, model } : {}),
          input: {
            title: workflow.name.slice(0, 30),
            theme: workflow.category.slice(0, 500),
            setting: "",
            tags: "工作流",
            genre: "",
            ability: "",
            protagonist: cleanInput.slice(0, 500),
            extra: `按工作流要求输出，目标长度约 ${formatWritingLength(workflow.outputLength, language)}。`,
            preset: "first",
            customPrompt,
            useCustom: true,
            words: workflow.outputLength,
            language,
            context: bookContext,
          },
        }),
      });
      if (controllerRef.current !== controller) return;
      if (!response.ok) {
        const failure = await response.json().catch(() => null) as { error?: string } | null;
        throw new Error(failure?.error || "运行失败，请稍后重试。");
      }
      if (!response.body) throw new Error("模型没有返回内容，请重试。");
      const reader = response.body.getReader();
      readerRef.current = reader;
      const decoder = new TextDecoder();
      let pending = "";
      try {
        while (true) {
          const { value, done } = await reader.read();
          if (controllerRef.current !== controller) return;
          pending += done ? decoder.decode() : decoder.decode(value, { stream: true });
          const lines = pending.split("\n");
          pending = lines.pop() || "";
          for (const line of lines) {
            if (!line.trim()) continue;
            const item = JSON.parse(line) as { type: string; text?: string; error?: string; warning?: string };
            if (item.type === "error") throw new Error(item.error || "生成中断，请重试。");
            if (item.type === "delta" && item.text) {
              roundOutput += item.text;
              generated += item.text;
              latestOutput.current = generated;
              setOutput(generated);
            }
            if (item.type === "done") {
              finished = true;
              if (item.warning) setMessage(item.warning);
            }
          }
          if (done) break;
        }
      } finally {
        void reader.cancel().catch(() => {});
        reader.releaseLock();
        if (readerRef.current === reader) readerRef.current = null;
      }
      if (!finished) throw new Error("连接中断，已保留收到的内容，请重新运行。");
      if (!roundOutput.trim()) throw new Error("本轮未返回有效内容，后续轮次已停止。");
      completed.push(roundOutput);
      latestRounds.current = [...completed];
      setCompletedRounds([...completed]);
      }
      setMessage(`工作流已完成，共${completed.length}轮。`);
      addHistory({ output: generated });
    } catch (cause) {
      if (controllerRef.current !== controller) return;
      const reason = cause instanceof Error ? cause.message : "运行失败，请检查网络后重试。";
      if (!controller.signal.aborted) {
        setError(reason);
        addHistory({ output: generated, error: reason });
      }
    } finally {
      if (controllerRef.current === controller) {
        controllerRef.current = null;
        setBusy(false);
      }
    }
  }

  async function copyOutput(): Promise<void> {
    try { await navigator.clipboard.writeText(output); setMessage("结果已复制。"); }
    catch { setError("复制失败，请选中文字后手动复制。"); }
  }

  function saveRounds(): void {
    try {
      const raw = window.localStorage.getItem("xingyue-books");
      const current: Book[] = raw ? JSON.parse(raw) : books;
      if (!Array.isArray(current) || !current.some(book => book.id === bookId && book.status === "active")) throw new Error("保存目标作品已不存在或已归档，请重新选择。");
      const remaining = completedRounds.slice(savedRounds);
      const updated = current.map(book => book.id === bookId ? appendWorkflowChapters(book, remaining) : book);
      window.localStorage.setItem("xingyue-books",JSON.stringify(updated));
      window.dispatchEvent(new Event("xingyue-local-change"));
      setMessage(`已将${remaining.length}轮结果分别保存为新章节。`);
      setSavedRounds(completedRounds.length);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "章节保存失败，请先下载结果。"); }
  }

  function saveToBook(): void {
    if (!output.trim()) { setError("当前没有可保存的结果。"); return; }
    if (!bookId) { setError("请选择要保存的作品。"); return; }
    try {
      const raw = window.localStorage.getItem("xingyue-books");
      const stored: unknown = raw ? JSON.parse(raw) : books;
      if (!Array.isArray(stored)) throw new Error();
      let found = false;
      const updated = stored.map(item => {
        if (!item || typeof item !== "object") return item;
        const book = item as Book;
        if (book.id !== bookId) return book;
        found = true;
          return appendWorkflowOutput(book, output, chapterId);
      });
      if (!found) throw new Error();
      window.localStorage.setItem("xingyue-books", JSON.stringify(updated));
      window.dispatchEvent(new Event("xingyue-local-change"));
      setMessage(chapterId ? "结果已追加到所选章节。" : "结果已追加到作品末章（无章节时创建第1章）。");
    } catch (cause) {
      setError(cause instanceof Error && cause.message === "所选章节已不存在，请重新选择章节后保存。" ? cause.message : "保存到作品失败，请先复制或下载结果。");
    }
  }

  return <Modal title={workflow.name} onClose={() => { stop(); onClose(); }} wide className="workflow-runner-modal">
    <form className="workflow-runner" onSubmit={run}>
      <div className="workflow-runner-heading"><div><span>{workflow.category}</span><p>{workflow.description}</p></div><button type="button" className="subtle-button" aria-expanded={showSettings} onClick={() => setShowSettings(!showSettings)}><Settings2 size={14} />模型设置</button></div>
      {error && <p className="workflow-alert error" role="alert">{error}</p>}
      {message && <p className="workflow-alert success" role="status"><Check size={15} />{message}</p>}
      {showSettings && <section className="workflow-model-settings" aria-label="模型设置">
        <label>连接方式<select className="form-input" value={connection} disabled={busy} onChange={event => setConnection(event.target.value as "server" | "deepseek")}><option value="deepseek">DeepSeek API Key</option><option value="server" disabled={!server?.configured}>{server?.configured ? `服务器模型 · ${server.model}` : "服务器模型（未配置）"}</option></select></label>
        {connection === "deepseek" && <><label>模型<select className="form-input" value={model} disabled={busy} onChange={event => setModel(event.target.value as typeof model)}><option value="deepseek-v4-flash">DeepSeek V4 Flash</option><option value="deepseek-v4-pro">DeepSeek V4 Pro</option></select></label><label>API Key<input className="form-input" type="password" autoComplete="off" maxLength={512} value={apiKey} disabled={busy} onChange={event => setApiKey(event.target.value)} placeholder="填写你的 DeepSeek API Key" /></label><p>密钥只保留在当前窗口状态中，运行工作流时发送到固定的 DeepSeek 接口。</p></>}
      </section>}
      <label className="workflow-run-input">输出语言<select className="form-input" value={language} disabled={busy} onChange={event => { try { setLanguage(event.target.value as WritingLanguage); } catch { setError("语言设置保存失败，请检查浏览器存储空间。"); } }}><option value="zh">中文</option><option value="en">English（英文）</option></select></label>
      <label className="workflow-run-input">循环次数<select className="form-input" value={roundCount} disabled={busy} onChange={event => setRoundCount(Number(event.target.value))}>{Array.from({length:10},(_,index) => <option key={index} value={index + 1}>{index + 1} 轮</option>)}</select><small>每轮承接上一轮结果，单轮目标长度不变；运行会调用模型{roundCount}次。停止后保留已收到内容。</small></label>
      <div className="workflow-context-row">
        <label>保存目标作品<select className="form-input" value={bookId} disabled={busy} onChange={event => { setBookId(event.target.value); setChapterId(""); }}><option value="">不保存到作品</option>{activeBooks.map(book => <option key={book.id} value={book.id}>{book.title}</option>)}</select></label>
        <label>保存目标章节<select className="form-input" value={chapterId} disabled={busy || !selectedBook?.chapters?.length} onChange={event => setChapterId(event.target.value)}><option value="">不指定章节（追加到末章）</option>{selectedBook?.chapters?.map(chapter => <option key={chapter.id} value={chapter.id}>{chapter.title}</option>)}</select></label>
      </div>
      <fieldset disabled={busy}><ContextPicker books={books} onApply={setContext} /><label className="workflow-run-input">参考资料<textarea className="form-input" maxLength={6000} value={context} onChange={event => setContext(event.target.value)} /><small>{context.length}/6000 字符 · 仅发送这里的资料</small></label></fieldset>
      <label className="workflow-run-input">运行输入<textarea ref={inputRef} className="form-input" maxLength={6000} disabled={busy} value={input} onChange={event => setInput(event.target.value)} placeholder="填写故事设定、章节正文或需要处理的问题……" /><small>{input.length}/6000</small></label>
      <div className="workflow-result-heading"><strong>运行结果</strong><span>{busy && <LoaderCircle size={13} className="animate-spin" />}{output ? formatWritingLength(countWritingUnits(output, language), language) : busy ? "正在流式生成" : "结果将流式显示"}</span></div>
      <textarea className="form-input workflow-run-output" aria-label="工作流运行结果" value={output} readOnly={busy} onChange={event => { setOutput(event.target.value); latestOutput.current = event.target.value; }} placeholder={busy ? "正在生成……" : "运行后，结果会显示在这里。"} />
      <div className="workflow-result-actions">
        <button type="button" className="subtle-button" disabled={!output} onClick={copyOutput}><Copy size={14} />复制</button>
        <button type="button" className="subtle-button" disabled={!output} onClick={() => downloadText(`${workflow.name}-${formatTime(new Date().toISOString())}`, output)}><Download size={14} />下载</button>
        <button type="button" className="subtle-button" disabled={!output || !bookId || busy} onClick={saveToBook}><BookOpen size={14} />保存到作品</button>
        {roundCount > 1 && completedRounds.length > savedRounds && <button type="button" className="primary-button" disabled={!bookId || busy} onClick={saveRounds}>将完成的{completedRounds.length - savedRounds}轮分别保存为新章节</button>}
        {!busy && completedRounds.length > 0 && completedRounds.length < roundCount && <button type="button" className="subtle-button" onClick={() => run(undefined,true)}>从第{completedRounds.length + 1}轮继续</button>}
      </div>
      <footer className="workflow-modal-footer"><span>{busy ? "可随时停止，已生成内容会保留" : `目标输出约 ${formatWritingLength(workflow.outputLength, language)}`}</span><div>{busy ? <button type="button" className="subtle-button danger" onClick={stop}><Square size={14} />停止</button> : <button type="submit" className="primary-button"><Sparkles size={15} />{output ? "重试" : "运行工作流"}</button>}</div></footer>
    </form>
  </Modal>;
}

function HistoryModal({ entries, workflows, onClose, onReopen, onDelete, onClear }: {
  entries: WorkflowHistoryEntry[];
  workflows: WorkflowDefinition[];
  onClose: () => void;
  onReopen: (workflow: WorkflowDefinition, entry: WorkflowHistoryEntry) => void;
  onDelete: (id: string) => void;
  onClear: () => void;
}): ReactNode {
  const [query, setQuery] = useState("");
  const [message, setMessage] = useState("");
  const filtered = entries.filter(entry => `${entry.workflowName} ${entry.input} ${entry.output} ${entry.error}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));

  async function copyEntry(entry: WorkflowHistoryEntry): Promise<void> {
    try { await navigator.clipboard.writeText(entry.output || entry.error); setMessage("记录内容已复制。"); }
    catch { setMessage("复制失败，请打开记录后手动复制。"); }
  }

  return <Modal title="工作流历史记录" onClose={onClose} wide className="workflow-history-modal">
    <div className="workflow-history-toolbar"><label><Search size={15} /><input value={query} onChange={event => setQuery(event.target.value)} placeholder="搜索工作流、输入或结果" aria-label="搜索历史记录" /></label><button type="button" className="subtle-button danger" disabled={!entries.length} onClick={() => { if (window.confirm("确定清空全部工作流历史记录吗？")) onClear(); }}><Trash2 size={14} />清空</button></div>
    {message && <p className="workflow-alert success" role="status">{message}</p>}
    <div className="workflow-history-list">
      {filtered.map(entry => {
        const workflow = workflows.find(item => item.id === entry.workflowId);
        return <article className="workflow-history-item" key={entry.id}>
          <div className="workflow-history-main"><div><strong>{entry.workflowName}</strong><time dateTime={entry.timestamp}><Clock3 size={13} />{formatTime(entry.timestamp)}</time></div><p>{entry.input || "未保存输入"}</p><small className={entry.error ? "error" : ""}>{entry.error || `${formatWritingLength(countWritingUnits(entry.output, entry.language), entry.language)} 结果`}</small></div>
          <div className="workflow-history-actions">
            <button type="button" className="icon-button" aria-label={`重新打开 ${entry.workflowName}`} disabled={!workflow} onClick={() => workflow && onReopen(workflow, entry)}><RotateCcw size={15} /></button>
            <button type="button" className="icon-button" aria-label={`复制 ${entry.workflowName} 记录`} onClick={() => copyEntry(entry)}><Copy size={15} /></button>
            <button type="button" className="icon-button" aria-label={`下载 ${entry.workflowName} 记录`} onClick={() => downloadText(`${entry.workflowName}-历史记录`, entry.output || entry.error)}><Download size={15} /></button>
            <button type="button" className="icon-button danger" aria-label={`删除 ${entry.workflowName} 记录`} onClick={() => onDelete(entry.id)}><Trash2 size={15} /></button>
          </div>
        </article>;
      })}
      {!filtered.length && <div className="workflow-empty"><History size={36} strokeWidth={1.3} /><strong>{entries.length ? "没有匹配的历史记录" : "还没有运行记录"}</strong><p>运行工作流后，可在这里重新打开、复制和下载结果。</p></div>}
    </div>
  </Modal>;
}

export function WorkflowPanel({ onBack, books = emptyBooks }: WorkflowPanelProps): ReactNode {
  const [storedWorkflows, setStoredWorkflows] = useLocalState<WorkflowDefinition[]>("xingyue-workflows", emptyWorkflows);
  const [storedFavorites, setStoredFavorites] = useLocalState<string[]>("xingyue-workflow-favorites", emptyFavorites);
  const [storedHistory, setStoredHistory] = useLocalState<WorkflowHistoryEntry[]>("xingyue-workflow-history", emptyHistory);
  const customWorkflows = Array.isArray(storedWorkflows) ? storedWorkflows : emptyWorkflows;
  const favorites = Array.isArray(storedFavorites) ? storedFavorites : emptyFavorites;
  const history = Array.isArray(storedHistory) ? storedHistory : emptyHistory;
  const allWorkflows = useMemo(() => [...customWorkflows, ...publicWorkflows].map(workflow => ({ ...workflow, uses: history.filter(entry => entry.workflowId === workflow.id).length, rating: 0 })), [customWorkflows, history]);
  const [tab, setTab] = useState<WorkflowTab>("最热");
  const [query, setQuery] = useState("");
  const [builder, setBuilder] = useState<{ mode: "create" | "edit"; workflow: WorkflowDefinition | null } | null>(null);
  const [runner, setRunner] = useState<{ workflow: WorkflowDefinition; input?: string; output?: string; entry?: WorkflowHistoryEntry } | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [notice, setNotice] = useState("");
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => { if (noticeTimer.current) clearTimeout(noticeTimer.current); }, []);

  function notify(text: string): void {
    setNotice(text);
    if (noticeTimer.current) clearTimeout(noticeTimer.current);
    noticeTimer.current = setTimeout(() => setNotice(""), 2600);
  }

  const visibleWorkflows = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase();
    let items = allWorkflows.filter(workflow => !needle || `${workflow.name} ${workflow.description} ${workflow.category}`.toLocaleLowerCase().includes(needle));
    if (tab === "我的工作流") items = items.filter(workflow => workflow.custom);
    if (tab === "我的收藏") items = items.filter(workflow => favorites.includes(workflow.id));
    if (tab === "精选") items = items.filter(workflow => workflow.featured);
    return [...items].sort((a, b) => tab === "最新" || tab === "我的工作流" ? Date.parse(b.createdAt) - Date.parse(a.createdAt) : b.uses - a.uses);
  }, [allWorkflows, favorites, query, tab]);

  function toggleFavorite(id: string): void {
    try {
      setStoredFavorites(favorites.includes(id) ? favorites.filter(item => item !== id) : [...favorites, id]);
    } catch { notify("收藏保存失败，请检查浏览器存储空间。"); }
  }

  function saveWorkflow(draft: WorkflowDraft): void {
    try {
      if (builder?.mode === "edit" && builder.workflow) {
        setStoredWorkflows(customWorkflows.map(item => item.id === builder.workflow?.id ? { ...item, ...draft } : item));
        notify("工作流已更新");
      } else {
        setStoredWorkflows([{ id: crypto.randomUUID(), ...draft, createdAt: new Date().toISOString(), uses: 0, rating: 0, featured: false, custom: true }, ...customWorkflows]);
        setTab("我的工作流");
        notify("工作流已创建");
      }
      setBuilder(null);
    } catch { notify("工作流保存失败，请检查浏览器存储空间。"); }
  }

  function cloneWorkflow(workflow: WorkflowDefinition): void {
    try {
      const clone: WorkflowDefinition = { ...workflow, id: crypto.randomUUID(), name: `${workflow.name} - 副本`.slice(0, 60), visibility: "private", createdAt: new Date().toISOString(), uses: 0, rating: 0, featured: false, custom: true };
      setStoredWorkflows([clone, ...customWorkflows]);
      setTab("我的工作流");
      notify("工作流副本已创建");
    } catch { notify("复制失败，请检查浏览器存储空间。"); }
  }

  function deleteWorkflow(workflow: WorkflowDefinition): void {
    if (!workflow.custom || !window.confirm(`确定删除“${workflow.name}”吗？此操作不会删除历史记录。`)) return;
    try {
      setStoredWorkflows(customWorkflows.filter(item => item.id !== workflow.id));
      setStoredFavorites(favorites.filter(id => id !== workflow.id));
      notify("工作流已删除");
    } catch { notify("删除失败，请检查浏览器存储空间。"); }
  }

  function addHistory(entry: WorkflowHistoryEntry): void {
    try { setStoredHistory([entry, ...history].slice(0, 100)); }
    catch { notify("结果已生成，但历史记录保存失败。"); }
  }

  function reopenHistory(workflow: WorkflowDefinition, entry: WorkflowHistoryEntry): void {
    setShowHistory(false);
    setRunner({ workflow, input: entry.input, output: entry.output, entry });
  }

  return <section className="workflow-panel" aria-labelledby="workflow-title">
    <header className="workflow-page-header">
      <div className="workflow-page-title">{onBack && <button type="button" className="icon-button" aria-label="返回" onClick={onBack}><ArrowLeft size={19} /></button>}<h1 id="workflow-title">工作流</h1><a href="https://www.bilibili.com/video/BV1V3FNznEzj/" target="_blank" rel="noreferrer">教程<ExternalLink size={13} /></a></div>
      <div className="workflow-page-actions"><button type="button" className="subtle-button" onClick={() => setShowHistory(true)}><History size={15} />历史记录{history.length ? <span>{history.length}</span> : null}</button><button type="button" className="primary-button" onClick={() => setBuilder({ mode: "create", workflow: null })}><Plus size={16} />创建工作流</button></div>
    </header>
    <form className="workflow-search" onSubmit={event => { event.preventDefault(); const cleanQuery = query.trim(); setQuery(cleanQuery); notify(cleanQuery ? `已显示 ${visibleWorkflows.length} 个匹配工作流` : "已显示全部工作流"); }} role="search"><Search size={18} /><input value={query} onChange={event => setQuery(event.target.value)} placeholder="搜索工作流..." aria-label="搜索工作流" /><button type="submit">搜索</button></form>
    <div className="workflow-tabs" role="tablist" aria-label="工作流排序和筛选">{tabs.map(item => <button type="button" role="tab" aria-selected={tab === item} className={tab === item ? "active" : ""} key={item} onClick={() => setTab(item)}>{item}</button>)}</div>
    <div className="workflow-grid" aria-live="polite">
      {visibleWorkflows.map(workflow => {
        const favorite = favorites.includes(workflow.id);
        return <article className="workflow-card" key={workflow.id}>
          <div className="workflow-card-meta"><span><Star size={14} fill="currentColor" />{workflow.custom ? "自建" : "内置"}</span><span><Users size={14} />{workflow.uses.toLocaleString("zh-CN")}次本地运行</span><button type="button" className={favorite ? "favorite active" : "favorite"} aria-label={favorite ? `取消收藏 ${workflow.name}` : `收藏 ${workflow.name}`} aria-pressed={favorite} onClick={() => toggleFavorite(workflow.id)}><Heart size={17} fill={favorite ? "currentColor" : "none"} /></button></div>
          <div className="workflow-card-body"><span className="workflow-category">{workflow.category}</span><h2>{workflow.name}</h2><p>{workflow.description}</p></div>
          <footer className="workflow-card-footer"><div className="workflow-creator"><span aria-hidden="true">{workflow.custom ? "我" : "星"}</span><div><strong>{workflow.custom ? "我的工作流" : "内置工作流"}</strong><small>{workflow.visibility === "private" ? "仅自己可见" : "本地列表"}</small></div></div><button type="button" className="workflow-run-button" onClick={() => setRunner({ workflow })}><Play size={14} fill="currentColor" />运行</button></footer>
          <div className="workflow-card-tools">
            {workflow.custom && <button type="button" aria-label={`编辑 ${workflow.name}`} onClick={() => setBuilder({ mode: "edit", workflow })}><Edit3 size={14} />编辑</button>}
            <button type="button" aria-label={`复制 ${workflow.name}`} onClick={() => cloneWorkflow(workflow)}><Copy size={14} />复制</button>
            {workflow.custom && <button type="button" className="danger" aria-label={`删除 ${workflow.name}`} onClick={() => deleteWorkflow(workflow)}><Trash2 size={14} />删除</button>}
          </div>
        </article>;
      })}
      {!visibleWorkflows.length && <div className="workflow-empty workflow-grid-empty"><FileText size={44} strokeWidth={1.2} /><strong>{tab === "我的收藏" ? "还没有收藏工作流" : tab === "我的工作流" ? "还没有创建工作流" : "没有找到匹配的工作流"}</strong><p>{tab === "我的工作流" ? "创建自己的指令模板，之后可以反复运行。" : "调整搜索词或切换上方分类。"}</p>{tab === "我的工作流" && <button type="button" className="primary-button" onClick={() => setBuilder({ mode: "create", workflow: null })}><Plus size={15} />创建工作流</button>}</div>}
    </div>
    {notice && <div className="workflow-toast" role="status"><Check size={16} />{notice}</div>}
    {builder && <BuilderModal workflow={builder.workflow} onClose={() => setBuilder(null)} onSave={saveWorkflow} />}
    {runner && <RunnerModal key={`${runner.workflow.id}-${runner.input || "new"}`} workflow={runner.workflow} books={books} initialInput={runner.input} initialOutput={runner.output} initialEntry={runner.entry} onClose={() => setRunner(null)} onHistory={addHistory} />}
    {showHistory && <HistoryModal entries={history} workflows={allWorkflows} onClose={() => setShowHistory(false)} onReopen={reopenHistory} onDelete={id => setStoredHistory(history.filter(entry => entry.id !== id))} onClear={() => setStoredHistory([])} />}
  </section>;
}
