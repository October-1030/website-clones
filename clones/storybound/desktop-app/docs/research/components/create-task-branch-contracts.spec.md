# Create Task Branch Contracts

## Overview

- **Target files:** `src/components/TaskCreateForm.tsx`, `src/components/task-builder-model.ts`, `src/components/TaskBuilder.tsx`, `server.mjs`, `server/draft-builder.mjs`
- **Original evidence:** Storybound 1.17.0 active desktop bundle, `original-prompt-library.json`, and the public product page at `https://storybound.cc/`
- **Interaction model:** click-driven nested form; each visible selection must be persisted and consumed by the matching pipeline branch
- **Acceptance rule:** a branch is complete only when its value is visible, persisted, restored, executed, and represented correctly in the final task or draft. A visible button alone is not a pass.

## Original Track Contract

| Track id | Visible name | Reference kind | Character card | Default style | Runtime invariant |
| --- | --- | --- | ---: | --- | --- |
| `character-story` | 人物故事 | character | yes | 黑白摄影 | Biography identity and age-stage consistency; mix subject and environment shots |
| `health-book` | 健康图书 | product | no | 油画风格 | Uploaded book/food/tool reference is used only when that product appears |
| `culture-knowledge` | 传统文化 | product | no | 古风电影 | Uploaded cultural-object reference preserves the same object across scenes |
| `picture-book` | 绘本故事 | character | yes, forced | 皮克斯 3D | Fictional character identity is consistent; never inherit biography rules |
| `ecommerce` | 电商带货 | product | no | 写实彩色 | Product is the visual subject; uploaded product reference must not become a face reference |
| `inspirational` | 心灵鸡汤 | character | no | 现代电影 | Preserve the generated scene prompt; no historical-period injection |
| `folk-tale` | 民间故事 | character | yes | 民间故事工笔风 | Character card follows the story dynasty and role; no biography-only 62% empty-shot quota |
| `general` | 通用故事 | character | no | 写实彩色 | Generic fallback; do not impose a fixed protagonist or historical era |

## Public Branch Matrix

| Group | Values / states | Persistence | Required consumer |
| --- | --- | --- | --- |
| Source | `paste`, `ai` | task root | AI creation or supplied-copy path |
| Video form | `narration`, `podcast` | task root | single narration or A/B podcast timeline |
| Execution | `auto`, `semi_auto`, `direct` | task root | start step and LLM bypass rules |
| Pause | `none`, `key`, `every`, `custom` | task root | deterministic pause gate; disabled skipped steps removed |
| Rewrite | `standard`, `deep`, `rewrite` | options | WriterAgent instruction |
| Point of view | `original`, `first`, `third` | options | WriterAgent instruction; hidden on original unsupported tracks |
| Promotion | off/on, ecommerce forced on | options | WriterAgent instruction |
| Fixed intro | off/account/lock + 1–20 sentences | options | source split and final narration composition |
| Outro CTA | off/on + local library | options | final narration composition |
| Targets | length/scenes | options | WriterAgent/storyboard context; never stretch audio |
| Materials | `ai`, `stock`, `local` | options | image generation, licensed search, or local matching |
| Image provider | `jimeng`, `all-purpose`, `minimax`, `openai-compatible` | options | provider router only when materials=`ai` |
| Ratio | `9:16`, `4:3`, `1:1`, `16:9` | task root | image requests and draft canvas/template contract |
| Dynamic storyboard | off/first 3/all/custom; narration/fixed duration | options | RunningHub only for AI+narration |
| Cover | off/titled/plain/local + optional second cover | options | independent publishing posters, not timeline title overlays |
| Voice | TTS/external; provider, voice, speed | options/media | segmented, continuous, external, or podcast audio timeline |
| BGM | builtin/uploaded/off | options/media | independent audio track, volume and end fade |
| Draft template | none/builtin/custom | options | draft builder canvas, captions, overlays, motion and audio |

## Track Routing Rules

1. The provider prompt must preserve the selected track's generated scene prompt.
2. Biography-only Yu Youren and Republican-era compactors may run only for `character-story`.
3. `picture-book` uses its dedicated character/reference/composition policy.
4. `folk-tale` uses the LLM's per-shot character presence; it must not inherit the biography empty-scene quota.
5. Product tracks use a product/object reference prompt and never a face-identity prompt.
6. Tracks without a reference in the current shot send no `subject_reference`.
7. Cover prompts remain the selected original cover-template prompts; the deterministic compositor adds Chinese title/subtitle text after background generation.

## Responsive Behavior

- **Desktop 1440:** all cards and nested controls are reachable without horizontal overflow.
- **Tablet 768:** cards stack where needed; all branch labels remain visible.
- **Mobile 390:** sidebar collapses; controls wrap without clipping; no branch becomes unreachable.

## Verification

- Static contract test enumerates every public value and checks round-trip persistence.
- Pure runtime policy test exercises all eight tracks and rejects cross-track terms.
- Browser sweep clicks every track and every nested state without starting paid generation.
- Typecheck, lint and production build must pass.
