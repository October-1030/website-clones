export type AppPage =
  | "create"
  | "image-task"
  | "html-video"
  | "music-mv"
  | "queue"
  | "history"
  | "playground"
  | "voice-lab"
  | "person-assets"
  | "prompt-templates"
  | "draft-templates"
  | "book-selection"
  | "benchmark"
  | "market"
  | "settings"
  | "account"
  | "activation";

export type ExecutionMode = "auto" | "semi_auto" | "direct";
export type PausePreset = "none" | "key" | "every" | "custom";
export type VideoForm = "narration" | "podcast";
export type PipelineStatus = "pending" | "running" | "paused" | "done" | "skipped" | "failed";

export interface NavigationItem {
  page: AppPage;
  label: string;
  icon: string;
}

export interface PipelineStep {
  id: number;
  title: string;
  description: string;
}

export interface TaskDraft {
  id: string;
  title: string;
  inputText: string;
  mode: ExecutionMode;
  videoForm: VideoForm;
  track: string;
  status: "draft" | "running" | "paused" | "completed" | "failed";
  currentStep: number;
  createdAt: number;
}
