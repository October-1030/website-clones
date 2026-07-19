import type { GeneratedImage } from "./image";
import type { PipelineLlmArtifacts } from "./llm";
import type { ExecutionMode, PausePreset, PipelineStatus, VideoForm } from "./app";
import type { DraftTemplateConfig } from "./draft-template";

export type TaskRunState = "idle" | "queued" | "running" | "paused" | "cancelled" | "completed";
export type TaskStatus = "draft" | "pending" | "running" | "paused" | "completed" | "failed" | "cancelled";
export type MaterialSource = "ai" | "local" | "person" | "stock";
export type CoverMode = "off" | "titled" | "plain";
export type VoiceSource = "tts" | "external";

export interface TaskOptions {
  rewriteIntensity?: "light" | "standard" | "deep";
  narrativePov?: "original" | "first" | "third";
  targetLength?: number | null;
  targetScenes?: number | null;
  keepPromotion?: boolean;
  fixedIntro?: string;
  lockIntroSentences?: number;
  outroCta?: string;
  materialSource?: MaterialSource;
  autoBorrowImage?: boolean;
  dynamicStoryboard?: boolean;
  draftTemplateId?: string;
  draftTemplateConfig?: DraftTemplateConfig;
  videoIntro?: boolean;
  videoIntroCount?: number;
  videoIntroDurationMode?: "narration" | "fixed";
  videoIntroDuration?: number;
  bgmSync?: boolean;
  referenceImage?: StoredAsset | null;
  coverMode?: CoverMode;
  coverTemplateId?: string;
  coverRatio?: string;
  secondCover?: boolean;
  voiceSource?: VoiceSource;
  ttsProvider?: string;
  ttsVoiceId?: string;
  ttsVoiceIdB?: string;
  ttsSpeed?: number;
  ttsMode?: "original-segmented" | "continuous";
  podcastImageMode?: "multi" | "single";
  podcastPair?: string;
  narrationVolume?: number;
  bgmVolume?: number;
}

export interface StoredAsset {
  fileName: string;
  path: string;
  url: string;
  bytes: number;
  durationSec?: number;
}

export interface StoredImage extends GeneratedImage {
  path?: string;
  status: "pending" | "ready" | "failed" | "borrowed";
  error?: string;
  borrowedFrom?: number;
  crop?: { x: number; y: number; scale: number };
}

export interface AudioSegment {
  id: string;
  shotId: number;
  speaker?: "A" | "B";
  text: string;
  voiceId: string;
  fileName: string;
  path: string;
  url: string;
  bytes: number;
  durationSec: number;
  speed?: number;
  alignment?: TtsAlignment;
  startSec?: number;
  status: "pending" | "ready" | "failed";
  error?: string;
}

export interface TtsWordTiming {
  text: string;
  textStart: number;
  textEnd: number;
  startSec: number;
  endSec: number;
}

export interface TtsAlignment {
  source: "minimax-word";
  text: string;
  words: TtsWordTiming[];
}

export interface StoredVideo extends StoredAsset {
  id: string;
  shotId: number;
  durationSec: number;
  status: "pending" | "ready" | "failed";
  error?: string;
  width?: number;
  height?: number;
}

export interface TaskTimelineEntry {
  shotId: number;
  text: string;
  startSec: number;
  endSec: number;
  durationSec: number;
}

export interface DraftResult {
  ready: boolean;
  projectName: string;
  projectDir: string;
  zipPath: string;
  zipUrl: string;
  durationSec: number;
  trackCount: number;
  fileCount: number;
  bytes: number;
  missing: number[];
  generatedAt: string;
}

export interface StoryboundTask {
  schemaVersion: number;
  id: string;
  title: string;
  inputText: string;
  sourceMode: "paste" | "ai";
  aiBrief: string;
  mode: ExecutionMode;
  pausePreset: PausePreset;
  customPauseSteps: number[];
  videoForm: VideoForm;
  track: string;
  visualStyle: string;
  aspectRatio: "16:9" | "9:16" | "1:1" | "4:3" | "3:4";
  status: TaskStatus;
  runState: TaskRunState;
  currentStep: number;
  stepStatuses: PipelineStatus[];
  options: TaskOptions;
  artifacts: PipelineLlmArtifacts;
  media: {
    images: StoredImage[];
    videos: StoredVideo[];
    coverImages: StoredImage[];
    audioSegments: AudioSegment[];
    continuousAudio: AudioSegment | null;
    podcast: { segments: AudioSegment[]; totalDurationSec: number } | null;
    externalAudio: StoredAsset | null;
    bgm: StoredAsset | null;
    timeline?: TaskTimelineEntry[] | null;
  };
  draft: DraftResult | null;
  error: string | null;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
}

export interface TaskSummary {
  id: string;
  title: string;
  inputText: string;
  mode: ExecutionMode;
  videoForm: VideoForm;
  track: string;
  status: TaskStatus;
  runState: TaskRunState;
  currentStep: number;
  stepStatuses: PipelineStatus[];
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
  imageCount: number;
  audioCount: number;
  draftReady: boolean;
}
