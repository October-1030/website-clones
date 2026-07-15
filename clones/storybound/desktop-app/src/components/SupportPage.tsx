import { useMemo } from "react";
import type { AppPage, TaskDraft } from "../types/app";
import "./SupportPage.css";

interface SupportPageProps {
  page: Exclude<AppPage, "create" | "image-task" | "html-video" | "music-mv">;
  onOpenTask: () => void;
}

const pageInfo: Record<SupportPageProps["page"], { title: string; description: string; features: string[] }> = {
  queue: { title: "任务队列", description: "批量顺序执行、暂停当前条、跳过失败条目。", features: ["串行执行", "断点恢复", "批次摘要"] },
  history: { title: "历史任务", description: "查看任务产物、继续断点、重新打包或删除记录。", features: ["状态筛选", "继续创作", "打开产物"] },
  playground: { title: "画图实验室", description: "独立测试提示词、画面风格和图片 Provider。", features: ["多 Provider", "比例与分辨率", "历史对比"] },
  "voice-lab": { title: "配音实验室", description: "输入文本、选择音色与语速，一键生成 MP3。", features: ["豆包 TTS", "MiniMax", "声音克隆"] },
  "person-assets": { title: "人物素材库", description: "按人物整理真实照片，创作时直接铺入分镜。", features: ["拖拽排序", "粘贴导入", "真图分镜"] },
  "prompt-templates": { title: "提示词模板", description: "管理改写、分镜、封面和绘图规则。", features: ["赛道模板", "版本管理", "市场安装"] },
  "draft-templates": { title: "草稿模板", description: "管理剪映画布、字幕、标题、分栏和运镜布局。", features: ["比例联动", "布局编辑", "重新套用"] },
  "book-selection": { title: "选品助手", description: "当当畅销榜选书、AI 筛选和带货任务创建。", features: ["畅销榜", "豆瓣评分", "Excel 导出"] },
  benchmark: { title: "对标监控", description: "监控视频号作品、提取文案并拆解爆款结构。", features: ["账号监控", "ASR 转写", "AI 纠错"] },
  market: { title: "创作市场", description: "购买、试用或上架提示词模板和画面风格。", features: ["免费试用", "模板交易", "版本更新"] },
  settings: { title: "系统设置", description: "配置 LLM、图片、TTS、语音识别和剪映目录。", features: ["Provider 配置", "系统钥匙串", "诊断报告"] },
  account: { title: "账号管理", description: "绑定邮箱、同步创作额度和设备状态。", features: ["邮箱绑定", "设备管理", "积分记录"] },
  activation: { title: "激活管理", description: "独立复刻版不会连接原产品授权系统。", features: ["本地开发版", "无原版绕过", "可接自有授权"] },
};

export function SupportPage({ page, onOpenTask }: SupportPageProps) {
  const info = pageInfo[page];
  const tasks = useMemo<TaskDraft[]>(() => {
    if (page !== "history" && page !== "queue") return [];
    try {
      return JSON.parse(localStorage.getItem("storybound_clone_tasks") ?? "[]") as TaskDraft[];
    } catch {
      return [];
    }
  }, [page]);

  return (
    <div className="support-page">
      <header><span>Storybound 工作台</span><h1>{info.title}</h1><p>{info.description}</p></header>
      <div className="support-features">{info.features.map((feature) => <span key={feature}>{feature}</span>)}</div>
      {(page === "history" || page === "queue") ? (
        <section className="task-list">
          {tasks.length === 0 ? <div className="support-empty"><strong>还没有任务</strong><p>先去新建任务，保存的草稿和运行演示会出现在这里。</p><button onClick={onOpenTask} type="button">新建图文任务</button></div> : tasks.map((task) => <article key={task.id}><div><span className={`task-dot ${task.status}`} /><strong>{task.title || "未命名任务"}</strong></div><p>{task.mode === "auto" ? "全自动" : task.mode === "semi_auto" ? "半自动" : "直接出片"} · {task.status === "completed" ? "已完成" : `Step ${task.currentStep + 1}/7`}</p><button onClick={onOpenTask} type="button">打开任务</button></article>)}
        </section>
      ) : <div className="support-empty"><strong>模块结构已复刻</strong><p>当前里程碑先完成产品壳和核心 7 步流水线；这个模块会在下一阶段接入真实本地数据。</p></div>}
    </div>
  );
}
