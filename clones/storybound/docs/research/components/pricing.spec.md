# Pricing Specification

## Overview
- Target: `#pricing`
- Interaction model: hover and external purchase links

## Computed styles
- Desktop pricing grid: 1152px wide, three ~370.66px columns, 20px gap, 587.85px high.
- Plan card: flex column, 28px radius, padding `40px 32px`, background `rgb(18,43,34)`.
- Mobile: one 342.4px column, 32px gap, total grid height 1758.6px; first plan height 553.38px.

## Plans
- 月卡: ¥99/月, 90 tasks, 2 devices, 8 points.
- 年卡: ¥699/年, 150 tasks/month, 2 devices, 40 points, recommended.
- 永久卡: ¥1899 once, 300 tasks/month, 3 devices, 120 points, VIP support.
- Credit packs provide flexible extra image generation.

## States and behavior
- Cards lift and gain mint border/shadow on hover over 250ms.
- Primary CTA uses a green vertical gradient and brighter hover state.

