# MusicMVPage Specification

## Overview

- Target: `desktop-app/src/components/MusicMvPage.tsx`
- Evidence: v1.16.1 `MusicMVPage-CjKFs8l8.js`
- Interaction model: music/audio input + storyboard + image generation + timeline

## Required behavior

- Accept local MP3/WAV/FLAC plus user-provided lyrics.
- Keep AI composition clearly optional; without a configured music provider,
  the local-audio route must remain fully usable.
- Style presets: 爱国颂歌, 怀旧经典, 励志奋斗, 田园诗意 and custom.
- Singer choices: any, female, male and duet.
- Confirmation stages: lyrics, grouping, prompts and images.
- Split lyrics into groups, edit/merge/delete/add groups and preserve order.
- Generate one prompt and one MiniMax image per group.
- Batch regenerate selected images and bulk import numbered local images.
- Align groups to real audio duration; allow timeline-only rerun without new images.
- Produce a real MP4/slideshow and a Jianying-compatible output package.
- Cover poster supports generated or local image and selected cover.
- Persist state and generated artifacts. Never mark output complete without files.

## Visual contract

- Dense task workbench matching the global Storybound shell.
- Storyboard gallery shows image, lyric group, prompt, duration and status.
- Selected/busy/failed states use brand, info and danger tokens.

