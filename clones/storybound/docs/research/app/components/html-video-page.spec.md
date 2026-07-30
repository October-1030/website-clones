# HtmlVideoPage Specification

## Overview

- Target: `desktop-app/src/components/HtmlVideoPage.tsx`
- Evidence: v1.16.1 `HtmlVideoPage-HBXz31xy.js`
- Interaction model: real seven-stage generation workflow

## Pipeline

1. 改写 + 分句 — 口播版 + 切分场景.
2. 场景规划 — select layout/title/subtitle/prompt per scene.
3. 素材（图片） — background and transparent foreground assets.
4. 配音 — per-scene TTS using the selected voice and actual duration.
5. 动画预览 — real browser-rendered scene preview.
6. 出片 — render frames and encode MP4 with ffmpeg.
7. 草稿 — save task manifest and downloadable deliverables.

## Required behavior

- Paste text or use AI rewrite through configured LLM.
- Layout presets include center focus, person focus, left/right text-object,
  top-object-bottom-text, three-float, split compare, quote card,
  full image, full quote, grid four, rule of thirds and data emphasis.
- Caption styles: classic outline, translucent/solid pill, gradient,
  neon, karaoke, per-word highlight.
- Caption animations: pop, rise, bounce, wipe, reveal, breathe, typewriter.
- Generate real MiniMax scene images and MiniMax TTS; no timers pretending completion.
- Per scene: edit title/caption/prompt, regenerate/replace/delete assets,
  replay and previous/next.
- Preview must use actual generated images/audio and render the selected layout.
- MP4 output must exist and be playable before the stage becomes complete.
- Cancel preserves generated assets; continue reuses existing work.
- Persist task state and failures locally.

## Visual contract

- Configuration page max-width 1000 px with 28 px padding.
- Running workbench: 320 px step rail + flexible content.
- Preview: phone stage plus 300 px scene strip; stack below 920 px.

