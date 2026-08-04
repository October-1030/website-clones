# Book selection + creation market v1.17 contract

Source of truth: `BookSelectionPage-Bxxhs1YH.js`, `MarketPage-D9joHkMY.js`.

## Book selection

- Preserve list/preset management, category/filter/search/sort, source import/manual entry, book detail/edit/delete and creation-task handoff.
- Original live-list crawling/LLM filtering must only be shown as available when a configured upstream truly returns data. Local/manual import remains a clearly labeled fallback.
- Cover/source/selling-point metadata and empty/loading/error states must survive refresh.

## Market

- Preserve discover/my-market tabs, type filters, search/sort, item detail, installed state and author/version/install metadata.
- Original credits/purchase/publish services are private dependencies. Keep their visible unavailable state and local-install fallback separate; never simulate a purchase or publish.

## Verification

- Import, edit, filter, install/remove and task-handoff work with persistent local data.
