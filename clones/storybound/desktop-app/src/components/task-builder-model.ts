import { contentTracks, originalDefaultStyleByTrack, visualStyles } from "../data/app-data";
import type { ExecutionMode, PausePreset, VideoForm } from "../types/app";
import type { ImageGenerationRequest } from "../types/image";
import type { StoryboundTask, TaskOptions } from "../types/task";

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
  visualStyle: string;
  aspectRatio: ImageGenerationRequest["aspectRatio"];
  rewriteIntensity: NonNullable<TaskOptions["rewriteIntensity"]>;
  narrativePov: NonNullable<TaskOptions["narrativePov"]>;
  targetLength: number | null;
  targetScenes: number | null;
  keepPromotion: boolean;
  fixedIntro: string;
  lockIntroSentences: number;
  outroCta: string;
  materialSource: NonNullable<TaskOptions["materialSource"]>;
  autoBorrowImage: boolean;
  dynamicStoryboard: boolean;
  targetDurationSec: number | null;
  draftTemplateId: string;
  bgmSync: boolean;
  coverMode: NonNullable<TaskOptions["coverMode"]>;
  coverTemplateId: string;
  coverRatio: string;
  secondCover: boolean;
  voiceSource: NonNullable<TaskOptions["voiceSource"]>;
  ttsVoiceId: string;
  ttsVoiceIdB: string;
  ttsSpeed: number;
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
  visualStyle: originalDefaultStyleByTrack[defaultTrack] ?? visualStyles[0] ?? "黑白摄影",
  aspectRatio: "9:16",
  rewriteIntensity: "standard",
  narrativePov: "original",
  targetLength: null,
  targetScenes: null,
  keepPromotion: false,
  fixedIntro: "",
  lockIntroSentences: 0,
  outroCta: "",
  materialSource: "ai",
  autoBorrowImage: true,
  dynamicStoryboard: true,
  targetDurationSec: null,
  draftTemplateId: "default-portrait-9-16",
  bgmSync: false,
  coverMode: "off",
  coverTemplateId: "cinematic-poster",
  coverRatio: "3:4",
  secondCover: false,
  voiceSource: "tts",
  ttsVoiceId: "",
  ttsVoiceIdB: "",
  ttsSpeed: 1,
  podcastImageMode: "multi",
  podcastPair: "自定义双主播",
};

export function formFromTask(task: StoryboundTask): BuilderFormState {
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
    visualStyle: task.visualStyle,
    aspectRatio: task.aspectRatio,
    rewriteIntensity: task.options.rewriteIntensity ?? "standard",
    narrativePov: task.options.narrativePov ?? "original",
    targetLength: task.options.targetLength ?? null,
    targetScenes: task.options.targetScenes ?? null,
    keepPromotion: task.options.keepPromotion ?? false,
    fixedIntro: task.options.fixedIntro ?? "",
    lockIntroSentences: task.options.lockIntroSentences ?? 0,
    outroCta: task.options.outroCta ?? "",
    materialSource: task.options.materialSource ?? "ai",
    autoBorrowImage: task.options.autoBorrowImage ?? true,
    dynamicStoryboard: task.options.dynamicStoryboard ?? true,
    targetDurationSec: task.options.targetDurationSec ?? null,
    draftTemplateId: task.options.draftTemplateId ?? "default-portrait-9-16",
    bgmSync: task.options.bgmSync ?? false,
    coverMode: task.options.coverMode ?? "off",
    coverTemplateId: task.options.coverTemplateId ?? "cinematic-poster",
    coverRatio: task.options.coverRatio ?? "3:4",
    secondCover: task.options.secondCover ?? false,
    voiceSource: task.options.voiceSource ?? "tts",
    ttsVoiceId: task.options.ttsVoiceId ?? "",
    ttsVoiceIdB: task.options.ttsVoiceIdB ?? "",
    ttsSpeed: task.options.ttsSpeed ?? 1,
    podcastImageMode: task.options.podcastImageMode ?? "multi",
    podcastPair: task.options.podcastPair ?? "自定义双主播",
  };
}

export function taskPatchFromForm(form: BuilderFormState): Partial<StoryboundTask> {
  return {
    title: form.title.trim() || form.inputText.trim().slice(0, 22) || "未命名视频",
    inputText: form.inputText.trim(),
    sourceMode: form.sourceMode,
    aiBrief: form.aiBrief.trim(),
    mode: form.mode,
    pausePreset: form.pausePreset,
    customPauseSteps: form.customPauseSteps,
    videoForm: form.videoForm,
    track: form.track,
    visualStyle: form.visualStyle,
    aspectRatio: form.aspectRatio,
    options: {
      rewriteIntensity: form.rewriteIntensity,
      narrativePov: form.narrativePov,
      targetLength: form.targetLength,
      targetScenes: form.targetScenes,
      keepPromotion: form.keepPromotion,
      fixedIntro: form.fixedIntro,
      lockIntroSentences: form.lockIntroSentences,
      outroCta: form.outroCta,
      materialSource: form.materialSource,
      autoBorrowImage: form.autoBorrowImage,
      dynamicStoryboard: form.dynamicStoryboard,
      targetDurationSec: form.targetDurationSec,
      draftTemplateId: form.draftTemplateId,
      bgmSync: form.bgmSync,
      coverMode: form.coverMode,
      coverTemplateId: form.coverTemplateId,
      coverRatio: form.coverRatio,
      secondCover: form.secondCover,
      voiceSource: form.voiceSource,
      ttsVoiceId: form.ttsVoiceId,
      ttsVoiceIdB: form.ttsVoiceIdB,
      ttsSpeed: form.ttsSpeed,
      podcastImageMode: form.podcastImageMode,
      podcastPair: form.podcastPair,
    },
  };
}

export function pipelineStartStep(mode: ExecutionMode): number {
  return mode === "auto" ? 0 : 2;
}
