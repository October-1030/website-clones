export type MarketKind = "prompt" | "style" | "cover";

export type MarketItemOrigin = "bundled" | "local-import";

export interface MarketItem {
  id: string;
  kind: MarketKind;
  name: string;
  description: string;
  track: string;
  author: string;
  installs: number;
  version: string;
  origin: MarketItemOrigin;
  updatedAt: string;
  tags: string[];
  apply: {
    track?: string;
    visualStyle?: string;
    coverTemplateId?: string;
  };
}

interface MarketStoreV2 {
  version: 2;
  localItems: MarketItem[];
  installedIds: string[];
  installedAt: Record<string, string>;
}

export interface MarketItemInput {
  id?: string;
  kind?: unknown;
  name?: unknown;
  description?: unknown;
  track?: unknown;
  author?: unknown;
  version?: unknown;
  tags?: unknown;
  apply?: unknown;
}

export const marketStorageKey = "storybound-local-market-v2";
export const legacyMarketStorageKey = "storybound-local-market-installed";
export const marketStoreEvent = "storybound-market-installed-changed";

const bundledMarketItems: MarketItem[] = [
  {
    id: "bundled-prompt-folk",
    kind: "prompt",
    name: "民间故事口播模板",
    description: "本地内置的任务赛道快捷配置。安装后可在创建任务页一键切换到民间故事赛道。",
    track: "民间故事",
    author: "Storybound 本地模板库",
    installs: 0,
    version: "1.0.0",
    origin: "bundled",
    updatedAt: "2026-08-02T00:00:00.000Z",
    tags: ["口播", "民间故事", "逐镜配音"],
    apply: { track: "民间故事" },
  },
  {
    id: "bundled-prompt-character",
    kind: "prompt",
    name: "人物故事任务模板",
    description: "本地内置的人物故事赛道快捷配置，仅改变创建任务页的赛道选择，不包含原站付费提示词。",
    track: "人物故事",
    author: "Storybound 本地模板库",
    installs: 0,
    version: "1.0.0",
    origin: "bundled",
    updatedAt: "2026-08-02T00:00:00.000Z",
    tags: ["人物故事", "传记"],
    apply: { track: "人物故事" },
  },
  {
    id: "bundled-style-ink",
    kind: "style",
    name: "中国水墨",
    description: "本地可用的画面风格快捷项。安装后会出现在创建任务与画图实验室的风格列表中。",
    track: "通用",
    author: "Storybound 本地模板库",
    installs: 0,
    version: "1.0.0",
    origin: "bundled",
    updatedAt: "2026-08-02T00:00:00.000Z",
    tags: ["水墨", "传统文化"],
    apply: { visualStyle: "中国水墨" },
  },
  {
    id: "bundled-style-cinema",
    kind: "style",
    name: "现代电影",
    description: "本地可用的现代电影画风快捷项，安装后会真实交接到任务创建器和画图实验室。",
    track: "通用",
    author: "Storybound 本地模板库",
    installs: 0,
    version: "1.0.0",
    origin: "bundled",
    updatedAt: "2026-08-02T00:00:00.000Z",
    tags: ["电影感", "低饱和"],
    apply: { visualStyle: "现代电影" },
  },
  {
    id: "bundled-cover-impact",
    kind: "cover",
    name: "高对比标题封面",
    description: "本地封面模板快捷项，对应创建任务页已有的高冲击标题模板。",
    track: "通用",
    author: "Storybound 本地模板库",
    installs: 0,
    version: "1.0.0",
    origin: "bundled",
    updatedAt: "2026-08-02T00:00:00.000Z",
    tags: ["竖屏", "大标题"],
    apply: { coverTemplateId: "typographic-impact" },
  },
];

export const marketItems: MarketItem[] = bundledMarketItems;

function createId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `local-${crypto.randomUUID()}`;
  }
  return `local-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function readKind(value: unknown): MarketKind {
  if (value === "style" || value === "cover") return value;
  return "prompt";
}

function readTags(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(readText).filter(Boolean).slice(0, 12);
  const text = readText(value);
  return text ? text.split(/[,，、]/).map((item) => item.trim()).filter(Boolean).slice(0, 12) : [];
}

function normalizeApply(kind: MarketKind, value: unknown, fallback = ""): MarketItem["apply"] {
  const record = isRecord(value) ? value : {};
  if (kind === "style") {
    const visualStyle = readText(record.visualStyle) || fallback;
    return visualStyle ? { visualStyle } : {};
  }
  if (kind === "cover") {
    const coverTemplateId = readText(record.coverTemplateId) || fallback;
    return coverTemplateId ? { coverTemplateId } : {};
  }
  const track = readText(record.track) || fallback;
  return track ? { track } : {};
}

export function normalizeMarketItem(value: MarketItemInput | unknown): MarketItem | null {
  if (!isRecord(value)) return null;
  const name = readText(value.name);
  if (!name) return null;
  const kind = readKind(value.kind);
  const track = readText(value.track) || "通用";
  const apply = normalizeApply(kind, value.apply, kind === "prompt" ? track : name);
  if (Object.keys(apply).length === 0) return null;
  return {
    id: readText(value.id) || createId(),
    kind,
    name,
    description: readText(value.description) || "本地导入资源，未提供简介。",
    track,
    author: readText(value.author) || "本地导入",
    installs: 0,
    version: readText(value.version) || "1.0.0",
    origin: "local-import",
    updatedAt: new Date().toISOString(),
    tags: readTags(value.tags),
    apply,
  };
}

function emptyStore(): MarketStoreV2 {
  return { version: 2, localItems: [], installedIds: [], installedAt: {} };
}

function getStorage(): Storage | null {
  return typeof window === "undefined" ? null : window.localStorage;
}

function readStore(): MarketStoreV2 {
  const storage = getStorage();
  if (!storage) return emptyStore();
  try {
    const parsed: unknown = JSON.parse(storage.getItem(marketStorageKey) || "null");
    if (!isRecord(parsed) || parsed.version !== 2) {
      const legacy: unknown = JSON.parse(storage.getItem(legacyMarketStorageKey) || "[]");
      const installedIds = Array.isArray(legacy) ? legacy.map(String) : [];
      return { ...emptyStore(), installedIds };
    }
    const localItems = Array.isArray(parsed.localItems)
      ? parsed.localItems.flatMap((item) => {
          const normalized = normalizeMarketItem(item);
          if (!normalized || !isRecord(item)) return [];
          return [{
            ...normalized,
            id: readText(item.id) || normalized.id,
            updatedAt: readText(item.updatedAt) || normalized.updatedAt,
          }];
        })
      : [];
    const installedIds = Array.isArray(parsed.installedIds) ? parsed.installedIds.map(String) : [];
    const installedAt = isRecord(parsed.installedAt)
      ? Object.fromEntries(Object.entries(parsed.installedAt).map(([id, at]) => [id, readText(at)]))
      : {};
    return { version: 2, localItems, installedIds, installedAt };
  } catch {
    return emptyStore();
  }
}

function writeStore(store: MarketStoreV2): void {
  const storage = getStorage();
  if (!storage) return;
  storage.setItem(marketStorageKey, JSON.stringify(store));
  window.dispatchEvent(new Event(marketStoreEvent));
}

export function readMarketItems(): MarketItem[] {
  const store = readStore();
  const seen = new Set<string>();
  return [...bundledMarketItems, ...store.localItems].filter((item) => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
}

export function readLocalMarketItems(): MarketItem[] {
  return readStore().localItems;
}

export function upsertLocalMarketItem(input: MarketItemInput): MarketItem {
  const normalized = normalizeMarketItem(input);
  if (!normalized) throw new Error("资源名称和应用参数不能为空。");
  const store = readStore();
  const item = { ...normalized, id: readText(input.id) || normalized.id, updatedAt: new Date().toISOString() };
  const existingIndex = store.localItems.findIndex((entry) => entry.id === item.id);
  const localItems = existingIndex >= 0
    ? store.localItems.map((entry, index) => index === existingIndex ? item : entry)
    : [item, ...store.localItems];
  writeStore({ ...store, localItems });
  return item;
}

export function importLocalMarketItems(value: unknown): MarketItem[] {
  const values = Array.isArray(value)
    ? value
    : isRecord(value) && Array.isArray(value.items)
      ? value.items
      : [value];
  const imported = values.flatMap((item) => {
    const normalized = normalizeMarketItem(item);
    return normalized ? [normalized] : [];
  });
  if (imported.length === 0) throw new Error("文件中没有可导入的本地资源。");
  const store = readStore();
  const byId = new Map(store.localItems.map((item) => [item.id, item]));
  imported.forEach((item) => byId.set(item.id, item));
  writeStore({ ...store, localItems: [...byId.values()] });
  return imported;
}

export function removeLocalMarketItem(itemId: string): void {
  const store = readStore();
  writeStore({
    ...store,
    localItems: store.localItems.filter((item) => item.id !== itemId),
    installedIds: store.installedIds.filter((id) => id !== itemId),
  });
}

export function readInstalledMarketIds(): string[] {
  const availableIds = new Set(readMarketItems().map((item) => item.id));
  return readStore().installedIds.filter((id) => availableIds.has(id));
}

export function writeInstalledMarketIds(ids: string[]): void {
  const store = readStore();
  const availableIds = new Set(readMarketItems().map((item) => item.id));
  const installedIds = [...new Set(ids)].filter((id) => availableIds.has(id));
  const installedAt = { ...store.installedAt };
  installedIds.forEach((id) => { installedAt[id] ||= new Date().toISOString(); });
  Object.keys(installedAt).forEach((id) => {
    if (!installedIds.includes(id)) delete installedAt[id];
  });
  writeStore({ ...store, installedIds, installedAt });
}

export function readInstalledMarketItems(): MarketItem[] {
  const ids = new Set(readInstalledMarketIds());
  return readMarketItems().filter((item) => ids.has(item.id));
}

export function readMarketInstalledAt(itemId: string): string {
  return readStore().installedAt[itemId] || "";
}
