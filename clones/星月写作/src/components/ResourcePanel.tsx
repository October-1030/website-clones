"use client";

import {
  Archive,
  Bold,
  Bookmark,
  BookOpenText,
  Bot,
  Check,
  ChevronDown,
  ChevronLeft,
  Clock3,
  Download,
  Eye,
  FileJson,
  FileText,
  Folder,
  FolderInput,
  FolderPlus,
  Heading2,
  ImagePlus,
  Import,
  Italic,
  List,
  ListChecks,
  MoreHorizontal,
  Pin,
  Plus,
  Quote,
  RefreshCw,
  ScanSearch,
  Search,
  Sparkles,
  Trash2,
  Upload,
  UserRound,
  UsersRound,
  X,
} from "lucide-react";
import Image from "next/image";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type ReactNode,
} from "react";
import { useLocalState } from "@/lib/use-local-state";
import {
  RESOURCE_FOLDER_STORAGE_KEY,
  RESOURCE_STORAGE_KEY,
  createResource,
  emptyResourceFolders,
  emptyResources,
  formatResourceTime,
  resourceContext,
  resourceTypeLabel,
  resourceTypeTitle,
  safeFileName,
  type ResourceFolder,
  type ResourceRecord,
  type ResourceType,
} from "./resource-data";
import "./resource-panel.css";

export type ResourceToolHandler = (
  name: string,
  context?: string,
  onResult?: (text: string) => void,
) => void;

interface ResourcePanelProps {
  bookId: string;
  onTool: ResourceToolHandler;
}

interface ResourceManagerProps extends ResourcePanelProps {
  initialType?: ResourceType;
  initialSelectedId?: string;
  createOnOpen?: boolean;
  onClose: () => void;
}

const panelTypes: ResourceType[] = ["character", "term", "memo"];

function downloadText(name: string, content: string, type = "application/json;charset=utf-8") {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
}

function accessibleResources(resources: ResourceRecord[], bookId: string, type: ResourceType) {
  return resources.filter(resource => resource.type === type && (!resource.bookId || resource.bookId === bookId));
}

function makeContent(record: ResourceRecord) {
  if (record.type !== "character") return record.content;
  return [record.personality, record.background, record.appearance].filter(Boolean).join("\n\n");
}

function ResourceEmpty({ type, onNew, onManage }: { type: ResourceType; onNew: () => void; onManage: () => void }) {
  const label = resourceTypeLabel(type);
  return <div className="resource-empty">
    {type === "character" ? <UsersRound size={32} /> : type === "term" ? <BookOpenText size={32} /> : <FileText size={32} />}
    <p>这本作品还没有{label}卡</p>
    <div>
      <button className="resource-primary" onClick={onNew}><Plus size={14} />新建{label}</button>
      <button className="resource-button" onClick={onManage}>打开完整管理</button>
    </div>
  </div>;
}

export function ResourcePanel({ bookId, onTool }: ResourcePanelProps) {
  const [resources, setResources] = useLocalState<ResourceRecord[]>(RESOURCE_STORAGE_KEY, emptyResources);
  const [folders, setFolders] = useLocalState<ResourceFolder[]>(RESOURCE_FOLDER_STORAGE_KEY, emptyResourceFolders);
  const [activeType, setActiveType] = useState<ResourceType>("character");
  const [search, setSearch] = useState("");
  const [folderId, setFolderId] = useState("");
  const [manager, setManager] = useState<{ type: ResourceType; create: boolean; selectedId?: string } | null>(null);
  const [selectedMemo, setSelectedMemo] = useState<string | null>(null);
  const [batch, setBatch] = useState(false);
  const [checked, setChecked] = useState<string[]>([]);
  const [notice, setNotice] = useState("");
  const importRef = useRef<HTMLInputElement>(null);

  const matching = useMemo(() => accessibleResources(resources, bookId, activeType)
    .filter(item => !search.trim() || item.name.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()))
    .filter(item => !folderId || item.folderId === folderId)
    .sort((a, b) => Number(Boolean(b.pinned)) - Number(Boolean(a.pinned)) || b.updatedAt.localeCompare(a.updatedAt)),
  [activeType, bookId, folderId, resources, search]);
  const typeFolders = folders.filter(folder => folder.type === activeType && (!folder.bookId || folder.bookId === bookId));
  const memo = resources.find(item => item.id === selectedMemo && item.type === "memo");

  function updateResource(id: string, next: Partial<ResourceRecord>, checkpoint = false) {
    setResources(current => current.map(item => {
      if (item.id !== id) return item;
      const history = checkpoint && item.content !== (next.content ?? item.content)
        ? [...(item.history ?? []), { id: crypto.randomUUID(), content: item.content, createdAt: item.updatedAt }].slice(-12)
        : item.history;
      return { ...item, ...next, history, updatedAt: new Date().toISOString() };
    }));
  }

  function createMemo() {
    const item = createResource("memo", bookId);
    setResources(current => [...current, item]);
    setSelectedMemo(item.id);
  }

  function removeItems(ids: string[]) {
    if (!ids.length) return;
    const names = resources.filter(item => ids.includes(item.id)).map(item => item.name || "未命名资料").join("、");
    if (!window.confirm(`确定删除“${names}”吗？此操作只会删除所选资料。`)) return;
    setResources(current => current.filter(item => !ids.includes(item.id)));
    setChecked([]);
    if (selectedMemo && ids.includes(selectedMemo)) setSelectedMemo(null);
    setNotice("已删除所选资料");
  }

  function createFolder() {
    const name = window.prompt("请输入文件夹名称");
    if (!name?.trim()) return;
    setFolders(current => [...current, { id: crypto.randomUUID(), name: name.trim().slice(0, 30), type: activeType, bookId }]);
  }

  async function importMemo(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    try {
      const text = await file.text();
      if (file.name.toLocaleLowerCase().endsWith(".json")) {
        const parsed: unknown = JSON.parse(text);
        const source = Array.isArray(parsed) ? parsed : [parsed];
        const items = source.map(value => normalizeImportedResource(value, activeType, bookId));
        setResources(current => [...current, ...items]);
        setNotice(`已导入 ${items.length} 条资料`);
      } else {
        const item = createResource(activeType, bookId);
        item.name = file.name.replace(/\.[^.]+$/, "").slice(0, activeType === "term" ? 15 : 50) || "导入资料";
        item.content = text;
        if (activeType === "character") item.background = text;
        setResources(current => [...current, item]);
        setNotice("导入成功");
      }
    } catch (error) {
      setNotice(error instanceof Error ? `导入失败：${error.message}` : "导入失败：文件格式不正确");
    }
  }

  function exportChecked() {
    const items = resources.filter(item => checked.includes(item.id));
    if (!items.length) return;
    downloadText("星月资料.json", JSON.stringify(items, null, 2));
  }

  return <aside className="resource-panel" aria-label="常驻资料栏">
    <header className="resource-panel-header"><BookOpenText size={18} /><strong>资料栏</strong></header>
    <div className="resource-tabs" role="tablist" aria-label="资料类型">
      {panelTypes.map(type => <button key={type} role="tab" aria-selected={activeType === type} className={activeType === type ? "active" : ""} onClick={() => { setActiveType(type); setSelectedMemo(null); setSearch(""); setFolderId(""); setBatch(false); setChecked([]); }}>
        {type === "character" ? <UserRound size={14} /> : type === "term" ? <BookOpenText size={14} /> : <FileText size={14} />}{resourceTypeLabel(type)}
      </button>)}
    </div>
    {memo ? <MemoEditor
      compact
      record={memo}
      folders={typeFolders}
      onBack={() => setSelectedMemo(null)}
      onChange={(next, checkpoint) => updateResource(memo.id, next, checkpoint)}
      onDelete={() => removeItems([memo.id])}
      onTool={onTool}
    /> : <div className="resource-panel-content" role="tabpanel" aria-label={resourceTypeLabel(activeType)}>
      <div className={`resource-toolbar ${activeType === "memo" ? "memo-toolbar" : ""}`}>
        {activeType === "memo" && <button className="resource-button amber" onClick={createFolder}><FolderPlus size={14} />新文件夹</button>}
        <button className="resource-button blue" onClick={() => activeType === "memo" ? createMemo() : setManager({ type: activeType, create: true })}><Plus size={14} />{activeType === "memo" ? "新建" : "新建"}</button>
        {activeType === "memo" && <button className={`resource-button ${batch ? "active" : ""}`} onClick={() => { setBatch(!batch); setChecked([]); }}><ListChecks size={14} />批量</button>}
        <button aria-label={`刷新${resourceTypeLabel(activeType)}卡`} className="resource-icon-button" onClick={() => { setResources(current => [...current]); setNotice("已刷新"); }}><RefreshCw size={15} /></button>
      </div>
      <label className="resource-search"><Search size={14} /><input aria-label={`搜索${resourceTypeLabel(activeType)}名称`} value={search} onChange={event => setSearch(event.target.value)} placeholder={activeType === "memo" ? "搜索备忘录..." : `搜索${resourceTypeLabel(activeType)}名称`} /></label>
      {activeType !== "memo" && <label className="resource-folder-filter"><Folder size={14} /><select aria-label="筛选文件夹" value={folderId} onChange={event => setFolderId(event.target.value)}><option value="">全部文件夹</option>{typeFolders.map(folder => <option key={folder.id} value={folder.id}>{folder.name}</option>)}</select><ChevronDown size={13} /></label>}
      {activeType === "memo" && <div className="memo-groups">
        <div className="memo-group-heading"><span>⌄ 全局备忘录 <b>{matching.filter(item => !item.bookId).length}</b></span><small>所有作品可用</small></div>
        <div className="memo-group-heading"><span>⌄ 本书备忘录 <b>{matching.filter(item => item.bookId === bookId).length}</b></span><small>仅当前作品可见</small></div>
        <div className="memo-folder-heading"><span>⌄ <Folder size={14} /> 未分类</span><small>{matching.filter(item => !item.folderId).length} 条</small></div>
      </div>}
      <div className="resource-compact-list">
        {matching.map(item => <button key={item.id} className="resource-compact-card" onClick={() => {
          if (batch) setChecked(current => current.includes(item.id) ? current.filter(id => id !== item.id) : [...current, item.id]);
          else if (activeType === "memo") setSelectedMemo(item.id);
          else setManager({ type: activeType, create: false, selectedId: item.id });
        }}>
          {batch && <span className={`resource-check ${checked.includes(item.id) ? "checked" : ""}`}>{checked.includes(item.id) && <Check size={11} />}</span>}
          {item.image ? <Image src={item.image} alt="" width={40} height={40} unoptimized /> : <span className="resource-card-icon">{activeType === "character" ? (item.name || "角").slice(0, 1) : activeType === "term" ? "词" : "记"}</span>}
          <span className="resource-card-copy"><strong>{item.name || `未命名${resourceTypeLabel(activeType)}`}</strong><small>{formatResourceTime(item.updatedAt)}{item.pinned ? " · 已置顶" : ""}</small></span>
          {item.bookmarked && <Bookmark size={13} className="resource-marked" />}
        </button>)}
      </div>
      {!matching.length && <ResourceEmpty type={activeType} onNew={() => activeType === "memo" ? createMemo() : setManager({ type: activeType, create: true })} onManage={() => setManager({ type: activeType, create: false })} />}
      {batch && <div className="resource-batch-bar"><span>已选 {checked.length} 项</span><button onClick={exportChecked}><Download size={13} />导出</button><button className="danger" onClick={() => removeItems(checked)}><Trash2 size={13} />删除</button></div>}
      {!!matching.length && <button className="resource-manage-link" onClick={() => setManager({ type: activeType, create: false })}>打开完整管理 <MoreHorizontal size={15} /></button>}
      {notice && <p role="status" className="resource-notice">{notice}</p>}
    </div>}
    <input ref={importRef} className="resource-hidden-input" type="file" accept=".json,.txt,.md,application/json,text/plain,text/markdown" onChange={importMemo} />
    {manager && <ResourceManager bookId={bookId} onTool={onTool} initialType={manager.type} initialSelectedId={manager.selectedId} createOnOpen={manager.create} onClose={() => setManager(null)} />}
  </aside>;
}

function normalizeImportedResource(value: unknown, expectedType: ResourceType, bookId: string): ResourceRecord {
  if (!value || typeof value !== "object") throw new Error("JSON 中存在无效资料");
  const source = value as Record<string, unknown>;
  const type = typeof source.type === "string" && panelTypes.includes(source.type as ResourceType) ? source.type as ResourceType : expectedType;
  if (type !== expectedType) throw new Error(`请选择${resourceTypeLabel(expectedType)}资料文件`);
  const name = typeof source.name === "string" ? source.name.trim() : "";
  const content = typeof source.content === "string" ? source.content : "";
  if (!name && type !== "memo") throw new Error("资料名称不能为空");
  return {
    id: crypto.randomUUID(),
    type,
    name: name || "导入备忘录",
    content,
    bookId,
    updatedAt: new Date().toISOString(),
    gender: typeof source.gender === "string" ? source.gender : type === "character" ? "未知" : undefined,
    personality: typeof source.personality === "string" ? source.personality : undefined,
    background: typeof source.background === "string" ? source.background : undefined,
    appearance: typeof source.appearance === "string" ? source.appearance : undefined,
    image: typeof source.image === "string" && source.image.startsWith("data:image/") ? source.image : undefined,
  };
}

export function ResourceManager({ bookId, onTool, onClose, initialType = "character", initialSelectedId, createOnOpen = false }: ResourceManagerProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const importRef = useRef<HTMLInputElement>(null);
  const [resources, setResources] = useLocalState<ResourceRecord[]>(RESOURCE_STORAGE_KEY, emptyResources);
  const [folders, setFolders] = useLocalState<ResourceFolder[]>(RESOURCE_FOLDER_STORAGE_KEY, emptyResourceFolders);
  const [type, setType] = useState<ResourceType>(initialType);
  const initialSelected = resources.find(item => item.id === initialSelectedId) ?? null;
  const [selectedId, setSelectedId] = useState<string | null>(initialSelectedId ?? null);
  const [draft, setDraft] = useState<ResourceRecord | null>(initialSelected ? { ...initialSelected } : null);
  const [folderId, setFolderId] = useState("");
  const [search, setSearch] = useState("");
  const [batch, setBatch] = useState(false);
  const [checked, setChecked] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [mobileColumn, setMobileColumn] = useState<"folders" | "list" | "detail">(initialSelectedId ? "detail" : "list");
  const createdOnOpen = useRef(false);

  useEffect(() => {
    const dialog = dialogRef.current;
    dialog?.showModal();
    return () => dialog?.close();
  }, []);

  const visible = useMemo(() => accessibleResources(resources, bookId, type)
    .filter(item => !folderId || item.folderId === folderId)
    .filter(item => !search.trim() || item.name.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()))
    .sort((a, b) => Number(Boolean(b.pinned)) - Number(Boolean(a.pinned)) || b.updatedAt.localeCompare(a.updatedAt)),
  [bookId, folderId, resources, search, type]);
  const typeFolders = folders.filter(folder => folder.type === type && (!folder.bookId || folder.bookId === bookId));
  const selected = resources.find(item => item.id === selectedId) ?? null;

  function newItem() {
    const item = createResource(type, bookId);
    setResources(current => [...current, item]);
    setSelectedId(item.id);
    setDraft(item);
    setMobileColumn("detail");
    setError("");
  }

  useEffect(() => {
    if (!createOnOpen || createdOnOpen.current) return;
    createdOnOpen.current = true;
    const timer = window.setTimeout(() => {
      const item = createResource(initialType, bookId);
      setResources(current => [...current, item]);
      setSelectedId(item.id);
      setDraft(item);
      setMobileColumn("detail");
    }, 0);
    return () => window.clearTimeout(timer);
  }, [bookId, createOnOpen, initialType, setResources]);

  function switchType(next: ResourceType) {
    setType(next);
    setFolderId("");
    setSearch("");
    setSelectedId(null);
    setDraft(null);
    setBatch(false);
    setChecked([]);
    setMobileColumn("list");
    setError("");
  }

  function selectItem(id: string) {
    if (batch) {
      setChecked(current => current.includes(id) ? current.filter(item => item !== id) : [...current, id]);
      return;
    }
    setSelectedId(id);
    const item = resources.find(resource => resource.id === id);
    setDraft(item ? { ...item } : null);
    setMobileColumn("detail");
    setError("");
  }

  function saveDraft() {
    if (!draft) return;
    const name = draft.name.trim();
    if (!name) { setError(`${resourceTypeLabel(type)}名称不能为空`); return; }
    if (type === "term" && !draft.content.trim()) { setError("词条释义不能为空"); return; }
    if (type === "character" && !draft.personality?.trim()) { setError("角色性格不能为空"); return; }
    if (type === "character" && !draft.background?.trim()) { setError("角色设定与背景不能为空"); return; }
    const saved = { ...draft, name, content: makeContent(draft), updatedAt: new Date().toISOString() };
    setResources(current => current.map(item => item.id === saved.id ? saved : item));
    setDraft(saved);
    setError(`${resourceTypeLabel(type)}已保存`);
  }

  function updateRecord(id: string, next: Partial<ResourceRecord>, checkpoint = false) {
    setResources(current => current.map(item => {
      if (item.id !== id) return item;
      const history = checkpoint && next.content !== undefined && item.content !== next.content
        ? [...(item.history ?? []), { id: crypto.randomUUID(), content: item.content, createdAt: item.updatedAt }].slice(-12)
        : item.history;
      return { ...item, ...next, history, updatedAt: new Date().toISOString() };
    }));
  }

  function deleteItems(ids: string[]) {
    if (!ids.length) return;
    const targets = resources.filter(item => ids.includes(item.id));
    if (!window.confirm(`确定删除“${targets.map(item => item.name || "未命名资料").join("、")}”吗？`)) return;
    setResources(current => current.filter(item => !ids.includes(item.id)));
    if (selectedId && ids.includes(selectedId)) { setSelectedId(null); setDraft(null); setMobileColumn("list"); }
    setChecked([]);
    setError(`已删除 ${targets.length} 条资料`);
  }

  function exportItems(items: ResourceRecord[]) {
    if (!items.length) return;
    downloadText(`${safeFileName(resourceTypeTitle(type))}.json`, JSON.stringify(items, null, 2));
  }

  function addFolder() {
    const name = window.prompt("请输入文件夹名称");
    if (!name?.trim()) return;
    setFolders(current => [...current, { id: crypto.randomUUID(), name: name.trim().slice(0, 30), type, bookId }]);
  }

  function renameFolder(folder: ResourceFolder) {
    const name = window.prompt("重命名文件夹", folder.name);
    if (!name?.trim() || name.trim() === folder.name) return;
    setFolders(current => current.map(item => item.id === folder.id ? { ...item, name: name.trim().slice(0, 30) } : item));
  }

  function deleteFolder(folder: ResourceFolder) {
    if (!window.confirm(`删除文件夹“${folder.name}”吗？其中的资料会移到未归类。`)) return;
    setFolders(current => current.filter(item => item.id !== folder.id));
    setResources(current => current.map(item => item.folderId === folder.id ? { ...item, folderId: undefined } : item));
    if (folderId === folder.id) setFolderId("");
  }

  async function importFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) { setError("导入失败：文件不能超过 10MB"); return; }
    try {
      const text = await file.text();
      let items: ResourceRecord[];
      if (file.name.toLocaleLowerCase().endsWith(".json")) {
        const parsed: unknown = JSON.parse(text);
        items = (Array.isArray(parsed) ? parsed : [parsed]).map(value => normalizeImportedResource(value, type, bookId));
      } else {
        const item = createResource(type, bookId);
        item.name = file.name.replace(/\.[^.]+$/, "").slice(0, type === "term" ? 15 : 50) || "导入资料";
        item.content = text;
        if (type === "character") item.background = text;
        items = [item];
      }
      setResources(current => [...current, ...items]);
      setError(`成功导入 ${items.length} 条${resourceTypeLabel(type)}`);
      if (items[0]) { setSelectedId(items[0].id); setDraft(items[0]); }
    } catch (reason) {
      setError(reason instanceof Error ? `导入失败：${reason.message}` : "导入失败：文件内容不正确");
    }
  }

  function moveChecked(event: ChangeEvent<HTMLSelectElement>) {
    const target = event.target.value === "__unfiled" ? undefined : event.target.value || undefined;
    setResources(current => current.map(item => checked.includes(item.id) ? { ...item, folderId: target, updatedAt: new Date().toISOString() } : item));
    setError(`已移动 ${checked.length} 条资料`);
    setChecked([]);
    event.target.value = "";
  }

  function delegate(name: string, field: "background" | "appearance" | "content" = "content") {
    if (!draft) {
      onTool(name, `为当前作品生成${resourceTypeLabel(type)}资料`);
      return;
    }
    onTool(name, resourceContext(draft), text => {
      const next = name === "AI生成角色图片"
        ? { ...draft, image: text, updatedAt: new Date().toISOString() }
        : { ...draft, [field]: text, content: field === "content" ? text : draft.content, updatedAt: new Date().toISOString() };
      setDraft(next);
      setResources(current => current.map(item => item.id === draft.id ? next : item));
    });
  }

  return <dialog ref={dialogRef} className="resource-manager" aria-label={resourceTypeTitle(type)} onCancel={onClose} onClick={event => { if (event.target === event.currentTarget) onClose(); }}>
    <header className="resource-manager-header">
      <div className="resource-manager-title"><span className="resource-title-icon"><FileJson size={17} /></span><strong>{resourceTypeTitle(type)}</strong></div>
      <div className="resource-manager-switcher" role="tablist" aria-label="资料管理类型">{panelTypes.map(item => <button role="tab" aria-selected={type === item} className={type === item ? "active" : ""} key={item} onClick={() => switchType(item)}>{resourceTypeLabel(item)}</button>)}</div>
      <div className="resource-manager-header-actions"><button onClick={onClose}><Archive size={15} />固定到资料栏</button><a href="https://www.bilibili.com/" target="_blank" rel="noreferrer">教程</a><button aria-label="关闭" onClick={onClose}><X size={19} /></button></div>
    </header>
    <div className={`resource-manager-grid mobile-${mobileColumn}`}>
      <aside className="resource-folder-column">
        <div className="resource-column-buttons"><button className="resource-primary" onClick={newItem}><Plus size={15} />新建</button><button className="resource-button" onClick={() => importRef.current?.click()}><Import size={15} />导入</button></div>
        <h3>{resourceTypeLabel(type)}文件夹</h3>
        <button className={`resource-folder-row ${folderId === "" ? "active" : ""}`} onClick={() => { setFolderId(""); setMobileColumn("list"); }}><Folder size={15} />全部{resourceTypeLabel(type)}<b>{accessibleResources(resources, bookId, type).length}</b></button>
        <div className="resource-folder-tree">{typeFolders.map(folder => <div className="resource-folder-row-wrap" key={folder.id}><button className={`resource-folder-row ${folderId === folder.id ? "active" : ""}`} onClick={() => { setFolderId(folder.id); setMobileColumn("list"); }}><Folder size={15} />{folder.name}<b>{resources.filter(item => item.folderId === folder.id).length}</b></button><button className="resource-folder-more" aria-label={`管理文件夹${folder.name}`} onClick={() => renameFolder(folder)}><MoreHorizontal size={14} /></button><button className="resource-folder-delete" aria-label={`删除文件夹${folder.name}`} onClick={() => deleteFolder(folder)}><Trash2 size={12} /></button></div>)}</div>
        <button className="resource-new-folder" onClick={addFolder}><FolderPlus size={14} />新建文件夹</button>
      </aside>
      <section className="resource-list-column">
        <button className="resource-mobile-folder-toggle" onClick={() => setMobileColumn("folders")}><Folder size={14} />文件夹</button>
        <label className="resource-search manager-search"><Search size={15} /><input aria-label="搜索名称" placeholder="搜索名称..." value={search} onChange={event => setSearch(event.target.value)} /></label>
        <div className="resource-list-tools">
          <button className="resource-button ai" onClick={() => delegate(`AI生成${resourceTypeLabel(type)}`, type === "character" ? "background" : "content")}><Sparkles size={14} />AI生成</button>
          <button className="resource-button blue-line" onClick={() => delegate(`智能识别${resourceTypeLabel(type)}`, type === "character" ? "background" : "content")}><ScanSearch size={14} />智能识别</button>
          <button className={`resource-button ${batch ? "active" : ""}`} onClick={() => { setBatch(!batch); setChecked([]); }}><ListChecks size={14} />批量</button>
        </div>
        {batch && <div className="manager-batch-bar"><span>已选 {checked.length} 项</span><select aria-label="批量移动" defaultValue="" onChange={moveChecked}><option value="">移动到…</option><option value="__unfiled">未归类</option>{typeFolders.map(folder => <option key={folder.id} value={folder.id}>{folder.name}</option>)}</select><button onClick={() => exportItems(resources.filter(item => checked.includes(item.id)))}><Download size={13} /></button><button className="danger" onClick={() => deleteItems(checked)}><Trash2 size={13} /></button></div>}
        <div className="resource-manager-list">{visible.map(item => <button key={item.id} className={`resource-manager-item ${selectedId === item.id ? "active" : ""}`} onClick={() => selectItem(item.id)}>
          {batch && <span className={`resource-check ${checked.includes(item.id) ? "checked" : ""}`}>{checked.includes(item.id) && <Check size={11} />}</span>}
          {item.image ? <Image src={item.image} alt="" width={40} height={40} unoptimized /> : <span className="resource-card-icon">{item.name.slice(0, 1) || (type === "memo" ? "记" : "未")}</span>}
          <span><strong>{item.name || `未命名${resourceTypeLabel(type)}`}</strong><small>{formatResourceTime(item.updatedAt)}</small></span>{item.pinned && <Pin size={12} />}
        </button>)}</div>
        {!visible.length && <div className="manager-list-empty"><Search size={25} /><span>暂无匹配资料</span><button onClick={newItem}>新建{resourceTypeLabel(type)}</button></div>}
      </section>
      <section className="resource-detail-column">
        <div className="resource-detail-heading"><button className="resource-mobile-back" aria-label="返回列表" onClick={() => setMobileColumn("list")}><ChevronLeft size={18} /></button><strong>{type === "character" ? "角色详情" : type === "term" ? "词条详情" : "备忘录"}</strong>{selected && <code>ID: {selected.id.slice(0, 12)}</code>}<button className="resource-close-detail" onClick={() => { setSelectedId(null); setDraft(null); setMobileColumn("list"); }}><ChevronLeft size={14} />关闭详情</button></div>
        {draft ? type === "memo" ? <MemoEditor
          record={selected ?? draft}
          folders={typeFolders}
          onBack={() => setMobileColumn("list")}
          onChange={(next, checkpoint) => updateRecord(draft.id, next, checkpoint)}
          onDelete={() => deleteItems([draft.id])}
          onTool={onTool}
        /> : <ResourceForm
          record={draft}
          folders={typeFolders}
          error={error}
          onChange={setDraft}
          onSave={saveDraft}
          onDelete={() => deleteItems([draft.id])}
          onExport={() => exportItems([draft])}
          onTool={delegate}
        /> : <div className="resource-detail-empty"><FileText size={42} /><strong>选择一条{resourceTypeLabel(type)}</strong><span>查看和编辑完整资料</span><button className="resource-primary" onClick={newItem}><Plus size={14} />新建{resourceTypeLabel(type)}</button></div>}
      </section>
    </div>
    {error && <div className={`resource-manager-status ${error.includes("失败") || error.includes("不能为空") ? "error" : ""}`} role="status">{error}</div>}
    <input ref={importRef} className="resource-hidden-input" type="file" accept=".json,.txt,.md,application/json,text/plain,text/markdown" onChange={importFile} />
  </dialog>;
}

function ResourceForm({ record, folders, error, onChange, onSave, onDelete, onExport, onTool }: {
  record: ResourceRecord;
  folders: ResourceFolder[];
  error: string;
  onChange: (record: ResourceRecord) => void;
  onSave: () => void;
  onDelete: () => void;
  onExport: () => void;
  onTool: (name: string, field?: "background" | "appearance" | "content") => void;
}) {
  const imageRef = useRef<HTMLInputElement>(null);
  const [imageError, setImageError] = useState("");

  function set<K extends keyof ResourceRecord>(key: K, value: ResourceRecord[K]) {
    onChange({ ...record, [key]: value });
  }

  function uploadImage(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!/image\/(jpeg|png)/.test(file.type)) { setImageError("请选择 JPG 或 PNG 图片"); return; }
    if (file.size > 10 * 1024 * 1024) { setImageError("图片大小不能超过 10MB"); return; }
    const reader = new FileReader();
    reader.onload = () => { if (typeof reader.result === "string") { set("image", reader.result); setImageError(""); } };
    reader.onerror = () => setImageError("图片读取失败，请重试");
    reader.readAsDataURL(file);
  }

  return <div className="resource-form-scroll">
    <label className="resource-field"><span>所属文件夹</span><select value={record.folderId ?? ""} onChange={event => set("folderId", event.target.value || undefined)}><option value="">未归入文件夹</option>{folders.map(folder => <option key={folder.id} value={folder.id}>{folder.name}</option>)}</select></label>
    {record.type === "character" && <div className="character-form-grid">
      <div className="character-image-column">
        <p>角色图片不影响正文生成，可以不传</p>
        <button className="character-image" onClick={() => imageRef.current?.click()}>{record.image ? <Image src={record.image} alt={`${record.name || "角色"}图片`} width={280} height={412} unoptimized /> : <><span><Upload size={24} /></span>上传首张图片</>}</button>
        <div className="character-image-actions"><button className="resource-button" onClick={() => imageRef.current?.click()}><ImagePlus size={14} />上传图片</button><button className="resource-button ai" onClick={() => onTool("AI生成角色图片", "appearance")}><Sparkles size={14} />AI 生成</button></div>
        <small>{imageError || "支持 JPG、PNG 格式，大小不超过 10MB"}</small>
        <input ref={imageRef} className="resource-hidden-input" type="file" accept="image/jpeg,image/png" onChange={uploadImage} />
      </div>
      <div className="character-fields">
        <div className="resource-two-fields"><label className="resource-field required"><span>姓名</span><div className="resource-input-wrap"><input value={record.name} maxLength={50} placeholder="角色名称示例" onChange={event => set("name", event.target.value)} /><small>{record.name.length} / 50</small></div></label><label className="resource-field required"><span>性别</span><select value={record.gender ?? "未知"} onChange={event => set("gender", event.target.value)}><option>未知</option><option>男</option><option>女</option><option>其他</option></select></label></div>
        <CountedTextarea label="角色性格" required value={record.personality ?? ""} placeholder="请输入角色的性格特点、喜好等..." onChange={value => set("personality", value)} />
        <CountedTextarea label="角色设定与背景" required value={record.background ?? ""} placeholder="请输入角色的详细经历、背景故事等内容..." onChange={value => set("background", value)} />
        <CountedTextarea label="外貌" value={record.appearance ?? ""} placeholder="支持上传图片识别角色外貌特征" onChange={value => set("appearance", value)} action={<button type="button" className="resource-button" onClick={() => onTool("识别角色外貌", "appearance")}><ScanSearch size={13} />识别外貌</button>} />
      </div>
    </div>}
    {record.type === "term" && <div className="term-form"><label className="resource-field required"><span>词条名称</span><div className="resource-input-wrap"><input value={record.name} maxLength={15} placeholder="请输入词条名称" onChange={event => set("name", event.target.value)} /><small>{record.name.length} / 15</small></div></label><CountedTextarea label="词条释义" required value={record.content} placeholder="详细解释该词条的含义、起源或作用..." onChange={value => set("content", value)} /></div>}
    {(error.includes("不能为空") || imageError) && <p className="resource-form-error" role="alert">{error.includes("不能为空") ? error : imageError}</p>}
    <footer className="resource-form-actions"><button className="resource-primary" onClick={onSave}>保存{resourceTypeLabel(record.type)}</button><button className="resource-button danger" onClick={onDelete}><Trash2 size={14} />删除{resourceTypeLabel(record.type)}</button><button className="resource-button" onClick={onExport}><Download size={14} />导出{resourceTypeLabel(record.type)}</button><button className="resource-button" onClick={() => onTool("提及章节", "content")}><ScanSearch size={14} />提及章节</button></footer>
  </div>;
}

function CountedTextarea({ label, value, placeholder, required = false, onChange, action }: { label: string; value: string; placeholder: string; required?: boolean; onChange: (value: string) => void; action?: ReactNode }) {
  return <label className={`resource-field ${required ? "required" : ""}`}><span>{label}{action}</span><div className="resource-textarea-wrap"><textarea value={value} placeholder={placeholder} onChange={event => onChange(event.target.value)} /><small>{value.length}</small></div></label>;
}

function MemoEditor({ record, folders, compact = false, onBack, onChange, onDelete, onTool }: {
  record: ResourceRecord;
  folders: ResourceFolder[];
  compact?: boolean;
  onBack: () => void;
  onChange: (next: Partial<ResourceRecord>, checkpoint?: boolean) => void;
  onDelete: () => void;
  onTool: ResourceToolHandler;
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [preview, setPreview] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [fontSize, setFontSize] = useState<"small" | "medium" | "large">("medium");
  const [theme, setTheme] = useState<"paper" | "green" | "night">("paper");

  function insert(before: string, after = before, fallback = "文字") {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selected = record.content.slice(start, end) || fallback;
    const content = `${record.content.slice(0, start)}${before}${selected}${after}${record.content.slice(end)}`;
    onChange({ content }, true);
    window.setTimeout(() => { textarea.focus(); textarea.setSelectionRange(start + before.length, start + before.length + selected.length); }, 0);
  }

  function restore(content: string) {
    if (!window.confirm("恢复这个历史版本吗？当前内容会先加入历史记录。")) return;
    onChange({ content }, true);
    setHistoryOpen(false);
  }

  return <div className={`memo-editor ${compact ? "compact" : ""} memo-theme-${theme}`}>
    <header className="memo-editor-header"><button aria-label="返回备忘录列表" onClick={onBack}><ChevronLeft size={18} /></button><input aria-label="备忘录标题" maxLength={80} value={record.name} onChange={event => onChange({ name: event.target.value })} />
      <button title="收藏" aria-pressed={Boolean(record.bookmarked)} className={record.bookmarked ? "active" : ""} onClick={() => onChange({ bookmarked: !record.bookmarked })}><Bookmark size={15} /></button>
      <button title="置顶" aria-pressed={Boolean(record.pinned)} className={record.pinned ? "active" : ""} onClick={() => onChange({ pinned: !record.pinned })}><Pin size={15} /></button>
      <label title="移动到文件夹"><FolderInput size={15} /><select aria-label="移动备忘录" value={record.folderId ?? ""} onChange={event => onChange({ folderId: event.target.value || undefined })}><option value="">未分类</option>{folders.map(folder => <option key={folder.id} value={folder.id}>{folder.name}</option>)}</select></label>
      <button title="删除" onClick={onDelete}><Trash2 size={15} /></button>
      <button title="历史记录" aria-expanded={historyOpen} onClick={() => setHistoryOpen(!historyOpen)}><Clock3 size={15} /></button>
    </header>
    <div className="memo-meta">更新 {new Date(record.updatedAt).toLocaleString("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })}<span>{record.content.replace(/\s/g, "").length} 字</span></div>
    {historyOpen && <div className="memo-history"><strong>历史版本</strong>{record.history?.length ? [...record.history].reverse().map(item => <button key={item.id} onClick={() => restore(item.content)}><Clock3 size={13} /><span>{new Date(item.createdAt).toLocaleString("zh-CN")}</span><small>{item.content.slice(0, 32) || "空白内容"}</small></button>) : <p>暂无历史版本。使用格式工具或恢复前会自动保留版本。</p>}</div>}
    <div className="memo-tools">
      <button className={!preview ? "active" : ""} onClick={() => setPreview(false)}><FileText size={13} />编辑</button><button className={preview ? "active" : ""} onClick={() => setPreview(true)}><Eye size={13} />原文本</button>
      <button onClick={() => setFontSize(fontSize === "small" ? "medium" : fontSize === "medium" ? "large" : "small")} title="字号">T<span>T</span></button>
      <button onClick={() => insert("**")} title="加粗"><Bold size={14} /></button><button onClick={() => insert("*")} title="斜体"><Italic size={14} /></button><button onClick={() => insert("## ", "", "标题")} title="二级标题"><Heading2 size={14} /></button><button onClick={() => insert("- ", "", "列表项")} title="列表"><List size={14} /></button><button onClick={() => insert("> ", "", "引用内容")} title="引用"><Quote size={14} /></button><button onClick={() => insert("{{", "}}", "字段")} title="字段">字段</button><button onClick={() => insert("\n---\n", "", "")} title="分隔线">—</button>
      <button className="memo-ai-button" onClick={() => onTool("AI整理备忘录", `${record.name}\n${record.content}`, text => onChange({ content: text }, true))}><Bot size={14} />AI整理</button>
      <label className="memo-theme-picker" title="编辑主题"><span>主题</span><select aria-label="备忘录主题" value={theme} onChange={event => setTheme(event.target.value as "paper" | "green" | "night")}><option value="paper">纸张</option><option value="green">护眼</option><option value="night">夜间</option></select></label>
    </div>
    {preview ? <MarkdownPreview content={record.content} /> : <textarea ref={textareaRef} className={`memo-textarea memo-font-${fontSize}`} aria-label="备忘录内容" value={record.content} onChange={event => onChange({ content: event.target.value })} placeholder="直接输入内容；选中文字即可加粗、设为标题或添加结构字段..." />}
    {!record.content && !preview && <div className="memo-welcome"><FileText size={32} /><strong>开始编辑</strong><small>标题、重点与列表会在输入时直接呈现</small></div>}
  </div>;
}

function MarkdownPreview({ content }: { content: string }) {
  if (!content.trim()) return <div className="memo-preview empty"><Eye size={30} /><span>暂无可预览内容</span></div>;
  return <div className="memo-preview">{content.split("\n").map((line, index) => {
    if (line.startsWith("## ")) return <h2 key={index}>{line.slice(3)}</h2>;
    if (line.startsWith("# ")) return <h1 key={index}>{line.slice(2)}</h1>;
    if (line.startsWith("> ")) return <blockquote key={index}>{line.slice(2)}</blockquote>;
    if (line.startsWith("- ")) return <div className="memo-list-line" key={index}>• {line.slice(2)}</div>;
    if (line.trim() === "---") return <hr key={index} />;
    return <p key={index}>{line || "\u00a0"}</p>;
  })}</div>;
}
