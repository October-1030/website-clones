import type { DraftTemplateDefinition } from "../types/draft-template";

export const customDraftTemplateStorageKey = "storybound-custom-draft-templates-v1";
export const draftTemplateStoreEvent = "storybound-draft-templates-changed";

export function readCustomDraftTemplates(): DraftTemplateDefinition[] {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(customDraftTemplateStorageKey) || "[]") as DraftTemplateDefinition[];
    return Array.isArray(parsed)
      ? parsed.filter((template) => template?.id?.startsWith("custom-") && template?.name && template?.config?.canvas)
      : [];
  } catch {
    return [];
  }
}

export function writeCustomDraftTemplates(templates: DraftTemplateDefinition[]): void {
  window.localStorage.setItem(customDraftTemplateStorageKey, JSON.stringify(templates));
  window.dispatchEvent(new Event(draftTemplateStoreEvent));
}
