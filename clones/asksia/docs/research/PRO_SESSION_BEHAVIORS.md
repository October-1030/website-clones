# AskSia Pro Session Behaviors

## Captured states

### Home before input

- Usage banner reads `You have 7 usage left. Upgrade to enjoy seamless study journey.` during the second live test.
- Composer send action is a dark circular button with a white upward arrow.
- The Homework solver shortcut is available in the tools row.
- The page shows `Get Sia everywhere` selected, a rotating onboarding banner, and `0/2` progress.

### Home with Homework solver selected

- The input mode changes to `Homework solver` and exposes `Clear input mode`.
- The send button becomes enabled when the composer has text.

### Generating

- The sent question appears as a paragraph.
- The answer area shows `Thinking...`, a seconds counter, then `Preparing your answer...` / `Working...`.
- The `Stop` action is visible while generation is active.

### Completed result

- Math is rendered in dedicated display blocks with unit-aware inline math.
- The response contains headings and numbered/semantic steps.
- A result row exposes `Visual map`, regenerate, copy, add, Like, and Dislike actions.
- Suggested follow-ups render below the answer.

## Responsive behavior

- Desktop uses the fixed rail and a centered workspace with a wide composer.
- At tablet width the rail remains, but the home content and composer use narrower gutters.
- At mobile width the rail compresses to an icon-only strip, the composer fills the available width, and the answer content becomes a single column.

## Local clone decisions

- No login, upload, recording, payment, LMS integration, or real network calls are included.
- The clone uses deterministic local responses for the observed calculus question and the follow-up physics test, plus a generic fallback answer for other text.
- Usage decrements once per submitted question and persists only for the current browser session.
