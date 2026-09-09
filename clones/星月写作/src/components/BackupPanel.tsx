"use client";

import { useState } from "react";
import { deleteImageBatches, readImageHistory, saveImageBatches } from "@/lib/image-history";
import { parseLocalBackup, restoreLocalEntries, type LocalBackup } from "@/lib/local-backup";

export function BackupPanel() {
  const [backup, setBackup] = useState<LocalBackup | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  async function download() {
    setBusy(true); setMessage("");
    try {
      const local: Record<string,string> = {};
      for (let i = 0; i < localStorage.length; i++) { const key = localStorage.key(i); if (key?.startsWith("xingyue-")) { const value = localStorage.getItem(key); if (value !== null) local[key] = value; } }
      const images = await readImageHistory();
      const data: LocalBackup = { format: "xingyue-backup", version: 1, local, images };
      const url = URL.createObjectURL(new Blob([JSON.stringify(data)], { type: "application/json" }));
      const link = document.createElement("a"); link.href = url; link.download = `星月写作完整备份-${new Date().toISOString().slice(0,10)}.json`; link.click(); setTimeout(() => URL.revokeObjectURL(url),1000);
      setMessage(`已生成备份：${Object.keys(local).length}项数据、${images.length}批图片。请保留下载文件。`);
    } catch (cause) { setMessage(cause instanceof Error ? cause.message : "备份失败，请重试。"); }
    finally { setBusy(false); }
  }
  async function restore() {
    if (!backup) return;
    setBusy(true); setMessage("");
    let insertedImageIds: string[] = [];
    try {
      const currentImages = await readImageHistory();
      const newImages = backup.images.filter(batch => !currentImages.some(current => current.id === batch.id));
      insertedImageIds = newImages.map(batch => batch.id);
      await saveImageBatches(newImages);
      restoreLocalEntries(localStorage, backup.local);
      window.dispatchEvent(new Event("xingyue-local-change"));
      setBackup(null); setMessage("备份已恢复。重新打开各工具即可读取恢复的资料。");
    } catch (cause) {
      if (insertedImageIds.length) {
        try { await deleteImageBatches(insertedImageIds); }
        catch { setMessage("恢复失败，新增图片的自动回滚也未完成。请先导出当前备份后重试。"); setBusy(false); return; }
      }
      setMessage(cause instanceof Error ? cause.message : "恢复失败，请重试。");
    }
    finally { setBusy(false); }
  }
  return <section aria-label="本地备份与恢复" className="space-y-3 rounded-lg border border-border p-3">
    <strong>备份与恢复</strong><p className="text-xs text-muted">包含作品、章节、角色、提示词、工作流及图片历史。可把备份文件带到另一台设备导入。</p>
    <button type="button" className="subtle-button" disabled={busy} onClick={download}>导出全部本地数据</button>
    <label className="block">导入备份文件<input className="block max-w-full text-sm" type="file" accept=".json,application/json" disabled={busy} onChange={async event => { const input = event.currentTarget; const file = input.files?.[0]; setBackup(null); if (!file) return; try { if (file.size > 100 * 1024 * 1024) throw new Error("请选择100MB以内的备份文件。"); setBackup(parseLocalBackup(await file.text())); setMessage(""); } catch (cause) { setMessage(cause instanceof Error ? cause.message : "无法读取备份文件。"); } input.value = ""; }} /></label>
    {backup && <div className="space-y-2"><p className="text-sm">待恢复：{Object.keys(backup.local).length}项数据、{backup.images.length}批图片。备份中同名的数据项会覆盖当前值，其他数据保留；建议先导出当前备份。</p><button type="button" className="primary-button" disabled={busy} onClick={restore}>恢复此备份</button><button type="button" className="subtle-button ml-2" onClick={() => setBackup(null)}>取消导入</button></div>}
    {message && <p role="status" className="text-sm">{message}</p>}
  </section>;
}
