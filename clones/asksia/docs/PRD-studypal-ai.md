# StudyPal AI 产品需求文档（PRD）

版本：0.8.0
状态：本地可运行版本  
更新日期：2026-07-24  
产品名称：StudyPal AI  
运行入口：`http://127.0.0.1:3000/pro/session`

## 1. 产品定位

StudyPal AI 是一个本地优先的学习工作台。它把用户自己的学习资料、作业题、公开视频字幕、播客文字稿和课堂音频组织成可恢复的学习会话，并围绕这些真实来源提供总结、追问、测验、学习指南和闪卡。

产品的核心原则：

1. 结果必须来自真实输入或明确标记的演示 provider。
2. 有来源时提供页码、章节或时间戳；无法引用时不伪造引用。
3. 密钥只在服务端读取，不进入浏览器、日志、会话文件或 Git。
4. 文件、录音、头像和账户设置遵循最小留存原则。
5. 不把尚未实现的 LMS、支付、云账户、移动悬浮窗包装成可用功能。
6. 竞品研究只用于理解信息架构与交互，不复制其品牌、私有源码、数据库、Prompt 或内部运营逻辑。

## 2. 目标用户与核心任务

### 2.1 目标用户

- 需要整理课程 PDF/TXT 的学生；
- 需要逐步理解数学、物理、化学等作业题的学生；
- 需要从公开视频字幕或课堂录音中复习的学生；
- 希望通过测验、指南、闪卡复习自己资料的学生；
- 希望改进自己的论文结构和写作表达、但不需要代写的学生。

### 2.2 核心闭环

```text
输入真实学习材料
  → 提取/转录
  → 结构化总结
  → 基于来源追问
  → 生成复习工具
  → 保存本地会话
  → Library 检索与恢复
```

## 3. 当前功能状态

| 模块 | 状态 | 真实能力 | 数据位置 |
|---|---|---|---|
| File Summary | 已完成 | PDF/TXT 提取、摘要、关键概念、复习问题、引用追问 | 服务端会话 + 浏览器会话 ID |
| AI Provider | 已完成 | MiniMax M3、OpenAI、明确演示模式；服务端结构校验 | `.env.local` 仅服务端读取 |
| Homework Solver | 已完成 | 题意、已知量、方法、步骤、答案、独立验算 | `.studypal-data/homework/` |
| Video Link Summary | 已完成 | 公共 YouTube 字幕、允许域名的播客文字稿、时间戳引用 | `.studypal-data/video/` |
| Live Transcribe | 已完成 | 麦克风/浏览器标签录音、本地 Faster-Whisper、时间戳 | `.studypal-data/transcribe/` |
| Quiz | 已完成 | 从最新文件会话生成，答案和解释引用原文 | localStorage |
| Study Guide | 已完成 | 概览、概念、问题、来源大纲、三轮复习计划 | localStorage |
| Flashcards | 已完成 | 来源支持的正反面、翻转与导航 | localStorage |
| Essay | 已完成 | Thesis 方向、六段提纲、草稿指标、修改清单 | localStorage |
| Writing Signals | 已完成 | 句长、词汇多样性、重复等指标；作者身份永远为不确定 | localStorage |
| Library | 已完成 | 文件、作业、视频、转录元数据检索、筛选、恢复链接 | 服务端只读索引 |
| Account/Personalization | 已完成 | 本地显示名与个性化；可选 Supabase Auth 云账户 | localStorage + Supabase profiles |
| Public Search | 已完成 | 英文/中文 Wikipedia 限域检索、直接来源链接 | 最近一次结果 localStorage |
| Portrait Studio | 已完成 | 本地裁剪、位置、缩放、三种风格、PNG 导出 | 不持久化原图 |
| Payments/Upgrade | 禁用 | 不付款、不购买、不伪造订阅 | 无 |
| Cloud sessions | 代码完成/待开通项目 | 登录后通过 Cookie + RLS 保存四类会话；显式导入本地记录 | Supabase Postgres |

## 4. 关键用户流程

### 4.1 文件学习闭环

1. 用户选择 File Summary。
2. 选择 PDF 或 UTF-8 TXT。
3. 客户端校验类型和 10 MB 大小限制。
4. 服务端验证文件签名并提取文字。
5. 返回：
   - 摘要；
   - 关键概念；
   - 复习问题；
   - 可引用的来源章节。
6. 用户输入追问。
7. 系统只从检索到的来源片段回答。
8. 若资料不支持结论，明确拒绝推断。
9. 页面刷新或通过 `session` 参数恢复。
10. 用户清除时删除浏览器和服务器会话。

### 4.2 首页提问与 Homework Solver

1. 用户在首页输入问题。
2. 首页不再生成预设答案，而是把问题带入真实 Homework Solver。
3. 用户检查完整题目后点击开始解题。
4. provider 返回结构化结果。
5. 服务端校验必填字段和步骤数量。
6. 会话保存并可从 Library 恢复。

### 4.3 视频与播客

1. 用户粘贴 HTTPS 链接。
2. 系统只允许 YouTube 或配置允许的播客域名。
3. 每次重定向重新做协议、主机和私网检查。
4. 只有公开字幕/结构化文字稿才继续。
5. 无公开文字稿时明确报错，不用简介冒充字幕。
6. 总结和追问使用时间戳/章节引用。

### 4.4 实时转录

1. 用户选择 Microphone 或 Browser Tab。
2. 浏览器明确请求对应权限。
3. 录音期间显示状态、时长和停止按钮。
4. 麦克风模式可显示浏览器临时字幕，但临时字幕不是最终结果。
5. Stop 后音频交给本地 Faster-Whisper。
6. 最终保存带时间戳的文字段落。
7. 无论成功、失败或取消，临时音频都删除。
8. 上限：10 分钟、50 MB；超时可取消并终止子进程。

### 4.5 复习工具

前提：浏览器存在一份最新的有效文件学习会话。

- Quiz：选择 3/5/8 题；答题后显示正确性、解释和引用。
- Study Guide：显示摘要、关键概念、复习题、来源大纲和可勾选复习计划。
- Flashcards：生成来源支持的卡片，可翻转、上一张、下一张。

若没有来源，必须显示“先上传资料”，不得生成通用假内容。

### 4.6 写作工具

- Essay：
  - 必填题目；
  - 草稿可选；
  - 输出论点方向、提纲和可衡量的修改建议；
  - 不生成可直接提交的完整论文。
- Writing Signals：
  - 至少 80 个字符；
  - 只显示可测量写作信号；
  - 不输出“AI 概率”；
  - 不用于学术不端定罪。

### 4.7 Library

1. 服务端最多读取每类 100 个合法 JSON 会话。
2. 单文件最大 5 MB。
3. 文件名必须通过白名单正则。
4. 损坏、超大或结构无效文件被忽略。
5. API 只返回标题、类型、provider、更新时间和恢复链接，不返回完整来源文本。
6. 客户端支持关键字搜索和类型筛选。

### 4.8 公开检索

1. 查询长度 2–200 字符。
2. 中文查询使用 `zh.wikipedia.org`，其他使用 `en.wikipedia.org`。
3. 服务端只请求固定的 MediaWiki REST Search endpoint。
4. 每次最多 8 条结果，12 秒超时。
5. 清理 API excerpt 中的 HTML 标记。
6. 每条结果必须保留 Wikipedia 直接链接。
7. 不接受用户自定义目标 URL，避免 SSRF。

### 4.9 本地头像工作室

1. 仅接受 JPEG、PNG、WebP，最大 10 MB。
2. 原图通过浏览器 Object URL 加载，不上传服务器。
3. 用户可选择 Classic、Leadership、Black & White。
4. 用户可调整缩放和位置。
5. 导出 800 × 800 PNG。
6. 关闭或换图时释放 Object URL。
7. 明确说明这不是 AI 换脸或生物识别。

## 5. 信息架构

```text
/pro/session
├── Home
│   ├── File Summary
│   ├── Homework Solver
│   ├── Video Link Summary
│   ├── Live Transcribe
│   ├── Quiz
│   ├── Study Guide
│   ├── Flashcards
│   ├── Essay
│   ├── Writing Signals
│   ├── Public Search
│   └── Portrait Studio
├── Library
│   ├── Search
│   ├── Type filters
│   └── Session restore links
└── Local profile
    ├── Account settings
    ├── Personalization
    ├── Update log
    └── Help
```

## 6. 技术架构

### 6.1 技术栈

- Next.js 16 App Router；
- React 19；
- TypeScript；
- Node.js；
- 本机文件系统 JSON 会话；
- 浏览器 localStorage；
- Faster-Whisper（本地 Python 运行时）；
- MiniMax M3 / OpenAI 可替换 provider；
- Playwright + 本机 Chrome 做 E2E。

### 6.2 API

```text
POST   /api/study/extract
POST   /api/study/ask
GET    /api/study/session/:id
DELETE /api/study/session/:id

POST   /api/homework/solve
GET    /api/homework/session/:id
DELETE /api/homework/session/:id

POST   /api/video/summarize
POST   /api/video/ask
GET    /api/video/session/:id
DELETE /api/video/session/:id

POST   /api/transcribe
GET    /api/transcribe/session/:id
DELETE /api/transcribe/session/:id

GET    /api/library
POST   /api/web-search
```

### 6.3 配置

完整配置见 `.env.example`。关键规则：

- `.env.local` 必须被 Git 忽略；
- 不在 `NEXT_PUBLIC_*` 中放模型密钥；
- API 错误不回显密钥、请求头或完整环境变量；
- provider 输出先做服务端结构校验；
- MiniMax/OpenAI 请求设置 `store: false`；
- 资料追问只把受限检索片段发送给模型。

## 7. 安全与隐私

### 7.1 默认禁止

- 付款、购买、订阅和升级；
- 删除真实云账户；
- 对外发送消息、邀请用户或公开发布；
- 登录第三方 LMS；
- 读取浏览器密码、Cookie 或完整个人资料；
- 上传头像到服务器；
- 任意 URL 抓取；
- 用写作特征判定学术不端。

### 7.2 文件和路径

- 会话 ID 与文件名使用白名单校验；
- 服务端数据目录固定在配置路径内；
- 原始上传二进制不持久保存；
- 录音临时文件在所有退出路径清除；
- Library 不返回完整来源正文。

### 7.3 网络

- 视频和播客使用协议/域名/私网阻断；
- Wikipedia 查询主机固定；
- 所有外部请求有超时；
- 浏览器结果链接使用 `noopener` / `noreferrer`。

## 8. 错误态与恢复

所有真实处理模块至少覆盖：

- 输入为空；
- 类型不支持；
- 文件过大；
- 解析失败；
- provider 未配置；
- provider 超时或格式错误；
- 会话损坏或不存在；
- 网络失败；
- 权限被拒绝；
- 用户取消；
- 页面刷新恢复；
- 清除会话。

UI 不得把错误吞掉，也不得用成功 Toast 掩盖失败。

## 9. 验收标准

### 9.1 自动化

必须通过：

```bash
npm run typecheck
npm run lint
npm test
npm run build
npm run test:e2e:final
```

### 9.2 E2E 覆盖

- 桌面 1440px；
- 移动端 390px；
- Quiz 生成与答题反馈；
- Study Guide 生成与计划勾选；
- Flashcard 生成与翻转；
- Essay 计划；
- Writing Signals 的 `Indeterminate` 结果；
- 公开检索与来源链接；
- 本地头像预览和 PNG 下载；
- 显示名保存；
- Library 搜索与空状态；
- 无 Console error、page error、失败网络请求；
- 保存截图、trace、浏览器版本和 JSON 报告。

### 9.3 当前验收结果

版本 0.8.0 的本地与云账户边界套件已通过：

- 单元/API 测试：53/53；
- TypeScript：通过；
- ESLint：0 error（仅保留历史研究脚本和本地图像的非阻塞 warning）；
- Next.js production build：通过；
- 最终桌面/移动 E2E：通过；
- 精确秘密扫描：通过；
- E2E Console/Page/Network 错误：0/0/0。

证据目录：

```text
docs/evidence/final-study-suite/2026-07-24T08-40-02-939Z/
```

## 10. 明确的后续独立项目

以下内容不是当前本地网页“再写几个按钮”就能安全完成，必须单独立项：

1. LMS Connector：Canvas、Blackboard、Brightspace、Moodle OAuth、权限和课程同步。
2. Browser Extension：扩展权限、商店审核、页面注入和隐私披露。
3. Mobile Overlay：Android/iOS 原生应用、系统悬浮权限、后台音频和实时翻译。
4. Cloud Account：数据库、认证、跨设备同步、账户删除和隐私请求。
5. Billing：支付服务、订阅、发票、退款和合规。
6. Expanded ingestion：OCR、DOCX、PPTX、私有视频/音频。
7. AI portrait generation：专门图像模型、用户同意、敏感数据和滥用防护。

在这些独立项目完成前，StudyPal AI 应继续把相应入口标记为“不可用/计划中”，不得伪装成功。
