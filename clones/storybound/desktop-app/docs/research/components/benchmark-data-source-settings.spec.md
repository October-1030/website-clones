# BenchmarkDataSourceSettings Specification

## Overview

- Target files: `src/components/TtsSettingsPage.tsx`, `src/lib/benchmark-api.ts`, `server.mjs`
- Interaction model: click-driven configuration and connection test
- Original behavior preserved: account recognition, latest 15 works, cursor pagination and explicit confirmation before potentially billed requests
- Independent customization: replace the original author's private email/device/points gateway with the user's own upstream API key

## Data contract

1. The browser never receives a saved API key.
2. `GET /api/benchmark/status` returns only readiness, provider, credential source and optional balance.
3. `POST /api/benchmark/source` receives a newly entered key, validates it against the upstream balance endpoint, then stores it under the ignored Storybound data directory.
4. `DELETE /api/benchmark/source` removes only the locally saved upstream credential.
5. Account recognition maps to Dajiala `type=12` with `feed_info`.
6. Work pagination maps to Dajiala `type=1` with `v2_name` and `last_buffer`; one page is at most 15 works.
7. The original Storybound-compatible proxy remains an environment-only fallback for existing installations.

## UI structure

- Add a System Settings navigation item: `对标数据 / 视频号作品`.
- Header status states: `待配置`, `未测试`, `已配置`, `有误`.
- Ready banner: `自动拉取已就绪`, showing provider, local credential source and balance when returned.
- Empty banner: explain that this is the data source used by the original workflow, while avoiding unnecessary provider jargon.
- Password input: `访问密钥（API Key）`; never prefill a saved secret.
- Optional verify-code input, collapsed conceptually as an advanced field but visible for providers that require it.
- Primary action: `保存并测试`.
- Secondary external link: `注册 / 查看密钥`.
- Destructive action when configured: `删除本机密钥`, guarded by browser confirmation.

## States and behavior

### Unconfigured

- Benchmark page continues to show local accounts and works.
- Automatic account recognition and pagination return an actionable message pointing to `系统设置 → 对标数据`.
- No fake success and no empty account is created.

### Saving

- Button label becomes `检测中…` and is disabled.
- The local server calls the documented balance endpoint.
- Invalid credentials remain unsaved and the exact safe error is shown inline.

### Configured

- Input is cleared after save.
- Status refreshes without exposing the secret.
- Existing accounts lacking `remoteId` can be migrated automatically from their saved video share URL on the next refresh.

### Potentially billed actions

- Account recognition, refresh and each historical page may consume upstream balance.
- Existing refresh confirmation remains in place.
- Copy says `数据接口余额/费用`, not `Storybound 积分`.

## Security and persistence

- Credential file: `.storybound-data/benchmark-source.json` or the configured external `STORYBOUND_DATA_DIR`.
- `.storybound-data/` is ignored by Git.
- Status, diagnostics, logs and API responses must not contain the key or verify code.
- The server accepts the settings endpoints through the existing localhost/public-token access boundary.

## Responsive behavior

- Desktop: reuse the existing 760px settings content column.
- Mobile: fields stack through the existing settings media query; external link and buttons wrap without horizontal overflow.

## Validation

- Contract smoke test covers direct Dajiala mapping, balance test, account recognition, page retrieval, cursor fields and error mapping.
- TypeScript build and production bundle must pass.
- Browser QA covers unconfigured settings, navigation from Benchmark, secret field behavior and status rendering.
