# Storybound v1.16.1 独立复刻验收报告

验收日期：2026-07-30  
目标版本：Storybound v1.16.1  
实现位置：`clones/storybound/desktop-app`

## 结论

本项目已完成 Storybound v1.16.1 可观察客户端界面与主要工作流的完整独立复刻，并形成可真实运行的本地生产闭环。它不是原站服务器代码的副本，也不连接原站的账户、支付、积分或私有计费服务。

完成范围包括：全部活动路由、三类创作入口、图文 7 步流水线、原客户端随包提示词、真实 LLM/图片/TTS 适配、逐镜与连续旁白、任务恢复、模板和素材消费、市场安装、队列与历史、ASR 适配、真实 MP4、剪映草稿和移动端响应式界面。

## 证据基线

- 官方公开页面：`https://storybound.cc/`
- Windows v1.16.1 安装包静态分析；SHA-256：
  `EE05BCDD40F60152A631261AEA0B9839058CE827546C21DDD3D7E328755C899B`
- 提取 825 个 Tauri 静态资源文件；活动入口：
  `assets/index-jF7neVyo.js`
- 语速以活动客户端运行数组为准：`0.85× / 1.0× / 1.15× / 1.3×`，
  默认 `1.0×`。公开落地页所写“5 档”与运行包不一致。
- 原版随前端分发的提示词已结构化提取，按赛道、画风和步骤接入本地流水线。

详细来源见 [EVIDENCE.md](./EVIDENCE.md)。

## 功能闭环

- 图文任务：全自动、半自动、直接出片；7 步暂停、确认、继续、取消、修复和指定步骤重跑。
- 文案与分镜：预审、WriterAgent 改写与自评、封面五字段、尾部锚点分镜、人物一致性卡、绘图提示词。
- 图像：MiniMax `image-01`、人物参考图、批量并发、失败重试、单镜重画、替换、补位、裁切；另支持用户自有 OpenAI-compatible 图片接口。
- 配音：MiniMax 与火山/豆包 TTS、平台音色、声音克隆、长文本分段、逐镜真实时长时间轴、连续旁白可选模式。
- 草稿与成片：图片、音频、字幕、标题、封面和 BGM 独立轨道；剪映目录与 ZIP；Chromium HTML/CSS 逐帧渲染和 FFmpeg H.264/AAC MP4。
- 工作台：任务队列、历史搜索与筛选、重命名、批次摘要导出、人物素材、提示词、草稿模板、画图/配音实验室、创作市场、选品、对标公开单视频解析和本地 ASR。
- 持久化：每任务独立目录、`task.json`、`events.ndjson`、素材和产物；刷新、重启和任务直达 URL 恢复。

## 自动化与浏览器验收

| 检查 | 结果 |
| --- | --- |
| 桌面应用 lint | 通过 |
| 桌面应用 TypeScript + Vite production build | 通过 |
| 根项目 ESLint、TypeScript、Next.js build | 通过 |
| 服务端 JavaScript 语法检查 | 通过 |
| 任务生命周期与剪映包 smoke | 通过：8 条轨道、16 个文件 |
| 真实媒体工作台 smoke | 通过：Chromium HTML 帧渲染、H.264/AAC MP4、剪映 ZIP |
| 17 条路由 × 桌面 1280×820 | 全部打开，无运行时或控制台错误 |
| 17 条路由 × 手机 390×844 | 全部打开，无全局横向溢出 |
| 市场资源安装后被任务消费 | 通过 |
| 人物素材组导入任务 | 通过 |
| 自定义草稿模板被任务消费 | 通过 |
| 图片 provider 会话配置 | 通过 |
| 历史筛选、重命名、批次导出 | 通过 |
| 可配置 ASR 命令适配 | 通过 |
| 对标公开分享链接真实解析、封面和媒体下载 | 通过 |
| `faster-whisper` 自动发现及公开视频一键文案提取 | 通过 |
| OpenAI-compatible 图片适配 | 通过 |

移动端筛选标签使用预期的局部横向滚动；页面根节点、正文和主工作区没有全局横向溢出。

## 真实媒体证据

最近一次完整媒体 smoke：

- Job：`media-b8445553-8b7d-4597-b609-f8bfdadc2a41`
- MP4：`desktop-app/.storybound-data/media-workbench/jobs/media-b8445553-8b7d-4597-b609-f8bfdadc2a41/output/storybound-html-video.mp4`
- Manifest：`desktop-app/.storybound-data/media-workbench/jobs/media-b8445553-8b7d-4597-b609-f8bfdadc2a41/output/manifest.json`
- 剪映 ZIP：`desktop-app/.storybound-data/media-workbench/jobs/media-b8445553-8b7d-4597-b609-f8bfdadc2a41/output/jianying-draft.zip`
- 视频：540×960、30 fps、H.264、13.908 秒
- 音频：AAC
- HTML 渲染器：`chromium-html-frames`
- MP4 大小：1,185,953 bytes
- ZIP 大小：1,051,367 bytes

已抽查开头、中段、结尾和镜头切换附近画面：未发现黑帧、异常拉伸或明显重复帧；字幕位于手机安全区，图像清晰，场景样式和动画生效。媒体文件属于本机运行产物，已由 `.gitignore` 排除，不上传凭据或生成内容到 Git。

HTML 成片优先使用本机 Chrome 或 Edge 做真实浏览器逐帧渲染；若机器上不可用，会回退到 FFmpeg/ASS 渲染，并在 manifest 中记录实际 renderer。

## 安全验收

- 服务默认只监听 `127.0.0.1`。
- 非 localhost 请求在未配置 `STORYBOUND_PUBLIC_ACCESS_TOKEN` 时返回拒绝响应。
- 配置令牌后支持一次性 URL 令牌、HttpOnly Cookie 和 Bearer Token。
- MiniMax 与 LLM 本机凭据只由服务端读取；状态接口不返回密钥明文。
- ASR 使用 `execFile` 和 JSON 参数数组，不经过 shell；限制上传大小并清理临时文件。公开视频下载仅接受解析服务返回的 HTTPS 公网地址，拒绝私网目标并限制为 128 MB。
- 图片兼容接口要求 HTTPS；仅允许回环地址在本地开发时使用 HTTP。
- 源码和已检查的导出文件未发现真实 API Key 或开发者个人绝对工具路径。

## 诚实边界

以下不可从公开客户端证据中复制，因此实现为明确标注的本地等价功能：

- 原站订阅、激活、积分、支付、公告和更新后台；
- 原站“全能绘图”、即梦、RunningHub 等私有计费代理；
- 原站多人市场、账号数据、云端任务和视频号数据源；
- 未公开的服务端提示词、模型路由、风控和运营规则。

因此，本报告的“完整复刻”含义是：对 v1.16.1 可观察客户端路由、交互和生产流程提供完整、可验证、可真实生成媒体的独立本地实现；不宣称与不可获得的私有服务逐字节、逐帧或后台行为完全相同。
