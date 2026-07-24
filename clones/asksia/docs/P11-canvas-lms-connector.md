# P11 — Canvas LMS Connector

Status: implementation complete; live institution authorization pending  
Version: StudyPal AI 0.9.0  
Date: 2026-07-24

## Scope

This checkpoint implements a read-only Canvas connector. It does not write grades, submissions, messages, course content, or settings back to Canvas.

The connector supports:

- manual Canvas access-token verification;
- optional OAuth 2.0 authorization-code flow;
- active course discovery;
- paginated module, assignment, page, and file discovery;
- page and assignment text extraction;
- file metadata and protected download-link capture;
- external-link metadata;
- persistent sync runs, failure states, and stale-material reconciliation;
- encrypted token storage;
- RLS isolation for connections, courses, materials, and sync runs;
- explicit confirmation before disconnecting and deleting synchronized data.

## Official API boundary

Canvas is accessed only through documented read endpoints:

```text
GET /api/v1/users/self/profile
GET /api/v1/courses
GET /api/v1/courses/:course_id/modules
GET /api/v1/courses/:course_id/assignments
GET /api/v1/courses/:course_id/files
GET /api/v1/courses/:course_id/pages/:url_or_id
GET /api/v1/files/:id
```

The OAuth flow uses:

```text
GET  /login/oauth2/auth
POST /login/oauth2/token
```

No Canvas write scope is requested or implemented.

## Security model

- Canvas tokens are encrypted with AES-256-GCM before database storage.
- `STUDYPAL_LMS_ENCRYPTION_KEY` is server-only and ignored by Git.
- The application never returns token plaintext or ciphertext from an API response.
- `*.instructure.com` is accepted by default.
- Custom institutional domains require an exact `STUDYPAL_LMS_ALLOWED_HOSTS` entry.
- HTTP, credentials in URLs, ports, localhost, local domains, and IP literals are rejected.
- Canvas API redirects are not followed.
- Pagination links must remain on the original Canvas origin and under `/api/v1/`.
- Requests have timeouts and bounded response sizes.
- OAuth state is random, HttpOnly, SameSite=Lax, short-lived, and compared in constant time.
- Client input cannot select another `user_id`.
- Disconnect requires both a browser confirmation and the server token `DISCONNECT_LMS`.

## Database

Migrations:

```text
supabase/migrations/20260724030000_lms_connector.sql
supabase/migrations/20260724040000_index_lms_sync_connection.sql
```

Tables:

- `lms_connections`
- `lms_courses`
- `lms_materials`
- `lms_sync_runs`

Every table enables and forces RLS. Anonymous privileges are revoked. Authenticated policies require `auth.uid() = user_id`.

## Application APIs

```text
GET    /api/lms/status
POST   /api/lms/canvas/connect
GET    /api/lms/canvas/oauth/start
GET    /api/lms/canvas/oauth/callback
POST   /api/lms/connections/:id/sync
DELETE /api/lms/connections/:id
```

## Environment

```dotenv
STUDYPAL_LMS_ENCRYPTION_KEY=<32 random bytes encoded as base64>
STUDYPAL_LMS_ALLOWED_HOSTS=

CANVAS_INSTANCE_URL=
CANVAS_CLIENT_ID=
CANVAS_CLIENT_SECRET=
CANVAS_REDIRECT_URI=http://127.0.0.1:3000/api/lms/canvas/oauth/callback
```

OAuth remains disabled until an institution or Canvas administrator supplies a Developer Key. Manual read-only token connection remains available without those OAuth values.

## Verification

- unit tests cover encryption, tamper detection, SSRF-shaped URL rejection, connection validation, pagination, same-origin enforcement, course/material mapping, OAuth request scope, token exchange, and SQL RLS contracts;
- live Supabase migration: PASS;
- live LMS RLS cross-user checks: 6/6 PASS;
- anonymous table privileges revoked: PASS;
- Supabase security advisor: 0 findings;
- Supabase performance advisor: no unindexed foreign keys after remediation;
- remaining performance notices are expected unused-index notices on new empty tables.

## External acceptance gate

A real Canvas account is required only for the final institution-level verification:

1. authorize a read-only token or OAuth Developer Key;
2. connect through the StudyPal UI;
3. sync at least one real course;
4. compare course/module/assignment/file counts with Canvas;
5. revoke the token and verify StudyPal reports expiration without losing previous synchronized data.

No user password is requested or stored.
