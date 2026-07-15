# AppShell Specification

## Overview
- Target: `desktop-app/src/components/AppShell.tsx`
- Screenshot: `docs/design-references/app/create.png`
- Interaction model: click-driven navigation with fixed desktop chrome

## Structure
- 33px title bar, 30px trial/license banner, remaining height split into 240px sidebar + main content.
- Sidebar contains brand, new-task CTA, grouped navigation, credits card and footer actions.
- Main content scrolls independently; title bar, license banner and sidebar remain fixed in the application frame.

## Exact desktop styles (1280×820 runtime capture)
- Root background: `oklch(0.165 0.008 250)`; foreground `oklch(0.96 0.005 250)`.
- Font: `Noto Sans SC`, `PingFang SC`, `Microsoft YaHei`, sans-serif; base 14px/21px.
- Title bar: 32.8px high; background `oklch(0.14 0.008 250)`; 12px text.
- License banner: 30px high; padding 0 14px; gap 10px; background `oklch(0.1864 0.01856 249.2)`.
- Sidebar: width 240px; background `oklch(0.15 0.008 250)`.
- New task button: margin 4px 10px 14px; padding 8px 10px; radius 7px; green translucent background.
- Sidebar items use 13px labels, 8px radius, muted gray by default and brighter text/filled surface when active.

## Navigation
- New task `/create`.
- Queue, history.
- Playground, voice lab, person assets.
- Prompt templates, draft templates.
- Book selection, benchmark, market.
- Settings, account, activation.
- In this first implementation, unsupported destinations render an in-shell placeholder instead of leaving the app.

## Behaviors
- Clicking the brand/new task or pressing Ctrl/Cmd+N opens Create.
- Active nav item receives a filled dark surface.
- Credits card remains at sidebar bottom.
- Main region must be keyboard-scrollable and keep its own scroll position.

## Responsive
- Desktop target is 1280×820.
- Below 900px, collapse sidebar labels and keep a 64px icon rail.
- Below 680px, hide decorative title-bar controls and allow cards/forms to become one column.
