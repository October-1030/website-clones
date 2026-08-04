import { contentTracks, originalDefaultStyleByTrack, visualStyles } from "../data/app-data";
import type { ExecutionMode, PausePreset, VideoForm } from "../types/app";
import type { ImageGenerationRequest } from "../types/image";
import type { DraftTemplateConfig } from "../types/draft-template";
import type { StoryboundTask, TaskOptions } from "../types/task";
import type { TtsProvider } from "../types/tts";
import type { PromptTemplateOverride } from "../types/llm";

export interface BuilderFormState {
  title: string;
  inputText: string;
  aiBrief: string;
  sourceMode: "paste" | "ai";
  mode: ExecutionMode;
  pausePreset: PausePreset;
  customPauseSteps: number[];
  videoForm: VideoForm;
  track: string;
  promptTemplateId: string;
  promptTemplateOverride: PromptTemplateOverride | null;
  visualStyle: string;
  aspectRatio: ImageGenerationRequest["aspectRatio"];
  rewriteIntensity: NonNullable<TaskOptions["rewriteIntensity"]>;
  narrativePov: NonNullable<TaskOptions["narrativePov"]>;
  targetLength: number | null;
  targetScenes: number | null;
  keepPromotion: boolean;
  fixedIntroEnabled: boolean;
  fixedIntroMode: "account" | "lock";
  fixedIntro: string;
  lockIntroSentences: number;
  lockIntroText: string;
  lockIntroDirty: boolean;
  outroCtaEnabled: boolean;
  outroCta: string;
  materialSource: NonNullable<TaskOptions["materialSource"]>;
  autoBorrowImage: boolean;
  dynamicStoryboard: boolean;
  draftTemplateId: string;
  draftTemplateConfig: DraftTemplateConfig | null;
  videoIntroCount: number;
  videoIntroDurationMode: "narration" | "fixed";
  videoIntroDuration: number;
  bgmSync: boolean;
  bgmId: NonNullable<TaskOptions["bgmId"]>;
  coverMode: NonNullable<TaskOptions["coverMode"]>;
  coverTemplateId: string;
  coverRatio: string;
  secondCover: boolean;
  secondCoverMode: "titled" | "plain";
  secondCoverTemplateId: string;
  secondCoverRatio: string;
  voiceSource: NonNullable<TaskOptions["voiceSource"]>;
  ttsProvider: TtsProvider;
  ttsVoiceId: string;
  ttsVoiceIdB: string;
  ttsSpeed: number;
  ttsMode: NonNullable<TaskOptions["ttsMode"]>;
  podcastImageMode: "multi" | "single";
  podcastPair: string;
}

const defaultTrack = contentTracks[0] ?? "通用故事";

export const defaultBuilderForm: BuilderFormState = {
  title: "",
  inputText: "",
  aiBrief: "",
  sourceMode: "paste",
  mode: "auto",
  pausePreset: "key",
  customPauseSteps: [2, 3],
  videoForm: "narration",
  track: defaultTrack,
  promptTemplateId: `system-${defaultTrack}`,
  promptTemplateOverride: null,
  visualStyle: originalDefaultStyleByTrack[defaultTrack] ?? visualStyles[0] ?? "黑白摄影",
  aspectRatio: "9:16",
  rewriteIntensity: "standard",
  narrativePov: "original",
  targetLength: null,
  targetScenes: null,
  keepPromotion: false,
  fixedIntroEnabled: false,
  fixedIntroMode: "account",
  fixedIntro: "",
  lockIntroSentences: 3,
  lockIntroText: "",
  lockIntroDirty: false,
  outroCtaEnabled: false,
  outroCta: "",
  materialSource: "ai",
  autoBorrowImage: false,
  dynamicStoryboard: false,
  draftTemplateId: "",
  draftTemplateConfig: null,
  videoIntroCount: 0,
  videoIntroDurationMode: "fixed",
  videoIntroDuration: 6,
  bgmSync: false,
  bgmId: "__builtin__",
  coverMode: "off",
  coverTemplateId: "cinematic-poster",
  coverRatio: "3:4",
  secondCover: false,
  secondCoverMode: "titled",
  secondCoverTemplateId: "cinematic-poster",
  secondCoverRatio: "3:4",
  voiceSource: "tts",
  ttsProvider: "volcengine",
  ttsVoiceId: "",
  ttsVoiceIdB: "",
  ttsSpeed: 1,
  ttsMode: "original-segmented",
  podcastImageMode: "multi",
  podcastPair: "mizai_dayi",
};

export function formFromTask(task: StoryboundTask, fallbackTtsProvider: TtsProvider = "volcengine"): BuilderFormState {
  return {
    ...defaultBuilderForm,
    title: task.title,
    inputText: task.inputText,
    aiBrief: task.aiBrief || "",
    sourceMode: task.sourceMode,
    mode: task.mode,
    pausePreset: task.pausePreset,
    customPauseSteps: task.customPauseSteps,
    videoForm: task.videoForm,
    track: task.track,
    promptTemplateId: task.options.promptTemplateId ?? `system-${task.track}`,
    promptTemplateOverride: task.options.promptTemplateOverride ?? null,
    visualStyle: task.visualStyle,
    aspectRatio: task.aspectRatio,
    rewriteIntensity: (task.options.rewriteIntensity as string) === "light"
      ? "standard"
      : task.options.rewriteIntensity ?? "standard",
    narrativePov: task.options.narrativePov ?? "original",
    targetLength: task.options.targetLength ?? null,
    targetScenes: task.options.targetScenes ?? null,
    keepPromotion: task.options.keepPromotion ?? false,
    fixedIntroEnabled: task.options.fixedIntroEnabled ?? Boolean(task.options.fixedIntro || task.options.lockIntroSentences),
    fixedIntroMode: task.options.fixedIntroMode ?? (task.options.lockIntroSentences ? "lock" : "account"),
    fixedIntro: task.options.fixedIntro ?? "",
    lockIntroSentences: task.options.lockIntroSentences && task.options.lockIntroSentences > 0
      ? Math.min(20, task.options.lockIntroSentences)
      : 3,
    lockIntroText: task.options.lockIntroText ?? "",
    lockIntroDirty: task.options.lockIntroDirty ?? false,
    outroCtaEnabled: task.options.outroCtaEnabled ?? Boolean(task.options.outroCta),
    outroCta: task.options.outroCta ?? "",
    materialSource: task.options.materialSource === "person" ? "local" : task.options.materialSource ?? "ai",
    autoBorrowImage: task.options.autoBorrowImage ?? false,
    dynamicStoryboard: task.options.videoIntro ?? task.options.dynamicStoryboard ?? false,
    draftTemplateId: task.options.draftTemplateId ?? "",
    draftTemplateConfig: task.options.draftTemplateConfig ?? null,
    videoIntroCount: task.options.videoIntroCount ?? 0,
    videoIntroDurationMode: task.options.videoIntroDurationMode ?? ((task.options.videoIntroDuration ?? 6) === 0 ? "narration" : "fixed"),
    videoIntroDuration: task.options.videoIntroDuration && task.options.videoIntroDuration > 0 ? task.options.videoIntroDuration : 6,
    bgmSync: task.options.bgmSync ?? false,
    bgmId: task.options.bgmId ?? (task.media.bgm?.path ? "uploaded" : "__builtin__"),
    coverMode: task.options.coverMode ?? "off",
    coverTemplateId: task.options.coverTemplateId ?? "cinematic-poster",
    coverRatio: task.options.coverRatio ?? "3:4",
    secondCover: task.options.secondCover ?? false,
    secondCoverMode: task.options.secondCoverMode ?? "titled",
    secondCoverTemplateId: task.options.secondCoverTemplateId ?? "cinematic-poster",
    secondCoverRatio: task.options.secondCoverRatio ?? "3:4",
    voiceSource: task.options.voiceSource ?? "tts",
    ttsProvider: task.options.ttsProvider ?? fallbackTtsProvider,
    ttsVoiceId: task.options.ttsVoiceId ?? "",
    ttsVoiceIdB: task.options.ttsVoiceIdB ?? "",
    ttsSpeed: task.options.ttsSpeed ?? 1,
    ttsMode: task.options.ttsMode ?? "original-segmented",
    podcastImageMode: task.options.podcastImageMode ?? "multi",
    podcastPair: task.options.podcastPair ?? "mizai_dayi",
  };
}

export function taskPatchFromForm(form: BuilderFormState): Partial<StoryboundTask> {
  const dynamicStoryboard = form.materialSource === "ai"
    && form.videoForm === "narration"
    && form.dynamicStoryboard;
  const coverEnabled = form.materialSource !== "stock" && form.coverMode !== "off";
  const disabledPauseSteps = form.mode === "direct" ? [0, 1, 2] : form.mode === "semi_auto" ? [0, 1] : [];
  return {
    title: form.title.trim() || form.inputText.trim().slice(0, 22) || "未命名视频",
    inputText: form.inputText.trim(),
    sourceMode: form.sourceMode,
    aiBrief: form.aiBrief.trim(),
    mode: form.mode,
    pausePreset: form.pausePreset,
    customPauseSteps: form.customPauseSteps.filter((step) => !disabledPauseSteps.includes(step)),
    videoForm: form.videoForm,
    track: form.track,
    visualStyle: form.visualStyle,
    aspectRatio: form.aspectRatio,
    options: {
      rewriteIntensity: form.rewriteIntensity,
      narrativePov: form.narrativePov,
      targetLength: form.targetLength,
      targetScenes: form.targetScenes,
      promptTemplateId: form.promptTemplateId,
      promptTemplateOverride: form.promptTemplateOverride,
      keepPromotion: form.keepPromotion,
      fixedIntroEnabled: form.fixedIntroEnabled,
      fixedIntroMode: form.fixedIntroMode,
      fixedIntro: form.fixedIntro,
      lockIntroSentences: form.lockIntroSentences,
      lockIntroText: form.lockIntroText,
      lockIntroDirty: form.lockIntroDirty,
      outroCtaEnabled: form.outroCtaEnabled,
      outroCta: form.outroCta,
      materialSource: form.materialSource,
      autoBorrowImage: form.autoBorrowImage,
      dynamicStoryboard,
      draftTemplateId: form.draftTemplateId,
      draftTemplateConfig: form.draftTemplateConfig ?? undefined,
      videoIntro: dynamicStoryboard,
      videoIntroCount: dynamicStoryboard ? form.videoIntroCount : 0,
      videoIntroDurationMode: form.videoIntroDurationMode,
      videoIntroDuration: dynamicStoryboard && form.videoIntroDurationMode === "fixed" ? form.videoIntroDuration : 0,
      bgmSync: form.bgmSync,
      bgmId: form.bgmId,
      coverMode: coverEnabled ? form.coverMode : "off",
      coverTemplateId: form.coverTemplateId,
      coverRatio: form.coverRatio,
      secondCover: coverEnabled && form.coverMode !== "local" && form.secondCover,
      secondCoverMode: form.secondCoverMode,
      secondCoverTemplateId: form.secondCoverTemplateId,
      secondCoverRatio: form.secondCoverRatio,
      voiceSource: form.voiceSource,
      ttsProvider: form.videoForm === "podcast" ? "volcengine" : form.ttsProvider,
      ttsVoiceId: form.ttsVoiceId,
      ttsVoiceIdB: form.ttsVoiceIdB,
      ttsSpeed: form.ttsSpeed,
      ttsMode: form.ttsMode,
      podcastImageMode: form.podcastImageMode,
      podcastPair: form.podcastPair,
    },
  };
}

export function pipelineStartStep(mode: ExecutionMode): number {
  return mode === "auto" ? 0 : 2;
}
