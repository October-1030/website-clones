"use client";

import { useState, type FormEvent } from "react";
import { CheckCircle2, ChevronDown } from "lucide-react";
import { Modal } from "./Modal";
import { BooksIcon, ScriptIcon } from "./icons";
import type { BookKind } from "@/types/workspace";

export function BookDialog({ onClose, onCreate }: { onClose: () => void; onCreate: (title: string, kind: BookKind, description: string) => void }) {
  const [title, setTitle] = useState("新建作品");
  const [kind, setKind] = useState<BookKind>("novel");
  const [description, setDescription] = useState("");
  const [error, setError] = useState("");
  function submit(event: FormEvent) {
    event.preventDefault();
    if (!title.trim()) return;
    setError("");
    try {
      onCreate(title.trim(), kind, description);
    } catch (cause) {
      setError(cause instanceof DOMException && cause.name === "QuotaExceededError"
        ? "浏览器存储空间不足，作品尚未保存。请先导出并备份已有作品，再释放存储空间后重试。"
        : "创建失败，作品尚未保存。请重试，或检查浏览器是否允许本地存储。");
    }
  }
  return <Modal title="创建作品后可使用AI功能" onClose={onClose}>
    <form onSubmit={submit}>
      <label className="mb-1 block" htmlFor="book-title">作品名称 <span className="text-rose-500">*</span></label>
      <div className="relative"><input autoFocus id="book-title" required maxLength={30} placeholder="请输入作品名称" className="form-input pr-16" value={title} onChange={e => setTitle(e.target.value)} /><span className="input-count">{title.length} / 30</span></div>
      <div className="mb-2 mt-5">作品类型 <span className="text-xs text-[#9a8dde]">· 不同类型将启用对应的AI创作工具与提示词</span></div>
      <div className="grid grid-cols-2 gap-3" role="group" aria-label="作品类型">
        {(["novel", "script"] as const).map(type => <button type="button" key={type} aria-pressed={kind === type} onClick={() => setKind(type)} className={`book-kind ${kind === type ? "selected" : ""}`}>
          <span className={`rounded-lg p-2 text-xl ${type === "novel" ? "bg-indigo-100/60 text-indigo-400" : "bg-pink-100/60 text-fuchsia-300"}`}>{type === "novel" ? <BooksIcon /> : <ScriptIcon />}</span>
          <span className="text-left"><strong className="block text-base">{type === "novel" ? "小说" : "剧本"}</strong><small className="block text-[11px] text-gray-400">{type === "novel" ? "章纲·正文·续写" : "集纲·场景·对白"}</small></span>
          {kind === type && <CheckCircle2 className="absolute right-2 top-2 fill-indigo-400 text-white" size={16} />}
        </button>)}
      </div>
      <label className="mb-2 mt-9 block" htmlFor="book-description">作品简介（选填。不影响AI生成内容）</label>
      <div className="relative"><textarea id="book-description" maxLength={500} rows={3} className="form-input resize-none pb-6" value={description} onChange={e => setDescription(e.target.value)} placeholder="请输入作品简介" /><span className="absolute bottom-3 right-3 text-xs text-muted">{description.length} / 500</span></div>
      <details className="mt-6 text-xs text-muted"><summary className="flex w-fit list-none items-center gap-2">高级设置<ChevronDown size={14} /></summary><p className="mt-3 rounded-lg bg-background p-3">作品创建后可随时编辑名称、简介与正文。</p></details>
      {error && <p role="alert" className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      <div className="mt-2 flex justify-end"><button type="submit" disabled={!title.trim()} className="primary-button rounded-full">提交</button></div>
    </form>
  </Modal>;
}
