export interface CustomVisualStyle {
  id: string;
  name: string;
  prompt: string;
  negativePrompt: string;
}

const storageKey = "storybound-custom-visual-styles-v1";
export const customStyleStoreEvent = "storybound-custom-styles-changed";

export function readCustomVisualStyles(): CustomVisualStyle[] {
  try {
    const value = JSON.parse(window.localStorage.getItem(storageKey) || "[]") as CustomVisualStyle[];
    return Array.isArray(value)
      ? value.filter((style) => style?.id && style?.name && style?.prompt)
      : [];
  } catch {
    return [];
  }
}

export function writeCustomVisualStyles(styles: CustomVisualStyle[]): void {
  window.localStorage.setItem(storageKey, JSON.stringify(styles));
  window.dispatchEvent(new Event(customStyleStoreEvent));
}

export function findCustomVisualStyle(name: string): CustomVisualStyle | null {
  return readCustomVisualStyles().find((style) => style.name === name) || null;
}
