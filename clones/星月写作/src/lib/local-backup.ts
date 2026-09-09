import type { ImageBatch } from "./image-history";

export interface LocalBackup { format: "xingyue-backup"; version: 1; local: Record<string,string>; images: ImageBatch[] }
const object = (value: unknown): value is Record<string,unknown> => !!value && typeof value === "object" && !Array.isArray(value);
const recordFields: Record<string,string[]> = {
  "xingyue-folders": ["id","name"], "xingyue-resource-folders": ["id","name","type"],
  "xingyue-resources": ["id","name","type","content","updatedAt"],
  "xingyue-prompts": ["id","title","type","category","content","description","updatedAt"],
  "xingyue-knowledge-cards": ["id","title","category","scene","content","updatedAt"],
  "xingyue-workflows": ["id","name","description","category","systemInstruction","userTemplate","createdAt"],
  "xingyue-workflow-history": ["id","workflowId","workflowName","input","output","error","timestamp","bookId","chapterId"],
  "xingyue-context-combinations": ["id","name"],
};

export function parseLocalBackup(text: string): LocalBackup {
  const value: unknown = JSON.parse(text);
  if (!object(value)) throw new Error("备份文件格式不正确。");
  const versioned = value.format === "xingyue-backup";
  if (versioned && value.version !== 1) throw new Error("暂不支持此备份版本。");
  const data = versioned ? value.local : value;
  if (!object(data)) throw new Error("备份缺少本地数据。");
  const local: Record<string,string> = {};
  for (const [key, raw] of Object.entries(data)) {
    if (!/^xingyue-[\w-]+$/.test(key) || typeof raw !== "string") throw new Error("备份包含无法识别的数据项。");
    const item: unknown = JSON.parse(raw);
    if (item === null) throw new Error(`数据项 ${key} 为空。`);
    const fields = recordFields[key];
    if (fields && (!Array.isArray(item) || item.some(record => !object(record) || !fields.every(field => typeof record[field] === "string")))) throw new Error(`数据项 ${key} 格式不正确。`);
    if (key === "xingyue-context-combinations" && (item as Record<string,unknown>[]).some(record => !Array.isArray(record.ids) || record.ids.some(id => typeof id !== "string"))) throw new Error("关联组合格式不正确。");
    if (key === "xingyue-workflow-history" && (item as Record<string,unknown>[]).some(record => (record.rounds !== undefined && (!Array.isArray(record.rounds) || record.rounds.some(round => typeof round !== "string"))) || (record.roundCount !== undefined && (!Number.isInteger(record.roundCount) || Number(record.roundCount) < 1 || Number(record.roundCount) > 10)))) throw new Error("工作流轮次记录格式不正确。");
    if (["xingyue-guided","xingyue-eye-care","xingyue-community-visible"].includes(key) && typeof item !== "boolean") throw new Error("界面设置格式不正确。");
    if (key === "xingyue-skin" && (!Number.isInteger(item) || Number(item) < 0 || Number(item) > 20)) throw new Error("主题设置格式不正确。");
    if (["xingyue-mode","xingyue-layout","xingyue-last-check-in","xingyue-output-language","xingyue-opening-result"].includes(key) && typeof item !== "string") throw new Error("偏好设置格式不正确。");
    if (key === "xingyue-profile" && (!object(item) || typeof item.nickname !== "string" || typeof item.bio !== "string")) throw new Error("个人资料格式不正确。");
    if (key === "xingyue-opening-draft" && (!object(item) || !["title","theme","setting","tags","genre","ability","protagonist","extra","preset","customPrompt","context"].every(field => typeof item[field] === "string") || typeof item.useCustom !== "boolean" || ![1000,2000,3000,6000].includes(Number(item.words)))) throw new Error("开篇草稿格式不正确。");
    if (["xingyue-workflow-favorites","xingyue-course-progress"].includes(key) && (!Array.isArray(item) || item.some(entry => typeof entry !== "string"))) throw new Error("收藏或进度格式不正确。");
    if (key === "xingyue-books") {
      if (!Array.isArray(item) || item.some(book => !object(book) || !["id","title","description","content","updatedAt"].every(field => typeof book[field] === "string") || !["novel","script"].includes(String(book.kind)) || !["active","archived","trashed"].includes(String(book.status)) || (book.chapters !== undefined && (!Array.isArray(book.chapters) || book.chapters.some(chapter => !object(chapter) || !["id","title","content","summary","updatedAt"].every(field => typeof chapter[field] === "string")))))) throw new Error("作品或章节数据不完整，未导入任何内容。");
    }
    local[key] = raw;
  }
  const images: ImageBatch[] = [];
  if (versioned) {
    if (!Array.isArray(value.images)) throw new Error("图片历史格式不正确。");
    for (const batch of value.images) {
      if (!object(batch) || typeof batch.id !== "string" || typeof batch.prompt !== "string" || typeof batch.createdAt !== "string" || !Array.isArray(batch.images) || batch.images.some(image => typeof image !== "string" || !/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(image))) throw new Error("备份中存在无效图片。");
      images.push({ id: batch.id, prompt: batch.prompt, createdAt: batch.createdAt, images: batch.images as string[] });
    }
  }
  return { format: "xingyue-backup", version: 1, local, images };
}

export function restoreLocalEntries(storage: Pick<Storage,"getItem" | "setItem" | "removeItem">, local: Record<string,string>) {
  const previous = Object.fromEntries(Object.keys(local).map(key => [key,storage.getItem(key)]));
  try { for (const [key, value] of Object.entries(local)) storage.setItem(key,value); }
  catch {
    // Free space occupied by partially imported entries before putting the old values back.
    for (const key of Object.keys(local)) storage.removeItem(key);
    for (const [key,value] of Object.entries(previous)) if (value !== null) storage.setItem(key,value);
    throw new Error("浏览器存储空间不足，已恢复导入前的数据。");
  }
}
