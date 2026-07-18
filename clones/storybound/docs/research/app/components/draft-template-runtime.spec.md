# Draft Template Runtime Specification

## Overview

- **Target files:** `desktop-app/original-draft-templates.json`, `desktop-app/server/draft-builder.mjs`, `desktop-app/src/components/TaskCreateForm.tsx`
- **Evidence source:** Storybound 1.13.1 local SQLite table `draft_templates`, task table schema, bundled sentence-split prompt, and Jianying output QA.
- **Interaction model:** form-driven template selection plus time-driven Jianying tracks.

## Original data model

- The original task table stores `target_length`, `target_scenes`, `tts_speed`, `video_intro`, `video_intro_duration`, `cover_image_mode`, `cover_template_id`, `cover_ratio`, `template_id`, and `bgm_id`.
- Final narration duration follows the real TTS audio. `target_length`, `target_scenes`, and `tts_speed` are the upstream controls; `video_intro_duration` only controls the optional intro.
- `cover_image_mode` is independent from `video_intro`: a titled cover must not become a full-video title track.
- Draft templates store complete canvas, image, title, subtitle, caption, disclaimer, audio, and frame configuration objects.

## Built-in templates

### default-portrait-9-16

- Canvas: 1080 × 1920, black, 9:16.
- Image: full canvas, cover fit, zoom motion.
- Intro title: x 0, y 0.0473958333, size 25, yellow `#FFDE00`, bold, underlined, centered, black border width 40.
- Intro subtitle: x 0, y -0.2166666667, size 12, white, letter spacing 2, line spacing 4, black border width 40.
- Caption: x 0, y -0.2151041667, size 12, yellow, maximum 12 characters per line, black background alpha 0.5, radius 0.3.
- Disclaimer: x 0, y -0.903125, size 8, white alpha 0.26, two lines.
- Audio: narration 10, BGM 3, BGM fade-out 2000 ms.

### builtin-portrait-4-3

- Canvas: 1080 × 1920; image top 0.2890625, height 0.421875, 4:3 cover fit.
- Title: y 0.8357783211, size 20, yellow.
- Intro subtitle: y 0.5953125, size 12, white.
- Caption: y -0.5572916667, size 12, yellow, maximum 12 characters.
- Disclaimer: y -0.8141628913, size 8, white.

### builtin-landscape-16-9

- Canvas: 1920 × 1080; image full canvas, 16:9 cover fit.
- Title: y 0.1277777778, size 20, yellow.
- Intro subtitle: y -0.4333333333, size 8, white.
- Caption: y -0.6425925926, size 8, yellow, maximum 12 characters.
- Disclaimer: y -0.8787037037, size 5, white alpha 0.5.

### builtin-knowledge-card

- Canvas: 1080 × 1920, background `#0a1430`.
- Image: square, top 0.24, height 0.5, zoom-in motion.
- Title: y 0.84, size 27, white, bold.
- Intro subtitle: y 0.68, size 27, orange `#FF7A18`, bold.
- Caption: y -0.78, size 20, white, bold, maximum 14 characters.
- Frame enabled with blue header, black footer, and a 6 px gold image border.

## Track behavior

- Image segment durations follow real TTS segment durations.
- Caption text is split using `caption.maxCharsPerLine`, removes split punctuation, uses Jieba for overlong clauses, and divides each source-audio interval proportionally by visible character count without gaps.
- The original draft contains four text tracks: `cover_title`, `cover_subtitle`, `subtitle`, and `cover_disclaimer`.
- `cover_title`, `cover_subtitle`, and `cover_disclaimer` span the complete narration duration when enabled by the template.
- `videoIntro` is the original dynamic-storyboard option (image-to-video for the first N shots). It is not a title-card duration control.
- Without an AI cover poster, `cover_title` and `cover_subtitle` remain visible so the user can create a Jianying cover from a chosen frame; the official workflow then asks the user to hide those two tracks before export.
- With a valid AI cover poster, the poster becomes the Jianying draft cover and the title/subtitle track alpha is forced to zero. The tracks still exist for later editing.
- Disclaimer follows template visibility and spans the narration duration.
- BGM uses the template volume, fills the full narration duration, and applies the configured fade-out.
- Text material uses template color, alpha, bold, underline, alignment, letter spacing, line spacing, border, and background values.

## Storyboard behavior

- Original sentence splitting is visual-semantic, not a subtitle split.
- Recommended shot text length is 25–45 Chinese characters, hard maximum 55.
- Maximum storyboard size is 60 shots.
- A fallback splitter must use 45 characters and never the previous 85-character / 18-shot approximation.

## UI requirements

- Expose target text length and target scene count as original controls.
- Explain that final duration follows text length, TTS speed, and real audio.
- Label the original `videoIntro` field as dynamic storyboard, with a count and duration policy, rather than presenting it as a title card.
- Expose AI-cover mode independently from dynamic storyboard mode.
- Display the selected template’s actual caption maximum, size, color, position, and background alpha so the user can inspect what will enter Jianying.
- Do not show a fake target-duration control that the runtime ignores.

## Acceptance

- Default portrait tasks produce captions of at most 12 visible characters plus terminal punctuation.
- A draft always contains title/subtitle tracks when those template layers are enabled.
- Without an AI cover poster, enabled title/subtitle tracks span the full draft and retain template alpha.
- With an AI cover poster, enabled title/subtitle tracks span the full draft but have clip alpha zero.
- Dynamic storyboard replaces only the configured first N image segments with generated video while preserving the narration-aligned target ranges.
- Default template output has a disclaimer track and uses real audio duration.
- Fallback storyboard output respects 45-character chunks and up to 60 shots.
- Build, lint, and task smoke tests pass.
