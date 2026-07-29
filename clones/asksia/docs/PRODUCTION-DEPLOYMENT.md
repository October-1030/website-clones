# StudyPal AI production deployment

This document prepares the application for a public HTTPS host. It does not authorize or perform a deployment.

## Required boundary

Public instances must set all of the following before both `npm run build` and `npm start`. Build-time configuration controls the generated CSP, while runtime configuration controls request authentication and origin enforcement:

```dotenv
STUDYPAL_DEPLOYMENT_MODE=public
STUDYPAL_APP_ORIGIN=https://studypal.example
STUDYPAL_CLOUD_MODE=required
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=YOUR_PUBLIC_KEY
```

`STUDYPAL_APP_ORIGIN` is one exact HTTPS origin with no path. Startup requests fail closed when this boundary is incomplete. Public API routes require a valid Supabase user, and unsafe browser requests require the configured same origin.

Keep these server-only values in the hosting platform's encrypted secret store:

- `MINIMAX_API_KEY` or `OPENAI_API_KEY`
- `STUDYPAL_LMS_ENCRYPTION_KEY`
- OAuth client secrets
- LMS integration secrets

Never prefix a secret with `NEXT_PUBLIC_`, commit it, copy it into client code, or expose it in logs. The Supabase publishable/anon key is the only browser-facing cloud key.

## Before first release

1. Create a dedicated StudyPal Supabase project. Never reuse an unrelated product database.
2. Apply every migration in `supabase/migrations` in timestamp order. Migration `20260724100000_production_security_hardening.sql` restricts plan updates, adds payload and row caps, and binds LMS children to same-owner parents.
3. Configure the final Site URL and exact redirect URLs in Supabase Auth.
4. Configure the final Canvas/Brightspace OAuth redirect URLs, if those connectors are enabled.
5. Set the public deployment variables in the build environment, then build on Node 24 or newer with `npm ci && npm run check`. Do not promote an artifact built with local-mode variables.
6. Provide Python, PyAV, Faster-Whisper, FFmpeg support, and a pre-cached speech model on any host that enables transcription. A stateless serverless runtime without these assets cannot provide the current transcription backend.
7. Put the service behind HTTPS. Forward the original `Host` and `X-Forwarded-Proto` headers without accepting arbitrary client overrides.
8. Set an ingress request limit of at most 52 MiB. Keep the application limits enabled as defense in depth.
9. Run one authenticated smoke test for upload, grounded follow-up, refresh recovery, LMS status, extension status, and usage status.

## Runtime behavior

- `/api/health` is intentionally unauthenticated and returns only service health, deployment mode, and time.
- `/api/cloud/status` is unauthenticated so the sign-in UI can determine account state.
- `/api/extension/import` uses a dedicated bearer pairing token and a restricted extension origin policy.
- Other public API routes require a Supabase session.
- AI routes are rate-limited in memory and also consume persistent account quotas before expensive provider work.
- `npm start` always launches the public-mode server and fails closed until the required boundary is complete.
- Local mode must use `npm run start:local`; development and local production launchers bind `127.0.0.1` by default.

For horizontally scaled production, add a shared gateway or Redis rate limiter. The database quota remains authoritative, while the in-process limiter only absorbs short bursts per instance.

## Extension release note

The current Chrome extension intentionally accepts only `http://127.0.0.1:3000` and `http://localhost:3000`. Do not broaden its host permissions until a final production origin is chosen. A production extension release must use that exact HTTPS origin, update `host_permissions`, preserve pairing-token authentication, and pass `npm run check:extension`.

## Verification and rollback

Before promoting a release, retain:

- commit SHA and lockfile
- `npm run check` output
- `npm audit --omit=dev` output
- authenticated E2E screenshots/trace
- Supabase migration history
- a secret scan with no credential values

Deploy immutable builds. Roll back application code by promoting the previous known-good build. Do not automatically roll back database migrations that add constraints or permissions; use a separately reviewed forward migration. If a migration validation fails, stop the release, repair inconsistent rows under an audited administrator session, and rerun validation.
