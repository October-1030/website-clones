# BenchmarkPage Specification

## Overview

- Target: `desktop-app/src/components/BenchmarkPage.tsx`
- Evidence: v1.16.1 `BenchmarkPage-DTHChMsh.js`
- Interaction model: account library + link import + local transcript analysis

## Required behavior

- Header: `对标监控`
- Account search placeholder: `搜账号名`.
- Add an account from a pasted public video/share URL or manual account details.
- Group/track assignment, rename, favorite and delete.
- Search filters existing accounts before adding.
- Works list supports filters: all, favorite, created, uncreated.
- Sort options: publish time, likes, favorites, comments, forwards and growth.
- Single-video import stores URL, title, account, counters and local notes.
- Where a media URL is directly downloadable, expose download; otherwise preserve the source URL.
- Accept a local audio/video file and run the clone's existing local/server transcription path when available.
- Transcript actions: copy, edit, mark created, use to create task, Markdown export.
- AI correction and structure analysis call the configured LLM only after explicit button press.
- Persist accounts, works, transcripts and groups locally across refresh.
- Do not scrape authenticated platform pages or claim private platform API access.

## Visual contract

- Desktop: 260 px account rail + flexible works pane.
- Search and account controls remain visible while the works pane scrolls.
- Cards use the original compact 12-13 px metadata hierarchy.
- Mobile stacks rail and content and keeps all actions keyboard accessible.

