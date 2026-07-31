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
- `刷新本账号` calls `POST /v1/dajiala/feed-list` with an empty
  `last_buffer` and merges the latest page (15 works).
- `加载更多` sends the stored `last_buffer` and merges one more page (15
  works). `连续加载…` repeats that paginated request, exposes stop control and
  can consume credits once per page. One refresh is not evidence that all
  historical works were synchronized.
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
  account ID, refresh its latest 15 works, load one more 15-work page, or
  continuously load all remaining history. Persist `last_buffer`,
  `continue_flag` and page depth; merge by remote work ID/source URL so
  interaction counts refresh without duplicating works or overwriting local
  transcript/analysis fields.
- Continuous loading must be stoppable between requests, stop on a repeated or
  empty cursor, and use a safety page limit to prevent a faulty provider loop.
  Before any refresh or multi-page action that can spend credits, show an
  explicit confirmation and explain per-page charging.
- When the adapter is absent, disable account-sync actions and explain that the
  original client needs a bound email and the current device fingerprint.
  MiniMax credentials and the manual import form are not equivalent to original
  account monitoring.
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
