# DashboardAnalytics and MonthlyTrend specifications
Targets src/components/dashboard-analytics.tsx and src/components/monthly-trend.tsx, named exports DashboardAnalytics and MonthlyTrend.
Both rendered in .dashboard (all --cv-* variables already in foundation). Use class dashboard-card dashboard-reveal shared styles: square white card,border1px #f2f4f5,padding28px,shadow0 1px3px #00000008,0 1px2px -1px #00000014. Dashboard heading shared dashboard-heading, font18px/28px weight600 left13.6px accent bar3px. Subtitle shared dashboard-subtitle 13px/19.5px left13.6px mt4.8px. Header padding-right24px padding-bottom4px.
Analytics reference docs/design-references/original-dashboard-desktop.png and original DOM docs/research/dashboard-dom.html. Click tabs only, no scroll-driven state.
Heading 收录分析, subtitle 选一个 AI 平台，看它引用了哪些来源. Header mb28px. Analytics body minheight256px. Tablist flex-wrap gap8px.
Tabs: 全部平台, 深度求索, 豆包, 元宝, 千问, 文心, Kimi, 智谱清言. Every count0. Platform assets (local): /images/deepseek-color.png,/images/doubao-color.png,/images/yuanbao-color.png,/images/qwen-color.png,/images/wenxin-color.png,/images/kimi-color.png,/images/zhipu-color.png. 18px square contain radius4px.
Tab inline-flex gap8px aligncenter padding8px 13.6px,14px text--cv-text border1--cv-line radius8px white. All tab counters font13px weight600 --cv-mono color--cv-text-muted.
Default 全部平台 selected: weight600;color--cv-signal-ink,bg--cv-signal-soft,border--cv-signal. Zero inactive tabs opacity.5. Hover border--cv-line-strong; transition bg/border.16s. Ensure accessible role tab aria-selected tabpanel connected and keyboard arrows.
After tablist, label ${platform}的引用来源 TOP10 · 共 0 次; margin28px0 17.6px,font12px weight500 letterspacing.14em soft.
Empty rank block minheight192px flex-col center gap8px textsoft; DashIcon name rank size26px opacity.75; text 该平台暂无引用来源数据 14px/21px.
All tabs inspected/expected zero dataset; selecting changes name label and highlight without fabricating data. No network.
MonthlyTrend: header heading 月度趋势, subtitle 近 6 个月每月新增。色深表示该指标自身的相对高低，行与行独立标定. Header mb24px. Empty block minheight192px flexcol gap8px center soft, DashIcon name matrix size26px opacity.75, text 暂无月度数据 14px/21px. No charts with invented numbers.
Responsive flexwrap tabs naturally at 390/768; both full parent width. Named exports,no any,no inline styles. Image next/image unoptimized width18 height18 or img with narrow documented eslint disable. Shared DashIcon imports from @/components/dashboard-icons. Do not modify foundation globals/page.
