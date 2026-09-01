# 必火 GEO page topology

Inspected 2026-08-31. Requested URL: https://geo.bihuogeo.com/#/dashboard.
Initially redirected to #/auth/login. The user subsequently authenticated in Chrome, making the requested dashboard visible. The dashboard was then inspected from its rendered DOM and public CSS/assets.

## Dashboard

148px sidebar, 60px sticky topbar, scrolling main area. Content min-width900px/max-width1760px; mobile<=800px switches to a drawer and document scrolling. Section gap24px, top padding24px.

1. Data overview: workbench heading/company scope/date; root question metric splits into content production and visibility monitoring; platform-share empty state.
2. Workflow: preparation/content/publishing/indexing, 10 linked steps.
3. Index analysis: eight platform tabs with observed zero values and empty source ranking.
4. Monthly trend: observed empty matrix.
5. Downloads and help footer.
6. Four-stage tutorial and optional assistant side panel.

Local default and #/dashboard render the dashboard. Company and GEO project pages provide a browser-local CRUD workspace. Every observed sidebar destination and workflow route now renders a named local workspace, but these simplified pages do not reproduce the source backend workflows.

## Authentication

1. Full-viewport fixed background: one original PNG containing the gradient, logo, slogan and six AI platform icons. Cover, center, no repeat.
2. Form container: right 36% of desktop, left padding 40px, vertically centered. Below/equal 768px, full width, padding 0 20px, horizontally centered.
3. Glass form panel: login or phone registration, same shared structure.
4. Footer: fixed at bottom 20px, visible on login only.

Authentication content is static or click-driven, without page scrolling. Dashboard uses main-panel scrolling on desktop, document scrolling on mobile, and a subtle entry reveal animation.
