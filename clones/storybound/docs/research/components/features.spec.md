# Features Specification

## Overview
- Target: `#features`
- Interaction model: hover + mouse-follow highlight

## DOM structure
- Section heading followed by four `.feature` cards.
- Each card contains copy/list and a `.feature-visual`; even cards reverse the visual order on desktop.

## Computed styles
- Desktop card: 1152×442.46px, two columns `529.25px 481.15px`, 60px gap, 40px padding, 28px radius.
- Desktop visual: 481.15×360.86px, padding 24px, 18px radius, background `rgba(0,0,0,.25)`.
- Mobile card: 342.4px wide, one 288.8px column, 28px gap, padding `32px 26px`.
- First mobile card height: 682.95px; visual is 288.8×216.6px.

## States and behavior
- Mousemove updates `--mx`/`--my` to position a 600×300px radial highlight.
- Hover changes border from `rgba(255,255,255,.06)` to `rgba(74,222,128,.5)` over 300ms.

## Per-card content
- AI 智能改写 — rewrite viral structure, titles, posts, tags, and seeded comments.
- 批量生图 — ten visual styles with dual image engines and custom styles.
- 多音色配音 — 100+ voices, dialects, voice cloning, and speed controls.
- 剪映草稿导出 — aligned subtitles/audio/images/BGM and native draft packaging.

## Assets
- Ten gallery images at `/users/gallery/gallery-01.jpg` through `gallery-10.jpg`.
- All small icons remain inline SVGs.

