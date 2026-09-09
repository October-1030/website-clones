"use client";

import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  ArrowUpDown,
  BookOpen,
  Bookmark,
  BookmarkCheck,
  Check,
  ChevronDown,
  ChevronUp,
  Copy,
  Download,
  FileText,
  FileUp,
  History,
  Image as ImageIcon,
  Lock,
  Maximize2,
  Minimize2,
  MoreHorizontal,
  PanelLeft,
  PanelRight,
  Plus,
  Quote,
  Redo2,
  RefreshCw,
  Replace,
  Search,
  Settings2,
  Smartphone,
  Sparkles,
  Undo2,
  Volume2,
  X,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type ReactNode,
} from "react";

import type { Book, Chapter } from "@/types/workspace";
import { applyEditorRecovery, createEditorRecoveryDraft, parseEditorRecoveryDraft } from "@/lib/editor-recovery";
import { buildContinuationSource } from "@/lib/continuation-source";
import { applyGeneratedChapterSummaries, buildChapterSummaryRequest } from "@/lib/chapter-summary-batch";
import { buildContinuityAuditSource } from "@/lib/continuity-audit";

import "./book-editor.css";

interface BookEditorProps {
  book: Book;
  onChange: (book: Book) => void;
  onBack: () => void;
  onTool: (name: string, context?: string, onResult?: (text: string) => void) => void;
  resources?: ReactNode;
  initialPanel?: "import" | "settings";
  initialChapterId?: string;
}

interface HistoryEntry {
  id: string;
  chapterId: string;
  title: string;
  content: string;
  savedAt: string;
}

interface VolumeEntry {
  id: string;
  title: string;
}

interface EditorMeta {
  volumes: VolumeEntry[];
  chapterVolumes: Record<string, string>;
}

type PanelName = "" | "find" | "settings" | "history" | "import" | "mobile-ai";
type PreviewMode = "desktop" | "mobile";
type FontChoice = "yahei" | "song" | "serif";
type FontSizeChoice = "small" | "medium" | "large";
type LineChoice = "compact" | "normal" | "loose";

const AI_ACTIONS = [
  "AI写作",
  "AI扩写润色",
  "AI续写正文",
  "章纲",
  "AI拆书",
  "AI审稿",
  "AI纠错",
  "AI去痕",
  "更多AI工具",
  "剧本改编",
] as const;

const HISTORY_LIMIT = 30;
const UNDO_LIMIT = 100;
const AUTOSAVE_DELAY = 700;

function createId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function countWords(value: string) {
  return value.replace(/\s/g, "").length;
}

function downloadText(name: string, content: string) {
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  const href = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = href;
  anchor.download = name.replace(/[\\/:*?"<>|]/g, "_");
  anchor.click();
  URL.revokeObjectURL(href);
}

function normalizePunctuation(value: string) {
  return value
    .replace(/,/g, "，")
    .replace(/\?/g, "？")
    .replace(/!/g, "！")
    .replace(/;/g, "；")
    .replace(/:/g, "：")
    .replace(/\.{3,}/g, "……")
    .replace(/\s+([，。！？；：])/g, "$1");
}

function initialChapters(book: Book): Chapter[] {
  if (book.chapters?.length) return book.chapters;
  const now = book.updatedAt || new Date().toISOString();
  return [{
    id: createId("chapter"),
    title: "第1章",
    content: book.content || "",
    summary: "",
    updatedAt: now,
  }];
}

function aggregateContent(chapters: Chapter[]) {
  return chapters.map((chapter) => chapter.content).filter(Boolean).join("\n\n");
}

function splitImportedText(text: string, splitHeadings: boolean, fileName: string): Omit<Chapter, "id" | "updatedAt">[] {
  if (!splitHeadings) {
    return [{ title: fileName.replace(/\.(txt|md)$/i, "").slice(0, 35) || "导入章节", content: text, summary: "" }];
  }
  const heading = /^(?:#{1,6}\s+.+|第[零一二三四五六七八九十百千万0-9]+[章节卷回].*)$/gm;
  const matches = [...text.matchAll(heading)];
  if (!matches.length) {
    return [{ title: fileName.replace(/\.(txt|md)$/i, "").slice(0, 35) || "导入章节", content: text, summary: "" }];
  }
  const chapters: Omit<Chapter, "id" | "updatedAt">[] = [];
  matches.forEach((match, index) => {
    const start = match.index ?? 0;
    const next = matches[index + 1]?.index ?? text.length;
    const rawTitle = match[0].replace(/^#{1,6}\s+/, "").trim();
    const contentStart = start + match[0].length;
    chapters.push({ title: rawTitle.slice(0, 35), content: text.slice(contentStart, next).trim(), summary: "" });
  });
  const preface = text.slice(0, matches[0].index ?? 0).trim();
  if (preface) chapters.unshift({ title: "前言", content: preface, summary: "" });
  return chapters;
}

function safeLoad<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function BookEditor({ book, onChange, onBack, onTool, resources, initialPanel, initialChapterId }: BookEditorProps) {
  const normalized = useMemo(() => initialChapters(book), [book]);
  const [activeId, setActiveId] = useState(initialChapterId ?? normalized[0]?.id ?? "");
  const [directoryOpen, setDirectoryOpen] = useState(true);
  const [resourcesOpen, setResourcesOpen] = useState(false);
  const [mobileView, setMobileView] = useState<"directory" | "editor">("directory");
  const [panel, setPanel] = useState<PanelName>(initialPanel ?? "");
  const [chapterMenu, setChapterMenu] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [findQuery, setFindQuery] = useState("");
  const [replaceQuery, setReplaceQuery] = useState("");
  const [summaryEditing, setSummaryEditing] = useState<string | null>(null);
  const [reorderMode, setReorderMode] = useState(false);
  const [sortAscending, setSortAscending] = useState(true);
  const [importSplit, setImportSplit] = useState(true);
  const [previewMode, setPreviewMode] = useState<PreviewMode>("desktop");
  const [fontChoice, setFontChoice] = useState<FontChoice>("yahei");
  const [fontSize, setFontSize] = useState<FontSizeChoice>("medium");
  const [lineChoice, setLineChoice] = useState<LineChoice>("normal");
  const [titlePinned, setTitlePinned] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [failedDraft, setFailedDraft] = useState<Chapter[] | null>(null);
  const [savePending, setSavePending] = useState(false);
  const [lastSaved, setLastSaved] = useState(book.updatedAt || new Date().toISOString());
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [historyEntries, setHistoryEntries] = useState<HistoryEntry[]>(() => safeLoad(`xingyue-history-${book.id}`, []));
  const [editorMeta, setEditorMeta] = useState<EditorMeta>(() => safeLoad(`xingyue-editor-meta-${book.id}`, { volumes: [], chapterVolumes: {} }));
  const editorRootRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const undoRef = useRef<Record<string, string[]>>({});
  const redoRef = useRef<Record<string, string[]>>({});
  const lastHistoryRef = useRef("");
  const latestBookRef = useRef(book);
  const initialBookRef = useRef(book);
  const onChangeRef = useRef(onChange);
  const latestChaptersRef = useRef<Chapter[]>([]);
  const saveTimerRef = useRef<number | null>(null);
  const dirtyRef = useRef(false);

  const chapters = failedDraft ?? (book.chapters?.length ? book.chapters : normalized);
  const activeChapter = chapters.find((chapter) => chapter.id === activeId) ?? chapters[0];
  latestBookRef.current = book;
  onChangeRef.current = onChange;
  latestChaptersRef.current = chapters;

  useEffect(() => {
    if (!book.chapters?.length && normalized.length) {
      try {
        onChange({ ...book, chapters: normalized, content: aggregateContent(normalized) });
      } catch (error) {
        setSaveError(error instanceof Error ? error.message : "初始化章节失败，请重试");
      }
    }
  }, [book, normalized, onChange]);

  useEffect(() => {
    if (!chapters.some((chapter) => chapter.id === activeId)) setActiveId(chapters[0]?.id ?? "");
  }, [activeId, chapters]);

  useEffect(() => {
    try {
      window.localStorage.setItem(`xingyue-editor-meta-${book.id}`, JSON.stringify(editorMeta));
    } catch {
      setSaveError("编辑器布局偏好无法保存，正文内容仍然保留");
    }
  }, [book.id, editorMeta]);

  useEffect(() => {
    if (!activeChapter) return;
    const signature = `${activeChapter.id}:${activeChapter.title}:${activeChapter.content}`;
    if (signature === lastHistoryRef.current) return;
    const timer = window.setTimeout(() => {
      const next: HistoryEntry = {
        id: createId("history"),
        chapterId: activeChapter.id,
        title: activeChapter.title,
        content: activeChapter.content,
        savedAt: new Date().toISOString(),
      };
      setHistoryEntries((current) => {
        const duplicate = current[0]?.chapterId === next.chapterId && current[0]?.title === next.title && current[0]?.content === next.content;
        const updated = duplicate ? current : [next, ...current].slice(0, HISTORY_LIMIT);
        try {
          window.localStorage.setItem(`xingyue-history-${book.id}`, JSON.stringify(updated));
        } catch {
          setSaveError("历史记录空间已满，正文内容仍然保留");
        }
        return updated;
      });
      lastHistoryRef.current = signature;
    }, 900);
    return () => window.clearTimeout(timer);
  }, [activeChapter, book.id]);

  useEffect(() => {
    const onFullscreenChange = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", onFullscreenChange);
  }, []);

  const persistChapters = useCallback((nextChapters: Chapter[]) => {
    const now = new Date().toISOString();
    try {
      onChangeRef.current({ ...latestBookRef.current, chapters: nextChapters, content: aggregateContent(nextChapters), updatedAt: now });
      dirtyRef.current = false;
      setSavePending(false);
      setLastSaved(now);
      setSaveError("");
      window.localStorage.removeItem(`xingyue-editor-recovery-${book.id}`);
      return true;
    } catch (error) {
      setFailedDraft(nextChapters);
      dirtyRef.current = true;
      setSavePending(true);
      setSaveError(error instanceof Error ? error.message : "保存失败，内容仍保留在编辑器中");
      return false;
    }
  }, [book.id]);

  const commitChapters = useCallback((nextChapters: Chapter[], nextActiveId?: string) => {
    if (saveTimerRef.current !== null) window.clearTimeout(saveTimerRef.current);
    saveTimerRef.current = null;
    latestChaptersRef.current = nextChapters;
    setFailedDraft(nextChapters);
    dirtyRef.current = true;
    setSavePending(true);
    persistChapters(nextChapters);
    if (nextActiveId) setActiveId(nextActiveId);
  }, [persistChapters]);

  const queueChapters = useCallback((nextChapters: Chapter[], changedChapterId: string) => {
    latestChaptersRef.current = nextChapters;
    setFailedDraft(nextChapters);
    dirtyRef.current = true;
    setSavePending(true);
    const changed = nextChapters.find((chapter) => chapter.id === changedChapterId);
    if (changed) {
      try {
        window.localStorage.setItem(`xingyue-editor-recovery-${book.id}`, JSON.stringify(createEditorRecoveryDraft(book.id, changed)));
      } catch {
        setSaveError("即时草稿保护空间不足；请尽快导出章节或完整备份。");
      }
    }
    if (saveTimerRef.current !== null) window.clearTimeout(saveTimerRef.current);
    saveTimerRef.current = window.setTimeout(() => {
      saveTimerRef.current = null;
      persistChapters(latestChaptersRef.current);
    }, AUTOSAVE_DELAY);
  }, [book.id, persistChapters]);

  useEffect(() => {
    setFailedDraft(null);
    dirtyRef.current = false;
    setSavePending(false);
    const initialBook = initialBookRef.current;
    const recovery = applyEditorRecovery(
      initialChapters(initialBook),
      parseEditorRecoveryDraft(window.localStorage.getItem(`xingyue-editor-recovery-${initialBook.id}`)),
      initialBook.id,
      initialBook.updatedAt,
    );
    if (!recovery.recovered) return;
    latestChaptersRef.current = recovery.chapters;
    setFailedDraft(recovery.chapters);
    dirtyRef.current = true;
    setSavePending(true);
    setSaveError("检测到上次未落盘的内容，已恢复到编辑器并等待保存。");
    saveTimerRef.current = window.setTimeout(() => {
      saveTimerRef.current = null;
      persistChapters(latestChaptersRef.current);
    }, AUTOSAVE_DELAY);
  }, [book.id, persistChapters]); // A different book remounts the editor; only recover once for that book.

  useEffect(() => {
    const flush = () => {
      if (saveTimerRef.current !== null) window.clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
      if (dirtyRef.current) persistChapters(latestChaptersRef.current);
    };
    window.addEventListener("pagehide", flush);
    return () => window.removeEventListener("pagehide", flush);
  }, [persistChapters]);

  const patchChapter = useCallback((chapterId: string, patch: Partial<Chapter>, recordUndo = false) => {
    const currentChapters = latestChaptersRef.current;
    const current = currentChapters.find((chapter) => chapter.id === chapterId);
    if (!current) return;
    if (recordUndo && typeof patch.content === "string" && patch.content !== current.content) {
      undoRef.current[chapterId] = [...(undoRef.current[chapterId] ?? []), current.content].slice(-UNDO_LIMIT);
      redoRef.current[chapterId] = [];
    }
    const now = new Date().toISOString();
    queueChapters(currentChapters.map((chapter) => chapter.id === chapterId ? { ...chapter, ...patch, updatedAt: now } : chapter), chapterId);
  }, [queueChapters]);

  const createChapter = useCallback((index = chapters.length, volumeId = "") => {
    const now = new Date().toISOString();
    const chapter: Chapter = {
      id: createId("chapter"),
      title: `第${chapters.length + 1}章`,
      content: "",
      summary: "",
      updatedAt: now,
    };
    const next = [...chapters];
    next.splice(index, 0, chapter);
    if (volumeId) setEditorMeta((current) => ({ ...current, chapterVolumes: { ...current.chapterVolumes, [chapter.id]: volumeId } }));
    commitChapters(next, chapter.id);
    setMobileView("editor");
    setChapterMenu(null);
  }, [chapters, commitChapters]);

  const addVolume = () => {
    const title = window.prompt("请输入分卷名称", `第${editorMeta.volumes.length + 1}卷`);
    if (!title?.trim()) return;
    const volume = { id: createId("volume"), title: title.trim().slice(0, 35) };
    setEditorMeta((current) => ({ ...current, volumes: [...current.volumes, volume] }));
  };

  const selectChapter = (chapterId: string) => {
    setActiveId(chapterId);
    setMobileView("editor");
    setChapterMenu(null);
  };

  const deleteChapter = (chapterId: string) => {
    const chapter = chapters.find((item) => item.id === chapterId);
    if (!chapter || !window.confirm(`确定删除《${chapter.title}》吗？此操作无法撤销。`)) return;
    const next = chapters.filter((item) => item.id !== chapterId);
    const nextId = next[Math.max(0, chapters.findIndex((item) => item.id === chapterId) - 1)]?.id ?? next[0]?.id;
    setEditorMeta((current) => {
      const chapterVolumes = { ...current.chapterVolumes };
      delete chapterVolumes[chapterId];
      return { ...current, chapterVolumes };
    });
    commitChapters(next, nextId);
    if (!next.length) setMobileView("directory");
  };

  const moveChapter = (chapterId: string, direction: -1 | 1) => {
    const index = chapters.findIndex((chapter) => chapter.id === chapterId);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= chapters.length) return;
    const next = [...chapters];
    [next[index], next[target]] = [next[target], next[index]];
    commitChapters(next);
  };

  const reverseSort = () => {
    commitChapters([...chapters].reverse());
    setSortAscending((current) => !current);
  };

  const runTool = (name: string, chapter = activeChapter) => {
    if (!chapter) return;
    const source = name === "AI续写正文"
      ? buildContinuationSource(latestChaptersRef.current, chapter.id)
      : `章节标题：${chapter.title}\n\n${chapter.content}`;
    onTool(name, source, (text) => {
      if (!text.trim()) return;
      if (name === "AI 章节起名") patchChapter(chapter.id, { title: text.trim().split("\n")[0].slice(0, 35) });
      else {
        const current = latestChaptersRef.current.find((item) => item.id === chapter.id);
        if (current) patchChapter(chapter.id, { content: `${current.content}${current.content ? "\n\n" : ""}${text.trim()}` }, true);
      }
    });
  };

  const runSummaryBatch = () => {
    try {
      const request = buildChapterSummaryRequest(latestChaptersRef.current);
      setPanel("");
      onTool("批量生成章节概要", request.prompt, (text) => {
        const result = applyGeneratedChapterSummaries(latestChaptersRef.current, request.targets, text);
        commitChapters(result.chapters);
        return true;
      });
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "无法整理待生成概要的章节。");
    }
  };

  const runContinuityAudit = () => {
    const currentChapters = latestChaptersRef.current;
    if (!currentChapters.some((chapter) => chapter.content.trim())) {
      setSaveError("作品还没有正文，暂时无法检查剧情一致性。");
      return;
    }
    setPanel("");
    onTool("剧情一致性检查", buildContinuityAuditSource(latestBookRef.current, currentChapters));
  };

  const handleImport = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    try {
      const text = await file.text();
      const imports = splitImportedText(text, importSplit, file.name);
      const now = new Date().toISOString();
      const nextChapters = imports.map((chapter) => ({ ...chapter, id: createId("chapter"), updatedAt: now }));
      commitChapters([...chapters, ...nextChapters], nextChapters[0]?.id);
      setPanel("");
      setMobileView("editor");
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "文件读取失败，请重新选择 TXT 或 MD 文件");
    }
  };

  const undo = () => {
    if (!activeChapter) return;
    const stack = undoRef.current[activeChapter.id] ?? [];
    const previous = stack.at(-1);
    if (previous === undefined) return;
    undoRef.current[activeChapter.id] = stack.slice(0, -1);
    redoRef.current[activeChapter.id] = [...(redoRef.current[activeChapter.id] ?? []), activeChapter.content].slice(-UNDO_LIMIT);
    patchChapter(activeChapter.id, { content: previous });
  };

  const redo = () => {
    if (!activeChapter) return;
    const stack = redoRef.current[activeChapter.id] ?? [];
    const next = stack.at(-1);
    if (next === undefined) return;
    redoRef.current[activeChapter.id] = stack.slice(0, -1);
    undoRef.current[activeChapter.id] = [...(undoRef.current[activeChapter.id] ?? []), activeChapter.content].slice(-UNDO_LIMIT);
    patchChapter(activeChapter.id, { content: next });
  };

  const copyContent = async () => {
    if (!activeChapter) return;
    try {
      await navigator.clipboard.writeText(activeChapter.content);
      setSaveError("");
    } catch {
      textareaRef.current?.select();
      setSaveError("浏览器未授权剪贴板，正文已为你全选");
    }
  };

  const replaceAll = () => {
    if (!activeChapter || !findQuery) return;
    patchChapter(activeChapter.id, { content: activeChapter.content.split(findQuery).join(replaceQuery) }, true);
  };

  const goToMatch = () => {
    if (!activeChapter || !findQuery || !textareaRef.current) return;
    const start = activeChapter.content.indexOf(findQuery, textareaRef.current.selectionEnd);
    const index = start >= 0 ? start : activeChapter.content.indexOf(findQuery);
    if (index < 0) {
      setSaveError("当前章节没有找到该内容");
      return;
    }
    textareaRef.current.focus();
    textareaRef.current.setSelectionRange(index, index + findQuery.length);
    setSaveError("");
  };

  const wrapSelection = (before: string, after = before) => {
    if (!activeChapter || !textareaRef.current) return;
    const { selectionStart, selectionEnd } = textareaRef.current;
    const content = activeChapter.content;
    const next = `${content.slice(0, selectionStart)}${before}${content.slice(selectionStart, selectionEnd)}${after}${content.slice(selectionEnd)}`;
    patchChapter(activeChapter.id, { content: next }, true);
    window.setTimeout(() => {
      textareaRef.current?.focus();
      textareaRef.current?.setSelectionRange(selectionStart + before.length, selectionEnd + before.length);
    });
  };

  const toggleFullscreen = async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await editorRootRef.current?.requestFullscreen();
    } catch {
      setSaveError("当前浏览器不允许进入全屏模式");
    }
  };

  const readAloud = () => {
    if (!activeChapter || !("speechSynthesis" in window)) {
      setSaveError("当前浏览器不支持朗读");
      return;
    }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(`${activeChapter.title}。${activeChapter.content}`);
    utterance.lang = "zh-CN";
    window.speechSynthesis.speak(utterance);
  };

  const restoreHistory = (entry: HistoryEntry) => {
    const exists = chapters.some((chapter) => chapter.id === entry.chapterId);
    if (!exists || !window.confirm(`恢复到 ${new Date(entry.savedAt).toLocaleString("zh-CN")} 的版本吗？`)) return;
    patchChapter(entry.chapterId, { title: entry.title, content: entry.content }, true);
    setActiveId(entry.chapterId);
    setPanel("");
  };

  const leaveEditor = () => {
    if (saveTimerRef.current !== null) window.clearTimeout(saveTimerRef.current);
    saveTimerRef.current = null;
    if (dirtyRef.current && !persistChapters(latestChaptersRef.current)) return;
    onBack();
  };

  const filteredChapters = chapters.filter((chapter) => chapter.title.toLowerCase().includes(searchQuery.toLowerCase()));
  const volumesWithUnsorted = useMemo(() => [{ id: "", title: "" }, ...editorMeta.volumes], [editorMeta.volumes]);
  const bodyClass = `be-editor-body be-font-${fontChoice} be-size-${fontSize} be-line-${lineChoice}`;

  return (
    <div ref={editorRootRef} className={`book-editor ${mobileView === "editor" ? "be-mobile-editor" : "be-mobile-directory"} ${previewMode === "mobile" ? "be-phone-preview" : ""}`}>
      <header className="be-header">
        <div className="be-header-left">
          <button type="button" className="be-icon be-desktop-back" aria-label="返回作品管理" title="返回作品管理" onClick={leaveEditor}><ArrowLeft /></button>
          <button type="button" className="be-icon be-mobile-back" aria-label={mobileView === "editor" ? "返回章节目录" : "返回作品管理"} title={mobileView === "editor" ? "返回章节目录" : "返回作品管理"} onClick={() => mobileView === "editor" ? setMobileView("directory") : leaveEditor()}><ArrowLeft /></button>
          <button type="button" className="be-icon" aria-label={isFullscreen ? "退出全屏" : "全屏"} title={isFullscreen ? "退出全屏" : "全屏"} onClick={toggleFullscreen}>{isFullscreen ? <Minimize2 /> : <Maximize2 />}</button>
          <button type="button" className={`be-icon be-desktop-directory-toggle ${directoryOpen ? "active" : ""}`} aria-label="显示章节目录" title="显示章节目录" onClick={() => setDirectoryOpen((current) => !current)}><PanelLeft /></button>
          <button type="button" className="be-icon be-mobile-directory-toggle" aria-label="显示章节目录" title="显示章节目录" onClick={() => { setDirectoryOpen(true); setMobileView("directory"); }}><PanelLeft /></button>
        </div>
        <nav className="be-ai-actions" aria-label="AI 写作工具">
          {AI_ACTIONS.map((name) => <button type="button" key={name} onClick={() => runTool(name)}>{name}</button>)}
        </nav>
        <div className="be-header-right">
          <span className="be-saved-time">{savePending ? "正在保存并保护草稿…" : `最后保存：${new Date(lastSaved).toLocaleString("zh-CN", { hour12: false })}`}</span>
          <button type="button" className="be-icon" aria-label="时光机" title="时光机" onClick={() => setPanel("history")}><History /></button>
          <button type="button" className="be-icon" aria-label="手机预览" title="手机预览" onClick={() => setPreviewMode((mode) => mode === "mobile" ? "desktop" : "mobile")}><Smartphone /></button>
          <button type="button" className="be-icon" aria-label="朗读正文" title="朗读正文" onClick={readAloud}><Volume2 /></button>
          <button type="button" className="be-icon" aria-label="排版设置" title="排版设置" onClick={() => setPanel("settings")}><Settings2 /></button>
          <button type="button" className="be-icon be-mobile-more" aria-label="更多 AI 工具" title="更多 AI 工具" onClick={() => setPanel("mobile-ai")}><MoreHorizontal /></button>
        </div>
      </header>

      {saveError && <div className="be-error" role="alert"><span>{saveError}</span>{savePending && <button type="button" onClick={() => persistChapters(latestChaptersRef.current)}>重试保存</button>}<button type="button" aria-label="关闭错误提示" onClick={() => setSaveError("")}><X /></button></div>}

      <main className="be-workbench">
        {directoryOpen && <aside className="be-directory" aria-label="章节目录">
          <div className="be-book-title"><span>{book.kind === "script" ? "剧本" : "小说"}</span><strong title={book.title}>{book.title}</strong></div>
          <div className="be-directory-tools">
            <button type="button" onClick={() => createChapter()}><Plus />新建章节</button>
            <button type="button" onClick={addVolume}><BookOpen />新建分卷</button>
            <button type="button" className={reorderMode ? "active" : ""} aria-label="章节排序" title="章节排序" onClick={() => setReorderMode((current) => !current)}><ArrowUpDown /></button>
            <button type="button" aria-label="倒序章节" title={sortAscending ? "倒序章节" : "正序章节"} onClick={reverseSort}><RefreshCw /></button>
            <button type="button" aria-label="更多目录工具" title="更多目录工具" onClick={() => setPanel("import")}><MoreHorizontal /></button>
          </div>
          <label className="be-directory-search"><Search /><input value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="搜索章节" aria-label="搜索章节" /></label>
          <div className="be-chapter-list">
            {!chapters.length && <div className="be-empty-directory"><FileText /><span>该书还没有章节</span><button type="button" onClick={() => createChapter()}>新建章节</button></div>}
            {volumesWithUnsorted.map((volume) => {
              const grouped = filteredChapters.filter((chapter) => (editorMeta.chapterVolumes[chapter.id] ?? "") === volume.id);
              if (!grouped.length && !volume.id) return null;
              return <section key={volume.id || "ungrouped"} className="be-volume">
                {volume.id && <div className="be-volume-title"><span>{volume.title}</span><button type="button" aria-label={`在${volume.title}中新建章节`} onClick={() => createChapter(chapters.length, volume.id)}><Plus /></button></div>}
                {grouped.map((chapter) => {
                  const index = chapters.findIndex((item) => item.id === chapter.id);
                  return <article key={chapter.id} className={`be-chapter-card ${chapter.id === activeChapter?.id ? "active" : ""}`} onClick={() => selectChapter(chapter.id)}>
                    <div className="be-chapter-heading"><h3>{chapter.title || "未命名章节"}</h3><span>{countWords(chapter.content)} 字</span><button type="button" aria-label={chapter.bookmarked ? "取消收藏章节" : "收藏章节"} title={chapter.bookmarked ? "取消收藏章节" : "收藏章节"} onClick={(event) => { event.stopPropagation(); patchChapter(chapter.id, { bookmarked: !chapter.bookmarked }); }}>{chapter.bookmarked ? <BookmarkCheck /> : <Bookmark />}</button></div>
                    <time>创建于{new Date(chapter.updatedAt).toLocaleString("zh-CN", { hour12: false })}</time>
                    {summaryEditing === chapter.id ? <textarea autoFocus value={chapter.summary} aria-label="章节概要" onClick={(event) => event.stopPropagation()} onChange={(event) => patchChapter(chapter.id, { summary: event.target.value })} onBlur={() => setSummaryEditing(null)} /> : chapter.summary && <p className="be-summary">{chapter.summary}</p>}
                    <div className="be-chapter-actions">
                      <button type="button" onClick={(event) => { event.stopPropagation(); setSummaryEditing(chapter.id); }}>概要</button>
                      <button type="button" className="generate" onClick={(event) => { event.stopPropagation(); onTool("生成章节概要", chapter.content, (text) => patchChapter(chapter.id, { summary: text.trim() })); }}><Sparkles />生成</button>
                      <button type="button" className="danger" onClick={(event) => { event.stopPropagation(); deleteChapter(chapter.id); }}>删除</button>
                      {reorderMode && <><button type="button" aria-label="上移章节" disabled={index === 0} onClick={(event) => { event.stopPropagation(); moveChapter(chapter.id, -1); }}><ChevronUp /></button><button type="button" aria-label="下移章节" disabled={index === chapters.length - 1} onClick={(event) => { event.stopPropagation(); moveChapter(chapter.id, 1); }}><ChevronDown /></button></>}
                      <button type="button" aria-label="更多章节操作" title="更多" onClick={(event) => { event.stopPropagation(); setChapterMenu((current) => current === chapter.id ? null : chapter.id); }}><MoreHorizontal /></button>
                    </div>
                    {chapterMenu === chapter.id && <div className="be-chapter-menu" onClick={(event) => event.stopPropagation()}>
                      <button type="button" onClick={() => createChapter(index)}>向前插入一章</button>
                      <button type="button" onClick={() => createChapter(index + 1)}>向后插入一章</button>
                      <button type="button" onClick={() => runTool("AI 章节起名", chapter)}>AI 章节起名</button>
                      <button type="button" onClick={() => { setActiveId(chapter.id); setPanel("history"); setChapterMenu(null); }}>时光机</button>
                      <button type="button" onClick={() => { downloadText(`${chapter.title}.txt`, chapter.content); setChapterMenu(null); }}>导出章节</button>
                      <button type="button" onClick={() => { onTool("AI 听书", chapter.content); setChapterMenu(null); }}>AI 听书</button>
                    </div>}
                  </article>;
                })}
              </section>;
            })}
          </div>
        </aside>}

        <section className={`be-editor ${resourcesOpen ? "with-resources" : ""}`} aria-label="正文编辑器">
          {activeChapter ? <>
            <div className="be-editor-toolbar">
              <button type="button" aria-label="撤销" title="撤销" onClick={undo}><Undo2 /></button>
              <button type="button" aria-label="重做" title="重做" onClick={redo}><Redo2 /></button>
              <button type="button" aria-label="复制正文" title="复制正文" onClick={copyContent}><Copy /></button>
              <span />
              <button type="button" aria-label="加粗选中文字" title="加粗" onClick={() => wrapSelection("**")}><strong>B</strong></button>
              <button type="button" aria-label="强调选中文字" title="强调" onClick={() => wrapSelection("《", "》")}><Quote /></button>
              <button type="button" aria-label="查找和替换" title="查找和替换" onClick={() => setPanel("find")}><Search /></button>
              <button type="button" aria-label="统一中文标点" title="统一中文标点" onClick={() => patchChapter(activeChapter.id, { content: normalizePunctuation(activeChapter.content) }, true)}><RefreshCw /></button>
              <button type="button" aria-label="排版设置" title="排版设置" onClick={() => setPanel("settings")}><Settings2 /></button>
              <button type="button" aria-label="导出章节" title="导出章节" onClick={() => downloadText(`${activeChapter.title}.txt`, activeChapter.content)}><Download /></button>
              <button type="button" className={resourcesOpen ? "active" : ""} aria-label={resourcesOpen ? "收起资料栏" : "展开资料栏"} aria-expanded={resourcesOpen} title={resourcesOpen ? "收起资料栏" : "展开资料栏"} onClick={() => setResourcesOpen((current) => !current)}><PanelRight /></button>
            </div>
            <div className={bodyClass}>
              {!titlePinned && <div className="be-title-row"><Sparkles /><input value={activeChapter.title} maxLength={35} aria-label="请输入章节标题" placeholder="请输入章节标题" onChange={(event) => patchChapter(activeChapter.id, { title: event.target.value.slice(0, 35) })} /><span>{activeChapter.title.length} / 35</span><button type="button" aria-label="固定章节标题" title="固定章节标题" onClick={() => setTitlePinned(true)}><Lock /></button></div>}
              {titlePinned && <button type="button" className="be-unpin-title" onClick={() => setTitlePinned(false)}><Lock />显示章节标题</button>}
              <textarea ref={textareaRef} value={activeChapter.content} aria-label="章节正文" placeholder="请输入章节内容" spellCheck onChange={(event) => patchChapter(activeChapter.id, { content: event.target.value }, true)} />
              <span className="be-word-count">{countWords(activeChapter.content)}</span>
            </div>
            <div className="be-floating-tools">
              <button type="button" aria-label="回到编辑器顶部" title="回到编辑器顶部" onClick={() => { if (textareaRef.current) textareaRef.current.scrollTop = 0; }}><ArrowUp /></button>
              <button type="button" aria-label="前往编辑器底部" title="前往编辑器底部" onClick={() => { if (textareaRef.current) textareaRef.current.scrollTop = textareaRef.current.scrollHeight; }}><ArrowDown /></button>
              <button type="button" className="listen" aria-label="听" onClick={readAloud}>听</button>
              <button type="button" className="paint" aria-label="一键生成章节配图" onClick={() => onTool("章节配图", `为以下场景绘制小说插画，不要文字：\n${activeChapter.content}`.slice(0,1500), image => {
                const current = latestChaptersRef.current.find(chapter => chapter.id === activeChapter.id);
                if (!current) throw new Error("目标章节已不存在。");
                const illustrations = [...(current.illustrations ?? []), image];
                if (illustrations.length > 9) throw new Error("每章最多保存9张配图，请先下载并移除旧图。");
                onChange({ ...latestBookRef.current, content: aggregateContent(latestChaptersRef.current), chapters: latestChaptersRef.current.map(chapter => chapter.id === current.id ? { ...chapter, illustrations, updatedAt: new Date().toISOString() } : chapter), updatedAt: new Date().toISOString() });
              })}><ImageIcon />画</button>
            </div>
            {!!activeChapter.illustrations?.length && <section aria-label="章节配图" className="flex shrink-0 gap-3 overflow-auto border-t border-border p-3">{activeChapter.illustrations.map((image,index) => <figure key={index} className="w-32 shrink-0">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={image} alt={`${activeChapter.title}配图${index + 1}`} className="h-24 w-full rounded object-contain" /><a href={image} download={`${activeChapter.title}-配图${index + 1}.jpg`} className="text-xs text-primary">下载配图</a><button type="button" className="ml-2 text-xs" onClick={() => patchChapter(activeChapter.id, { illustrations: activeChapter.illustrations?.filter((_,position) => position !== index) })}>移除</button>
            </figure>)}</section>}
          </> : <div className="be-no-chapter"><span>!</span><strong>这里空空如也</strong><button type="button" onClick={() => createChapter()}>新建章节</button></div>}
        </section>

        {resourcesOpen && <aside className="be-resources" aria-label="常驻资料栏"><div className="be-resources-head"><strong>资料栏</strong><button type="button" aria-label="收起资料栏" onClick={() => setResourcesOpen(false)}><X /></button></div><div className="be-resources-content">{resources ?? <div className="be-resources-empty"><BookOpen /><span>还没有可显示的资料</span></div>}</div></aside>}
      </main>

      {panel && <div className="be-popover-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setPanel(""); }}>
        <section className="be-popover" role="dialog" aria-modal="true" aria-label={panel === "history" ? "时光机" : "编辑器工具"}>
          <header><strong>{panel === "find" ? "查找与替换" : panel === "settings" ? "排版设置" : panel === "history" ? "时光机" : panel === "import" ? "目录工具" : "AI 写作工具"}</strong><button type="button" aria-label="关闭" onClick={() => setPanel("")}><X /></button></header>
          {panel === "find" && <div className="be-dialog-body be-find-panel">
            <label>查找<input value={findQuery} onChange={(event) => setFindQuery(event.target.value)} autoFocus /></label>
            <label>替换为<input value={replaceQuery} onChange={(event) => setReplaceQuery(event.target.value)} /></label>
            <div><button type="button" onClick={goToMatch}><Search />查找下一个</button><button type="button" className="primary" onClick={replaceAll}><Replace />全部替换</button></div>
          </div>}
          {panel === "settings" && <div className="be-dialog-body be-settings-panel">
            <label>字体<select value={fontChoice} onChange={(event) => setFontChoice(event.target.value as FontChoice)}><option value="yahei">微软雅黑</option><option value="song">宋体</option><option value="serif">系统衬线</option></select></label>
            <label>字号<select value={fontSize} onChange={(event) => setFontSize(event.target.value as FontSizeChoice)}><option value="small">15px</option><option value="medium">17px</option><option value="large">20px</option></select></label>
            <label>行距<select value={lineChoice} onChange={(event) => setLineChoice(event.target.value as LineChoice)}><option value="compact">紧凑</option><option value="normal">舒适</option><option value="loose">宽松</option></select></label>
            <button type="button" className="primary" onClick={() => setPanel("")}><Check />完成</button>
          </div>}
          {panel === "history" && <div className="be-history-list">
            {!historyEntries.filter((entry) => !activeChapter || entry.chapterId === activeChapter.id).length && <div className="be-history-empty"><History /><span>编辑一会儿后，这里会保留最近 30 个本地版本</span></div>}
            {historyEntries.filter((entry) => !activeChapter || entry.chapterId === activeChapter.id).map((entry) => <article key={entry.id}><div><strong>{entry.title}</strong><time>{new Date(entry.savedAt).toLocaleString("zh-CN", { hour12: false })}</time><span>{countWords(entry.content)} 字</span></div><button type="button" onClick={() => restoreHistory(entry)}>恢复</button></article>)}
          </div>}
          {panel === "import" && <div className="be-dialog-body be-import-panel">
            <button type="button" onClick={() => fileInputRef.current?.click()}><FileUp />导入 TXT / MD</button>
            <label><input type="checkbox" checked={importSplit} onChange={(event) => setImportSplit(event.target.checked)} />按“第×章”或 Markdown 标题自动拆分章节</label>
            <button type="button" onClick={() => downloadText(`${book.title}.txt`, chapters.map((chapter) => `${chapter.title}\n\n${chapter.content}`).join("\n\n"))}><Download />导出整本作品</button>
            <button type="button" onClick={runSummaryBatch}><Sparkles />批量生成缺失概要（{chapters.filter((chapter) => chapter.content.trim() && !chapter.summary.trim()).length}章）</button>
            <button type="button" onClick={runContinuityAudit}><Check />剧情一致性检查</button>
            <button type="button" onClick={() => { setSearchQuery(""); setPanel(""); }}><Search />清除目录搜索</button>
          </div>}
          {panel === "mobile-ai" && <div className="be-mobile-ai-list">{AI_ACTIONS.map((name) => <button type="button" key={name} onClick={() => { runTool(name); setPanel(""); }}><Sparkles />{name}</button>)}</div>}
        </section>
      </div>}

      <input ref={fileInputRef} type="file" accept=".txt,.md,text/plain,text/markdown" hidden onChange={handleImport} />
    </div>
  );
}
