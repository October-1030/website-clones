# CreatePage Specification

## Overview
- Target: `desktop-app/src/components/CreatePage.tsx`
- Screenshot: `docs/design-references/app/create.png`
- Interaction model: click-driven task type selection; cards have hover lift/glow

## Layout
- Main content starts after 240px sidebar and 63px desktop chrome.
- Wrapper max-width 1080px; padding 52px 40px 60px.
- Header centered; bottom margin 40px.
- Card grid has three equal columns and 20px gap.
- At 1280px runtime, content width is 958.4px and each card is about 306×319.5px.

## Typography
- Eyebrow: green, 13px, semibold, letter-spaced.
- Heading: 34px, heavy, centered.
- Supporting text: 15px muted.
- Card title: 21px, 700.
- English kicker: 12px monospace, muted.
- Description: 13px, line-height about 1.8.

## Cards
- Base: `oklch(0.195 0.009 250)`, border `oklch(0.23 0.008 250)`, radius 22px, padding 26px 24px 22px.
- Image card accent green; HTML card cyan/blue; MV card violet.
- Each card includes icon tile, title, English label, description, three tags, divider, hint and “开始创建 →”.
- Exact visible content must match runtime capture:
  - 图文任务 / Image · Story / 人物故事、健康图书、带货口播.
  - HTML动画视频 / Motion · Code / 知识科普、财商写作、命题创作 / NEW.
  - 音乐MV / Music · Video / 情感氛围、歌词卡点、节日祝福.

## Behaviors
- Hover: translateY(-4px), accent border/glow, 180ms ease.
- Click image → task builder; HTML → HTML builder; MV → MV builder.
- Cards stagger-fade in on first render (20ms, 100ms, 180ms delays).

## Responsive
- Switch to one column below 760px.
- Card minimum height is removed on mobile; preserve 20px gap.
