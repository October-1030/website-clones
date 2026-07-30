import { useEffect, useMemo, useRef, useState } from "react";
import { defaultLlmConfig } from "../data/llm-data";
import { defaultTtsConfig } from "../data/tts-data";
import { generateMinimaxImages } from "../lib/image-api";
import { runLlmPipelineStep } from "../lib/llm-api";
import {
  cancelMediaJob,
  createMediaJob,
  getMediaJob,
  listMediaJobs,
  renderMediaJob,
  updateMediaJob,
  uploadMediaAsset,
} from "../lib/media-workbench-api";
import { synthesizeTts } from "../lib/tts-api";
import type { LlmConfig, PipelineContext, PipelineLlmArtifacts } from "../types/llm";
import {
  htmlAnimationLabels,
  htmlLayoutLabels,
  htmlSubtitleStyleLabels,
  type HtmlAnimationPreset,
  type HtmlLayoutPreset,
  type HtmlSubtitleStyle,
  type HtmlVideoJob,
  type HtmlVideoManifest,
  type HtmlVideoScene,
  type MediaWorkbenchAsset,
  type MediaWorkbenchJobSummary,
} from "../types/media-workbench";
import type { TtsConfig } from "../types/tts";
import "./HtmlVideoPage.css";

interface HtmlVideoPageProps {
  llmConfig?: LlmConfig;
  ttsConfig?: TtsConfig;
}

const visualStyles = ["黑白摄影", "写实彩色", "油画风格", "现代电影", "古风电影", "复古胶片", "水彩治愈", "杂志插画"];
const stageLabels = ["文案处理", "场景规划", "素材图片", "MiniMax 配音", "动画预览", "真实出片"];

function splitByPunctuation(value: string): string[] {
  return value
    .replace(/\r/g, "")
    .split(/(?<=[。！？!?；;])|\n+/u)
    .map((part) => part.trim())
    .filter(Boolean)
    .slice(0, 36);
}

function createScene(text: string, index: number, visualStyle: string): HtmlVideoScene {
  const clean = text.replace(/\s+/g, " ").trim();
  return {
    id: index + 1,
    title: clean.slice(0, 16),
    subtitle: clean,
    prompt: `${visualStyle}，竖屏短视频画面，${clean}，主体清晰，构图有层次，无文字，无水印`,
    layout: index % 3 === 0 ? "center-focus" : index % 3 === 1 ? "person-focus" : "rule-of-thirds",
    subtitleStyle: "outline",
    animation: index % 2 === 0 ? "rise" : "breathe",
    status: "pending",
  };
}

function freshManifest(sourceText: string, visualStyle: string, scenes: HtmlVideoScene[], rewrittenText?: string): HtmlVideoManifest {
  const timestamp = new Date().toISOString();
  return {
    schemaVersion: 1,
    kind: "html-video",
    title: (rewrittenText || sourceText).replace(/\s+/g, " ").slice(0, 24) || "HTML 动画视频",
    sourceText,
    rewrittenText,
    visualStyle,
    aspectRatio: "9:16",
    width: 1080,
    height: 1920,
    fps: 30,
    scenes,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

function mergeAsset(input: {
  fileName?: string;
  path?: string;
  url?: string;
  bytes?: number;
  durationSec?: number;
  mimeType?: string;
}): MediaWorkbenchAsset {
  return {
    fileName: input.fileName || "asset.bin",
    path: input.path || "",
    url: input.url || "",
    bytes: input.bytes || 0,
    durationSec: input.durationSec,
    mimeType: input.mimeType,
  };
}

export function HtmlVideoPage({ llmConfig = defaultLlmConfig, ttsConfig = defaultTtsConfig }: HtmlVideoPageProps) {
  const [sourceText, setSourceText] = useState("");
  const [useAiRewrite, setUseAiRewrite] = useState(true);
  const [visualStyle, setVisualStyle] = useState("现代电影");
  const [job, setJob] = useState<HtmlVideoJob | null>(null);
  const [scenes, setScenes] = useState<HtmlVideoScene[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [recentJobs, setRecentJobs] = useState<MediaWorkbenchJobSummary[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("输入文案后开始；每一步都使用真实文件，不使用模拟计时。");
  const [error, setError] = useState("");
  const abortRef = useRef<AbortController | null>(null);
  const uploadRef = useRef<HTMLInputElement | null>(null);

  const selectedScene = scenes[selectedIndex];
  const readyImages = scenes.filter((scene) => scene.image?.path).length;
  const readyAudio = scenes.filter((scene) => scene.audio?.path && Number(scene.audio.durationSec) > 0).length;
  const stageIndex = job?.status === "completed"
    ? 5
    : readyAudio === scenes.length && scenes.length > 0
      ? 4
      : readyAudio > 0
        ? 3
        : readyImages > 0
          ? 2
          : scenes.length > 0
            ? 1
            : 0;

  const activeTtsConfig = useMemo<TtsConfig>(() => ({
    ...ttsConfig,
    provider: "minimax",
    minimax: { ...ttsConfig.minimax },
  }), [ttsConfig]);

  useEffect(() => {
    let active = true;
    listMediaJobs()
      .then((payload) => {
        if (active) setRecentJobs(payload.jobs.filter((item) => item.kind === "html-video").slice(0, 6));
      })
      .catch(() => undefined);
    return () => { active = false; };
  }, []);

  async function restoreJob(jobId: string) {
    setBusy(true);
    setError("");
    try {
      const restored = await getMediaJob<HtmlVideoManifest>(jobId);
      setJob(restored);
      setScenes(restored.manifest.scenes);
      setSourceText(restored.manifest.sourceText);
      setVisualStyle(restored.manifest.visualStyle);
      setSelectedIndex(0);
      setMessage(restored.status === "completed" ? "已恢复真实成片任务。" : "已恢复断点，可继续补图、配音或出片。");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "恢复任务失败");
    } finally {
      setBusy(false);
    }
  }

  async function planScenes(signal?: AbortSignal): Promise<HtmlVideoJob> {
    const input = sourceText.trim();
    if (input.length < 10) throw new Error("请至少输入 10 个字的文案");
    setMessage(useAiRewrite ? "正在调用已配置 LLM 改写并规划场景…" : "正在按标点拆分场景…");
    let workingText = input;
    let plannedScenes: HtmlVideoScene[] = [];
    if (useAiRewrite) {
      const context: PipelineContext = {
        title: input.slice(0, 20),
        inputText: input,
        track: "通用故事",
        videoForm: "narration",
        visualStyle,
        aspectRatio: "9:16",
        sourceMode: "paste",
        ttsMode: "original-segmented",
      };
      const artifacts: PipelineLlmArtifacts = {};
      const precheck = await runLlmPipelineStep({ step: "precheck", config: llmConfig, context, artifacts, signal });
      if (precheck.step === "precheck") artifacts.precheck = precheck.data;
      const rewrite = await runLlmPipelineStep({ step: "rewrite", config: llmConfig, context, artifacts, signal });
      if (rewrite.step === "rewrite") {
        artifacts.rewrite = rewrite.data;
        workingText = rewrite.data.narration;
      }
      const storyboard = await runLlmPipelineStep({ step: "storyboard", config: llmConfig, context: { ...context, inputText: workingText }, artifacts, signal });
      if (storyboard.step === "storyboard") {
        artifacts.storyboard = storyboard.data;
        plannedScenes = storyboard.data.shots.map((shot, index) => ({
          ...createScene(shot.text, index, visualStyle),
          id: shot.id || index + 1,
          title: shot.visual.slice(0, 16) || shot.text.slice(0, 16),
        }));
      }
      const prompts = await runLlmPipelineStep({ step: "prompts", config: llmConfig, context: { ...context, inputText: workingText }, artifacts, signal });
      if (prompts.step === "prompts") {
        plannedScenes = plannedScenes.map((scene, index) => ({
          ...scene,
          prompt: prompts.data.prompts.find((item) => item.shotId === scene.id)?.prompt
            || prompts.data.prompts[index]?.prompt
            || scene.prompt,
        }));
      }
    }
    if (plannedScenes.length === 0) {
      plannedScenes = splitByPunctuation(workingText).map((text, index) => createScene(text, index, visualStyle));
    }
    if (plannedScenes.length === 0) throw new Error("没有拆出可用场景，请检查文案标点");
    const manifest = freshManifest(input, visualStyle, plannedScenes, workingText === input ? undefined : workingText);
    const created = await createMediaJob({ kind: "html-video", title: manifest.title, manifest }, signal) as HtmlVideoJob;
    setJob(created);
    setScenes(created.manifest.scenes);
    setSelectedIndex(0);
    setMessage(`已生成 ${created.manifest.scenes.length} 个可编辑场景，尚未把任何步骤标记为完成。`);
    return created;
  }

  async function persistScenes(activeJob: HtmlVideoJob, nextScenes: HtmlVideoScene[], signal?: AbortSignal): Promise<HtmlVideoJob> {
    const manifest: HtmlVideoManifest = {
      ...activeJob.manifest,
      visualStyle,
      scenes: nextScenes,
      updatedAt: new Date().toISOString(),
    };
    const updated = await updateMediaJob<HtmlVideoManifest>(activeJob.id, { manifest }, signal);
    setJob(updated);
    setScenes(updated.manifest.scenes);
    return updated;
  }

  async function generateSceneImage(activeJob: HtmlVideoJob, scene: HtmlVideoScene, signal?: AbortSignal): Promise<HtmlVideoScene> {
    setMessage(`正在用 MiniMax 生成第 ${scene.id} 场图片…`);
    const response = await generateMinimaxImages({
      taskId: activeJob.id,
      prompts: [{ shotId: scene.id, prompt: scene.prompt, negativePrompt: "文字，水印，标志，低清晰度，畸形肢体" }],
      apiKey: activeTtsConfig.minimax.apiKey,
      aspectRatio: activeJob.manifest.aspectRatio,
      maxImages: 1,
      track: "通用故事",
      visualStyle,
    }, signal);
    const generated = response.images[0];
    if (!generated || generated.status !== "ready" || !generated.path) {
      throw new Error(generated?.error || `第 ${scene.id} 场 MiniMax 生图失败`);
    }
    return {
      ...scene,
      image: mergeAsset({
        fileName: generated.path.split(/[\\/]/u).at(-1),
        path: generated.path,
        url: generated.url,
        bytes: generated.bytes,
        mimeType: "image/jpeg",
      }),
      status: scene.audio?.path ? "ready" : "pending",
      error: undefined,
    };
  }

  async function generateSceneAudio(activeJob: HtmlVideoJob, scene: HtmlVideoScene, signal?: AbortSignal): Promise<HtmlVideoScene> {
    setMessage(`正在用 MiniMax 合成第 ${scene.id} 场配音并读取真实时长…`);
    const result = await synthesizeTts({
      provider: "minimax",
      text: scene.subtitle,
      voiceId: activeTtsConfig.minimax.voiceId,
      speed: 1,
      config: activeTtsConfig,
      taskId: activeJob.id,
      shotId: scene.id,
      fileName: `html-${scene.id}.mp3`,
      signal,
    });
    if (!result.assetPath || !result.assetUrl || !result.durationSec) {
      throw new Error(`第 ${scene.id} 场配音没有保存为可渲染的本地文件`);
    }
    return {
      ...scene,
      audio: mergeAsset({
        fileName: result.fileName,
        path: result.assetPath,
        url: result.assetUrl,
        bytes: result.blob.size,
        durationSec: result.durationSec,
        mimeType: "audio/mpeg",
      }),
      durationSec: result.durationSec,
      status: scene.image?.path ? "ready" : "pending",
      error: undefined,
    };
  }

  async function runAll() {
    const controller = new AbortController();
    abortRef.current = controller;
    setBusy(true);
    setError("");
    try {
      let workingJob = job || await planScenes(controller.signal);
      let workingScenes = [...workingJob.manifest.scenes];
      for (let index = 0; index < workingScenes.length; index += 1) {
        if (!workingScenes[index].image?.path) {
          workingScenes[index] = await generateSceneImage(workingJob, workingScenes[index], controller.signal);
          workingJob = await persistScenes(workingJob, workingScenes, controller.signal);
          workingScenes = [...workingJob.manifest.scenes];
        }
        if (!workingScenes[index].audio?.path) {
          workingScenes[index] = await generateSceneAudio(workingJob, workingScenes[index], controller.signal);
          workingJob = await persistScenes(workingJob, workingScenes, controller.signal);
          workingScenes = [...workingJob.manifest.scenes];
        }
      }
      setMessage("真实图片与逐场配音已就绪；现在可以试听、修改，或交给 ffmpeg 出片。");
    } catch (reason) {
      if ((reason as Error).name !== "AbortError") setError(reason instanceof Error ? reason.message : "生成失败");
    } finally {
      abortRef.current = null;
      setBusy(false);
    }
  }

  async function regenerateSelected(kind: "image" | "audio") {
    if (!job || !selectedScene) return;
    const controller = new AbortController();
    abortRef.current = controller;
    setBusy(true);
    setError("");
    try {
      const nextScene = kind === "image"
        ? await generateSceneImage(job, selectedScene, controller.signal)
        : await generateSceneAudio(job, selectedScene, controller.signal);
      const nextScenes = scenes.map((scene, index) => index === selectedIndex ? nextScene : scene);
      await persistScenes(job, nextScenes, controller.signal);
      setMessage(kind === "image" ? "选中场景图片已真实替换。" : "选中场景配音已真实替换。");
    } catch (reason) {
      if ((reason as Error).name !== "AbortError") setError(reason instanceof Error ? reason.message : "重新生成失败");
    } finally {
      abortRef.current = null;
      setBusy(false);
    }
  }

  async function replaceSelectedImage(file: File) {
    if (!job || !selectedScene) return;
    setBusy(true);
    setError("");
    try {
      const asset = await uploadMediaAsset(job.id, file, "images");
      const nextScenes = scenes.map((scene, index) => index === selectedIndex ? { ...scene, image: asset } : scene);
      await persistScenes(job, nextScenes);
      setMessage("本地图片已复制到任务目录并替换当前场景。");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "替换图片失败");
    } finally {
      setBusy(false);
    }
  }

  async function renderOutput() {
    if (!job) throw new Error("请先创建任务");
    if (readyImages !== scenes.length || readyAudio !== scenes.length) throw new Error("每个场景都必须有真实图片和配音");
    setBusy(true);
    setError("");
    setMessage("服务端正在调用 ffmpeg 生成真实 MP4，并构建剪映草稿 ZIP…");
    try {
      const latest = await persistScenes(job, scenes);
      const rendered = await renderMediaJob<HtmlVideoManifest>(latest.id, { manifest: latest.manifest });
      setJob(rendered);
      setScenes(rendered.manifest.scenes);
      setMessage("完成：MP4、渲染清单和剪映草稿 ZIP 均已实际写入磁盘并通过探测。");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "真实出片失败");
    } finally {
      setBusy(false);
    }
  }

  async function cancel() {
    abortRef.current?.abort();
    if (job) {
      try {
        const paused = await cancelMediaJob<HtmlVideoManifest>(job.id);
        setJob(paused);
      } catch {
        // A front-end request may have already ended; local assets remain persisted.
      }
    }
    setBusy(false);
    setMessage("已取消当前操作，生成过的图片、配音和渲染分段已保留。");
  }

  function updateSelected(patch: Partial<HtmlVideoScene>) {
    setScenes((current) => current.map((scene, index) => index === selectedIndex ? { ...scene, ...patch } : scene));
  }

  function deleteSelected() {
    const next = scenes.filter((_, index) => index !== selectedIndex).map((scene, index) => ({ ...scene, id: index + 1 }));
    setScenes(next);
    setSelectedIndex(Math.max(0, Math.min(selectedIndex, next.length - 1)));
  }

  function addScene() {
    const next = [...scenes, createScene("新增场景，请填写字幕", scenes.length, visualStyle)];
    setScenes(next);
    setSelectedIndex(next.length - 1);
  }

  const previewClass = selectedScene ? `html-phone-layout layout-${selectedScene.layout}` : "html-phone-layout";

  return (
    <div className={scenes.length ? "html-video-page running" : "html-video-page"}>
      {scenes.length > 0 && (
        <aside className="html-step-rail" aria-label="HTML 动画步骤">
          <div className="html-step-title"><span>H</span><div><strong>HTML 动画</strong><small>真实本地流水线</small></div></div>
          {stageLabels.map((label, index) => (
            <div className={index < stageIndex ? "done" : index === stageIndex ? "active" : ""} key={label}>
              <span>{index < stageIndex ? "✓" : index + 1}</span>
              <div><strong>{label}</strong><small>{index < stageIndex ? "已有真实产物" : index === stageIndex ? job?.stage || "当前步骤" : "等待上游"}</small></div>
            </div>
          ))}
          <div className="html-rail-facts">
            <span>图片 {readyImages}/{scenes.length}</span>
            <span>配音 {readyAudio}/{scenes.length}</span>
            <span>{job?.output ? `${job.output.durationSec.toFixed(1)} 秒` : "尚未出片"}</span>
          </div>
        </aside>
      )}

      <main className="html-video-main">
        <header className="html-page-header">
          <div><span className="html-kicker">STORYBOUND · HTML VIDEO</span><h1>HTML 动画视频</h1><p>文案拆场景、MiniMax 图片、逐场 TTS、真实预览和 ffmpeg 出片。</p></div>
          {recentJobs.length > 0 && !job && (
            <button className="html-ghost-button" disabled={busy} onClick={() => restoreJob(recentJobs[0].id)} type="button">恢复最近断点</button>
          )}
        </header>

        {scenes.length === 0 ? (
          <div className="html-config">
            <section className="html-card">
              <div className="html-card-heading"><span>01</span><div><h2>输入文案</h2><p>LLM 改写可选；关闭后严格按标点拆场景。</p></div></div>
              <textarea
                onChange={(event) => setSourceText(event.target.value)}
                placeholder="粘贴故事、文摘或口播文案。每个完整句子会成为一个可编辑场景。"
                value={sourceText}
              />
              <div className="html-inline-options">
                <button className={useAiRewrite ? "selected" : ""} onClick={() => setUseAiRewrite(true)} type="button">LLM 改写 + 规划</button>
                <button className={!useAiRewrite ? "selected" : ""} onClick={() => setUseAiRewrite(false)} type="button">直接使用原文</button>
              </div>
            </section>

            <section className="html-card">
              <div className="html-card-heading"><span>02</span><div><h2>统一视觉风格</h2><p>每场景仍可单独改 prompt、布局、字幕和动画。</p></div></div>
              <div className="html-chip-grid">
                {visualStyles.map((style) => <button className={visualStyle === style ? "selected" : ""} key={style} onClick={() => setVisualStyle(style)} type="button">{style}</button>)}
              </div>
            </section>

            <div className="html-start-row">
              <div><strong>不再演示假进度</strong><span>只有 LLM 返回真实场景后，才会进入下一步。</span></div>
              <button disabled={busy || sourceText.trim().length < 10} onClick={() => void runAll()} type="button">{busy ? "真实生成中…" : "规划并生成素材"}</button>
            </div>
          </div>
        ) : (
          <div className="html-workbench">
            <section className="html-preview-card">
              <div className="html-section-bar"><div><h2>动画预览</h2><p>使用当前场景真实图片与真实音频</p></div><span>{selectedIndex + 1} / {scenes.length}</span></div>
              <div className="html-preview-layout">
                <div className={previewClass}>
                  {selectedScene?.image?.url ? <img alt={selectedScene.title} src={selectedScene.image.url} /> : <div className="html-empty-visual">等待真实图片</div>}
                  {selectedScene && (
                    <div className={`html-caption style-${selectedScene.subtitleStyle} animation-${selectedScene.animation}`}>
                      <strong>{selectedScene.title}</strong>
                      <span>{selectedScene.subtitle}</span>
                    </div>
                  )}
                </div>
                <div className="html-scene-editor">
                  <label>场景标题<input onChange={(event) => updateSelected({ title: event.target.value })} value={selectedScene?.title || ""} /></label>
                  <label>字幕<textarea onChange={(event) => updateSelected({ subtitle: event.target.value })} value={selectedScene?.subtitle || ""} /></label>
                  <label>MiniMax prompt<textarea onChange={(event) => updateSelected({ prompt: event.target.value })} value={selectedScene?.prompt || ""} /></label>
                  {selectedScene?.audio?.url ? <audio controls preload="metadata" src={selectedScene.audio.url} /> : <div className="html-audio-empty">尚未生成本场配音</div>}
                  <div className="html-editor-actions">
                    <button disabled={busy} onClick={() => void regenerateSelected("image")} type="button">生成 / 重生图片</button>
                    <button disabled={busy} onClick={() => void regenerateSelected("audio")} type="button">生成 / 重生配音</button>
                    <button disabled={busy} onClick={() => uploadRef.current?.click()} type="button">替换本地图</button>
                    <button className="danger" disabled={busy || scenes.length <= 1} onClick={deleteSelected} type="button">删除场景</button>
                  </div>
                  <input accept=".png,.jpg,.jpeg,.webp" hidden onChange={(event) => { const file = event.target.files?.[0]; if (file) void replaceSelectedImage(file); event.target.value = ""; }} ref={uploadRef} type="file" />
                </div>
              </div>
            </section>

            <section className="html-controls-card">
              <div><label>画面布局</label><div className="html-chip-grid compact">{Object.entries(htmlLayoutLabels).map(([value, label]) => <button className={selectedScene?.layout === value ? "selected" : ""} key={value} onClick={() => updateSelected({ layout: value as HtmlLayoutPreset })} type="button">{label}</button>)}</div></div>
              <div><label>字幕样式</label><div className="html-chip-grid compact">{Object.entries(htmlSubtitleStyleLabels).map(([value, label]) => <button className={selectedScene?.subtitleStyle === value ? "selected" : ""} key={value} onClick={() => updateSelected({ subtitleStyle: value as HtmlSubtitleStyle })} type="button">{label}</button>)}</div></div>
              <div><label>字幕动画</label><div className="html-chip-grid compact">{Object.entries(htmlAnimationLabels).map(([value, label]) => <button className={selectedScene?.animation === value ? "selected" : ""} key={value} onClick={() => updateSelected({ animation: value as HtmlAnimationPreset })} type="button">{label}</button>)}</div></div>
            </section>

            <section className="html-scene-strip" aria-label="场景列表">
              {scenes.map((scene, index) => (
                <button className={selectedIndex === index ? "selected" : ""} key={`${scene.id}-${index}`} onClick={() => setSelectedIndex(index)} type="button">
                  <span>{scene.image?.url ? <img alt="" src={scene.image.url} /> : scene.id}</span>
                  <div><strong>第 {scene.id} 场</strong><small>{scene.subtitle}</small></div>
                  <em>{scene.image?.path ? "图✓" : "缺图"} · {scene.audio?.path ? "声✓" : "缺声"}</em>
                </button>
              ))}
              <button className="html-add-scene" onClick={addScene} type="button">＋ 新增场景</button>
            </section>

            {job?.output && (
              <section className="html-output-card">
                <div><strong>真实文件已生成</strong><span>{job.output.width}×{job.output.height} · {job.output.fps}fps · {job.output.videoCodec}/{job.output.audioCodec} · {job.output.durationSec.toFixed(2)} 秒 · {job.output.renderer === "chromium-html-frames" ? "Chromium HTML 逐帧" : "FFmpeg 兼容渲染"}</span></div>
                <a href={job.output.mp4Url}>下载 MP4</a>
                <a href={job.output.jianyingZipUrl}>下载剪映草稿 ZIP</a>
                <a href={job.output.manifestUrl}>查看渲染清单</a>
              </section>
            )}
          </div>
        )}

        {(message || error) && <div className={error ? "html-status error" : "html-status"}><strong>{error ? "未完成" : busy ? "正在执行真实任务" : "状态"}</strong><span>{error || message}</span></div>}

        {scenes.length > 0 && (
          <footer className="html-action-bar">
            <div><strong>{job?.status === "completed" ? "真实成片已完成" : "断点自动保存在本机"}</strong><span>{job?.stage || "可继续编辑"}</span></div>
            {busy && <button className="html-cancel" onClick={() => void cancel()} type="button">取消并保留断点</button>}
            <button disabled={busy} onClick={() => void runAll()} type="button">补齐真实素材</button>
            <button className="primary" disabled={busy || readyImages !== scenes.length || readyAudio !== scenes.length} onClick={() => void renderOutput()} type="button">{busy ? "处理中…" : "生成 MP4 + 剪映草稿"}</button>
          </footer>
        )}
      </main>
    </div>
  );
}
