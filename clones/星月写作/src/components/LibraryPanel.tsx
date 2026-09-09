/* eslint-disable @next/next/no-img-element */
"use client";

import { useState } from "react";
import { ArrowLeft, BookOpen, FolderOpen, RotateCcw, Sparkles, Trash2 } from "lucide-react";
import { ArchiveIcon, ChecklistIcon, CompactIcon, FolderIcon, GridIcon, ImportIcon, LibraryIcon, ListIcon, PlusCircleIcon, SearchIcon, SmallPlusIcon, TrashIcon } from "./icons";
import { useLocalState } from "@/lib/use-local-state";
import type { Book, BookKind, BookStatus, Folder, LayoutMode } from "@/types/workspace";

interface LibraryPanelProps {
  books: Book[]; folders: Folder[]; onNew: (folderId?: string) => void; onImport: () => void; onFolder: () => void;
  onOpen: (id: string) => void; onStatus: (ids: string[], status: BookStatus) => void; onOpening: () => void;
  onBookAction: (id: string, action: "chapter" | "import" | "settings") => void;
}

export function LibraryPanel({ books, folders, onNew, onImport, onFolder, onOpen, onStatus, onOpening, onBookAction }: LibraryPanelProps) {
  const [tab, setTab] = useState<BookStatus>("active");
  const [filter, setFilter] = useState<BookKind | "all">("all");
  const [search, setSearch] = useState("");
  const [layout, setLayout] = useLocalState<LayoutMode>("xingyue-layout", "comfortable");
  const [batch, setBatch] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [folder, setFolder] = useState<string | null>(null);
  const visible = books.filter(book => book.status === tab && (filter === "all" || book.kind === filter) && book.title.toLowerCase().includes(search.toLowerCase()) && (!folder || book.folderId === folder));
  const tabs = [{ key: "active", text: "作品", Icon: LibraryIcon }, { key: "archived", text: "已归档", Icon: ArchiveIcon }, { key: "trashed", text: "回收站", Icon: TrashIcon }] as const;
  function updateSelected(status: BookStatus) { onStatus(selected, status); setSelected([]); setBatch(false); }
  return <section className="library-panel" aria-label="作品管理">
    <div className="library-tabs">
      <div className="flex h-full" role="tablist" aria-label="作品状态">{tabs.map(({ key, text, Icon }) => <button role="tab" aria-selected={tab === key} key={key} className={`library-tab ${tab === key ? "active" : ""}`} onClick={() => { setTab(key); setSelected([]); setBatch(false); }}><Icon className="text-base" />{text}</button>)}</div>
      <div className="book-filters" role="group" aria-label="作品分类">{([{ key: "all", text: "全部" }, { key: "novel", text: "📖 小说" }, { key: "script", text: "🎬 剧本" }] as const).map(item => <button key={item.key} aria-pressed={filter === item.key} onClick={() => setFilter(item.key)} className={filter === item.key ? "active" : ""}>{item.text}</button>)}</div>
    </div>
    <div className="library-toolbar">
      <div className="flex items-center gap-2"><button className="folder-button" onClick={onFolder}><FolderIcon className="text-lg" />新建文件夹</button><button className="subtle-button text-primary" onClick={onOpening}><Sparkles size={15} />黄金开篇</button></div>
      <div className="toolbar-tools">
        <div className="layout-toggle" role="group" aria-label="作品展示方式">{([{ key: "comfortable", label: "舒适平铺", Icon: GridIcon }, { key: "compact", label: "紧凑平铺", Icon: CompactIcon }, { key: "list", label: "列表展示", Icon: ListIcon }] as const).map(({ key, label, Icon }) => <button key={key} title={label} aria-label={label} aria-pressed={layout === key} onClick={() => setLayout(key)} className={layout === key ? "active" : ""}><Icon className="text-lg" /></button>)}</div>
        <label className="search-box"><SearchIcon /><input value={search} onChange={e => setSearch(e.target.value)} placeholder="搜索书籍..." aria-label="搜索书籍" /></label>
        <button className="subtle-button" onClick={() => { setBatch(!batch); setSelected([]); }}><ChecklistIcon className="text-lg" />{batch ? "取消管理" : "批量管理"}</button>
      </div>
    </div>
    {batch && <div className="flex flex-wrap items-center gap-3 border-b border-border/40 px-4 py-2 text-xs"><button onClick={() => setSelected(selected.length === visible.length ? [] : visible.map(book => book.id))}>全选 · 已选 {selected.length}</button>{tab !== "active" && <button disabled={!selected.length} className="subtle-button" onClick={() => updateSelected("active")}>恢复作品</button>}{tab === "active" && <button disabled={!selected.length} className="subtle-button" onClick={() => updateSelected("archived")}>归档</button>}{tab !== "trashed" && <button disabled={!selected.length} className="subtle-button text-red-500" onClick={() => updateSelected("trashed")}>移入回收站</button>}</div>}
    <div className="library-scroll">
      {folder && <button className="mb-3 flex items-center gap-2 text-primary" onClick={() => setFolder(null)}><ArrowLeft size={16} />全部作品 / {folders.find(item => item.id === folder)?.name}</button>}
      <div className={`books-grid ${layout}`}>
        {tab === "active" && !search && !folder && folders.map(item => <button className="folder-card" key={item.id} onClick={() => setFolder(item.id)}><FolderOpen size={42} className="text-amber-500" /><span>{item.name}</span></button>)}
        {tab === "active" && !search && <div className="create-card">
          <button className="create-card-main" aria-label="创建新作品" onClick={() => onNew(folder ?? undefined)}><PlusCircleIcon className="text-[80px]" /><span className="text-xl">新建作品</span></button>
          <div className="create-card-actions"><button onClick={() => onNew(folder ?? undefined)}><SmallPlusIcon className="text-base" />新建作品</button><button onClick={onImport}><ImportIcon className="text-base" />导入作品</button></div>
        </div>}
        {visible.map(book => <article key={book.id} className={`saved-book ${selected.includes(book.id) ? "selected" : ""}`}>
          {batch && <input type="checkbox" aria-label={`选择${book.title}`} checked={selected.includes(book.id)} onChange={() => setSelected(selected.includes(book.id) ? selected.filter(id => id !== book.id) : [...selected, book.id])} className="absolute right-3 top-3 h-4 w-4 accent-[var(--primary)]" />}
          <button className="book-content" onClick={() => onOpen(book.id)}>{book.cover ? <img src={book.cover} alt={`${book.title}封面`} className="h-40 w-full rounded object-cover" /> : <BookOpen size={32} className="text-primary" />}<h3 className="mt-2 truncate text-lg font-semibold">{book.title}</h3><p className="line-clamp-2 text-xs text-muted">{book.description || "让灵感在这里生长"}</p><span className="mt-2 block text-xs text-muted">{book.kind === "novel" ? "小说" : "剧本"} · {book.content.replace(/\s/g, "").length} 字</span></button>
          {tab === "active" && <div className="saved-book-actions flex-wrap"><button onClick={() => onBookAction(book.id,"chapter")}>新建章节</button><button onClick={() => onBookAction(book.id,"import")}>导入章节</button><button onClick={() => onBookAction(book.id,"settings")}>作品管理</button></div>}
          <div className="saved-book-actions">{tab === "active" ? <button onClick={() => onStatus([book.id], "archived")}><ArchiveIcon />归档</button> : <button onClick={() => onStatus([book.id], "active")}><RotateCcw size={14} />恢复</button>}{tab !== "trashed" && <button onClick={() => onStatus([book.id], "trashed")}><Trash2 size={14} />删除</button>}</div>
        </article>)}
      </div>
      {!visible.length && (tab !== "active" || search) && <div className="empty-state"><BookOpen size={44} strokeWidth={1} /><p>{search ? "没有找到相关作品" : tab === "archived" ? "暂无已归档作品" : "回收站为空"}</p>{search && <button className="text-primary" onClick={() => setSearch("")}>清空搜索</button>}</div>}
    </div>
  </section>;
}
