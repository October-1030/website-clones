const storageKey = "storybound:cta_library";

export const defaultCtaLibrary = [
  "关注我，下一期我们接着聊这样的故事。",
  "点个关注，下回咱们接着聊那些不能忘的故事。",
  "关注我们，我们会继续讲述这些不该被遗忘的故事，一起守护这段珍贵的记忆。",
  "如果{主角}的故事打动了你，请点亮小红心，在评论区写下致敬{主角}，让更多人记住他，你的每次点赞和分享都是对{主角}最好的纪念。",
  "如果你的手机还有哪怕百分之一的电量，请为{主角}点上一朵电子鲜花，让更多人看到他的名字。",
] as const;

export const ctaLibraryStoreEvent = "storybound-cta-library-changed";

export function readCtaLibrary(): string[] {
  try {
    const stored = window.localStorage.getItem(storageKey);
    if (stored === null) {
      writeCtaLibrary([...defaultCtaLibrary]);
      return [...defaultCtaLibrary];
    }
    const parsed = JSON.parse(stored) as unknown;
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
      : [...defaultCtaLibrary];
  } catch {
    return [...defaultCtaLibrary];
  }
}

export function writeCtaLibrary(items: string[]): void {
  const normalized = items.map((item) => item.trim()).filter(Boolean);
  window.localStorage.setItem(storageKey, JSON.stringify(normalized));
  window.dispatchEvent(new Event(ctaLibraryStoreEvent));
}
