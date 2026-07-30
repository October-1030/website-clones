# Storybound v1.16.1 Evidence

## Source

- Public landing page: `https://storybound.cc/`
- Windows installer redirect: `https://updates.52aibot.com/storybound/win-x64/1.16.1/setup.exe`
- Installer SHA-256: `EE05BCDD40F60152A631261AEA0B9839058CE827546C21DDD3D7E328755C899B`
- Installer signature status: `NotSigned`
- Installer type: NSIS 3 Unicode
- Static-only inspection: the installer was not installed or executed.
- Embedded Tauri assets extracted: 825 files.
- Active entry bundle: `assets/index-jF7neVyo.js`
- Active stylesheet: `assets/index-P8YqdGQU.css`

## Version contract visible on the official page

`v1.16.1 · 字幕行号超字标红 + 对标账号搜索`

The public page also explicitly advertises:

- 即梦 + 全能绘图双引擎，3 路并发
- AI 自定义风格
- 人像参考图
- 火山引擎 + MiniMax TTS
- 声音克隆
- 5 档语速
- 原生剪映 draft、模板系统和重新打包

### Runtime speed evidence

The landing page's “5 档语速” copy does not match the active v1.16.1
client bundle. The runtime array in `assets/index-jF7neVyo.js` contains
exactly four selectable values:

```js
[
  { value: 0.85, name: "慢速" },
  { value: 1, name: "默认" },
  { value: 1.15, name: "快速" },
  { value: 1.3, name: "更快" },
]
```

The independent clone follows the active runtime behavior and defaults to
`1.0×`. It does not invent a fifth speed solely to match landing-page copy.

## Active application chunks

- `CreatePage-CWZrgew_.js`
- `Task-CJELH9m3.js`
- `PlaygroundPage-D7Xv6J2u.js`
- `VoiceLabPage-BjuU2eWZ.js`
- `PersonAssetsPage-DzSk3uTe.js`
- `PromptTemplatesList-CyqLFI5U.js`
- `TemplateEditor-DlTXtuMu.js`
- `BookSelectionPage-DkTPCpth.js`
- `BenchmarkPage-DTHChMsh.js`
- `MarketPage-DcxHBCqH.js`
- `HtmlVideoPage-HBXz31xy.js`
- `MusicMVPage-CjKFs8l8.js`
- `Settings-DrglM8mb.js`
- `Account-B6DbdH7U.js`

## Global visual tokens

- Font: `Noto Sans SC`, `PingFang SC`, `HarmonyOS Sans SC`, system sans-serif
- Monospace: `JetBrains Mono`
- Default dark background: `oklch(.165 .008 250)`
- Elevated background: `oklch(.195 .009 250)`
- Border: `oklch(.28 .01 250)`
- Text: `oklch(.96 .005 250)`
- Muted text: `oklch(.72 .008 250)`
- Brand: `oklch(.72 .16 168)`
- Radius scale: 4 / 6 / 8 / 12 / 16 px
- Sidebar width: 240 px

## Completeness implications

The prior clone's placeholder pages and simulated HTML/MV stages are not faithful.
The independent clone must implement useful local equivalents for every active route.
Original subscription, account, credits and marketplace backends must not be impersonated;
the clone must visibly label its own local/offline equivalents.
