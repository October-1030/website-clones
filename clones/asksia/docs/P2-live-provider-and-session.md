# StudyPal AI P2：真实 Provider 与服务端会话

## 目标

P2 不扩建视频、转录、账户或付款功能，只加强 P1 的核心闭环：

1. 稳定的生产模式本地启动；
2. 可替换的服务端真实 AI provider；
3. 本地分段、检索与不可伪造的来源映射；
4. 原子写入的服务端学习会话；
5. 浏览器数据丢失后通过会话 URL 恢复；
6. 正确中文文案与桌面/移动端验收。

## 配置

配置模板位于 `.env.example`：

| 变量 | 说明 |
| --- | --- |
| `STUDYPAL_AI_PROVIDER` | `demo`、`minimax` 或 `openai`，默认 `demo`；有 MiniMax key 时可自动识别 |
| `MINIMAX_API_KEY` | 仅服务端读取；MiniMax 模式必需 |
| `MINIMAX_MODEL` | 默认 `MiniMax-M3` |
| `MINIMAX_BASE_URL` | 中国区默认 `https://api.minimaxi.com/v1` |
| `OPENAI_API_KEY` | 仅服务端读取；OpenAI 模式必需 |
| `OPENAI_MODEL` | OpenAI 模式使用的模型名 |
| `OPENAI_BASE_URL` | OpenAI 默认 `https://api.openai.com/v1`；仅 localhost 允许 HTTP |
| `STUDYPAL_DATA_DIR` | 服务端会话目录，默认 `.studypal-data` |

真实 provider 使用 Responses API，并显式设置 `store: false`。OpenAI 使用 JSON Schema 结构化输出；MiniMax M3 按官方能力使用 text 格式，通过严格 JSON 合约提示、容错解析和服务端字段校验形成结构化结果。MiniMax 使用中国区端点，模型默认 `MiniMax-M3`。没有密钥时系统保持演示模式；如果用户明确选择真实 provider 但配置不完整，则返回 `503 live_not_configured`，不会静默降级并假装真实结果。

## 资料分段与引用规则

- 每个页面被切为约 1,400 字符、180 字符重叠的片段；
- 每个片段由服务器分配 `S1`、`S2` 等 ID，并保留页码/标签；
- 总结最多均匀抽样约 45,000 个字符；
- 追问先在本地按问题词元排序，最多向模型提供 6 个片段；
- 模型只能返回 `sourceIds`；
- 服务器只接受当前检索集合中的 ID，伪造 ID 会被丢弃；
- 没有有效 ID 时 `grounded=false`，不生成虚假页码。

## 服务端会话

`src/lib/study/session-store.ts` 将 JSON 会话原子写入 `.studypal-data/sessions/<id>.json`：

- 先写唯一临时文件，再 rename 到正式文件；
- ID 只允许字母、数字、下划线和连字符，防止路径穿越；
- 会话包含提取文字、总结、消息和引用；
- 不保存原始文件二进制或任何密钥；
- `GET /api/study/session/[id]` 恢复；
- `DELETE /api/study/session/[id]` 删除；
- `POST /api/study/ask` 使用 `sessionId` 从服务器读取资料并持久化问答。

浏览器仍保存一份会话副本以实现即时加载，同时把 session ID 写入当前 URL。刷新时优先显示浏览器副本，随后用服务端版本校准；如果 localStorage 被清空，URL 仍可恢复服务端会话。

## 启动

- `start-studypal.cmd`：Windows 一键构建、启动并打开页面；
- `npm run local`：终端生产模式；
- `npm run dev`：仅开发调试。

## 自动化验收

单元/API 测试覆盖：

- 文件校验与 PDF/TXT 提取；
- 分段上限和相关片段检索；
- 演示 provider 总结、引用和拒答；
- Responses API 结构化请求、`store:false` 和无密钥阻塞；
- 伪造 source ID 丢弃；
- 会话原子保存、恢复、删除和路径穿越阻止；
- 通过 session ID 追问并持久化两条消息；
- 错误响应不泄露密钥。

Playwright P2 验收在桌面与 390px 移动视口覆盖：

1. 上传真实 TXT fixture；
2. 验证摘要、关键概念和复习问题；
3. 验证资料追问和来源片段；
4. 清空 localStorage 后通过 URL 从服务端恢复；
5. 同步清除浏览器与服务端记录；
6. 无效格式错误态；
7. 控制台错误、页面错误、失败请求、HTTP 错误和横向溢出均为零。

## 安全与回滚

- `.env*`、`.studypal-data/` 和 `docs/evidence/` 不进入 Git；
- `.env.example` 不含真实值；
- 不记录资料正文、请求 Authorization 头或模型密钥到日志；
- Responses API 请求不启用远端响应存储；
- P1 可回滚 checkpoint：`b601bbd`；
- P2 完成后建立独立 checkpoint，不与 P1 混合。

真实模型联网验收只在用户明确授权并提供服务端密钥后执行；无密钥验收使用合成 Responses fixture，不伪装成真实调用。
