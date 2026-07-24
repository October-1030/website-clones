# P13: D2L Brightspace read-only connector

## Outcome

StudyPal supports a separate, read-only Brightspace OAuth 2.0 connection for each signed-in StudyPal account. The connector discovers the current user's accessible course offerings and imports the nested course table of contents as modules, pages, files, assignments, and external links.

This connector belongs only to the `studypal-ai` Supabase project. It does not use or modify the unrelated `garage-diy` furniture project.

## Authentication and secrets

A Brightspace administrator must register an Authorization Grant application in Manage Extensibility, enable refresh tokens, and set the callback URL to:

`http://127.0.0.1:3000/api/lms/brightspace/oauth/callback`

Production must use the public HTTPS callback URL. Configure the instance URL, client ID, client secret, callback, and API versions only in server environment variables. No client secret, access token, refresh token, cookie, or encryption key may be committed, logged, returned by the status API, or placed in a browser bundle.

StudyPal:

- uses a cryptographically random, ten-minute, HttpOnly OAuth state cookie;
- exchanges the code at Brightspace's central token endpoint using HTTP Basic client authentication;
- encrypts access and refresh tokens with the existing AES-256-GCM LMS encryption key;
- refreshes five minutes before expiry and persists the rotated refresh token immediately;
- marks a connection expired when the authorization grant is rejected;
- blocks redirects and enforces the exact approved Brightspace instance origin for API requests.

## Read-only scope set

- `users:own_profile:read`
- `enrollment:own_enrollment:read`
- `content:toc:read`
- `core:*:*` only as Brightspace's documented fallback for routes that have not yet received a specific scope

No create, update, delete, grade, enrollment-management, submission, or messaging scope is requested.

## Discovery and synchronization

- current user: `/d2l/api/lp/{version}/users/whoami`
- active, accessible enrollments: `/d2l/api/lp/{version}/enrollments/myenrollments/`
- course content: `/d2l/api/le/{version}/{orgUnitId}/content/toc`
- pagination is capped at 20 pages and 50 course offerings;
- nested content is capped at 500 materials per course and depth 12;
- only org units identified as Course Offering are imported;
- localized tenants may configure exact course org-unit type IDs;
- hidden content is skipped, external links are recorded but never fetched, and stale local material rows are reconciled by the shared LMS orchestrator.

## External verification gate

The implementation and fixture tests do not require school credentials. Live institutional verification remains an external gate: an administrator must register StudyPal, grant the read-only scopes, provide the client values outside Git, and authorize a real user. Until then the status API reports Brightspace as unconfigured and the UI does not show a connect button.

## Primary documentation

- https://docs.valence.desire2learn.com/basic/oauth2.html
- https://docs.valence.desire2learn.com/res/user.html
- https://docs.valence.desire2learn.com/res/enroll.html
- https://docs.valence.desire2learn.com/res/content.html
- https://docs.valence.desire2learn.com/http-scopestable.html