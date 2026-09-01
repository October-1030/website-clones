# DashboardOverview specification
Target src/components/dashboard-overview.tsx. Named export DashboardOverview. Optional props companies?:string[]. Local dropdown state. No backend.
Reference docs/design-references/original-dashboard-desktop.png. Original DOM docs/research/dashboard-dom.html. Screenshot1440x1000 source sidebar148px topbar60px, main scroll content starts y84. Root .dashboard supplies all --cv-* variables documented in src/app/dashboard.css.
Build one large region aria-label 数据总览, width fills parent, white background, border1px var(--cv-line), square corners. At1440 wide: region height~564.275px, header151.55px, branch area304.325px, platform-share~106.8px.
Header flex wrap gap16px 24px align-end space-between, padding28px 28px 24px.
Eyebrow 数据总览 margin0 0 8px;12px/18px weight500;color--cv-text-soft;letter-spacing.16em.
Title 工作台: clamp(29.6px,2.6vw,38px); weight600;line1.15;tracking-.03em;color--cv-text.
Subtitle 围绕搜索问题，一边产内容，一边查收录:15px/22.5px;mt8;color--cv-text-muted.
Header right flex gap9.6px. Scope select width200px minheight32px rounded9999, padding0 12px inset1px --cv-line-strong; text13px; leading green dot6.4px. Label 全部公司 · 汇总, option same plus supplied companies. Date pill 截至 2026-08-31 padding7.2px 14.4px,13px mono,border1 --cv-line-strong. Dropdown should open local option list.
Fork layout grid columns auto 88px minmax(0,1fr), align-center, padding0 28px 28px.
Root metric 搜索问题, value0, label14px; num64px weight700 line1.02 tracking-.035em;font--cv-mono. Delta 0% 较上周 12px font600 mono muted. Note 问题是起点：内容围着它写，收录也围着它查 max176px mt14.4px font12px/18px. Root padding-right20px.
Fork connector svg viewBox 0 0 88 240 preserveAspectRatio none width100%height100% minheight208px; paths M4,120 H26 C46,120 46,52 66,52 H88 and M4,120 H26 C46,120 46,188 66,188 H88 stroke var(--cv-line-strong) strokeWidth1.5; circle cx4 cy120 r4 fill--cv-signal.
Branches flex column gap1px bg--cv-line border1px --cv-line radius8px.
Each branch flex aligncenter padding20px 22.4px; white bg; nodes minwidth152px.
Upper nodes 文章 => 发布成功, bottom AI 收录检查 => 自有文章被引用. All values0; unit次 on all except 文章. num36px line1.02 weight700 same mono. label13px/19.5px; gaps4.8px. Delta 0% 较上周 12px. Article has note 暂无问题 at mt2.4px font12px. Other nodes no note.
Connector between each node vertical flex gap4.8px center minwidth144px px20px; arrow full width 1px gradient line-strong to signal + right arrowhead; caption 发布到各平台 and 命中自有文章 11px. Trailing tags 内容生产 and 可见性监测 margin-left:auto padding4.8px 11.2px font12px/bg--cv-surface-muted border--cv-line radius9999px.
Info help tooltip icons use DashIcon name=info. Label descriptions:
搜索问题:问题库里的搜索问题总数。文章围绕问题生成，收录检查也按问题逐个到各 AI 平台去查，所以它是整条链路的起点。
文章:已创建的文章总数，包含由搜索问题生成的和手动创建的。
发布成功:发布成功的次数。同一篇文章发到多个平台会分别计一次，所以次数通常多于文章篇数。
AI 收录检查:在各 AI 平台执行的收录检查次数（一个问题在一个平台查一次记一次），不等于「有多少内容被收录」。下方一行是其中真正查到收录的问题数及其占问题总数的比例。
自有文章被引用:收录检查结果中引用到你自己文章的次数。下方一行是这些引用来自多少篇不重复的文章——同样是 22 次，来自 6 篇和来自 22 篇含义完全不同。
Platform share bottom border-top1 line padding24px28px28px. Title 各 AI 平台收录占比 text13px weight500 tracking.12em inline info. mb14.4px. Empty 还没有平台收录记录，发布内容后这里会亮起 font14px/21px soft.
<=1100px: fork single column gap20px no connector, root no right padding note max-width:none. <=900px root value48px branch value30px; branch wrap gap16px; link minwidth112px padding0; tag margin-left0.
Use Tailwind utilities, no inline styles; scoped overview CSS allowed for complex connectors. Export own css import from component. No changes to shared files. Root handles rest of page.
