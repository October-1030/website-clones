# Page Interactions Specification

## Overview
- Target file: `src/components/StoryboundInteractions.tsx`
- Interaction model: mouse, scroll, click, and user-agent routing

## Required behaviors
- Add mousemove listeners to `.feature` cards; update `--mx` and `--my` percentages from the pointer location.
- Add hero parallax using one requestAnimationFrame at a time. Orbs move by `x*16`, `y*12`; scene moves by 35% of that.
- Reset hero transforms on mouseleave.
- Add throttled spark creation to `.hero` and `.final-cta`; 48ms minimum interval and 1400ms removal.
- Resolve every `a[data-dl="auto"]` to `/dl/mac` for Apple user agents and `/dl/win` otherwise.
- Toggle `.visible` on `.back-to-top` above 600px and scroll smoothly to top when clicked.

## Cleanup
- Remove every registered event listener.
- Cancel pending animation frames and spark removal timers during unmount.

## Responsive behavior
- Mouse-only enhancements should be harmless on touch devices; core anchor, FAQ, and download interactions remain native.

