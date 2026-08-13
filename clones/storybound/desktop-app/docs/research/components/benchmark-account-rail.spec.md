# BenchmarkAccountRail Specification

## Evidence

- Active original asset: `D:\projects\website-clones\.tmp\storybound-1.17.0-assets\assets\BenchmarkPage-Cp01SSnj.js`.
- Active original stylesheet: `D:\projects\website-clones\.tmp\storybound-1.17.0-assets\assets\BenchmarkPage-Cu1o9Xs-.css`.
- Interaction model: click-driven. The original contains no timer or `setInterval`-based automatic refresh.

## Original contract

1. The active platform is **视频号**. **抖音** is a disabled tab labelled “即将支持”.
2. “添加对标账号” accepts one Video Accounts share link, resolves a remote `v2_name`, then persists the account. A failed resolve must not create an empty account.
3. The account list supports: search by nickname, grouping by 赛道, favourite toggling, group editing, deletion, and selected-account highlighting.
4. Refresh is deliberate rather than automatic. A single refresh fetches the newest page (at most 15 works), merges interaction data by work ID, and keeps local transcript/video/created-task state.
5. Account multi-select opens a confirmation flow that refreshes selected accounts serially. The original shows the expected point cost before confirmation.
6. Account pagination is cursor-based. “加载更多” uses `last_buffer`; “连续加载” is user-started, offers 5/10/20/直到结束 pages, shows cost, and can be stopped. “重置翻页” only resets the cursor, retaining already stored works.
7. Original private account data calls require the signed-in original email and a device fingerprint. The clone must never fake a successful synchronization when those credentials are unavailable.

## Layout / styling extracted from original CSS

- Platform tabs: inline flex, `gap: 2px`, `padding: 3px`, sunken background, `8px` radius. Active tab uses raised background, shadow, and 600 weight.
- Account rail: `256px` desktop column, right divider, vertical flex. Header padding `14px 16px 10px`; count uses mono `11px` text on sunken background.
- Add control: `margin: 0 12px 10px`, `9px` padding, dashed strong border, `8px` radius. Hover changes border/text/background to brand.
- Account row: 38px avatar, `11px` gap, `10px` padding, `9px` radius, transparent border. Active row has brand-soft background, brand-tinted border, and a 2.5px brand stripe on the left.
- Row actions are icon-like compact controls revealed on hover. Preserve keyboard visibility with `:focus-within`.
- Account meta is mono 11px and displays work count plus refresh freshness; stale values use warning color.
- Narrow layout stacks the account rail above the work list instead of keeping a clipped 256px column.

## Clone implementation boundaries

- The local manual import form remains clearly marked “本地扩展”; it is not presented as the original synchronization capability.
- All service-mutating account refreshes require an explicit user click plus the existing confirmation dialogue.
- No original login, points, device identity, or private server credential is copied into the clone.
