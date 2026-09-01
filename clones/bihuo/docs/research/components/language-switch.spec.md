# LanguageSwitch specification

Target src/components/language-switch.tsx. Props locale: Locale, onChange(locale):void. Import Locale from @/types/auth.
Buttons 简体中文 (zh-CN), English (en), 繁體中文 (zh-TW). No responsive variation.
Container flex, gap6px, align center, justify flex-end, margin-top4px. Button padding2px 6px, font12px/1.4, radius6px, no border, transparent background, color #606266. Active color#bc1f1a background#f8e8e8 weight600. Hover text#bc1f1a. transition color/background .2s.
Add aria-pressed for current option. type=button, no form submit. Named export. Tailwind utilities; no inline styles.
Locale copy captured separately in src/lib/auth-copy.ts. Footer remains Chinese. Locale preference may be persisted only on the local clone; never persist account/password fields.
