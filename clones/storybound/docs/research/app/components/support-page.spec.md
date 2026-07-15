# SupportPage Specification

## Overview
- Target: `desktop-app/src/components/SupportPage.tsx`
- Interaction model: read-only first-stage module shell; history/queue read local demo tasks

## Behavior
- History and queue display cards from `localStorage.storybound_clone_tasks`.
- Other sidebar modules render their verified Chinese title plus a concise description and planned capability chips.
- Keep navigation destinations functional even before each deep module is implemented.
- Empty states use the same dark bordered-card visual language.
