# Workspace

Target src/components/Workspace.tsx; reference original-desktop.png and original-mobile.png.
Six layout regions in PAGE_TOPOLOGY.md. Exact element metrics saved in desktop-dom.json. Header60px,#f1f4f7; sidebar150px,#f8fafc; nav46px rows with20px source SVG icons; body14px/22.4px; active#55759b. Alert45px,#e7f0fb, title16px/19px. Main padding/gap16px; footer20px and12px muted text.
Interaction: click sidebar collapse150→64 with300ms width transition; dismiss alert; top buttons open dialogs; palette opens appearance. Source user account remains external. Icons extracted into icons.tsx; public favicon in /seo/favicon.ico replaces personal avatar.
Mobile<768: no sidebar/footer/title; bottom62px nav 作品/创意/工作流/剧本/更多; alert62px. Tablet768: sidebar retained, community hidden. Text comes from recorded original page. No scroll-dependent styling.
