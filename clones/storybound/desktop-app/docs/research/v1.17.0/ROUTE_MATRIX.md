# Storybound v1.17.0 route and fidelity matrix

Evidence captured 2026-08-02 (America/Los_Angeles).

- Public installer: `C:\tmp\Storybound_1.17.0_x64-setup.exe` (150,865,092 bytes). It was statically extracted and never executed.
- Current entry: `.tmp/storybound-1.17.0-assets/index.html` -> `assets/index-B_XgV9A-.js` + `assets/index-Drc-tGGR.css`.
- Current active chunks were selected from the entry dependency graph; older same-name chunks bundled in the installer were excluded.

| Route | Active original chunk | Clone surface | Status |
| --- | --- | --- | --- |
| `/create` | `CreatePage-CcjKD9zs.js` | `CreatePage.tsx` | browser-verified: all three creation cards open |
| `/task/:id` | `Task-CwRR678m.js` | `TaskBuilder.tsx`, `TaskCreateForm.tsx`, `TaskWorkbench.tsx` | implemented; real seven-step local pipeline and artifact controls |
| `/history` | `History-Di0OCf2k.js` | `SupportPage.tsx` | browser-verified: status/type/ratio/date/search filters and task actions |
| `/queue` | `Queue-DFDcS_Y5.js` | `SupportPage.tsx` | browser-verified: selection, batch action bar and editable draft states |
| `/batch-summary/:id` | `BatchSummary-_QJehRXa.js` | `BatchSummaryPage.tsx` | local persisted latest-batch summary implemented |
| `/settings` | `Settings-Dx2uvx67.js` | `TtsSettingsPage.tsx` | browser-verified: eight primary sections and five image-provider branches |
| `/templates` | `Templates-DZYnbLSf.js` | `DraftTemplatesPage.tsx` | browser-verified: catalog, canvas/image/text/audio/frame editor and import/export |
| `/templates/:id` | `TemplateEditor-D3BsKS8u.js` | `DraftTemplateEditor.tsx` | editor surface complete; clone keeps editor in the list/workbench route instead of a second screen |
| `/prompt-templates` | `PromptTemplatesList-CUy2w-Dq.js` | `PromptTemplatesPage.tsx` | browser-verified: system/custom filters, import, clone and editor |
| `/prompt-templates/:id` | `PromptTemplateEditor-BB4uvlzy.js` | `PromptTemplatesPage.tsx` | editor surface complete; clone uses an in-page modal instead of a second screen |
| `/playground` | `PlaygroundPage-J58unWXx.js` | `PlaygroundPage.tsx` | implemented; mode sweep pending |
| `/voice-lab` | `VoiceLabPage-DVpoatna.js` | `VoiceLabPage.tsx` | real MiniMax/Volcengine synthesis path implemented |
| `/music-mv` | `MusicMVPage-tEoNtrAc.js` | `MusicMvPage.tsx` | dual-entry hierarchy restored; local audio -> images -> real MP4/Jianying works; original private AI composer remains unavailable |
| `/html-video` | `HtmlVideoPage-1jcx2WCs.js` | `HtmlVideoPage.tsx` | browser-verified six-stage workbench; real H.264/AAC renderer passes smoke |
| `/benchmark` | `BenchmarkPage-Cp01SSnj.js` | `BenchmarkPage.tsx` | Video Accounts contract fixed and smoke tested |
| `/book-selection` | `BookSelectionPage-Bxxhs1YH.js` | `BookSelectionPage.tsx` | browser-verified lists, advanced filters, book editor and task/benchmark handoff; private ranking crawler remains explicit |
| `/person-assets` | `PersonAssetsPage-DYQLYhaB.js` | `PersonAssetsPage.tsx` | route and local group creation surface browser-verified |
| `/market` | `MarketPage-D9joHkMY.js` | `MarketPage.tsx` | browser-verified market/detail/my-market/local install surfaces; private trade/publish remains explicit |
| `/activation` | entry chunk | `LocalAccountPage.tsx` | original hierarchy mirrored with honest unavailable private service state |
| `/account` | `Account-DV30AFUz.js` | `LocalAccountPage.tsx` | original hierarchy mirrored with local API/status separated |

## Hard boundary

Pixel and interaction fidelity can be reproduced from the public desktop assets. Storybound private licensing, payment, points, ranking crawlers and provider-owned services cannot be truthfully made functional without their server contracts and authorization. The clone keeps those branches visible and marks the dependency instead of returning fake success.

## Current objective

The completion gate is not “route opens.” It requires a clean build, API smokes, browser traversal of each route and branch, and a real create-to-image/TTS/subtitle/Jianying artifact run. Any untested or private-service-only branch remains explicitly listed.

## 2026-08-02 acceptance sweep

- All 19 route entries mounted without an application error.
- The image-task nested sweep covered both source modes, narration/podcast, all execution and pause modes, fixed intro/outro, three material sources, four ratios, 13 visual styles, template parameters, dynamic-shot modes, cover modes, MiniMax/Doubao selection, four speeds and both narration structures.
- Settings nested sweep covered all eight sections and JiMeng, universal image, RunningHub, ModelScope and custom-image tabs.
- HTML nested sweep covered copy, material, voice, animation preview, output and history tabs plus scene editing.
- The browser exposed one launch-blocking state bug: MiniMax was auto-selected in `App` after the task form had captured the old provider. `TaskBuilder` now switches to the available configured provider and the launch banner verifies `TTS 与 LLM 已就绪`.
