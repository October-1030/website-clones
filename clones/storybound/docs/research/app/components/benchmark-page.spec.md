# BenchmarkPage Specification

## Overview

- Target: `desktop-app/src/components/BenchmarkPage.tsx`
- Evidence: v1.16.1 `BenchmarkPage-DTHChMsh.js`
- Interaction model: remote single-video parse + account library + optional paid
  account refresh adapter + local transcript analysis

## Original v1.16.1 evidence

- The active chunk is `BenchmarkPage-DTHChMsh.js`.
- `单视频解析` calls `GET /v1/bugpk/parse?url=...`, labels the parser as
  `免费接口`, returns title, description, author, cover and a no-watermark media
  URL, then offers download and local ASR.
- `添加对标账号` calls `POST /v1/dajiala/feed-info` with a shared-video URL.
- `刷新本账号` and pagination call `POST /v1/dajiala/feed-list`.
- The account endpoints send `X-Sb-Email` and `X-Sb-Fp`, reject unbound accounts
  with `NO_EMAIL`, and deduct original Storybound credits. They are not public
  client-only behavior and must not be impersonated or bypassed.
- Account works include forward, like, comment, favorite, duration, publish time,
  expiring download URL, decode key and original open URL.

## Required behavior

- Header: `对标监控`
- Account search placeholder: `搜账号名`.
- Parse a public video/share URL through the same public parser used by the
  original client, show provider/source status, and prefill title, author,
  cover, media URL, quality and counters.
- Save a parsed video into an existing account or automatically create an
  account from the parsed author name.
- Add an account from a pasted public video/share URL or manual account details.
- Group/track assignment, rename, favorite and delete.
- Search filters existing accounts before adding.
- When a compatible account data adapter is explicitly configured, resolve the
  account ID, refresh its latest works and continue pagination. Before a refresh
  that can spend credits, show an explicit confirmation.
- When the adapter is absent, show that automatic account refresh is unavailable;
  do not present the local manual form as equivalent to original monitoring.
- Works list supports filters: all, favorite, created, uncreated.
- Sort options: publish time, likes, favorites, comments, forwards and growth.
- Single-video import stores URL, no-watermark media URL, title, author, cover,
  quality, account, counters and local notes.
- Where a media URL is directly downloadable, expose download; otherwise preserve the source URL.
- Accept a local audio/video file and run the clone's existing local/server transcription path when available.
- For a parsed public work, offer one-click transcript extraction: re-resolve the
  public media URL, reject private-network/HTTP download targets, enforce a
  128 MB limit, transcribe locally and remove the temporary media.
- Auto-detect a locally installed `faster-whisper`; show its model/device status
  and keep manual transcript import available when ASR is absent.
- Transcript actions: copy, edit, mark created, use to create task, Markdown export.
- AI correction and structure analysis call the configured LLM only after explicit button press.
- Persist accounts, works, transcripts and groups locally across refresh.
- Do not scrape authenticated platform pages, bypass original authentication or
  claim private platform API access.

## Visual contract

- Desktop: 260 px account rail + flexible works pane.
- Search and account controls remain visible while the works pane scrolls.
- Cards use the original compact 12-13 px metadata hierarchy.
- Mobile stacks rail and content and keeps all actions keyboard accessible.
