# PersonAssetsPage Specification

## Overview

- Target: `desktop-app/src/components/PersonAssetsPage.tsx`
- Evidence: v1.16.1 `PersonAssetsPage-DzSk3uTe.js`
- Interaction model: local CRUD + drag/drop + clipboard import

## Required behavior

- Header: `素材库`
- Explain that true photos can be reused for historical figures, public figures and products.
- Search by asset/person name.
- Create, rename and delete groups.
- Each group is a local folder-like record and stores ordered images.
- Import JPEG/PNG/WebP through file picker and drag/drop.
- Paste image from clipboard when the browser exposes it.
- Reorder images by drag/drop.
- Delete individual images and whole groups with confirmation.
- Persist metadata and image data locally. Refresh must preserve the catalog.
- Display group count and image count.
- Show the original copyright/portrait-right warning.
- Empty state CTA: `新建第一组素材`.

## Visual contract

- 240-280 px group rail and responsive image grid.
- Use elevated cards, 8 px radii, 1 px borders and original brand hover states.
- Mobile stacks the group rail above the image grid.

