# P15 — Browser extension page sync

## Outcome

StudyPal now includes a local unpacked Manifest V3 Chrome extension. A student explicitly opens the side panel and chooses **Sync this page**. The extension captures either the current text selection or readable text from the visible study page, saves it to the student's StudyPal cloud account, and opens the capture in StudyPal. The student can then generate a structured source-grounded summary and continue asking questions through the existing file-study workflow.

## Permission boundary

The extension requests only:

- `activeTab` — temporary access after the user clicks the extension;
- `scripting` — one user-triggered extraction call in the active tab;
- `storage` — local-only storage for the pairing token and local server URL;
- `sidePanel` — the explicit sync interface;
- local host access to `http://127.0.0.1:3000/*` and `http://localhost:3000/*`.

It does not request `<all_urls>`, persistent website access, browsing history, cookies, web request interception, downloads, or a background content script. Extraction excludes forms, inputs, textareas, selects, buttons, editable elements, hidden elements, navigation, sidebars, and footers. Cross-origin iframe contents are not read.

## Pairing flow

1. The user signs in to StudyPal cloud.
2. **Browser extension** creates 32 random bytes and returns a token beginning with `spx_` once.
3. StudyPal stores only the SHA-256 token hash plus a non-secret hint.
4. The user pastes the token into the Chrome side panel.
5. Chrome stores it in `chrome.storage.local`, not Chrome sync storage.
6. Every capture sends the token in an `Authorization: Bearer` header to the local StudyPal API.
7. The token is revocable and expires after 30 days. Each user can have at most five active tokens.

## Backend safety

- `POST /api/extension/import` accepts only a correctly shaped Chrome-extension origin or a non-browser API client with a valid bearer token.
- The request body is capped at 180 KB; normalized text is capped at 120,000 characters.
- URLs are metadata only and are never fetched by the server.
- Capture timestamps must be recent.
- A deterministic client capture UUID makes identical page content idempotent.
- The database function serializes imports per token, returns duplicates without reinserting, and limits each token to 20 new captures per minute.
- The SECURITY DEFINER function has an empty `search_path`, a fixed SQL body, and only the minimum execute grant.
- Users cannot insert captures directly. RLS and explicit ownership filters isolate tokens and captures.
- Anonymous roles cannot read either table.

## Data flow

```text
User click
  → temporary activeTab extraction
  → bearer-token import API
  → SHA-256 token lookup
  → RLS-isolated extension_captures row
  → authenticated StudyPal dialog
  → existing MiniMax M3/demo study provider
  → learning_sessions study record
  → existing summary and grounded Q&A UI
```

## Local installation

1. Start StudyPal at `http://127.0.0.1:3000`.
2. Open `chrome://extensions`.
3. Enable Developer mode.
4. Choose **Load unpacked** and select `D:\projects\website-clones\clones\asksia\extension`.
5. In StudyPal, open **Browser extension** and create a pairing token.
6. Paste the token in the StudyPal side panel and save it.
7. Open an HTTP/HTTPS study page and choose **Sync this page**.

## Validation

- token format, one-way hashing, labels, and bearer parsing;
- URL, text length, timestamp, metadata, and ownership-field validation;
- exact Chrome-extension CORS reflection;
- Manifest V3 minimum permissions and local-only host access;
- exclusion of forms and sensitive browser APIs;
- forced RLS, anonymous grant revocation, fixed SECURITY DEFINER search path, rate limiting, and no direct capture insert grant;
- JavaScript syntax and static extension policy checks;
- production Next.js build and signed-out UI behavior;
- live migration security and performance advisors.

## Deployment boundary

This checkpoint is intentionally local and unpacked. A public Chrome Web Store release requires a production HTTPS StudyPal origin, store assets, a privacy disclosure, permission justification, and a separate publication approval. None of those publishing actions are performed here.

## Supabase advisor exception

The database advisor reports the public `ingest_extension_capture` function because it is a `SECURITY DEFINER` RPC executable by `anon`. This is intentional for the local extension pairing channel: callers must still present a random 256-bit token, only its SHA-256 hash is stored, tokens expire after 30 days, inputs are bounded, writes are rate-limited, direct anonymous table access is revoked, and `authenticated` cannot execute the RPC. Treat any additional advisor finding as a release blocker.