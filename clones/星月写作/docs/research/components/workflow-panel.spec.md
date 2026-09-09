# WorkflowPanel

## Purpose

Reproduce the source site's workflow marketplace as a complete local workflow builder and runner. The page must support browsing, searching, sorting, saving/favoriting, creating/editing/deleting custom workflows, execution history, and running each workflow through the existing `/api/golden-opening` streaming provider.

## Source references

- `docs/design-references/source-workflow-home.png`
- `docs/research/full/workflow-home.json`
- `docs/design-references/source-workflow-create.png`
- `docs/research/full/workflow-create.json`

## Public API

```ts
interface WorkflowPanelProps {
  onBack?: () => void;
  books?: Book[];
}

export function WorkflowPanel(props: WorkflowPanelProps): React.ReactNode;
```

## Visual contract

- Keep the shared site header and sidebar outside this component; the panel fills the main content area.
- Header title `工作流`, tutorial link, `历史记录`, and a blue `创建工作流` button.
- Search field and search button, followed by tabs: `最热`, `最新`, `精选`, `我的工作流`, `我的收藏`.
- Desktop cards use the same white/gray surface, subtle border, 16px radius and blue run button shown in the source. Cards show score, use count, title, summary, creator, favorite control, and `运行`.
- At <= 760px controls wrap into a compact vertical layout and cards become one column.
- Do not copy personal contact information or promotional copy from public source cards. Seed only a small set of neutral, generic public examples.

## Behavior

- Search and tabs filter immediately.
- Favorites persist in `localStorage` under `xingyue-workflow-favorites`.
- Custom workflows persist under `xingyue-workflows`. They can be created, edited, cloned, and deleted after confirmation.
- Builder modal fields: name, description, category, system instruction, user input template, output length, and public/private toggle. A preview explains how `{{input}}` is substituted.
- `运行` opens a runner modal with selected book/chapter context, freeform input, generated output, loading state, stop, retry, copy, download, and `保存到作品` actions.
- Use `/api/golden-opening` for streaming generation with a workflow-specific prompt. Surface server configuration errors in the result area. Never claim generation succeeded if no provider is configured.
- Each run is stored under `xingyue-workflow-history` with workflow name, input, output or error, and timestamp. History modal supports search, reopen, copy, download, and delete/clear.
- Provide a deterministic local preview button in the builder that validates template substitution without calling the API.
- All icon-only buttons need Chinese aria labels and keyboard focus states.

## Acceptance

- No inert controls or placeholder alerts.
- A user can create a workflow, find it in `我的工作流`, run it, stop or retry, save/copy/download output, inspect history, favorite it, and delete it.
- TypeScript strict, named exports, no `any`, no inline styles.
