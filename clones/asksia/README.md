# StudyPal AI

StudyPal AI is a local-first university study workspace. The current P1 implements one complete learning flow: upload a PDF or TXT file, extract its text, create a structured study summary, ask grounded follow-up questions, and restore the session after a refresh.

## Run locally

```bash
npm install
npm run dev
```

Open `http://127.0.0.1:3000/pro/session`.

## Quality checks

```bash
npm test
npm run check
npm run test:e2e:p1
```

`npm run check` runs lint, TypeScript, the unit/API integration suite, and a production build. `npm run test:e2e:p1` uses an existing local Playwright installation and Chromium browser, starts the production app on port 3100, and writes desktop/mobile screenshots, traces, versions, and diagnostics under `docs/evidence/p1-playwright/`.

## P1 behavior

- Supported files: PDF and UTF-8 TXT, up to 10 MB.
- PDF text is extracted locally by the Next.js server with `unpdf`; scanning/OCR is not included.
- The current summary and question-answer provider is a deterministic demo provider. It never claims to be a live model.
- Answers include page or source-fragment citations when evidence exists and explicitly refuse unsupported questions.
- The latest study session is saved in browser `localStorage` under `studypal.study-session.v1`.
- No API key, user credential, payment, deployment, audio, video, LMS sync, or account backend is part of this checkpoint.

See [P1 file study flow](docs/P1-file-study-flow.md) for the technical boundary and acceptance matrix.

## Reference research

Historical competitor research remains under `docs/research/`, `public/images/asksia/`, and `scripts/`. Those names describe the research source; the product presented by the running app is StudyPal AI.
