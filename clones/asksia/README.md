# StudyPal AI

StudyPal AI is a local-first study workspace. It turns your own files, public captions, homework questions, and audio into structured study sessions that can be saved and restored on this computer.

The runtime product is branded **StudyPal AI**. Historical competitor research remains under `docs/research/`, `scripts/asksia-*`, and `public/images/asksia/` only as research evidence.

## Start locally

On Windows, double-click `start-studypal.cmd`, or run:

```bash
npm install
npm run local
```

Open:

```text
http://127.0.0.1:3000/pro/session
```

## Working features

- PDF and UTF-8 TXT extraction, structured summary, cited follow-up questions, and session restore.
- MiniMax M3 or OpenAI server-side provider boundary; deterministic demo mode when no model is configured.
- Homework Solver with problem restatement, knowns, method, steps, final answer, and verification.
- Public YouTube-caption and supported podcast-transcript summaries with timestamped citations.
- Microphone and browser-tab recording with local Faster-Whisper transcription; temporary audio is deleted.
- Source-backed Quiz, Study Guide, and Flashcards generated from the latest saved file session.
- Essay planning and revision metrics without creating a submission-ready paper.
- Writing-signal review that never claims to prove AI authorship or invents a probability.
- Searchable local Library across file, homework, video, and transcription sessions.
- Browser-local display name and personalization settings.
- Optional Supabase cloud accounts with cookie-based SSR auth, indexed Postgres storage, database RLS, and explicit local-session import.
- Allowlisted English/Chinese Wikipedia search with direct source links.
- Local-only portrait crop, style preview, and 800 × 800 PNG export. Photos are not uploaded.

## AI configuration

Demo mode is safe and requires no key:

```dotenv
STUDYPAL_AI_PROVIDER=demo
```

China-region MiniMax M3:

```dotenv
STUDYPAL_AI_PROVIDER=minimax
MINIMAX_API_KEY=
MINIMAX_MODEL=MiniMax-M3
MINIMAX_BASE_URL=https://api.minimaxi.com/v1
```

Copy `.env.example` to `.env.local` and place the key there. Never put credentials in source code, browser storage, fixtures, logs, or Git. Provider calls use server-side environment variables and request `store: false`.

## Local data

By default, server sessions are stored below `.studypal-data/`:

```text
.studypal-data/
├── sessions/
├── homework/
├── video/
└── transcribe/
```

Set `STUDYPAL_DATA_DIR` to change the location. Uploaded document binaries and temporary audio are not retained after processing. Browser preferences and generated study tools use localStorage.

## Canvas LMS connector

StudyPal can connect a signed-in cloud account to Canvas in read-only mode. It synchronizes active courses, modules, pages, assignment descriptions and due dates, file metadata, and external links. Tokens are encrypted with AES-256-GCM before cloud storage, Canvas hosts are allowlisted, redirects are blocked, and database RLS isolates every connection and synchronized row.

Manual Canvas tokens work without an OAuth Developer Key. Optional OAuth requires `CANVAS_INSTANCE_URL`, `CANVAS_CLIENT_ID`, `CANVAS_CLIENT_SECRET`, and `CANVAS_REDIRECT_URI`. Custom Canvas domains must be listed in `STUDYPAL_LMS_ALLOWED_HOSTS`.

Blackboard Learn is supported through a school-admin-installed, least-privilege REST integration. Configure BLACKBOARD_INSTANCE_URL, BLACKBOARD_APP_KEY, and BLACKBOARD_APP_SECRET only on the server; StudyPal automatically renews the short-lived access token and never writes content back to Learn.

D2L Brightspace is supported through its recommended OAuth 2.0 authorization-code flow. A school administrator registers the app and enables refresh tokens; StudyPal encrypts both tokens, rotates one-time refresh tokens during synchronization, follows no redirects, and requests only profile, own-enrollment, and table-of-contents read scopes.
## Important boundaries

The local web product intentionally does not pretend to provide:

- Moodle synchronization (Canvas, Blackboard, and Brightspace read-only synchronization are available);
- subscription, payment, or quota billing;
- production cloud hosting until a dedicated StudyPal Supabase project and deployment target are approved;
- mobile operating-system overlays or background translation over other apps;
- a packaged browser extension or native mobile application;
- OCR for scanned PDFs, full DOCX/PPTX ingestion, or private video transcription;
- AI-generated replacement faces or biometric processing.

These require separate products, permissions, infrastructure, legal review, or paid services.

## Verification

```bash
npm run typecheck
npm run lint
npm test
npm run build
npm run test:e2e:final
```

`test:e2e:final` uses the installed Playwright and Chrome, tests desktop and 390px mobile layouts, and saves screenshots, a trace, browser metadata, and a JSON report under `docs/evidence/final-study-suite/`.

The current product specification is [docs/PRD-studypal-ai.md](docs/PRD-studypal-ai.md). Cloud account architecture and setup are documented in [docs/P10-cloud-accounts.md](docs/P10-cloud-accounts.md).
