import { useEffect, useMemo, useState } from "react";
import { deleteTask, listTasks, updateTask } from "../lib/task-api";
import type { TaskStatus, TaskSummary } from "../types/task";
import "./SupportPage.css";

interface SupportPageProps {
  page: "queue" | "history";
  onOpenTask: (taskId: string | null) => void;
  onRunQueue?: (taskIds: string[]) => void;
  activeQueue?: string[];
}

const pageInfo: Record<SupportPageProps["page"], { title: string; description: string; features: string[] }> = {
  queue: { title: "任务队列", description: "批量顺序执行、暂停当前条、跳过失败条目。", features: ["串行执行", "断点恢复", "批次摘要"] },
  history: { title: "历史任务", description: "查看任务产物、继续断点、重新打包或删除记录。", features: ["状态筛选", "继续创作", "打开产物"] },
};

export function SupportPage({ page, onOpenTask, onRunQueue, activeQueue = [] }: SupportPageProps) {
  const info = pageInfo[page];
  const [tasks, setTasks] = useState<TaskSummary[]>([]);
  const [loading, setLoading] = useState(page === "history" || page === "queue");
  const [statusFilter, setStatusFilter] = useState<TaskStatus | "all">("all");
  const [query, setQuery] = useState("");
  const queueTasks = useMemo(
    () => page === "queue" ? tasks.filter((task) => ["pending", "running", "paused", "failed", "cancelled"].includes(task.status)) : tasks,
    [page, tasks],
  );
  const visibleTasks = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return queueTasks
      .filter((task) => statusFilter === "all" || task.status === statusFilter)
      .filter((task) => !normalized || `${task.title} ${task.track} ${task.inputText}`.toLowerCase().includes(normalized));
  }, [query, queueTasks, statusFilter]);

  useEffect(() => {
    let cancelled = false;
    if (page !== "history" && page !== "queue") return;
    setLoading(true);
    void listTasks().then((result) => {
      if (!cancelled) setTasks(result.tasks);
    }).catch(() => undefined).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [page]);

  async function handleDelete(taskId: string) {
    if (!window.confirm("删除该任务及其本地图片、音频和草稿？")) return;
    await deleteTask(taskId);
    setTasks((current) => current.filter((task) => task.id !== taskId));
  }

  async function handleRename(task: TaskSummary) {
    const title = window.prompt("重命名任务", task.title || "未命名任务")?.trim();
    if (!title || title === task.title) return;
    const updated = await updateTask(task.id, { title });
    setTasks((current) => current.map((item) => item.id === task.id ? { ...item, title: updated.title, updatedAt: updated.updatedAt } : item));
  }

  function exportBatchSummary() {
    const summary = {
      exportedAt: new Date().toISOString(),
      view: page,
      filter: statusFilter,
      counts: visibleTasks.reduce<Record<string, number>>((counts, task) => {
        counts[task.status] = (counts[task.status] || 0) + 1;
        return counts;
      }, {}),
      totals: {
        tasks: visibleTasks.length,
        images: visibleTasks.reduce((sum, task) => sum + task.imageCount, 0),
        audio: visibleTasks.reduce((sum, task) => sum + task.audioCount, 0),
        drafts: visibleTasks.filter((task) => task.draftReady).length,
      },
      tasks: visibleTasks,
    };
    const url = URL.createObjectURL(new Blob([JSON.stringify(summary, null, 2)], { type: "application/json" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `storybound-${page}-summary-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="support-page">
      <header><span>Storybound 工作台</span><h1>{info.title}</h1><p>{info.description}</p><small>任务保存在服务端本地工作目录，不向页面暴露绝对路径。</small></header>
      <div className="support-features">{info.features.map((feature) => <span key={feature}>{feature}</span>)}</div>
      <div className="task-filter-toolbar">
        <div role="group" aria-label="任务状态筛选">
          {(["all", "draft", "pending", "running", "paused", "completed", "failed", "cancelled"] as const).map((status) => <button className={statusFilter === status ? "is-selected" : ""} key={status} onClick={() => setStatusFilter(status)} type="button">{status === "all" ? `全部 ${queueTasks.length}` : `${status} ${queueTasks.filter((task) => task.status === status).length}`}</button>)}
        </div>
        <label><span className="sr-only">搜索任务</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索标题、赛道或文案" /></label>
        <button className="task-summary-button" disabled={!visibleTasks.length} onClick={exportBatchSummary} type="button">导出批次摘要</button>
      </div>
      {page === "queue" && visibleTasks.length ? <div className="queue-toolbar"><div><strong>{activeQueue.length ? `正在串行处理 ${activeQueue.length} 项` : `队列中有 ${visibleTasks.length} 项`}</strong><span>失败项会保留错误记录，并自动继续下一项。</span></div><button type="button" disabled={Boolean(activeQueue.length)} onClick={() => onRunQueue?.(visibleTasks.map((task) => task.id).reverse())}>{activeQueue.length ? "队列执行中" : "串行执行全部"}</button></div> : null}
      <section className="task-list">{loading ? <div className="support-empty"><strong>正在读取本地任务…</strong></div> : visibleTasks.length === 0 ? <div className="support-empty"><strong>{page === "queue" ? "队列为空" : "没有匹配的任务"}</strong><p>任务会保存到本地目录，刷新和重启后仍可继续。</p><button onClick={() => onOpenTask(null)} type="button">新建图文任务</button></div> : visibleTasks.map((task) => <article key={task.id}><div><span className={`task-dot ${task.status}`} /><strong>{task.title || "未命名任务"}</strong></div><p>{task.mode === "auto" ? "全自动" : task.mode === "semi_auto" ? "半自动" : "直接出片"} · {task.status === "completed" ? `已完成 · ${task.imageCount} 图 / ${task.audioCount} 音频` : `Step ${Math.max(0, task.currentStep) + 1}/7 · ${task.status}`}</p><div><button onClick={() => onOpenTask(task.id)} type="button">{task.status === "completed" ? "打开产物" : "继续任务"}</button><button onClick={() => void handleRename(task)} type="button">重命名</button><button className="task-delete" onClick={() => void handleDelete(task.id)} type="button">删除</button></div></article>)}</section>
    </div>
  );
}
