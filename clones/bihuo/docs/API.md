# MiniMax 文本对话接口

本地地址：`http://127.0.0.1:3026/api/chat`。GEO 助手已使用该接口；无需在网页输入密钥。

## 服务端配置

复制 `.env.example` 为 `.env.local`，填入自己的配置并重启 `npm run dev`：

```dotenv
MINIMAX_BASE_URL=https://api.minimaxi.com/v1
MINIMAX_API_KEY=replace_with_your_minimax_key
MINIMAX_MODEL=MiniMax-M3
```

此次已根据用户指定文件完成本地配置，原文件未改动。`.env.local` 被 Git 忽略；不得上传、截图或共享该文件。不要把密钥改为 `NEXT_PUBLIC_` 变量。

上游采用 MiniMax 的 OpenAI 兼容 `POST /v1/chat/completions`，使用 `reasoning_split: true`，只向前端返回最终文本，不返回思考字段。参见 [MiniMax 官方接口文档](https://platform.minimaxi.com/docs/api-reference/text-openai-api)。当前实现为非流式回复。

## 发送消息

`POST /api/chat`，请求头 `Content-Type: application/json`：

```json
{
  "messages": [
    { "role": "user", "content": "帮我为一家宠物用品店列出三个内容主题。" }
  ]
}
```

成功返回示例（文本及用量仅示意）：

```json
{
  "reply": "可以从新手养宠、产品选购、日常护理三个方向展开。",
  "model": "MiniMax-M3",
  "usage": { "promptTokens": 100, "completionTokens": 200, "totalTokens": 300 }
}
```

后续提问将已有的 `user` 和 `assistant` 消息连同新问题一起提交。最后一条必须是 `user`，不可传入 `system` 消息。`model`、系统提示和令牌上限由服务端控制，客户端不能覆盖。`usage` 在上游未返回有效统计时省略，统计可能包含模型推理消耗。

Windows PowerShell 调用示例（会产生模型用量）：

```powershell
$chatPayload = @{ messages = @(@{ role = 'user'; content = '请只回复：连接成功。' }) } | ConvertTo-Json -Depth 4
Invoke-RestMethod -Uri 'http://127.0.0.1:3026/api/chat' -Method Post -ContentType 'application/json; charset=utf-8' -Body ([System.Text.Encoding]::UTF8.GetBytes($chatPayload))
```

## 配置状态

`GET /api/chat` 不调用模型，只检查本机配置是否完整有效：

```json
{ "configured": true, "provider": "MiniMax", "model": "MiniMax-M3" }
```

该状态不保证上游网络、密钥权限或额度可用，实际发送才会验证这些条件。

## 限制与错误

- 单条用户输入最多4000字符，单条助手历史最多12000字符；最多13条消息，总计16000字符；请求体最多96 KiB。
- 单进程同时只处理一次生成，每分钟最多8次尝试；内存限流会在服务重启时重置。
- 上游生成上限2048 tokens，55秒超时。停止生成会中止本地请求，但已发出的上游请求仍可能产生用量。
- 仅接受本机地址；浏览器必须同源，拒绝跨站来源，无公开 CORS 权限。开发和生产启动脚本均绑定 `127.0.0.1`。
- 当前没有真实用户认证。本机其他程序也能调用接口；来源检查不能代替公网认证。不要用反向代理对外开放，部署前需补充认证、账户配额和持久化限流。
- 只调用允许的 MiniMax 官方 HTTPS 域名，拒绝重定向。API密钥只供服务端使用；上游原始错误、请求头和推理字段不会返回客户端。
- 本项目不保存或记录对话正文，但会将当前问题和上下文发送至 MiniMax。请勿发送密钥或不应交给模型服务商的敏感资料。
- 当前只提供文本能力，不包含公司数据库、联网搜索、真实收录查询、文章发布、账户登录或短信服务。

错误结构：`{ "error": { "code": "错误代码", "message": "可展示的说明" } }`。

| HTTP | 常见代码 | 含义 |
| --- | --- | --- |
| 400 | `INVALID_MESSAGES` / `MESSAGE_TOO_LONG` | 消息无效或超长 |
| 403 | `LOCAL_ONLY` | 非本机或跨站访问 |
| 413 / 415 | `BODY_TOO_LARGE` / `JSON_REQUIRED` | 请求体超限或类型不支持 |
| 429 | `GENERATION_BUSY` / `RATE_LIMITED` / `PROVIDER_QUOTA` | 正在生成、频率过高或上游额度/限流 |
| 502 | `PROVIDER_AUTH` / `PROVIDER_UNREACHABLE` / `PROVIDER_ERROR` | 上游授权、网络或服务错误 |
| 503 | `NOT_CONFIGURED` / `INVALID_CONFIG` | 服务端配置缺失或无效 |

## 验证

`npm run test:api`：本地服务运行时检查参数、来源和响应安全边界，不提交有效生成请求。

`npm run test:minimax`：读取 `.env.local`，直连 MiniMax 发送一次短测试；只打印状态、回复和用量，不打印密钥。需要允许访问外网，会消耗真实模型额度。
