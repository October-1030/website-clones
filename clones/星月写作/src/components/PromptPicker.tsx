"use client";

import { useState } from "react";
import { useLocalState } from "@/lib/use-local-state";
import { promptSeeds, type PromptRecord } from "@/lib/prompts";

export function PromptPicker({ toolName, onApply }: { toolName: string; onApply: (content: string, title: string) => void }) {
  const [records, setRecords] = useLocalState<PromptRecord[]>("xingyue-prompts", promptSeeds);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("当前工具");
  const [selected, setSelected] = useState<string>("");
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [error, setError] = useState("");
  const visible = records.filter(item => (filter !== "当前工具" || item.type === toolName) && (filter !== "已收藏" || item.favorite) && (!query || `${item.title}${item.description}${item.content}`.toLowerCase().includes(query.toLowerCase())));
  const choice = records.find(item => item.id === selected);
  function apply(item: PromptRecord) {
    try { onApply(item.content, item.title); setOpen(false); setError(""); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "提示词应用失败"); }
  }
  function save() {
    if (!title.trim() || !content.trim()) { setError("请填写提示词名称和内容。"); return; }
    const item: PromptRecord = { id: crypto.randomUUID(), title: title.trim(), content: content.trim(), type: toolName, category: "我的", description: "个人提示词", uses: 0, favorite: false, owned: true, updatedAt: new Date().toISOString() };
    try { setRecords(current => [item, ...current]); setCreating(false); setSelected(item.id); setTitle(""); setContent(""); setError(""); setFilter("当前工具"); setQuery(""); }
    catch { setError("提示词保存失败，请检查浏览器存储空间。"); }
  }
  return <section aria-label={`${toolName}提示词选择`} className="space-y-3">
    <button type="button" className="subtle-button" aria-expanded={open} onClick={() => setOpen(!open)}>{open ? "收起提示词" : "更多提示词"}</button>
    {open && <div className="space-y-3 rounded-lg border border-border p-3">
      <p className="text-xs text-muted">选择已保存的个人提示词，或将已有方案粘贴保存。</p>
      <div className="flex flex-wrap gap-2"><input aria-label="搜索提示词" className="form-input flex-1" value={query} onChange={event => setQuery(event.target.value)} placeholder="搜索名称或内容" /><select aria-label="提示词范围" className="form-input w-auto" value={filter} onChange={event => setFilter(event.target.value)}>{["当前工具", "全部", "已收藏"].map(value => <option key={value}>{value}</option>)}</select><button type="button" className="subtle-button" onClick={() => setCreating(!creating)}>新建提示词</button></div>
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
      {creating && <div className="space-y-2"><label>提示词名称<input className="form-input" maxLength={60} value={title} onChange={event => setTitle(event.target.value)} /></label><label>提示词正文<textarea className="form-input min-h-32" maxLength={30000} value={content} onChange={event => setContent(event.target.value)} /></label><button type="button" className="primary-button" onClick={save}>保存提示词</button></div>}
      <div className="max-h-52 space-y-2 overflow-auto">{visible.map(item => <div key={item.id} className="flex items-center gap-2 rounded border border-border p-2"><div className="min-w-0 flex-1"><strong className="block truncate text-sm">{item.title}</strong><small>{item.type} · {item.content.length} 字符</small></div><button type="button" className="subtle-button" onClick={() => setSelected(item.id)}>详情</button><button type="button" className="subtle-button" aria-label={`${item.favorite ? "取消收藏" : "收藏"}${item.title}`} onClick={() => { try { setRecords(current => current.map(record => record.id === item.id ? { ...record, favorite: !record.favorite } : record)); } catch { setError("收藏保存失败"); } }}>{item.favorite ? "★" : "☆"}</button><button type="button" className="primary-button" onClick={() => apply(item)}>使用</button></div>)}{!visible.length && <p className="py-2 text-sm text-muted">暂无匹配方案，可切换全部或新建提示词。</p>}</div>
      {choice && <div className="space-y-2"><strong>{choice.title}</strong><p className="text-xs text-muted">{choice.description}</p><textarea aria-label="提示词详情" className="form-input min-h-32" readOnly value={choice.content} /><button type="button" className="primary-button" onClick={() => apply(choice)}>使用此提示词</button></div>}
    </div>}
  </section>;
}
