# Storybound 桌面工作台复刻

基于 Storybound 1.16.1 客户端证据实现的独立本地工作台。它不会连接原产品的创作、授权或计费后台；LLM、图片和 TTS 使用用户自己的 API。

## 已实现

- 与原客户端一致的桌面壳、导航和三类任务入口
- 图文任务的全自动、半自动、直接出片模式
- 不暂停、关键节点、每步确认、自定义暂停策略
- 原版提示词状态机：预审 → WriterAgent 改写/自评 → 封面五字段 → 尾部锚点分镜 → 人物一致性卡 → 绘图提示词
- 旁白逐镜配音、严格 `[A]`/`[B]` 双人 Podcast、外部音频真实时长时间线
- 可暂停、继续、取消、排队串行和从指定步骤重跑的 7 步流水线
- HTML 动画和音乐 MV 的真实本地任务、素材上传、断点状态、FFmpeg MP4 和剪映草稿
- 画图实验室真实 MiniMax 批量生图、参考图、尺寸后处理与本地历史
- 人物素材库、提示词模板、选品助手、对标监控和创作市场的本地可持久化工作台
- 对标监控公开单视频解析：标题、作者、封面、数据、无水印媒体、保存资料库和本地文案提取
- Storybound 1.16.1 字幕行号、单行字数限制和超字标红
- 火山引擎 / 豆包 TTS 1.0、2.0 的真实 MP3 合成
- MiniMax `speech-2.8-hd` / `speech-2.8-turbo`、平台音色同步与声音克隆
- 10,000 字长文本自动分段、三路并发和 MP3 顺序合并
- 图文任务中间产物全部可编辑；图片支持单镜重画、失败项修复、替换、补位和裁切定位
- MiniMax 人物参考图、独立封面/第二封面、BGM 与四种剪映布局模板
- 服务端安全读取本机 MiniMax 凭据，浏览器页面不会接触密钥明文
- OpenAI-compatible LLM 文案链路：文案预审、智能改写、分镜、绘图提示词
- MiniMax `image-01` 文生图，失败时按原版赛道 L2/L3 场景重试
- 真实剪映草稿目录与 ZIP：图片、主音频、字幕、标题、封面和 BGM 独立轨道
- 每任务独立磁盘目录、事件日志、历史记录、刷新/重启恢复和可恢复任务 URL

## 运行

```powershell
npm install
npm run dev
```

默认地址为 `http://127.0.0.1:5173/`。打开“系统设置”填写你自己的火山或 MiniMax 凭据，再到“图文任务”创建任务。手工填写的凭据只保存在当前运行会话内存中，不写入任务文件，也不会发送给 Storybound 后台。

任务数据位于 `desktop-app/.storybound-data/tasks/<taskId>/`。每个目录包含 `task.json`、`events.ndjson`、图片、音频、上传素材和剪映草稿；该目录已加入 `.gitignore`。

FFmpeg 与 ffprobe 默认从系统 `PATH` 查找；也可分别通过 `FFMPEG_PATH`、`FFPROBE_PATH` 指定可执行文件。代码库不包含开发者电脑的绝对工具路径。

### 公网检查

服务只监听本机回环地址。若通过 Cloudflare Tunnel、Tailscale Serve 或其他反向代理临时公开，必须先设置访问令牌：

```powershell
$env:STORYBOUND_PUBLIC_ACCESS_TOKEN = "<一段足够长的随机字符串>"
npm run dev
```

检查链接使用 `https://你的域名/?access=<同一令牌>`。首次访问成功后服务会写入仅 HTTPS、HttpOnly 的短期 Cookie，并从地址栏移除令牌。所有非 `localhost` / `127.0.0.1` 请求统一要求鉴权；未配置令牌时公网请求直接拒绝，避免他人借用本机 MiniMax/LLM 凭据和读取任务。

MiniMax 也可以从本机文本文件安全读取。默认查找 `C:\tmp\minimax-secrets.txt`，格式如下：

```text
MINIMAX_API_KEY=sk-...
```

可通过 `MINIMAX_SECRETS_FILE` 环境变量指定其他路径。服务端只向页面返回“凭据是否可用”和文件名，不返回密钥内容。

LLM 可在“系统设置”手工填写，也可以从本机文本文件安全读取。默认查找 `C:\tmp\storybound-secrets.txt`，格式如下：

```text
STORYBOUND_LLM_PROVIDER=deepseek
STORYBOUND_LLM_API_KEY=sk-...
STORYBOUND_LLM_BASE_URL=https://api.deepseek.com/v1
STORYBOUND_LLM_MODEL=deepseek-chat
```

`STORYBOUND_LLM_PROVIDER` 可选：`minimax`、`deepseek`、`openai`、`siliconflow`、`custom`。未单独配置 LLM 时，会使用 `minimax-secrets.txt` 中同一份 MiniMax Key 调用兼容文本接口。服务端只向页面返回“凭据是否可用”和 provider/model，不返回密钥内容。

### 对标监控

“单视频解析”使用从原客户端 1.16.1 公开代码确认的数据路径，可解析公开分享链接并返回标题、作者、封面、清晰度和可下载媒体；结果可保存到本地资料库。保存后打开作品，点击“一键提取公开视频文案”，服务会重新解析媒体、下载到临时目录并用本机 ASR 转写，完成后自动删除临时媒体。

原版的“添加账号／刷新全部作品”属于绑定邮箱、设备指纹和积分的私有账号能力。本项目不会冒用或绕过原站授权；页面会明确显示“账号自动刷新：未配置”。仅当你拥有自己的原站授权参数时，才可在启动前设置：

```powershell
$env:STORYBOUND_BENCHMARK_EMAIL = "你的绑定邮箱"
$env:STORYBOUND_BENCHMARK_FINGERPRINT = "你的设备指纹"
npm run dev
```

刷新账号前页面会再次确认，因为原数据源可能扣除积分。公开单视频解析不依赖上述参数。

### 本地 ASR

项目会自动查找已安装 `faster-whisper` 的 Python，并默认使用适合中文的 `small` 模型、CPU `int8` 推理。首次使用若本机没有模型，需要从 Hugging Face 下载模型；之后可离线运行。可用环境变量调整：

```powershell
$env:STORYBOUND_ASR_MODEL = "small"
$env:STORYBOUND_ASR_LANGUAGE = "zh"
$env:STORYBOUND_ASR_DEVICE = "cpu"
```

也可以覆盖为你自己的 ASR 命令。命令需要把转写纯文本，或 `{"text":"..."}` JSON 写到 stdout：

```powershell
$env:STORYBOUND_ASR_COMMAND = "faster-whisper"
$env:STORYBOUND_ASR_ARGS = '["{input}","--language","zh","--output_format","json"]'
npm run dev
```

`STORYBOUND_ASR_ARGS` 必须是 JSON 字符串数组，`{input}` 会替换为临时媒体路径；执行使用 `execFile`，不会经过 shell。若未检测到 `faster-whisper` 且未配置命令，页面仍保留导入 transcript 和手工粘贴模式。

生产检查：

```powershell
npm run lint
npm run build
npm run smoke:task
npm run smoke:media
npm run smoke:pipeline
```

`smoke:task` 验证任务持久化、真实音频时长、裁切参数、剪映媒体轨道和 ZIP；`smoke:media` 复用已有本地素材，验证双分镜 H.264/AAC MP4 与剪映包，不消耗生图或 TTS 额度；`smoke:pipeline` 会使用本机 LLM 凭据真实跑一遍 1.16.1 文本提示词链，因此会产生少量 API 用量。

完整功能、真实媒体、响应式和安全验收结果见
[`docs/research/v1.16.1/QA_REPORT.md`](../docs/research/v1.16.1/QA_REPORT.md)。
