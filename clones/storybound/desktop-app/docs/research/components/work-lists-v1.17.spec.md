# History + queue + batch summary v1.17 contract

Source of truth: `History-Di0OCf2k.js`, `Queue-DFDcS_Y5.js`, `BatchSummary-_QJehRXa.js`.

## History

- Search title/copy/task id; filter by status, task type, aspect ratio and relative date; include clear-filter and empty-search states.
- Task actions: open output/task, copy source copy, favourite/unfavourite, rerun/duplicate where supported, enqueue failed/cancelled, delete record while preserving disk outputs.
- Multi-select: select eligible, delete, enqueue failed/cancelled. Clearly disable invalid actions.

## Queue

- Queue consists of drafts/eligible tasks, supports selection, select all, edit/view, delete, immediate start and scheduled start/cancel.
- Batch states: idle, scheduled, running, paused for review, paused for edit, success/failure counts, skip current, continue current and cancel batch.
- Never fake activation/credit success. Independent mode should run its real local queue and mark original quota/licensing checks as unavailable.

## Batch summary

- Show total/completed/failed/cancelled, duration and step reached; open failed task, return to queue and demote failed/cancelled tasks to drafts when the local API supports it.

## Verification

- Refresh preserves server-backed task state.
- Actions have confirmation/error states and never delete output folders.
