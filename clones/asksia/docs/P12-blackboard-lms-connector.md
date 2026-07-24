# P12 — Blackboard Learn Connector

Status: implementation complete; institution installation pending  
Version: StudyPal AI 0.10.0  
Date: 2026-07-24

## Scope

StudyPal now includes a read-only Blackboard Learn REST adapter alongside Canvas.

It supports:

- OAuth 2.0 `client_credentials` token acquisition;
- automatic one-hour token renewal before each sync;
- current integration-user profile verification;
- current-user course membership discovery;
- paginated top-level course content;
- bounded breadth-first traversal of nested content folders;
- course documents, assignments, files, external links, and folder structure;
- text extraction from Blackboard content bodies and descriptions;
- encrypted token storage and the existing LMS sync ledger;
- the existing RLS-protected course/material persistence and stale-row reconciliation.

## Administrative model

Blackboard requires:

1. an application registered in the Anthology/Blackboard Developer Portal;
2. an application key, secret, and Application ID;
3. installation by the institution's Learn administrator;
4. a dedicated Learn integration user with only the required read entitlements.

The app key and secret are server-only environment variables. They are not entered in the browser, stored in Supabase, returned by APIs, logged, or committed.

## Read endpoints

```text
POST /learn/api/public/v1/oauth2/token
GET  /learn/api/public/v1/users/me
GET  /learn/api/public/v1/users/me/courses
GET  /learn/api/public/v1/courses/:courseId/contents
GET  /learn/api/public/v1/courses/:courseId/contents/:contentId/children
```

StudyPal implements no Blackboard POST, PATCH, PUT, or DELETE content operation.

## Security

- default accepted hosts are `blackboard.com`, `*.blackboard.com`, `bbhosted.com`, and `*.bbhosted.com`;
- custom institutional domains require an exact `STUDYPAL_LMS_ALLOWED_HOSTS` entry;
- local/private/IP/credential-bearing/HTTP hosts are rejected;
- redirects are blocked;
- pagination must remain on the original origin and under `/learn/api/public/`;
- responses, pagination, content count, and traversal depth are bounded;
- access tokens are encrypted with the existing AES-256-GCM server key;
- database ownership remains enforced by RLS.

## Environment

```dotenv
BLACKBOARD_INSTANCE_URL=
BLACKBOARD_APP_KEY=
BLACKBOARD_APP_SECRET=
```

## Verification

- URL allowlist and SSRF-shaped input tests: PASS
- Basic OAuth header/body contract: PASS
- short-lived token validation: PASS
- current-user profile and course mapping: PASS
- recursive content mapping: PASS
- provider constraint migration: PASS
- live Supabase migration: PASS
- Supabase security advisor: 0 findings

## External acceptance gate

Final real-instance verification requires an institution administrator to install the StudyPal Application ID and assign a read-only integration user. After those values are available, set the three environment variables, rebuild, sign in to StudyPal cloud, choose **Connect Blackboard Learn**, and compare synchronized course/content counts with the institution's Learn UI.
