# Storybound 桌面工作台复刻

基于 Storybound 1.13.1 客户端动态研究实现的独立本地工作台。它不会连接原产品的创作、授权或计费后台；LLM、图片和 TTS 使用用户自己的 API。

## 已实现

- 与原客户端一致的桌面壳、导航和三类任务入口
- 图文任务的全自动、半自动、直接出片模式
- 不暂停、关键节点、每步确认、自定义暂停策略
- 原版提示词状态机：预审 → WriterAgent 改写/自评 → 封面五字段 → 尾部锚点分镜 → 人物一致性卡 → 绘图提示词
- 旁白逐镜配音、严格 `[A]`/`[B]` 双人 Podcast、外部音频真实时长时间线
- 可暂停、继续、取消、排队串行和从指定步骤重跑的 7 步流水线
- HTML 动画和音乐 MV 的配置表单与阶段演示
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

生产检查：

```powershell
npm run lint
npm run build
npm run smoke:task
npm run smoke:pipeline
```

`smoke:task` 验证任务持久化、真实音频时长、裁切参数、剪映媒体轨道和 ZIP；`smoke:pipeline` 会使用本机 LLM 凭据真实跑一遍 1.13.1 文本提示词链，因此会产生少量 API 用量。
