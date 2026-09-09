"use client";

import { useState, type FormEvent } from "react";
import type { Book, Folder } from "@/types/workspace";
import { Modal } from "./Modal";

export function BookManageDialog({ book, folders, onChange, onClose }: { book: Book; folders: Folder[]; onChange: (book: Book) => void; onClose: () => void }) {
  const [draft, setDraft] = useState(book);
  const [error, setError] = useState("");
  function save(event: FormEvent) {
    event.preventDefault();
    if (!draft.title.trim()) { setError("请填写作品名称。"); return; }
    try { onChange({ ...book, title: draft.title.trim(), description: draft.description.trim(), folderId: draft.folderId, cover: draft.cover, updatedAt: new Date().toISOString() }); onClose(); }
    catch { setError("保存失败，请检查浏览器存储空间。"); }
  }
  return <Modal title="作品管理" onClose={onClose}><form className="grid gap-4" onSubmit={save}>
    {error && <p role="alert">{error}</p>}
    <label>作品名称<input className="form-input" required maxLength={30} value={draft.title} onChange={event => setDraft({ ...draft, title: event.target.value })} /></label>
    <p>作品类型：{book.kind === "novel" ? "小说" : "剧本"}</p>
    <label>作品简介<textarea className="form-input min-h-32" maxLength={500} value={draft.description} onChange={event => setDraft({ ...draft, description: event.target.value })} /></label>
    <label>所属文件夹<select className="form-input" value={draft.folderId || ""} onChange={event => setDraft({ ...draft, folderId: event.target.value || undefined })}><option value="">未归入文件夹</option>{folders.map(folder => <option key={folder.id} value={folder.id}>{folder.name}</option>)}</select></label>
    {draft.cover && <button type="button" className="subtle-button" onClick={() => setDraft({ ...draft, cover: undefined })}>移除作品封面</button>}
    <div className="flex justify-end gap-2"><button type="button" className="subtle-button" onClick={onClose}>取消</button><button className="primary-button">保存修改</button></div>
  </form></Modal>;
}
