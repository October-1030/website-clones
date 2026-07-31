import type { BuilderFormState } from "../components/task-builder-model";

export type TaskPresetForm = Omit<BuilderFormState, "title" | "inputText" | "aiBrief" | "sourceMode">;

export interface TaskPreset {
  id: string;
  name: string;
  form: TaskPresetForm;
  createdAt: string;
}

const storageKey = "storybound.taskPresets.v1";
export const taskPresetStoreEvent = "storybound-task-presets-changed";

function isTaskPreset(value: unknown): value is TaskPreset {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<TaskPreset>;
  return typeof candidate.id === "string"
    && typeof candidate.name === "string"
    && Boolean(candidate.form)
    && typeof candidate.form === "object";
}

export function readTaskPresets(): TaskPreset[] {
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(storageKey) || "[]");
    return Array.isArray(parsed) ? parsed.filter(isTaskPreset) : [];
  } catch {
    return [];
  }
}

export function writeTaskPresets(presets: TaskPreset[]): void {
  window.localStorage.setItem(storageKey, JSON.stringify(presets));
  window.dispatchEvent(new CustomEvent(taskPresetStoreEvent));
}

export function presetFormFromBuilder(form: BuilderFormState): TaskPresetForm {
  const presetForm = structuredClone(form) as Partial<BuilderFormState>;
  delete presetForm.title;
  delete presetForm.inputText;
  delete presetForm.aiBrief;
  delete presetForm.sourceMode;
  return presetForm as TaskPresetForm;
}
