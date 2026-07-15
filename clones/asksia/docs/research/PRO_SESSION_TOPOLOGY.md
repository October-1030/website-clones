# AskSia Pro Session Topology

## Target

The authenticated `https://www.asksia.ai/pro/session` workspace observed in Chrome on 2026-07-15. The clone is a local, deterministic demo: it does not connect to AskSia services or expose real account data.

## Visual order

1. Fixed 58px left rail with the AskSia mark, navigation glyphs, and the `E` profile avatar.
2. Home workspace canvas with a soft white/lilac/blue radial background.
3. Centered greeting and usage banner.
4. Composer card with a text area, Tools, Deep think, mode chip, image action, and circular send action.
5. Home content tabs: `Get Sia everywhere` and `Library`.
6. Small onboarding card in the lower-right corner.
7. After sending, the canvas becomes a conversation view with material controls, the question, answer content, result toolbar, feedback, recommended follow-ups, and a persistent composer.

## Positioning and layers

- The rail is fixed to the left edge and stays above the canvas.
- The composer and conversation content are centered inside the remaining viewport.
- The onboarding card is fixed to the bottom-right on the home state.
- The workspace background is a flow-level radial gradient; it does not scroll in the home state.

## Interaction models

- Rail controls: click-driven visual selection.
- Home content tabs: click-driven selection.
- Composer mode: click-driven toggle; `Homework solver` changes the mode chip and sends a homework-style response.
- Send: click or Enter; mock generation transitions through `Thinking...`, then `Working...`, then renders the deterministic answer.
- Result actions: click-driven copy, regenerate, Visual map toggle, and Like/Dislike feedback.
- Suggested questions: click-driven fill into the composer.
