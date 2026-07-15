# FAQ, Final CTA, and Footer Specification

## Overview
- Targets: `#faq`, `.final-cta`, footer
- Interaction model: native disclosure click + CTA mouse sparks

## Computed styles
- FAQ first open item desktop: 820×168.35px, 12px radius, background `rgb(18,43,34)`, border `rgba(74,222,128,.5)`.
- FAQ first open item mobile: 342.4×267.1px.
- Final CTA desktop: 1440×516.7px, padding `120px 0`, overflow hidden.
- Mobile final CTA: 390×599.8px.
- Footer desktop grid: 1152px wide, three columns `362.05px 301.71px 392.24px`, 48px gap.
- Footer mobile: one 342.4px column, 32px gap, 561.35px high.

## States and behavior
- First FAQ is open by default; summary click toggles open state.
- Open FAQ changes border to mint and rotates the plus control.
- Final CTA emits the same cursor spark particles as the hero.
- Footer links change from faint white to mint/stronger white on hover.

## Assets
- `/users/qrcode-wechat.png`

## Text content
- Heading: `还有些疑问？`
- CTA: `还在等什么？让 AI 帮你做出第一条片`
- Buttons: `立即下载 Storybound`, `看演示视频`.

