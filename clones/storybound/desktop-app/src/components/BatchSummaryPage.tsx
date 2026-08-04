import { useEffect, useMemo, useState } from "react";

import { listTasks } from "../lib/task-api";
import type { TaskSummary } from "../types/task";
import "./BatchSummaryPage.css";

export interface LocalBatchRecord {
  id: string;
  taskIds: string[];
  outcomes: Record<string, "completed" | "failed" | "cancelled">;
  startedAt: string;
  endedAt?: string;
}

interface BatchSummaryPageProps {
  batchId: string | null;
  onBack: () => void;
  onOpenTask: (taskId: string) => void;
  onRunQueue: (taskIds: string[]) => void;
}

function readLastBatch(): LocalBatchRecord | null {
  try {
    const value = JSON.parse(window.localStorage.getItem("storybound-last-batch") || "null") as LocalBatchRecord | null;
    return value && Array.isArray(value.taskIds) ? value : null;
  } catch {
    return null;
  }
}

function formatDuration(record: LocalBatchRecord): string {
  const end = record.endedAt ? Date.parse(record.endedAt) : Date.now();
  const seconds = Math.max(0, Math.round((end - Date.parse(record.startedAt)) / 1000));
  const minutes = Math.floor(seconds / 60);
  return minutes ? `${minutes} 分 ${seconds % 60} 秒` : `${seconds} 秒`;
}

export function BatchSummaryPage({ batchId, onBack, onOpenTask, onRunQueue }: BatchSummaryPageProps) {
  const [record] = useState(readLastBatch);
  const [tasks, setTasks] = useState<TaskSummary[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    void listTasks()
      .then((result) => setTasks(result.tasks))
      .catch((reason: unknown) => setError(reason instanceof Error ? reason.message : String(reason)));
  }, []);

  const batchTasks = useMemo(() => {
    if (!record || (batchId && batchId !== record.id)) return [];
    const byId = new Map(tasks.map((task) => [task.id, task]));
    return record.taskIds.map((id) => byId.get(id)).filter((task): task is TaskSummary => Boolean(task));
  }, [batchId, record, tasks]);
  const counts = useMemo(() => batchTasks.reduce((summary, task) => {
    const outcome = record?.outcomes[task.id] || (task.status === "completed" ? "completed" : task.status === "cancelled" ? "cancelled" : task.status === "failed" ? "failed" : null);
    if (outcome) summary[outcome] += 1;
    return summary;
  }, { completed: 0, failed: 0, cancelled: 0 }), [batchTasks, record]);
  const retryIds = batchTasks.filter((task) => task.status === "failed" || task.status === "cancelled").map((task) => task.id);

  if (!record || (batchId && batchId !== record.id)) {
    return <main className="batch-summary-page"><section className="batch-summary-empty"><h1>批次数据不存在或已过期</h1><p>本地独立版只保留最近一次批次摘要。</p><button onClick={onBack} type="button">返回队列</button></section></main>;
  }

  return (
    <main className="batch-summary-page">
      <header className="batch-summary-hero">
        <div><span>批次完成</span><h1>{counts.failed || counts.cancelled ? `批次结束 · ${counts.failed + counts.cancelled} 个未完成` : "批次完成"}</h1><p>批次 {record.id.slice(0, 8)} · 总耗时 {formatDuration(record)}</p></div>
        <button onClick={onBack} type="button">返回队列</button>
      </header>
      <section className="batch-summary-stats" aria-label="批次统计">
        <article><span>总数</span><strong>{record.taskIds.length}</strong></article>
        <article className="is-success"><span>完成</span><strong>{counts.completed}</strong></article>
        <article className="is-danger"><span>失败</span><strong>{counts.failed}</strong></article>
        <article><span>已取消</span><strong>{counts.cancelled}</strong></article>
      </section>
      {error ? <div className="batch-summary-error">读取任务失败：{error}</div> : null}
      <section className="batch-summary-list">
        {batchTasks.map((task) => <article key={task.id}><div><span className={`batch-status-dot is-${task.status}`} /><div><strong>{task.title || "未命名草稿"}</strong><p>{task.track} · Step {Math.max(0, task.currentStep) + 1} · {task.status}</p></div></div><button onClick={() => onOpenTask(task.id)} type="button">查看任务详情</button></article>)}
      </section>
      {retryIds.length ? <section className="batch-summary-actions"><div><strong>还有 {retryIds.length} 条失败或取消</strong><p>重新加入本地队列时会从现有任务断点继续，不删除已生成产物。</p></div><button onClick={() => onRunQueue(retryIds)} type="button">全部加入队列（{retryIds.length}）</button></section> : null}
    </main>
  );
}
