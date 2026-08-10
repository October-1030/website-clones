# Image Provider Three-Route Specification

## Overview
- **Target files:** `src/components/TtsSettingsPage.tsx`, `src/components/TaskCreateForm.tsx`, `src/components/PlaygroundPage.tsx`, `src/components/TaskWorkbench.tsx`
- **Reference:** `docs/design-references/image-providers-before.png`
- **Interaction model:** click-driven provider tabs and task/per-shot selectors

## Evidence and Scope
- The original public Storybound page explicitly advertises `即梦 + 全能绘图双引擎` and portrait-reference support.
- The independent clone must preserve the original `即梦` and `全能绘图` branches as separate names and add `MiniMax` as a clearly labelled third route.
- `全能绘图` is an original private service label. The independent clone implements its user-owned equivalent through configurable OpenAI-compatible image-generation credentials and must not claim connection to the author's private backend.
- Existing MiniMax credentials remain server-side and are never copied into the new provider fields.

## Required States and Behavior

### Settings / AI Drawing
- Provider order: `即梦`, `全能绘图`, `MiniMax`, `RunningHub`, `魔搭社区`, `自定义平台`.
- Selecting a tab makes that provider the current global image route and shows only its configuration card.
- `即梦` exposes Ark base URL, Seedream model, session-only API key, and concurrency.
- `全能绘图` exposes an OpenAI-compatible base URL, model, session-only API key, and concurrency, with a visible private-backend boundary notice.
- `MiniMax` uses the existing locally resolved credential and model `image-01`; it no longer appears under the `全能绘图` label.
- Provider test actions must never report success solely because a branch exists. MiniMax may use the local credential status; configurable providers report configuration completeness and direct users to a one-image real test.

### New Task
- The image engine control exposes `即梦 Seedream`, `全能绘图`, and the newly added `MiniMax image-01`; the pre-existing `自定义平台` route remains available to avoid a regression.
- The selected engine is persisted in the task options, so reopening a task does not silently switch to the latest global setting.
- The global session selection follows an explicit task-form click for convenience.

### Prompt Workbench
- Every shot may optionally override the task provider with `跟随任务`, `即梦`, `全能绘图`, `MiniMax`, or `自定义平台`.
- Mixed-provider prompts are grouped by provider and returned in original shot order.
- Generated image cards display the actual provider used.

### Drawing Playground
- The same three primary routes are visible and selectable, alongside the retained custom-provider route.
- Labels, progress text, reference-image notes, and errors use the selected provider name rather than hard-coded MiniMax wording.

## Server Contract
- MiniMax continues to use `/api/images/minimax/generate` and local credential resolution.
- JiMeng uses the official Ark-compatible `/images/generations` contract with a configurable Seedream model.
- All-purpose drawing uses the same safe HTTPS/OpenAI-compatible adapter with its own independent credentials.
- Reference images are sent only to providers configured for the `image` reference parameter and only for shots whose `useReference` flag is true.
- A forced redraw must bypass checkpoint reuse; ordinary pipeline retry may reuse an existing same-provider artifact.

## Responsive Behavior
- Existing tab wrapping and mobile segmented-control wrapping remain unchanged.
- Provider selectors use existing controls and tokens; no new desktop-only layout is introduced.

## Verification
- TypeScript and production build pass.
- Browser shows six settings tabs with MiniMax independent from 全能绘图.
- New-task and playground controls show the same three primary providers.
- Switching providers updates selected state without triggering a paid generation.
