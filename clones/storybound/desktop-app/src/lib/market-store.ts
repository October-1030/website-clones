export type MarketKind = "prompt" | "style" | "cover";

export interface MarketItem {
  id: string;
  kind: MarketKind;
  name: string;
  description: string;
  track: string;
  author: string;
  installs: number;
  version: string;
  apply: {
    track?: string;
    visualStyle?: string;
    coverTemplateId?: string;
  };
}

export const marketStorageKey = "storybound-local-market-installed";
export const marketStoreEvent = "storybound-market-installed-changed";

export const marketItems: MarketItem[] = [
  { id: "prompt-suspense", kind: "prompt", name: "悬疑故事七步模板", description: "强化开场钩子、证据递进和结尾反转，适合人物悬疑与民间故事。", track: "故事", author: "Storybound", installs: 1286, version: "1.4", apply: { track: "人物故事" } },
  { id: "prompt-folk", kind: "prompt", name: "民间故事口播模板", description: "保留口语感和自然停顿，按逐镜独立配音结构拆分旁白与分镜。", track: "民间故事", author: "Storybound", installs: 954, version: "1.2", apply: { track: "民间故事" } },
  { id: "style-ink", kind: "style", name: "中国水墨叙事", description: "宣纸肌理、淡墨设色和传统人物构图，适合历史与志怪题材。", track: "通用", author: "本地模板库", installs: 2310, version: "2.0", apply: { visualStyle: "中国水墨" } },
  { id: "style-cinema", kind: "style", name: "现代电影光影", description: "低饱和电影色调、主体清晰、景深和叙事性光影，适合现代人物故事。", track: "通用", author: "本地模板库", installs: 1872, version: "1.8", apply: { visualStyle: "现代电影" } },
  { id: "cover-yellow", kind: "cover", name: "黄字悬疑封面", description: "竖屏大标题、黄色高对比文字和暗调主体，兼顾首屏可读性。", track: "通用", author: "Storybound", installs: 1420, version: "1.3", apply: { coverTemplateId: "typographic-impact" } },
  { id: "cover-card", kind: "cover", name: "知识卡分栏封面", description: "顶部标题、中部画面、底部摘要的知识卡布局，适合科普与书单。", track: "通用", author: "Storybound", installs: 706, version: "1.1", apply: { coverTemplateId: "minimal-clean" } },
];

export function readInstalledMarketIds(): string[] {
  try {
    const value = JSON.parse(window.localStorage.getItem(marketStorageKey) || "[]");
    return Array.isArray(value) ? value.map(String).filter((id) => marketItems.some((item) => item.id === id)) : [];
  } catch {
    return [];
  }
}

export function writeInstalledMarketIds(ids: string[]): void {
  window.localStorage.setItem(marketStorageKey, JSON.stringify(ids));
  window.dispatchEvent(new Event(marketStoreEvent));
}

export function readInstalledMarketItems(): MarketItem[] {
  const ids = new Set(readInstalledMarketIds());
  return marketItems.filter((item) => ids.has(item.id));
}
