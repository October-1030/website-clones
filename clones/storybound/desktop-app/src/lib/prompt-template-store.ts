export interface PromptTemplate {
  id: string;
  name: string;
  baseTrack: string;
  version: string;
  rewritePrompt: string;
  metadataPrompt: string;
  segmentationPrompt: string;
  imagePrompt: string;
  source: "system" | "custom";
}

export interface PromptLibraryTrack {
  id: string;
  name: string;
  rewritePrompt?: string;
  metadataPrompt?: string;
  imagePrompt?: string;
}

export interface PromptLibraryPayload {
  sourceVersion: string;
  writerAgentPrompt: string;
  sentenceSplitPrompt: string;
  producerAgentPrompt: string;
  tracks: PromptLibraryTrack[];
}

const storageKey = "storybound-custom-prompt-templates-v1";
export const promptTemplateStoreEvent = "storybound-prompt-templates-changed";

export function templatesFromLibrary(promptLibrary: PromptLibraryPayload): PromptTemplate[] {
  return promptLibrary.tracks.map((track) => ({
    id: `system-${track.id}`,
    name: track.name,
    baseTrack: track.name,
    version: promptLibrary.sourceVersion.replace("Storybound ", ""),
    rewritePrompt: track.rewritePrompt || promptLibrary.writerAgentPrompt,
    metadataPrompt: track.metadataPrompt || promptLibrary.writerAgentPrompt,
    segmentationPrompt: promptLibrary.sentenceSplitPrompt,
    imagePrompt: track.imagePrompt || promptLibrary.producerAgentPrompt,
    source: "system",
  }));
}

export function emptyPromptTemplate(): PromptTemplate {
  return {
    id: crypto.randomUUID(),
    name: "",
    baseTrack: "通用故事",
    version: "1.0.0",
    rewritePrompt: "",
    metadataPrompt: "",
    segmentationPrompt: "",
    imagePrompt: "",
    source: "custom",
  };
}

export function readCustomPromptTemplates(): PromptTemplate[] {
  try {
    const value: unknown = JSON.parse(window.localStorage.getItem(storageKey) || "[]");
    return Array.isArray(value)
      ? value.filter((item): item is PromptTemplate => Boolean(
        item
        && typeof item === "object"
        && typeof item.id === "string"
        && typeof item.name === "string"
        && item.source === "custom",
      ))
      : [];
  } catch {
    return [];
  }
}

export function writeCustomPromptTemplates(templates: PromptTemplate[]): void {
  window.localStorage.setItem(storageKey, JSON.stringify(templates));
  window.dispatchEvent(new CustomEvent(promptTemplateStoreEvent));
}
