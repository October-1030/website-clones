# StudyPal AI

StudyPal AI 是一个本地优先的大学学习工作区。当前 P2 已打通完整资料学习闭环：上传 PDF/TXT、提取文字、生成结构化总结、基于资料追问、显示受服务器约束的引用，以及从本机服务恢复学习记录。

## 最简单的本地启动方式

Windows 用户可以双击项目根目录的 `start-studypal.cmd`。它会构建生产版本、在 `http://localhost:3000` 启动服务并打开学习页面。

也可以在终端运行：

```bash
npm install
npm run local
```

打开 `http://localhost:3000/pro/session`。

## AI 模式

默认配置是 `demo`，不调用外部模型。演示模式仍会执行真实文件解析、资料检索、引用和服务端会话保存，但总结和回答由本地确定性 provider 生成。

要启用真实 AI：

1. 复制 `.env.example` 为 `.env.local`；
2. 设置 `STUDYPAL_AI_PROVIDER=openai`；
3. 在服务端填写 `OPENAI_API_KEY` 与 `OPENAI_MODEL`；
4. 重新构建并启动。

密钥只从服务端环境读取，不会进入浏览器包、学习记录、日志、测试 fixture 或 Git。项目使用 OpenAI Responses API 的结构化输出，并设置 `store: false`。如果真实模式配置不完整或请求失败，系统会明确报错，不会伪装成真实 AI 成功。

## 本机学习记录

- 默认目录：`.studypal-data/sessions/`；
- 可通过 `STUDYPAL_DATA_DIR` 修改；
- 文件包含提取文字、总结和聊天记录，不包含原始上传文件二进制、密钥、Cookie 或 Token；
- 浏览器网址保存 `session` ID，浏览器本地数据丢失后仍可从本机服务恢复；
- 点击“清除”会同时删除浏览器记录和服务端会话文件。

`.studypal-data/`、`.env*` 和浏览器验收证据已由项目级 `.gitignore` 排除；`.env.example` 例外，可安全提交。

## 当前能力边界

- 文件：PDF、UTF-8 TXT，最大 10 MB；
- PDF：仅支持可提取文字，扫描件暂不做 OCR；
- 提取文字上限：350,000 字符；
- 真实 AI 输入：先在本地切分和检索，再发送受限片段；
- 引用：模型只能返回服务器提供的 source ID，服务器会丢弃伪造 ID；
- 暂不包含视频总结、音频转录、LMS 同步、账户、配额或付款。

## 质量检查

```bash
npm test
npm run check
npm run test:e2e:p2
```

`npm run check` 执行 lint、TypeScript、单元/API 集成测试和生产构建。`npm run test:e2e:p2` 使用本机已有 Playwright 与 Chrome，验证 1440px 桌面和 390px 移动视口，并将截图、trace、版本和诊断保存在 `docs/evidence/p2-playwright/`。

技术说明见 [P2 provider 与服务端会话](docs/P2-live-provider-and-session.md)。历史竞品研究仍保留在 `docs/research/`、`public/images/asksia/` 和 `scripts/`；这些名称仅表示研究来源，运行产品品牌是 StudyPal AI。
