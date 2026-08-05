# Network Material + RunningHub Specification

## Overview

- Target files: `src/components/TaskCreateForm.tsx`, `src/components/TtsSettingsPage.tsx`, `src/components/TaskWorkbench.tsx`
- Interaction model: click-driven configuration followed by asynchronous pipeline execution
- Original evidence: Storybound v1.17.0 exposes `网络素材` and `动态分镜` branches; the independent build uses the same branch positions but replaces the author's private services with user-owned providers.

## Network material branch

- Selecting `网络素材` keeps the original material-source branch and hides AI cover generation.
- Step 4 calls the user's configured M3 model once to produce concise Chinese/English search terms and once to rank Wikimedia Commons candidates.
- Named real people are strict: a result is rejected unless title/description contains the exact subject and the model confidence is at least 0.55.
- Only HTTPS bitmap assets with reusable Public Domain, CC0, CC BY or CC BY-SA metadata are accepted.
- Every downloaded file stores title, creator, source URL, license, license URL, attribution, matching reason and confidence.
- `stock-license-manifest.json` is written into the task and stock attribution is copied into `storybound-manifest.json`.
- Missing or uncertain results remain failed cards; the pipeline does not silently substitute a visually similar person.
- Manual image upload and adjacent-shot borrowing remain available as explicit fallback actions.

## RunningHub branch

- Settings accepts a session-only API Key or server-side `RUNNINGHUB_API_KEY`.
- Connection testing uses RunningHub's account-status endpoint and does not start a paid generation task.
- Supported Standard API models:
  - Hailuo 2.3 Fast, fixed 6 seconds.
  - Hailuo 2.3 Fast Pro, fixed 6 seconds.
  - PixVerse V6, 5–15 seconds based on real narration or fixed target duration.
- Dynamic generation runs only after the real TTS timeline exists.
- The selected `前 3 张 / 全部 / 自定义 N` shot images are uploaded through `/openapi/v2/media/upload/binary`, submitted to the selected image-to-video endpoint, polled through `/openapi/v2/query`, downloaded, probed and written back by `shotId`.
- Provider audio is disabled; narration remains the authoritative audio track.
- Failed dynamic shots retain their static image and show the provider error. Draft packaging uses only ready dynamic videos.

## Responsive and security behavior

- Existing desktop/tablet/mobile layout is unchanged; new settings fields reuse the existing card grid.
- API keys are never returned by status endpoints, written to task JSON, committed to Git, or included in diagnostics.
- Remote stock URLs are restricted to official Wikimedia HTTPS hosts.
- RunningHub results must be HTTPS; file upload is capped at 30 MB per official API limits.

## Verification

- `npm run smoke:providers` validates Wikimedia parsing/license filtering and the complete RunningHub upload → submit → poll → download protocol with deterministic fake provider responses.
- `npm run smoke:stock-live` performs a real M3 + Wikimedia Commons lookup. On 2026-08-05 it selected `Great Wall of China at Juyong Pass at sunset, 20 April 2011.jpg`, downloaded the image, and recorded its CC0 source and license manifest.
- A real RunningHub generation is deliberately not triggered without the user's API Key because it consumes provider credits.
