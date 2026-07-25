export const STUDYPAL_USAGE_CHANGED_EVENT = "studypal:usage-changed";

export function notifyUsageChanged(): void {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(STUDYPAL_USAGE_CHANGED_EVENT));
}