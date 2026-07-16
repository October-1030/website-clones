import { useEffect, useMemo, useState } from "react";
import { deleteTask, listTasks } from "../lib/task-api";
import type { AppPage } from "../types/app";
import type { TaskSummary } from "../types/task";
import "./SupportPage.css";

interface SupportPageProps {
  page: Exclude<AppPage, "create" | "image-task" | "html-video" | "music-mv">;
  onOpenTask: (taskId: string | null) => void;
  onRunQueue?: (taskIds: string[]) => void;
  activeQueue?: string[];
}

const pageInfo: Record<SupportPageProps["page"], { title: string; description: string; features: string[] }> = {
  queue: { title: "任务队列", description: "批量顺序执行、暂停当前条、跳过失败条目。", features: ["串行执行", "断点恢复", "批次摘要"] },
  history: { title: "历史任务", description: "查看任务产物、继续断点、重新打包或删除记录。", features: ["状态筛选", "继续创作", "打开产物"] },
  playground: { title: "画图实验室", description: "独立测试提示词、画面风格和图片 Provider。", features: ["多 Provider", "比例与分辨率", "历史对比"] },
  "voice-lab": { title: "配音实验室", description: "输入文本、选择音色与语速，一键生成 MP3。", features: ["豆包 TTS", "MiniMax", "声音克隆"] },
  "person-assets": { title: "人物素材库", description: "按人物整理真实照片，创作时直接铺入分镜。", features: ["拖拽排序", "粘贴导入", "真图分镜"] },
  "prompt-templates": { title: "提示词模板", description: "管理改写、分镜、封面和绘图规则。", features: ["赛道模板", "版本管理", "本地模板"] },
  "draft-templates": { title: "草稿模板", description: "管理剪映画布、字幕、标题、分栏和运镜布局。", features: ["比例联动", "布局编辑", "重新套用"] },
  "book-selection": { title: "选品助手", description: "当当畅销榜选书、AI 筛选和带货任务创建。", features: ["畅销榜", "豆瓣评分", "Excel 导出"] },
  benchmark: { title: "对标监控", description: "监控视频号作品、提取文案并拆解爆款结构。", features: ["账号监控", "ASR 转写", "AI 纠错"] },
  market: { title: "创作市场", description: "本地开源版使用本地提示词和画风模板。", features: ["本地安装", "模板导入", "版本管理"] },
  settings: { title: "系统设置", description: "配置 LLM、图片、TTS、语音识别和剪映目录。", features: ["Provider 配置", "本地凭据", "诊断报告"] },
  account: { title: "账号管理", description: "本地开源版不连接原产品账号和积分后台。", features: ["本地模式", "自有 API", "任务归档"] },
  activation: { title: "激活管理", description: "独立复刻版不会连接原产品授权系统。", features: ["本地开发版", "无原版绕过", "可接自有授权"] },
};

export function SupportPage({ page, onOpenTask, onRunQueue, activeQueue = [] }: SupportPageProps) {
  const info = pageInfo[page];
  const [tasks, setTasks] = useState<TaskSummary[]>([]);
  const [dataRoot, setDataRoot] = useState("");
  const [loading, setLoading] = useState(page === "history" || page === "queue");
  const visibleTasks = useMemo(() => page === "queue" ? tasks.filter((task) => ["pending", "running", "paused", "failed", "cancelled"].includes(task.status)) : tasks, [page, tasks]);

  useEffect(() => {
    let cancelled = false;
    if (page !== "history" && page !== "queue") return;
    setLoading(true);
    void listTasks().then((result) => {
      if (!cancelled) { setTasks(result.tasks); setDataRoot(result.dataRoot); }
    }).catch(() => undefined).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [page]);

  async function handleDelete(taskId: string) {
    if (!window.confirm("删除该任务及其本地图片、音频和草稿？")) return;
    await deleteTask(taskId);
    setTasks((current) => current.filter((task) => task.id !== taskId));
  }

  return (
    <div className="support-page">
      <header><span>Storybound 工作台</span><h1>{info.title}</h1><p>{info.description}</p>{dataRoot ? <small>本地任务目录：{dataRoot}</small> : null}</header>
      <div className="support-features">{info.features.map((feature) => <span key={feature}>{feature}</span>)}</div>
      {page === "queue" && visibleTasks.length ? <div className="queue-toolbar"><div><strong>{activeQueue.length ? `正在串行处理 ${activeQueue.length} 项` : `队列中有 ${visibleTasks.length} 项`}</strong><span>失败项会保留错误记录，并自动继续下一项。</span></div><button type="button" disabled={Boolean(activeQueue.length)} onClick={() => onRunQueue?.(visibleTasks.map((task) => task.id).reverse())}>{activeQueue.length ? "队列执行中" : "串行执行全部"}</button></div> : null}
      {(page === "history" || page === "queue") ? <section className="task-list">{loading ? <div className="support-empty"><strong>正在读取本地任务…</strong></div> : visibleTasks.length === 0 ? <div className="support-empty"><strong>{page === "queue" ? "队列为空" : "还没有任务"}</strong><p>任务会保存到本地目录，刷新和重启后仍可继续。</p><button onClick={() => onOpenTask(null)} type="button">新建图文任务</button></div> : visibleTasks.map((task) => <article key={task.id}><div><span className={`task-dot ${task.status}`} /><strong>{task.title || "未命名任务"}</strong></div><p>{task.mode === "auto" ? "全自动" : task.mode === "semi_auto" ? "半自动" : "直接出片"} · {task.status === "completed" ? `已完成 · ${task.imageCount} 图 / ${task.audioCount} 音频` : `Step ${Math.max(0, task.currentStep) + 1}/7 · ${task.status}`}</p><div><button onClick={() => onOpenTask(task.id)} type="button">{task.status === "completed" ? "打开产物" : "继续任务"}</button><button className="task-delete" onClick={() => void handleDelete(task.id)} type="button">删除</button></div></article>)}</section> : <div className="support-empty"><strong>模块界面已保留</strong><p>当前完整版范围优先完成图文任务闭环；该外围工作台使用本地数据替换原版私有后台。</p></div>}
    </div>
  );
}
