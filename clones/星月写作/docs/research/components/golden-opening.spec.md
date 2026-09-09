# Golden opening generator

Inspected 2026-09-01 at https://xingyuexiezuo.com/ via 创意 → 黄金开篇生成器.
Reference: `docs/design-references/original-golden-opening.png`; DOM: `golden-opening-dom.txt`.

Click-driven tool dialog. Desktop width 1200px, radius 20px, background #f8fafc,
14px system font, about 95vh. Left preset menu ~40%, scrollable form ~60%,
fixed header/footer. Source preset rows 48px; fields 35px minimum; primary #55759b.
Form includes AI模型, 提示词, theme, setting, tags, genre style, special ability,
protagonist/plot, supplementary information, optional associated work/context.
Source generation was not submitted: account credits and private prompt bodies untouched.

Local behavior: separate generator reached from 创意, library quick entry, and onboarding.
Locally authored first-chapter/three-chapter/suspense/romance presets, visibly named 内置方案;
do not claim these are the community authors' proprietary prompts or source models.
Editable custom prompt, length, optional context from a selected local work.
Model settings accept a DeepSeek key in React memory only, or use server environment settings.
Actual streaming API response only; no template prose passed off as generated output.
Loading, stop, configuration error, upstream error, incomplete output and retry are explicit.
Output can be edited, copied, downloaded, saved as a new local novel and opened in editor.
Mobile adaptation: preset select above form, single column, scrollable content, wrapping footer.
Persist story settings and result locally; keys never persist or appear in error/log messages.
