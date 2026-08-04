import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createTask, getTask, listTasks, updateTask } from "../lib/task-api";
import type { StoryboundTask, TaskStatus, TaskSummary } from "../types/task";
import "./SupportPage.css";

interface SupportPageProps {
  page: "queue" | "history";
  onOpenTask: (taskId: string | null) => void;
  onRunQueue?: (taskIds: string[]) => void;
  activeQueue?: string[];
}

type StatusFilter = TaskStatus | "all" | "favorite";
type TaskTypeFilter = "all" | "narration" | "podcast";
type RatioFilter = "all" | StoryboundTask["aspectRatio"];
type DateFilter = "all" | "today" | "7d" | "30d";
type NoticeKind = "success" | "error" | "info";

interface WorkTask extends TaskSummary {
  aspectRatio?: StoryboundTask["aspectRatio"];
  error?: string | null;
  pausePreset?: StoryboundTask["pausePreset"];
  visualStyle?: string;
}

interface NoticeState {
  kind: NoticeKind;
  text: string;
}

interface BatchSession {
  id: string;
  taskIds: string[];
  status: "scheduled" | "running" | "completed" | "cancelled";
  createdAt: number;
  startedAt?: number;
  scheduledAt?: number;
  endedAt?: number;
}

const HIDDEN_TASKS_KEY = "storybound-work-lists-hidden-v1";
const FAVORITE_TASKS_KEY = "storybound-work-lists-favorites-v1";
const BATCH_SESSION_KEY = "storybound-work-lists-batch-v1";
const TERMINAL_STATUSES = new Set<TaskStatus>(["completed", "failed", "cancelled"]);
const RETRYABLE_STATUSES = new Set<TaskStatus>(["failed", "cancelled"]);
const QUEUE_STATUSES = new Set<TaskStatus>(["draft", "pending"]);

const statusLabels: Record<TaskStatus, string> = {
  draft: "草稿",
  pending: "等待中",
  running: "运行中",
  paused: "已暂停",
  completed: "已完成",
  failed: "失败",
  cancelled: "已取消",
};

const modeLabels: Record<TaskSummary["mode"], string> = {
  auto: "全自动",
  semi_auto: "半自动",
  direct: "直接出片",
};

const stepLabels = ["文案预审", "智能改写", "影视分镜分句", "生成绘图提示词", "批量生图", "TTS 配音", "生成剪映草稿"];

function loadStringSet(key: string): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const value = JSON.parse(window.localStorage.getItem(key) || "[]") as unknown;
    return new Set(Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : []);
  } catch {
    return new Set();
  }
}

function saveStringSet(key: string, value: Set<string>): void {
  window.localStorage.setItem(key, JSON.stringify(Array.from(value)));
}

function loadBatchSession(): BatchSession | null {
  if (typeof window === "undefined") return null;
  try {
    const value = JSON.parse(window.localStorage.getItem(BATCH_SESSION_KEY) || "null") as Partial<BatchSession> | null;
    if (!value || typeof value.id !== "string" || !Array.isArray(value.taskIds)) return null;
    if (!["scheduled", "running", "completed", "cancelled"].includes(String(value.status))) return null;
    return value as BatchSession;
  } catch {
    return null;
  }
}

function formatRelativeDate(value: string): string {
  const timestamp = Date.parse(value);
  if (Number.isNaN(timestamp)) return value;
  const seconds = Math.max(0, Math.floor((Date.now() - timestamp) / 1000));
  if (seconds < 60) return "刚刚";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} 分钟前`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} 小时前`;
  const days = Math.floor(hours / 24);
  return days < 7 ? `${days} 天前` : new Date(timestamp).toLocaleDateString("zh-CN");
}

function formatDuration(seconds: number): string {
  const rounded = Math.max(0, Math.round(seconds));
  if (rounded < 60) return `${rounded} 秒`;
  const minutes = Math.floor(rounded / 60);
  const remain = rounded % 60;
  return remain ? `${minutes} 分 ${remain} 秒` : `${minutes} 分钟`;
}

function compactLength(value: string): number {
  return value.replace(/\s+/g, "").length;
}

function dateMatches(value: string, filter: DateFilter): boolean {
  if (filter === "all") return true;
  const timestamp = Date.parse(value);
  if (Number.isNaN(timestamp)) return false;
  const now = new Date();
  if (filter === "today") {
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    return timestamp >= start;
  }
  const days = filter === "7d" ? 7 : 30;
  return timestamp >= now.getTime() - days * 86_400_000;
}

function historyGroupLabel(value: string): string {
  const timestamp = Date.parse(value);
  if (Number.isNaN(timestamp)) return "更早";
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(timestamp);
  target.setHours(0, 0, 0, 0);
  const days = Math.round((today.getTime() - target.getTime()) / 86_400_000);
  if (days === 0) return "今天";
  if (days === 1) return "昨天";
  if (days < 7) return `${days} 天前`;
  if (days < 30) return "本月";
  return "更早";
}

function scheduleTimestamp(time: string): number {
  const [hours, minutes] = time.split(":").map(Number);
  const result = new Date();
  result.setHours(Number.isFinite(hours) ? hours : 2, Number.isFinite(minutes) ? minutes : 0, 0, 0);
  if (result.getTime() <= Date.now()) result.setDate(result.getDate() + 1);
  return result.getTime();
}

function taskType(task: WorkTask): Exclude<TaskTypeFilter, "all"> {
  return task.videoForm === "podcast" ? "podcast" : "narration";
}

function taskFromDetail(summary: TaskSummary, detail: StoryboundTask | null): WorkTask {
  return {
    ...summary,
    aspectRatio: detail?.aspectRatio,
    error: detail?.error,
    pausePreset: detail?.pausePreset,
    visualStyle: detail?.visualStyle,
  };
}

function summarizeTask(task: StoryboundTask): WorkTask {
  return {
    id: task.id,
    title: task.title,
    inputText: task.inputText,
    mode: task.mode,
    videoForm: task.videoForm,
    track: task.track,
    status: task.status,
    runState: task.runState,
    currentStep: task.currentStep,
    stepStatuses: task.stepStatuses,
    createdAt: task.createdAt,
    updatedAt: task.updatedAt,
    completedAt: task.completedAt,
    imageCount: task.media.images.filter((item) => item.status === "ready").length,
    audioCount: task.media.continuousAudio?.status === "ready"
      ? 1
      : task.media.audioSegments.filter((item) => item.status === "ready").length,
    draftReady: Boolean(task.draft?.ready),
    aspectRatio: task.aspectRatio,
    error: task.error,
    pausePreset: task.pausePreset,
    visualStyle: task.visualStyle,
  };
}

async function copyText(value: string): Promise<void> {
  if (navigator.clipboard) {
    await navigator.clipboard.writeText(value);
    return;
  }
  const field = document.createElement("textarea");
  field.value = value;
  field.style.position = "fixed";
  field.style.opacity = "0";
  document.body.append(field);
  field.select();
  document.execCommand("copy");
  field.remove();
}

export function SupportPage({ page, onOpenTask, onRunQueue, activeQueue = [] }: SupportPageProps) {
  const [tasks, setTasks] = useState<WorkTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [notice, setNotice] = useState<NoticeState | null>(null);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [typeFilter, setTypeFilter] = useState<TaskTypeFilter>("all");
  const [ratioFilter, setRatioFilter] = useState<RatioFilter>("all");
  const [dateFilter, setDateFilter] = useState<DateFilter>("all");
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(() => loadStringSet(HIDDEN_TASKS_KEY));
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(() => loadStringSet(FAVORITE_TASKS_KEY));
  const [startMode, setStartMode] = useState<"now" | "time">("now");
  const [scheduleTime, setScheduleTime] = useState("02:00");
  const [batchSession, setBatchSessionState] = useState<BatchSession | null>(() => loadBatchSession());
  const [clock, setClock] = useState(Date.now());
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const scheduleStartingRef = useRef(false);

  const setBatchSession = useCallback((session: BatchSession | null) => {
    setBatchSessionState(session);
    if (session) window.localStorage.setItem(BATCH_SESSION_KEY, JSON.stringify(session));
    else window.localStorage.removeItem(BATCH_SESSION_KEY);
  }, []);

  const refreshTasks = useCallback(async (showLoader = false) => {
    if (showLoader) setLoading(true);
    else setRefreshing(true);
    try {
      const result = await listTasks();
      const details = await Promise.all(result.tasks.map(async (summary) => {
        try {
          return taskFromDetail(summary, await getTask(summary.id));
        } catch {
          return taskFromDetail(summary, null);
        }
      }));
      setTasks(details.filter((task) => !hiddenIds.has(task.id)));
    } catch (error) {
      setNotice({ kind: "error", text: error instanceof Error ? error.message : "读取本地任务失败" });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [hiddenIds]);

  useEffect(() => {
    void refreshTasks(true);
    const interval = window.setInterval(() => void refreshTasks(false), activeQueue.length || batchSession ? 2_500 : 8_000);
    return () => window.clearInterval(interval);
  }, [activeQueue.length, batchSession, page, refreshTasks]);

  useEffect(() => {
    const interval = window.setInterval(() => setClock(Date.now()), 1_000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    setSelectedIds(new Set());
    setSelectionMode(false);
  }, [page]);

  const statusCounts = useMemo(() => {
    const counts = new Map<StatusFilter, number>();
    counts.set("all", tasks.length);
    counts.set("favorite", tasks.filter((task) => favoriteIds.has(task.id)).length);
    for (const task of tasks) counts.set(task.status, (counts.get(task.status) || 0) + 1);
    return counts;
  }, [favoriteIds, tasks]);

  const filteredTasks = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return tasks.filter((task) => {
      if (page === "queue" && !QUEUE_STATUSES.has(task.status)) return false;
      if (statusFilter === "favorite" && !favoriteIds.has(task.id)) return false;
      if (statusFilter !== "all" && statusFilter !== "favorite" && task.status !== statusFilter) return false;
      if (typeFilter !== "all" && taskType(task) !== typeFilter) return false;
      if (ratioFilter !== "all" && task.aspectRatio !== ratioFilter) return false;
      if (!dateMatches(task.createdAt, dateFilter)) return false;
      return !normalized || `${task.title} ${task.inputText} ${task.id} ${task.track}`.toLowerCase().includes(normalized);
    });
  }, [dateFilter, favoriteIds, page, query, ratioFilter, statusFilter, tasks, typeFilter]);

  const groupedHistory = useMemo(() => {
    const groups = new Map<string, WorkTask[]>();
    for (const task of filteredTasks) {
      const label = historyGroupLabel(task.createdAt);
      groups.set(label, [...(groups.get(label) || []), task]);
    }
    const order = ["今天", "昨天", "2 天前", "3 天前", "4 天前", "5 天前", "6 天前", "本月", "更早"];
    return Array.from(groups.entries()).sort(([left], [right]) => order.indexOf(left) - order.indexOf(right));
  }, [filteredTasks]);

  const batchTasks = useMemo(() => {
    if (!batchSession) return [];
    const byId = new Map(tasks.map((task) => [task.id, task]));
    return batchSession.taskIds.map((id) => byId.get(id)).filter((task): task is WorkTask => Boolean(task));
  }, [batchSession, tasks]);

  const batchCounts = useMemo(() => ({
    completed: batchTasks.filter((task) => task.status === "completed").length,
    failed: batchTasks.filter((task) => task.status === "failed").length,
    cancelled: batchTasks.filter((task) => task.status === "cancelled").length,
    running: batchTasks.filter((task) => task.status === "running").length,
    paused: batchTasks.filter((task) => task.status === "paused").length,
  }), [batchTasks]);

  const batchIsTerminal = Boolean(
    batchSession
    && batchSession.status === "running"
    && activeQueue.length === 0
    && batchTasks.length === batchSession.taskIds.length
    && batchTasks.every((task) => TERMINAL_STATUSES.has(task.status)),
  );

  useEffect(() => {
    if (!batchSession || !batchIsTerminal) return;
    setBatchSession({ ...batchSession, status: "completed", endedAt: Date.now() });
  }, [batchIsTerminal, batchSession, setBatchSession]);

  const startBatch = useCallback(async (taskIds: string[]) => {
    if (!onRunQueue) {
      setNotice({ kind: "error", text: "当前页面未连接本地队列执行器，未启动任何任务。" });
      return;
    }
    setBusyAction("start");
    try {
      const available = await listTasks();
      const statuses = new Map(available.tasks.map((task) => [task.id, task.status]));
      const eligible = taskIds.filter((id) => {
        const status = statuses.get(id);
        return status === "draft" || status === "pending";
      });
      if (!eligible.length) throw new Error("所选任务已不在草稿/等待状态，请刷新后重试。");
      const ready: string[] = [];
      const failures: string[] = [];
      for (const id of eligible) {
        try {
          await updateTask(id, { status: "pending", runState: "queued", error: null });
          ready.push(id);
        } catch {
          failures.push(id);
        }
      }
      if (!ready.length) throw new Error("队列写入失败，没有任务被启动。");
      const startedAt = Date.now();
      setBatchSession({ id: crypto.randomUUID(), taskIds: ready, status: "running", createdAt: startedAt, startedAt });
      setSelectedIds(new Set());
      if (failures.length) setNotice({ kind: "error", text: `${ready.length} 项已入队，${failures.length} 项写入失败。` });
      onRunQueue(ready);
    } catch (error) {
      setNotice({ kind: "error", text: error instanceof Error ? error.message : "批量启动失败" });
    } finally {
      scheduleStartingRef.current = false;
      setBusyAction(null);
    }
  }, [onRunQueue, setBatchSession]);

  useEffect(() => {
    if (batchSession?.status !== "scheduled" || !batchSession.scheduledAt) return;
    if (batchSession.scheduledAt > clock || scheduleStartingRef.current) return;
    scheduleStartingRef.current = true;
    void startBatch(batchSession.taskIds);
  }, [batchSession, clock, startBatch]);

  const activeFilters = query.trim() || statusFilter !== "all" || typeFilter !== "all" || ratioFilter !== "all" || dateFilter !== "all";
  const selectableVisible = filteredTasks.filter((task) => task.status !== "running");
  const allVisibleSelected = selectableVisible.length > 0 && selectableVisible.every((task) => selectedIds.has(task.id));
  const selectedTasks = tasks.filter((task) => selectedIds.has(task.id));
  const retryableSelected = selectedTasks.filter((task) => RETRYABLE_STATUSES.has(task.status));
  const queueSelected = filteredTasks.filter((task) => selectedIds.has(task.id));
  const totalSegments = queueSelected.reduce((sum, task) => sum + Math.max(1, Math.ceil(compactLength(task.inputText) / 27)), 0);
  const estimatedSeconds = queueSelected.reduce((sum, task) => sum + Math.max(1, Math.ceil(compactLength(task.inputText) / 27)) * 4 + 60, 0);
  const currentBatchTask = tasks.find((task) => task.id === activeQueue[0]);

  function clearFilters(): void {
    setQuery("");
    setStatusFilter("all");
    setTypeFilter("all");
    setRatioFilter("all");
    setDateFilter("all");
  }

  function toggleSelected(taskId: string): void {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(taskId)) next.delete(taskId);
      else next.add(taskId);
      return next;
    });
  }

  function toggleSelectAll(): void {
    setSelectedIds((current) => {
      if (allVisibleSelected) return new Set();
      return new Set([...current, ...selectableVisible.map((task) => task.id)]);
    });
  }

  function toggleFavorite(taskId: string): void {
    setFavoriteIds((current) => {
      const next = new Set(current);
      if (next.has(taskId)) next.delete(taskId);
      else next.add(taskId);
      saveStringSet(FAVORITE_TASKS_KEY, next);
      return next;
    });
  }

  function removeRecords(taskIds: string[]): void {
    const allowed = taskIds.filter((id) => tasks.find((task) => task.id === id)?.status !== "running");
    if (!allowed.length) {
      setNotice({ kind: "info", text: "运行中的任务不能从列表移除。" });
      return;
    }
    if (!window.confirm(`确定从列表移除 ${allowed.length} 条任务记录？\n\n磁盘任务目录、图片、音频和剪映草稿全部保留，可随时恢复记录。`)) return;
    const next = new Set(hiddenIds);
    for (const id of allowed) next.add(id);
    saveStringSet(HIDDEN_TASKS_KEY, next);
    setHiddenIds(next);
    setTasks((current) => current.filter((task) => !next.has(task.id)));
    setSelectedIds(new Set());
    setNotice({ kind: "success", text: `已从列表移除 ${allowed.length} 条记录，磁盘产物未删除。` });
  }

  function restoreRemovedRecords(): void {
    const next = new Set<string>();
    saveStringSet(HIDDEN_TASKS_KEY, next);
    setHiddenIds(next);
    setNotice({ kind: "success", text: "已恢复全部已移除记录。" });
  }

  async function moveToQueue(taskIds: string[]): Promise<void> {
    const retryable = tasks.filter((task) => taskIds.includes(task.id) && RETRYABLE_STATUSES.has(task.status));
    if (!retryable.length) {
      setNotice({ kind: "info", text: "只有失败或已取消的任务可以打回队列。" });
      return;
    }
    setBusyAction("enqueue");
    let success = 0;
    let failed = 0;
    for (const task of retryable) {
      try {
        const updated = await updateTask(task.id, { status: "draft", runState: "idle", error: null });
        setTasks((current) => current.map((item) => item.id === task.id ? summarizeTask(updated) : item));
        success += 1;
      } catch {
        failed += 1;
      }
    }
    setSelectedIds(new Set());
    setSelectionMode(false);
    setNotice({
      kind: failed ? "error" : "success",
      text: failed ? `已打回 ${success} 项，${failed} 项失败。` : `已将 ${success} 项打回草稿，可在任务队列重新勾选。`,
    });
    setBusyAction(null);
  }

  async function duplicateTask(task: WorkTask): Promise<void> {
    setBusyAction(`duplicate:${task.id}`);
    try {
      const source = await getTask(task.id);
      const duplicated = await createTask({
        title: `${source.title || "未命名任务"}（副本）`,
        inputText: source.inputText,
        sourceMode: source.sourceMode,
        aiBrief: source.aiBrief,
        mode: source.mode,
        pausePreset: source.pausePreset,
        customPauseSteps: source.customPauseSteps,
        videoForm: source.videoForm,
        track: source.track,
        visualStyle: source.visualStyle,
        aspectRatio: source.aspectRatio,
        options: source.options,
      });
      setTasks((current) => [summarizeTask(duplicated), ...current]);
      setNotice({ kind: "success", text: "已按相同配置创建新草稿，原任务与产物完整保留。" });
    } catch (error) {
      setNotice({ kind: "error", text: error instanceof Error ? error.message : "创建副本失败" });
    } finally {
      setBusyAction(null);
    }
  }

  async function copySource(task: WorkTask): Promise<void> {
    try {
      await copyText(task.inputText);
      setNotice({ kind: "success", text: "原文案已复制。" });
    } catch {
      setNotice({ kind: "error", text: "复制失败，请检查浏览器剪贴板权限。" });
    }
  }

  function scheduleSelected(): void {
    if (!queueSelected.length) return;
    const scheduledAt = scheduleTimestamp(scheduleTime);
    const session: BatchSession = {
      id: crypto.randomUUID(),
      taskIds: queueSelected.map((task) => task.id),
      status: "scheduled",
      createdAt: Date.now(),
      scheduledAt,
    };
    setBatchSession(session);
    setSelectedIds(new Set());
    setNotice({ kind: "success", text: `已计划在 ${new Date(scheduledAt).toLocaleString("zh-CN")} 启动。` });
  }

  function cancelSchedule(): void {
    setBatchSession(null);
    setNotice({ kind: "info", text: "定时批次已取消，任务仍保留为草稿。" });
  }

  async function skipCurrent(): Promise<void> {
    const currentId = activeQueue[0];
    if (!currentId || !onRunQueue) return;
    setBusyAction("skip");
    try {
      await updateTask(currentId, { status: "cancelled", runState: "cancelled", error: null });
      onRunQueue(activeQueue.slice(1));
      setNotice({ kind: "info", text: "已跳过当前任务，批次继续执行下一项。" });
    } catch (error) {
      setNotice({ kind: "error", text: error instanceof Error ? error.message : "跳过当前任务失败" });
    } finally {
      setBusyAction(null);
    }
  }

  async function cancelBatch(): Promise<void> {
    if (!batchSession || !onRunQueue) return;
    if (!window.confirm("确定取消整个批次？当前项会标记为取消，尚未运行的条目会退回草稿。")) return;
    setBusyAction("cancel");
    try {
      const currentId = activeQueue[0];
      for (const id of batchSession.taskIds) {
        const task = tasks.find((item) => item.id === id);
        if (!task || TERMINAL_STATUSES.has(task.status)) continue;
        await updateTask(id, id === currentId
          ? { status: "cancelled", runState: "cancelled", error: null }
          : { status: "draft", runState: "idle", error: null });
      }
      onRunQueue([]);
      setBatchSession({ ...batchSession, status: "cancelled", endedAt: Date.now() });
      setNotice({ kind: "info", text: "批次已取消，未运行任务已退回草稿。" });
      await refreshTasks(false);
    } catch (error) {
      setNotice({ kind: "error", text: error instanceof Error ? error.message : "取消批次失败" });
    } finally {
      setBusyAction(null);
    }
  }

  const batchProgress = batchSession?.taskIds.length
    ? Math.min(100, ((batchCounts.completed + batchCounts.failed + batchCounts.cancelled) / batchSession.taskIds.length) * 100)
    : 0;
  const scheduledRemaining = batchSession?.status === "scheduled" && batchSession.scheduledAt
    ? Math.max(0, Math.ceil((batchSession.scheduledAt - clock) / 1000))
    : 0;
  const batchDuration = batchSession?.startedAt
    ? ((batchSession.endedAt || clock) - batchSession.startedAt) / 1000
    : 0;
  const showBatchSummary = batchSession?.status === "completed" || batchSession?.status === "cancelled";

  return (
    <main className="work-lists-page">
      <header className="work-lists-header">
        <div className="work-lists-header__icon" aria-hidden="true">{page === "history" ? "◷" : "☷"}</div>
        <div className="work-lists-header__copy">
          <h1>{page === "history" ? "历史任务" : "任务队列"}</h1>
          <p>{page === "history"
            ? `共 ${tasks.length} 个任务 · ${statusCounts.get("completed") || 0} 完成 · ${statusCounts.get("failed") || 0} 失败${favoriteIds.size ? ` · ${favoriteIds.size} 收藏` : ""}`
            : `${tasks.filter((task) => QUEUE_STATUSES.has(task.status)).length} 个草稿/待执行任务 · 选中一批即可本地串行执行`}</p>
        </div>
        <div className="work-lists-header__actions">
          {hiddenIds.size ? <button className="wl-button wl-button--ghost" onClick={restoreRemovedRecords} type="button">恢复已移除记录 ({hiddenIds.size})</button> : null}
          <button className="wl-button wl-button--ghost" disabled={refreshing} onClick={() => void refreshTasks(false)} type="button">{refreshing ? "刷新中…" : "刷新"}</button>
          {page === "history" && tasks.length ? <button className="wl-button wl-button--secondary" onClick={() => { setSelectionMode((value) => !value); setSelectedIds(new Set()); }} type="button">{selectionMode ? "退出多选" : "批量选择"}</button> : null}
        </div>
      </header>

      <div className="work-lists-boundary" role="note">
        <strong>独立版 · 本地工作台</strong>
        <span>使用真实本地任务 API；不连接、模拟或绕过原版额度与授权系统。列表删除只移除记录，磁盘产物始终保留。</span>
      </div>

      {notice ? <div className={`work-lists-notice work-lists-notice--${notice.kind}`} role={notice.kind === "error" ? "alert" : "status"}><span>{notice.text}</span><button aria-label="关闭提示" onClick={() => setNotice(null)} type="button">×</button></div> : null}

      {page === "history" && selectionMode ? (
        <div className="bulk-toolbar">
          <strong>已选 {selectedIds.size} 项</strong>
          <span>删除支持非运行任务 · 入队仅对失败/取消任务生效</span>
          <div className="bulk-toolbar__spacer" />
          <button className="wl-button wl-button--ghost" disabled={!selectableVisible.length} onClick={toggleSelectAll} type="button">{allVisibleSelected ? "取消全选" : "全选可操作项"}</button>
          <button className="wl-button wl-button--danger" disabled={!selectedIds.size || Boolean(busyAction)} onClick={() => removeRecords(Array.from(selectedIds))} type="button">删除所选 ({selectedIds.size})</button>
          <button className="wl-button wl-button--primary" disabled={!retryableSelected.length || Boolean(busyAction)} onClick={() => void moveToQueue(retryableSelected.map((task) => task.id))} type="button">加入任务队列 ({retryableSelected.length})</button>
        </div>
      ) : null}

      {page === "queue" && batchSession?.status === "scheduled" && batchSession.scheduledAt ? (
        <section className="scheduled-panel">
          <div className="scheduled-panel__icon">◷</div>
          <div><strong>已计划 {new Date(batchSession.scheduledAt).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })} 开始</strong><span>{batchSession.taskIds.length} 个任务 · 倒计时 {formatDuration(scheduledRemaining)}</span></div>
          <button className="wl-button wl-button--ghost" onClick={cancelSchedule} type="button">取消定时</button>
        </section>
      ) : null}

      {page === "queue" && batchSession?.status === "running" ? (
        <section className={`batch-monitor ${batchCounts.paused ? "is-paused" : ""}`}>
          <div className="batch-monitor__top">
            <div className="batch-monitor__spinner" aria-hidden="true" />
            <div className="batch-monitor__copy">
              <strong>{batchCounts.paused ? "批次已暂停 · 等待检查/编辑" : `批次执行中 · ${batchCounts.completed + batchCounts.failed + batchCounts.cancelled + (currentBatchTask ? 1 : 0)}/${batchSession.taskIds.length}`}</strong>
              <span>{currentBatchTask ? `当前：${currentBatchTask.title} · Step ${Math.max(0, currentBatchTask.currentStep) + 1}/7` : "正在同步本地运行状态…"}</span>
            </div>
            {currentBatchTask ? <button className="wl-button wl-button--ghost" onClick={() => onOpenTask(currentBatchTask.id)} type="button">查看/修改</button> : null}
            {batchCounts.paused && activeQueue.length ? <button className="wl-button wl-button--primary" onClick={() => onRunQueue?.(activeQueue)} type="button">继续当前条</button> : null}
            {activeQueue.length ? <button className="wl-button wl-button--ghost" disabled={busyAction === "skip"} onClick={() => void skipCurrent()} type="button">跳过当前</button> : null}
            <button className="wl-button wl-button--danger" disabled={busyAction === "cancel"} onClick={() => void cancelBatch()} type="button">取消整批</button>
          </div>
          <div className="batch-progress"><span style={{ width: `${batchProgress}%` }} /></div>
          <div className="batch-monitor__counts"><span>完成 {batchCounts.completed}</span><span className="is-danger">失败 {batchCounts.failed}</span><span>取消 {batchCounts.cancelled}</span><span>耗时 {formatDuration(batchDuration)}</span></div>
          <div className="batch-log">
            {batchTasks.map((task) => <button className={`batch-log__row is-${task.status}`} key={task.id} onClick={() => onOpenTask(task.id)} type="button"><span className="batch-log__state">{task.status === "completed" ? "✓" : task.status === "failed" ? "!" : task.status === "running" ? "▶" : task.status === "cancelled" ? "×" : "◷"}</span><strong>{task.title || "未命名任务"}</strong><span>{modeLabels[task.mode]}</span><em>{statusLabels[task.status]}</em></button>)}
          </div>
        </section>
      ) : null}

      {page === "queue" && showBatchSummary && batchSession ? (
        <section className="batch-summary">
          <div className={`batch-summary__hero ${batchCounts.failed || batchCounts.cancelled ? "is-mixed" : ""}`}>
            <div className="batch-summary__icon">{batchCounts.failed || batchCounts.cancelled ? "!" : "✓"}</div>
            <h2>{batchSession.status === "cancelled" ? "批次已取消" : batchCounts.failed ? `批次结束 · ${batchCounts.failed} 个失败` : "批次完成"}</h2>
            <p>总耗时 {formatDuration(batchDuration)}</p>
            <div className="batch-summary__stats"><div><strong>{batchSession.taskIds.length}</strong><span>总数</span></div><div><strong className="is-success">{batchCounts.completed}</strong><span>完成</span></div><div><strong className="is-danger">{batchCounts.failed}</strong><span>失败</span></div><div><strong>{batchCounts.cancelled}</strong><span>取消</span></div></div>
          </div>
          {batchTasks.filter((task) => task.status === "failed" || task.status === "cancelled").length ? <div className="batch-summary__failures"><h3>失败 / 取消</h3>{batchTasks.filter((task) => task.status === "failed" || task.status === "cancelled").map((task) => <button key={task.id} onClick={() => onOpenTask(task.id)} type="button"><span>!</span><strong>{task.title}</strong><em>Step {Math.max(0, task.currentStep) + 1} · {stepLabels[Math.max(0, task.currentStep)] || "未知步骤"}</em>{task.error ? <small>{task.error}</small> : null}</button>)}</div> : null}
          <div className="batch-summary__actions">
            <button className="wl-button wl-button--ghost" onClick={() => setBatchSession(null)} type="button">返回队列</button>
            {batchCounts.failed || batchCounts.cancelled ? <><button className="wl-button wl-button--ghost" onClick={() => { const failed = batchTasks.find((task) => task.status === "failed" || task.status === "cancelled"); if (failed) onOpenTask(failed.id); }} type="button">打开第一个失败任务</button><button className="wl-button wl-button--primary" disabled={busyAction === "enqueue"} onClick={() => void moveToQueue(batchTasks.filter((task) => RETRYABLE_STATUSES.has(task.status)).map((task) => task.id)).then(() => setBatchSession(null))} type="button">全部加入队列 ({batchCounts.failed + batchCounts.cancelled})</button></> : null}
          </div>
        </section>
      ) : null}

      {(page === "history" || (!batchSession || !["scheduled", "running"].includes(batchSession.status))) ? (
        <section className="work-list-filters">
          {page === "history" ? <div className="status-filters" role="group" aria-label="任务状态筛选">{(["all", "favorite", "draft", "pending", "running", "paused", "completed", "failed", "cancelled"] as const).map((status) => <button className={statusFilter === status ? "is-active" : ""} key={status} onClick={() => setStatusFilter(status)} type="button"><span>{status === "all" ? "全部" : status === "favorite" ? "★ 收藏" : statusLabels[status]}</span><em>{statusCounts.get(status) || 0}</em></button>)}</div> : null}
          <div className="filter-fields">
            <label className="search-field"><span aria-hidden="true">⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索标题 / 文案 / 任务 ID" />{query ? <button aria-label="清除搜索" onClick={() => setQuery("")} type="button">×</button> : null}</label>
            <select aria-label="任务类型" value={typeFilter} onChange={(event) => setTypeFilter(event.target.value as TaskTypeFilter)}><option value="all">全部类型</option><option value="narration">图文故事</option><option value="podcast">播客对话</option></select>
            <select aria-label="画面比例" value={ratioFilter} onChange={(event) => setRatioFilter(event.target.value as RatioFilter)}><option value="all">全部比例</option><option value="9:16">9:16 竖屏</option><option value="16:9">16:9 横屏</option><option value="1:1">1:1 方形</option><option value="4:3">4:3</option><option value="3:4">3:4</option></select>
            <select aria-label="创建日期" value={dateFilter} onChange={(event) => setDateFilter(event.target.value as DateFilter)}><option value="all">全部日期</option><option value="today">今天</option><option value="7d">近 7 天</option><option value="30d">近 30 天</option></select>
            {activeFilters ? <button className="wl-button wl-button--ghost" onClick={clearFilters} type="button">清除筛选</button> : null}
          </div>
        </section>
      ) : null}

      {loading ? <div className="work-list-skeleton" aria-label="正在读取本地任务">{Array.from({ length: 5 }).map((_, index) => <span key={index} />)}</div> : null}

      {!loading && !filteredTasks.length && (page === "history" || !batchSession || !["scheduled", "running"].includes(batchSession.status)) ? (
        <section className="work-list-empty">
          <div>{page === "history" ? "◷" : "☷"}</div>
          <strong>{tasks.length && activeFilters ? "没有匹配的任务" : page === "history" ? "还没有任务历史" : "队列里还没有草稿"}</strong>
          <p>{tasks.length && activeFilters ? "试试更换关键词或清除筛选条件。" : page === "history" ? "完成的任务会自动出现在这里；移除记录不会删除磁盘产物。" : "在创建任务页保存草稿或加入队列，然后回来批量勾选执行。"}</p>
          {tasks.length && activeFilters ? <button className="wl-button wl-button--ghost" onClick={clearFilters} type="button">清除筛选</button> : <button className="wl-button wl-button--primary" onClick={() => onOpenTask(null)} type="button">新建任务</button>}
        </section>
      ) : null}

      {!loading && page === "history" ? <div className="history-groups">{groupedHistory.map(([label, group]) => <section className="history-group" key={label}><div className="history-group__head"><strong>{label}</strong><span>{group.length}</span><i /></div><div className="history-group__body">{group.map((task) => <HistoryTaskRow busyAction={busyAction} favorite={favoriteIds.has(task.id)} key={task.id} onCopy={() => void copySource(task)} onDelete={() => removeRecords([task.id])} onDuplicate={() => void duplicateTask(task)} onMoveToQueue={() => void moveToQueue([task.id])} onOpen={() => onOpenTask(task.id)} onToggleFavorite={() => toggleFavorite(task.id)} onToggleSelect={() => toggleSelected(task.id)} selected={selectedIds.has(task.id)} selectionMode={selectionMode} task={task} />)}</div></section>)}</div> : null}

      {!loading && page === "queue" && (!batchSession || !["scheduled", "running"].includes(batchSession.status)) && filteredTasks.length ? (
        <>
          <section className="queue-card">
            <div className="queue-card__head"><label><input checked={allVisibleSelected} onChange={toggleSelectAll} type="checkbox" /><span>{allVisibleSelected ? "取消全选" : "全选"}</span></label><span>{queueSelected.length}/{filteredTasks.length} 已选</span>{queueSelected.length ? <button className="wl-link-danger" onClick={() => removeRecords(queueSelected.map((task) => task.id))} type="button">删除所选 ({queueSelected.length})</button> : null}<em>按各任务处理模式执行 · 失败自动继续下一项</em></div>
            {filteredTasks.map((task) => <QueueTaskRow checked={selectedIds.has(task.id)} key={task.id} onDelete={() => removeRecords([task.id])} onOpen={() => onOpenTask(task.id)} onToggle={() => toggleSelected(task.id)} task={task} />)}
          </section>
          {queueSelected.length ? <section className="queue-actionbar"><div className="queue-actionbar__count">{queueSelected.length}</div><div><strong>已选 {queueSelected.length} 个任务</strong><span>总分镜约 {totalSegments} 镜 · 预计用时 <b>{formatDuration(estimatedSeconds)}</b></span></div><div className="queue-actionbar__spacer" /><div className="queue-schedule"><label className={startMode === "now" ? "is-active" : ""}><input checked={startMode === "now"} onChange={() => setStartMode("now")} type="radio" />立即开始</label><label className={startMode === "time" ? "is-active" : ""}><input checked={startMode === "time"} onChange={() => setStartMode("time")} type="radio" />定时<input onChange={(event) => { setStartMode("time"); setScheduleTime(event.target.value); }} onFocus={() => setStartMode("time")} type="time" value={scheduleTime} /></label></div><button className="wl-button wl-button--primary wl-button--large" disabled={busyAction === "start"} onClick={() => startMode === "now" ? void startBatch(queueSelected.map((task) => task.id)) : scheduleSelected()} type="button">{busyAction === "start" ? "启动中…" : startMode === "now" ? "开始批量执行" : `定时 ${scheduleTime} 开始`}</button><small>独立版仅运行本地队列，不校验或伪造原版额度</small></section> : null}
        </>
      ) : null}
    </main>
  );
}

interface HistoryTaskRowProps {
  task: WorkTask;
  selectionMode: boolean;
  selected: boolean;
  favorite: boolean;
  busyAction: string | null;
  onOpen: () => void;
  onCopy: () => void;
  onDuplicate: () => void;
  onMoveToQueue: () => void;
  onDelete: () => void;
  onToggleFavorite: () => void;
  onToggleSelect: () => void;
}

function HistoryTaskRow({ task, selectionMode, selected, favorite, busyAction, onOpen, onCopy, onDuplicate, onMoveToQueue, onDelete, onToggleFavorite, onToggleSelect }: HistoryTaskRowProps) {
  const selectable = task.status !== "running";
  const title = task.title || (task.inputText.length > 40 ? `${task.inputText.slice(0, 40)}…` : task.inputText) || "未命名任务";
  return (
    <article className={`history-task-row is-${task.status}${selected ? " is-selected" : ""}${!selectable && selectionMode ? " is-disabled" : ""}`} onClick={selectionMode ? (selectable ? onToggleSelect : undefined) : onOpen}>
      <div className="history-task-row__state">{selectionMode ? <span className={`row-checkbox ${selected ? "is-checked" : ""}`}>{selected ? "✓" : ""}</span> : <span className={`status-dot is-${task.status}`} />}</div>
      <div className="history-task-row__body"><div className="history-task-row__title"><strong>{title}</strong>{task.status === "running" ? <span className="progress-chip"><i />Step {Math.max(0, task.currentStep) + 1}/7</span> : null}{task.status === "failed" && task.error ? <span className="failure-chip" title={task.error}>! {task.error.length > 34 ? `${task.error.slice(0, 34)}…` : task.error}</span> : null}</div><div className="history-task-row__meta"><span>{compactLength(task.inputText)} 字</span><span>{task.aspectRatio || "比例未知"}</span><span>{taskType(task) === "podcast" ? "播客对话" : "图文故事"}</span><span>{task.track}</span></div></div>
      <time>{formatRelativeDate(task.createdAt)}</time>
      {!selectionMode ? <button className={`favorite-button ${favorite ? "is-favorite" : ""}`} aria-label={favorite ? "取消收藏" : "收藏"} onClick={(event) => { event.stopPropagation(); onToggleFavorite(); }} title={favorite ? "取消收藏" : "收藏"} type="button">★</button> : null}
      <span className={`status-pill is-${task.status}`}>{statusLabels[task.status]}</span>
      {!selectionMode ? <div className="history-task-row__actions" onClick={(event) => event.stopPropagation()}><button onClick={onCopy} type="button">复制文案</button><button disabled={busyAction === `duplicate:${task.id}`} onClick={onDuplicate} type="button">{task.status === "draft" ? "创建副本" : "重跑"}</button>{RETRYABLE_STATUSES.has(task.status) ? <button onClick={onMoveToQueue} type="button">加入队列</button> : null}<button className="is-danger" disabled={task.status === "running"} onClick={onDelete} type="button">删除</button></div> : null}
    </article>
  );
}

interface QueueTaskRowProps {
  task: WorkTask;
  checked: boolean;
  onToggle: () => void;
  onOpen: () => void;
  onDelete: () => void;
}

function QueueTaskRow({ task, checked, onToggle, onOpen, onDelete }: QueueTaskRowProps) {
  const characters = compactLength(task.inputText);
  const scenes = Math.max(1, Math.ceil(characters / 27));
  return (
    <article className={`queue-task-row ${checked ? "is-checked" : ""}`}>
      <label className="queue-task-row__check"><input checked={checked} onChange={onToggle} type="checkbox" /></label>
      <button className="queue-task-row__body" onClick={onToggle} type="button"><strong>{task.title || "未命名草稿"}</strong><p>{task.inputText.slice(0, 72) || "暂无文案"}{task.inputText.length > 72 ? "…" : ""}</p><div><span>{modeLabels[task.mode]}</span><span>▤ {scenes} 镜</span><span>◷ 约 {formatDuration(Math.ceil(characters / 5))}</span><span>{task.aspectRatio || "比例未知"}</span><span>{task.visualStyle || task.track}</span><span className={`is-${task.status}`}>{statusLabels[task.status]}</span></div></button>
      <time>{formatRelativeDate(task.createdAt)}</time>
      <div className="queue-task-row__actions"><button onClick={onOpen} title="编辑/查看" type="button">编辑</button><button className="is-danger" onClick={onDelete} title="从列表移除，保留磁盘产物" type="button">删除</button></div>
    </article>
  );
}
