# Storybound 场景、配音与 BGM 复刻审计（2026-08-04）

## 结论

- 原客户端全局默认 TTS 是火山引擎 2.0 的 `zh_male_dongfanghaoran_uranus_bigtts`（东方浩然），语速 1.0×。
- 原客户端切换到 MiniMax 后的默认音色才是 `Chinese (Mandarin)_Reliable_Executive`（沉稳高管）。两者不是同一音色。
- 原客户端内置 `default-bgm.mp3`，默认选择 ID 为 `__builtin__`。模板默认旁白音量 10、BGM 音量 3、结尾淡出 2000 ms。
- 人物参考图必须按分镜决定是否使用；纯环境、建筑、街景、道具、文件、唱片、胶片和空镜不得附加人物参考图。

## 原版证据

- 客户端静态包：
  - `.tmp/storybound-1.16.1-assets/assets/index-27bFauVN.js`
  - `.tmp/storybound-1.17.0-assets/assets/index-27bFauVN.js`
  - `.tmp/storybound-1.17.0-assets/assets/index-4x08xVVG.js`
  - `.tmp/storybound-1.17.0-assets/assets/index-6cIQvgAY.js`
  - `.tmp/storybound-1.17.0-assets/assets/index-B-8Nqa_C.js`
- 原版 BGM：`.tmp/storybound-1.17.0/resources/default-bgm.mp3`
- BGM SHA-256：`ECCB60C3FB472755BDF922B0F04EAF23C8372CDA3274FF077089285F5C5621DC`
- BGM 媒体参数：MP3、44.1 kHz、双声道、258.011 秒、约 192 kbps。

## 本轮修复

1. 图片请求新增逐镜 `useReference` 契约，生成结果和任务产物均保存该值。
2. 人物故事自动保留多数人物镜头，同时强制约 28% 的环境/物件镜头；人物镜头按近景/中景/全景约 3:4:3 分布，禁止连续三张大头特写。
3. 当前李香兰任务已重新生成 62 条提示词：45 条人物参考镜头、17 条纯场景/物件镜头、13 条近景，最长连续近景 1 条。尚未重画图片，也未重新生成剪映草稿。
4. 新任务默认恢复原版内置 BGM；已有本地 BGM 的旧任务仍优先使用其已上传文件；任务可明确选择内置、本地或关闭。
5. 创建页明确显示原版默认音色与 MiniMax 默认音色的差异，避免把“沉稳高管”误认为“东方浩然”。

## 当前限制

- 本机只有 MiniMax 凭据，火山引擎状态为未配置，因此目前不能生成与原版默认完全相同的东方浩然配音。
- 当前李香兰已有图片和已有草稿没有自动覆盖；需先在图片工作台审查新提示词，再决定重画范围，最后统一重建草稿。

## 验证

- `npm.cmd run lint`：通过。
- `npm.cmd run build`：通过。
- `npm.cmd run smoke:task`：通过；任务、素材、BGM、字幕和剪映草稿闭环均成功。
- `http://127.0.0.1:5173/audio/default-bgm.mp3`：HTTP 200，资源可预览。
