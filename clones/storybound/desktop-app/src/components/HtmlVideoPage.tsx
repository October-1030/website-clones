import { useEffect, useMemo, useRef, useState } from "react";
import { defaultLlmConfig } from "../data/llm-data";
import { availableMinimaxVoices, defaultTtsConfig, speedPresets } from "../data/tts-data";
import { generateMinimaxImages } from "../lib/image-api";
import { createAiCopy, runLlmPipelineStep } from "../lib/llm-api";
import {
  cancelMediaJob,
  createMediaJob,
  fetchMediaWorkbenchCapabilities,
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
  type HtmlVideoManifest,
  type HtmlVideoScene,
  type MediaWorkbenchAsset,
  type MediaWorkbenchCapabilities,
  type MediaWorkbenchJob,
  type MediaWorkbenchJobSummary,
} from "../types/media-workbench";
import type { TtsConfig } from "../types/tts";
import "./HtmlVideoPage.css";

interface HtmlVideoPageProps {
  llmConfig?: LlmConfig;
  ttsConfig?: TtsConfig;
}

type EntryMode = "ai-topic" | "paste";
type SceneCountMode = "auto" | "manual";
type BgmMode = "off" | "local";
type BgmVolume = "soft" | "medium" | "loud";
type TransitionPreset = "none" | "fade" | "dissolve" | "wipe" | "slide" | "circle";
type WorkbenchTab = "text" | "assets" | "voice" | "preview" | "output" | "history";

interface ForegroundLayer {
  id: string;
  prompt: string;
  asset?: MediaWorkbenchAsset;
  hidden?: boolean;
  status?: "pending" | "generating" | "ready" | "failed";
  error?: string;
}

interface HtmlVideoSceneV117 extends HtmlVideoScene {
  background?: MediaWorkbenchAsset;
  foregrounds?: ForegroundLayer[];
  captions?: string[];
  titleHidden?: boolean;
  subtitleHidden?: boolean;
}

interface HtmlWorkflowSettings {
  entryMode: EntryMode;
  useAiRewrite: boolean;
  foregroundEnabled: boolean;
  sceneCountMode: SceneCountMode;
  manualSceneCount: number;
  transition: TransitionPreset;
  voiceId: string;
  ttsSpeed: number;
  bgmMode: BgmMode;
  bgmVolume: BgmVolume;
  bgmAsset?: MediaWorkbenchAsset;
  titleScale: number;
  titlePosition: number;
  subtitleScale: number;
  subtitlePosition: number;
}

type HtmlVideoManifestV117 = Omit<HtmlVideoManifest, "scenes"> & {
  scenes: HtmlVideoSceneV117[];
  workflow?: HtmlWorkflowSettings;
};

type HtmlVideoJobV117 = MediaWorkbenchJob<HtmlVideoManifestV117>;

interface TopicCategory {
  id: string;
  label: string;
  blurb: string;
}

const visualStyles = ["黑白摄影", "写实彩色", "油画风格", "现代电影", "古风电影", "复古胶片", "水彩治愈", "杂志插画"];
const stageLabels = [
  { name: "改写 + 分句", sub: "口播版 + 切分场景", tab: "text" as WorkbenchTab },
  { name: "场景规划", sub: "版式 / 标题 / 字幕 / 提示词", tab: "text" as WorkbenchTab },
  { name: "素材（图片）", sub: "背景图 / 前景素材", tab: "assets" as WorkbenchTab },
  { name: "配音", sub: "逐场 TTS 旁白", tab: "voice" as WorkbenchTab },
  { name: "动画预览", sub: "9:16 优先 · 连续播放", tab: "preview" as WorkbenchTab },
  { name: "出片", sub: "真实渲染 / 导出 / 恢复", tab: "output" as WorkbenchTab },
];
const workbenchTabs: Array<{ key: WorkbenchTab; label: string }> = [
  { key: "text", label: "文案" },
  { key: "assets", label: "素材" },
  { key: "voice", label: "配音" },
  { key: "preview", label: "动画预览" },
  { key: "output", label: "出片" },
  { key: "history", label: "历史" },
];
const topicCategories: TopicCategory[] = [
  { id: "finance", label: "财商理财", blurb: "认知差 · 反常识 · 干货" },
  { id: "cognition", label: "认知人性", blurb: "思维差 · 人性真相 · 成长" },
  { id: "career", label: "职场干货", blurb: "扎心结论 · 清单 · 过来人" },
  { id: "emotion", label: "情感两性", blurb: "共鸣 · 洞察 · 不说教" },
  { id: "culture", label: "文化民俗", blurb: "冷知识 · 典故 · 情怀" },
  { id: "health", label: "养生健康", blurb: "误区 · 温和建议 · 合规" },
  { id: "history", label: "历史冷知识", blurb: "反差 · 考据 · 课本没讲" },
];
const transitionLabels: Record<TransitionPreset, string> = {
  none: "无 · 硬切",
  fade: "淡化",
  dissolve: "溶解",
  wipe: "横擦",
  slide: "滑动",
  circle: "圆形",
};
const defaultWorkflow: HtmlWorkflowSettings = {
  entryMode: "paste",
  useAiRewrite: true,
  foregroundEnabled: true,
  sceneCountMode: "auto",
  manualSceneCount: 8,
  transition: "none",
  voiceId: defaultTtsConfig.minimax.voiceId,
  ttsSpeed: 1,
  bgmMode: "off",
  bgmVolume: "medium",
  titleScale: 100,
  titlePosition: 18,
  subtitleScale: 100,
  subtitlePosition: 84,
};
const lastJobStorageKey = "storybound:html-video:last-job";

function splitByPunctuation(value: string): string[] {
  return value
    .replace(/\r/g, "")
    .split(/(?<=[。！？!?；;])|\n+/u)
    .map((part) => part.trim())
    .filter(Boolean)
    .slice(0, 60);
}

function splitCaptions(value: string): string[] {
  const parts = value
    .split(/(?<=[，。！？!?；;、])|\n+/u)
    .map((part) => part.trim())
    .filter(Boolean);
  return parts.length ? parts.slice(0, 8) : value.trim() ? [value.trim()] : [];
}

function redistributeText(value: string, requested: number): string[] {
  const pieces = splitByPunctuation(value);
  const target = Math.max(3, Math.min(60, Math.round(requested)));
  if (!pieces.length || pieces.length === target) return pieces;
  const compact = pieces.join("");
  const result: string[] = [];
  let cursor = 0;
  for (let index = 0; index < target; index += 1) {
    const remainingSlots = target - index;
    const remainingChars = compact.length - cursor;
    const idealEnd = cursor + Math.max(1, Math.ceil(remainingChars / remainingSlots));
    let end = Math.min(compact.length, idealEnd);
    if (end < compact.length) {
      const lookAhead = compact.slice(end, Math.min(compact.length, end + 18));
      const punctuation = lookAhead.search(/[，。！？!?；;、]/u);
      if (punctuation >= 0) end += punctuation + 1;
    }
    result.push(compact.slice(cursor, end).trim());
    cursor = end;
  }
  if (cursor < compact.length) result[result.length - 1] += compact.slice(cursor);
  return result.filter(Boolean);
}

function foregroundSlotCount(layout: HtmlLayoutPreset): number {
  if (["full-image", "full-quote"].includes(layout)) return 0;
  if (layout === "grid-four") return 4;
  if (layout === "three-float") return 3;
  if (layout === "split-compare") return 2;
  return 1;
}

function createForegrounds(sceneText: string, layout: HtmlLayoutPreset): ForegroundLayer[] {
  return Array.from({ length: foregroundSlotCount(layout) }, (_, index) => ({
    id: `fg-${index + 1}`,
    prompt: `${sceneText.slice(0, 28)}中的核心主体${index ? `，辅助元素 ${index + 1}` : ""}`,
    status: "pending",
  }));
}

function createScene(
  text: string,
  index: number,
  visualStyle: string,
  options?: { title?: string; prompt?: string; foregroundEnabled?: boolean },
): HtmlVideoSceneV117 {
  const clean = text.replace(/\s+/g, " ").trim();
  const layout: HtmlLayoutPreset = index % 4 === 0
    ? "center-focus"
    : index % 4 === 1
      ? "person-focus"
      : index % 4 === 2
        ? "rule-of-thirds"
        : "full-image";
  return {
    id: index + 1,
    title: options?.title?.trim() || clean.slice(0, 10),
    subtitle: clean,
    captions: splitCaptions(clean),
    prompt: options?.prompt || `${visualStyle}，竖屏短视频背景画面，${clean}，主体清晰，构图有层次，无文字，无水印`,
    layout,
    subtitleStyle: "translucent",
    animation: index % 2 === 0 ? "rise" : "breathe",
    foregrounds: options?.foregroundEnabled ? createForegrounds(clean, layout) : [],
    status: "pending",
  };
}

function dimensions(aspectRatio: "9:16" | "16:9") {
  return aspectRatio === "16:9"
    ? { width: 1920, height: 1080 }
    : { width: 1080, height: 1920 };
}

function freshManifest(
  sourceText: string,
  visualStyle: string,
  aspectRatio: "9:16" | "16:9",
  scenes: HtmlVideoSceneV117[],
  workflow: HtmlWorkflowSettings,
  rewrittenText?: string,
): HtmlVideoManifestV117 {
  const timestamp = new Date().toISOString();
  const size = dimensions(aspectRatio);
  return {
    schemaVersion: 1,
    kind: "html-video",
    title: (rewrittenText || sourceText).replace(/\s+/g, " ").slice(0, 24) || "HTML 动画视频",
    sourceText,
    rewrittenText,
    visualStyle,
    aspectRatio,
    width: size.width,
    height: size.height,
    fps: 30,
    scenes,
    workflow,
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

function normalizeScene(scene: HtmlVideoScene): HtmlVideoSceneV117 {
  const extended = scene as HtmlVideoSceneV117;
  return {
    ...extended,
    background: extended.background || scene.image,
    captions: extended.captions?.length ? extended.captions : splitCaptions(scene.subtitle),
    foregrounds: extended.foregrounds || [],
  };
}

function normalizeManifest(manifest: HtmlVideoManifestV117): HtmlVideoManifestV117 {
  return {
    ...manifest,
    scenes: manifest.scenes.map(normalizeScene),
    workflow: { ...defaultWorkflow, ...manifest.workflow },
  };
}

function sceneHasVisual(scene: HtmlVideoSceneV117, foregroundEnabled: boolean): boolean {
  if (!(scene.background?.path || scene.image?.path)) return false;
  if (!foregroundEnabled) return true;
  const required = foregroundSlotCount(scene.layout);
  if (!required) return true;
  const layers = scene.foregrounds || [];
  return layers.length >= required && layers.slice(0, required).every((layer) => Boolean(layer.asset?.path));
}

function sceneStatusLabel(scene: HtmlVideoSceneV117, foregroundEnabled: boolean): string {
  if (scene.status === "generating") return "生成中";
  if (scene.status === "failed") return "失败";
  const visual = sceneHasVisual(scene, foregroundEnabled) ? "图✓" : "缺图";
  const audio = scene.audio?.path ? "声✓" : "缺声";
  return `${visual} · ${audio}`;
}

function escapeFileTitle(value: string): string {
  return value.replace(/[\\/:*?"<>|]/gu, "-").replace(/\s+/g, "-").slice(0, 36) || "html-scene";
}

async function bitmapFromAsset(asset: MediaWorkbenchAsset): Promise<ImageBitmap> {
  if (!asset.url) throw new Error(`资源 ${asset.fileName} 没有可读取 URL`);
  const response = await fetch(asset.url, { cache: "no-store" });
  if (!response.ok) throw new Error(`读取 ${asset.fileName} 失败（HTTP ${response.status}）`);
  return createImageBitmap(await response.blob());
}

function drawCover(context: CanvasRenderingContext2D, bitmap: ImageBitmap, width: number, height: number) {
  const scale = Math.max(width / bitmap.width, height / bitmap.height);
  const drawWidth = bitmap.width * scale;
  const drawHeight = bitmap.height * scale;
  context.drawImage(bitmap, (width - drawWidth) / 2, (height - drawHeight) / 2, drawWidth, drawHeight);
}

function foregroundPlacement(layout: HtmlLayoutPreset, slot: number) {
  const placements: Record<string, Array<[number, number, number]>> = {
    "left-right-text-object": [[0.70, 0.52, 0.38]],
    "person-focus": [[0.50, 0.58, 0.52]],
    "top-object-bottom-text": [[0.50, 0.31, 0.54]],
    "three-float": [[0.28, 0.40, 0.30], [0.66, 0.34, 0.28], [0.48, 0.62, 0.34]],
    "split-compare": [[0.28, 0.55, 0.40], [0.72, 0.55, 0.40]],
    "grid-four": [[0.30, 0.42, 0.34], [0.70, 0.42, 0.34], [0.30, 0.68, 0.34], [0.70, 0.68, 0.34]],
    "rule-of-thirds": [[0.70, 0.56, 0.50]],
    "data-emphasis": [[0.50, 0.68, 0.40]],
    "quote-card": [[0.50, 0.36, 0.30]],
    "center-focus": [[0.50, 0.58, 0.42]],
  };
  return placements[layout]?.[slot] || [0.50, 0.56, 0.42];
}

function drawForeground(
  context: CanvasRenderingContext2D,
  bitmap: ImageBitmap,
  width: number,
  height: number,
  placement: [number, number, number],
) {
  const targetWidth = width * placement[2];
  const targetHeight = targetWidth * (bitmap.height / bitmap.width);
  const maxHeight = height * 0.52;
  const scale = targetHeight > maxHeight ? maxHeight / targetHeight : 1;
  const drawWidth = targetWidth * scale;
  const drawHeight = targetHeight * scale;
  context.drawImage(
    bitmap,
    width * placement[0] - drawWidth / 2,
    height * placement[1] - drawHeight / 2,
    drawWidth,
    drawHeight,
  );
}

function canvasBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("无法生成场景合成图")), "image/png");
  });
}

export function HtmlVideoPage({ llmConfig = defaultLlmConfig, ttsConfig = defaultTtsConfig }: HtmlVideoPageProps) {
  const [entryMode, setEntryMode] = useState<EntryMode>("paste");
  const [sourceText, setSourceText] = useState("");
  const [useAiRewrite, setUseAiRewrite] = useState(true);
  const [topicCategory, setTopicCategory] = useState(topicCategories[0].id);
  const [topic, setTopic] = useState("");
  const [targetWords, setTargetWords] = useState(400);
  const [topicRequirement, setTopicRequirement] = useState("");
  const [visualStyle, setVisualStyle] = useState("现代电影");
  const [aspectRatio, setAspectRatio] = useState<"9:16" | "16:9">("9:16");
  const [foregroundEnabled, setForegroundEnabled] = useState(true);
  const [sceneCountMode, setSceneCountMode] = useState<SceneCountMode>("auto");
  const [manualSceneCount, setManualSceneCount] = useState(8);
  const [job, setJob] = useState<HtmlVideoJobV117 | null>(null);
  const [scenes, setScenes] = useState<HtmlVideoSceneV117[]>([]);
  const [workflow, setWorkflow] = useState<HtmlWorkflowSettings>({
    ...defaultWorkflow,
    voiceId: ttsConfig.minimax.voiceId || defaultWorkflow.voiceId,
  });
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [selectedForegroundIndex, setSelectedForegroundIndex] = useState(0);
  const [activeTab, setActiveTab] = useState<WorkbenchTab>("text");
  const [recentJobs, setRecentJobs] = useState<MediaWorkbenchJobSummary[]>([]);
  const [capabilities, setCapabilities] = useState<MediaWorkbenchCapabilities | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("选择 AI 命题创作或粘贴文案；真实服务失败时会直接显示错误。");
  const [error, setError] = useState("");
  const [previewPlaying, setPreviewPlaying] = useState(false);
  const [previewProgress, setPreviewProgress] = useState(0);
  const [previewRun, setPreviewRun] = useState(0);
  const abortRef = useRef<AbortController | null>(null);
  const backgroundUploadRef = useRef<HTMLInputElement | null>(null);
  const foregroundUploadRef = useRef<HTMLInputElement | null>(null);
  const bgmUploadRef = useRef<HTMLInputElement | null>(null);
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);
  const previewRef = useRef<HTMLDivElement | null>(null);
  const autosaveRef = useRef<number | null>(null);

  const selectedScene = scenes[selectedIndex];
  const readyVisuals = scenes.filter((scene) => sceneHasVisual(scene, workflow.foregroundEnabled)).length;
  const readyAudio = scenes.filter((scene) => scene.audio?.path && Number(scene.audio.durationSec) > 0).length;
  const stageIndex = job?.status === "completed"
    ? 5
    : readyAudio === scenes.length && scenes.length > 0
      ? 4
      : readyAudio > 0
        ? 3
        : readyVisuals > 0
          ? 2
          : scenes.length > 0
            ? 1
            : 0;

  const voiceOptions = useMemo(() => {
    return availableMinimaxVoices(ttsConfig);
  }, [ttsConfig]);

  const activeTtsConfig = useMemo<TtsConfig>(() => ({
    ...ttsConfig,
    provider: "minimax",
    minimax: { ...ttsConfig.minimax, voiceId: workflow.voiceId },
  }), [ttsConfig, workflow.voiceId]);

  const currentWorkflow = useMemo<HtmlWorkflowSettings>(() => ({
    ...workflow,
    entryMode,
    useAiRewrite,
    foregroundEnabled,
    sceneCountMode,
    manualSceneCount,
  }), [entryMode, foregroundEnabled, manualSceneCount, sceneCountMode, useAiRewrite, workflow]);

  function buildManifest(
    activeJob: HtmlVideoJobV117,
    nextScenes: HtmlVideoSceneV117[] = scenes,
    nextWorkflow: HtmlWorkflowSettings = currentWorkflow,
  ): HtmlVideoManifestV117 {
    const size = dimensions(activeJob.manifest.aspectRatio);
    return {
      ...activeJob.manifest,
      title: activeJob.title,
      visualStyle,
      width: size.width,
      height: size.height,
      scenes: nextScenes,
      workflow: nextWorkflow,
      updatedAt: new Date().toISOString(),
    };
  }

  function hydrateJob(restoredInput: HtmlVideoJobV117, restoredMessage: string) {
    const manifest = normalizeManifest(restoredInput.manifest);
    const restored = { ...restoredInput, manifest };
    const restoredWorkflow = { ...defaultWorkflow, ...manifest.workflow };
    setJob(restored);
    setScenes(manifest.scenes);
    setSourceText(manifest.sourceText);
    setVisualStyle(manifest.visualStyle);
    setAspectRatio(manifest.aspectRatio);
    setEntryMode(restoredWorkflow.entryMode);
    setUseAiRewrite(restoredWorkflow.useAiRewrite);
    setForegroundEnabled(restoredWorkflow.foregroundEnabled);
    setSceneCountMode(restoredWorkflow.sceneCountMode);
    setManualSceneCount(restoredWorkflow.manualSceneCount);
    setWorkflow(restoredWorkflow);
    setSelectedIndex(0);
    setSelectedForegroundIndex(0);
    setActiveTab(restored.status === "completed" ? "output" : "text");
    setMessage(restoredMessage);
    localStorage.setItem(lastJobStorageKey, restored.id);
  }

  async function refreshHistory(signal?: AbortSignal) {
    const payload = await listMediaJobs(signal);
    const items = payload.jobs.filter((item) => item.kind === "html-video").slice(0, 20);
    setRecentJobs(items);
    return items;
  }

  useEffect(() => {
    const controller = new AbortController();
    Promise.allSettled([
      fetchMediaWorkbenchCapabilities(controller.signal).then(setCapabilities),
      refreshHistory(controller.signal),
    ]).then(async (results) => {
      if (controller.signal.aborted) return;
      const capabilityResult = results[0];
      const historyResult = results[1];
      if (capabilityResult.status === "rejected") {
        setError(`本地媒体工作台不可用：${capabilityResult.reason instanceof Error ? capabilityResult.reason.message : "无法读取能力"}`);
      }
      if (historyResult.status === "rejected") {
        setError(`无法恢复 HTML 任务历史：${historyResult.reason instanceof Error ? historyResult.reason.message : "请求失败"}`);
        return;
      }
      const lastId = localStorage.getItem(lastJobStorageKey);
      if (!lastId || !historyResult.value.some((item) => item.id === lastId)) return;
      try {
        const restored = await getMediaJob<HtmlVideoManifestV117>(lastId, controller.signal) as HtmlVideoJobV117;
        if (!controller.signal.aborted) hydrateJob(restored, "已自动恢复上次 HTML 动画任务及其断点。");
      } catch (reason) {
        if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : "自动恢复任务失败");
      }
    });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (!job || busy) return;
    if (autosaveRef.current !== null) window.clearTimeout(autosaveRef.current);
    autosaveRef.current = window.setTimeout(() => {
      const manifest = buildManifest(job);
      updateMediaJob<HtmlVideoManifestV117>(job.id, { title: job.title, manifest })
        .then((updated) => setJob((current) => current?.id === updated.id ? { ...updated, manifest: normalizeManifest(updated.manifest) } : current))
        .catch((reason: unknown) => setError(reason instanceof Error ? `自动保存失败：${reason.message}` : "自动保存失败"));
    }, 750);
    return () => {
      if (autosaveRef.current !== null) window.clearTimeout(autosaveRef.current);
    };
  // Autosave deliberately keys on the editable fields instead of the returned job object;
  // depending on the response object would re-trigger itself whenever updatedAt changes.
  // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [busy, currentWorkflow, job?.id, scenes, visualStyle]);

  useEffect(() => {
    const preview = previewRef.current;
    if (!preview) return;
    preview.style.setProperty("--html-title-scale", String(workflow.titleScale / 100));
    preview.style.setProperty("--html-title-top", `${workflow.titlePosition}%`);
    preview.style.setProperty("--html-subtitle-scale", String(workflow.subtitleScale / 100));
    preview.style.setProperty("--html-subtitle-bottom", `${100 - workflow.subtitlePosition}%`);
  }, [workflow.subtitlePosition, workflow.subtitleScale, workflow.titlePosition, workflow.titleScale]);

  useEffect(() => {
    if (!previewPlaying || !selectedScene) return;
    const durationMs = Math.max(1500, Number(selectedScene.audio?.durationSec || selectedScene.durationSec || 4) * 1000);
    const started = performance.now();
    setPreviewProgress(0);
    void previewAudioRef.current?.play().catch(() => undefined);
    const timer = window.setInterval(() => {
      const elapsed = performance.now() - started;
      setPreviewProgress(Math.min(100, elapsed / durationMs * 100));
      if (elapsed < durationMs) return;
      window.clearInterval(timer);
      setSelectedIndex((current) => {
        if (current < scenes.length - 1) return current + 1;
        setPreviewPlaying(false);
        return current;
      });
      setPreviewRun((current) => current + 1);
    }, 100);
    return () => window.clearInterval(timer);
  }, [previewPlaying, previewRun, scenes.length, selectedIndex, selectedScene]);

  async function restoreJob(jobId: string) {
    setBusy(true);
    setError("");
    try {
      const restored = await getMediaJob<HtmlVideoManifestV117>(jobId) as HtmlVideoJobV117;
      hydrateJob(restored, restored.status === "completed" ? "已恢复真实成片及全部配置。" : "已恢复断点，可从任一阶段继续。");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "恢复任务失败");
    } finally {
      setBusy(false);
    }
  }

  async function composeTopicCopy() {
    if (busy) {
      abortRef.current?.abort();
      return;
    }
    const cleanTopic = topic.trim();
    if (cleanTopic.length < 2) {
      setError("请先填写命题 / 主题");
      return;
    }
    const controller = new AbortController();
    abortRef.current = controller;
    setBusy(true);
    setError("");
    setMessage("正在调用已配置 LLM 从命题创作完整口播文案…");
    try {
      const category = topicCategories.find((item) => item.id === topicCategory) || topicCategories[0];
      const context: PipelineContext = {
        title: cleanTopic,
        inputText: `${cleanTopic}\n题材：${category.label}（${category.blurb}）${topicRequirement.trim() ? `\n额外要求：${topicRequirement.trim()}` : ""}`,
        track: "通用故事",
        videoForm: "narration",
        visualStyle,
        aspectRatio,
        sourceMode: "ai",
        targetLength: Math.max(100, Math.min(3000, targetWords)),
        ttsMode: "original-segmented",
      };
      const result = await createAiCopy({ config: llmConfig, context, signal: controller.signal });
      const narration = result.data.narration.trim();
      if (!narration) throw new Error("AI 没有返回文案，请重试或检查 LLM 配置");
      setSourceText(narration);
      setEntryMode("paste");
      setUseAiRewrite(false);
      setMessage(`AI 已真实生成 ${narration.replace(/\s/g, "").length} 字文案；已切到“直接用原文”，可编辑后规划。`);
    } catch (reason) {
      if ((reason as Error).name !== "AbortError") setError(reason instanceof Error ? reason.message : "AI 命题创作失败");
    } finally {
      abortRef.current = null;
      setBusy(false);
    }
  }

  async function planScenes(signal?: AbortSignal): Promise<HtmlVideoJobV117> {
    const input = sourceText.trim();
    if (input.length < 10) throw new Error("请至少输入 10 个字的完整文案；只有主题请使用 AI 命题创作");
    setMessage(useAiRewrite ? "正在改写、分句并规划场景…" : "正在保留原文并规划场景…");
    const context: PipelineContext = {
      title: input.slice(0, 24),
      inputText: input,
      track: "通用故事",
      videoForm: "narration",
      visualStyle,
      aspectRatio,
      sourceMode: "paste",
      targetScenes: sceneCountMode === "manual" ? manualSceneCount : null,
      ttsMode: "original-segmented",
    };
    const artifacts: PipelineLlmArtifacts = {};
    const precheck = await runLlmPipelineStep({ step: "precheck", config: llmConfig, context, artifacts, signal });
    if (precheck.step !== "precheck") throw new Error("LLM 文案预审返回了错误步骤");
    artifacts.precheck = useAiRewrite ? precheck.data : { ...precheck.data, cleanText: input };
    let workingText = input;
    if (useAiRewrite) {
      const rewrite = await runLlmPipelineStep({ step: "rewrite", config: llmConfig, context, artifacts, signal });
      if (rewrite.step !== "rewrite" || !rewrite.data.narration.trim()) throw new Error("LLM 没有返回有效改写文案");
      artifacts.rewrite = rewrite.data;
      workingText = rewrite.data.narration.trim();
    }
    const storyboardContext = { ...context, inputText: workingText };
    const storyboard = await runLlmPipelineStep({ step: "storyboard", config: llmConfig, context: storyboardContext, artifacts, signal });
    if (storyboard.step !== "storyboard" || !storyboard.data.shots.length) throw new Error("LLM 没有返回可用场景规划");
    artifacts.storyboard = storyboard.data;
    const prompts = await runLlmPipelineStep({ step: "prompts", config: llmConfig, context: storyboardContext, artifacts, signal });
    if (prompts.step !== "prompts" || !prompts.data.prompts.length) throw new Error("LLM 没有返回可用绘图提示词");

    let plannedScenes = storyboard.data.shots.map((shot, index) => createScene(shot.text, index, visualStyle, {
      title: shot.visual.slice(0, 10) || shot.text.slice(0, 10),
      prompt: prompts.data.prompts.find((item) => item.shotId === shot.id)?.prompt || prompts.data.prompts[index]?.prompt,
      foregroundEnabled,
    }));
    if (sceneCountMode === "manual" && plannedScenes.length !== manualSceneCount) {
      plannedScenes = redistributeText(workingText, manualSceneCount).map((text, index) => createScene(text, index, visualStyle, {
        foregroundEnabled,
      }));
    }
    if (!plannedScenes.length) throw new Error("没有拆出可用场景，请检查文案或 LLM 配置");
    const nextWorkflow: HtmlWorkflowSettings = {
      ...currentWorkflow,
      entryMode,
      useAiRewrite,
      foregroundEnabled,
      sceneCountMode,
      manualSceneCount,
      voiceId: workflow.voiceId || activeTtsConfig.minimax.voiceId,
    };
    const manifest = freshManifest(input, visualStyle, aspectRatio, plannedScenes, nextWorkflow, workingText === input ? undefined : workingText);
    const created = await createMediaJob({ kind: "html-video", title: manifest.title, manifest }, signal) as HtmlVideoJobV117;
    const staged = await updateMediaJob<HtmlVideoManifestV117>(created.id, {
      manifest,
      stage: "场景规划完成",
      progress: 20,
    }) as HtmlVideoJobV117;
    setJob(staged);
    setScenes(staged.manifest.scenes.map(normalizeScene));
    setWorkflow(nextWorkflow);
    setSelectedIndex(0);
    setSelectedForegroundIndex(0);
    setActiveTab("text");
    localStorage.setItem(lastJobStorageKey, staged.id);
    await refreshHistory(signal);
    setMessage(`已真实规划 ${plannedScenes.length} 个场景；请逐镜检查标题、字幕、版式和提示词，再进入素材阶段。`);
    return staged;
  }

  async function startPlanning() {
    const controller = new AbortController();
    abortRef.current = controller;
    setBusy(true);
    setError("");
    try {
      await planScenes(controller.signal);
    } catch (reason) {
      if ((reason as Error).name !== "AbortError") setError(reason instanceof Error ? reason.message : "场景规划失败");
    } finally {
      abortRef.current = null;
      setBusy(false);
    }
  }

  async function persistDraft(
    activeJob: HtmlVideoJobV117,
    nextScenes: HtmlVideoSceneV117[],
    options?: { stage?: string; progress?: number; signal?: AbortSignal; nextWorkflow?: HtmlWorkflowSettings },
  ): Promise<HtmlVideoJobV117> {
    const manifest = buildManifest(activeJob, nextScenes, options?.nextWorkflow || currentWorkflow);
    const updated = await updateMediaJob<HtmlVideoManifestV117>(activeJob.id, {
      title: activeJob.title,
      manifest,
      ...(options?.stage ? { stage: options.stage } : {}),
      ...(typeof options?.progress === "number" ? { progress: options.progress } : {}),
    }, options?.signal) as HtmlVideoJobV117;
    const normalized = { ...updated, manifest: normalizeManifest(updated.manifest) };
    setJob(normalized);
    setScenes(normalized.manifest.scenes);
    return normalized;
  }

  async function generateBackground(activeJob: HtmlVideoJobV117, scene: HtmlVideoSceneV117, signal?: AbortSignal) {
    setMessage(`正在用 MiniMax 生成第 ${scene.id} 场背景图…`);
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
    if (!generated || generated.status !== "ready" || !generated.path || !generated.url) {
      throw new Error(generated?.error || `第 ${scene.id} 场 MiniMax 背景图生成失败`);
    }
    const asset = mergeAsset({
      fileName: generated.path.split(/[\\/]/u).at(-1),
      path: generated.path,
      url: generated.url,
      bytes: generated.bytes,
      mimeType: "image/jpeg",
    });
    return { ...scene, background: asset, image: asset, status: "pending" as const, error: undefined };
  }

  async function generateForeground(
    activeJob: HtmlVideoJobV117,
    scene: HtmlVideoSceneV117,
    layer: ForegroundLayer,
    slot: number,
    signal?: AbortSignal,
  ): Promise<ForegroundLayer> {
    setMessage(`正在生成第 ${scene.id} 场前景素材 ${slot + 1}…`);
    const response = await generateMinimaxImages({
      taskId: activeJob.id,
      prompts: [{
        shotId: scene.id * 100 + slot + 1,
        prompt: `${visualStyle}，${layer.prompt}，单一主体，完整轮廓，居中构图，背景简洁，无文字，无水印`,
        negativePrompt: "文字，水印，标志，复杂背景，多个重复主体，裁切主体",
      }],
      apiKey: activeTtsConfig.minimax.apiKey,
      aspectRatio: "1:1",
      maxImages: 1,
      track: "通用故事",
      visualStyle,
    }, signal);
    const generated = response.images[0];
    if (!generated || generated.status !== "ready" || !generated.path || !generated.url) {
      throw new Error(generated?.error || `第 ${scene.id} 场前景素材 ${slot + 1} 生成失败`);
    }
    return {
      ...layer,
      asset: mergeAsset({
        fileName: generated.path.split(/[\\/]/u).at(-1),
        path: generated.path,
        url: generated.url,
        bytes: generated.bytes,
        mimeType: "image/jpeg",
      }),
      status: "ready",
      error: undefined,
    };
  }

  async function generateAudio(activeJob: HtmlVideoJobV117, scene: HtmlVideoSceneV117, signal?: AbortSignal) {
    if (!scene.subtitle.trim()) throw new Error(`第 ${scene.id} 场字幕为空，不能配音`);
    setMessage(`正在用 MiniMax 合成第 ${scene.id} 场配音并读取真实时长…`);
    const result = await synthesizeTts({
      provider: "minimax",
      text: scene.subtitle,
      voiceId: workflow.voiceId,
      speed: workflow.ttsSpeed,
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
      status: sceneHasVisual(scene, workflow.foregroundEnabled) ? "ready" as const : "pending" as const,
      error: undefined,
    };
  }

  async function generateAllVisuals() {
    if (!job) return;
    const controller = new AbortController();
    abortRef.current = controller;
    setBusy(true);
    setError("");
    setActiveTab("assets");
    let activeJob = job;
    let workingScenes = scenes.map(normalizeScene);
    try {
      for (let index = 0; index < workingScenes.length; index += 1) {
        let scene: HtmlVideoSceneV117 = { ...workingScenes[index], status: "generating", error: undefined };
        workingScenes[index] = scene;
        setScenes([...workingScenes]);
        try {
          if (!(scene.background?.path || scene.image?.path)) scene = await generateBackground(activeJob, scene, controller.signal);
          if (workflow.foregroundEnabled) {
            const required = foregroundSlotCount(scene.layout);
            const layers = [...(scene.foregrounds || [])];
            while (layers.length < required) layers.push(createForegrounds(scene.subtitle, scene.layout)[layers.length]);
            for (let slot = 0; slot < required; slot += 1) {
              if (!layers[slot].asset?.path) {
                layers[slot] = await generateForeground(activeJob, scene, { ...layers[slot], status: "generating" }, slot, controller.signal);
              }
            }
            scene = { ...scene, foregrounds: layers };
          }
          scene = { ...scene, status: scene.audio?.path ? "ready" : "pending", error: undefined };
        } catch (reason) {
          scene = { ...scene, status: "failed", error: reason instanceof Error ? reason.message : "素材生成失败" };
          workingScenes[index] = scene;
          activeJob = await persistDraft(activeJob, workingScenes, {
            stage: `第 ${scene.id} 场素材失败`,
            progress: 20 + Math.round(index / Math.max(1, workingScenes.length) * 36),
            signal: controller.signal,
          });
          throw reason;
        }
        workingScenes[index] = scene;
        activeJob = await persistDraft(activeJob, workingScenes, {
          stage: `素材 ${index + 1}/${workingScenes.length}`,
          progress: 20 + Math.round((index + 1) / workingScenes.length * 36),
          signal: controller.signal,
        });
        workingScenes = [...activeJob.manifest.scenes];
      }
      setMessage("全部背景和前景素材已真实生成并保存；生成的前景若不是透明 PNG，会按实际矩形画面预览和合成。下一步可逐场配音。");
      setActiveTab("voice");
    } catch (reason) {
      if ((reason as Error).name !== "AbortError") setError(reason instanceof Error ? reason.message : "批量素材生成失败");
    } finally {
      abortRef.current = null;
      setBusy(false);
    }
  }

  async function generateAllAudio() {
    if (!job) return;
    const controller = new AbortController();
    abortRef.current = controller;
    setBusy(true);
    setError("");
    setActiveTab("voice");
    let activeJob = job;
    let workingScenes = [...scenes];
    try {
      for (let index = 0; index < workingScenes.length; index += 1) {
        let scene = workingScenes[index];
        if (!scene.audio?.path) {
          scene = { ...scene, status: "generating", error: undefined };
          workingScenes[index] = scene;
          setScenes([...workingScenes]);
          try {
            scene = await generateAudio(activeJob, scene, controller.signal);
          } catch (reason) {
            scene = { ...scene, status: "failed", error: reason instanceof Error ? reason.message : "配音失败" };
            workingScenes[index] = scene;
            activeJob = await persistDraft(activeJob, workingScenes, {
              stage: `第 ${scene.id} 场配音失败`,
              progress: 56 + Math.round(index / Math.max(1, workingScenes.length) * 24),
              signal: controller.signal,
            });
            throw reason;
          }
        }
        workingScenes[index] = scene;
        activeJob = await persistDraft(activeJob, workingScenes, {
          stage: `配音 ${index + 1}/${workingScenes.length}`,
          progress: 56 + Math.round((index + 1) / workingScenes.length * 24),
          signal: controller.signal,
        });
        workingScenes = [...activeJob.manifest.scenes];
      }
      setMessage("逐场 MiniMax 配音已全部保存，并以真实音频时长驱动预览和出片。");
      setActiveTab("preview");
    } catch (reason) {
      if ((reason as Error).name !== "AbortError") setError(reason instanceof Error ? reason.message : "批量配音失败");
    } finally {
      abortRef.current = null;
      setBusy(false);
    }
  }

  async function regenerateSelected(kind: "background" | "foreground" | "audio") {
    if (!job || !selectedScene) return;
    const controller = new AbortController();
    abortRef.current = controller;
    setBusy(true);
    setError("");
    try {
      let nextScene: HtmlVideoSceneV117 = { ...selectedScene, status: "generating", error: undefined };
      setScenes((current) => current.map((scene, index) => index === selectedIndex ? nextScene : scene));
      if (kind === "background") {
        nextScene = await generateBackground(job, nextScene, controller.signal);
      } else if (kind === "audio") {
        nextScene = await generateAudio(job, nextScene, controller.signal);
      } else {
        const layers = [...(nextScene.foregrounds || [])];
        const layer = layers[selectedForegroundIndex];
        if (!layer) throw new Error("请先添加或选择一个前景素材槽");
        layers[selectedForegroundIndex] = await generateForeground(job, nextScene, layer, selectedForegroundIndex, controller.signal);
        nextScene = { ...nextScene, foregrounds: layers, status: "pending" };
      }
      const nextScenes = scenes.map((scene, index) => index === selectedIndex ? nextScene : scene);
      await persistDraft(job, nextScenes, { stage: `第 ${nextScene.id} 场已更新`, signal: controller.signal });
      setMessage(kind === "background" ? "当前场景背景图已真实替换。" : kind === "audio" ? "当前场景配音已真实替换。" : "当前前景素材已真实替换。");
    } catch (reason) {
      if ((reason as Error).name !== "AbortError") {
        const text = reason instanceof Error ? reason.message : "重新生成失败";
        setError(text);
        setScenes((current) => current.map((scene, index) => index === selectedIndex ? { ...scene, status: "failed", error: text } : scene));
      }
    } finally {
      abortRef.current = null;
      setBusy(false);
    }
  }

  async function replaceAsset(file: File, target: "background" | "foreground" | "bgm") {
    if (!job) {
      setError("请先完成场景规划，创建本地任务后再上传素材");
      return;
    }
    setBusy(true);
    setError("");
    try {
      if (target === "bgm") {
        const asset = await uploadMediaAsset(job.id, file, "music");
        const nextWorkflow = { ...currentWorkflow, bgmMode: "local" as const, bgmAsset: asset };
        setWorkflow(nextWorkflow);
        await persistDraft(job, scenes, { nextWorkflow, stage: "BGM 配置已保存" });
        setMessage("BGM 已真实上传并保存；当前本地 HTML 渲染 API 尚未实现混音，出片时会明确阻止而不是静默忽略。");
        return;
      }
      const asset = await uploadMediaAsset(job.id, file, "images");
      let nextScene = selectedScene;
      if (!nextScene) throw new Error("当前没有可替换的场景");
      if (target === "background") {
        nextScene = { ...nextScene, background: asset, image: asset, status: "pending", error: undefined };
      } else {
        const layers = [...(nextScene.foregrounds || [])];
        if (!layers[selectedForegroundIndex]) throw new Error("请先添加或选择一个前景素材槽");
        layers[selectedForegroundIndex] = { ...layers[selectedForegroundIndex], asset, status: "ready", error: undefined };
        nextScene = { ...nextScene, foregrounds: layers, status: "pending", error: undefined };
      }
      const nextScenes = scenes.map((scene, index) => index === selectedIndex ? nextScene : scene);
      await persistDraft(job, nextScenes, { stage: `第 ${nextScene.id} 场上传素材已保存` });
      setMessage(target === "background" ? "本地图片已复制到任务目录并替换背景。" : "本地图片已复制到任务目录并替换前景素材。");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "上传素材失败");
    } finally {
      setBusy(false);
    }
  }

  async function compositeScene(activeJob: HtmlVideoJobV117, scene: HtmlVideoSceneV117): Promise<HtmlVideoSceneV117> {
    const base = scene.background || scene.image;
    if (!base?.path) throw new Error(`第 ${scene.id} 场缺少背景图`);
    const visibleLayers = (scene.foregrounds || []).filter((layer) => !layer.hidden && layer.asset?.path);
    if (!visibleLayers.length) return { ...scene, image: base };
    const canvas = document.createElement("canvas");
    canvas.width = activeJob.manifest.width;
    canvas.height = activeJob.manifest.height;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("浏览器无法创建场景合成画布");
    const baseBitmap = await bitmapFromAsset(base);
    drawCover(context, baseBitmap, canvas.width, canvas.height);
    baseBitmap.close();
    for (let index = 0; index < visibleLayers.length; index += 1) {
      const asset = visibleLayers[index].asset;
      if (!asset) continue;
      const bitmap = await bitmapFromAsset(asset);
      drawForeground(context, bitmap, canvas.width, canvas.height, foregroundPlacement(scene.layout, index));
      bitmap.close();
    }
    const blob = await canvasBlob(canvas);
    const file = new File([blob], `${escapeFileTitle(activeJob.title)}-${scene.id}-composite.png`, { type: "image/png" });
    const image = await uploadMediaAsset(activeJob.id, file, "images");
    return { ...scene, image };
  }

  function unsupportedRenderSettings(): string[] {
    const unsupported: string[] = [];
    if (workflow.bgmMode === "local" && workflow.bgmAsset?.path) unsupported.push("HTML BGM 混音");
    if (workflow.transition !== "none") unsupported.push("自定义场景转场");
    if (
      workflow.titleScale !== defaultWorkflow.titleScale
      || workflow.titlePosition !== defaultWorkflow.titlePosition
      || workflow.subtitleScale !== defaultWorkflow.subtitleScale
      || workflow.subtitlePosition !== defaultWorkflow.subtitlePosition
    ) unsupported.push("自定义标题/字幕大小与位置");
    return unsupported;
  }

  async function renderOutput() {
    if (!job) {
      setError("请先创建任务");
      return;
    }
    if (!capabilities) {
      setError("无法连接本地 media-workbench，未开始出片");
      return;
    }
    if (!capabilities.ffmpeg || !capabilities.ffprobe) {
      setError("本机未检测到 ffmpeg/ffprobe，不能生成真实 MP4");
      return;
    }
    if (readyVisuals !== scenes.length || readyAudio !== scenes.length) {
      setError("每个场景都必须有真实背景/前景素材和配音；当前未满足出片条件");
      return;
    }
    const unsupported = unsupportedRenderSettings();
    if (unsupported.length) {
      setError(`当前本地 HTML 渲染 API 尚不支持：${unsupported.join("、")}。这些设置已保存，但不会伪装成已应用；恢复兼容默认值后再出片。`);
      return;
    }
    setBusy(true);
    setError("");
    setActiveTab("output");
    setMessage("正在把可见前景真实合成为场景图，再调用本地 ffmpeg 生成 MP4 和剪映草稿…");
    try {
      let flattened: HtmlVideoSceneV117[] = [];
      for (const scene of scenes) flattened.push(await compositeScene(job, scene));
      const saved = await persistDraft(job, flattened, { stage: "场景图层已真实合成", progress: 82 });
      const renderScenes = saved.manifest.scenes.map((scene) => ({
        ...scene,
        title: scene.titleHidden ? "" : scene.title,
        subtitle: scene.subtitleHidden ? "" : scene.subtitle,
      }));
      const renderManifest = buildManifest(saved, renderScenes);
      const rendered = await renderMediaJob<HtmlVideoManifestV117>(saved.id, { manifest: renderManifest }) as HtmlVideoJobV117;
      const restoredManifest: HtmlVideoManifestV117 = {
        ...rendered.manifest,
        scenes: rendered.manifest.scenes.map((scene, index) => ({
          ...flattened[index],
          durationSec: scene.durationSec,
        })),
        workflow: currentWorkflow,
      };
      const restored = await updateMediaJob<HtmlVideoManifestV117>(rendered.id, { manifest: restoredManifest }) as HtmlVideoJobV117;
      setJob({ ...restored, manifest: normalizeManifest(restored.manifest) });
      setScenes(restoredManifest.scenes);
      await refreshHistory();
      setMessage("完成：可播放 MP4、渲染清单和剪映草稿 ZIP 已实际写入磁盘并通过服务端探测。");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "真实出片失败");
    } finally {
      setBusy(false);
    }
  }

  async function cancel() {
    abortRef.current?.abort();
    setPreviewPlaying(false);
    if (job) {
      try {
        const paused = await cancelMediaJob<HtmlVideoManifestV117>(job.id) as HtmlVideoJobV117;
        setJob({ ...paused, manifest: normalizeManifest(paused.manifest) });
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : "取消任务失败");
      }
    }
    setBusy(false);
    setMessage("已取消当前操作；已生成的图片、配音和编辑断点仍保存在本机。");
  }

  function updateSelected(patch: Partial<HtmlVideoSceneV117>) {
    setScenes((current) => current.map((scene, index) => index === selectedIndex ? { ...scene, ...patch } : scene));
  }

  function changeSelectedLayout(layout: HtmlLayoutPreset) {
    if (!selectedScene) return;
    const required = workflow.foregroundEnabled ? foregroundSlotCount(layout) : 0;
    const layers = [...(selectedScene.foregrounds || [])];
    while (layers.length < required) layers.push(createForegrounds(selectedScene.subtitle, layout)[layers.length]);
    updateSelected({ layout, foregrounds: layers.slice(0, required) });
  }

  function updateForeground(index: number, patch: Partial<ForegroundLayer>) {
    if (!selectedScene) return;
    const layers = [...(selectedScene.foregrounds || [])];
    if (!layers[index]) return;
    layers[index] = { ...layers[index], ...patch };
    updateSelected({ foregrounds: layers });
  }

  function addForeground() {
    if (!selectedScene) return;
    const layers = [...(selectedScene.foregrounds || [])];
    if (layers.length >= 4) {
      setError("单场景最多 4 个前景素材槽");
      return;
    }
    layers.push({ id: `fg-${Date.now()}`, prompt: `${selectedScene.title}的核心主体`, status: "pending" });
    updateSelected({ foregrounds: layers });
    setSelectedForegroundIndex(layers.length - 1);
  }

  function removeForeground(index: number) {
    if (!selectedScene) return;
    const layers = (selectedScene.foregrounds || []).filter((_, layerIndex) => layerIndex !== index);
    updateSelected({ foregrounds: layers });
    setSelectedForegroundIndex(Math.max(0, Math.min(selectedForegroundIndex, layers.length - 1)));
  }

  function deleteSelected() {
    const next = scenes.filter((_, index) => index !== selectedIndex).map((scene, index) => ({ ...scene, id: index + 1 }));
    setScenes(next);
    setSelectedIndex(Math.max(0, Math.min(selectedIndex, next.length - 1)));
  }

  function addScene() {
    const next = [...scenes, createScene("新增场景，请填写字幕", scenes.length, visualStyle, { foregroundEnabled: workflow.foregroundEnabled })];
    setScenes(next);
    setSelectedIndex(next.length - 1);
    setSelectedForegroundIndex(0);
  }

  function resetForNewJob() {
    if (busy) return;
    localStorage.removeItem(lastJobStorageKey);
    setJob(null);
    setScenes([]);
    setSelectedIndex(0);
    setSelectedForegroundIndex(0);
    setActiveTab("text");
    setPreviewPlaying(false);
    setError("");
    setMessage("已进入新建模式；历史任务仍保存在本机，可随时恢复。");
  }

  function selectScene(index: number) {
    setSelectedIndex(index);
    setSelectedForegroundIndex(0);
    setPreviewProgress(0);
    setPreviewRun((current) => current + 1);
  }

  function togglePreview() {
    if (!selectedScene) return;
    setPreviewPlaying((current) => !current);
    setPreviewRun((current) => current + 1);
  }

  const previewClass = selectedScene
    ? `html-phone-layout layout-${selectedScene.layout} animation-${selectedScene.animation}`
    : "html-phone-layout";
  const selectedLayers = selectedScene?.foregrounds || [];
  const selectedCategory = topicCategories.find((item) => item.id === topicCategory) || topicCategories[0];
  const unsupported = unsupportedRenderSettings();

  return (
    <div className={scenes.length ? "html-video-page running" : "html-video-page"}>
      {scenes.length > 0 && (
        <aside className="html-step-rail" aria-label="HTML 动画步骤">
          <div className="html-step-title"><span>H</span><div><strong>HTML 动画</strong><small>v1.17 分阶段工作流</small></div></div>
          {stageLabels.map((stage, index) => (
            <button
              className={index < stageIndex ? "done" : index === stageIndex ? "active" : ""}
              key={stage.name}
              onClick={() => setActiveTab(stage.tab)}
              type="button"
            >
              <span>{index < stageIndex ? "✓" : index + 1}</span>
              <div><strong>{stage.name}</strong><small>{index < stageIndex ? "已有真实产物" : index === stageIndex ? job?.stage || stage.sub : stage.sub}</small></div>
            </button>
          ))}
          <div className="html-rail-facts">
            <span>素材 {readyVisuals}/{scenes.length}</span>
            <span>配音 {readyAudio}/{scenes.length}</span>
            <span>{job?.output ? `${job.output.durationSec.toFixed(1)} 秒` : "尚未出片"}</span>
            <span>{capabilities?.ffmpeg && capabilities.ffprobe ? "本地渲染器可用" : "本地渲染器未就绪"}</span>
          </div>
        </aside>
      )}

      <main className="html-video-main">
        <header className="html-page-header">
          <div><span className="html-kicker">STORYBOUND · HTML VIDEO V1.17</span><h1>HTML 动画视频</h1><p>命题或文案 → 分镜 → 背景/前景 → 配音 → Web 动画预览 → 真实出片。</p></div>
          <div className="html-header-actions">
            {job && <button className="html-ghost-button" disabled={busy} onClick={resetForNewJob} type="button">新建任务</button>}
            {recentJobs.length > 0 && !job && <button className="html-ghost-button" disabled={busy} onClick={() => void restoreJob(recentJobs[0].id)} type="button">恢复最近断点</button>}
          </div>
        </header>

        {scenes.length === 0 ? (
          <div className="html-config">
            <section className="html-card html-entry-card">
              <div className="html-card-heading"><span>01</span><div><h2>文案</h2><p>原版两条入口：AI 命题创作，或粘贴已有文案。</p></div></div>
              <div className="html-entry-switch" role="tablist">
                <button className={entryMode === "ai-topic" ? "selected" : ""} onClick={() => setEntryMode("ai-topic")} role="tab" type="button"><strong>✨ AI 命题创作</strong><span>主题 + 字数，从零写完整口播稿</span></button>
                <button className={entryMode === "paste" ? "selected" : ""} onClick={() => setEntryMode("paste")} role="tab" type="button"><strong>粘贴文案</strong><span>已有故事、文摘、金句或解说</span></button>
              </div>

              {entryMode === "ai-topic" ? (
                <div className="html-topic-panel">
                  <label><span>题材</span><div className="html-chip-grid compact">{topicCategories.map((item) => <button className={topicCategory === item.id ? "selected" : ""} key={item.id} onClick={() => setTopicCategory(item.id)} type="button">{item.label}</button>)}</div><small>{selectedCategory.blurb}（决定钩子套路与合规边界）</small></label>
                  <label><span>命题 / 主题</span><input onChange={(event) => setTopic(event.target.value)} placeholder="例：职场打工人必知的 5 条真理" value={topic} /></label>
                  <div className="html-two-fields">
                    <label><span>目标字数</span><input max={3000} min={100} onChange={(event) => setTargetWords(Math.max(100, Math.min(3000, Number(event.target.value) || 100)))} step={50} type="number" value={targetWords} /></label>
                    <label><span>额外要求（可选）</span><input onChange={(event) => setTopicRequirement(event.target.value)} placeholder="例：开头用提问钩子 / 偏轻松口吻" value={topicRequirement} /></label>
                  </div>
                  <div className="html-topic-action"><button disabled={!busy && topic.trim().length < 2} onClick={() => void composeTopicCopy()} type="button">{busy ? "生成中…（点此取消）" : "✨ 生成文案"}</button><span>成功后会填入文案框并切到“直接用原文”；失败不会填假稿。</span></div>
                </div>
              ) : (
                <div className="html-copy-panel">
                  <textarea onChange={(event) => setSourceText(event.target.value)} placeholder="粘贴一段文案（故事 / 文摘 / 金句）…，或先用 AI 命题创作生成" rows={10} value={sourceText} />
                  <div className="html-field-block"><label>文案处理</label><div className="html-chip-grid compact"><button className={useAiRewrite ? "selected" : ""} onClick={() => setUseAiRewrite(true)} type="button">AI 改写</button><button className={!useAiRewrite ? "selected" : ""} onClick={() => setUseAiRewrite(false)} type="button">直接用原文</button></div><small>{useAiRewrite ? "润色已有整篇文案，再切分镜；只有主题请使用上方 AI 命题创作。" : "旁白逐字保留原文，只做分镜规划。"}</small></div>
                </div>
              )}
            </section>

            <section className="html-card">
              <div className="html-card-heading"><span>02</span><div><h2>出图与场景规划</h2><p>统一画风、背景/前景结构、分镜数量和画布比例。</p></div></div>
              <div className="html-config-grid">
                <div className="html-field-block html-field-wide"><label>视觉风格</label><div className="html-chip-grid">{visualStyles.map((style) => <button className={visualStyle === style ? "selected" : ""} key={style} onClick={() => setVisualStyle(style)} type="button">{style}</button>)}</div></div>
                <div className="html-field-block"><label>前景素材</label><div className="html-chip-grid compact"><button className={foregroundEnabled ? "selected" : ""} onClick={() => setForegroundEnabled(true)} type="button">生成前景</button><button className={!foregroundEnabled ? "selected" : ""} onClick={() => setForegroundEnabled(false)} type="button">纯背景图</button></div><small>{foregroundEnabled ? "按版式建立 1–4 个前景槽，可逐个上传或生成。" : "只生成背景；金句和空镜更省生图次数。"}</small></div>
                <div className="html-field-block"><label>分镜数</label><div className="html-chip-grid compact"><button className={sceneCountMode === "auto" ? "selected" : ""} onClick={() => setSceneCountMode("auto")} type="button">自动</button><button className={sceneCountMode === "manual" ? "selected" : ""} onClick={() => setSceneCountMode("manual")} type="button">手动</button>{sceneCountMode === "manual" && <input className="html-count-input" max={60} min={3} onChange={(event) => setManualSceneCount(Math.max(3, Math.min(60, Number(event.target.value) || 3)))} type="number" value={manualSceneCount} />}</div><small>{sceneCountMode === "auto" ? "按文案长度与语义自动切分。" : "LLM 规划后会按目标数量重新均衡。"}</small></div>
                <div className="html-field-block"><label>分辨率</label><div className="html-chip-grid compact"><button className={aspectRatio === "9:16" ? "selected" : ""} onClick={() => setAspectRatio("9:16")} type="button">竖屏 9:16</button><button className={aspectRatio === "16:9" ? "selected" : ""} onClick={() => setAspectRatio("16:9")} type="button">横屏 16:9</button></div><small>预览默认按 9:16 优先；出片尺寸写入 manifest。</small></div>
              </div>
            </section>

            <section className="html-card">
              <div className="html-card-heading"><span>03</span><div><h2>配音预设</h2><p>MiniMax 音色与语速会写入任务，逐场使用同一参数。</p></div></div>
              <div className="html-config-grid">
                <label className="html-select-field"><span>音色</span><select onChange={(event) => setWorkflow((current) => ({ ...current, voiceId: event.target.value }))} value={workflow.voiceId}>{voiceOptions.map((voice) => <option key={voice.id} value={voice.id}>{voice.name} · {voice.tag}</option>)}</select></label>
                <div className="html-field-block"><label>语速</label><div className="html-chip-grid compact">{speedPresets.map((preset) => <button className={workflow.ttsSpeed === preset.value ? "selected" : ""} key={preset.value} onClick={() => setWorkflow((current) => ({ ...current, ttsSpeed: preset.value }))} type="button">{preset.label} {preset.value}×</button>)}</div></div>
              </div>
            </section>

            <div className="html-start-row">
              <div><strong>第一步只做真实场景规划</strong><span>规划完成后逐镜检查，再分别生成素材、配音和成片。</span></div>
              <button disabled={busy || sourceText.trim().length < 10} onClick={() => void startPlanning()} type="button">{busy ? "真实规划中…" : "开始规划场景"}</button>
            </div>

            {recentJobs.length > 0 && (
              <section className="html-card html-history-card">
                <div className="html-section-bar"><div><h2>历史任务</h2><p>刷新页面后仍从本地 media-workbench 读取</p></div><span>{recentJobs.length} 个</span></div>
                <div className="html-history-list">{recentJobs.slice(0, 6).map((item) => <button key={item.id} onClick={() => void restoreJob(item.id)} type="button"><div><strong>{item.title}</strong><small>{new Date(item.updatedAt).toLocaleString()}</small></div><span>{item.status} · {item.stage}</span></button>)}</div>
              </section>
            )}
          </div>
        ) : (
          <div className="html-workbench">
            <nav className="html-workbench-tabs" aria-label="HTML 动画工作台">
              {workbenchTabs.map((tab) => <button className={activeTab === tab.key ? "active" : ""} key={tab.key} onClick={() => setActiveTab(tab.key)} type="button">{tab.label}</button>)}
            </nav>

            {activeTab === "text" && (
              <section className="html-preview-card">
                <div className="html-section-bar"><div><h2>文案与场景规划</h2><p>逐场编辑版式、大标题、字幕和绘图提示词</p></div><span>{scenes.length} 场</span></div>
                <div className="html-scene-plan-list">
                  {scenes.map((scene, index) => (
                    <article className={selectedIndex === index ? "selected" : ""} key={`${scene.id}-${index}`}>
                      <button className="html-scene-number" onClick={() => selectScene(index)} type="button">{scene.id}</button>
                      <div className="html-scene-plan-fields">
                        <label><span>版式</span><select onChange={(event) => { selectScene(index); const layout = event.target.value as HtmlLayoutPreset; const required = workflow.foregroundEnabled ? foregroundSlotCount(layout) : 0; const layers = [...(scene.foregrounds || [])]; while (layers.length < required) layers.push(createForegrounds(scene.subtitle, layout)[layers.length]); setScenes((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, layout, foregrounds: layers.slice(0, required) } : item)); }} value={scene.layout}>{Object.entries(htmlLayoutLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
                        <label><span>大标题</span><input onChange={(event) => setScenes((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, title: event.target.value } : item))} value={scene.title} /></label>
                        <label className="wide"><span>字幕 / 旁白</span><textarea onChange={(event) => setScenes((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, subtitle: event.target.value, captions: splitCaptions(event.target.value), audio: undefined, durationSec: undefined } : item))} value={scene.subtitle} /></label>
                        <label className="wide"><span>背景绘图提示词</span><textarea onChange={(event) => setScenes((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, prompt: event.target.value } : item))} value={scene.prompt} /></label>
                      </div>
                      <div className="html-scene-plan-actions"><button className={scene.titleHidden ? "muted" : ""} onClick={() => setScenes((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, titleHidden: !item.titleHidden } : item))} type="button">{scene.titleHidden ? "显示标题" : "隐藏标题"}</button><button className={scene.subtitleHidden ? "muted" : ""} onClick={() => setScenes((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, subtitleHidden: !item.subtitleHidden } : item))} type="button">{scene.subtitleHidden ? "显示字幕" : "隐藏字幕"}</button></div>
                    </article>
                  ))}
                </div>
                <div className="html-inline-footer"><button onClick={addScene} type="button">＋ 新增场景</button><button disabled={busy || scenes.length <= 1} onClick={deleteSelected} type="button">删除当前场景</button><button className="primary" disabled={busy} onClick={() => void generateAllVisuals()} type="button">进入素材生成</button></div>
              </section>
            )}

            {activeTab === "assets" && selectedScene && (
              <section className="html-preview-card">
                <div className="html-section-bar"><div><h2>素材（图片）</h2><p>每场景独立背景与 0–4 个前景槽；可编辑、上传或真实生图</p></div><span>第 {selectedScene.id} 场</span></div>
                <div className="html-assets-layout">
                  <div className="html-asset-panel">
                    <div className="html-asset-head"><strong>背景</strong><span>{selectedScene.background?.path || selectedScene.image?.path ? "已就绪" : "待生成"}</span></div>
                    <div className="html-asset-visual">{(selectedScene.background?.url || selectedScene.image?.url) ? <img alt={selectedScene.title} src={selectedScene.background?.url || selectedScene.image?.url} /> : <span>等待真实背景图</span>}</div>
                    <label>背景提示词<textarea onChange={(event) => updateSelected({ prompt: event.target.value })} value={selectedScene.prompt} /></label>
                    <div className="html-editor-actions"><button disabled={busy} onClick={() => void regenerateSelected("background")} type="button">生成 / 重生背景</button><button disabled={busy} onClick={() => backgroundUploadRef.current?.click()} type="button">替换本地图片</button></div>
                  </div>
                  <div className="html-foreground-panel">
                    <div className="html-asset-head"><strong>前景素材</strong><button disabled={busy || selectedLayers.length >= 4} onClick={addForeground} type="button">＋ 添加素材</button></div>
                    {!workflow.foregroundEnabled ? <div className="html-empty-panel">当前任务选择“纯背景图”；可在设置中重新启用前景。</div> : selectedLayers.length === 0 ? <div className="html-empty-panel">当前版式没有前景槽；切换版式或手动添加。</div> : <div className="html-foreground-list">{selectedLayers.map((layer, index) => <article className={selectedForegroundIndex === index ? "selected" : ""} key={layer.id} onClick={() => setSelectedForegroundIndex(index)}><div>{layer.asset?.url ? <img alt="" src={layer.asset.url} /> : <span>{index + 1}</span>}</div><label>前景 {index + 1}<input onChange={(event) => updateForeground(index, { prompt: event.target.value })} onClick={(event) => event.stopPropagation()} value={layer.prompt} /></label><small>{layer.error || (layer.asset?.path ? "真实文件已保存" : "待生成 / 上传")}</small><div className="html-layer-actions"><button disabled={busy} onClick={(event) => { event.stopPropagation(); setSelectedForegroundIndex(index); void regenerateSelected("foreground"); }} type="button">生成</button><button disabled={busy} onClick={(event) => { event.stopPropagation(); setSelectedForegroundIndex(index); foregroundUploadRef.current?.click(); }} type="button">上传</button><button onClick={(event) => { event.stopPropagation(); updateForeground(index, { hidden: !layer.hidden }); }} type="button">{layer.hidden ? "显示" : "隐藏"}</button><button className="danger" onClick={(event) => { event.stopPropagation(); removeForeground(index); }} type="button">删除</button></div></article>)}</div>}
                    <p className="html-compat-note">MiniMax 返回什么文件就显示什么文件；若不是透明 PNG，不会伪装成已抠图。出片前会把当前可见图层真实合成为场景图。</p>
                  </div>
                </div>
                {selectedScene.error && <div className="html-inline-error">{selectedScene.error}</div>}
                <div className="html-inline-footer"><button disabled={busy} onClick={() => void generateAllVisuals()} type="button">批量补齐全部素材</button><button className="primary" disabled={busy || readyVisuals !== scenes.length} onClick={() => setActiveTab("voice")} type="button">进入配音</button></div>
              </section>
            )}

            {activeTab === "voice" && (
              <section className="html-preview-card">
                <div className="html-section-bar"><div><h2>逐场配音</h2><p>固定 MiniMax 音色、语速；每段读取真实时长</p></div><span>{readyAudio}/{scenes.length}</span></div>
                <div className="html-voice-settings">
                  <label><span>音色</span><select onChange={(event) => setWorkflow((current) => ({ ...current, voiceId: event.target.value }))} value={workflow.voiceId}>{voiceOptions.map((voice) => <option key={voice.id} value={voice.id}>{voice.name} · {voice.tag}</option>)}</select></label>
                  <div><span>语速</span><div className="html-chip-grid compact">{speedPresets.map((preset) => <button className={workflow.ttsSpeed === preset.value ? "selected" : ""} key={preset.value} onClick={() => setWorkflow((current) => ({ ...current, ttsSpeed: preset.value }))} type="button">{preset.value}×</button>)}</div></div>
                </div>
                <div className="html-voice-list">{scenes.map((scene, index) => <article className={selectedIndex === index ? "selected" : ""} key={scene.id} onClick={() => selectScene(index)}><span>{scene.id}</span><div><strong>{scene.subtitle}</strong><small>{scene.audio?.durationSec ? `${scene.audio.durationSec.toFixed(2)} 秒 · ${scene.audio.fileName}` : scene.error || "尚未配音"}</small></div>{scene.audio?.url ? <audio controls onClick={(event) => event.stopPropagation()} preload="metadata" src={scene.audio.url} /> : <button disabled={busy} onClick={(event) => { event.stopPropagation(); selectScene(index); window.setTimeout(() => void regenerateSelected("audio"), 0); }} type="button">生成本段</button>}</article>)}</div>
                <div className="html-inline-footer"><button disabled={busy} onClick={() => void generateAllAudio()} type="button">批量补齐全部配音</button><button className="primary" disabled={busy || readyAudio !== scenes.length} onClick={() => setActiveTab("preview")} type="button">进入动画预览</button></div>
              </section>
            )}

            {activeTab === "preview" && selectedScene && (
              <>
                <section className="html-preview-card">
                  <div className="html-section-bar"><div><h2>动画预览</h2><p>从当前场景开始，可连续播放真实图片与真实配音</p></div><span>{selectedIndex + 1} / {scenes.length}</span></div>
                  <div className="html-preview-layout">
                    <div className={previewClass} key={`${selectedScene.id}-${selectedScene.animation}-${previewRun}`} ref={previewRef}>
                      {(selectedScene.background?.url || selectedScene.image?.url) ? <img alt={selectedScene.title} className="html-background-image" src={selectedScene.background?.url || selectedScene.image?.url} /> : <div className="html-empty-visual">等待真实背景图</div>}
                      {!selectedScene.titleHidden || !selectedScene.subtitleHidden ? <div className={`html-caption style-${selectedScene.subtitleStyle}`}>
                        {!selectedScene.titleHidden && <strong>{selectedScene.title}</strong>}
                        {!selectedScene.subtitleHidden && <span>{selectedScene.subtitle}</span>}
                      </div> : null}
                      {!selectedScene.titleHidden && <div className="html-title-anchor" />}
                      {(selectedScene.foregrounds || []).map((layer, index) => !layer.hidden && layer.asset?.url ? <img alt="" className={`html-foreground-layer slot-${index + 1}`} key={layer.id} src={layer.asset.url} /> : null)}
                      <div className="html-preview-progress"><span /></div>
                    </div>
                    <div className="html-preview-controls">
                      <div className="html-preview-transport"><button disabled={selectedIndex === 0} onClick={() => selectScene(selectedIndex - 1)} type="button">← 上一场景</button><button className="primary" onClick={togglePreview} type="button">{previewPlaying ? "暂停" : "▶ 连播全部"}</button><button disabled={selectedIndex >= scenes.length - 1} onClick={() => selectScene(selectedIndex + 1)} type="button">下一场景 →</button></div>
                      <div className="html-progress-meter"><span>场景进度</span><progress max={100} value={previewProgress} /></div>
                      {selectedScene.audio?.url ? <audio controls preload="metadata" ref={previewAudioRef} src={selectedScene.audio.url} /> : <div className="html-audio-empty">本场景没有配音，连续预览无法验证音画同步</div>}
                      <div className="html-preview-scene-copy"><strong>{selectedScene.title}</strong><p>{selectedScene.subtitle}</p><small>{selectedScene.durationSec?.toFixed(2) || "—"} 秒 · {htmlLayoutLabels[selectedScene.layout]}</small></div>
                    </div>
                  </div>
                </section>

                <section className="html-controls-card">
                  <div><label>画面版式</label><div className="html-chip-grid compact">{Object.entries(htmlLayoutLabels).map(([value, label]) => <button className={selectedScene.layout === value ? "selected" : ""} key={value} onClick={() => changeSelectedLayout(value as HtmlLayoutPreset)} type="button">{label}</button>)}</div></div>
                  <div><label>字幕风格</label><div className="html-chip-grid compact">{Object.entries(htmlSubtitleStyleLabels).map(([value, label]) => <button className={selectedScene.subtitleStyle === value ? "selected" : ""} key={value} onClick={() => updateSelected({ subtitleStyle: value as HtmlSubtitleStyle })} type="button">{label}</button>)}</div></div>
                  <div><label>字幕动效</label><div className="html-chip-grid compact">{Object.entries(htmlAnimationLabels).map(([value, label]) => <button className={selectedScene.animation === value ? "selected" : ""} key={value} onClick={() => { updateSelected({ animation: value as HtmlAnimationPreset }); setPreviewRun((current) => current + 1); }} type="button">{label}</button>)}</div></div>
                </section>

                <section className="html-controls-card html-advanced-settings">
                  <div className="html-section-bar"><div><h2>字幕 · 标题 · BGM 设置</h2><p>参数会保存并恢复；本地渲染 API 不支持的项会在出片前明确阻止</p></div></div>
                  <div className="html-range-grid">
                    <label><span>主标题大小 <em>{workflow.titleScale}%</em></span><input max={150} min={50} onChange={(event) => setWorkflow((current) => ({ ...current, titleScale: Number(event.target.value) }))} step={5} type="range" value={workflow.titleScale} /></label>
                    <label><span>主标题位置 <em>{workflow.titlePosition}%</em></span><input max={50} min={0} onChange={(event) => setWorkflow((current) => ({ ...current, titlePosition: Number(event.target.value) }))} step={1} type="range" value={workflow.titlePosition} /></label>
                    <label><span>字幕大小 <em>{workflow.subtitleScale}%</em></span><input max={200} min={50} onChange={(event) => setWorkflow((current) => ({ ...current, subtitleScale: Number(event.target.value) }))} step={5} type="range" value={workflow.subtitleScale} /></label>
                    <label><span>字幕位置 <em>{workflow.subtitlePosition}%</em></span><input max={95} min={50} onChange={(event) => setWorkflow((current) => ({ ...current, subtitlePosition: Number(event.target.value) }))} step={1} type="range" value={workflow.subtitlePosition} /></label>
                  </div>
                  <div><label>场景转场</label><div className="html-chip-grid compact">{Object.entries(transitionLabels).map(([value, label]) => <button className={workflow.transition === value ? "selected" : ""} key={value} onClick={() => setWorkflow((current) => ({ ...current, transition: value as TransitionPreset }))} type="button">{label}</button>)}</div></div>
                  <div className="html-bgm-settings"><label>背景音乐</label><div className="html-chip-grid compact"><button className={workflow.bgmMode === "off" ? "selected" : ""} onClick={() => setWorkflow((current) => ({ ...current, bgmMode: "off" }))} type="button">关闭</button><button className={workflow.bgmMode === "local" ? "selected" : ""} onClick={() => bgmUploadRef.current?.click()} type="button">上传本地 BGM</button></div>{workflow.bgmAsset && <span>{workflow.bgmAsset.fileName} · {workflow.bgmAsset.durationSec?.toFixed(1) || "?"} 秒</span>}<div className="html-chip-grid compact">{(["soft", "medium", "loud"] as BgmVolume[]).map((volume) => <button className={workflow.bgmVolume === volume ? "selected" : ""} key={volume} onClick={() => setWorkflow((current) => ({ ...current, bgmVolume: volume }))} type="button">{volume === "soft" ? "轻 · 隐约衬底" : volume === "medium" ? "适中 · 推荐" : "明显 · 氛围强"}</button>)}</div></div>
                  <div className="html-settings-actions"><button onClick={() => setWorkflow((current) => ({ ...current, transition: "none", bgmMode: "off", titleScale: 100, titlePosition: 18, subtitleScale: 100, subtitlePosition: 84 }))} type="button">恢复本地渲染兼容默认值</button>{unsupported.length > 0 && <span>当前出片阻断项：{unsupported.join("、")}</span>}</div>
                </section>
              </>
            )}

            {activeTab === "output" && (
              <section className="html-preview-card html-output-workbench">
                <div className="html-section-bar"><div><h2>出片</h2><p>浏览器真实合成可见图层 → 本地 media-workbench → ffmpeg MP4</p></div><span>{job?.status || "draft"}</span></div>
                <div className="html-render-readiness">
                  <div className={readyVisuals === scenes.length ? "ready" : ""}><strong>{readyVisuals}/{scenes.length}</strong><span>素材就绪</span></div>
                  <div className={readyAudio === scenes.length ? "ready" : ""}><strong>{readyAudio}/{scenes.length}</strong><span>配音就绪</span></div>
                  <div className={capabilities?.ffmpeg && capabilities.ffprobe ? "ready" : ""}><strong>{capabilities?.ffmpeg && capabilities.ffprobe ? "可用" : "缺失"}</strong><span>ffmpeg / ffprobe</span></div>
                  <div className={!unsupported.length ? "ready" : "blocked"}><strong>{unsupported.length || "0"}</strong><span>不兼容设置</span></div>
                </div>
                {unsupported.length > 0 && <div className="html-inline-error">不会假装成功：当前本地渲染器不能应用 {unsupported.join("、")}。请回到动画预览恢复兼容默认值，或保留配置等待后端能力补齐。</div>}
                <div className="html-render-actions"><button disabled={busy} onClick={() => void generateAllVisuals()} type="button">补齐素材</button><button disabled={busy} onClick={() => void generateAllAudio()} type="button">补齐配音</button><button className="primary" disabled={busy || readyVisuals !== scenes.length || readyAudio !== scenes.length || unsupported.length > 0} onClick={() => void renderOutput()} type="button">{busy ? "真实出片中…" : "开始真实出片"}</button></div>
                {job?.output ? <div className="html-output-result"><video controls preload="metadata" src={job.output.mp4Url} /><div><strong>✅ 成片已生成</strong><span>{job.output.width}×{job.output.height} · {job.output.fps}fps · {job.output.videoCodec}/{job.output.audioCodec} · {job.output.durationSec.toFixed(2)} 秒</span><span>{job.output.renderer === "chromium-html-frames" ? "Chromium HTML 逐帧" : "FFmpeg 兼容渲染"} · {(job.output.bytes / 1024 / 1024).toFixed(2)} MB</span><nav><a href={job.output.mp4Url}>下载 MP4</a><a href={job.output.jianyingZipUrl}>下载剪映草稿 ZIP</a><a href={job.output.manifestUrl}>查看渲染清单</a></nav></div></div> : <div className="html-empty-panel">尚无真实成片。只有服务端返回可探测的 MP4 后，这里才会出现播放器和下载项。</div>}
              </section>
            )}

            {activeTab === "history" && (
              <section className="html-preview-card html-history-card">
                <div className="html-section-bar"><div><h2>历史与断点恢复</h2><p>数据来自本地 media-workbench，不使用前端示例数据</p></div><button className="html-ghost-button" onClick={() => void refreshHistory().catch((reason: unknown) => setError(reason instanceof Error ? reason.message : "刷新历史失败"))} type="button">刷新历史</button></div>
                <div className="html-history-list">{recentJobs.map((item) => <button className={item.id === job?.id ? "selected" : ""} key={item.id} onClick={() => void restoreJob(item.id)} type="button"><div><strong>{item.title}</strong><small>{item.id} · {new Date(item.updatedAt).toLocaleString()}</small></div><span>{item.status} · {item.progress}% · {item.stage}</span></button>)}</div>
              </section>
            )}

            {activeTab !== "history" && (
              <section className="html-scene-strip" aria-label="场景列表">
                {scenes.map((scene, index) => (
                  <button className={selectedIndex === index ? "selected" : ""} key={`${scene.id}-${index}`} onClick={() => selectScene(index)} type="button">
                    <span>{(scene.background?.url || scene.image?.url) ? <img alt="" src={scene.background?.url || scene.image?.url} /> : scene.id}</span>
                    <div><strong>第 {scene.id} 场</strong><small>{scene.subtitle}</small></div>
                    <em className={scene.status === "failed" ? "failed" : ""}>{sceneStatusLabel(scene, workflow.foregroundEnabled)}</em>
                  </button>
                ))}
                <button className="html-add-scene" onClick={addScene} type="button">＋ 新增场景</button>
              </section>
            )}
          </div>
        )}

        <input accept=".png,.jpg,.jpeg,.webp" hidden onChange={(event) => { const file = event.target.files?.[0]; if (file) void replaceAsset(file, "background"); event.target.value = ""; }} ref={backgroundUploadRef} type="file" />
        <input accept=".png,.jpg,.jpeg,.webp" hidden onChange={(event) => { const file = event.target.files?.[0]; if (file) void replaceAsset(file, "foreground"); event.target.value = ""; }} ref={foregroundUploadRef} type="file" />
        <input accept=".mp3,.wav,.flac" hidden onChange={(event) => { const file = event.target.files?.[0]; if (file) void replaceAsset(file, "bgm"); event.target.value = ""; }} ref={bgmUploadRef} type="file" />

        {(message || error) && <div aria-live="polite" className={error ? "html-status error" : "html-status"}><strong>{error ? "未完成" : busy ? "正在执行真实任务" : "状态"}</strong><span>{error || message}</span></div>}

        {scenes.length > 0 && (
          <footer className="html-action-bar">
            <div><strong>{job?.status === "completed" ? "真实成片已完成" : "断点自动保存在本机"}</strong><span>{job?.stage || "可继续编辑"}</span></div>
            {busy && <button className="html-cancel" onClick={() => void cancel()} type="button">取消并保留断点</button>}
            <button disabled={busy} onClick={() => setActiveTab("history")} type="button">历史恢复</button>
            <button disabled={busy} onClick={() => void generateAllVisuals()} type="button">补齐素材</button>
            <button disabled={busy} onClick={() => void generateAllAudio()} type="button">补齐配音</button>
            <button className="primary" disabled={busy || readyVisuals !== scenes.length || readyAudio !== scenes.length || unsupported.length > 0} onClick={() => void renderOutput()} type="button">{busy ? "处理中…" : "真实出片"}</button>
          </footer>
        )}
      </main>
    </div>
  );
}
