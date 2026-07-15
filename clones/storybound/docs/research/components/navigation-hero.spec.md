# Navigation and Hero Specification

## Overview
- Target: navigation and hero inside `StoryboundLanding`
- Screenshot: `docs/design-references/storybound-original-desktop.png`
- Interaction model: sticky anchors + mouse parallax/sparks

## DOM structure
- `.nav > .wrap.nav-inner` with logo, `.nav-links`, `.nav-actions`.
- `.hero` with atmospheric layers, `.hero-inner`, announcement, `h1`, copy, CTAs, proof row, and `.hero-shot` product mockup.

## Computed styles
- Navigation: 1440×64.8px, `position: sticky`, `top: 0`, `z-index: 100`, background `rgba(10,32,23,.72)`, blur 20px.
- Hero desktop: 1440px wide, 1349.65px high, padding `120px 0 100px`, minimum height 760px.
- Headline desktop: Noto Serif SC 104px/109.2px, weight 700, 1.04px letter spacing, 1152px wide.
- Supporting copy desktop: 640px max width, 19px/30.4px, `rgba(255,255,255,.55)`.
- Mobile hero: 390px wide, 820.2px high, padding `50px 0 70px`.
- Mobile headline: 54px/56.7px and 342.4px wide.

## States and behavior
- Navigation links transition color over 150ms.
- Hero mousemove changes inline transforms on `.hero-orbs` and `.hero-scene`.
- Mouse movement creates `.spark` nodes; animation is `spark-life 1300ms`.
- Under 980px, `.nav-links` and `.hero-shot` are hidden.

## Text content
- `v1.13.1 · 出图超时能捞回 + 历史任务收藏`
- `一句话，一段故事，一键成片`
- `AI 帮你把文案变成视频，从分镜到剪映草稿全自动。`
- CTAs: `立即下载 Windows`, `Mac 下载`.

## Assets
- Hero scene is an inline data-SVG; all product mockup icons are inline SVG.

