# Extracted design tokens

- System font: ui-sans-serif, system-ui, sans-serif, Apple Color Emoji, Segoe UI Emoji, Segoe UI Symbol, Noto Color Emoji. No downloaded fonts needed.
- Primary #bc1f1a; hover #d0625e; soft primary #f8e8e8.
- Text #2d3748; heading #000; muted #7987a1; placeholder #9ca3af.
- Input background #fff; border rgba(15,23,42,.15); invalid #ff4d4f.
- Panel width 420px, border 2px white, radius 25px, padding 45px 50px, backdrop blur 10px, inset 0 0 20px white.
- Heading 30px/45px, weight 500, margin-bottom 35px.
- Input 46px tall, border 1px, radius 23px, padding 0 18px. Input text 14px/34px.
- Field margin-bottom 18px. Action margin-top 24px. Alternate link margin-top 20px.
- Button 46px tall, 15px/15px weight 500, radius 23px; shadow 0 2px 6px rgba(0,0,0,.05), inset 0 1px rgba(255,255,255,.25).
- Source browser DPR causes computed 2px/1px borders to snap to 1.6px/.8px; authored CSS remains 2px/1px.
- Tablet <=768px: panel max-width 400px, padding 40px 30px.
- Mobile <=480px: panel padding 30px 20px. At 390px panel ~350px wide.

See original-login.css for directly captured authored rules; computed-styles.json for actual rendered values.

## Dashboard

See dashboard-tokens.json, dashboard-css/ and components/dashboard-*.spec.md for inspected source tokens and layout. Main accent #bc1f1a; ink and neutral ramp use `oklch(from #bc1f1a ...)`. Numeric font stack is SF Mono / JetBrains Mono / Roboto Mono / ui-monospace / monospace, following original fallbacks. Cards are white with 28px padding and 24px gaps. Header title18px/28px; subtitle13px/18.5714px. Sidebar root rows34px and group rows32px. Responsive source breakpoints include1200,1100,992,900,800px.
