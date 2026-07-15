# TaskBuilder Specification

## Overview
- Target: `desktop-app/src/components/TaskBuilder.tsx`
- Screenshot: `docs/design-references/app/home.png`
- Interaction model: form controls, chip selectors, asynchronous pipeline execution with a real TTS step

## Form Sections
- Page header and missing-credentials warning.
- 文案: title, source mode, textarea, video form, content track.
- 高级选项: execution mode, pause preset, rewrite intensity, POV and length targets.
- 出图: material source, dynamic storyboard, style, draft template, ratio, cover.
- 配音: voice source/provider/speaker/speed/BGM.
- Sticky footer action bar with draft/save/start actions.

## Verified choices
- Execution modes:
  - `auto`: 全自动 · AI 改写 + 智能分句.
  - `semi_auto`: 半自动 · 不改写，AI 智能分句.
  - `direct`: 直接出片 · 不改写，按空行机械切.
- Pause presets: 不暂停、关键节点、每步确认、自定义.
- Video forms: 旁白视频 and 双人播客.
- Tracks include 人物故事、健康图书、传统文化、绘本故事、电商带货、心灵鸡汤、民间故事、通用故事、美食探店V2.

## Pipeline Execution
- Seven ordered steps: 文案预审、智能改写与封面生成、影视分镜分句、生成绘图提示词、批量生图、TTS配音、生成剪映草稿.
- Auto starts at 0; semi-auto marks 0 and 1 skipped; direct marks 0, 1 skipped and labels step 2 mechanical split.
- Non-provider steps advance every ~700ms for demo; pause stops at selected checkpoints.
- Step 6 uses the configured MiniMax or Volcengine provider to synthesize the actual task copy.
- A TTS failure pauses the pipeline on step 6 with “检查设置” and “重试本步骤” actions.
- A successful response displays an audio player, segment count, byte size and MP3 download action before step 7.
- Cancelling an in-flight TTS request aborts it; rerunning from step 6 replaces the old object URL.
- User can cancel, continue, edit step output and rerun from a completed step.
- Persist draft/task list in localStorage for this first implementation.

## Visual Styles
- Page max-width 1180px; 42px 44px bottom padding.
- Cards use dark raised surface, subtle 1px border, 10–12px radius.
- Chip selectors are 12–13px; selected state uses green border/background.
- Warning banner uses amber border/background.
- When TTS is ready, the warning banner switches to green and identifies only the safe credential source filename.
- Bottom actions remain visible while scrolling.

## Podcast State
- Show image mode and speaker pair controls.
- Hide normal speaker and speed controls.
- Semi/direct display the verified `[A]` / `[B]` dialogue-format warning.

## Responsive
- Two-column choice groups collapse under 760px.
- Sticky footer becomes a wrapping row on narrow widths.
