import { useEffect, useState } from "react";

import { listTasks } from "../lib/task-api";
import type { LlmCredentialStatus } from "../types/llm";
import type { TtsCredentialStatus } from "../types/tts";
import "./LocalAccountPage.css";

interface LocalAccountPageProps {
  kind: "account" | "activation";
  llmStatus: LlmCredentialStatus;
  ttsStatus: TtsCredentialStatus;
  onOpenSettings: () => void;
}

interface LocalSummary {
  taskCount: number;
  storageStatus: string;
}

export function LocalAccountPage({ kind, llmStatus, ttsStatus, onOpenSettings }: LocalAccountPageProps) {
  const [summary, setSummary] = useState<LocalSummary>({ taskCount: 0, storageStatus: "正在读取…" });

  useEffect(() => {
    void listTasks().then((result) => setSummary({ taskCount: result.tasks.length, storageStatus: "本地持久化已就绪" })).catch(() => setSummary({ taskCount: 0, storageStatus: "本地任务服务暂不可用" }));
  }, []);

  const minimaxReady = ttsStatus.minimax.available;
  const volcengineReady = ttsStatus.volcengine.available;

  function downloadSummary() {
    const payload = {
      edition: "Storybound 独立复刻版",
      exportedAt: new Date().toISOString(),
      capabilities: {
        llm: llmStatus.available,
        minimaxTts: minimaxReady,
        volcengineTts: volcengineReady,
      },
      taskCount: summary.taskCount,
      storageStatus: summary.storageStatus,
    };
    const url = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "storybound-local-status.json";
    link.click();
    URL.revokeObjectURL(url);
  }

  if (kind === "activation") {
    return (
      <main className="local-account">
        <header><span>本地授权</span><h1>激活管理</h1><p>独立复刻版不连接原产品的试用、积分和激活码后台，也不接受原版激活码。</p></header>
        <section className="activation-card"><div className="activation-card__mark">✓</div><div><span>当前版本</span><h2>本地独立版 · 已就绪</h2><p>七步图文流水线、剪映草稿打包和本地工作台不受试用次数限制；实际 AI 调用由你自己的凭据承担。</p></div><button onClick={onOpenSettings} type="button">检查 API 设置</button></section>
        <section className="local-account__grid"><article><span>流水线</span><strong>7 / 7 步</strong><p>预审、改写、分镜、提示词、出图、配音和草稿打包。</p></article><article><span>本地任务</span><strong>{summary.taskCount}</strong><p>{summary.storageStatus}</p></article><article><span>原版授权</span><strong>未连接</strong><p>不会校验、迁移或绕过原产品的许可证。</p></article></section>
      </main>
    );
  }

  return (
    <main className="local-account">
      <header><span>本地身份</span><h1>账号管理</h1><p>查看自有 API、本地任务归档与数据路径。这里不会显示、上传或导出你的密钥。</p></header>
      <section className="local-profile"><div className="local-profile__avatar">S</div><div><span>当前账户</span><h2>本地模式</h2><p>自有 API · 数据只保存在这台电脑</p></div><button onClick={downloadSummary} type="button">导出状态摘要</button></section>
      <section className="local-account__grid"><article><span>LLM</span><strong className={llmStatus.available ? "is-ready" : ""}>{llmStatus.available ? "已配置" : "未配置"}</strong><p>{llmStatus.available ? `${llmStatus.provider || "自定义"} · ${llmStatus.model || "模型已连接"}` : "AI 改写、分镜和提示词功能暂不可用。"}</p></article><article><span>MiniMax TTS</span><strong className={minimaxReady ? "is-ready" : ""}>{minimaxReady ? "已配置" : "未配置"}</strong><p>{minimaxReady ? "凭据由本机服务安全读取。" : "前往系统设置接入自有凭据。"}</p></article><article><span>火山 TTS</span><strong className={volcengineReady ? "is-ready" : ""}>{volcengineReady ? "已配置" : "未配置"}</strong><p>{volcengineReady ? "火山引擎配音可用。" : "这是可选 Provider，不影响 MiniMax。"}</p></article><article><span>任务归档</span><strong>{summary.taskCount} 个</strong><p>{summary.storageStatus}</p></article></section>
      <button className="local-account__settings" onClick={onOpenSettings} type="button">打开系统设置</button>
    </main>
  );
}
