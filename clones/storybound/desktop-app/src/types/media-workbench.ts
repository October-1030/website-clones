export type MediaWorkbenchKind = "html-video" | "music-mv";

export type MediaWorkbenchStatus =
  | "draft"
  | "running"
  | "paused"
  | "failed"
  | "completed"
  | "cancelled";

export type HtmlLayoutPreset =
  | "center-focus"
  | "person-focus"
  | "left-right-text-object"
  | "top-object-bottom-text"
  | "three-float"
  | "split-compare"
  | "quote-card"
  | "full-image"
  | "full-quote"
  | "grid-four"
  | "rule-of-thirds"
  | "data-emphasis";

export type HtmlSubtitleStyle =
  | "outline"
  | "pill"
  | "translucent"
  | "gradient"
  | "neon"
  | "karaoke"
  | "highlight";

export type HtmlAnimationPreset =
  | "pop"
  | "rise"
  | "bounce"
  | "wipe"
  | "reveal"
  | "breathe"
  | "typewriter";

export type MusicMvStyle = "patriotic" | "nostalgic" | "inspirational" | "pastoral" | "custom";
export type MusicMvSinger = "any" | "female" | "male" | "duet";

export type MediaAssetKind = "images" | "audio" | "music" | "cover" | "uploads" | "output";

export interface MediaWorkbenchAsset {
  fileName: string;
  path: string;
  url: string;
  bytes: number;
  mimeType?: string;
  durationSec?: number;
  width?: number;
  height?: number;
}

export interface HtmlVideoScene {
  id: number;
  title: string;
  subtitle: string;
  prompt: string;
  layout: HtmlLayoutPreset;
  subtitleStyle: HtmlSubtitleStyle;
  animation: HtmlAnimationPreset;
  image?: MediaWorkbenchAsset;
  audio?: MediaWorkbenchAsset;
  durationSec?: number;
  status?: "pending" | "generating" | "ready" | "failed";
  error?: string;
}

export interface MusicLyricGroup {
  id: number;
  lyrics: string;
  prompt: string;
  image?: MediaWorkbenchAsset;
  startSec?: number;
  endSec?: number;
  durationSec?: number;
  selected?: boolean;
  status?: "pending" | "generating" | "ready" | "failed";
  error?: string;
}

export interface HtmlVideoManifest {
  schemaVersion: 1;
  kind: "html-video";
  title: string;
  sourceText: string;
  rewrittenText?: string;
  visualStyle: string;
  aspectRatio: "9:16" | "16:9";
  width: number;
  height: number;
  fps: number;
  scenes: HtmlVideoScene[];
  cover?: MediaWorkbenchAsset;
  createdAt: string;
  updatedAt: string;
}

export interface MusicMvManifest {
  schemaVersion: 1;
  kind: "music-mv";
  title: string;
  lyrics: string;
  style: MusicMvStyle;
  customStyle?: string;
  singer: MusicMvSinger;
  visualStyle: string;
  aspectRatio: "9:16" | "16:9";
  width: number;
  height: number;
  fps: number;
  music?: MediaWorkbenchAsset;
  cover?: MediaWorkbenchAsset;
  groups: MusicLyricGroup[];
  createdAt: string;
  updatedAt: string;
}

export type MediaWorkbenchManifest = HtmlVideoManifest | MusicMvManifest;

export interface MediaWorkbenchOutput {
  mp4Path: string;
  mp4Url: string;
  manifestPath: string;
  manifestUrl: string;
  jianyingZipPath: string;
  jianyingZipUrl: string;
  durationSec: number;
  width: number;
  height: number;
  fps: number;
  videoCodec: string;
  audioCodec: string;
  renderer?: string;
  bytes: number;
  generatedAt: string;
}

export interface MediaWorkbenchJob<TManifest extends MediaWorkbenchManifest = MediaWorkbenchManifest> {
  id: string;
  kind: TManifest["kind"];
  title: string;
  status: MediaWorkbenchStatus;
  stage: string;
  progress: number;
  resumable: boolean;
  manifest: TManifest;
  output?: MediaWorkbenchOutput;
  error?: string;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
}

export type HtmlVideoJob = MediaWorkbenchJob<HtmlVideoManifest>;
export type MusicMvJob = MediaWorkbenchJob<MusicMvManifest>;

export interface MediaWorkbenchJobSummary {
  id: string;
  kind: MediaWorkbenchKind;
  title: string;
  status: MediaWorkbenchStatus;
  stage: string;
  progress: number;
  resumable: boolean;
  durationSec?: number;
  createdAt: string;
  updatedAt: string;
}

export interface MediaWorkbenchCapabilities {
  ffmpeg: boolean;
  ffprobe: boolean;
  acceptedAudio: string[];
  acceptedImages: string[];
  maxUploadBytes: number;
}

export interface CreateMediaJobInput {
  id?: string;
  kind: MediaWorkbenchKind;
  title: string;
  manifest: MediaWorkbenchManifest;
}

export interface UpdateMediaJobInput {
  title?: string;
  status?: Extract<MediaWorkbenchStatus, "draft" | "paused">;
  stage?: string;
  progress?: number;
  manifest?: MediaWorkbenchManifest;
  error?: string | null;
}

export interface RenderMediaJobInput {
  manifest?: MediaWorkbenchManifest;
  timelineOnly?: boolean;
}

export interface MediaWorkbenchListResponse {
  jobs: MediaWorkbenchJobSummary[];
}

export interface MediaWorkbenchJobResponse<TManifest extends MediaWorkbenchManifest = MediaWorkbenchManifest> {
  job: MediaWorkbenchJob<TManifest>;
}

export interface MediaWorkbenchAssetResponse {
  asset: MediaWorkbenchAsset;
}

export const htmlLayoutLabels: Record<HtmlLayoutPreset, string> = {
  "center-focus": "中心聚焦",
  "person-focus": "人物聚焦",
  "left-right-text-object": "左文右物",
  "top-object-bottom-text": "上物下文",
  "three-float": "三元素漂浮",
  "split-compare": "左右对比",
  "quote-card": "金句卡片",
  "full-image": "全屏画面",
  "full-quote": "全屏金句",
  "grid-four": "四宫格",
  "rule-of-thirds": "三分法",
  "data-emphasis": "数据强调",
};

export const htmlSubtitleStyleLabels: Record<HtmlSubtitleStyle, string> = {
  outline: "经典描边",
  pill: "实色胶囊",
  translucent: "半透明底",
  gradient: "渐变字幕",
  neon: "霓虹光",
  karaoke: "卡拉 OK",
  highlight: "逐词高亮",
};

export const htmlAnimationLabels: Record<HtmlAnimationPreset, string> = {
  pop: "弹入",
  rise: "上升",
  bounce: "弹性",
  wipe: "擦入",
  reveal: "显影",
  breathe: "呼吸",
  typewriter: "打字机",
};

export const musicStyleLabels: Record<MusicMvStyle, string> = {
  patriotic: "爱国",
  nostalgic: "怀旧",
  inspirational: "励志",
  pastoral: "田园",
  custom: "自定义",
};

export const musicSingerLabels: Record<MusicMvSinger, string> = {
  any: "不限",
  female: "女声",
  male: "男声",
  duet: "男女合唱",
};
