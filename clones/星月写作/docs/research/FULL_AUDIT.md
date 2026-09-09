# Full-site parity audit

**Current verdict (2026-09-05): NOT 1:1 complete.** See [the evidence-based parity review](PARITY_AUDIT_2026-09-05.md). The historical table below records implementation and partial checks, not full acceptance.

2026-09-08: substantial functional repairs and real MiniMax image/loop tests are recorded in [the completion log](COMPLETION_2026-09-08.md). The overall1:1 verdict is still not complete; consult that log for current implementation instead of relying on superseded gaps below.

The user explicitly expanded scope to the full site on 2026-09-01.
Prior homepage-only boundaries do not define the current scope.

Status legend: inspected / implemented / verified / external setup required.
Every primary navigation entry and child operation must be inventoried and exercised.
Record any inaccessible source state rather than inventing a replica of unseen content.

| Area | Source inspection | Local implementation | Verification |
|---|---|---|---|
| Library, folders, archived, recycle bin, work management | Homepage and creation captured | Local create/import/edit/archive/restore/search/layout | Prior create/save/reload regression passed |
| Chapter editor, directories, importing/exporting, typography | Desktop/tablet/mobile inspected | Full local chapter workbench, split import, ordering, history, formatting, export, speech | Desktop and mobile directory/editor switching verified |
| Role, term, memo resources | Forms and manager inspected | CRUD, folders, import/export, search, batch, memo history, image upload | Sidebar and manager opened in desktop/mobile; strict checks passed |
| Creative toolbox, novel/script/advanced generators | All three groups inventoried | All cards open local generators; provider-backed text tasks | Entries, validation and missing-key state verified |
| Workflow library/editor/run history | Marketplace inspected; source create control did not open a visible form | Local builder, runner, favorites and history | Create/submit/display/delete and UI verified |
| Script workspace | Source tool hub inspected | Conversion/diagnosis and local workflow entry points | Navigation verified |
| AI book analysis/ranking | Source feed shell inspected | Public ranking links and local research notes | Navigation verified; live source feeds not connected |
| Prompt library/details/custom prompts | Categories and cards inspected | Local prompt CRUD, filters, favorite, preview and run | Page and runner verified |
| Knowledge cards | Source knowledge page inspected | Local card CRUD, category/search/favorite/preview/export | Navigation verified; source sharing/combinations are not reproduced |
| Courses/tutorials | Source category shell inspected | Local tutorials and reading progress | Navigation verified; original paid course catalog is not copied |
| Creator center | Source statistics layout inspected | Real local book/chapter/word statistics and data export | Navigation verified; payout services not connected |
| Forum/categories/article/discussion/share | Homepage titles and source navigation inspected | Local discussions, comments, likes, categories and search | Navigation verified; original cloud community is not connected |
| Profile, wallet, recharge, consumption history | Source account shell observed | Local profile, model status, records and data export | Type/build checks passed; original billing links remain external |
| Notifications/messages/history/about/customer support | About content inspected | Local history/about; empty notification/message states | Navigation implemented; source messages/support require original account |
| Themes/mobile/tablet/dark appearance | Prior baseline plus editor breakpoints | Theme variables and responsive pages | Desktop editor, 390px directory/editor/resource transitions verified |

Paid generation, purchases and public posting are not performed during inspection. Clicking the original
new-memo control created an empty scratch memo immediately; that exact scratch memo was deleted and
the original zero-count state verified. Avoid further auto-saving creation controls on the source.
Local data operations must work; services requiring real keys/accounts must present their full configuration flow.
Source private community prompt bodies and personal account information are not copied into public seed data.

## Boundaries of this local implementation

This is a usable local frontend implementation, not a claim of complete server parity. MiniMax-M3 is now configured on this machine using the user-supplied key in the ignored server environment file. A real 1,941-character novel opening completed successfully over the shared streaming API on 2026-09-01. Cover/character/scene image entries currently generate drawing prompts rather than images. Source authentication, cloud synchronization, paid courses, live ranking feeds, public publishing, billing and creator payouts are not connected. Local example marketplace content is authored for the clone and is not the source marketplace dataset.

The editor, workflow and resource components were built in isolated branches and merged into `.tmp/full-build`: `2f2a1e9`, `a61d9c2`, `63cabe3`.
