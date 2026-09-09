# BookEditor specification

Target: src/components/BookEditor.tsx and src/components/book-editor.css. Named export.
Screenshots: source-editor-desktop.png, source-editor-mobile.png, source-editor-tablet.png.
Interaction model: click-driven; separately scrolling chapter directory and editor; no scroll animations.

Props: book: Book, onChange:(book:Book)=>void, onBack:()=>void,
onTool:(name:string,context?:string,onResult?:(text:string)=>void)=>void,
resources?:ReactNode. Root supplies resources separately; do not edit Workspace or other shared files.
Book and Chapter types from @/types/workspace. chapters optional for compatibility with existing saved books.
Legacy book.content becomes first chapter; chapter edits keep aggregated book.content in sync.

Desktop geometry: full viewport workbench, top header 46px, body top50px, gap10px.
Left directory 300px, bg#f1f4f7, border1px #cbd5e1, radius0 16px 16px 0,
shadow0 8px 24px rgba(55,65,81,.12). Source font14px/22.4 system.
Main editor surface#f8fafc radius16px. Toolbar44.8px bg#edf1f5, padding4px.
Toolbar icon buttons36x36 radius12, hover transition .2s cubic-bezier(.4,0,.2,1).
Chapter title24px, maximum35 chars, count at right, pin-title toggle.
Body font17px Microsoft YaHei, line-height34px, padding10px 55px; flexible full remaining height.
Directory card active background#e5eaf0 with4px #55759b left bar; height~99px,
padding12px inner; title14px, metadata12px/16px. Card actions 概要/生成/删除/更多.
Header AI actions outlined amber round pills. Exact labels: AI写作, AI扩写润色,
AI续写正文, 章纲, AI拆书, AI审稿, AI纠错, AI去痕, 更多AI工具, 剧本改编.
Left back/fullscreen/directory icons, right save time, history, phone preview, sound, settings, more.
Lucide icons allowed for these newly inspected controls; no image assets used.

Directory required: list/select/new chapter, new volume group, import TXT/MD with optional
chapter-heading split, sort/reorder, search, bookmark, editable summary, delete with confirmation,
insert before/after, per-chapter export, history restore. Keep save errors visible and content intact.
Directory tools also include two personal long-form actions: 批量生成缺失概要 and 剧情一致性检查.
Batch summary generation sends only non-empty chapters without an existing summary, labels each source
with a stable S-number, accepts only matching S-number result lines, previews through the shared AI dialog,
and writes parsed summaries back to the correct chapters when the user applies the result. Never replace
an existing manual summary. Consistency checking assembles book metadata, all chapter summaries and
bounded excerpts, opens the shared AI dialog, and does not modify prose when the user applies nothing.
Source more menu: 向前插入一章, 向后插入一章, AI 章节起名, 时光机, 导出章节, AI 听书.
Use optional volume field on Chapter locally if needed (define editor local metadata, don't change shared type).
Editor tools: undo/redo, copy, find/replace, typography settings, punctuation normalization,
fullscreen, pin title, desktop/mobile preview, read aloud via browser speechSynthesis, download.
All AI controls call onTool with current chapter context and a suitable result callback; no dead notices.
Resources toggle shows supplied resources pane at right (about33vw); modal fallback on small screens.
Float back-to-top/bottom and 听/画 buttons; 画 opens onTool('章节配图',chapter.content).

Mobile390px: top bar32px with icon actions; initially directory fills screen. Selecting a chapter
shows editor, directory toggle/back switches views. Desktop AI row moves into menu. Source new-volume
label visible on mobile. Main body padding16px for readability. Never overflow horizontally.
Tablet768px: directory and editor still side by side, AI header horizontally scrollable, hide saved time.
Use existing tokens, Modal, useLocalState; new state persisted by parent or per-book local storage.
History snapshots must be bounded and debounced; avoid saving one snapshot per keystroke.
Avoid claiming cloud sync. All meaningful local actions functional; unavailable network is handled by root's tool dialog.
Verify TypeScript and lint in your isolated worktree; commit only your two component files and optional tests.
