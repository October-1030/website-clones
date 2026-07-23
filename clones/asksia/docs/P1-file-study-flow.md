# StudyPal AI P1：资料学习闭环

P1 建立了第一条可验证学习闭环：上传 PDF/TXT、真实提取文字、生成三段式总结、基于资料追问并在浏览器中恢复记录。

## 文件边界

- 格式：PDF、UTF-8 TXT；
- 单文件最大 10 MB；
- PDF 必须包含 `%PDF-` 签名并具有可提取文字；
- 扫描件不做 OCR；
- 最多保留 350,000 个提取字符并标记截断。

## Provider 边界

`src/lib/study/provider.ts` 定义统一 `StudyProvider`：

- `summarize(document)` 返回摘要、关键概念和复习问题；
- `answer(document, question)` 返回回答、引用和 grounded 状态；
- provider 必须暴露 `id`、`label` 和 `demo/live` 模式。

P1 使用本地确定性 provider，不调用外部模型；没有证据时明确拒答。

## P1 API

- `POST /api/study/extract`：上传并解析文件，返回 `StudySession`；
- `POST /api/study/ask`：接收资料页和问题，返回带引用的回答。

P1 的最新学习会话保存在浏览器 `localStorage` 的 `studypal.study-session.v1`。原始文件二进制、密码、Cookie 和 Token 不会写入记录。

## 验收

P1 覆盖 TXT/PDF 成功解析、无效格式、损坏 PDF、结构化总结、基于资料回答、无依据拒答、刷新恢复，以及 1440px/390px Chrome 端到端测试。

P1 Git checkpoint：`b601bbd`。
