# P10 — Cloud Accounts, Database, and Multi-User Isolation

Status: DONE
Version: StudyPal AI 0.8.0  
Date: 2026-07-24

## Outcome

StudyPal now has an optional cloud account backend built on Supabase Auth and Postgres:

- email/password account UI and PKCE callback;
- cookie-based SSR session refresh through Next.js Proxy;
- user profiles and personalization;
- cloud persistence for study, homework, video, and transcription sessions;
- cloud-backed Library metadata;
- explicit, user-confirmed import of existing local sessions;
- local fallback when cloud is disabled or the user is signed out;
- database-enforced multi-user isolation with Row Level Security.

The application does not use a Supabase service-role key. Cloud requests use the signed-in user's JWT and remain subject to RLS.

## Dedicated Supabase project

- Project name: `studypal-ai`
- Project ref: `hfzxdekfnhykcojnngyb`
- Region: `us-west-1`
- Status at acceptance: `ACTIVE_HEALTHY`
- Creation cost reported by Supabase: US$0/month

This project is separate from `garage-diy`; no tables, credentials, or data are shared.

## Migrations

```text
supabase/migrations/20260724010000_cloud_accounts.sql
supabase/migrations/20260724020000_revoke_auth_trigger_execute.sql
```

The schema contains:

- `profiles`
- `learning_sessions`
- `learning_artifacts`

All three tables enable and force RLS. Anonymous table privileges are revoked. Authenticated operations are limited to the row owner. The account-creation trigger function cannot be invoked through the public RPC surface.

## Runtime configuration

Local `.env.local` contains the project URL and publishable key together with:

```dotenv
STUDYPAL_CLOUD_MODE=optional
```

No secret or service-role key is stored in the project. Existing MiniMax configuration remains unchanged.

## Live RLS acceptance

Two disposable test identities were created inside a transaction and removed after the test. All eight assertions passed:

1. User A reads only User A sessions.
2. User A sees only User A profile.
3. User B cannot read User A sessions.
4. User B cannot update User A sessions.
5. User B cannot delete User A sessions.
6. User B reads only User B sessions.
7. User B can delete User B's own session.
8. User A's row survives all cross-user attempts.

Additional database checks:

- RLS enabled: PASS
- RLS forced: PASS
- anonymous SELECT privilege revoked: PASS
- authenticated SELECT privilege available under RLS: PASS
- Supabase security advisor: 0 findings
- performance advisor: only expected unused-index informational notices on the new empty database

## Application verification

- Cloud status endpoint: configured
- Signed-out boundary: displays the sign-in/create-account form
- Local production page: HTTP 200
- Unit/API tests: 54/54 PASS
- TypeScript: PASS
- Production build: PASS
- Desktop/mobile E2E: PASS
- Evidence: `docs/evidence/final-study-suite/2026-07-24T18-37-35-242Z`

## Existing local session import

Import remains explicit and is never automatic. The signed-in user must confirm the import action. Valid sessions are bounded, parsed through their existing validators, upserted into the authenticated user's RLS-protected rows, and retained locally.

## Remaining deployment note

Before public deployment, add the final production origin and `/auth/callback` URL to the Supabase Auth redirect allowlist. This does not block local cloud-account completion.
