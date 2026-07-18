# Final Video Production Specification

## Evidence

- Storybound official tutorial, updated 2026-07-16, sections 4.1, 5.4, 5.8, 5.9, 5.10, and 11.
- Installed Storybound 1.13.1 client bundle: Step 6 runner, template editor, cover poster, and dynamic storyboard chunks.
- Extracted `draft-generator` sidecar and a controlled five-shot Jianying baseline generated from the original binary.

## Official completion contract

The finished product is a native Jianying draft visible in Jianying's draft list without importing media manually. It must contain aligned images or dynamic videos, narration, captions, background, image animation or camera motion, optional BGM, and the four original text tracks. The user may make final adjustments in Jianying before export.

## Timeline and tracks

- The primary timeline follows measured narration audio, not a guessed target duration.
- Each shot image/video target range equals its narration segment range.
- The narration track uses the same segment boundaries as the shots.
- Captions are split inside each narration segment according to the template maximum and receive proportional, continuous sub-ranges.
- Text track names and roles are:
  - `cover_title`: editable main cover title, complete-draft duration.
  - `cover_subtitle`: editable cover subtitle, complete-draft duration.
  - `subtitle`: spoken captions split across the narration timeline.
  - `cover_disclaimer`: bottom AI/source disclaimer, complete-draft duration.
- Optional template frame/background layers sit below `image_main`; borders and overlays sit above it.
- BGM is a separate audio track, fills the draft duration, uses template volume, and fades out at the configured end duration.

## Template runtime

- Canvas: width, height, ratio, color, and optional background image.
- Image area: ratio, `cover`/`contain`, top, height, animation pool, camera-motion pool, and motion strength.
- Text layers: visibility, x/y, font size, colors or gradients, alpha, weight, underline, alignment, letter spacing, line spacing, border, caption background, and disclaimer text.
- Frame: top/bottom visibility, solid/gradient colors, image-border color/width/sides.
- Audio: narration volume, BGM volume, BGM fade-out, and template default BGM.
- A motion pool takes priority over entrance animation. Motion is implemented with Jianying keyframes. The original applies a short fade-in to the first moving visual and fade-out to the last moving visual.

## Cover behavior

- Cover generation has titled and blank modes, selectable templates/ratios, optional second cover, and protagonist reference consistency.
- A valid AI cover poster is written as the Jianying draft cover.
- When an AI cover poster is active, `cover_title` and `cover_subtitle` remain editable but their clip alpha is zero.
- Without an AI cover poster, title/subtitle remain visible. The official manual workflow is: choose a suitable frame, temporarily hide caption/disclaimer, create the cover, then hide title/subtitle again before export.
- Cover prompt/text changes can regenerate only the cover without rerunning the full task.

## Dynamic storyboard

- The first N selected storyboards may be converted from still images to real video.
- Duration policy is either narration-exact or fixed seconds per shot.
- Under fixed-duration mode the draft packager compensates any gap so the target shot range remains aligned to narration.
- Successful video files replace only their matching still-image segments. Failed or unavailable videos fall back to still images.
- Borrowed neighbor images are skipped for automatic dynamic generation.
- Background generation does not block other work. After all videos finish, a new video-version draft is built; the old image-version draft is removed only after the new draft lands successfully.

## Repack and editing

- Cancel preserves completed intermediate assets.
- Continue resumes from the interrupted step.
- Rerun from a selected step discards only downstream results.
- Repack reruns only the draft-packaging step using current disk images/audio/template/BGM.
- Gallery edits support per-shot redraw, prompt edit, local replacement, copy/paste/borrow, drag reorder, batch import, cancellation, and per-shot image-to-video.
- Repack writes a new draft folder. If replacing a dynamic image-version draft, deletion is constrained to the configured Jianying draft root and happens only after success; in-place folder recreation is forbidden because Jianying caches opened drafts.

## Acceptance matrix

- A five-shot narration produces five continuous visual and narration segments with equal corresponding target ranges.
- Caption ranges cover each source narration segment continuously and never exceed the template's visible-character maximum, except attached terminal punctuation where applicable.
- Default portrait output contains the four named text tracks at their original template positions.
- AI-cover output has a valid draft cover and zero-alpha title/subtitle clips; non-AI-cover output retains visible title/subtitle clips.
- `contain` and `cover` produce distinct crop/scale transforms without stretching.
- Animation arrays cycle deterministically across shots; camera-motion arrays create Jianying keyframes and take priority.
- First/last moving visuals contain alpha fade keyframes.
- Optional BGM reaches the exact draft end and has the configured fade-out reference.
- Dynamic-video shots use video materials and preserve narration target ranges; failed video shots remain still images.
- Repack after an image, caption, template, BGM, or cover change updates the Jianying draft without rerunning TTS or image generation.
- Build, typecheck, task lifecycle smoke test, and original-generator parity probes pass.
