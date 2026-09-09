# Validation — 2026-09-01

## 2026-09-08 continuation

- Personal long-form reliability pass: chapter edits now keep a lightweight recovery draft immediately and debounce the expensive whole-book write by700ms. Browser verification observed the saving state, persisted a marker, reloaded, reopened the book and found the marker; the marker was then removed and saved.
- The context picker now builds a structured long-novel context from the selected book, related resources, knowledge cards, all available summaries and the endings of the latest3 non-empty chapters. Browser verification produced a205-character context containing the book setting, role fixture and recent prose.
- AI continuation opened from chapter4 now carries chapters1–4 (current plus up to3 preceding chapter endings), and the current book is preselected in the context picker. This browser check stopped before any paid generation request.
- The directory tools now expose batch missing-summary generation and whole-book continuity review. A real MiniMax-M3 request returned S1–S4 summaries; applying the result populated all four matching chapters, persisted them, and changed the missing-summary count from4 to0. Existing/manual summaries are protected by the parser and save path.
- Continuity review input was verified after summary persistence: it included the saved summaries, recent prose and the evidence/“待确认” guard. Its dialog cannot save the report as a novel chapter. No paid continuity-review request was made.
- At390×844 the expanded directory-tools dialog kept document width equal to390 with no horizontal overflow; viewport was reset afterward.
- Backup restoration now rolls back newly inserted IndexedDB image batches if restoring local text data fails.
- `npm run check` passed with no ESLint warnings: strict TypeScript and Next.js production build also passed. `node --test tests/*.test.mjs`: 29 passed, 0 failed.
- Final `npm run check` passed: ESLint, strict TypeScript and Next.js production build. `node --test tests/*.test.mjs`: 19 passed, 0 failed.
- Real MiniMax image generation succeeded. Reopened image history, composed Chinese/English title covers, saved a book cover, applied a generated image to a test role, and saved a chapter illustration.
- Created/managed an isolated test book, exercised home chapter/import/management actions and community close/reopen.
- Personal prompt creation/application verified in the full golden-opening prompt preview.
- Workflow output saved to an earlier chapter and to the last chapter with no target; existing text and illustration survived. A real two-round MiniMax-M3 workflow carried the silver-key story forward, saved rounds as chapters3/4, and restored results/round count from history. After `tab.reload()`, chapter4 still displayed the generated continuation.
- Full backup export UI reported12 local keys and2 image batches. Backup parser and rollback tests pass. Browser upload and backup-file restoration remain unverified; do not equate export with restore verification.
- Current new UI checked at390 and768 pixels for horizontal overflow; image/form workflows also checked on desktop. Temporary viewport override reset. These checks do not establish all-site pixel parity.
- See [detailed completion record and remaining differences](COMPLETION_2026-09-08.md). Full1:1 acceptance remains open.

- `npm run check`: passed (ESLint with no warnings, strict TypeScript, Next.js production build).
- Browser: desktop1440×900 and mobile390×844 compared with inspected original; tablet768px reference inspected.
- First-visit guide, skip, reopening tutorial and creation modal verified.
- Created a local test book, entered a description and 28-character body, saved, reloaded and verified persistence.
- Archived the test book, viewed it under 已归档, restored it and verified it returned to 作品.
- Search for a nonexistent title displayed an empty result and 清空搜索 restored the library.
- Moved the test book into 回收站 and verified the recoverable entry; test book remains in the local recycle bin.
- Switched 黑夜 then 白天; browser computed dark background matched rgb(24,27,34).
- Mobile document width390px at390px viewport: no horizontal overflow; bottom navigation, single-column card and creation dialog checked.
- Extracted source SVG icons; corrected alert fill inheritance, mobile plus-icon size, alert font size and community list spacing during visual review.

Known differences in the initial version: public favicon replaces original account avatar; guide and community use several Lucide icon equivalents; alternate skins approximate observed swatches; community titles are a captured snapshot. The initial textarea editor and navigation notices have since been replaced by the expanded implementation below.

An initial React hydration warning was caused by this browser's extension adding `mpa-version` and `mpa-extension-id` to body. Only body attribute hydration warnings are suppressed; application data uses useSyncExternalStore server/client snapshots.

6 layout sections, 7 interface components with 7 component specs, 40 extracted SVG components, and 1 downloaded favicon. Community builder commit `0c3b8dd` was merged within the isolated builder repository and copied into this project.

## New-book guide submission regression

Reproduced the reported failure via 教程 → 生成黄金开篇第一章 → 提交. The guide passed its click event to the callback; `openCreate(folderId?)` stored that event as the folder ID, so saving failed with `TypeError: Converting circular structure to JSON` and left the dialog open. The earlier homepage-only test did not cover this entry point.

Fixed the guide to invoke its action without arguments. Creation now resolves the folder ID against existing folders, preventing invalid pending state from being serialized. Creation errors are displayed inside the form while keeping it open for retry.

Browser regression checks passed: fresh guide creation, homepage creation, modal closes after successful save, created titles remain after reload, no new console errors after the fix. TypeScript, targeted ESLint and production build passed.

## Golden-opening generator extension

- Inspected original 创意 → 黄金开篇生成器, captured desktop screenshot and DOM. Original paid generation was not submitted.
- All three local entry points verified: guide, library shortcut, creative toolbox. The ordinary 新建作品 dialog remains separate.
- Empty-theme submission shows validation; missing key expands model settings and focuses the key field. No paid request is made in either case.
- Local QA provider used only on 127.0.0.1:3039; separate production app on localhost:3018. The real app on 3017 remains unconfigured. Fixture prose explicitly says it is test content, not an AI result.
- Verified streamed Chinese text, completion, save as a new novel, automatic editor opening and persistence after reload.
- Verified stop after partial output, preserved text, immediate return of retry/save buttons, and successful regeneration after stop. Fixed native click default accidentally resubmitting when the stop button changed to a submit button; cancellation now prevents default and uses separate React keys.
- API checks passed: server configuration, invalid input, cross-origin rejection, missing key (503), successful streaming, upstream authentication failure (502), and interrupted-stream error with retained text.
- Five unit tests passed: prompt context/customization, input bounds, fragmented UTF-8/CRLF stream, upstream cancellation, and cancellation with an additional stream reader.
- Desktop and 390px mobile generator inspected. Mobile has a single column and preset selector, and no horizontal document overflow.
- Final ESLint, strict TypeScript (production build) and Next.js build passed. Real provider output quality was not tested because no real API key was supplied.
- Added two interface components, two component specs, the generation route and prompt/stream utilities. No new external image assets were required. Built-in prompts are locally authored; original community prompts/models are not reproduced.

To repeat HTTP integration checks, run `node scripts/opening-test-provider.mjs`, then start a production build on port 3018 with `WRITING_API_KEY=local-qa-not-a-real-key`, `WRITING_BASE_URL=http://127.0.0.1:3039`, `WRITING_MODEL=local-qa-fixture`. With the unconfigured dev app still on 3017, run `node --experimental-strip-types tests/golden-opening-api.mjs`. Stop both QA processes afterward. Never configure the normal application to use this fixture.

## Expanded local site verification

- All nine secondary navigation pages were opened: creative tools, workflows, script tools, rankings, prompts, knowledge cards, courses, creator center and forum.
- Workflow creation submitted successfully, switched to My workflows and showed the new record. The exact acceptance record was deleted afterward.
- Prompt Run opens the shared AI tool dialog; missing provider credentials produce a visible configuration message before a request.
- Chapter workbench opens existing books, shows normalized legacy content as a first chapter, exposes directory actions and all AI controls.
- Resource sidebar and full character manager were opened; role/term/memo tabs and local form controls were present.
- At 390px the workbench starts in directory view, selecting a chapter enters the editor, and the resource sidebar opens as an overlay.
- Desktop workflow and chapter-editor screenshots were visually reviewed in the browser.
- A distinct tool task mode now prevents non-novel tasks from being forced into the golden-opening output format. Long source material is kept in the tool prompt; short legacy form fields are bounded separately.
- Final lint, strict TypeScript and production build passed after the task-mode fix. All six unit tests passed, including long tool-mode prompt preservation.
- Remote-service and image-generation boundaries are listed in FULL_AUDIT.md; these are not represented as completed source backend functionality.

## MiniMax M3 connection — 2026-09-01

- Configured the user-supplied MiniMax credentials in ignored `.env.local`; no key is in client code or version control. The status endpoint exposes only `configured` and `model`.
- Confirmed `MiniMax-M3` and the OpenAI-compatible request parameters against MiniMax's official documentation. Enabled reasoning separation and disabled thinking for these writing requests.
- Fixed same-origin validation when Next.js binds to `0.0.0.0` but the browser uses `localhost`. An actual localhost Origin now succeeds; an unrelated Origin still returns 403 before a provider call.
- Restarted the local development server with network access after the sandbox returned EACCES for the provider connection.
- Real M3 request through `http://localhost:3017/api/golden-opening`: HTTP 200, 827 text events, 1,941 characters, first text at 1.935 seconds, completed in 34.358 seconds with no truncation warning or thinking tags. Test prose was not saved into the user's books.
- Opened the golden-opening dialog in the browser and verified it automatically displays `MiniMax-M3` without requesting a browser key. The generic tool dialog and workflow runner use the same server configuration and endpoint.
- ESLint, strict TypeScript and production build passed after the integration.

## GitHub export verification — 2026-09-01

- Exported the runnable site, tests, dependency lock, setup example and Markdown specifications into a clean checkout of `October-1030/website-clones` on `codex/xingyue-writing`.
- Excluded real credentials, browser data, logged-in screenshots and raw source inspection dumps. The staged export contains only files under `clones/星月写作/`.
- Installed the exported site's locked dependencies independently with `npm ci --ignore-scripts --no-audit --no-fund`; all six unit tests, ESLint, TypeScript and production build passed with those dependencies.
- Dependency lock generation reported 14 audit findings (2 low, 4 moderate, 8 high). Dependency vulnerability remediation was not included in this upload; these build checks are not a security audit.

## English fiction support

- Added a shared, persistent Chinese / English output-language selector to golden openings, AI tools and workflow runs. Legacy requests without a language continue to default to Chinese; invalid languages fail validation.
- English opening presets, task instructions and the server system prompt now request English prose and English word counts. Workflow history stores the output language for the result count.
- Browser verification: selecting English updates target lengths to `words`, and opening the outline generator retains English. No existing book content was modified.
- Real MiniMax-M3 request with a Chinese story brief and `language: en` returned 1,191 English words in 20.386 seconds, with a completed stream, no truncation warning, no Chinese narration and no thinking tags.
- All nine unit tests, ESLint, strict TypeScript and production build passed. The test passage stays in an ignored local test artifact.

## MiniMax 生图接入（2026-09-05）
- 新增 /api/images 服务端接口，固定调用 MiniMax image-01，密钥不发送浏览器。
- 封面生成器及角色生图入口改用图片表单，支持比例、1–9张、描述优化、预览和下载。
- 使用现有密钥真实调用：1张成功、0张失败，base64解码保存为 .tmp/image-verification/minimax-test.jpg。
- 图片窗口关闭后不保留预览，需下载；自动应用作品封面、角色卡和书名批量试装仍待补齐。

