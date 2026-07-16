import { useEffect, useMemo, useRef, useState } from "react";

import { minimaxVoices, speedPresets, volcengineVoices } from "../data/tts-data";
import { synthesizeTts } from "../lib/tts-api";
import type { TtsConfig, TtsCredentialStatus, TtsProvider, VoiceLabResult, VolcengineVersion } from "../types/tts";
import "./TtsPages.css";

interface VoiceLabPageProps {
  config: TtsConfig;
  credentialStatus: TtsCredentialStatus;
  onChange: (config: TtsConfig) => void;
  onOpenSettings: () => void;
}

const voicePreviewText = "这是当前音色的试听效果，用来确认声音风格和语速。";

export function VoiceLabPage({ config, credentialStatus, onChange, onOpenSettings }: VoiceLabPageProps) {
  const [text, setText] = useState("");
  const [speed, setSpeed] = useState(1);
  const [busy, setBusy] = useState(false);
  const [previewingVoiceId, setPreviewingVoiceId] = useState("");
  const [error, setError] = useState("");
  const [results, setResults] = useState<VoiceLabResult[]>([]);
  const urls = useRef<string[]>([]);
  const player = useRef<HTMLAudioElement | null>(null);

  useEffect(() => () => {
    for (const url of urls.current) URL.revokeObjectURL(url);
  }, []);

  const provider = config.provider;
  const availableVoices = useMemo(
    () => provider === "minimax"
      ? [...minimaxVoices, ...config.minimax.clonedVoices]
      : volcengineVoices.filter((voice) => voice.version === config.volcengine.version),
    [config.minimax.clonedVoices, config.volcengine.version, provider],
  );
  const voiceId = provider === "minimax" ? config.minimax.voiceId : config.volcengine.voiceId;
  const selectedVoice = availableVoices.find((voice) => voice.id === voiceId) ?? availableVoices[0];
  const hasCredentials = provider === "minimax"
    ? Boolean(config.minimax.apiKey.trim() || credentialStatus.minimax.available)
    : Boolean(
        (config.volcengine.appId.trim() && config.volcengine.accessToken.trim())
        || credentialStatus.volcengine.available,
      );

  const setProvider = (next: TtsProvider) => onChange({ ...config, provider: next });
  const setVersion = (version: VolcengineVersion) => {
    const first = volcengineVoices.find((voice) => voice.version === version);
    onChange({ ...config, volcengine: { ...config.volcengine, version, voiceId: first?.id ?? config.volcengine.voiceId } });
  };
  const setVoice = (nextVoiceId: string) => {
    if (provider === "minimax") onChange({ ...config, minimax: { ...config.minimax, voiceId: nextVoiceId } });
    else onChange({ ...config, volcengine: { ...config.volcengine, voiceId: nextVoiceId } });
  };

  const addResult = async (options: { voiceId: string; voiceName: string; sourceText: string; resultSpeed: number; prefix: string }) => {
    const audio = await synthesizeTts({
      provider,
      text: options.sourceText,
      voiceId: options.voiceId,
      speed: options.resultSpeed,
      config,
    });
    const audioUrl = URL.createObjectURL(audio.blob);
    urls.current.push(audioUrl);
    const timestamp = new Date();
    const stamp = `${timestamp.getFullYear()}${String(timestamp.getMonth() + 1).padStart(2, "0")}${String(timestamp.getDate()).padStart(2, "0")}-${String(timestamp.getHours()).padStart(2, "0")}${String(timestamp.getMinutes()).padStart(2, "0")}${String(timestamp.getSeconds()).padStart(2, "0")}`;
    setResults((items) => [{
      id: crypto.randomUUID(),
      fileName: `${options.prefix}_${options.voiceName}_${stamp}.mp3`,
      audioUrl,
      voiceName: options.voiceName,
      speed: options.resultSpeed,
      createdAt: timestamp.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" }),
      text: options.sourceText.trim(),
      segments: audio.segments,
      bytes: audio.blob.size,
    }, ...items]);
    player.current?.pause();
    player.current = new Audio(audioUrl);
    await player.current.play().catch(() => undefined);
  };

  const generate = async () => {
    if (!selectedVoice || busy || previewingVoiceId) return;
    setBusy(true);
    setError("");
    try {
      await addResult({
        voiceId: selectedVoice.id,
        voiceName: selectedVoice.name,
        sourceText: text.trim(),
        resultSpeed: speed,
        prefix: "配音",
      });
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "配音失败");
    } finally {
      setBusy(false);
    }
  };

  const previewVoice = async (voiceIdToPreview: string) => {
    const voice = availableVoices.find((item) => item.id === voiceIdToPreview);
    if (!voice || busy || previewingVoiceId) return;
    setVoice(voice.id);
    setPreviewingVoiceId(voice.id);
    setError("");
    try {
      await addResult({
        voiceId: voice.id,
        voiceName: voice.name,
        sourceText: voicePreviewText,
        resultSpeed: speed,
        prefix: "试听",
      });
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "试听失败");
    } finally {
      setPreviewingVoiceId("");
    }
  };

  const download = (result: VoiceLabResult) => {
    const anchor = document.createElement("a");
    anchor.href = result.audioUrl;
    anchor.download = result.fileName;
    anchor.click();
  };

  const removeResult = (result: VoiceLabResult) => {
    URL.revokeObjectURL(result.audioUrl);
    urls.current = urls.current.filter((url) => url !== result.audioUrl);
    setResults((items) => items.filter((item) => item.id !== result.id));
  };

  return (
    <div className="tts-page voice-lab-page">
      <header className="voice-lab-header"><h1>配音实验室</h1><p>输入文本 → 选音色和语速 → 一键生成 mp3。试音色、补配音都在这里，不走流水线、不写任务历史。</p></header>

      <section className="tts-card voice-lab-card">
        <label className="tts-field"><span>配音文本 <small>· {text.length} / 10000 字</small></span><textarea rows={5} value={text} onChange={(event) => setText(event.target.value.slice(0, 10000))} placeholder="粘贴或输入要配音的文本，比如一段开场白、一句旁白…" /></label>
        <div className="voice-text-tools"><button type="button" onClick={() => setText("真正重要的不是走得多快，而是每一步都走在自己的方向上。")}>填入示例</button><button type="button" disabled={!text} onClick={() => setText("")}>清空</button></div>

        <div className="voice-lab-row">
          <strong>配音员</strong>
          <div className="tts-inline-tabs"><button className={provider === "volcengine" ? "selected" : ""} onClick={() => setProvider("volcengine")} type="button">豆包</button><button className={provider === "minimax" ? "selected" : ""} onClick={() => setProvider("minimax")} type="button">MiniMax</button></div>
          {provider === "volcengine" ? <div className="tts-inline-tabs"><button className={config.volcengine.version === "2.0" ? "selected" : ""} onClick={() => setVersion("2.0")} type="button">2.0</button><button className={config.volcengine.version === "1.0" ? "selected" : ""} onClick={() => setVersion("1.0")} type="button">1.0</button></div> : null}
        </div>
        <div className="voice-chip-list">{availableVoices.map((voice) => <div className={`voice-chip${voice.id === selectedVoice?.id ? " selected" : ""}`} key={voice.id}><button className="voice-chip-select" onClick={() => setVoice(voice.id)} type="button"><span aria-hidden="true">⌁</span>{voice.name}{voice.version ? <em>{voice.version}</em> : null}</button><button className="voice-chip-preview" disabled={!hasCredentials || busy || Boolean(previewingVoiceId)} onClick={() => previewVoice(voice.id)} type="button">{previewingVoiceId === voice.id ? "试听中…" : "试听"}</button></div>)}<button className="more" onClick={onOpenSettings} type="button">更多音色…</button></div>

        <label className="tts-label">配音语速</label>
        <div className="speed-chip-list">{speedPresets.map((preset) => <button className={speed === preset.value ? "selected" : ""} key={preset.value} onClick={() => setSpeed(preset.value)} type="button"><span>{preset.label}</span><strong>{preset.value === 1 ? "1.0" : String(preset.value)}×</strong></button>)}</div>

        <div className="voice-lab-actions">
          <button className="tts-primary" disabled={!text.trim() || busy || !selectedVoice || !hasCredentials || Boolean(previewingVoiceId)} onClick={generate} type="button">♩ {busy ? "正在合成…" : "生成配音"}</button>
          <button className="tts-secondary" disabled={!selectedVoice || !hasCredentials || busy || Boolean(previewingVoiceId)} onClick={() => selectedVoice ? previewVoice(selectedVoice.id) : undefined} type="button">试听当前音色</button>
          <span>{hasCredentials ? `${provider === "minimax" && credentialStatus.minimax.source ? `已安全读取 ${credentialStatus.minimax.source} · ` : ""}使用自己的 TTS 凭据，不扣原软件积分` : "需要先在系统设置填写当前引擎凭据"}</span>
          {!hasCredentials ? <button className="tts-link-button" onClick={onOpenSettings} type="button">去配置 →</button> : null}
        </div>
        {error ? <div className="tts-error">配音失败：{error}</div> : null}
      </section>

      <section className="voice-results">
        <header><h2>本页音频 <span>· {results.length}</span></h2><p>这里只统计当前打开页面生成的试听和正式配音；刷新或切换页面后会重新开始计数。</p></header>
        {results.length === 0 ? <div className="voice-empty"><span aria-hidden="true">♩</span><p>还没有生成音频。可以先点“试听当前音色”，不需要填写文本。</p></div> : <div className="voice-result-list">{results.map((result) => <article key={result.id}><div className="voice-result-head"><div><strong>{result.fileName}</strong><span>{result.voiceName} · {result.speed}× · {result.createdAt} · {result.segments} 段 · {(result.bytes / 1024).toFixed(1)} KB</span></div><div className="voice-result-actions"><button onClick={() => download(result)} type="button">另存为</button><button onClick={() => removeResult(result)} type="button">删除</button></div></div><p title={result.text}>{result.text}</p><audio controls src={result.audioUrl} /></article>)}</div>}
      </section>
    </div>
  );
}
