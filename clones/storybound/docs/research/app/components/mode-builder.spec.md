# ModeBuilder Specification

## Overview
- Target: `desktop-app/src/components/ModeBuilder.tsx`
- Screenshots: `docs/design-references/app/html-video.png`, `docs/design-references/app/music-mv.png`
- Interaction model: chip selectors and collapsible form sections

## HTML mode
- Heading: HTML 动画视频.
- Subtitle: 输入文案，AI 自动规划分镜 → 出素材 → 配音 → 生成动画分镜.
- Cards: 文案、出图、画面布局、封面海报、配音.
- Primary choices: AI 改写/直接用原文；生成前景/纯背景图；自动/手动分镜；字幕风格和字幕动效；动态版式/草稿模板；转场；封面模板；TTS voice/speed/BGM.
- Starting a demo shows six stages: 改写+分句、场景规划、素材、配音、动画预览、出片.

## Music MV mode
- Heading: 音乐 MV 混剪.
- Subtitle: AI 写词作曲 + 智能配画面 → 剪映草稿.
- Cards: 歌曲、出图、高级.
- Primary choices: four style presets + custom; voice gender; AI 作曲/本地音乐; AI 绘图/video mix disabled; dynamic storyboard; cover; pause points.
- Starting a demo shows ten stages from lyrics through Jianying draft.

## Visuals
- Match the dark card/chip system used by TaskBuilder.
- Page max-width 1180px, padding 42px 44px 80px.
- Selected chips use mode accent: cyan for HTML, violet for MV.
- Sticky action footer and responsive single column under 760px.
