import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import { llmProviderOptions } from "../data/llm-data";
import { minimaxVoices, volcengineVoices } from "../data/tts-data";
import {
  readImageProviderConfig,
  writeImageProviderConfig,
  type ImageProviderConfig,
  type ImageProviderId,
} from "../lib/image-provider-store";
import { runLlmPipelineStep } from "../lib/llm-api";
import { cloneMinimaxVoice, fetchMinimaxVoices, synthesizeTts, testTts } from "../lib/tts-api";
import type { LlmConfig, LlmCredentialStatus, LlmProvider } from "../types/llm";
import type {
  MinimaxModel,
  TtsConfig,
  TtsCredentialStatus,
  TtsProvider,
  TtsVoice,
  VolcengineVersion,
} from "../types/tts";
import "./TtsPages.css";

interface TtsSettingsPageProps {
  config: TtsConfig;
  credentialStatus: TtsCredentialStatus;
  llmConfig: LlmConfig;
  llmCredentialStatus: LlmCredentialStatus;
  onChange: (config: TtsConfig) => void;
  onLlmChange: (config: LlmConfig) => void;
}

type SettingsSectionId = "llm" | "image" | "tts" | "asr" | "draft" | "license" | "ai-creation" | "about";
type ImageSettingsProvider = "jimeng" | "gpt_image" | "runninghub" | "modelscope" | "custom";
type StatusKind = "ok" | "fail" | "filled" | "empty" | "unavailable";
type RequestState = {
  kind: "idle" | "busy" | "success" | "error" | "unavailable";
  message: string;
};

const settingsSections: Array<{
  id: SettingsSectionId;
  icon: string;
  name: string;
  sub: string;
}> = [
  { id: "llm", icon: "✦", name: "LLM", sub: "文案与分镜" },
  { id: "image", icon: "◇", name: "AI 绘图", sub: "分镜图片" },
  { id: "tts", icon: "◖", name: "TTS 配音", sub: "每镜语音" },
  { id: "asr", icon: "≋", name: "语音识别", sub: "歌词 · 字幕对齐" },
  { id: "draft", icon: "▱", name: "剪映", sub: "草稿目录 · BGM" },
  { id: "license", icon: "⌁", name: "激活与订阅", sub: "试用 · 激活码" },
  { id: "ai-creation", icon: "✧", name: "AI 创作", sub: "IMA 知识库" },
  { id: "about", icon: "ⓘ", name: "关于 · 诊断", sub: "日志 · 重置" },
];

const imageProviders: Array<{ id: ImageSettingsProvider; name: string }> = [
  { id: "jimeng", name: "即梦" },
  { id: "gpt_image", name: "全能绘图" },
  { id: "runninghub", name: "RunningHub" },
  { id: "modelscope", name: "魔搭社区" },
  { id: "custom", name: "自定义平台" },
];

const speedOptions = [0.8, 0.9, 1, 1.1, 1.2];

export function TtsSettingsPage({
  config,
  credentialStatus,
  llmConfig,
  llmCredentialStatus,
  onChange,
  onLlmChange,
}: TtsSettingsPageProps) {
  const [activeSection, setActiveSection] = useState<SettingsSectionId>("llm");
  const [activeImageProvider, setActiveImageProvider] = useState<ImageSettingsProvider>(() => {
    const saved = readImageProviderConfig();
    return saved.provider === "openai-compatible" ? "custom" : "gpt_image";
  });
  const [requestState, setRequestState] = useState<RequestState>({ kind: "idle", message: "" });
  const [llmTestState, setLlmTestState] = useState<RequestState>({ kind: "idle", message: "" });
  const [imageTestState, setImageTestState] = useState<RequestState>({ kind: "idle", message: "" });
  const [showCloneForm, setShowCloneForm] = useState(false);
  const [showVoiceCatalog, setShowVoiceCatalog] = useState(false);
  const [voiceSearch, setVoiceSearch] = useState("");
  const [previewingVoiceId, setPreviewingVoiceId] = useState("");
  const [voicePreview, setVoicePreview] = useState<{ name: string; url: string } | null>(null);
  const [voicePreviewPlayback, setVoicePreviewPlayback] = useState<"ready" | "playing" | "ended">("ready");
  const voicePreviewAudioRef = useRef<HTMLAudioElement | null>(null);
  const [cloneFile, setCloneFile] = useState<File | null>(null);
  const [cloneName, setCloneName] = useState("");
  const [cloneText, setCloneText] = useState("这是一段示例文本，用来测试克隆音色。");
  const [imageConfig, setImageConfig] = useState(readImageProviderConfig);
  const [ttsSpeed, setTtsSpeed] = useState(1);
  const [asrProvider, setAsrProvider] = useState<"local" | "volcengine">("local");
  const [diagnosticMessage, setDiagnosticMessage] = useState("");

  const systemVoices = useMemo(() => config.minimax.systemVoices ?? [], [config.minimax.systemVoices]);
  const filteredSystemVoices = useMemo(() => {
    const query = voiceSearch.trim().toLocaleLowerCase();
    if (!query) return systemVoices;
    return systemVoices.filter((voice) => `${voice.name} ${voice.tag} ${voice.id}`.toLocaleLowerCase().includes(query));
  }, [systemVoices, voiceSearch]);

  useEffect(() => () => {
    if (voicePreview?.url) URL.revokeObjectURL(voicePreview.url);
  }, [voicePreview?.url]);

  useEffect(() => {
    const player = voicePreviewAudioRef.current;
    if (!voicePreview || !player) return;
    player.currentTime = 0;
    void player.play()
      .then(() => setVoicePreviewPlayback("playing"))
      .catch(() => setVoicePreviewPlayback("ready"));
  }, [voicePreview]);

  const imageReady = credentialStatus.minimax.available || Boolean(config.minimax.apiKey.trim());
  const llmReady = llmCredentialStatus.available || Boolean(llmConfig.apiKey.trim());
  const ttsReady = config.provider === "minimax"
    ? credentialStatus.minimax.available || Boolean(config.minimax.apiKey.trim())
    : credentialStatus.volcengine.available || Boolean(config.volcengine.appId.trim() && config.volcengine.accessToken.trim());

  const sectionStatus: Record<SettingsSectionId, StatusKind> = {
    llm: llmReady ? (llmTestState.kind === "success" ? "ok" : "filled") : "empty",
    image: activeImageProvider === "gpt_image"
      ? (imageReady ? "ok" : "empty")
      : activeImageProvider === "custom"
        ? (imageConfig.custom.apiKey && imageConfig.custom.baseUrl && imageConfig.custom.model ? "filled" : "empty")
        : "unavailable",
    tts: ttsReady ? (requestState.kind === "success" ? "ok" : "filled") : "empty",
    asr: asrProvider === "volcengine" && credentialStatus.volcengine.available ? "ok" : "unavailable",
    draft: "unavailable",
    license: "unavailable",
    "ai-creation": "unavailable",
    about: "ok",
  };

  const setProvider = (provider: TtsProvider) => {
    setRequestState({ kind: "idle", message: "" });
    onChange({ ...config, provider });
  };

  const updateVolcengine = (patch: Partial<TtsConfig["volcengine"]>) =>
    onChange({ ...config, volcengine: { ...config.volcengine, ...patch } });

  const updateMinimax = (patch: Partial<TtsConfig["minimax"]>) =>
    onChange({ ...config, minimax: { ...config.minimax, ...patch } });

  const updateLlm = (patch: Partial<LlmConfig>) => onLlmChange({ ...llmConfig, ...patch });

  const updateImageConfig = (patch: Partial<ImageProviderConfig>) => {
    const next = {
      ...imageConfig,
      ...patch,
      custom: { ...imageConfig.custom, ...(patch.custom || {}) },
    };
    setImageConfig(next);
    writeImageProviderConfig(next);
  };

  const setImageProvider = (provider: ImageProviderId) => updateImageConfig({ provider });

  const selectImageProvider = (provider: ImageSettingsProvider) => {
    setActiveImageProvider(provider);
    setImageTestState({ kind: "idle", message: "" });
    if (provider === "gpt_image") setImageProvider("minimax");
    if (provider === "custom") setImageProvider("openai-compatible");
  };

  const setLlmProvider = (provider: LlmProvider) => {
    const preset = llmProviderOptions.find((option) => option.value === provider);
    onLlmChange({
      ...llmConfig,
      provider,
      baseUrl: preset?.baseUrl ?? llmConfig.baseUrl,
      model: preset?.model ?? llmConfig.model,
    });
    setLlmTestState({ kind: "idle", message: "" });
  };

  const pickVolcengineVersion = (version: VolcengineVersion) => {
    const first = volcengineVoices.find((voice) => voice.version === version);
    updateVolcengine({ version, voiceId: first?.id ?? config.volcengine.voiceId });
  };

  const handleLlmTest = async () => {
    setLlmTestState({ kind: "busy", message: "正在调用真实预审接口…" });
    try {
      await runLlmPipelineStep({
        step: "precheck",
        config: llmConfig,
        context: {
          title: "连接测试",
          inputText: "这是一段用于验证大模型连接的短文案。系统只检查接口、模型与凭据是否能够完成一次真实预审调用。",
          track: "人物故事",
          videoForm: "旁白视频",
          visualStyle: "现代电影",
          aspectRatio: "9:16",
        },
        artifacts: {},
      });
      setLlmTestState({ kind: "success", message: "连接成功 · 真实预审调用已返回" });
    } catch (error) {
      setLlmTestState({ kind: "error", message: error instanceof Error ? error.message : "连接失败" });
    }
  };

  const handleImageTest = () => {
    if (activeImageProvider === "gpt_image") {
      setImageTestState(imageReady
        ? { kind: "success", message: "本地服务已确认 MiniMax 凭据可用；实际出图请到画图实验室验证。" }
        : { kind: "error", message: "未检测到可用的 MiniMax 凭据。" });
      return;
    }
    if (activeImageProvider === "custom") {
      const configured = Boolean(
        imageConfig.custom.apiKey.trim()
        && imageConfig.custom.baseUrl.trim()
        && imageConfig.custom.model.trim(),
      );
      setImageTestState(configured
        ? { kind: "unavailable", message: "配置已填写，但设置页没有无扣费探测接口；请在画图实验室生成 1 张图做真实验证。" }
        : { kind: "error", message: "请先填写 Base URL、API Key 和模型。" });
      return;
    }
    setImageTestState({
      kind: "unavailable",
      message: "该分支依赖原版桌面端/Tauri 能力，独立版不会收集凭据或伪造连接成功。",
    });
  };

  const handleTest = async () => {
    const provider = config.provider;
    const voiceId = provider === "minimax" ? config.minimax.voiceId : config.volcengine.voiceId;
    setRequestState({ kind: "busy", message: "正在测试真实 TTS 连接…" });
    try {
      const audio = await testTts({ provider, voiceId, speed: ttsSpeed, config });
      const url = URL.createObjectURL(audio.blob);
      const player = new Audio(url);
      player.addEventListener("ended", () => URL.revokeObjectURL(url), { once: true });
      await player.play().catch(() => undefined);
      setRequestState({ kind: "success", message: `连接成功 · 返回 ${audio.segments} 段音频` });
    } catch (error) {
      setRequestState({ kind: "error", message: error instanceof Error ? error.message : "连接失败" });
    }
  };

  const handlePreviewVoice = async (voice: TtsVoice) => {
    setPreviewingVoiceId(voice.id);
    setVoicePreviewPlayback("ready");
    setRequestState({ kind: "busy", message: `正在生成“${voice.name}”短句试听…` });
    try {
      const audio = await synthesizeTts({
        provider: voice.provider,
        text: "你好，这是一段音色试听。",
        voiceId: voice.id,
        speed: ttsSpeed,
        config,
      });
      setVoicePreview({ name: voice.name, url: URL.createObjectURL(audio.blob) });
      setRequestState({ kind: "success", message: `试听已生成 · ${voice.name}` });
    } catch (error) {
      setRequestState({ kind: "error", message: error instanceof Error ? error.message : "试听生成失败" });
    } finally {
      setPreviewingVoiceId("");
    }
  };

  const replayVoicePreview = () => {
    const player = voicePreviewAudioRef.current;
    if (!player) return;
    player.currentTime = 0;
    void player.play()
      .then(() => setVoicePreviewPlayback("playing"))
      .catch(() => setVoicePreviewPlayback("ready"));
  };

  const handleSync = async () => {
    setRequestState({ kind: "busy", message: "正在读取 MiniMax 系统音色与账号克隆音色；不会上传本地文件…" });
    try {
      const [system, synced] = await Promise.all([
        fetchMinimaxVoices(config.minimax.apiKey, "system"),
        fetchMinimaxVoices(config.minimax.apiKey, "voice_cloning"),
      ]);
      const merged = new Map<string, TtsVoice>();
      for (const voice of [...config.minimax.clonedVoices, ...synced]) merged.set(voice.id, voice);
      updateMinimax({ systemVoices: system, clonedVoices: [...merged.values()] });
      setShowVoiceCatalog(true);
      setRequestState({ kind: "success", message: `已读取 ${system.length} 个系统音色 + ${synced.length} 个克隆音色 · 未上传本地文件` });
    } catch (error) {
      setRequestState({ kind: "error", message: error instanceof Error ? error.message : "读取平台音色失败" });
    }
  };

  const handleClone = async () => {
    if (!cloneFile) {
      setRequestState({ kind: "error", message: "请选择 10 秒至 5 分钟的清晰人声音频" });
      return;
    }
    setRequestState({ kind: "busy", message: "正在上传并克隆音色…" });
    try {
      const voice = await cloneMinimaxVoice(config, cloneFile, cloneName || "我的克隆音色", cloneText);
      updateMinimax({
        voiceId: voice.id,
        clonedVoices: [voice, ...config.minimax.clonedVoices.filter((item) => item.id !== voice.id)],
      });
      setShowCloneForm(false);
      setCloneFile(null);
      setCloneName("");
      setRequestState({ kind: "success", message: `克隆成功 · ${voice.name}` });
    } catch (error) {
      setRequestState({ kind: "error", message: error instanceof Error ? error.message : "克隆失败" });
    }
  };

  const copyDiagnosticReport = async () => {
    const report = [
      "Storybound v1.17.0 独立复刻版诊断",
      `LLM：${llmReady ? "已配置" : "待配置"}`,
      `AI 绘图：${imageReady ? "MiniMax 凭据可用" : "待配置"}`,
      `TTS：${ttsReady ? "已配置" : "待配置"}`,
      `语音识别：${asrProvider === "volcengine" && credentialStatus.volcengine.available ? "火山云端可用" : "桌面模型检测不可用"}`,
      "原版授权/支付：未连接",
    ].join("\n");
    try {
      await navigator.clipboard.writeText(report);
      setDiagnosticMessage("诊断报告已复制（不含任何密钥）");
    } catch {
      setDiagnosticMessage("浏览器拒绝剪贴板权限，请手动记录上方状态");
    }
  };

  return (
    <div className="settings-page-v17">
      <header className="settings-topbar-v17">
        <div>
          <h1>系统设置</h1>
          <p>配置 API 凭证与本地路径</p>
        </div>
        <span className="settings-save-state"><span />所有改动已保存</span>
      </header>

      <div className="settings-layout-v17">
        <nav className="settings-nav-v17" aria-label="设置分区">
          {settingsSections.map((section) => (
            <button
              className={activeSection === section.id ? "active" : ""}
              key={section.id}
              onClick={() => setActiveSection(section.id)}
              type="button"
            >
              <span className="settings-nav-icon" aria-hidden="true">{section.icon}</span>
              <span className="settings-nav-copy"><strong>{section.name}</strong><small>{section.sub}</small></span>
              <StatusPill status={sectionStatus[section.id]} compact />
            </button>
          ))}
        </nav>

        <div className="settings-content-v17">
          {activeSection === "llm" ? (
            <section className="settings-section-v17">
              <SectionHeader icon="✦" title="LLM 配置" sub="保存多个配置，创建任务时一键切换" status={sectionStatus.llm} />
              <div className="settings-profile-head">
                <span>已保存 <strong>1</strong> 个配置</span>
                <button className="tts-secondary" disabled title="当前独立版使用单一活动配置" type="button">＋ 新建配置</button>
              </div>
              <article className="settings-profile-row active">
                <span className="settings-profile-radio"><span /></span>
                <div><strong>{llmProviderOptions.find((item) => item.value === llmConfig.provider)?.name ?? "当前配置"}</strong><span>{llmConfig.model || "未选择模型"} · 使用中</span></div>
                <StatusPill status={llmReady ? (llmTestState.kind === "success" ? "ok" : "filled") : "empty"} />
              </article>
              <div className="tts-card settings-card-v17">
                <Field label="服务商" hint="必选">
                  <div className="tts-provider-grid tts-provider-grid--settings">
                    {llmProviderOptions.map((option) => (
                      <button className={llmConfig.provider === option.value ? "selected" : ""} key={option.value} onClick={() => setLlmProvider(option.value)} type="button">
                        <strong>{option.name}</strong><span>{option.description}</span>
                      </button>
                    ))}
                  </div>
                </Field>
                <Field label="协议" hint="必选" help="当前独立版服务端使用 OpenAI-compatible /chat/completions 协议。">
                  <select className="settings-input" disabled value="openai" onChange={() => undefined}><option value="openai">OpenAI 兼容 · /chat/completions</option></select>
                </Field>
                <Field label="API Key" hint={llmCredentialStatus.available ? `已从 ${llmCredentialStatus.source ?? "本机"} 安全读取` : "必填"} help="本机密钥只由服务端读取；页面不会显示服务端保存的值。">
                  <input className="settings-input" type="password" value={llmConfig.apiKey} onChange={(event) => updateLlm({ apiKey: event.target.value })} placeholder={llmCredentialStatus.available ? "本地凭据已就绪；可留空使用" : "粘贴 LLM API Key"} autoComplete="off" />
                </Field>
                {llmCredentialStatus.available ? <CredentialBanner title="本地 LLM 凭据可用" detail={`${llmCredentialStatus.provider ?? llmConfig.provider} · ${llmCredentialStatus.model ?? llmConfig.model} · 密钥未传给页面`} /> : null}
                <div className="tts-two-column">
                  <Field label="默认模型" hint="必填"><input className="settings-input" value={llmConfig.model} onChange={(event) => updateLlm({ model: event.target.value })} placeholder="MiniMax-M3" /></Field>
                  <Field label="Base URL" hint="可选"><input className="settings-input settings-mono" value={llmConfig.baseUrl} onChange={(event) => updateLlm({ baseUrl: event.target.value })} placeholder="https://api.minimaxi.com/v1" /></Field>
                </div>
                <Field label="代理 URL" hint="当前不可用" help="原版支持配置级代理；当前服务端尚未开放该字段，因此不保存一个无效地址。">
                  <input className="settings-input" disabled placeholder="http://127.0.0.1:7890" />
                </Field>
                <div className="tts-card-footer">
                  <button className="tts-test-button" disabled={llmTestState.kind === "busy" || !llmReady} onClick={handleLlmTest} type="button">{llmTestState.kind === "busy" ? "测试中…" : "测试 LLM 连接"}</button>
                  <InlineRequestState state={llmTestState} />
                </div>
              </div>
            </section>
          ) : null}

          {activeSection === "image" ? (
            <section className="settings-section-v17">
              <SectionHeader icon="◇" title="AI 绘图" sub={`分镜图片生成 · ${imageProviders.find((item) => item.id === activeImageProvider)?.name}`} status={sectionStatus.image} />
              <div className="image-provider-tabs-v17" role="tablist" aria-label="图片引擎">
                {imageProviders.map((provider) => (
                  <button aria-selected={activeImageProvider === provider.id} className={activeImageProvider === provider.id ? "active" : ""} key={provider.id} onClick={() => selectImageProvider(provider.id)} role="tab" type="button">
                    {provider.name}{activeImageProvider === provider.id ? <small>使用中</small> : null}
                  </button>
                ))}
              </div>
              {activeImageProvider === "gpt_image" ? (
                <div className="tts-card settings-card-v17">
                  <CredentialBanner title="独立版真实引擎 · MiniMax image-01" detail="沿用本机 MiniMax 凭据；不扣原版 Storybound 积分。" ready={imageReady} />
                  <Field label="画面比例" help="创建任务时选择的比例优先。"><select className="settings-input" defaultValue="9:16"><option>9:16</option><option>16:9</option><option>1:1</option><option>4:3</option></select></Field>
                  <div className="tts-two-column">
                    <Field label="模型"><input className="settings-input" readOnly value="image-01" /></Field>
                    <Field label="并发数" help="默认 3；过高可能触发限流。"><input className="settings-input" type="number" min={1} max={10} defaultValue={3} /></Field>
                  </div>
                  <Field label="代理地址" hint="服务端管理" help="页面不接收或导出代理凭据。"><input className="settings-input" disabled placeholder="未配置（直连）" /></Field>
                  <div className="tts-card-footer"><button className="tts-test-button" onClick={handleImageTest} type="button">检查图片凭据</button><InlineRequestState state={imageTestState} /></div>
                </div>
              ) : null}
              {activeImageProvider === "custom" ? (
                <div className="tts-card settings-card-v17">
                  <p className="settings-provider-note">★ 原版永久会员分支支持任意 OpenAI-compatible 图片 API；独立版保留真实自有 API 路径。</p>
                  <Field label="显示名称" hint="可选"><input className="settings-input" placeholder="例如：我的 OpenAI 中转站" /></Field>
                  <Field label="Base URL" hint="必填" help="平台根地址或兼容 /v1 地址。"><input className="settings-input settings-mono" value={imageConfig.custom.baseUrl} onChange={(event) => updateImageConfig({ custom: { ...imageConfig.custom, baseUrl: event.target.value } })} placeholder="https://api.example.com/v1" /></Field>
                  <Field label="API Key" hint="仅当前会话"><input className="settings-input" type="password" autoComplete="off" value={imageConfig.custom.apiKey} onChange={(event) => updateImageConfig({ custom: { ...imageConfig.custom, apiKey: event.target.value } })} placeholder="粘贴图片 Provider API Key" /></Field>
                  <div className="tts-two-column">
                    <Field label="模型" hint="必填"><input className="settings-input" value={imageConfig.custom.model} onChange={(event) => updateImageConfig({ custom: { ...imageConfig.custom, model: event.target.value } })} placeholder="gpt-image-1" /></Field>
                    <Field label="协议模式"><select className="settings-input" defaultValue="sync"><option value="sync">同步</option><option value="async" disabled>异步 · 尚未接入</option></select></Field>
                  </div>
                  <div className="tts-two-column">
                    <Field label="分辨率"><select className="settings-input" defaultValue="1024x1024"><option>1024x1024</option><option>1024x1536</option><option>1536x1024</option></select></Field>
                    <Field label="并发数"><input className="settings-input" type="number" min={1} max={10} defaultValue={3} /></Field>
                  </div>
                  <div className="tts-card-footer"><button className="tts-test-button" onClick={handleImageTest} type="button">检查配置</button><InlineRequestState state={imageTestState} /></div>
                </div>
              ) : null}
              {activeImageProvider === "jimeng" ? (
                <UnavailableProviderCard title="即梦 AI" description="原版通过桌面端读取 Session ID，并可选择模型、比例、分辨率和 1–10 并发。浏览器独立版不收集 Cookie。" fields={["Session ID", "模型：即梦 4.0 / 3.0", "画面比例", "分辨率", "并发数"]} onCheck={handleImageTest} state={imageTestState} />
              ) : null}
              {activeImageProvider === "runninghub" ? (
                <UnavailableProviderCard title="RunningHub 国际站" description="原版 v1.17.0 使用 runninghub.ai 企业级共享 API Key，提供 X / V2 / G-2.0 模型、分辨率、并发和代理。独立版未接入其桌面端适配器。" fields={["企业级共享 API Key", "模型：X / V2 / G-2.0", "分辨率：1K / 2K / 4K", "并发数（建议 3–5）", "代理地址"]} onCheck={handleImageTest} state={imageTestState} />
              ) : null}
              {activeImageProvider === "modelscope" ? (
                <UnavailableProviderCard title="魔搭社区" description="原版使用 ModelScope Access Token，支持免费额度查询、模型选择、自定义模型和额度耗尽切换。独立版未接入其桌面端 Token 保管与额度接口。" fields={["Access Token", "文生图模型", "自定义模型", "并发数（建议 1）", "额度用完自动切换"]} onCheck={handleImageTest} state={imageTestState} />
              ) : null}
            </section>
          ) : null}

          {activeSection === "tts" ? (
            <section className="settings-section-v17">
              <SectionHeader icon="◖" title="TTS 配音" sub="每镜语音生成 · 多 provider 支持" status={sectionStatus.tts} />
              <div className="tts-card settings-card-v17">
                <Field label="引擎" help="火山引擎按字符付费；MiniMax 支持声音克隆。">
                  <div className="tts-provider-grid">
                    <button className={config.provider === "volcengine" ? "selected" : ""} onClick={() => setProvider("volcengine")} type="button"><strong>火山引擎</strong><span>音色丰富 · 情感自然</span></button>
                    <button className={config.provider === "minimax" ? "selected" : ""} onClick={() => setProvider("minimax")} type="button"><strong>MiniMax</strong><span>支持声音克隆</span></button>
                  </div>
                </Field>
                {config.provider === "volcengine" ? (
                  <>
                    <Field label="App ID" hint={credentialStatus.volcengine.available ? `已从 ${credentialStatus.volcengine.source ?? "本机"} 安全读取` : "必填"}><input className="settings-input" value={config.volcengine.appId} onChange={(event) => updateVolcengine({ appId: event.target.value })} placeholder="如 7628803180" /></Field>
                    <Field label="Access Token" hint="必填"><input className="settings-input" type="password" value={config.volcengine.accessToken} onChange={(event) => updateVolcengine({ accessToken: event.target.value })} placeholder={credentialStatus.volcengine.available ? "本地凭据已就绪；可留空使用" : "粘贴 Access Token"} autoComplete="off" /></Field>
                    <Field label="默认配音员" help="2.0 情感更自然；1.0 与 2.0 额度独立。">
                      <div className="tts-version-switch">
                        <button className={config.volcengine.version === "2.0" ? "selected" : ""} onClick={() => pickVolcengineVersion("2.0")} type="button"><strong>语音合成 2.0</strong><span>更省 · 情感自然</span></button>
                        <button className={config.volcengine.version === "1.0" ? "selected" : ""} onClick={() => pickVolcengineVersion("1.0")} type="button"><strong>语音合成 1.0</strong><span>经典音色</span></button>
                      </div>
                      <VoiceCards voices={volcengineVoices.filter((voice) => voice.version === config.volcengine.version)} value={config.volcengine.voiceId} onChange={(voiceId) => updateVolcengine({ voiceId })} onPreview={handlePreviewVoice} previewingVoiceId={previewingVoiceId} />
                    </Field>
                  </>
                ) : (
                  <>
                    <Field label="API Key" hint={credentialStatus.minimax.available ? `已从 ${credentialStatus.minimax.source ?? "本机"} 安全读取` : "必填"}>
                      <input className="settings-input" type="password" value={config.minimax.apiKey} onChange={(event) => updateMinimax({ apiKey: event.target.value })} placeholder={credentialStatus.minimax.available ? "本地凭据已就绪；可留空使用" : "粘贴 MiniMax API Key"} autoComplete="off" />
                    </Field>
                    {credentialStatus.minimax.available ? <CredentialBanner title="本地 MiniMax 凭据可用" detail="密钥只在本机服务端读取，不会显示在页面或诊断报告中。" /> : null}
                    <Field label="模型">
                      <div className="tts-version-switch">
                        {(["speech-2.8-hd", "speech-2.8-turbo"] as MinimaxModel[]).map((model) => (
                          <button className={config.minimax.model === model ? "selected" : ""} key={model} onClick={() => updateMinimax({ model })} type="button"><strong>{model.endsWith("hd") ? "HD" : "Turbo"}</strong><span>{model.endsWith("hd") ? "高保真" : "性价比"}</span></button>
                        ))}
                      </div>
                    </Field>
                    <Field label="系统精选音色" help="创建任务时会以此为默认；点击卡片选择，点击“试听”生成短句音频。"><VoiceCards voices={minimaxVoices} value={config.minimax.voiceId} onChange={(voiceId) => updateMinimax({ voiceId })} onPreview={handlePreviewVoice} previewingVoiceId={previewingVoiceId} /></Field>
                    <div className="tts-clone-actions">
                      <div className="tts-clone-heading">
                        <strong>MiniMax 完整系统音色库</strong>
                        <small>{systemVoices.length ? `已读取 ${systemVoices.length} 个系统音色，可按名称、标签或 voice ID 搜索；试听会调用一次短句 TTS。` : "同一 API 当前可返回完整系统音色列表；读取动作不会上传任何电脑文件。"}</small>
                      </div>
                      <div>
                        {systemVoices.length ? <button type="button" onClick={() => setShowVoiceCatalog((open) => !open)}>{showVoiceCatalog ? "收起音色库" : `浏览全部 ${systemVoices.length} 个`}</button> : null}
                        <button type="button" onClick={handleSync} disabled={requestState.kind === "busy"}>⟳ 读取平台全部音色</button>
                      </div>
                    </div>
                    {showVoiceCatalog && systemVoices.length ? (
                      <div className="tts-voice-library">
                        <div className="tts-voice-library-search">
                          <input value={voiceSearch} onChange={(event) => setVoiceSearch(event.target.value)} placeholder="搜索音色名称、标签或 voice ID" />
                          <span>{filteredSystemVoices.length} / {systemVoices.length}</span>
                        </div>
                        {filteredSystemVoices.length ? <VoiceCards voices={filteredSystemVoices} value={config.minimax.voiceId} onChange={(voiceId) => updateMinimax({ voiceId })} onPreview={handlePreviewVoice} previewingVoiceId={previewingVoiceId} /> : <p>没有匹配的 MiniMax 系统音色。</p>}
                      </div>
                    ) : null}
                    <div className="tts-clone-actions">
                      <div className="tts-clone-heading">
                        <strong>MiniMax 账号已有克隆音色</strong>
                        <small>“读取平台全部音色”只查询音色 ID，不会读取或上传电脑文件。</small>
                      </div>
                      <div><button type="button" onClick={() => setShowCloneForm((open) => !open)}>＋ 上传并创建新克隆</button></div>
                    </div>
                    {config.minimax.clonedVoices.length ? <VoiceCards voices={config.minimax.clonedVoices} value={config.minimax.voiceId} onChange={(voiceId) => updateMinimax({ voiceId })} onPreview={handlePreviewVoice} previewingVoiceId={previewingVoiceId} /> : <p className="tts-empty-voices">读取平台后，会在这里显示账号已有的克隆音色。</p>}
                    {showCloneForm ? (
                      <div className="tts-clone-form">
                        <label><span>10 秒至 5 分钟清晰人声</span><input type="file" accept="audio/mp3,audio/mp4,audio/wav,audio/x-m4a" onChange={(event) => setCloneFile(event.target.files?.[0] ?? null)} /></label>
                        <label><span>显示名称</span><input value={cloneName} onChange={(event) => setCloneName(event.target.value)} placeholder="我的音色" /></label>
                        <label><span>试听文本</span><input value={cloneText} onChange={(event) => setCloneText(event.target.value)} /></label>
                        <button className="tts-primary" disabled={requestState.kind === "busy" || !cloneFile} onClick={handleClone} type="button">开始克隆</button>
                      </div>
                    ) : null}
                  </>
                )}
                {voicePreview ? <div className="tts-voice-preview-player" aria-live="polite" data-testid="tts-voice-preview-player"><div className="tts-voice-preview-copy"><strong>试听 · {voicePreview.name}</strong><small>{voicePreviewPlayback === "playing" ? "正在播放" : voicePreviewPlayback === "ended" ? "播放结束，可重新试听" : "若浏览器未自动播放，请点“重新播放”"} · 短句试听按平台规则计费</small></div><audio ref={voicePreviewAudioRef} controls src={voicePreview.url} onEnded={() => setVoicePreviewPlayback("ended")} onPause={() => setVoicePreviewPlayback((state) => state === "ended" ? state : "ready")} onPlay={() => setVoicePreviewPlayback("playing")} /><button className="tts-voice-preview-replay" onClick={replayVoicePreview} type="button">重新播放</button><button aria-label="关闭试听播放器" className="tts-voice-preview-close" onClick={() => setVoicePreview(null)} type="button">×</button></div> : null}
                <Field label="测试语速" help="仅用于本页试听；创建任务仍以任务表单中选定的速度为准。">
                  <div className="settings-speed-grid">{speedOptions.map((speed) => <button className={ttsSpeed === speed ? "active" : ""} key={speed} onClick={() => setTtsSpeed(speed)} type="button">{speed.toFixed(1)}×</button>)}</div>
                </Field>
                <Field label="音频预处理" hint="桌面端能力" help="原版克隆流程支持自动降噪与音量归一化；当前浏览器链路未接入，以下开关不伪装生效。">
                  <div className="settings-toggle-list"><label><input disabled type="checkbox" />自动降噪 <small>不可用</small></label><label><input disabled type="checkbox" />音量归一化 <small>不可用</small></label></div>
                </Field>
                <div className="tts-card-footer">
                  <button className="tts-test-button" disabled={requestState.kind === "busy"} onClick={handleTest} type="button">{requestState.kind === "busy" ? "测试中…" : "测试 TTS 连接"}</button>
                  <InlineRequestState state={requestState} />
                </div>
              </div>
            </section>
          ) : null}

          {activeSection === "asr" ? (
            <section className="settings-section-v17">
              <SectionHeader icon="≋" title="语音识别" sub="歌词逐字对齐 / 字幕时间轴的识别引擎" status={sectionStatus.asr} />
              <div className="tts-provider-grid settings-provider-switch">
                <button className={asrProvider === "local" ? "selected" : ""} onClick={() => setAsrProvider("local")} type="button"><strong>本地识别</strong><span>免费 · 离线 · 占 CPU（SenseVoice）</span></button>
                <button className={asrProvider === "volcengine" ? "selected" : ""} onClick={() => setAsrProvider("volcengine")} type="button"><strong>云端识别（火山）</strong><span>付费 · 复用配音凭证</span></button>
              </div>
              <div className="tts-card settings-card-v17 settings-card-spaced">
                {asrProvider === "local" ? (
                  <>
                    <div className="settings-row-title"><strong>本地语音模型</strong><StatusPill status="unavailable" /></div>
                    <UnavailableBanner title="浏览器无法检测模型目录" detail="原版需要 model.int8.onnx、tokens.txt 等 SenseVoice 文件，并随任务存储路径放在 models/asr 下。" />
                    <Field label="模型目录"><input className="settings-input settings-mono" disabled value="任务存储路径\models\asr" readOnly /></Field>
                    <div className="settings-action-row"><button className="tts-secondary" disabled type="button">打开</button><button className="tts-secondary" disabled type="button">重新检测</button></div>
                  </>
                ) : (
                  <>
                    <CredentialBanner ready={credentialStatus.volcengine.available} title={credentialStatus.volcengine.available ? "火山语音识别凭据可复用" : "火山凭据未配置"} detail="原版要求在火山控制台开通录音文件识别 2.0 权限。" />
                    <p className="tts-help">云端识别复用「TTS 配音 → 火山引擎」的 App ID 与 Access Token。</p>
                  </>
                )}
              </div>
            </section>
          ) : null}

          {activeSection === "draft" ? (
            <section className="settings-section-v17">
              <SectionHeader icon="▱" title="剪映" sub="任务存储 · 草稿目录 · 背景音乐" status="unavailable" />
              <div className="tts-card settings-card-v17">
                <UnavailableBanner title="当前运行在浏览器模式" detail="原版用 Tauri 目录选择器、Sidecar 和本地扫描器写入剪映目录；页面不会假装已经验证磁盘。" />
                <Field label="任务存储路径" hint="桌面端"><div className="settings-path-row"><input className="settings-input settings-mono" disabled placeholder="留空 = 默认 AppData\Storybound\tasks" /><button className="tts-secondary" disabled type="button">浏览…</button></div></Field>
                <button className="tts-secondary settings-fit-button" disabled type="button">扫描已移动的任务</button>
                <Field label="剪映草稿目录" hint="必填"><div className="settings-path-row"><input className="settings-input settings-mono" disabled placeholder="…\JianyingPro\User Data\Projects\com.lveditor.draft" /><button className="tts-secondary" disabled type="button">浏览…</button></div></Field>
                <Field label="BGM 库" help="原版内置 1 首，并允许复制本地音乐到应用数据目录。">
                  <div className="settings-bgm-row"><span>♪</span><div><strong>默认背景音乐</strong><small>随应用内置</small></div><em>内置</em></div>
                </Field>
                <button className="tts-secondary settings-fit-button" disabled type="button">＋ 添加 BGM 文件</button>
              </div>
            </section>
          ) : null}

          {activeSection === "license" ? (
            <section className="settings-section-v17">
              <SectionHeader icon="⌁" title="激活与订阅" sub="查看订阅状态、解除绑定或输入激活码" status="unavailable" />
              <div className="settings-license-summary">
                <span className="settings-license-dot" />
                <div><strong>原版授权服务未连接</strong><small>独立复刻版不校验、不迁移、不绕过 Storybound 私有许可证。</small></div>
                <span>查看左侧「激活管理」</span>
              </div>
              <UnavailableBanner title="本地工作流与原版订阅分离" detail="你自己的 MiniMax、LLM 和本地任务状态在本应用内独立工作；这里不会显示虚假的试用天数、积分或订阅成功。" />
            </section>
          ) : null}

          {activeSection === "ai-creation" ? (
            <section className="settings-section-v17">
              <SectionHeader icon="✧" title="AI 创作 · IMA 知识库" sub="可选 · 在 AI 创作时作为参考素材源" status="unavailable" />
              <div className="tts-card settings-card-v17">
                <UnavailableBanner title="IMA 桌面适配器尚未接入" detail="原版可填写腾讯 IMA Client ID / API Key，测试并选择知识库与默认写入笔记本。独立版不收集不能使用的凭据。" />
                <Field label="Client ID" hint="不可用"><input className="settings-input" disabled placeholder="粘贴 Client ID" /></Field>
                <Field label="API Key" hint="不可用"><input className="settings-input" disabled type="password" placeholder="粘贴 API Key" /></Field>
                <button className="tts-secondary settings-fit-button" disabled type="button">测试连接 / 拉取知识库</button>
                <Field label="选择知识库"><select className="settings-input" disabled><option>未选择</option></select></Field>
                <Field label="默认写入笔记本"><select className="settings-input" disabled><option>未选择</option></select></Field>
              </div>
            </section>
          ) : null}

          {activeSection === "about" ? (
            <section className="settings-section-v17 settings-about-stack">
              <div>
                <SectionHeader icon="ⓘ" title="关于" sub="应用版本 · 运行时 · 本地数据目录" status="ok" />
                <div className="tts-card settings-card-v17">
                  <div className="settings-about-hero"><span>S</span><div><strong>Storybound</strong><small>v1.17.0 · 独立复刻版</small></div><button className="tts-secondary" disabled type="button">检查更新</button></div>
                  <div className="settings-diagnostic-grid"><div><small>应用版本</small><strong>v1.17.0</strong></div><div><small>通道</small><strong>local</strong></div><div><small>运行时</small><strong>Browser + Node</strong></div><div><small>本地数据</small><strong>由本机服务端管理</strong></div></div>
                </div>
              </div>
              <div>
                <SectionHeader icon="✓" title="诊断" sub="配置完整性 · 服务端连通性 · 安全边界" status="ok" />
                <div className="tts-card settings-card-v17">
                  <div className="settings-diagnostic-list">
                    <DiagnosticItem label="LLM 配置完整性" ok={llmReady} detail={llmReady ? `${llmCredentialStatus.provider ?? llmConfig.provider} · ${llmCredentialStatus.model ?? llmConfig.model}` : "缺少 API Key / Base URL / 模型"} />
                    <DiagnosticItem label="AI 绘图" ok={imageReady} detail={imageReady ? "MiniMax image-01 凭据可用" : "MiniMax 凭据未配置"} />
                    <DiagnosticItem label="TTS" ok={ttsReady} detail={ttsReady ? `${config.provider} · 默认音色已选` : "当前引擎凭据未配置"} />
                    <DiagnosticItem label="剪映草稿 Sidecar" ok={false} detail="浏览器模式不可检测" unavailable />
                    <DiagnosticItem label="原版账户与授权" ok={false} detail="主动隔离 · 未连接私有服务" unavailable />
                  </div>
                  <div className="tts-card-footer"><button className="tts-test-button" onClick={copyDiagnosticReport} type="button">复制诊断报告</button>{diagnosticMessage ? <span className="tts-status success">{diagnosticMessage}</span> : null}</div>
                </div>
              </div>
            </section>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function SectionHeader({ icon, title, sub, status }: { icon: string; title: string; sub: string; status: StatusKind }) {
  return <header className="settings-section-header-v17"><span aria-hidden="true">{icon}</span><div><h2>{title}</h2><p>{sub}</p></div><StatusPill status={status} /></header>;
}

function StatusPill({ status, compact = false }: { status: StatusKind; compact?: boolean }) {
  const label: Record<StatusKind, string> = { ok: "已配置", fail: "有误", filled: "未测试", empty: "待配置", unavailable: "不可用" };
  return <span className={`settings-status-pill ${status} ${compact ? "compact" : ""}`}><span />{compact ? "" : label[status]}<span className="sr-only">{compact ? label[status] : ""}</span></span>;
}

function Field({ label, hint, help, children }: { label: string; hint?: string; help?: string; children: ReactNode }) {
  return <label className="settings-field-v17"><span><strong>{label}</strong>{hint ? <small>{hint}</small> : null}</span>{children}{help ? <em>{help}</em> : null}</label>;
}

function CredentialBanner({ title, detail, ready = true }: { title: string; detail: string; ready?: boolean }) {
  return <div className={`settings-credential-banner ${ready ? "ready" : "missing"}`}><span aria-hidden="true">{ready ? "✓" : "!"}</span><div><strong>{title}</strong><small>{detail}</small></div></div>;
}

function UnavailableBanner({ title, detail }: { title: string; detail: string }) {
  return <div className="settings-unavailable-banner" role="status"><span aria-hidden="true">!</span><div><strong>{title}</strong><small>{detail}</small></div></div>;
}

function InlineRequestState({ state }: { state: RequestState }) {
  return state.message ? <span className={`tts-status ${state.kind}`}>{state.message}</span> : null;
}

function UnavailableProviderCard({
  title,
  description,
  fields,
  onCheck,
  state,
}: {
  title: string;
  description: string;
  fields: string[];
  onCheck: () => void;
  state: RequestState;
}) {
  return (
    <div className="tts-card settings-card-v17">
      <UnavailableBanner title={`${title} · 原版桌面服务依赖`} detail={description} />
      <div className="settings-disabled-fields">
        {fields.map((field) => <label key={field}><span>{field}</span><input className="settings-input" disabled placeholder="当前独立版不收集此凭据" /></label>)}
      </div>
      <div className="tts-card-footer"><button className="tts-test-button" onClick={onCheck} type="button">测试连接</button><InlineRequestState state={state} /></div>
    </div>
  );
}

function DiagnosticItem({ label, ok, detail, unavailable = false }: { label: string; ok: boolean; detail: string; unavailable?: boolean }) {
  return <div className="settings-diagnostic-item"><span className={unavailable ? "unavailable" : ok ? "ok" : "fail"}>{unavailable ? "–" : ok ? "✓" : "!"}</span><div><strong>{label}</strong><small>{detail}</small></div></div>;
}

function VoiceCards({ voices, value, onChange, onPreview, previewingVoiceId }: { voices: TtsVoice[]; value: string; onChange: (voiceId: string) => void; onPreview: (voice: TtsVoice) => void; previewingVoiceId: string }) {
  return <div className="tts-voice-grid">{voices.map((voice) => <div className={`tts-voice-card ${voice.id === value ? "selected" : ""}`} key={voice.id}><button className="tts-voice-select" onClick={() => onChange(voice.id)} type="button"><strong>{voice.name}</strong><span>{voice.tag}</span></button><button aria-label={`试听 ${voice.name}`} className="tts-voice-preview" disabled={Boolean(previewingVoiceId)} onClick={() => onPreview(voice)} type="button">{previewingVoiceId === voice.id ? "生成中" : "试听"}</button>{voice.cloned ? <em>克隆</em> : null}</div>)}</div>;
}
