# Observed interaction behavior

- Login URL redirects from the supplied dashboard route when unauthenticated.
- Login appears with opacity 0→1 and translateX(30px)→0 over .6s cubic-bezier(.25,.46,.45,.94).
- No page scroll or scroll-dependent effects at desktop/tablet/mobile.
- Language buttons immediately switch heading, fields, action and link copy. Footer and background remain Chinese. Active locale has #f8e8e8 background, #bc1f1a text, weight 600. Transition .2s.
- Empty login shows 12px #ff4d4f errors below fields: 请输入用户账号 / 请输入密码. Form layout does not shift.
- Password visibility control appears when the field is populated.
- Login hover: background #d0625e, translateY(-1px), shadow 0 4px 12px #5a8bff59; transition .3s.
- Register link opens #/auth/register. Heading 手机号注册; phone, SMS code, password; no locale buttons and no footer. Return link 去登录.
- SMS button disabled until a valid phone number is provided. No SMS was sent and no account was created during inspection.
- After the user authenticated in Chrome, the dashboard became available and was inspected. No credentials were entered by the agent, no account was created and no business data was submitted.

Local-only adaptations: login/registration submission explains that this is an interface demo; passwords are never stored or sent; SMS uses an explicitly labeled test code. No backend, remote login, or CAPTCHA is integrated.

## Dashboard

- Original sidebar uses accordion groups, with one expanded group at a time. Local matches this and provides a mobile drawer.
- Company scope defaults to 全部公司 · 汇总. Observed company list is empty. All five metric values and platform counts are 0.
- Metric information appears on hover/focus; local keyboard accessible controls expose the same source explanations.
- Eight platform tabs update the source-ranking heading; empty result stays visible. Local adds left/right/Home/End keyboard navigation.
- Workflow entries navigate to the same business destinations observed in the source: Company, Knowledge, QuestionTask, Prompt, Article, MediaAccount, Task, DeviceManagement and CollectedHistory. The local clone now restores all ten hash routes. Company and GEO project CRUD persists locally; other destinations provide local workspaces without calling the source backend.
- Announcement popover: 暂无公告, disabled mark-all-read, and view-all entry. Local preserves this state.
- Tutorial uses the original four phases, text, robot and visual treatment. Final recap is local explanatory copy.
- Assistant can be expanded/collapsed and uses the server-side MiniMax-M3 text endpoint. Company and GEO project selectors read local workspace data; local company data is not automatically sent to the model. IME composition Enter does not submit and conversations are not persisted.
- Download buttons show original names/versions; local explains that installer files must be obtained from the official site.

Full current coverage and backend limitations are recorded in `FUNCTIONAL_AUDIT.md`.
