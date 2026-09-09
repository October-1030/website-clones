# LibraryPanel

Target src/components/LibraryPanel.tsx. Reference original-desktop.png.
Flex panel,#f8fafc,border#cbd5e1,radius17px,shadow0 8px24px rgba(55,65,81,.12). Tabs52px: 作品/已归档/回收站,16px source icons,14px muted text;2px active underline#55759b. Filters 全部/📖 小说/🎬 剧本 are12px rounded pills.
Toolbar58px with 新建文件夹, three display options, 搜索书籍..., 批量管理. Grid padding5px16px16px; desktop3 columns/20px gap; card296×195px,radius20px. Plus80px desktop,48px mobile. Primary card area139px; lower action band56px,#e9edf2. Hover translates-4px,0.4s cubic-bezier(.2,.8,.2,1).
Click-driven tabs/filter/layout; scroll does not switch tabs. Local persisted works support edit, archive, recycle, restore, search and batch changes. Mobile one column, toolbar controls hidden except folder; tablet2 columns. Card text: 新建作品 / 导入作品. Empty-state copy is local demo behavior, not extracted source content.
