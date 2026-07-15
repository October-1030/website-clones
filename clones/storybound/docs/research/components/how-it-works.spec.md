# How It Works Specification

## Overview
- Target: `#how`
- Interaction model: static with hover

## DOM structure
- Centered section heading followed by `.steps` containing three `.step` cards.

## Computed styles
- Desktop grid: 1152px wide, three `370.66px` columns, 20px gap.
- Desktop card: 370.66×228.45px, padding `36px 28px 28px`, 18px radius, background `rgb(18,43,34)`.
- Mobile grid: one 342.4px column, 28px gap, total height 784.75px.
- Mobile card: 342.4px wide, approximately 250px high.

## States and behavior
- Hover: border becomes mint glow and card translates `Y(-3px)` over 250ms.

## Text content
- `从文案到视频只需要 3 步`
- `粘贴文案` — paste source copy or an idea fragment.
- `等待几分钟` — seven automated production steps.
- `剪映打开` — draft includes text, audio, images, and BGM.

## Responsive behavior
- Three columns above 980px; one column at and below 980px.

