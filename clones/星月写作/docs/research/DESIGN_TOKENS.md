# 星月写作 — extracted design tokens

Source: https://xingyuexiezuo.com/ inspected 2026-09-01, visible 雾灰 appearance.
Raw computed values and geometry: desktop-dom.json, community-dom.json, create-dialog.json.

| Token | Value |
| --- | --- |
| Background | #f1f4f7 |
| Panels | #f8fafc |
| Text | #27313e |
| Secondary text | #667386 |
| Primary | #55759b |
| Borders | #cbd5e1 |
| Soft surface | #e9edf2 |
| Alert background | #e7f0fb |
| Panel shadow | 0 8px 24px rgba(55,65,81,.12) |
| Main panel / create card radius | 16px / 20px |
| Header / sidebar | 60px / 150px |
| Page padding / gap | 16px / 16px |
| Community width | 280px |
| Body font / line height | 14px / 22.4px |
| Body family | v-sans, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif |

No custom font files were present in the observed workbench. The implementation uses the observed system fallback stack. The authenticated profile avatar is not copied; the public site favicon is used instead.
