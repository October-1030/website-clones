# Storybound Behaviors

## Interaction models

- Navigation: sticky at `top: 0`, 64px high, anchor-driven smooth scrolling with `scroll-margin-top: 80px`.
- Responsive navigation: `.nav-links` is hidden below 980px; brand and download action remain visible.
- Hero: mouse-driven parallax. `.hero-orbs` moves up to 16px/12px and `.hero-scene` moves at 35% of that offset.
- Hero and final CTA: mouse movement emits throttled spark particles every 48ms; particles animate for 1300ms.
- Feature cards: hover changes border to `rgba(74,222,128,0.5)` and a radial highlight follows CSS variables `--mx` / `--my`.
- Step cards: hover lifts 3px and changes border to the mint glow color.
- Track, plan, proof, and button cards: hover changes border/background and applies small translate/shadow transitions.
- FAQ: native `<details>` click interaction. The first item is open by default; open state uses mint border and rotates the plus icon.
- Download routing: `data-dl="auto"` resolves to `/dl/mac` on Apple user agents and `/dl/win` otherwise.
- Back to top: appears after scroll position 600px, fades/translates in over 250ms, and scrolls smoothly to top on click.

## Responsive sweep

- Desktop 1440px: page height 10,440px; feature cards use two columns; pricing uses three columns; tracks use four columns; pipeline uses seven columns.
- Tablet 768px: page height 13,746px; nav links hidden; features become one column; tracks/proof become two columns; pipeline becomes four columns; pricing becomes one column.
- Mobile 390px: page height 14,246px; hero height 820px; features one column; tracks and pipeline remain two columns; pricing and proof become one column; footer becomes one column.

## Source artifacts

- `raw/original.js` contains the verbatim original behavior implementation.
- `raw/computed-desktop.json`, `raw/computed-tablet.json`, and `raw/computed-mobile.json` contain the measured styles.

