# StudyPal AI P1：资料学习闭环

## 验收范围

本 checkpoint 只实现以下闭环：

1. 选择 PDF 或 UTF-8 TXT；
2. 浏览器与服务端双重校验文件类型、大小和基础内容签名；
3. 提取真实文件文字并显示处理阶段、进度、错误和取消入口；
4. 生成资料摘要、关键概念和复习问题；
5. 基于已提取资料追问，并显示页码或 TXT 片段引用；
6. 将学习会话保存在浏览器本机，刷新后恢复。

视频总结、音频转录、LMS 同步、Homework 业务扩建、账户/配额/支付和公开部署均不属于本 checkpoint。

## 文件边界

| 项目 | 规则 |
| --- | --- |
| 格式 | `.pdf`、`.txt` |
| 大小 | 单文件最大 10 MB |
| TXT | 必须为 UTF-8，不允许二进制 NUL 内容 |
| PDF | 必须具有 `%PDF-` 签名，并能由 PDF.js 提取文字 |
| 扫描 PDF | 当前不做 OCR，返回明确错误 |
| 提取上限 | 最多保留 350,000 个字符，并标记截断 |

## Provider 边界

`src/lib/study/provider.ts` 定义 `StudyProvider`：

- `summarize(document)`：返回摘要、关键概念、复习问题；
- `answer(document, question)`：返回回答、引用、是否具有资料依据；
- `mode`：`demo` 或 `live`；
- `id` 与 `label`：用于 UI 明确显示实际 provider。

当前实现为 `deterministic-local-v1`，模式为 `demo`。它不调用外部模型、不读取环境密钥，并在资料没有匹配证据时拒绝作答。未来接入真实模型时必须保留相同接口、来源约束和 UI 模式标识。

## API

### `POST /api/study/extract`

输入：multipart `file`。

输出：包含文件元数据、提取页、结构化总结、provider 模式和空消息列表的 `StudySession`。

### `POST /api/study/ask`

输入：问题、文件名、已提取页。

输出：回答、来源引用、`grounded` 状态和 provider 信息。API 不接受空资料，问题限制为 1–500 字符。

## 本地恢复

浏览器使用 `studypal.study-session.v1` 保存最新会话。保存内容包括提取文字、总结和追问记录，不包含原文件二进制、密码、Cookie 或 Token。用户可以在文件学习界面清除记录。

## 自动测试矩阵

| 场景 | 证据 |
| --- | --- |
| TXT 成功提取和总结 | API 集成测试 |
| PDF 成功提取和页码 | 合成 PDF fixture 集成测试 |
| 无效格式 | 客户端校验单测 + API 集成测试 |
| 文件为空、过大、类型不匹配 | 校验单测 |
| PDF 解析失败 | 损坏 PDF 集成测试 |
| 三段结构化总结 | provider 单测 |
| 基于资料回答和引用 | provider + API 测试 |
| 无依据拒答 | provider 单测 |
| 保存和恢复 | storage 单测 |

执行：

```bash
npm test
npm run check
```

## 浏览器端到端验收

`npm run test:e2e:p1` 使用本机已有 Playwright 与 Chrome，在独立生产服务器上依次验证 1440px 桌面和 390px 移动视口。每个视口覆盖真实 TXT 上传、三段总结、资料追问与引用、刷新恢复、无效格式错误态、横向溢出、控制台错误、页面异常和失败网络请求。

证据保存在 `docs/evidence/p1-playwright/<run-id>/`：

- `run-summary.json`、`browser-version.json`；
- 桌面/移动完整页面截图；
- Playwright trace；
- 控制台、页面错误、失败请求和 HTTP 错误响应诊断。

## 安全规则

- 不向第三方上传资料；处理发生在当前本机 Next.js 服务。
- 不记录文件正文到服务端日志。
- 不把密钥放进客户端、源码、fixtures 或测试输出。
- 当前 UI 必须显示“演示总结引擎”和“未调用外部 AI”。
- 其他功能入口保留时必须显示尚未开放，不得伪装成真实能力。
