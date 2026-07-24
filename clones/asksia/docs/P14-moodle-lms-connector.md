# P14 — Moodle LMS connector

## Outcome

StudyPal supports read-only synchronization from MoodleCloud and explicitly approved self-hosted Moodle instances. The connector imports the current user's visible courses, course sections, activity metadata, due dates, files, and external links. It never writes grades, submissions, enrollments, messages, or course content back to Moodle.

## Authentication and administrator setup

Standard Moodle web services use an administrator-created external service and a token issued for a specific user. The administrator must:

1. Enable web services and the REST protocol.
2. Create a custom service restricted to:
   - `core_webservice_get_site_info`
   - `core_enrol_get_users_courses`
   - `core_course_get_contents`
3. Authorize the intended Moodle user for that service.
4. Issue a token for that user and service.

The user signs in to StudyPal cloud, opens **LMS connections**, enters the Moodle base URL and token, and chooses **Verify and connect Moodle**. StudyPal verifies all three required functions before saving the connection.

## Security controls

- Moodle tokens are submitted to Moodle only in an HTTPS `POST` body.
- Tokens are encrypted with the server-only `STUDYPAL_LMS_ENCRYPTION_KEY` before database storage.
- Tokens, Moodle server debug details, and token-bearing query parameters are never returned to the client.
- MoodleCloud hosts are accepted by default. A self-hosted domain requires an exact hostname in `STUDYPAL_LMS_ALLOWED_HOSTS`.
- Credentials, non-HTTPS URLs, custom ports, local names, and private IP literals are rejected.
- Redirects are blocked to prevent credential forwarding.
- The provider uses a hard allowlist of three read-only Moodle functions.
- Responses, course counts, and material counts are capped.
- Supabase RLS and ownership filters isolate connections and synchronized rows by user.

## Runtime flow

1. `POST /api/lms/moodle/connect`
2. Validate URL, label, and token.
3. Call `core_webservice_get_site_info`; verify the current user and required function list.
4. Encrypt and upsert the token in `lms_connections`.
5. A later sync calls `core_enrol_get_users_courses` for the verified current-user ID.
6. For every visible course, call `core_course_get_contents`.
7. Normalize sections, activities, assignments, files, due dates, and external links into the shared LMS tables.
8. Reconcile stale materials and persist the sync run result.

## Configuration

No Moodle client secret is required. The shared server configuration is:

```dotenv
STUDYPAL_LMS_ENCRYPTION_KEY=
STUDYPAL_LMS_ALLOWED_HOSTS=learn.example.edu
```

Do not commit real tokens or encryption keys. The Moodle token is entered at runtime by an authenticated user and is not an environment variable.

## Validation

Automated coverage verifies:

- MoodleCloud and approved self-hosted URL normalization;
- blocking HTTP, credentials, private addresses, and unapproved hosts;
- ownership fields supplied by a client are ignored;
- token transmission occurs in the POST body and never in the URL;
- required function verification;
- current-user course discovery;
- section, resource, file, assignment, due date, and external-link mapping;
- token-query stripping from stored source URLs;
- safe token-error mapping without reflecting Moodle server details;
- database provider constraint migration without weakening RLS.

## External verification gate

A live institutional test requires a real Moodle administrator to create the restricted service and token. Until that external setup exists, fixture-backed tests prove protocol shape and safety behavior; they do not claim successful access to a specific school Moodle instance.
