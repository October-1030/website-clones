# P4 — Video Link Summary

Status: implemented and verified.

## User flow

1. Open `/pro/session` and select **Video Link summary**.
2. Paste a supported public HTTPS media URL.
3. StudyPal validates the URL and host before making any outbound request.
4. For YouTube, StudyPal obtains a signed public caption track through the Android Innertube player response and retains the watch-page track as a fallback.
5. For allowlisted podcast pages, StudyPal reads only a structured `transcript` value from JSON-LD.
6. MiniMax M3 summarizes the extracted transcript into:
   - overview;
   - key concepts;
   - review questions.
7. The user can ask follow-up questions grounded in the extracted transcript.
8. Answers include timestamp-range or transcript-section citations.
9. The session is saved in browser storage and in `.studypal-data/video`, then restored from `videoSession` after refresh.

## Safety boundary

- HTTPS only.
- No URL credentials or custom ports.
- Localhost, IP literals, `.local`, redirects outside the allowlist, and unknown hosts are blocked.
- Default remote hosts are YouTube plus a small podcast-platform allowlist.
- Additional podcast hosts require explicit `STUDYPAL_MEDIA_ALLOWED_HOSTS` configuration.
- Page and transcript responses are size-bounded and time-bounded.
- Missing captions/transcripts produce an error. Titles and descriptions are never treated as full transcripts.
- No cookies, browser profile data, private videos, paywalled media, video downloads, audio extraction, or speech-to-text are used.

## Configuration

```env
STUDYPAL_MEDIA_LANGUAGE=en
STUDYPAL_MEDIA_ALLOWED_HOSTS=
```

`STUDYPAL_MEDIA_ALLOWED_HOSTS` is a comma-separated list of additional podcast page hosts that expose a structured JSON-LD transcript.

## API

- `POST /api/video/summarize`
- `POST /api/video/ask`
- `GET /api/video/session/:id`
- `DELETE /api/video/session/:id`

## Verification

- TypeScript typecheck.
- 32 unit/API tests, including:
  - unsafe URL and SSRF boundary;
  - YouTube URL parsing;
  - WEB empty-caption to Android signed-caption fallback;
  - structured podcast transcript extraction;
  - refusal to summarize a description-only page;
  - grounded follow-up citations;
  - browser and server session persistence.
- Production build.
- Playwright desktop 1440×1000 and mobile 390×844 flow:
  - summarize;
  - grounded question and timestamp citation;
  - URL session ID;
  - server restore after localStorage loss;
  - clear;
  - unsafe URL error;
  - zero unexpected console/page/network failures;
  - no horizontal overflow.
- Real live smoke:
  - public YouTube captions;
  - MiniMax M3 summary;
  - grounded follow-up with timestamp citation.

## Known limits

- YouTube Innertube is an unofficial compatibility boundary and may require maintenance when YouTube changes client behavior.
- Videos without public captions are not transcribed in P4.
- Podcast pages without a structured transcript are rejected.
- Audio upload, live recording, and speech-to-text belong to the later transcription checkpoint.
