# ResourcePanel and ResourceManager

Targets src/components/ResourcePanel.tsx and resource-panel.css; shared types in own resource-data.ts.
Screenshot paths: source-character-form.png, source-term-form.png, source-memo-panel.png,
source-memo-form.png; original CSS/DOM captured in docs/research/full/ matching JSON.
Click-driven, independent list and detail scroll. No external assets except optional user uploaded image.
Export ResourcePanel props {bookId:string,onTool:(name:string,context?:string,onResult?:(text:string)=>void)=>void}.
Can also export ResourceManager for optional external use. Do not edit Workspace or BookEditor.

ResourcePanel header 资料栏, tabs角色/词条/备忘录. Panel#f8fafc radius16 border1px#cbd5e1,
14px/22.4 font, shadow0 8px24px rgba(55,65,81,.12). Header54px, tablist48.8px
grid3cols padding7px8px gap5. Toolbar#edf1f5 padding10 gap7.
Role/term toolbar search name, folder filter, 新建, refresh. Empty text
这本作品还没有角色卡/词条卡; 新建角色/新建词条 and 打开完整管理 actions.
Full manager modal width1300 max98vw height96vh (mobile98vh), radius24 desktop16 mobile,
white/source surface, maskrgba(0,0,0,.4), 3 columns folder sidebar/list/detail.
Top title角色卡/词条卡, 固定到资料栏, 教程, close. Left新建/导入, folder tree,
新建文件夹. List search搜索名称..., AI生成, 智能识别, 批量, item modifiedtime.
Details 所属文件夹, close, form, save/delete/export/提及章节.

Character fields: 姓名(max50), 性别(default未知), 角色性格(textarea),
角色设定与背景(textarea), 外貌(textarea). Image upload optional JPEG/PNG<=10MB,
AI生成/识别外貌 delegate onTool. Content counters; don't copy source credit messages into local billing.
Term fields: 词条名称(max15), 词条释义. Both required. Folder selection, save/delete.
Memo list: 新文件夹/新建/批量/刷新/search, 全局备忘录(所有作品可用),
本书备忘录(仅当前作品可见); collapsible folder trees默认/未分类 with count and add.
Memo detail: title edit, updated time/wordcount, bookmark/pin/move/delete/history,
编辑/原文本 tabs, font size, bold/italic/heading/list/quote/字段/separator, theme.
Editable markdown acceptable with preview, autosave. Bounded history, restore with confirm.
All local CRUD, folder rename/delete/move, search, batch selection/delete/export, JSON/TXT imports,
export, pin/bookmark must function and retain data after reload. Add visible errors on malformed imports.
Deletion confirmations must identify item, preserve unrelated data. File downloads via Blob.
Data keys xingyue-resources and xingyue-resource-folders. Define own exported ResourceRecord:
id,type(character|term|memo|knowledge),name,content,bookId?:string,folderId?:string,
updatedAt,gender?,personality?,background?,appearance?,image?,pinned?,bookmarked?.
Empty bookId/global means available to all books. Character/term content can aggregate form fields for AI context.
No seeded private source content. Parent onTool handles actual provider config and output; no static fake AI text.
Mobile hides folder column behind toggle, list/detail switch, toolbar wraps; no horizontal overflow.
Modal from existing component, tokens/global button/input utilities. Named exports strictTS no any.
Verify tsc and lint in isolated worktree, commit own files. Root handles integration and browser tests.
