import { useMemo, useState } from "react";

import { llmProviderOptions } from "../data/llm-data";
import { minimaxVoices, volcengineVoices } from "../data/tts-data";
import { cloneMinimaxVoice, fetchMinimaxVoices, testTts } from "../lib/tts-api";
import type { LlmConfig, LlmCredentialStatus, LlmProvider } from "../types/llm";
import type { MinimaxModel, TtsConfig, TtsCredentialStatus, TtsProvider, TtsVoice, VolcengineVersion } from "../types/tts";
import "./TtsPages.css";

interface TtsSettingsPageProps {
  config: TtsConfig;
  credentialStatus: TtsCredentialStatus;
  llmConfig: LlmConfig;
  llmCredentialStatus: LlmCredentialStatus;
  onChange: (config: TtsConfig) => void;
  onLlmChange: (config: LlmConfig) => void;
}

type RequestState = { kind: "idle" | "busy" | "success" | "error"; message: string };

export function TtsSettingsPage({ config, credentialStatus, llmConfig, llmCredentialStatus, onChange, onLlmChange }: TtsSettingsPageProps) {
  const [requestState, setRequestState] = useState<RequestState>({ kind: "idle", message: "" });
  const [showCloneForm, setShowCloneForm] = useState(false);
  const [cloneFile, setCloneFile] = useState<File | null>(null);
  const [cloneName, setCloneName] = useState("");
  const [cloneText, setCloneText] = useState("这是一段示例文本，用来测试克隆音色");

  const voices = useMemo(
    () => [...minimaxVoices, ...config.minimax.clonedVoices],
    [config.minimax.clonedVoices],
  );

  const setProvider = (provider: TtsProvider) => {
    setRequestState({ kind: "idle", message: "" });
    onChange({ ...config, provider });
  };
  const updateVolcengine = (patch: Partial<TtsConfig["volcengine"]>) =>
    onChange({ ...config, volcengine: { ...config.volcengine, ...patch } });
  const updateMinimax = (patch: Partial<TtsConfig["minimax"]>) =>
    onChange({ ...config, minimax: { ...config.minimax, ...patch } });
  const updateLlm = (patch: Partial<LlmConfig>) => onLlmChange({ ...llmConfig, ...patch });

  const setLlmProvider = (provider: LlmProvider) => {
    const preset = llmProviderOptions.find((option) => option.value === provider);
    onLlmChange({
      ...llmConfig,
      provider,
      baseUrl: preset?.baseUrl ?? llmConfig.baseUrl,
      model: preset?.model ?? llmConfig.model,
    });
  };

  const pickVolcengineVersion = (version: VolcengineVersion) => {
    const first = volcengineVoices.find((voice) => voice.version === version);
    updateVolcengine({ version, voiceId: first?.id ?? config.volcengine.voiceId });
  };

  const handleTest = async () => {
    const provider = config.provider;
    const voiceId = provider === "minimax" ? config.minimax.voiceId : config.volcengine.voiceId;
    setRequestState({ kind: "busy", message: "正在测试连接…" });
    try {
      const audio = await testTts({ provider, voiceId, speed: 1, config });
      const url = URL.createObjectURL(audio.blob);
      const player = new Audio(url);
      player.addEventListener("ended", () => URL.revokeObjectURL(url), { once: true });
      await player.play().catch(() => undefined);
      setRequestState({ kind: "success", message: `连接成功 · 返回 ${audio.segments} 段音频` });
    } catch (error) {
      setRequestState({ kind: "error", message: error instanceof Error ? error.message : "连接失败" });
    }
  };

  const handleSync = async () => {
    setRequestState({ kind: "busy", message: "正在从 MiniMax 同步克隆音色…" });
    try {
      const synced = await fetchMinimaxVoices(config.minimax.apiKey);
      const merged = new Map<string, TtsVoice>();
      for (const voice of [...config.minimax.clonedVoices, ...synced]) merged.set(voice.id, voice);
      updateMinimax({ clonedVoices: [...merged.values()] });
      setRequestState({ kind: "success", message: `同步完成 · ${synced.length} 个平台音色` });
    } catch (error) {
      setRequestState({ kind: "error", message: error instanceof Error ? error.message : "同步失败" });
    }
  };

  const handleClone = async () => {
    if (!cloneFile) {
      setRequestState({ kind: "error", message: "请选择约 8 秒的清晰人声音频" });
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

  return (
    <div className="tts-page tts-settings-page">
      <header className="tts-page-header">
        <div className="tts-heading-icon" aria-hidden="true">◖</div>
        <div><h1>系统设置</h1><p>LLM 文案链路 · TTS 配音 · 本地凭据</p></div>
        <span className="tts-memory-badge">仅当前会话保存</span>
      </header>

      <section className="tts-card">
        <label className="tts-label">LLM 引擎</label>
        <div className="tts-provider-grid tts-provider-grid--four">
          {llmProviderOptions.map((option) => (
            <button className={llmConfig.provider === option.value ? "selected" : ""} key={option.value} onClick={() => setLlmProvider(option.value)} type="button">
              <strong>{option.name}</strong>
              <span>{option.description}</span>
            </button>
          ))}
        </div>
        <p className="tts-help">用于文案预审、改写、分镜和绘图提示词。支持 OpenAI-compatible `/chat/completions` 接口。</p>
        <label className="tts-field">
          <span>API Key <small>{llmCredentialStatus.available ? `已从 ${llmCredentialStatus.source ?? "本机"} 安全读取` : "必填"}</small></span>
          <input type="password" value={llmConfig.apiKey} onChange={(event) => updateLlm({ apiKey: event.target.value })} placeholder={llmCredentialStatus.available ? "本地凭据已就绪；也可在此临时覆盖" : "粘贴 LLM API Key"} autoComplete="off" />
        </label>
        {llmCredentialStatus.available ? <div className="tts-local-credential"><span>✓</span><div><strong>本地 LLM 凭据可用</strong><small>{llmCredentialStatus.provider ?? llmConfig.provider} · {llmCredentialStatus.model ?? llmConfig.model} · 密钥不会传给页面</small></div></div> : null}
        <div className="tts-two-column">
          <label className="tts-field"><span>Base URL <small>OpenAI compatible</small></span><input value={llmConfig.baseUrl} onChange={(event) => updateLlm({ baseUrl: event.target.value })} placeholder="https://api.deepseek.com/v1" /></label>
          <label className="tts-field"><span>模型 <small>model</small></span><input value={llmConfig.model} onChange={(event) => updateLlm({ model: event.target.value })} placeholder="deepseek-chat" /></label>
        </div>
        <p className="tts-help">也可以新建 `C:\tmp\storybound-secrets.txt`：`STORYBOUND_LLM_API_KEY=...`，可选 `STORYBOUND_LLM_PROVIDER`、`STORYBOUND_LLM_BASE_URL`、`STORYBOUND_LLM_MODEL`。</p>
      </section>

      <section className="tts-card">
        <label className="tts-label">引擎</label>
        <div className="tts-provider-grid">
          <button className={config.provider === "volcengine" ? "selected" : ""} onClick={() => setProvider("volcengine")} type="button"><strong>火山引擎</strong><span>音色丰富 · 情感自然</span></button>
          <button className={config.provider === "minimax" ? "selected" : ""} onClick={() => setProvider("minimax")} type="button"><strong>MiniMax</strong><span>支持声音克隆</span></button>
        </div>
        <p className="tts-help">火山引擎按字符付费，MiniMax 支持声音克隆（克隆音色长时间未使用可能被平台清理）。凭据只保存在当前页面内存中。</p>

        {config.provider === "volcengine" ? (
          <>
            <label className="tts-field"><span>App ID <small>必填</small></span><input value={config.volcengine.appId} onChange={(event) => updateVolcengine({ appId: event.target.value })} placeholder="如 7628803180" /></label>
            <label className="tts-field"><span>Access Token <small>必填</small></span><input type="password" value={config.volcengine.accessToken} onChange={(event) => updateVolcengine({ accessToken: event.target.value })} placeholder="粘贴 Access Token" autoComplete="off" /></label>
            <label className="tts-label">默认配音员</label>
            <div className="tts-version-switch">
              <button className={config.volcengine.version === "2.0" ? "selected" : ""} onClick={() => pickVolcengineVersion("2.0")} type="button"><strong>语音合成 2.0</strong><span>¥2.8/万字 · 更自然</span></button>
              <button className={config.volcengine.version === "1.0" ? "selected" : ""} onClick={() => pickVolcengineVersion("1.0")} type="button"><strong>语音合成 1.0</strong><span>¥4.5/万字</span></button>
            </div>
            <VoiceCards voices={volcengineVoices.filter((voice) => voice.version === config.volcengine.version)} value={config.volcengine.voiceId} onChange={(voiceId) => updateVolcengine({ voiceId })} />
          </>
        ) : (
          <>
            <label className="tts-field"><span>API Key <small>{credentialStatus.minimax.available ? `已从 ${credentialStatus.minimax.source ?? "本机"} 安全读取` : "必填"}</small></span><input type="password" value={config.minimax.apiKey} onChange={(event) => updateMinimax({ apiKey: event.target.value })} placeholder={credentialStatus.minimax.available ? "本地凭据已就绪；也可在此临时覆盖" : "粘贴 MiniMax API Key"} autoComplete="off" /></label>
            {credentialStatus.minimax.available ? <div className="tts-local-credential"><span>✓</span><div><strong>本地 MiniMax 凭据可用</strong><small>密钥只在本机服务端读取，不会传给页面，也不会写入项目。</small></div></div> : null}
            <label className="tts-label">模型</label>
            <div className="tts-version-switch">
              {(["speech-2.8-hd", "speech-2.8-turbo"] as MinimaxModel[]).map((model) => <button className={config.minimax.model === model ? "selected" : ""} key={model} onClick={() => updateMinimax({ model })} type="button"><strong>{model.endsWith("hd") ? "hd" : "turbo"}</strong><span>{model.endsWith("hd") ? "高保真 · ¥3.5/万字" : "性价比 · ¥2.0/万字"}</span></button>)}
            </div>
            <label className="tts-label">系统精选音色</label>
            <VoiceCards voices={voices} value={config.minimax.voiceId} onChange={(voiceId) => updateMinimax({ voiceId })} />
            <div className="tts-clone-actions">
              <strong>我的克隆音色</strong>
              <div><button type="button" onClick={() => setShowCloneForm((open) => !open)}>＋ 上传新克隆</button><button type="button" onClick={handleSync} disabled={requestState.kind === "busy"}>⟳ 从平台同步</button></div>
            </div>
            {showCloneForm ? (
              <div className="tts-clone-form">
                <label><span>约 8 秒清晰人声音频</span><input type="file" accept="audio/*" onChange={(event) => setCloneFile(event.target.files?.[0] ?? null)} /></label>
                <label><span>显示名称</span><input value={cloneName} onChange={(event) => setCloneName(event.target.value)} placeholder="我的音色" /></label>
                <label><span>测试文本</span><input value={cloneText} onChange={(event) => setCloneText(event.target.value)} /></label>
                <button className="tts-primary" disabled={requestState.kind === "busy" || !cloneFile} onClick={handleClone} type="button">开始克隆</button>
              </div>
            ) : null}
          </>
        )}

        <div className="tts-card-footer">
          <button className="tts-test-button" disabled={requestState.kind === "busy"} onClick={handleTest} type="button">⚡ {requestState.kind === "busy" ? "测试中…" : "测试 TTS 连接"}</button>
          {requestState.message ? <span className={`tts-status ${requestState.kind}`}>{requestState.message}</span> : null}
        </div>
      </section>
    </div>
  );
}

function VoiceCards({ voices, value, onChange }: { voices: TtsVoice[]; value: string; onChange: (voiceId: string) => void }) {
  return <div className="tts-voice-grid">{voices.map((voice) => <button className={voice.id === value ? "selected" : ""} key={voice.id} onClick={() => onChange(voice.id)} type="button"><strong>{voice.name}</strong><span>{voice.tag}</span>{voice.cloned ? <em>克隆</em> : null}</button>)}</div>;
}
