# AskSia 课程学习平台 PRD

版本：0.2（登录后验证版）  
日期：2026-07-15  
研究对象：AskSia 公开页面与已登录 `https://www.asksia.ai/pro/session` 的 Chrome 实测

## 0. 证据分层

- **已实测**：本轮使用已登录 Chrome 观察到的页面、菜单、状态和结果。
- **公开资料**：未登录公开页、帮助页、产品宣传页中可见的描述。
- **用户补充 / 待验证**：用户明确提供、但本轮没有用 Web 端真实功能验证的事实。
- **合理推断**：根据 UI 或公开资料做出的产品结构推断，不可当作后端契约。
- **不可观察**：真实 Prompt、模型、数据库、额度服务和私有 API 行为。

## 1. 已验证的产品结论

AskSia 登录后是一个统一学习工作台，不是互相独立的工具页。主输入框保持不变，工具通过模式切换进入：

```text
登录后 /pro/session
  ├─ Live transcribe
  ├─ File summary
  ├─ Homework solver
  ├─ Video Link summary
  ├─ Tools / More
  │   ├─ Quiz / Study guide / Essay / AI detector / Flashcard
  │   ├─ LinkedIn headshot / Web search
  │   └─ 其他本地工具入口
  └─ 共享输入 → Stop → Thinking... → Working... → 结果
       ├─ Like / Dislike
       ├─ Visual map / 复制 / 重新生成
       └─ 3 条推荐追问
```

### 1.1 证据表

| 事实 | 状态 | 说明 |
|---|---|---|
| Onboarding 有 LMS 介绍、Agent 介绍、用途选择 | 已实测 | LMS 页含 Canvas/Blackboard/Brightspace、Install Extension/Next/Skip；Agent 页含 Continue/Skip。 |
| 登录后 `/pro/session` 为统一输入工作台 | 已实测 | 空态显示问候、usage、主输入框和工具入口。 |
| 空输入发送禁用、`Clear input mode` 可见 | 已实测 | Homework solver 选中后模式 chip 与清除动作出现。 |
| 发送状态为 Stop → Thinking → Working → 完成 | 已实测 | 两次题目测试均观察到该状态链。 |
| Homework solver 数学推导正确 | 已实测 | `∫₀¹ x e^(x²) dx` 给出 `u=x²`、换元、`(e-1)/2` 和求导验算；未显示引用和小数近似。 |
| Homework solver 物理推导正确 | 已实测 | `2.0 kg / 6.0 N / 4.0 m` 得到 `a=3.0 m/s²`、`v≈4.9 m/s`，并用功-能定理复核。 |
| 结果有 Like/Dislike、Visual map、复制/重新生成、推荐追问 | 已实测 | 结果 toolbar 和 3 条推荐追问可见；未点击真实账号控件。 |
| Web search 共享工作台未见引用卡片 | 已实测 | 只确认入口和共享工作台形态，不推断后端检索。 |
| 主工具和 More/Tools 菜单 | 已实测 | Live transcribe、File summary、Homework solver、Video Link summary、More、Tools、Deep think 可见；工具列表来自登录后检查。 |
| File summary 文件类型 | 已实测 | PDF、Word、PowerPoint、Audio、Video 作为输入提示可见；真实上传结果未测试。 |
| Live transcribe 音源弹窗 | 已实测 | `Choose your audio source → Microphone / Browser Tab`；未接受权限。 |
| AI detector 独立额度 | 已实测 | 68 字符测试显示 AI Detection、AI Content Ratio、LOW 和文字解释；未显示明确数值比例，独立 `0/10000 Chars`。 |
| 免费额度初始与当前值 | 已实测 | 本轮开始通用 usage 为 10，真实数学题后为 8，再发送物理题后为 7；File Page `0/100 Pages`、Recording `0/10 Minutes`。 |
| Home content 与 Library | 已实测 | `Get Sia everywhere / Library`；卡片 AskSia App、Sia Agent、AskSia Extension。 |
| 学校筛选与 Adelaide 课程卡片 | 已实测 | `/library/course-support?school=Adelaide%20University` 含 Course/Discipline 筛选、Upload material、My profile 和课程卡片。 |
| 账户菜单与 Personalization | 已实测 | Free、Upgrade、Credits Used、Reward、Update log、Account settings、Personalization、Help center、Sign out；设置含用户名/头像、语言、语气、学习风格、Memory。 |
| Help Center 分类与 LMS 名称 | 已实测 | Getting Started、Products & Apps、Subscription & Billing、LMS Integrations、Study Tools、Account & Privacy、Troubleshooting、Community & Ambassadors、Legal；LMS 含 Canvas、Blackboard、Brightspace、Moodle、Everytime、Echo360、CyberCampus。 |
| 手机端悬浮实时转录/翻译 | 用户补充 / 待验证 | 关键能力，但本轮只验证 Web；必须标记为移动端待验证。 |
| 真实文件上传、录音、LMS 同步、扩展安装、付款、删除 | 不可观察 / 待验证 | 本轮明确未执行这些有外部副作用的操作。 |

## 2. 目标与边界

### 2.1 目标

1. 在本地 clone 中复现登录后工作台的视觉层级和核心交互。
2. 让用户可以从空态选择工具、切换模式、输入问题、看到生成状态和结构化结果。
3. 用本地 mock 复现已实测的数学和物理 Homework solver 结果，不伪造真实 AI 或引用。
4. 在桌面优先的同时支持 320px、390px、768px、1024px 和 1440px 宽度。
5. 为需要后端的能力提供清晰空态，不把未测试的能力包装成已完成。

### 2.2 非目标

- 不实现真实 AI、真实上传、麦克风权限、后台录音、LMS 同步、扩展安装、付款、账号删除或 Sign out。
- 不伪造引用卡片、文件页码、录音时间戳、真实 AI 检测比例或后端配额。
- 不访问或修改 `D:\projects\AaronT` 及其他项目。

## 3. 真实导航树

```text
AskSia
├─ /pro/session                         统一学习工作台（已实测）
│  ├─ Live transcribe                    音源选择弹窗（已实测）
│  ├─ File summary                       文件类型空态（已实测）
│  ├─ Homework solver                    文字题本地 mock（已实测）
│  ├─ Video Link summary                 URL 输入空态（已实测）
│  ├─ Tools / More                       Quiz / Study guide / Essay / ...
│  └─ Account menu                       配额、设置、帮助入口（已实测）
├─ /library                              资料库（已实测）
│  └─ /library/course-support?school=... 学校课程支持（已实测）
├─ /onboarding                            LMS、Agent、用途选择（已实测）
└─ /help                                  Help Center 分类（已实测）
```

## 4. 统一工作台状态机

```text
idle
  ├─ 选择工具 → mode-selected
  ├─ 输入为空 → send-disabled
  └─ 输入非空 → send-enabled
send-enabled --send--> stop-visible / thinking
thinking --progress--> working
working --complete--> result
working --stop--> result-stopped
result --follow-up--> send-enabled
result --regenerate--> thinking
```

所有长任务在本地原型中使用确定性延迟模拟状态，组件必须通过 `aria-live` 或可见状态文字反馈进度。真实生产实现应改为服务端任务状态，不在客户端伪造完成。

## 5. 工具契约（原型范围）

| 工具 | 输入 | 空态 | 结果态 / 原型边界 |
|---|---|---|---|
| Homework solver | 文字题、公式 | 提示输入题目；空发送禁用 | 数学/物理本地 mock：分步、公式、最终答案、验算、toolbar、追问。 |
| Live transcribe | Microphone / Browser Tab | `Choose your audio source` 弹窗 | 只展示说明，不请求权限、不录音。 |
| File summary | PDF / Word / PowerPoint / Audio / Video | `Upload material` 与支持格式 | 显示本地 mock 空态，不上传文件。 |
| Video Link summary | 视频或播客 URL | URL 输入与校验提示 | 显示本地 mock 空态，不请求外部 URL。 |
| Quiz | 文件或媒体链接 | 先选择资料、题量、难度 | 显示配置空态，不生成真实题目。 |
| Study guide | 文件或媒体链接 | 先选择资料 | 显示配置空态。 |
| Essay | 文字或文件 | 先输入主题或资料 | 显示写作工具空态，不生成提交稿。 |
| AI detector | 文字 | 显示独立字符配额 `0/10000 Chars` | 复现 `AI Detection / AI Content Ratio / LOW` 的说明态，不伪造比例。 |
| Flashcard | 文件或媒体链接 | 先选择资料 | 显示配置空态。 |
| LinkedIn headshot | 图片 / 风格 | 选择三种风格 | 显示风格选择，不上传或生成图片。 |
| Web search | 搜索文字 | 共享工作台输入框 | 显示无可见引用卡片的结果空态，不伪造来源。 |

## 6. Library 与账户

### Library

- Home content tabs：`Get Sia everywhere`、`Library`。
- Library 展示学校筛选、课程卡片、`View more`；学校课程支持页展示 Course/Discipline 筛选、Upload material、My profile。
- 本地原型提供 Adelaide University 示例和课程卡片；不读取真实学校或课程数据。

### 账户与配额

- 账户菜单展示 Free、Upgrade、Credits Used、Reward、Update log、Account settings、Personalization、Help center、Sign out。
- 本地原型只允许查看菜单和展示信息，不执行升级、付款、退出或删除。
- 额度展示：通用 usage、File Page `0/100 Pages`、Recording `0/10 Minutes`、AI Detection `0/10000 Chars`；Homework mock 每次提交只在本地扣 1 个通用 usage。

## 7. 复刻优先级

### P0（本轮）

- 统一工作台空态、主工具入口、Tools/More 菜单、模式切换和 Clear input mode。
- 空输入禁用、发送状态、Stop、Thinking、Working、结构化 Homework solver。
- Like/Dislike、Visual map、复制、重新生成和推荐追问。
- Get Sia everywhere / Library、学校筛选、课程卡片、账户菜单和配额。
- 桌面优先响应式、键盘操作、focus ring、reduced motion。

### P1（下一步）

- 真实文件处理、引用回源、转录播放器、YouTube/URL 处理、概念图编辑、学习计划和复习队列。
- 移动端实时转录/翻译悬浮层验证与实现。

### P2（后端与产品化）

- 真实模型、账户、配额、付款、LMS 扩展、跨端同步、数据删除与审计。

## 8. 前后端边界

### 本地前端负责

- 展示已验证 UI 结构和可访问交互。
- 管理本地组件状态、确定性 mock 响应和演示配额。
- 对未实现能力显示明确的 local preview / disabled / upload required 状态。

### 未来后端负责

- 鉴权、账户菜单数据、usage/credits 原子扣减。
- 文件上传、转录、OCR、索引、引用和异步任务队列。
- 模型调用、工具路由、AI detector 计算、LMS 只读同步和数据删除。
- 真实引用必须来自检索片段，禁止客户端凭空拼接。

## 9. 验收标准

1. `/` 与 `/pro/session` 均能打开统一工作台，无真实网络依赖。
2. 空输入发送按钮 disabled；输入后 enabled；Homework solver 可被选择并可 Clear。
3. 数学题结果为 `(e - 1) / 2`，含 `u=x²`、`du=2x dx` 和求导验算。
4. 物理题结果为 `a=3.0 m/s²`、`v≈4.9 m/s`，含功-能定理复核。
5. 发送过程可见 `Stop`、`Thinking...`、`Working...`，完成后显示 toolbar 和 3 条推荐追问。
6. Live transcribe 弹出 Microphone / Browser Tab 选择但不请求权限；上传、付款、LMS、删除均不执行。
7. Library、学校筛选、课程卡片、账户菜单、配额和移动布局可操作。
8. 通过 `npm run lint`、`npm run typecheck`、`npm run build`。
9. reduced motion 下不依赖动画才能理解状态，键盘 focus 可见，icon-only button 有 aria-label。

## 10. 未完成研究矩阵

| 项目 | 当前状态 | 下一步 | 禁止假设 |
|---|---|---|---|
| 文件真实上传与处理 | 未实测 | 授权测试文件上传 | 不把本地空态当成真实成功。 |
| 麦克风 / Browser Tab 录音 | 未实测 | 授权后处理权限弹窗 | 不请求或绕过权限。 |
| LMS 实际同步与扩展安装 | 未实测 | 单独授权、只读测试 | 不写回 LMS、不安装扩展。 |
| 手机悬浮转录/翻译 | 用户补充待验证 | 移动端设备测试 | 不把 Web 结果外推到移动端。 |
| 付款、升级、删除、账号关闭 | 未实测 | 产品方沙盒 | 本地原型不实现。 |
| 私有 API、Prompt、模型、数据库 | 不可观察 | 需要产品方内部资料 | 不逆向、不伪造。 |
