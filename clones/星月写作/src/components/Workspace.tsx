"use client";

import Image from "next/image";
import { useRef, useState, type ChangeEvent } from "react";
import { Check, ChevronLeft, Download, MoreHorizontal } from "lucide-react";
import { AppearancePanel, skins } from "./AppearancePanel";
import { AccountPanel, type AccountTab } from "./AccountPanel";
import { AIToolDialog } from "./AIToolDialog";
import { ImageDialog } from "./ImageDialog";
import { TitleTestDialog } from "./TitleTestDialog";
import { BookDialog } from "./BookDialog";
import { BookManageDialog } from "./BookManageDialog";
import { BookEditor } from "./BookEditor";
import { CommunityPanel } from "./CommunityPanel";
import { CreativePanel } from "./CreativePanel";
import { GoldenOpeningDialog } from "./GoldenOpeningDialog";
import { LibraryPanel } from "./LibraryPanel";
import { KnowledgePage, PromptLibraryPage } from "./MarketplacePages";
import { Modal } from "./Modal";
import { ResourcePanel } from "./ResourcePanel";
import { AboutModal, CoursesPage, CreatorCenterPage, ForumPage, RankingPage, ScriptPage } from "./UtilityPages";
import { WelcomeGuide } from "./WelcomeGuide";
import { WorkflowPanel } from "./WorkflowPanel";
import { AlertIcon, BellIcon, BooksIcon, CartIcon, ChartIcon, CourseIcon, ForumIcon, HistoryIcon, IdeaIcon, InfoIcon, KnowledgeIcon, MailIcon, PaletteIcon, PromptIcon, ReceiptIcon, ScriptIcon, UserIcon, WalletIcon, WorkflowIcon, CloseIcon } from "./icons";
import { useLocalState } from "@/lib/use-local-state";
import type { Book, BookKind, BookStatus, Folder } from "@/types/workspace";

const emptyBooks: Book[] = [];
const emptyFolders: Folder[] = [];
const navigation = [{ label: "作品", Icon: BooksIcon }, { label: "创意", Icon: IdeaIcon }, { label: "工作流", Icon: WorkflowIcon }, { label: "剧本", Icon: ScriptIcon }, { label: "AI扫榜", Icon: ChartIcon }, { label: "提示词", Icon: PromptIcon }, { label: "知识卡", Icon: KnowledgeIcon }, { label: "课程", Icon: CourseIcon }, { label: "创作中心", Icon: UserIcon }, { label: "星月论坛", Icon: ForumIcon }];

export function Workspace() {
  const [books, setBooks] = useLocalState<Book[]>("xingyue-books", emptyBooks);
  const [folders, setFolders] = useLocalState<Folder[]>("xingyue-folders", emptyFolders);
  const [guided, setGuided] = useLocalState("xingyue-guided", false);
  const [lastCheckIn, setLastCheckIn] = useLocalState("xingyue-last-check-in", "");
  const [skin, setSkin] = useLocalState("xingyue-skin", 2);
  const [mode, setMode] = useLocalState("xingyue-mode", "白天");
  const [eyeCare, setEyeCare] = useLocalState("xingyue-eye-care", false);
  const [banner, setBanner] = useState(true);
  const [communityVisible, setCommunityVisible] = useLocalState("xingyue-community-visible", true);
  const [collapsed, setCollapsed] = useState(false);
  const [appearance, setAppearance] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  const [dialog, setDialog] = useState<"create" | "folder" | "import" | "mobile" | "opening" | null>(null);
  const [page, setPage] = useState("作品");
  const [folderName, setFolderName] = useState("");
  const [targetFolder, setTargetFolder] = useState<string | undefined>();
  const [info, setInfo] = useState<{ title: string; message: string } | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [managing, setManaging] = useState<string | null>(null);
  const [editorLaunch, setEditorLaunch] = useState<{ panel?: "import" | "settings"; chapterId?: string }>({});
  const [activeTool, setActiveTool] = useState<{ name: string; input?: string; onResult?: (text: string) => void } | null>(null);
  const [about, setAbout] = useState(false);
  const [accountTab, setAccountTab] = useState<AccountTab | null>(null);
  const [toast, setToast] = useState("");
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const activeBook = books.find(book => book.id === editing);

  function notify(message: string) { setToast(message); if (toastTimer.current) clearTimeout(toastTimer.current); toastTimer.current = setTimeout(() => setToast(""), 2800); }
  function leaveGuide() { setGuided(true); setShowGuide(false); }
  function openCreate(folderId?: string) { leaveGuide(); setTargetFolder(folderId); setDialog("create"); }
  function openImport() { leaveGuide(); setTargetFolder(undefined); setDialog("import"); }
  function openOpening() { leaveGuide(); setTargetFolder(undefined); setAppearance(false); setDialog("opening"); }
  function checkIn() { const today = new Date().toISOString().slice(0, 10); if (lastCheckIn === today) notify("今天已经签到过了"); else { setLastCheckIn(today); notify("签到成功，已记录到本地"); } }
  function navigate(label: string) { setPage(label); setEditing(null); setDialog(null); setAppearance(false); }
  function feature(title: string) { setAppearance(false); setDialog(null); setInfo({ title, message: `${title}需要连接账号服务。你可以访问原站使用，也可以继续在本地管理和编辑作品。` }); }
  function createBook(title: string, kind: BookKind, description: string, content = "") {
    const folderId = folders.find(folder => folder.id === targetFolder)?.id;
    const book: Book = { id: crypto.randomUUID(), title, kind, description, content, status: "active", updatedAt: new Date().toISOString(), folderId };
    setBooks([...books, book]); setDialog(null); notify("作品已创建");
    return book.id;
  }
  function setStatus(ids: string[], status: BookStatus) { setBooks(books.map(book => ids.includes(book.id) ? { ...book, status } : book)); notify(status === "active" ? "作品已恢复" : status === "archived" ? "作品已归档" : "已移入回收站，可随时恢复"); }
  async function importFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]; if (!file) return;
    if (file.size > 10 * 1024 * 1024) { notify("请选择小于 10MB 的文本文件"); return; }
    const content = await file.text(); createBook(file.name.replace(/\.[^.]+$/, "").slice(0, 30), "novel", "", content); event.target.value = "";
  }
  function updateBook(updated: Book) { setBooks(current => current.map(book => book.id === updated.id ? updated : book)); }
  function openBookAction(id: string, action: "chapter" | "import" | "settings") {
    const book = books.find(item => item.id === id);
    if (!book) return;
    if (action === "settings") { setManaging(id); return; }
    try {
      if (action === "chapter") {
        const now = new Date().toISOString();
        const existing = book.chapters?.length ? book.chapters : book.content ? [{ id: crypto.randomUUID(), title: "第一章", content: book.content, summary: "", updatedAt: book.updatedAt }] : [];
        const chapter = { id: crypto.randomUUID(), title: `第${existing.length + 1}章`, content: "", summary: "", updatedAt: now };
        const chapters = [...existing, chapter];
        updateBook({ ...book, chapters, content: chapters.map(item => item.content).join("\n\n"), updatedAt: now });
        setEditorLaunch({ chapterId: chapter.id });
      } else setEditorLaunch({ panel: action });
      setEditing(id);
    } catch { notify("章节保存失败，请检查浏览器存储空间。"); }
  }
  function appendToBook(bookId: string, text: string) {
    const now = new Date().toISOString();
    setBooks(books.map(book => {
      if (book.id !== bookId) return book;
      const existing = book.chapters?.length ? book.chapters : [{ id: crypto.randomUUID(), title: "第一章", content: book.content, summary: "", updatedAt: book.updatedAt }];
      const chapters = [...existing, { id: crypto.randomUUID(), title: `AI生成 · ${activeTool?.name || "创作结果"}`, content: text, summary: "", updatedAt: now }];
      return { ...book, chapters, content: chapters.map(chapter => chapter.content).join("\n\n"), updatedAt: now };
    }));
    notify("已保存到作品的新章节");
  }
  if (activeBook) return <div className={`workspace editor-workspace theme-${skin} ${mode === "黑夜" ? "dark-mode" : mode === "跟随" ? "system-mode" : ""} ${eyeCare ? "eye-care" : ""}`}>
    <BookEditor key={activeBook.id} initialPanel={editorLaunch.panel} initialChapterId={editorLaunch.chapterId} book={activeBook} onChange={updateBook} onBack={() => { setEditing(null); setEditorLaunch({}); }} onTool={(name, context, onResult) => setActiveTool({ name, input: context, onResult })} resources={<ResourcePanel bookId={activeBook.id} onTool={(name, context, onResult) => setActiveTool({ name, input: context, onResult })} />} />
    {activeTool && (activeTool.name === "书名测试" ? <TitleTestDialog books={books} onClose={() => setActiveTool(null)} onCover={(id, cover) => { const book = books.find(item => item.id === id); if (!book) throw new Error("作品已不存在"); updateBook({ ...book, cover, updatedAt: new Date().toISOString() }); }} /> : ["封面生成器", "AI生成角色图片", "章节配图"].includes(activeTool.name) ? <ImageDialog useImageLabel={activeTool.name === "章节配图" ? "保存章节配图" : "应用到角色卡"} name={activeTool.name} initialInput={activeTool.input} books={books} onUseImage={activeTool.onResult} onCover={(id, cover) => { const book = books.find(item => item.id === id); if (!book) throw new Error("作品已不存在"); updateBook({ ...book, cover, updatedAt: new Date().toISOString() }); }} onClose={() => setActiveTool(null)} /> : <AIToolDialog name={activeTool.name} initialInput={activeTool.input} initialBookId={activeBook.id} books={books} onClose={() => setActiveTool(null)} onSave={["批量生成章节概要", "剧情一致性检查"].includes(activeTool.name) ? undefined : appendToBook} onUseResult={activeTool.onResult} />)}
    {toast && <div role="status" className="toast"><Check size={17} className="text-green-600" />{toast}</div>}
  </div>;
  return <div className={`workspace theme-${skin} ${mode === "黑夜" ? "dark-mode" : mode === "跟随" ? "system-mode" : ""} ${eyeCare ? "eye-care" : ""}`}>
    <header className="top-header">
      <div className="flex items-center gap-3 max-sm:gap-1">
        <button aria-label="个人中心" className="avatar" onClick={() => setAccountTab("个人中心")}><Image src="/seo/favicon.ico" alt="星月写作" width={32} height={32} unoptimized /><span /></button>
        <button className="header-button" onClick={() => setAccountTab("充值")}><CartIcon className="text-xl" /><span className="max-sm:hidden">充值</span></button>
        <button className="header-button" aria-label="字数余额" onClick={() => setAccountTab("字数余额")}><WalletIcon className="text-xl" /></button>
        <button className="header-button" aria-label="使用记录" onClick={() => setAccountTab("使用记录")}><ReceiptIcon className="text-xl" /></button>
      </div>
      <h1 className="brand-name">星月写作</h1>
      <div className="flex items-center gap-3 max-sm:gap-1">
        <button className="header-button" aria-label="通知" onClick={() => setInfo({ title: "通知", message: "暂无新通知" })}><BellIcon className="text-xl" /></button>
        <button className="header-button" aria-label="站内消息" onClick={() => setInfo({ title: "站内消息", message: "暂无新消息" })}><MailIcon className="text-xl" /></button>
        <button className="header-button" aria-label="历史记录" onClick={() => setAccountTab("历史记录")}><HistoryIcon className="text-xl" /></button>
        <button className="header-button" aria-label={`外观设置：${skins[skin]}`} aria-expanded={appearance} onClick={() => setAppearance(!appearance)}><PaletteIcon className="text-xl" /></button>
        <button className="header-button text-xs" onClick={() => { setShowGuide(true); setAppearance(false); }}>教程</button>
      </div>
    </header>
    <div className="workspace-body">
      <aside className={`sidebar ${collapsed ? "collapsed" : ""}`} aria-label="主导航">
        <nav className="flex flex-col pt-2">{navigation.map(({ label, Icon }) => <button key={label} title={label} className={`nav-item ${page === label ? "active" : ""}`} onClick={() => navigate(label)}><Icon className="text-xl" /><span>{label}</span></button>)}</nav>
        <button aria-label={collapsed ? "展开侧栏" : "收起侧栏"} className="collapse-button" onClick={() => setCollapsed(!collapsed)}><ChevronLeft size={17} className={collapsed ? "rotate-180" : ""} /></button>
        <button className="nav-item about-button" onClick={() => setAbout(true)}><InfoIcon className="text-xl" /><span>关于我们</span></button>
      </aside>
      <main className="main-workspace">
        {banner && <div className="notice-banner" role="alert"><AlertIcon className="text-[22px] text-[#2080f0]" /><span><button className="underline" onClick={() => feature("客服微信")}>点击添加客服微信</button> 可领取3万字字数包和进交流群领取教程</span><button className="ml-auto shrink-0 text-muted" aria-label="关闭通知横幅" onClick={() => setBanner(false)}><CloseIcon className="text-xl" /></button></div>}
        <div className="workspace-panels">
          {page === "创意" ? <CreativePanel onOpening={openOpening} onTool={name => setActiveTool({ name })} /> : page === "工作流" ? <WorkflowPanel books={books} /> : page === "剧本" ? <ScriptPage onTool={name => setActiveTool({ name })} /> : page === "AI扫榜" ? <RankingPage /> : page === "提示词" ? <PromptLibraryPage onRun={(name, input) => setActiveTool({ name, input })} /> : page === "知识卡" ? <KnowledgePage /> : page === "课程" ? <CoursesPage /> : page === "创作中心" ? <CreatorCenterPage books={books} /> : page === "星月论坛" ? <ForumPage /> : <>
            <LibraryPanel books={books} folders={folders} onNew={openCreate} onImport={openImport} onOpening={openOpening} onFolder={() => setDialog("folder")} onOpen={id => { setEditorLaunch({}); setEditing(id); }} onBookAction={openBookAction} onStatus={setStatus} />
            {communityVisible ? <div className="community-column"><CommunityPanel onClose={() => setCommunityVisible(false)} onArticle={title => setInfo({ title, message: "此处展示原站公开文章标题。完整讨论和作者内容请前往星月写作网文社区查看。" })} onShare={() => navigate("星月论坛")} onMore={() => navigate("星月论坛")} onCheckIn={checkIn} /></div> : <button className="subtle-button self-start max-[1199px]:hidden" onClick={() => setCommunityVisible(true)}>显示网文社区</button>}
          </>}
        </div>
        <footer className="workspace-footer"><span>© 2026 保定智语科技有限公司</span><a href="https://beian.miit.gov.cn/" target="_blank" rel="noreferrer">冀ICP备2024086783号-1</a><a href="https://beian.mps.gov.cn/#/query/webSearch?code=13060602001729" target="_blank" rel="noreferrer">🔰 冀公网安备13060602001729号</a><a href="https://www.cac.gov.cn/2025-07/14/c_1754207718303963.htm" target="_blank" rel="noreferrer">网信算备130606798030301250017号</a><span>Hebei-XingYueXieZuo-20260626S0010</span><span>冀B2-20250351</span></footer>
      </main>
    </div>
    <nav className="mobile-nav" aria-label="底部导航">{navigation.slice(0, 4).map(({ label, Icon }) => <button className={page === label ? "active" : ""} key={label} onClick={() => navigate(label)}><span><Icon className="text-xl" /></span>{label}</button>)}<button onClick={() => setDialog("mobile")}><span><MoreHorizontal size={22} /></span>更多</button></nav>
    {appearance && <><button className="appearance-backdrop" aria-label="关闭外观设置" onClick={() => setAppearance(false)} /><AppearancePanel skin={skin} mode={mode} eyeCare={eyeCare} onSkin={setSkin} onMode={setMode} onEyeCare={() => setEyeCare(!eyeCare)} /></>}
    {(!guided || showGuide) && <WelcomeGuide onSkip={leaveGuide} onCreate={openOpening} onImport={openImport} />}
    {dialog === "opening" && <GoldenOpeningDialog books={books} onClose={() => setDialog(null)} onSave={(title, description, content) => { const id = createBook(title, "novel", description, content); setPage("作品"); setEditing(id); }} />}
    {dialog === "create" && <BookDialog onClose={() => setDialog(null)} onCreate={createBook} />}
    {managing && books.find(book => book.id === managing) && <BookManageDialog book={books.find(book => book.id === managing)!} folders={folders} onChange={updateBook} onClose={() => setManaging(null)} />}
    {dialog === "folder" && <Modal title="新建文件夹" onClose={() => setDialog(null)}><form onSubmit={e => { e.preventDefault(); if (!folderName.trim()) return; setFolders([...folders, { id: crypto.randomUUID(), name: folderName.trim() }]); setFolderName(""); setDialog(null); notify("文件夹已创建"); }}><input className="form-input" autoFocus placeholder="请输入文件夹名称" aria-label="文件夹名称" value={folderName} onChange={e => setFolderName(e.target.value)} maxLength={30} required /><div className="mt-5 flex justify-end gap-3"><button type="button" className="subtle-button" onClick={() => setDialog(null)}>取消</button><button className="primary-button" type="submit">创建</button></div></form></Modal>}
    {dialog === "import" && <Modal title="导入作品" onClose={() => setDialog(null)}><button className="import-zone" onClick={() => inputRef.current?.click()}><Download size={38} className="text-primary" /><strong>点击选择文件</strong><span className="text-xs text-muted">支持 TXT、Markdown 文本文件，最大 10MB</span></button><input className="hidden" ref={inputRef} type="file" accept=".txt,.md,text/plain,text/markdown" onChange={importFile} /><p className="mt-4 text-xs text-muted">导入后的作品保存在当前浏览器，可随时编辑和导出。</p></Modal>}
    {dialog === "mobile" && <Modal title="更多功能" onClose={() => setDialog(null)}><div className="grid grid-cols-3 gap-3">{navigation.slice(4).map(({ label, Icon }) => <button className="flex flex-col items-center gap-2 rounded-xl bg-background p-4 text-xs" key={label} onClick={() => { navigate(label); setDialog(null); }}><Icon className="text-2xl" />{label}</button>)}</div></Modal>}
    {activeTool && (activeTool.name === "书名测试" ? <TitleTestDialog books={books} onClose={() => setActiveTool(null)} onCover={(id, cover) => { const book = books.find(item => item.id === id); if (!book) throw new Error("作品已不存在"); updateBook({ ...book, cover, updatedAt: new Date().toISOString() }); }} /> : ["封面生成器", "AI生成角色图片", "章节配图"].includes(activeTool.name) ? <ImageDialog useImageLabel={activeTool.name === "章节配图" ? "保存章节配图" : "应用到角色卡"} name={activeTool.name} initialInput={activeTool.input} books={books} onUseImage={activeTool.onResult} onCover={(id, cover) => { const book = books.find(item => item.id === id); if (!book) throw new Error("作品已不存在"); updateBook({ ...book, cover, updatedAt: new Date().toISOString() }); }} onClose={() => setActiveTool(null)} /> : <AIToolDialog name={activeTool.name} initialInput={activeTool.input} books={books} onClose={() => setActiveTool(null)} onSave={appendToBook} onUseResult={activeTool.onResult} />)}
    {about && <AboutModal onClose={() => setAbout(false)} />}
    {accountTab && <AccountPanel initialTab={accountTab} books={books} onClose={() => setAccountTab(null)} onOpenBook={id => { setPage("作品"); setEditing(id); }} />}
    {info && <Modal title={info.title} onClose={() => setInfo(null)}><p className="py-5 text-sm leading-7 text-muted">{info.message}</p><div className="flex justify-end gap-3"><button className="subtle-button" onClick={() => setInfo(null)}>关闭</button><a className="primary-button" href="https://xingyuexiezuo.com/" target="_blank" rel="noreferrer">访问原站</a></div></Modal>}
    {toast && <div role="status" className="toast"><Check size={17} className="text-green-600" />{toast}</div>}
  </div>;
}
