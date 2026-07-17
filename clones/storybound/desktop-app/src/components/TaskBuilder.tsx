import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { pipelineSteps } from "../data/app-data";
import { minimaxVoices, volcengineVoices } from "../data/tts-data";
import { generateMinimaxImages } from "../lib/image-api";
import { createAiCopy, runLlmPipelineStep } from "../lib/llm-api";
import { appendTaskEvent, buildTaskDraft, clearTaskFromStep, createTask, getTask, updateTask, uploadTaskAsset } from "../lib/task-api";
import { synthesizeTts } from "../lib/tts-api";
import type { PipelineStatus } from "../types/app";
import type { StoredImage } from "../types/task";
import type { LlmConfig, LlmCredentialStatus, PipelineContext, StoryboardShot } from "../types/llm";
import type { AudioSegment, StoryboundTask, TaskTimelineEntry } from "../types/task";
import type { TtsConfig, TtsCredentialStatus } from "../types/tts";
import { TaskCreateForm } from "./TaskCreateForm";
import { TaskWorkbench } from "./TaskWorkbench";
import { defaultBuilderForm, formFromTask, pipelineStartStep, taskPatchFromForm, type BuilderFormState } from "./task-builder-model";
import "./TaskBuilder.css";

interface TaskBuilderProps {
  config: TtsConfig;
  credentialStatus: TtsCredentialStatus;
  llmConfig: LlmConfig;
  llmCredentialStatus: LlmCredentialStatus;
  taskId?: string | null;
  autoRun?: boolean;
  onTaskIdChange?: (taskId: string | null) => void;
  onLlmConfigChange: (config: LlmConfig) => void;
  onTtsConfigChange: (config: TtsConfig) => void;
  onOpenPipeline: (task: StoryboundTask) => void;
  onQueueAdvance?: (taskId: string, outcome: "completed" | "failed" | "cancelled") => void;
  onNavigateSettings: () => void;
}

function createTaskId(): string {
  return typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `storybound-${Date.now().toString(36)}`;
}

function initialStatuses(mode: BuilderFormState["mode"], startStep: number): PipelineStatus[] {
  return pipelineSteps.map((step) => {
    if (mode !== "auto" && step.id < 2) return "skipped";
    if (step.id < startStep) return "done";
    return step.id === startStep ? "running" : "pending";
  });
}

function fallbackTitle(text: string): string {
  const compact = text.trim();
  return compact ? `${compact.slice(0, 22)}${compact.length > 22 ? "…" : ""}` : "未命名视频";
}

function mechanicalShots(text: string, targetScenes: number | null): StoryboardShot[] {
  const paragraphs = text.split(/\n\s*\n+/).map((item) => item.trim()).filter(Boolean);
  const rawPieces = (paragraphs.length > 1 ? paragraphs : text.split(/(?<=[。！？!?；;])|\n+/))
    .map((item) => item.trim()).filter(Boolean);
  const pieces = rawPieces.flatMap((piece) => {
    const chunks: string[] = [];
    let remaining = piece;
    while (remaining.length > 55) {
      const window = remaining.slice(0, 56);
      const candidates = ["。", "！", "？", "；", "，", ".", "!", "?", ";", ","];
      let splitAt = candidates.reduce((best, marker) => Math.max(best, window.lastIndexOf(marker)), -1);
      if (splitAt < 24) splitAt = 44;
      chunks.push(remaining.slice(0, splitAt + 1).trim());
      remaining = remaining.slice(splitAt + 1).trim();
    }
    if (remaining) chunks.push(remaining);
    return chunks;
  });
  const requested = targetScenes && targetScenes > 0 ? Math.min(60, targetScenes) : pieces.length;
  const merged = [...pieces];
  while (merged.length > requested) {
    let mergeAt = -1;
    let shortest = Number.POSITIVE_INFINITY;
    for (let index = 0; index < merged.length - 1; index += 1) {
      const combinedLength = merged[index].length + merged[index + 1].length;
      if (combinedLength <= 55 && combinedLength < shortest) {
        shortest = combinedLength;
        mergeAt = index;
      }
    }
    if (mergeAt < 0) break;
    merged.splice(mergeAt, 2, `${merged[mergeAt]}${merged[mergeAt + 1]}`);
  }
  return merged.slice(0, 60).map((item, index) => ({
    id: index + 1,
    text: item,
    visual: "按当前字幕匹配主体、环境和动作明确的画面",
    emotion: "自然、克制",
    durationSec: Math.max(1.2, Math.min(10, item.replace(/\s/g, "").length / 4.3)),
  }));
}

function splitPodcast(text: string): Array<{ id: number; speaker: "A" | "B"; text: string }> {
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const tagged = lines.map((line, index) => {
    const match = line.match(/^\s*\[([AB])\]\s*[:：]?\s*(.+)$/i);
    return match ? { id: index + 1, speaker: match[1].toUpperCase() as "A" | "B", text: match[2].trim() } : null;
  }).filter((item): item is { id: number; speaker: "A" | "B"; text: string } => Boolean(item?.text));
  if (tagged.length === lines.length && tagged.length > 0) return tagged;
  throw new Error("播客文案必须逐行使用 [A] 或 [B] 开头。请在“改写与发布素材”中补齐说话人标签后继续。");
}

function timelineFromShots(shots: StoryboardShot[], durations?: Map<number, number>): TaskTimelineEntry[] {
  let cursor = 0;
  return shots.map((shot) => {
    const durationSec = Math.max(0.3, durations?.get(shot.id) || shot.durationSec || shot.text.length / 4.3);
    const item = { shotId: shot.id, text: shot.text, startSec: cursor, endSec: cursor + durationSec, durationSec };
    cursor = item.endSec;
    return item;
  });
}

function timelineForTotalDuration(shots: StoryboardShot[], totalDurationSec: number): TaskTimelineEntry[] {
  const totalWeight = Math.max(1, shots.reduce((sum, shot) => sum + Math.max(1, shot.text.replace(/\s/g, "").length), 0));
  let cursor = 0;
  return shots.map((shot, index) => {
    const remaining = Math.max(0.3, totalDurationSec - cursor);
    const weighted = totalDurationSec * Math.max(1, shot.text.replace(/\s/g, "").length) / totalWeight;
    const durationSec = index === shots.length - 1 ? remaining : Math.max(0.3, Math.min(remaining, weighted));
    const item = { shotId: shot.id, text: shot.text, startSec: cursor, endSec: cursor + durationSec, durationSec };
    cursor = item.endSec;
    return item;
  });
}

export function TaskBuilder({ config, credentialStatus, llmConfig, llmCredentialStatus, taskId, autoRun = false, onTaskIdChange, onOpenPipeline, onQueueAdvance, onNavigateSettings }: TaskBuilderProps) {
  const [form, setForm] = useState<BuilderFormState>(defaultBuilderForm);
  const [task, setTask] = useState<StoryboundTask | null>(null);
  const [loading, setLoading] = useState(Boolean(taskId));
  const [busy, setBusy] = useState(false);
  const [aiGenerating, setAiGenerating] = useState(false);
  const [saved, setSaved] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const cancelRequestedRef = useRef(false);
  const pauseRequestedRef = useRef(false);
  const autoStartedRef = useRef<string | null>(null);
  const queuedRunRef = useRef<() => void>(() => undefined);

  const availableVoices = useMemo(() => config.provider === "minimax"
    ? [...minimaxVoices, ...config.minimax.clonedVoices]
    : volcengineVoices.filter((voice) => voice.version === config.volcengine.version), [config.minimax.clonedVoices, config.provider, config.volcengine.version]);
  const hasTtsCredentials = config.provider === "minimax"
    ? Boolean(config.minimax.apiKey.trim() || credentialStatus.minimax.available)
    : Boolean((config.volcengine.appId.trim() && config.volcengine.accessToken.trim()) || credentialStatus.volcengine.available);
  const hasLlmCredentials = Boolean(llmConfig.apiKey.trim() || llmCredentialStatus.available);
  const canStart = form.inputText.trim().length >= 10 || (form.sourceMode === "ai" && form.aiBrief.trim().length >= 2);

  useEffect(() => {
    const voiceA = form.ttsVoiceId || (config.provider === "minimax" ? config.minimax.voiceId : config.volcengine.voiceId) || availableVoices[0]?.id || "";
    const voiceB = form.ttsVoiceIdB || availableVoices.find((voice) => voice.id !== voiceA)?.id || voiceA;
    if (voiceA !== form.ttsVoiceId || voiceB !== form.ttsVoiceIdB) setForm((current) => ({ ...current, ttsVoiceId: voiceA, ttsVoiceIdB: voiceB }));
  }, [availableVoices, config.minimax.voiceId, config.provider, config.volcengine.voiceId, form.ttsVoiceId, form.ttsVoiceIdB]);

  useEffect(() => {
    let cancelled = false;
    if (!taskId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    void getTask(taskId).then((loaded) => {
      if (cancelled) return;
      setTask(loaded);
      setForm(formFromTask(loaded));
      onOpenPipeline(loaded);
    }).catch((error: unknown) => {
      if (!cancelled) window.alert(error instanceof Error ? error.message : "无法打开任务");
    }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [onOpenPipeline, taskId]);

  useEffect(() => {
    if (!task || busy) return;
    const timer = window.setTimeout(() => {
      void updateTask(task.id, taskPatchFromForm(form)).then(() => setSaved(true)).catch(() => undefined);
    }, 700);
    return () => window.clearTimeout(timer);
  }, [busy, form, task]);

  useEffect(() => () => abortRef.current?.abort(), []);

  const changeForm = useCallback((patch: Partial<BuilderFormState>) => {
    setSaved(false);
    setForm((current) => ({ ...current, ...patch }));
  }, []);

  function pipelineContext(activeForm = form, inputText = activeForm.inputText): PipelineContext {
    return {
      title: activeForm.title,
      inputText,
      track: activeForm.track,
      videoForm: activeForm.videoForm,
      visualStyle: activeForm.visualStyle,
      aspectRatio: activeForm.aspectRatio,
      sourceMode: activeForm.sourceMode,
      rewriteIntensity: activeForm.rewriteIntensity,
      narrativePov: activeForm.narrativePov,
      targetLength: activeForm.targetLength,
      targetScenes: activeForm.targetScenes,
      fixedIntro: activeForm.fixedIntro,
      outroCta: activeForm.outroCta,
    };
  }

  async function ensureTask(activeForm = form): Promise<StoryboundTask> {
    if (task) return updateTask(task.id, taskPatchFromForm(activeForm));
    const created = await createTask({
      id: taskId || createTaskId(),
      ...taskPatchFromForm(activeForm),
      title: activeForm.title.trim() || fallbackTitle(activeForm.inputText || activeForm.aiBrief),
      status: "draft",
      runState: "idle",
      currentStep: -1,
      stepStatuses: pipelineSteps.map(() => "pending" as PipelineStatus),
    });
    setTask(created);
    onTaskIdChange?.(created.id);
    return created;
  }

  async function handleGenerateCopy(): Promise<string | null> {
    if (!hasLlmCredentials || form.aiBrief.trim().length < 2) return null;
    setAiGenerating(true);
    const controller = new AbortController();
    try {
      const result = await createAiCopy({ config: llmConfig, context: pipelineContext(form, form.aiBrief), signal: controller.signal });
      if (result.step !== "rewrite") return null;
      const nextForm = { ...form, title: form.title || result.data.title, inputText: result.data.narration };
      setForm(nextForm);
      setSaved(false);
      if (task) await updateTask(task.id, taskPatchFromForm(nextForm));
      return result.data.narration;
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "AI 创作文案失败");
      return null;
    } finally {
      setAiGenerating(false);
    }
  }

  async function persistState(activeTask: StoryboundTask, patch: Partial<StoryboundTask>): Promise<StoryboundTask> {
    const updated = await updateTask(activeTask.id, patch);
    setTask(updated);
    onOpenPipeline(updated);
    return updated;
  }

  async function runLlmStep(activeTask: StoryboundTask, step: 0 | 1 | 2 | 3, signal: AbortSignal): Promise<StoryboundTask> {
    if (!hasLlmCredentials) throw new Error("LLM 未配置，无法执行原版预审、改写、分镜和绘图提示词逻辑");
    if (step === 2 && activeTask.mode === "direct") {
      const shots = mechanicalShots(activeTask.inputText, activeTask.options.targetScenes ?? null);
      if (!shots.length) throw new Error("直接出片模式没有切出有效分镜，请用空行或标点分隔文案");
      return persistState(activeTask, { artifacts: { ...activeTask.artifacts, storyboard: { shots } } });
    }
    const stepName = (["precheck", "rewrite", "storyboard", "prompts"] as const)[step];
    const result = await runLlmPipelineStep({ step: stepName, config: llmConfig, context: pipelineContext(form, activeTask.inputText), artifacts: activeTask.artifacts, signal });
    const artifacts = { ...activeTask.artifacts, [result.step]: result.data };
    const patch: Partial<StoryboundTask> = { artifacts };
    if (result.step === "rewrite") {
      patch.title = result.data.title || activeTask.title;
      if (activeTask.videoForm === "podcast" && !/^\s*\[[AB]\]/m.test(result.data.narration)) {
        const lines = mechanicalShots(result.data.narration, activeTask.options.targetScenes ?? null);
        artifacts.rewrite = { ...result.data, narration: lines.map((line, index) => `[${index % 2 === 0 ? "A" : "B"}] ${line.text}`).join("\n") };
      }
    }
    return persistState(activeTask, patch);
  }

  function borrowFailedImages(images: StoredImage[]): StoredImage[] {
    return images.map((image, index) => {
      if (image.status !== "failed") return image;
      const neighbor = images.slice(0, index).reverse().find((item) => item.path) || images.slice(index + 1).find((item) => item.path);
      return neighbor ? { ...neighbor, id: `borrow-${image.shotId}-${Date.now()}`, shotId: image.shotId, prompt: image.prompt, status: "borrowed", borrowedFrom: neighbor.shotId } : image;
    });
  }

  async function runImageStep(activeTask: StoryboundTask, signal: AbortSignal): Promise<StoryboundTask> {
    const prompts = activeTask.artifacts.prompts?.prompts || [];
    if (!prompts.length) throw new Error("没有绘图提示词，请先完成 Step 4");
    const existing = new Map(activeTask.media.images.filter((image) => image.path && image.status !== "failed").map((image) => [image.shotId, image]));
    const missing = prompts.filter((prompt) => !existing.has(prompt.shotId));
    let generated: StoredImage[] = [];
    if (missing.length && activeTask.options.materialSource === "ai") {
      const result = await generateMinimaxImages({ taskId: activeTask.id, prompts: missing, apiKey: config.minimax.apiKey, aspectRatio: activeTask.aspectRatio, maxImages: missing.length, track: activeTask.track, visualStyle: activeTask.visualStyle }, signal);
      generated = result.images.map((image) => ({ ...image, status: image.status || (image.url ? "ready" : "failed") })) as StoredImage[];
    }
    let images = prompts.map((prompt) => existing.get(prompt.shotId) || generated.find((image) => image.shotId === prompt.shotId) || ({ id: `missing-${prompt.shotId}`, shotId: prompt.shotId, prompt: prompt.prompt, url: "", status: "failed", error: "没有匹配的本地素材" } as StoredImage));
    if (activeTask.options.autoBorrowImage) images = borrowFailedImages(images);
    const unusable = images.filter((image) => !image.path);
    if (unusable.length) throw new Error(`还有 ${unusable.length} 个分镜缺图，请上传替换、重画或使用相邻画面补位`);
    let coverImages = activeTask.media.coverImages || [];
    if (activeTask.options.coverMode && activeTask.options.coverMode !== "off" && activeTask.options.materialSource === "ai") {
      const coverCount = activeTask.options.secondCover ? 2 : 1;
      const coverTitle = activeTask.artifacts.rewrite?.title || activeTask.title;
      const coverPrompts = Array.from({ length: coverCount }, (_, index) => ({
        shotId: 9001 + index,
        prompt: `${activeTask.visualStyle}，${activeTask.options.coverMode === "titled" ? "电影海报封面构图，主体居中，顶部和底部预留标题排版空间，画面内不要生成任何文字" : "纯画面封面，主体突出，构图简洁，不要文字"}，主题：${coverTitle}，${prompts[index % prompts.length]?.prompt || "高完成度短视频封面"}`,
        negativePrompt: "文字，水印，标志，低清晰度，畸形人物",
      }));
      const coverResult = await generateMinimaxImages({ taskId: activeTask.id, prompts: coverPrompts, apiKey: config.minimax.apiKey, aspectRatio: activeTask.options.coverRatio === "1:1" ? "1:1" : "3:4", maxImages: coverCount, track: activeTask.track, visualStyle: activeTask.visualStyle }, signal);
      coverImages = coverResult.images.map((image) => ({ ...image, status: image.status || (image.path ? "ready" : "failed") })) as StoredImage[];
    }
    return persistState(activeTask, { media: { ...activeTask.media, images, coverImages }, draft: null });
  }

  async function synthesizeSegment(activeTask: StoryboundTask, shotId: number, text: string, voiceId: string, signal: AbortSignal, speaker?: "A" | "B"): Promise<AudioSegment> {
    const audio = await synthesizeTts({ provider: config.provider, text, voiceId, speed: activeTask.options.ttsSpeed || 1, config, taskId: activeTask.id, shotId, fileName: `${speaker ? `${speaker}-` : ""}${shotId}.mp3`, signal });
    if (!audio.assetUrl || !audio.assetPath || !audio.fileName) throw new Error(`第 ${shotId} 段音频未写入任务目录`);
    return { id: `audio-${speaker || "N"}-${shotId}-${Date.now()}`, shotId, speaker, text, voiceId, fileName: audio.fileName, path: audio.assetPath, url: audio.assetUrl, bytes: audio.blob.size, durationSec: audio.durationSec, status: "ready" };
  }

  async function runAudioStep(activeTask: StoryboundTask, signal: AbortSignal): Promise<StoryboundTask> {
    const shots = activeTask.artifacts.storyboard?.shots || [];
    if (!shots.length) throw new Error("没有分镜，无法生成配音和字幕");
    if (activeTask.options.voiceSource === "external") {
      if (!activeTask.media.externalAudio?.path) throw new Error("请选择并上传完整外部配音");
      const totalDuration = activeTask.media.externalAudio.durationSec || timelineFromShots(shots).at(-1)?.endSec || 1;
      const timeline = timelineForTotalDuration(shots, totalDuration);
      return persistState(activeTask, { media: { ...activeTask.media, timeline }, draft: null });
    }
    if (!hasTtsCredentials) throw new Error("当前 TTS 引擎缺少凭据");
    const voiceA = activeTask.options.ttsVoiceId || form.ttsVoiceId;
    const voiceB = activeTask.options.ttsVoiceIdB || form.ttsVoiceIdB;
    if (!voiceA) throw new Error("请选择配音音色");
    const audioSegments: AudioSegment[] = [];
    if (activeTask.videoForm === "podcast") {
      const source = activeTask.artifacts.rewrite?.narration || activeTask.inputText;
      const rounds = splitPodcast(source);
      if (!voiceB || voiceB === voiceA) throw new Error("双人播客需要选择两个不同音色");
      let cursor = 0;
      for (const round of rounds) {
        const segment = await synthesizeSegment(activeTask, round.id, round.text, round.speaker === "A" ? voiceA : voiceB, signal, round.speaker);
        segment.startSec = cursor;
        cursor += segment.durationSec;
        audioSegments.push(segment);
        activeTask = await persistState(activeTask, { media: { ...activeTask.media, audioSegments: [...audioSegments], podcast: { segments: [...audioSegments], totalDurationSec: cursor } } });
      }
      const timeline = audioSegments.map((segment) => ({ shotId: segment.shotId, text: `[${segment.speaker}] ${segment.text}`, startSec: segment.startSec || 0, endSec: (segment.startSec || 0) + segment.durationSec, durationSec: segment.durationSec }));
      return persistState(activeTask, { media: { ...activeTask.media, audioSegments, podcast: { segments: audioSegments, totalDurationSec: cursor }, timeline }, draft: null });
    }
    const existing = new Map(activeTask.media.audioSegments.filter((item) => item.status === "ready" && item.path).map((item) => [item.shotId, item]));
    for (const shot of shots) {
      const segment = existing.get(shot.id) || await synthesizeSegment(activeTask, shot.id, shot.text, voiceA, signal);
      audioSegments.push(segment);
      activeTask = await persistState(activeTask, { media: { ...activeTask.media, audioSegments: [...audioSegments] } });
    }
    const durations = new Map(audioSegments.map((segment) => [segment.shotId, segment.durationSec]));
    const timeline = timelineFromShots(shots, durations);
    let cursor = 0;
    for (const segment of audioSegments) { segment.startSec = cursor; cursor += segment.durationSec; }
    return persistState(activeTask, { media: { ...activeTask.media, audioSegments, timeline }, draft: null });
  }

  async function executeStep(activeTask: StoryboundTask, step: number, signal: AbortSignal): Promise<StoryboundTask> {
    if (step <= 3) return runLlmStep(activeTask, step as 0 | 1 | 2 | 3, signal);
    if (step === 4) return runImageStep(activeTask, signal);
    if (step === 5) return runAudioStep(activeTask, signal);
    return buildTaskDraft(activeTask.id);
  }

  function shouldPauseAfter(activeTask: StoryboundTask, step: number): boolean {
    if (autoRun) return false;
    if (pauseRequestedRef.current) return true;
    if (activeTask.pausePreset === "every") return step < 6;
    if (activeTask.pausePreset === "key") return [0, 2, 3].includes(step);
    return activeTask.pausePreset === "custom" && activeTask.customPauseSteps.includes(step);
  }

  async function runPipeline(initialTask: StoryboundTask, fromStep: number): Promise<void> {
    setBusy(true);
    setSaved(true);
    cancelRequestedRef.current = false;
    pauseRequestedRef.current = false;
    const controller = new AbortController();
    abortRef.current = controller;
    let activeTask = initialTask;
    try {
      for (let step = fromStep; step < pipelineSteps.length; step += 1) {
        if (activeTask.mode !== "auto" && step < 2) continue;
        const runningStatuses = [...activeTask.stepStatuses];
        runningStatuses[step] = "running";
        activeTask = await persistState(activeTask, { status: "running", runState: "running", currentStep: step, stepStatuses: runningStatuses, error: null });
        await appendTaskEvent(activeTask.id, { type: "step_start", step, detail: pipelineSteps[step]?.title });
        activeTask = await executeStep(activeTask, step, controller.signal);
        if (step === 6) {
          setTask(activeTask);
          if (autoRun) onQueueAdvance?.(activeTask.id, "completed");
          break;
        }
        const doneStatuses = [...activeTask.stepStatuses];
        doneStatuses[step] = "done";
        const nextStep = step + 1;
        const pause = shouldPauseAfter(activeTask, step);
        if (pause) {
          doneStatuses[nextStep] = "paused";
          activeTask = await persistState(activeTask, { status: "paused", runState: "paused", currentStep: nextStep, stepStatuses: doneStatuses });
          await appendTaskEvent(activeTask.id, { type: "need_confirm", step, detail: "产物已保存，等待确认" });
          break;
        }
        doneStatuses[nextStep] = "running";
        activeTask = await persistState(activeTask, { status: "running", runState: "running", currentStep: nextStep, stepStatuses: doneStatuses });
        await appendTaskEvent(activeTask.id, { type: "step_complete", step, detail: pipelineSteps[step]?.title });
      }
    } catch (error) {
      if (cancelRequestedRef.current || (error instanceof DOMException && error.name === "AbortError")) {
        activeTask = await persistState(activeTask, { status: "cancelled", runState: "cancelled", error: null });
        if (autoRun) onQueueAdvance?.(activeTask.id, "cancelled");
      } else {
        const statuses = [...activeTask.stepStatuses];
        statuses[activeTask.currentStep] = "failed";
        activeTask = await persistState(activeTask, { status: "failed", runState: "paused", stepStatuses: statuses, error: error instanceof Error ? error.message : "步骤执行失败" });
        await appendTaskEvent(activeTask.id, { type: "step_failed", step: activeTask.currentStep, detail: activeTask.error });
        if (autoRun) onQueueAdvance?.(activeTask.id, "failed");
      }
    } finally {
      if (abortRef.current === controller) abortRef.current = null;
      setBusy(false);
    }
  }

  async function handleStart(): Promise<void> {
    if (!canStart || busy) return;
    let activeForm = form;
    if (form.sourceMode === "ai" && form.inputText.trim().length < 10) {
      const generated = await handleGenerateCopy();
      if (!generated) return;
      activeForm = { ...form, inputText: generated };
    }
    const start = pipelineStartStep(activeForm.mode);
    let activeTask = await ensureTask(activeForm);
    activeTask = await persistState(activeTask, { ...taskPatchFromForm(activeForm), status: "running", runState: "running", currentStep: start, stepStatuses: initialStatuses(activeForm.mode, start), artifacts: {}, media: { ...activeTask.media, images: activeForm.materialSource === "ai" ? [] : activeTask.media.images, coverImages: [], audioSegments: [], podcast: null, timeline: null }, draft: null, error: null });
    await runPipeline(activeTask, start);
  }

  async function handleSave(): Promise<void> {
    setBusy(true);
    try {
      const active = await ensureTask();
      const savedTask = await persistState(active, { ...taskPatchFromForm(form), status: active.status === "draft" ? "draft" : active.status });
      setTask(savedTask);
      setSaved(true);
    } finally { setBusy(false); }
  }

  async function handleEnqueue(): Promise<void> {
    if (!canStart || busy) return;
    setBusy(true);
    try {
      const active = await ensureTask();
      const start = pipelineStartStep(form.mode);
      const queued = await updateTask(active.id, { ...taskPatchFromForm(form), status: "pending", runState: "idle", currentStep: start, stepStatuses: initialStatuses(form.mode, start), error: null });
      setTask(queued);
      setSaved(true);
    } finally {
      setBusy(false);
    }
  }

  async function handleRunFromStep(step: number): Promise<void> {
    if (!task || busy) return;
    const cleared = await clearTaskFromStep(task.id, step);
    setTask(cleared);
    await runPipeline(cleared, step);
  }

  async function handleContinue(): Promise<void> {
    if (!task || busy) return;
    await runPipeline(task, Math.max(pipelineStartStep(task.mode), task.currentStep));
  }

  function handlePause(): void {
    pauseRequestedRef.current = true;
  }

  function handleCancel(): void {
    cancelRequestedRef.current = true;
    abortRef.current?.abort();
  }

  async function handleSaveArtifact(step: number): Promise<void> {
    if (!task || busy) return;
    setBusy(true);
    try {
      let active = await updateTask(task.id, { artifacts: task.artifacts, title: task.artifacts.rewrite?.title || task.title });
      active = await clearTaskFromStep(active.id, step + 1);
      setTask(active);
      await runPipeline(active, step + 1);
    } finally { setBusy(false); }
  }

  async function regenerateImage(shotId: number): Promise<void> {
    if (!task || busy) return;
    const prompt = task.artifacts.prompts?.prompts.find((item) => item.shotId === shotId);
    if (!prompt) return;
    setBusy(true);
    try {
      const result = await generateMinimaxImages({ taskId: task.id, prompts: [prompt], apiKey: config.minimax.apiKey, aspectRatio: task.aspectRatio, maxImages: 1, track: task.track, visualStyle: task.visualStyle });
      const image = result.images[0] as StoredImage | undefined;
      if (!image?.path) throw new Error(image?.error || "重画失败");
      const images = [...task.media.images.filter((item) => item.shotId !== shotId), { ...image, status: "ready" as const }].sort((a, b) => a.shotId - b.shotId);
      const statuses = [...task.stepStatuses]; statuses[6] = "pending";
      setTask(await updateTask(task.id, { media: { ...task.media, images }, draft: null, stepStatuses: statuses }));
    } catch (error) { window.alert(error instanceof Error ? error.message : "重画失败"); } finally { setBusy(false); }
  }

  async function replaceImage(shotId: number, file: File): Promise<void> {
    if (!task) return;
    setBusy(true);
    try {
      const asset = await uploadTaskAsset(task.id, file, "images");
      const prompt = task.artifacts.prompts?.prompts.find((item) => item.shotId === shotId)?.prompt || "本地替换图片";
      const replacement: StoredImage = { id: `upload-${shotId}-${Date.now()}`, shotId, prompt, ...asset, status: "ready" };
      const images = [...task.media.images.filter((image) => image.shotId !== shotId), replacement].sort((a, b) => a.shotId - b.shotId);
      setTask(await updateTask(task.id, { media: { ...task.media, images }, draft: null }));
    } finally { setBusy(false); }
  }

  async function borrowImage(shotId: number): Promise<void> {
    if (!task) return;
    const index = task.media.images.findIndex((image) => image.shotId === shotId);
    const neighbor = task.media.images.slice(0, index).reverse().find((image) => image.path) || task.media.images.slice(index + 1).find((image) => image.path);
    if (!neighbor) { window.alert("没有可借用的相邻画面"); return; }
    const images = task.media.images.map((image) => image.shotId === shotId ? { ...neighbor, id: `borrow-${shotId}-${Date.now()}`, shotId, prompt: image.prompt, status: "borrowed" as const, borrowedFrom: neighbor.shotId } : image);
    setTask(await updateTask(task.id, { media: { ...task.media, images }, draft: null }));
  }

  async function repairFailedImages(): Promise<void> {
    if (!task || busy) return;
    const failed = task.media.images.filter((item) => item.status === "failed");
    const prompts = failed.map((image) => task.artifacts.prompts?.prompts.find((item) => item.shotId === image.shotId)).filter((item): item is NonNullable<typeof item> => Boolean(item));
    if (!prompts.length) return;
    setBusy(true);
    try {
      const result = await generateMinimaxImages({ taskId: task.id, prompts, apiKey: config.minimax.apiKey, aspectRatio: task.aspectRatio, maxImages: prompts.length, track: task.track, visualStyle: task.visualStyle });
      const repaired = new Map(result.images.map((image) => [image.shotId, { ...image, status: image.path ? "ready" as const : "failed" as const } as StoredImage]));
      const images = task.media.images.map((image) => repaired.get(image.shotId) || image);
      const statuses = [...task.stepStatuses]; statuses[6] = "pending";
      setTask(await updateTask(task.id, { media: { ...task.media, images }, draft: null, stepStatuses: statuses }));
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "失败图片修复失败");
    } finally {
      setBusy(false);
    }
  }

  async function regenerateAudio(shotId: number): Promise<void> {
    if (!task || busy) return;
    const current = task.media.audioSegments.find((item) => item.shotId === shotId);
    const shot = task.artifacts.storyboard?.shots.find((item) => item.id === shotId);
    if (!current && !shot) return;
    setBusy(true);
    const controller = new AbortController();
    try {
      const segment = await synthesizeSegment(task, shotId, current?.text || shot?.text || "", current?.voiceId || task.options.ttsVoiceId || form.ttsVoiceId, controller.signal, current?.speaker);
      const audioSegments = [...task.media.audioSegments.filter((item) => item.id !== current?.id), segment].sort((a, b) => a.shotId - b.shotId);
      if (task.videoForm === "podcast") {
        let cursor = 0;
        const podcastSegments = audioSegments.map((item) => {
          const next = { ...item, startSec: cursor };
          cursor += next.durationSec;
          return next;
        });
        const timeline = podcastSegments.map((item) => ({ shotId: item.shotId, text: `${item.speaker ? `[${item.speaker}] ` : ""}${item.text}`, startSec: item.startSec || 0, endSec: (item.startSec || 0) + item.durationSec, durationSec: item.durationSec }));
        setTask(await updateTask(task.id, { media: { ...task.media, audioSegments: podcastSegments, podcast: { segments: podcastSegments, totalDurationSec: cursor }, timeline }, draft: null }));
      } else {
        const durations = new Map(audioSegments.map((item) => [item.shotId, item.durationSec]));
        const timeline = timelineFromShots(task.artifacts.storyboard?.shots || [], durations);
        setTask(await updateTask(task.id, { media: { ...task.media, audioSegments, timeline }, draft: null }));
      }
    } catch (error) { window.alert(error instanceof Error ? error.message : "重配失败"); } finally { setBusy(false); }
  }

  async function updateImageCrop(shotId: number, crop: NonNullable<StoredImage["crop"]>): Promise<void> {
    if (!task) return;
    const images = task.media.images.map((image) => image.shotId === shotId ? { ...image, crop } : image);
    setTask(await updateTask(task.id, { media: { ...task.media, images }, draft: null }));
  }

  async function updateTimelineEntry(index: number, patch: Partial<TaskTimelineEntry>): Promise<void> {
    if (!task?.media.timeline) return;
    const timeline = task.media.timeline.map((item, itemIndex) => {
      if (itemIndex !== index) return item;
      const next = { ...item, ...patch };
      next.durationSec = Math.max(0.1, next.endSec - next.startSec);
      return next;
    });
    setTask(await updateTask(task.id, { media: { ...task.media, timeline }, draft: null }));
  }

  async function repackDraft(): Promise<void> {
    if (!task || busy) return;
    setBusy(true);
    try { setTask(await buildTaskDraft(task.id)); } catch (error) { window.alert(error instanceof Error ? error.message : "剪映草稿生成失败"); } finally { setBusy(false); }
  }

  async function uploadImages(files: FileList): Promise<void> {
    setBusy(true);
    try {
      let active = await ensureTask();
      const images = [...active.media.images];
      for (const [index, file] of [...files].entries()) {
        const asset = await uploadTaskAsset(active.id, file, "images");
        const shotId = index + 1;
        const replacement: StoredImage = { id: `upload-${shotId}-${Date.now()}`, shotId, prompt: "本地素材", ...asset, status: "ready" };
        const existingIndex = images.findIndex((image) => image.shotId === shotId);
        if (existingIndex >= 0) images.splice(existingIndex, 1, replacement);
        else images.push(replacement);
      }
      active = await updateTask(active.id, { media: { ...active.media, images } });
      setTask(active);
    } finally { setBusy(false); }
  }

  async function uploadReference(file: File): Promise<void> {
    setBusy(true); try { const active = await ensureTask(); const asset = await uploadTaskAsset(active.id, file, "uploads"); setTask(await updateTask(active.id, { options: { ...active.options, referenceImage: asset } })); } finally { setBusy(false); }
  }
  async function uploadExternalAudio(file: File): Promise<void> {
    setBusy(true); try { const active = await ensureTask(); const asset = await uploadTaskAsset(active.id, file, "audio"); setTask(await updateTask(active.id, { media: { ...active.media, externalAudio: asset } })); } finally { setBusy(false); }
  }
  async function uploadBgm(file: File): Promise<void> {
    setBusy(true); try { const active = await ensureTask(); const asset = await uploadTaskAsset(active.id, file, "audio"); setTask(await updateTask(active.id, { media: { ...active.media, bgm: asset } })); } finally { setBusy(false); }
  }

  useEffect(() => {
    queuedRunRef.current = () => {
      if (task?.status === "pending") void handleStart();
      else void handleContinue();
    };
  });

  useEffect(() => {
    if (!autoRun || loading || busy || !task || autoStartedRef.current === task.id) return;
    if (!["pending", "paused", "failed", "cancelled"].includes(task.status)) return;
    autoStartedRef.current = task.id;
    queuedRunRef.current();
  }, [autoRun, busy, loading, task]);

  if (loading) return <main className="task-builder"><div className="task-builder__inner"><div className="builder-card"><h2>正在恢复任务…</h2><p>从本地任务目录读取文案、图片、音频和断点。</p></div></div></main>;

  return (
    <main className="task-builder">
      <div className="task-builder__inner">
        <header className="task-builder__header"><span className="task-builder__header-icon">✧</span><div><h1>{task ? "任务详情与产物工作台" : "创建视频任务"}</h1><p>{task ? "所有中间产物已落盘，可编辑、局部重跑和重新打包" : "粘贴或创作文案，按原版七步流程生成剪映草稿"}</p></div></header>
        <div className={`credential-warning ${hasTtsCredentials && hasLlmCredentials ? "credential-warning--ready" : "credential-warning--partial"}`}><span className="credential-warning__icon">▽</span><div className="credential-warning__copy"><strong>{hasTtsCredentials && hasLlmCredentials ? "LLM、MiniMax 图片与 TTS 已就绪" : "还有必要的本地凭据未配置"}</strong><span>{hasLlmCredentials ? `原版 ${llmCredentialStatus.promptLibrary?.sourceVersion || "1.13.1"} 提示词库已接入` : "缺少 LLM API Key"} · {hasTtsCredentials ? "TTS 可用" : "缺少 TTS 凭据"}</span></div><button type="button" onClick={onNavigateSettings}>前往设置 →</button></div>

        {!task || task.runState === "idle" || task.status === "draft" ? <TaskCreateForm form={form} voices={availableVoices} hasLlmCredentials={hasLlmCredentials} hasTtsCredentials={hasTtsCredentials} aiGenerating={aiGenerating} taskReady={Boolean(task)} referenceName={task?.options.referenceImage?.fileName} externalAudioName={task?.media.externalAudio?.fileName} bgmName={task?.media.bgm?.fileName} onChange={changeForm} onGenerateCopy={() => void handleGenerateCopy()} onUploadImages={(files) => void uploadImages(files)} onUploadReference={(file) => void uploadReference(file)} onUploadExternalAudio={(file) => void uploadExternalAudio(file)} onUploadBgm={(file) => void uploadBgm(file)} /> : null}
        {task ? <TaskWorkbench task={task} busy={busy} onTaskChange={setTask} onPause={handlePause} onContinue={() => void handleContinue()} onCancel={handleCancel} onRunFromStep={(step) => void handleRunFromStep(step)} onSaveArtifact={(step) => void handleSaveArtifact(step)} onRegenerateImage={(shotId) => void regenerateImage(shotId)} onUploadImage={(shotId, file) => void replaceImage(shotId, file)} onBorrowImage={(shotId) => void borrowImage(shotId)} onRepairFailedImages={() => void repairFailedImages()} onRegenerateAudio={(shotId) => void regenerateAudio(shotId)} onUpdateImageCrop={(shotId, crop) => void updateImageCrop(shotId, crop)} onUpdateTimeline={(index, patch) => void updateTimelineEntry(index, patch)} onRepackDraft={() => void repackDraft()} /> : null}
      </div>
      <footer className="task-builder__footer"><div className="task-builder__footer-inner"><div className="footer-status"><span className={canStart ? "is-ready" : ""}>{busy ? "正在处理并写入任务目录…" : saved ? "所有更改已保存" : task ? `任务 ${task.id.slice(0, 8)} · ${task.status}` : canStart ? "文案长度已满足" : "请输入至少 10 字文案"}</span></div><div className="footer-actions"><button type="button" className="secondary-button" disabled={busy} onClick={() => void handleSave()}>保存草稿</button>{!task || task.status === "draft" ? <button type="button" className="secondary-button" disabled={!canStart || busy} onClick={() => void handleEnqueue()}>加入队列</button> : null}{!task || task.status === "draft" || task.status === "pending" ? <button type="button" className="start-button" disabled={!canStart || busy} onClick={() => void handleStart()}><span>▶</span>{task?.status === "pending" ? "立即执行" : "开始制作"}</button> : task.runState === "completed" ? <button type="button" className="start-button" disabled={busy} onClick={() => void repackDraft()}>重新打包草稿</button> : null}</div></div></footer>
    </main>
  );
}
