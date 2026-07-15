# 路由与运行架构

## 1. 当前版本路由

| 路由 | 页面 |
| --- | --- |
| `/create` | 创建首页，默认入口 |
| `/home` | 图文任务创建器 |
| `/task/:id` | 图文任务详情与 7 步流水线 |
| `/music-mv` | 音乐 MV 创建与任务详情 |
| `/html-video` | HTML 动画视频创建与任务详情 |
| `/history` | 历史任务 |
| `/queue` | 批量任务队列 |
| `/batch-summary/:id` | 批次摘要 |
| `/templates`、`/templates/:id` | 草稿模板列表与编辑器 |
| `/prompt-templates`、`/prompt-templates/:id` | 提示词模板列表与编辑器 |
| `/playground` | 画图实验室 |
| `/voice-lab` | 配音实验室 |
| `/benchmark` | 对标监控 |
| `/book-selection` | 选品助手 |
| `/person-assets` | 人物素材库 |
| `/market` | 创作市场 |
| `/settings` | 系统设置 |
| `/activation` | 激活管理 |
| `/account` | 账号管理 |

根路由 `/` 会跳转到 `/create`。

## 2. 桌面运行时

- 框架：Tauri 桌面容器 + React 19 + React Router。
- 前端资源：当前安装包内共识别到 633 个嵌入资源，包含多个历史版本的哈希产物；`index.html` 指向当前主包 `index-IqsTdpJz.js`。
- 本地能力：Tauri 文件系统、路径、对话框、窗口、shell、opener、WebSocket、SQL、图片等插件。
- 本地 sidecar：`draft-generator.exe`，由主应用以 JSON 参数调用，负责音频转码/切分、FFmpeg 处理以及剪映草稿生成。
- 本地 ASR：Rust 命令 `asr_transcribe` 配合 sherpa-onnx、SenseVoice ONNX 模型和 Silero VAD；模型约 230 MB，不随安装包附带。

## 3. 数据与文件

- `AppLocalData/config.json`：模型、代理、图片平台、TTS、剪映目录等配置。
- `AppLocalData/data.db`：SQLite 数据库，至少保存任务、状态、流水线字段、模板/市场/监控相关记录。
- 任务存储目录：每个任务单独文件夹，保存正文、分句、提示词、图片、音频、事件、草稿等产物。
- CLI 文件夹：可开启“本地智能体调用”，通过读写 JSON 创建任务、查询状态；执行仍受账户、配额和配置检查。
- 敏感 API Key：界面说明使用 Windows Credential Manager / macOS Keychain 等系统钥匙串，而不是明文写入配置文件。

## 4. 外部依赖

### 可以由用户自带凭据接入

- LLM：OpenAI 兼容或 Claude 原生协议，内置 DeepSeek、阿里百炼、Moonshot、智谱、火山方舟、Anthropic 等预设。
- 图片：内置计费服务、魔搭、RunningHub、自定义 OpenAI 兼容图片接口；安装包仍保留即梦相关代码，但教程标注 Session ID 方案已移除作废。
- TTS：火山引擎与 MiniMax；MiniMax 还支持声音克隆。
- 知识库：腾讯 IMA 开放接口。
- 本地剪映：用户指定 JianyingPro 草稿目录。

### 依赖原产品或平台策略

- 原产品激活、设备绑定、创作配额、积分、市场交易和更新服务。
- 视频号对标数据/解析服务。
- 原产品的“全能绘图”计费通道和动态视频兜底服务。
- 当当、豆瓣、搜索引擎等网页抓取会受反爬、页面改版和服务条款影响。

## 5. 网络与离线边界

- 可离线：本地项目管理、历史浏览、模板和素材管理、已下载模型的本地语音识别、文件与草稿处理。
- 必须联网：LLM、云端图片、云端 TTS、知识库、激活/撤销检查、积分同步、市场、对标监控和更新。
- 原应用说明许可证约每 7 天做一次撤销检查；过期后仍可浏览历史和设置，但不能创建新任务。
