# StudyPal AI P3：Homework Solver

## 目标

P3 把原先硬编码的 Homework 演示答案替换为真实闭环：

1. 输入 3–4,000 字符的文本题目；
2. 通过当前 provider（推荐中国区 MiniMax M3）生成结构化解答；
3. 展示题意、已知量、方法、2–8 个步骤、最终答案、独立验算和必要假设；
4. 同时保存浏览器副本与本机服务记录；
5. localStorage 丢失后仍可通过 `homeworkSession` URL 恢复；
6. 清除时同步删除浏览器和服务端记录。

图片识题、手写 OCR、批改上传、课程账户和云同步不属于本 checkpoint。

## API 与数据

- `POST /api/homework/solve`：校验题目、调用 provider、保存并返回会话；
- `GET /api/homework/session/[id]`：恢复本机会话；
- `DELETE /api/homework/session/[id]`：删除本机会话；
- 默认目录：`.studypal-data/homework/<id>.json`；
- 浏览器键：`studypal.homework-session.v1`。

会话保存题目、结构化解答、provider 元数据和时间戳，不保存 API key。

## Provider 结构

`StudyProvider.solveHomework()` 返回：

- `subject`
- `problemRestatement`
- `knowns`
- `method`
- `steps[]`：`title`、`explanation`、`expression`
- `finalAnswer`
- `verification`
- `assumptions`

OpenAI provider 使用 JSON Schema。MiniMax M3 使用官方 Responses text 模式、严格 JSON 合约提示、容错 JSON 解析和服务端字段校验。仅当响应无法解析为 JSON 时自动重试一次；HTTP、权限和余额错误不盲目重试。第二次仍无效或结构不完整时返回 `live_invalid_response`，不会保存为成功结果。

## 安全与边界

- 密钥只在服务端环境中读取；
- 题目不会写入日志；
- 没有真实 provider 时明确显示演示模式，不伪造具体答案；
- UI 明示学术诚信要求；
- 只有本机持久化，不公开发布或对外发送；
- 题目过短、过长、无效 JSON、会话损坏和非法 ID 都返回明确错误。

## 验收

- demo provider 结构测试；
- MiniMax/OpenAI Responses 请求边界测试；
- solve、restore、delete 与非法输入 API 测试；
- 崩溃安全的原子会话保存；
- 真实 M3 数学题总结、步骤、最终答案和验算；
- 桌面 1440px 与移动 390px 浏览器流程；
- 刷新恢复、清除、错误态、控制台与网络诊断；
- 生产构建和精确密钥扫描。
