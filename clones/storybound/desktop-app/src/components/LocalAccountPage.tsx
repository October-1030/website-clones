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
  state: "loading" | "ready" | "error";
  taskCount: number;
  storageStatus: string;
}

const accountFaq = [
  ["账户邮箱是做什么的？", "原版用邮箱同步积分、订单和设备。本独立版不连接原版账户服务，也不会接收邮箱验证码。"],
  ["一个邮箱能绑定几台设备？", "原版月卡 / 年卡最多 2 台，永久版最多 3 台；本独立版不校验或绕过这些设备上限。"],
  ["解绑邮箱会清空积分吗？", "原版积分保存在其服务端，解绑后仍归原邮箱。本独立版没有原版积分余额。"],
  ["激活码与邮箱是一回事吗？", "不是。原版激活码解锁 7 步流水线，邮箱负责积分与订单归集；本独立版将这两类私有服务都明确隔离。"],
];

const activationFaq = [
  ["激活码能绑定几台设备？", "原版月卡 / 年卡可绑定 2 台，永久版可绑定 3 台。独立版不会调用或模拟原版设备授权接口。"],
  ["多台设备会增加每月创作次数吗？", "不会。原版创作次数是邮箱级共享池，多设备共用；独立版仅展示这一规则，不生成虚假额度。"],
  ["账户邮箱必须绑定吗？", "原版软件内购买、积分同步和订单归集需要绑定邮箱。独立版不会收集邮箱或创建原版订单。"],
  ["激活后会赠送积分吗？", "该福利由原版服务端判定和发放。独立版不会显示或发放虚假积分。"],
  ["续费或升级会更换激活码吗？", "原版软件内续费通常沿用原激活码与设备绑定；独立版不参与续费或升级。"],
  ["可以更换账户邮箱吗？", "原版一张激活码通常只归属一个邮箱，变更需联系原版客服。"],
  ["换电脑怎么办？", "原版需要先解除旧设备激活，再从账号管理移除旧设备，然后在新电脑输入同一激活码。"],
  ["过期后还能使用吗？", "原版允许查看历史与设置，但不能新建任务；独立版的本地工作流与原版订阅状态分离。"],
  ["需要联网吗？", "LLM、AI 生图和 TTS 都依赖在线 API；本地任务浏览和部分草稿操作可在本机完成。"],
  ["重装系统后激活码还有效吗？", "原版可能把重装后的硬件指纹视为新设备，需要先释放旧设备名额。"],
];

export function LocalAccountPage({ kind, llmStatus, ttsStatus, onOpenSettings }: LocalAccountPageProps) {
  const [summary, setSummary] = useState<LocalSummary>({
    state: "loading",
    taskCount: 0,
    storageStatus: "正在读取本地任务服务…",
  });
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let active = true;
    void listTasks()
      .then((result) => {
        if (!active) return;
        setSummary({ state: "ready", taskCount: result.tasks.length, storageStatus: "本地持久化已就绪" });
      })
      .catch(() => {
        if (!active) return;
        setSummary({ state: "error", taskCount: 0, storageStatus: "本地任务服务暂不可用" });
      });
    return () => { active = false; };
  }, []);

  const minimaxReady = ttsStatus.minimax.available;
  const volcengineReady = ttsStatus.volcengine.available;
  const configuredApiCount = Number(llmStatus.available) + Number(minimaxReady) + Number(volcengineReady);

  async function downloadSummary() {
    const payload = {
      edition: "Storybound v1.17.0 独立复刻版",
      exportedAt: new Date().toISOString(),
      capabilities: {
        llm: llmStatus.available,
        minimaxTts: minimaxReady,
        volcengineTts: volcengineReady,
      },
      taskCount: summary.taskCount,
      storageStatus: summary.storageStatus,
      originalAccountService: "not-connected",
      originalLicenseService: "not-connected",
    };
    const url = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "storybound-local-status.json";
    link.click();
    URL.revokeObjectURL(url);
  }

  async function copySafetySummary() {
    try {
      await navigator.clipboard.writeText("Storybound v1.17.0 独立复刻版：原版账户、支付与许可证服务均未连接；本地 API 状态与任务数据独立运行；报告不含密钥。");
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  }

  if (kind === "activation") {
    return (
      <main className="local-account local-activation-v17">
        <header className="local-page-head local-page-head--centered">
          <span className="local-page-badge" aria-hidden="true">⌁</span>
          <h1>激活 Storybound</h1>
          <p>输入激活码，或直接在线购买开通</p>
        </header>

        <section className="local-dependency-banner" role="status">
          <span>!</span>
          <div><strong>原版授权服务未连接</strong><small>独立复刻版不会验证、迁移、购买或伪造 Storybound 私有许可证。</small></div>
        </section>

        <section className="local-activation-key-card">
          <div className="local-activation-status"><span />尚未连接原版授权</div>
          <label><span>激活码</span><div><input disabled placeholder="SB-XXXX-XXXX-XXXX-XXXX" /><button disabled type="button">激活</button></div><small>该输入框仅复刻原版信息层级；独立版不收集或上传激活码。</small></label>
        </section>

        <section className="local-ready-hero">
          <div className="local-ready-hero__row">
            <span className="local-ready-hero__icon">✓</span>
            <div><strong>本地独立工作台 · 已就绪</strong><small>这不是原版许可证状态；本地流水线由你的自有 API 和本机服务驱动。</small></div>
            <button onClick={onOpenSettings} type="button">检查 API 设置</button>
          </div>
          <div className="local-ready-stats">
            <div><strong>7 / 7</strong><span>流水线步骤</span></div>
            <div><strong>{summary.state === "loading" ? "…" : summary.taskCount}</strong><span>本地任务</span></div>
            <div><strong>{configuredApiCount} / 3</strong><span>API 能力</span></div>
          </div>
        </section>

        <section className="local-plan-card">
          <header><strong>在线购买开通</strong><small>原版服务依赖 · 当前不可用</small></header>
          <div className="local-plan-grid">
            {[["月卡", "月度创作次数"], ["年卡", "年度订阅"], ["永久版", "永久授权"]].map(([name, detail]) => (
              <button disabled key={name} type="button"><strong>{name}</strong><span>{detail}</span><em>原版价格由服务端下发</em></button>
            ))}
          </div>
          <p>不会创建订单、二维码、付款或“激活成功”状态。</p>
        </section>

        <section className="local-machine-card">
          <header><strong>机器码（设备标识）</strong><small>这不是激活码</small></header>
          <div><input disabled value="浏览器模式不可读取硬件指纹" readOnly /><button disabled type="button">复制</button></div>
          <p>原版桌面端可读取硬件指纹用于设备授权；浏览器页面不会伪造一个机器码。</p>
        </section>

        <FaqList items={activationFaq} />
      </main>
    );
  }

  return (
    <main className="local-account local-account-v17">
      <header className="local-page-head">
        <h1>账号管理</h1>
        <p>邮箱、积分余额与已绑设备</p>
      </header>

      <section className="local-dependency-banner" role="status">
        <span>!</span>
        <div><strong>原版账户与支付服务未连接</strong><small>下面保留 v1.17 原始信息层级，但不会发送验证码、扣积分、提现、迁移许可证或显示假余额。</small></div>
        <button onClick={copySafetySummary} type="button">{copied ? "已复制" : "复制说明"}</button>
      </section>

      <section className="local-account-card local-account-email-card">
        <header><span aria-hidden="true">@</span><strong>账户邮箱</strong><em>服务不可用</em></header>
        <div className="local-account-card__body">
          <p>原版绑定邮箱后可购买积分、使用全能绘图并跨设备同步余额；独立版不连接该私有服务。</p>
          <div className="local-email-row"><input disabled type="email" placeholder="your-email@example.com" /><button disabled type="button">发送验证码</button></div>
          <div className="local-account-state-strip" aria-label="原版账户状态说明">
            <span><i className="loading" />加载中</span><span><i className="empty" />未绑定</span><span><i className="ready" />已绑定</span><span><i className="error" />加载失败</span>
          </div>
          <small>这些是原版状态模型；当前固定为“服务不可用”，不会伪装成已绑定。</small>
        </div>
      </section>

      <section className="local-account-card local-capability-card">
        <header><span aria-hidden="true">S</span><strong>本地工作台</strong><em className={summary.state === "error" ? "is-error" : "is-ready"}>{summary.state === "loading" ? "加载中" : summary.state === "error" ? "有误" : "已就绪"}</em></header>
        <div className="local-account-card__body">
          <div className="local-capability-head"><div><strong>自有 API · 数据只保存在这台电脑</strong><small>本区与原版账户服务完全分离，绝不导出密钥。</small></div><button onClick={downloadSummary} type="button">导出状态摘要</button></div>
          <div className="local-account__grid">
            <CapabilityCard label="LLM" ready={llmStatus.available} detail={llmStatus.available ? `${llmStatus.provider || "自定义"} · ${llmStatus.model || "模型已连接"}` : "AI 改写、分镜和提示词暂不可用"} />
            <CapabilityCard label="MiniMax TTS" ready={minimaxReady} detail={minimaxReady ? "凭据由本机服务安全读取" : "前往系统设置接入自有凭据"} />
            <CapabilityCard label="火山 TTS" ready={volcengineReady} detail={volcengineReady ? "火山配音与云端 ASR 可用" : "可选 Provider，不影响 MiniMax"} />
            <CapabilityCard label="任务归档" ready={summary.state === "ready"} loading={summary.state === "loading"} detail={summary.storageStatus} value={summary.state === "loading" ? "…" : `${summary.taskCount} 个`} />
          </div>
          <button className="local-account__settings" onClick={onOpenSettings} type="button">打开系统设置</button>
        </div>
      </section>

      <section className="local-account-card">
        <header><span aria-hidden="true">＋</span><strong>次数加油包</strong><em>原版服务依赖</em></header>
        <div className="local-account-card__body">
          <div className="local-account-balance"><span>次数余额 <strong>—</strong></span><span>积分 <strong>—</strong></span></div>
          <p>原版可用积分兑换创作次数，购买次数不过期；独立版没有原版积分余额，不提供虚假购买结果。</p>
          <div className="local-pack-grid">{["体验包", "标准包", "进阶包", "批量包"].map((name) => <button disabled key={name} type="button"><strong>{name}</strong><small>服务端下发</small><em>不可用</em></button>)}</div>
        </div>
      </section>

      <section className="local-account-card">
        <header><span aria-hidden="true">↗</span><strong>我的邀请码</strong><em>原版服务依赖</em></header>
        <div className="local-account-card__body">
          <p>原版支持邀请奖励、佣金兑换积分、上传微信收款码和申请提现；独立版不创建邀请码，也不处理佣金或收款信息。</p>
          <div className="local-disabled-action-row"><input disabled value="未连接原版账户" readOnly /><button disabled type="button">复制邀请码</button><button disabled type="button">申请提现</button></div>
        </div>
      </section>

      <section className="local-account-card">
        <header><span aria-hidden="true">⌁</span><strong>我的激活码</strong><em>空状态</em></header>
        <div className="local-account-card__body local-empty-state"><span>⌁</span><strong>没有本地激活码记录</strong><p>独立版不会读取、同步或导出原版激活码。</p></div>
      </section>

      <FaqList title="关于账户与激活码" items={accountFaq} />
    </main>
  );
}

function CapabilityCard({
  label,
  ready,
  loading = false,
  detail,
  value,
}: {
  label: string;
  ready: boolean;
  loading?: boolean;
  detail: string;
  value?: string;
}) {
  return <article><span>{label}</span><strong className={ready ? "is-ready" : ""}>{value ?? (loading ? "加载中…" : ready ? "已配置" : "未配置")}</strong><p>{detail}</p></article>;
}

function FaqList({ title = "常见问题", items }: { title?: string; items: string[][] }) {
  return (
    <section className="local-faq">
      <h2>{title}</h2>
      <div>{items.map(([question, answer]) => <details key={question}><summary>{question}<span aria-hidden="true">⌄</span></summary><p>{answer}</p></details>)}</div>
    </section>
  );
}
