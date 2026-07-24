# P10 — Cloud Accounts, Database, and Multi-User Isolation

Status: implementation complete; dedicated Supabase project provisioning pending  
Version: StudyPal AI 0.8.0  
Date: 2026-07-24

## Outcome

StudyPal now has an optional cloud account backend built on Supabase Auth and Postgres:

- email/password sign-up and sign-in;
- PKCE auth callback;
- cookie-based SSR session refresh through Next.js Proxy;
- user profile and personalization API;
- Postgres tables for profiles, learning sessions, and generated artifacts;
- Row Level Security on every multi-user table;
- cloud session persistence for file, homework, video, and transcription sessions;
- cloud-backed Library metadata;
- explicit, user-confirmed import of existing local sessions;
- complete local fallback when cloud is off, unavailable, or the user is signed out.

No service-role key is used by the application. Every cloud request runs with the signed-in user's JWT and remains subject to RLS.

## Files

```text
supabase/migrations/20260724010000_cloud_accounts.sql
src/proxy.ts
src/lib/cloud/
├── browser.ts
├── config.ts
├── local-import.ts
├── profile.ts
├── server.ts
├── session-metadata.ts
└── session-repository.ts
src/app/api/cloud/
├── status/route.ts
├── profile/route.ts
└── import-local/route.ts
src/app/auth/callback/route.ts
src/components/CloudAccountDialog.tsx
```

## Database model

### `profiles`

- primary key: `user_id`, referencing `auth.users(id)`;
- display name;
- safe personalization JSON;
- plan marker reserved for the billing phase;
- automatic profile creation after Auth user creation.

### `learning_sessions`

- internal identity primary key;
- `user_id`;
- browser/server `client_id`;
- kind: study, homework, video, or transcribe;
- metadata columns used by Library;
- full structured JSON payload;
- unique `(user_id, kind, client_id)`.

### `learning_artifacts`

- internal identity primary key;
- `user_id`;
- kind: quiz, study-guide, flashcard, essay, or detector;
- optional source session ID;
- structured JSON payload.

## RLS

All three tables enable and force RLS.

Policies:

- authenticated users can select only rows where `user_id = auth.uid()`;
- inserts use `WITH CHECK`;
- updates use both `USING` and `WITH CHECK`;
- deletes require row ownership;
- anonymous table privileges are revoked;
- application grants are limited to required operations;
- every foreign key/RLS filter path has an index;
- `auth.uid()` is wrapped in `SELECT` for policy performance.

## Runtime modes

```dotenv
STUDYPAL_CLOUD_MODE=off
```

Always use local JSON.

```dotenv
STUDYPAL_CLOUD_MODE=optional
```

Signed-in users use cloud storage. Signed-out users use local JSON.

```dotenv
STUDYPAL_CLOUD_MODE=required
```

Cloud configuration and sign-in are mandatory. Missing authentication produces HTTP 401 instead of falling back to local data.

## Dedicated project setup

1. Create a new Supabase project owned by the organization selected by the user.
2. Apply:

   ```text
   supabase/migrations/20260724010000_cloud_accounts.sql
   ```

3. Add to `.env.local`:

   ```dotenv
   STUDYPAL_CLOUD_MODE=optional
   NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
   NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<publishable-key>
   ```

4. Add the local and future production callback URLs in Supabase Auth:

   ```text
   http://127.0.0.1:3000/auth/callback
   https://<production-host>/auth/callback
   ```

5. Rebuild and start StudyPal.
6. Create two test users and verify that each user can read only their own rows.
7. Run Supabase security and performance advisors after the migration.

The application must never receive or store a Supabase secret/service-role key.

## Existing local session import

Import is never automatic.

The signed-in user opens **Cloud account & sync** and chooses **Import local sessions**. The UI displays a destructive-scope confirmation, and the API requires the exact server-side confirmation token `IMPORT_LOCAL_SESSIONS`.

The importer:

- reads only valid session file names;
- limits each kind to 100 files;
- rejects files over 5 MB;
- validates every payload with its existing parser;
- upserts into the authenticated user's rows;
- ignores corrupt files;
- does not delete local data.

## Verification

Completed locally:

- TypeScript: PASS;
- ESLint: 0 errors;
- unit/API tests: 53/53 PASS;
- P1–P5 browser regression: PASS;
- final 1440px and 390px E2E: PASS;
- production build: PASS;
- cloud configuration boundary UI: PASS;
- local fallback: PASS;
- SQL RLS/index contract tests: PASS;
- cloud repository ownership tests: PASS.

Pending external verification:

- create the dedicated Supabase project;
- apply the migration;
- create two real test users;
- prove cross-user reads/writes are denied by live RLS;
- run Supabase security and performance advisors.
