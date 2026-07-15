# ProSession Specification

## Overview

- **Target file:** `src/components/AskSiaWorkspace.tsx`
- **Interaction model:** click-driven mode/tabs/actions plus timed local generation state
- **Reference:** authenticated AskSia Pro session observed in Chrome at desktop viewport

## DOM Structure

`main.workspace` contains a fixed `aside.workspace-rail`, then a `section.workspace-content`. The home state contains `.welcome-panel`, `.usage-banner`, `.composer-card`, `.home-tabs`, and `.onboarding-card`. The result state contains `.conversation-header`, `.question-block`, `.answer-card`, `.result-toolbar`, `.suggestions`, and `.composer-card`.

## Visual tokens

- Canvas: `#ffffff` with soft radial gradients in lavender, blue, and peach.
- Rail: translucent white with a right border `#ececf5`.
- Ink: `#252435`; secondary text: `#818193`; border: `#e8e8f0`.
- Purple accent: `#5b58d6`; dark send button: `#4e4d58`.
- Composer: white, 630px desktop max width, 16px radius, subtle `0 8px 28px rgba(78,77,120,.08)` shadow.
- Body font: DM Sans; math/answer text uses a readable serif-like display style for visual contrast.

## States & Behaviors

- Home → Homework solver: click shortcut; add mode chip and clear action.
- Text → generating: click send or press Enter; show `Stop` and status labels.
- Generating → result: after a short local delay, render structured answer and action toolbar.
- Visual map: toggles a compact concept-flow panel.
- Like/Dislike: sets one feedback state and shows a feedback prompt.
- Suggested question: fills the composer without sending automatically.

## Verbatim content captured

- `Hi Elv, what are we studying today?`
- `You have 7 usage left. Upgrade to enjoy seamless study journey.`
- `Get Sia everywhere`
- `Library`
- `Homework solver`
- `Thinking...`, `Preparing your answer...`, `Working...`
- `Visual map`
- `You might be interested`

## Responsive behavior

- Desktop: 58px rail, content centered with a 630px composer.
- Tablet: 58px rail, reduced horizontal padding, answer max width 760px.
- Mobile: 48px rail, compact icons, composer and answer use nearly full width, onboarding card becomes inline.

## Assets

- No new remote assets required; the AskSia mark is rendered as a local CSS/SVG-style mark and all controls use `lucide-react`.
