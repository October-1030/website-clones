# Picture Book Track Specification

## Overview
- **Original target:** `https://storybound.cc/` / `#tracks`
- **Local targets:** `desktop-app/src/components/CreatePage.tsx`, `desktop-app/src/components/TaskCreateForm.tsx`, `desktop-app/server.mjs`
- **Interaction model:** click-driven track selection; the selected track changes the system prompt template and default visual style before the task is persisted.

## Original UI Evidence
- Original card text (verbatim): `绘本故事` / `儿童睡前 · 童话经典`.
- Card: `276px × 150.55px`, `padding: 24px 20px`, `border-radius: 12px`, background `rgb(18, 43, 34)`, border `0.8px solid rgba(255, 255, 255, 0.06)`.
- Title: `16px`, weight `700`, line-height `24.8px`, color `rgb(240, 253, 244)`.
- Subtitle: `13px`, line-height `20.15px`, color `rgba(255, 255, 255, 0.35)`.
- Original page note: every track has its own rewrite strategy, default visual style, and storyboard template.

## Original Runtime Contract
- Track id: `picture-book`.
- Track name: `绘本故事`.
- Description: `儿童绘本 / 睡前故事，可爱角色与梦幻场景`.
- Default visual style: `pixar-3d` / `皮克斯 3D`.
- Character consistency: enabled (`needsCharacterCard: true`, `referenceKind: character`).
- Rewrite prompt: dedicated children aged 3–10 + parent audience rules, short oral sentences, child-safe conflict, four-part picture-book structure.
- Metadata prompt: 4–8 character/topic main title, two 10–16 character child-friendly subtitles, parent-facing summary, mandatory `#绘本故事` and `#亲子阅读` tags.
- Image prompt: fictional cartoon characters, bright dreamlike scenes, strict no-horror/no-violence/no-real-child rule, stable species/color/body/clothing across shots.

## Required Local Behavior
1. The 图文任务 card must visibly include `绘本故事` among its applicable scenarios.
2. Selecting `绘本故事` must select `系统 · 绘本故事` and switch the visual style to `皮克斯 3D`.
3. The server must use the picture-book rewrite, metadata, and image prompts from `original-prompt-library.json`.
4. Picture-book character-reference planning must follow the LLM's per-shot `useReference` decision and actual character presence. It must not force the biography track's fixed percentage of historical empty shots.
5. Picture-book prompts must never pass through the biography-specific Republican-era / archival / old-newspaper prompt compactor.
6. With a character reference, the reference constrains species, colors, body shape, clothing, and markings; it must not copy the reference background.
7. Without a reference, the original per-shot picture-book prompt must still reach MiniMax unchanged in subject, scene, and selected visual style.
8. Cover prompts remain independent from positive-video-shot reference planning.

## Responsive Behavior
- Existing CreatePage card wrapping remains unchanged; the additional `绘本故事` pill uses the existing wrapping tag style at desktop, tablet, and mobile widths.

## Verification
- Browser: original page exposes `绘本故事 / 儿童睡前 · 童话经典`.
- Browser: local task form exposes all eight tracks; selecting `绘本故事` selects `系统 · 绘本故事` and `皮克斯 3D`.
- Automated: `npm run smoke:picture-book` validates prompt routing, reference decisions, and the absence of biography-only prompt text.
- Automated: `npm run smoke:branches`, lint, and production build pass.
