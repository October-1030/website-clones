# Cover Generation Specification

## Overview
- **Target files:** `desktop-app/src/components/TaskBuilder.tsx`, `desktop-app/server.mjs`, `desktop-app/server/cover-compositor.mjs`
- **Original evidence:** Storybound v1.17.0 advertises Jimeng + all-purpose drawing as its image engines; MiniMax is presented for LLM/TTS. The original titled-cover mode sends the selected cover template, main title, and subtitle lines to its image provider.
- **Interaction model:** task configuration followed by an asynchronous image-generation step.

## Required states

### Original provider route
- Jimeng, all-purpose drawing, and custom compatible image providers receive the complete original template prompt.
- The provider may render the title text directly, matching the original product behavior.

### MiniMax compatibility route
- MiniMax image-01 generates a clean cover background without any readable text.
- The selected original cover template then renders the exact saved main title and up to two saved subtitle lines over that background.
- The user-visible label must disclose this as `MiniMax 底图 + 原版模板排字`, not `MiniMax 直出`.
- Rendering must not spend another image-generation request after the background is available.

## Text contract
- Main title source: `task.artifacts.rewrite.title`, falling back to `task.title`.
- Subtitle source: `task.artifacts.rewrite.subtitle`, preserving the first two non-empty lines.
- Text must be exact Chinese text from the saved fields: no inferred wording, no provider-generated glyphs, no Japanese-looking pseudo-text, no missing line.

## Template contract
- `typographic-impact`: oversized high-contrast yellow main title, two centered white subtitle lines, darkened title zone.
- Other templates retain their selected template identity and use deterministic text placement appropriate to that template.
- Cover dimensions must respect the selected ratio; 3:4 renders at 1080×1440 and 9:16 at 1080×1920.

## Failure behavior
- If deterministic title rendering fails, the cover generation result must fail with an explicit error. It must never be marked `ready` with missing titles.
- The clean MiniMax background should be kept as a source backup for diagnosis and re-rendering.

## Verification
- TypeScript check and production build pass.
- A known 3:4 cover renders the exact main title plus both subtitle lines.
- The resulting image is visually inspected at phone-thumbnail scale.
