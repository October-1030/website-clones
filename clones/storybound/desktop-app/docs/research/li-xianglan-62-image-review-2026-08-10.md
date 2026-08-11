# 李香兰 62 镜图片复查记录（2026-08-10）

## 任务

- 任务 ID：`60e16696-c3fd-4a24-b5db-7844f56447d8`
- 标题：`李香兰（完整62镜构图重制·MiniMax）`
- 当前停点：Step 5 图片确认；未生成 TTS，未生成剪映草稿。
- 图片：62/62 张，均为 720×1280 的 9:16 JPG。

## 人物一致性契约

- 唯一主脸卡：用户已确认的第 3 镜。
- 已确认且禁止覆盖：第 3、6、17、55 镜。
- 所有近景和中景露脸镜头只使用第 3 镜主脸卡，不再混用青年、战后或晚年真人照片。
- 第 53 镜（约 60 岁）与第 56 镜（约 90 岁）使用从第 3 镜主脸卡派生的年龄卡；年龄卡只改变皱纹、皮肤松弛、灰白发和年代服装，不改变脸部骨相。
- 主脸卡派生文件：
  - `docs/research/character-references/li-xianglan/li-xianglan-approved-master-age-60.png`
  - `docs/research/character-references/li-xianglan/li-xianglan-approved-master-age-90.png`

## 本轮修正

- 修复后半段人物逐渐变成欧美面孔的问题。
- 修复人物参考标准在青年、战后和晚年照片之间切换的问题。
- 修复第 2、53 镜触发通用“中年男性看文件”兜底图的问题；仅接受 MiniMax 主提示结果（`retryLevel=0`）。
- 修复第 38 镜错误人物肖像、第 42 镜错误空桌、第 52 镜年龄与构图、第 54/62 镜纸面乱码、第 56 镜彩色问题。
- 保留并加强环境镜头、背影、全身与物件镜头；未把无人物镜头强行套用脸卡。

## 验证

- API 任务状态：`paused`，图片步骤完成，62 条分镜、62 条提示词、62 张可用图片。
- 主脸卡策略：`single-approved-master-face`，来源镜头：`3`。
- 配音段数：`0`。
- 剪映草稿：`null`。
- 本地图片文件：62 个，无缺失。
- 四组总览图（本地任务数据，不提交 Git）：
  - `.storybound-data/tasks/60e16696-c3fd-4a24-b5db-7844f56447d8/review/full-image-contact-sheets/01-16.jpg`
  - `.storybound-data/tasks/60e16696-c3fd-4a24-b5db-7844f56447d8/review/full-image-contact-sheets/17-32.jpg`
  - `.storybound-data/tasks/60e16696-c3fd-4a24-b5db-7844f56447d8/review/full-image-contact-sheets/33-48.jpg`
  - `.storybound-data/tasks/60e16696-c3fd-4a24-b5db-7844f56447d8/review/full-image-contact-sheets/49-62.jpg`

## 当前边界

- 这套图片使用公开历史照片与用户确认的 AI 分镜作为人物依据，不是原站作者的私有素材或逐像素原图。
- MiniMax 的单张人物参考会提高身份一致性，也会增加肖像化倾向；本轮只对脸部可辨认的近中景锁脸，远景、背影和无人空镜保留场景优先。
- 本轮停在图片确认闸门。用户确认图片后再生成 TTS 和剪映草稿，避免因图片继续修改而重复消耗。
