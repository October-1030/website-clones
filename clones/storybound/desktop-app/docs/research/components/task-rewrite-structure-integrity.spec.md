# Task Rewrite Structure Integrity Specification

## Overview
- **Target files:** `server/pipeline-integrity.mjs`, `server.mjs`, `src/lib/rewrite-integrity.ts`, `src/components/TaskCreateForm.tsx`, `src/components/TaskBuilder.tsx`
- **Reference task:** `4f56efc6-6b6c-4e9c-bfb2-7ac94aa1f29c`
- **Interaction model:** user selects an input mode, supplies source copy, then Step 2 rewrites it.

## Observed failure
- The source is a numbered opinion/list script about four kinds of self-comfort.
- The Step 2 result introduced a fictional man named Li Qin, Jinan Prefecture, a monk, a temple, marriage and a multi-year life story.
- The task was also persisted as `sourceMode: "ai"` despite having no AI brief and receiving a complete script in the final copy field.
- Existing validation checked field presence and length but did not check whether the rewrite preserved the source content form.

## Required behavior
1. A complete script manually entered in the final copy field while AI creation has no brief is treated as pasted copy.
2. A numbered opinion/list source keeps its thesis → numbered points → conclusion/action structure.
3. Rewriting may make wording more spoken and concrete, but must not invent named people, places, historical identities, dialogue, family events or a complete fictional plot absent from the source.
4. Server validation rejects this form of genre drift and retries the WriterAgent with a specific correction.
5. Existing persisted tasks with a drifting rewrite show a blocking Step 2 integrity issue, so downstream generation cannot proceed unnoticed.

## Acceptance cases
- **Pass:** opinion/list source rewritten as an opinion/list with the same four points and no fictional protagonist.
- **Pass:** a source that already contains a real narrative remains narrative.
- **Fail:** opinion/list source becomes “有个人……他叫……几年后……”.
- **Fail:** opinion/list source gains a monk, village, marriage or other complete story scaffold not found in the source.
- **Provenance:** an AI-generated script remains marked AI when it was generated from a non-empty AI brief; manual complete copy without a brief is marked pasted copy.

## Responsive and visual behavior
- No layout change.
- The existing Step 2 error panel displays the new blocking reason using the current error styling.
