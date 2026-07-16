# Storybound 桌面工作台复刻

基于官方 1.13.1 客户端动态研究实现的独立 React 原型。它不会连接原产品的创作、授权或计费后台；TTS 使用用户自己的火山引擎或 MiniMax API。

## 已实现

- 与原客户端一致的桌面壳、导航和三类任务入口
- 图文任务的全自动、半自动、直接出片模式
- 不暂停、关键节点、每步确认、自定义暂停策略
- 旁白与双人 Podcast 条件表单
- 可暂停、继续、取消和从指定步骤重跑的 7 步流水线
- HTML 动画和音乐 MV 的配置表单与阶段演示
- 火山引擎 / 豆包 TTS 1.0、2.0 的真实 MP3 合成
- MiniMax `speech-2.8-hd` / `speech-2.8-turbo`、平台音色同步与声音克隆
- 10,000 字长文本自动分段、三路并发和 MP3 顺序合并
- 图文任务流水线第 6 步真实生成 TTS 音频，支持失败重试、试听和下载
- 服务端安全读取本机 MiniMax 凭据，浏览器页面不会接触密钥明文
- OpenAI-compatible LLM 文案链路：文案预审、智能改写、分镜、绘图提示词
- 本地草稿及历史记录（浏览器 localStorage）

## 运行

```powershell
npm install
npm run dev
```

打开“系统设置”填写你自己的火山或 MiniMax 凭据，再到“配音实验室”生成 MP3。手工填写的凭据只保存在当前运行会话内存中，不写入 localStorage，也不会发送给 Storybound 后台。

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

`STORYBOUND_LLM_PROVIDER` 可选：`deepseek`、`openai`、`siliconflow`、`custom`。服务端只向页面返回“凭据是否可用”和 provider/model，不返回密钥内容。

生产检查：

```powershell
npm run lint
npm run build
```
