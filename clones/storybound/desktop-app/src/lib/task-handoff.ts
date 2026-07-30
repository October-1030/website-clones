export interface TaskHandoff {
  title: string;
  inputText: string;
  track?: string;
}

const taskHandoffKey = "storybound-task-handoff";

export function saveTaskHandoff(value: TaskHandoff): void {
  window.sessionStorage.setItem(taskHandoffKey, JSON.stringify(value));
}

export function takeTaskHandoff(): TaskHandoff | null {
  const raw = window.sessionStorage.getItem(taskHandoffKey);
  if (!raw) return null;
  window.sessionStorage.removeItem(taskHandoffKey);
  try {
    const parsed = JSON.parse(raw) as Partial<TaskHandoff>;
    if (typeof parsed.inputText !== "string" || !parsed.inputText.trim()) return null;
    return {
      title: typeof parsed.title === "string" ? parsed.title : "",
      inputText: parsed.inputText,
      track: typeof parsed.track === "string" ? parsed.track : undefined,
    };
  } catch {
    return null;
  }
}

