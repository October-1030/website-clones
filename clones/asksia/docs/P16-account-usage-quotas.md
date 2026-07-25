# P16 — Account usage and free-plan quotas

StudyPal keeps public payments and subscriptions disabled. This checkpoint replaces client-side countdowns with a server-owned monthly usage ledger for signed-in cloud accounts while leaving anonymous local mode explicitly unmetered.

## Free monthly limits

- AI requests: 10 successful summaries, grounded questions, homework solves, video summaries/questions, or extension summaries.
- File pages: 100 successfully summarized PDF/TXT pages.
- Recording: 600 successfully transcribed seconds.
- Writing-signal review: 10,000 analyzed characters.

Periods use UTC calendar months. The status API returns the current period start/end, used, limit, and remaining values. No payment method, order, subscription, invoice, or upgrade mutation is implemented.

## Database and security

`account_usage_periods` is keyed by `(user_id, period_start)`, uses forced RLS, and grants signed-in users read-only access to their own row. Direct INSERT, UPDATE, DELETE, and TRUNCATE are revoked. `consume_account_usage(jsonb)` derives ownership exclusively from `auth.uid()`, accepts only four bounded positive integer dimensions, locks the monthly row, checks all limits, and updates all requested dimensions atomically.

The RPC is `SECURITY DEFINER` and executable only by `authenticated`; `PUBLIC` and `anon` are revoked explicitly because Supabase can materialize default API-role grants. Supabase therefore reports one expected authenticated-function advisor warning for this RPC. The function has an empty `search_path`, no user-ID parameter, bounded inputs, row locking, and no direct table write grants. The separate extension bearer-token ingestion RPC has its own documented anonymous-function warning. An anonymous warning for `consume_account_usage`, or any additional unreviewed security finding, is a release blocker.

## Charging behavior

Usage is recorded only after a provider/transcriber returns a valid successful result and before the session is saved. Failed validation, provider errors, cancelled requests, and rejected inputs do not consume quota. A concurrent request may finish provider work and then receive a 429 if another request consumed the last allowance first; no partial meter update occurs.

Anonymous local mode skips the cloud ledger and returns `metered: false`. The interface says `Local` rather than showing invented remaining credits.

## APIs

- `GET /api/usage/status` — no-store account usage snapshot or explicit local mode.
- `POST /api/writing/detector` — same-origin server boundary for the responsible writing-signal tool and its character meter.

All other metered APIs return their normal result plus the updated usage snapshot.

## Verification

- Unit tests cover UTC periods, local mode, authenticated row scoping, bounded changes, one atomic RPC, quota 429 mapping, detector same-origin checks, forced RLS, and least-privilege SQL.
- `npm run test:e2e:p16` checks desktop and 390px local-mode displays, account-menu meters, detector API behavior, console errors, failed requests, and screenshots.
- Live Supabase verification must confirm forced RLS, no anonymous table access, authenticated SELECT-only table access, and authenticated-only RPC execution.