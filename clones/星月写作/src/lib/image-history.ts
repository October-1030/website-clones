export interface ImageBatch { id: string; images: string[]; prompt: string; createdAt: string }
async function database(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("xingyue-image-history", 1);
    request.onupgradeneeded = () => request.result.createObjectStore("batches", { keyPath: "id" });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(new Error("图片历史存储不可用，请下载保存。"));
  });
}
export async function saveImageBatch(batch: ImageBatch) {
  return saveImageBatches([batch]);
}
export async function saveImageBatches(batches: ImageBatch[]) {
  const db = await database();
  try { await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction("batches", "readwrite");
    for (const batch of batches) transaction.objectStore("batches").put(batch);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(new Error("图片历史保存失败，请下载保存。"));
    transaction.onabort = () => reject(new Error("图片历史保存已中止，请下载保存。"));
  }); } finally { db.close(); }
}
export async function readImageHistory(): Promise<ImageBatch[]> {
  const db = await database();
  try { return await new Promise((resolve, reject) => {
    const request = db.transaction("batches", "readonly").objectStore("batches").getAll();
    request.onsuccess = () => resolve((request.result as ImageBatch[]).sort((a,b) => b.createdAt.localeCompare(a.createdAt)));
    request.onerror = () => reject(new Error("图片历史读取失败。"));
  }); } finally { db.close(); }
}

export async function deleteImageBatches(ids: string[]) {
  if (!ids.length) return;
  const db = await database();
  try { await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction("batches", "readwrite");
    for (const id of ids) transaction.objectStore("batches").delete(id);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(new Error("图片历史回滚失败。"));
    transaction.onabort = () => reject(new Error("图片历史回滚已中止。"));
  }); } finally { db.close(); }
}
