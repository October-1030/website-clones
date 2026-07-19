# 研究证据与安全说明

## 1. 公开材料

- 官网：`https://storybound.cc/`
- 公开使用教程：`https://qnc80j2zlx.feishu.cn/docx/UzIqd9RWJolRB4xl8Xxcmz8ZnEh`
- 教程标注 Windows 版本 1.13.1，更新日期 2026-07-14。
- 官网 `/dl/win` 跳转到官方更新域名的 1.13.1 安装包。

## 1.1 原作者真实任务截图

- 用户于 2026-07-19 提供原站作者自行制作的任务详情截图，归档为 `docs/design-references/app/task-detail-author-33-shots.jpg`。
- 截图中的 `20260526 · 民间故事` 已完成 7/7 步，产物为 33 个分镜、33/33 张图、33/33 段 TTS，随后生成剪映草稿。
- 页面同时显示“产物预览 / 分镜画廊 / 配音试听”标签、逐步耗时、TTS 总时长和草稿落盘路径。
- 该证据确认普通旁白任务的正式结构是逐分镜图片、逐分镜 TTS、逐分镜字幕，而不是整篇单条旁白。整篇单条旁白只能作为本地增强模式，不能标成原版结构。

## 2. 安装包

- 文件：`Storybound_1.13.1_x64-setup.exe`
- 大小：145,447,689 字节。
- SHA-256：`384BF753027074CF57C90AF2A53116C80A37E897EB4EE1F4F2DC0B29D3753FE6`
- 格式：NSIS 3.11 安装包。
- Authenticode：未签名。

因为安装包未签名，本次没有运行安装程序。获得用户明确授权后，仅启动了静态解包得到的 `storybound.exe`，并在未填写账号、邮箱或 API Key 的空白状态下做动态界面核验。

## 3. 解包结果

- `storybound.exe`：76,935,168 字节。
- `storybound.exe` SHA-256：`92C8E3B82D9F3CF4D7AD283021F9766D6570DBC5045D7C8547C1270978FEBD80`。
- `draft-generator.exe`：77,651,821 字节。
- 附带 ONNX Runtime、sherpa-onnx、VC Runtime 和默认 BGM。
- 通过 Tauri 资源提取器识别到 633 个嵌入资源，解压后约 196 MB。

## 4. 分析方法

- 公开页面：浏览器检查导航、教程目录和下载入口。
- 安装包：7-Zip 静态解包，不执行未知二进制。
- Tauri 前端：提取当前 `index.html` 指向的 JS/CSS 资源，解析路由、可见字符串、状态枚举和配置对象。
- 架构：从 Tauri 插件调用、SQLite 初始化、sidecar 调用和本地 ASR 命令交叉验证。
- 产品行为：以当前 1.13.1 主包为准，历史哈希包只用于确认演进痕迹，不作为最终规格来源。

## 5. 动态核验

- 通过 WebView2 调试接口读取当前 1.13.1 客户端的实际页面结构和交互状态。
- 实际访问并截图：新建任务、图文任务、HTML 动画视频、音乐 MV。
- 实际访问并截图：配音实验室的豆包 / MiniMax 两种状态，以及系统设置里的火山 / MiniMax TTS 配置。
- 实际切换：全自动 / 半自动 / 直接出片、四种暂停策略、旁白 / Podcast，以及对应的条件表单。
- 观察到客户端通过 Tauri IPC 请求官方服务的时间、系统模板、试用状态、余额、权益、公告与计费配置接口；没有提交创作内容或第三方凭证。
- WebView2 用户数据被定向到临时目录；Tauri 自身仍访问了标准用户目录下的 `com.dudumd.storybound` 应用数据目录。本次未删除或改写用户已有文件。
- 动态截图位于 `docs/design-references/app/`。

### TTS 调用交叉验证

- 火山引擎使用 `https://openspeech.bytedance.com/api/v3/tts/unidirectional`，通过 App ID、Access Token 和 1.0/2.0 Resource ID 鉴权。
- MiniMax 使用 `https://api.minimaxi.com/v1/t2a_v2`，模型为 `speech-2.8-hd` / `speech-2.8-turbo`。
- MiniMax 克隆音色经过 `/v1/files/upload`、`/v1/voice_clone`，平台音色同步使用 `/v1/get_voice`。
- 上述协议来自当前 1.13.1 客户端静态代码，并用实际设置页和配音实验室状态交叉确认；未提取或使用任何用户密钥。

## 6. 可信度

- 高：路由、三种模式、图文 7 步、普通旁白逐分镜图片/TTS/字幕结构、HTML 阶段、音乐 MV 暂停点、页面名称、本地数据库、sidecar、ASR、外部 provider 配置。
- 中：个别音乐 MV 内部异步阶段名称和顺序。当前模块由任务状态驱动，部分阶段没有单独路由，但暂停点和产物顺序已动态确认。
- 低/待运行验证：真实第三方 API 响应、剪映不同版本的草稿兼容性、视频号解析服务、市场交易后台。
