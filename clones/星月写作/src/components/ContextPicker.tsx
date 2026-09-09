"use client";

import { useState } from "react";
import { buildLongNovelContext } from "@/lib/long-novel-context";
import { useLocalState } from "@/lib/use-local-state";
import type { Book } from "@/types/workspace";
import { emptyResources, RESOURCE_STORAGE_KEY, resourceTypeLabel } from "./resource-data";

interface Knowledge { id: string; title: string; content: string }
interface Selection { id: string; label: string; content: string }
interface Combination { id: string; name: string; ids: string[] }
const emptyKnowledge: Knowledge[] = [];
const emptyCombinations: Combination[] = [];

export function ContextPicker({ books, onApply, initialBookId = "" }: { books: Book[]; onApply: (text: string) => void; initialBookId?: string }) {
  const [bookId, setBookId] = useState(initialBookId);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [name, setName] = useState("");
  const [message, setMessage] = useState("");
  const [resources] = useLocalState(RESOURCE_STORAGE_KEY, emptyResources);
  const [knowledge] = useLocalState("xingyue-knowledge-cards", emptyKnowledge);
  const [combinations, setCombinations] = useLocalState("xingyue-context-combinations", emptyCombinations);
  const entries: Selection[] = [
    ...books.filter(book => book.status === "active").flatMap(book => [
      { id: `book:${book.id}`, label: `${book.title} · 作品设定`, content: book.description },
      ...(book.chapters?.length ? book.chapters.map(chapter => ({ id: `chapter:${book.id}:${chapter.id}`, label: `${book.title} · ${chapter.title}`, content: chapter.content })) : [{ id: `body:${book.id}`, label: `${book.title} · 正文`, content: book.content }]),
    ]),
    ...resources.map(item => ({ id: `resource:${item.id}`, label: `${resourceTypeLabel(item.type)} · ${item.name}`, content: [item.content, item.personality, item.background, item.appearance].filter(Boolean).join("\n") })),
    ...knowledge.map(item => ({ id: `knowledge:${item.id}`, label: `知识卡 · ${item.title}`, content: item.content })),
  ];
  const visible = entries.filter(item => {
    const resource = item.id.startsWith("resource:") ? resources.find(record => `resource:${record.id}` === item.id) : undefined;
    const matchesBook = !bookId || item.id.startsWith(`book:${bookId}`) || item.id.startsWith(`chapter:${bookId}:`) || item.id === `body:${bookId}` || item.id.startsWith("knowledge:") || (resource && (!resource.bookId || resource.bookId === bookId));
    return matchesBook && `${item.label}\n${item.content}`.toLowerCase().includes(query.toLowerCase());
  });
  const chosen = entries.filter(item => selected.includes(item.id));
  const seen = new Set<string>();
  const text = chosen.filter(item => { const content = item.content.trim(); if (!content || seen.has(content)) return false; seen.add(content); return true; }).map(item => `【${item.label}】\n${item.content}`).join("\n\n");
  const missing = selected.filter(id => !entries.some(item => item.id === id)).length;
  const applyLongContext = () => {
    const book = books.find((item) => item.id === bookId);
    if (!book) { setMessage("请先选择一部作品，再整理长篇上下文。"); return; }
    const result = buildLongNovelContext(book, resources, knowledge, 6000);
    if (!result.text) { setMessage("这部作品还没有可整理的设定、概要或正文。"); return; }
    onApply(result.text);
    setMessage(result.compressed
      ? `已整理${result.includedChapters}项章节信息；资料较长，已在正文中明确标出压缩。`
      : `已整理${result.includedChapters}项章节信息，并写入参考资料。`);
  };
  return <details className="rounded border border-current/15 p-3">
    <summary className="cursor-pointer">关联知识库 · 已选 {chosen.length} 项 · {text.length} 字符</summary>
    <div className="mt-3 grid gap-3">
      <label>关联作品<select aria-label="筛选关联作品" className="form-input" value={bookId} onChange={event => setBookId(event.target.value)}><option value="">全部作品与知识卡</option>{books.filter(book => book.status === "active").map(book => <option key={book.id} value={book.id}>{book.title}</option>)}</select></label>
      <input className="form-input" aria-label="搜索关联资料" placeholder="搜索章节、备忘录、角色、词条、知识卡及正文" value={query} onChange={event => setQuery(event.target.value)} />
      <div className="grid max-h-56 gap-2 overflow-y-auto">{visible.map(item => <label key={item.id} className="flex items-start gap-2"><input type="checkbox" checked={selected.includes(item.id)} onChange={event => setSelected(current => event.target.checked ? [...new Set([...current, item.id])] : current.filter(id => id !== item.id))} /><span>{item.label}（{item.content.length} 字符）</span></label>)}{!visible.length && <p>没有匹配的资料。可先在作品或知识卡中添加。</p>}</div>
      <label>常用组合<select className="form-input" aria-label="加载常用组合" defaultValue="" onChange={event => { const item = combinations.find(record => record.id === event.target.value); if (item) setSelected(item.ids); }}><option value="">选择组合</option>{combinations.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
      <div className="flex flex-wrap gap-2"><input aria-label="组合名称" placeholder="组合名称" className="form-input" value={name} onChange={event => setName(event.target.value)} /><button type="button" className="subtle-button" disabled={!name.trim() || !selected.length} onClick={() => { try { setCombinations([...combinations, { id: crypto.randomUUID(), name: name.trim(), ids: [...new Set(selected)] }]); setName(""); setMessage("组合已保存"); } catch { setMessage("组合保存失败，请检查存储空间"); } }}>保存组合</button><button type="button" className="subtle-button" onClick={() => setSelected([])}>清空选择</button><button type="button" className="subtle-button" disabled={!bookId} onClick={applyLongContext}>智能整理长篇上下文</button></div>
      {missing > 0 && <p role="status">组合中有 {missing} 项资料已不存在，请重新选择。</p>}
      <p>相同正文自动去重。手动选择不会截断；“智能整理”会优先保留作品设定、人物资料、全书概要和最近3章结尾，若压缩会在正文末尾明确标注。</p>
      <button type="button" className="primary-button" disabled={!text || text.length > 6000} onClick={() => { onApply(text); setMessage("所选资料已写入参考资料，可继续编辑后生成。"); }}>应用到参考资料（替换当前内容）</button>
      {message && <p role="status">{message}</p>}
    </div>
  </details>;
}
