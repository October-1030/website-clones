# PromptTemplatesPage Specification

## Overview

- Target: `desktop-app/src/components/PromptTemplatesPage.tsx`
- Evidence: v1.16.1 `PromptTemplatesList-CyqLFI5U.js`
- Interaction model: local CRUD + JSON import/export

## Required behavior

- Header: `提示词模板`
- Two sections: `系统模板` and `我的模板`.
- System templates are read-only and cloneable.
- Custom templates support create, edit, duplicate, delete, import and export.
- Template fields: name, base track, rewrite prompt, metadata prompt,
  segmentation prompt, image prompt and version.
- Imported files validate `kind`, `template`, `name` and `baseTrack`.
- Export format is a portable Storybound-clone JSON document with schema version.
- Persist custom templates locally and prevent destructive overwrite without confirmation.
- The independent clone has no subscription gating.
- Show a clear badge that these are local templates and do not connect to the original marketplace.

## Visual contract

- Filter/search row and card grid.
- Template cards expose base track, version, source badge and edit/export actions.
- Editor may use a modal or full-width inline panel; textareas use monospace.

