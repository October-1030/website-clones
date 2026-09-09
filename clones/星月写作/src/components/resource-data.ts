export const RESOURCE_STORAGE_KEY = "xingyue-resources";
export const RESOURCE_FOLDER_STORAGE_KEY = "xingyue-resource-folders";

export type ResourceType = "character" | "term" | "memo" | "knowledge";

export interface ResourceHistoryEntry {
  id: string;
  content: string;
  createdAt: string;
}

export interface ResourceRecord {
  id: string;
  type: ResourceType;
  name: string;
  content: string;
  bookId?: string;
  folderId?: string;
  updatedAt: string;
  gender?: string;
  personality?: string;
  background?: string;
  appearance?: string;
  image?: string;
  pinned?: boolean;
  bookmarked?: boolean;
  history?: ResourceHistoryEntry[];
}

export interface ResourceFolder {
  id: string;
  name: string;
  type: ResourceType;
  bookId?: string;
}

export const emptyResources: ResourceRecord[] = [];
export const emptyResourceFolders: ResourceFolder[] = [];

export function resourceTypeLabel(type: ResourceType) {
  if (type === "character") return "角色";
  if (type === "term") return "词条";
  if (type === "memo") return "备忘录";
  return "知识卡";
}

export function resourceTypeTitle(type: ResourceType) {
  return `${resourceTypeLabel(type)}卡`;
}

export function createResource(type: ResourceType, bookId: string): ResourceRecord {
  const now = new Date().toISOString();
  const base: ResourceRecord = {
    id: crypto.randomUUID(),
    type,
    name: type === "memo" ? "新建备忘录" : "",
    content: "",
    bookId,
    updatedAt: now,
  };
  if (type === "character") return { ...base, gender: "未知", personality: "", background: "", appearance: "" };
  return base;
}

export function formatResourceTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "刚刚";
  const diff = Date.now() - date.getTime();
  if (diff < 60_000) return "刚刚";
  if (diff < 3_600_000) return `${Math.max(1, Math.floor(diff / 60_000))} 分钟前`;
  if (diff < 86_400_000) return `${Math.max(1, Math.floor(diff / 3_600_000))} 小时前`;
  return date.toLocaleDateString("zh-CN", { month: "2-digit", day: "2-digit" });
}

export function resourceContext(record: ResourceRecord) {
  if (record.type === "character") {
    return [
      `姓名：${record.name}`,
      `性别：${record.gender || "未知"}`,
      `性格：${record.personality || ""}`,
      `设定与背景：${record.background || ""}`,
      `外貌：${record.appearance || ""}`,
    ].join("\n");
  }
  return `${record.name}\n${record.content}`.trim();
}

export function safeFileName(name: string) {
  return (name.trim() || "星月资料").replace(/[\\/:*?"<>|]/g, "_").slice(0, 80);
}
