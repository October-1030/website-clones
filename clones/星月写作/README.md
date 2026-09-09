# 星月写作 — 本地创作工作台

原站：https://xingyuexiezuo.com/

Next.js 16.2 / React 19 / TypeScript / Tailwind CSS v4。项目源码、素材和研究记录均位于当前文件夹；未修改其他克隆项目。

## 启动

```sh
cd clones/星月写作
npm ci
# 将 .env.example 复制为 .env.local，填写自己的 WRITING_API_KEY
npm run dev -- --port 3017
```

打开 http://localhost:3017 。首次显示创作方式引导，点击“跳过引导，直接开始”进入首页。右上角“教程”可重新打开引导。

本工作区已复用父目录安装的依赖，直接运行即可。如果此机器的 npm PowerShell 包装脚本报错，可用：

```powershell
node 'C:/Program Files/nodejs/node_modules/npm/bin/npm-cli.js' run dev -- --port 3017
```

## 已实现

- 6 个首页布局区域、7 个界面组件，40 个原站提取的 SVG 图标，1 个下载的 favicon。
- 原站雾灰外观、首次引导、新建作品弹窗、社区文章列表、桌面/平板/手机布局。
- 本地创建、编辑、自动保存、TXT/Markdown 导入、TXT 导出、搜索、分类、三种排列、文件夹、批量管理、归档及回收站恢复。
- 主题、皮肤和护眼设置。
- 创意工具箱入口及独立黄金开篇生成器：内置/自定义提示词、故事设定、参考作品、中文流式生成、停止/重试、编辑、复制、导出与保存为作品。

此外已实现章节工作台、角色/词条/备忘录、工作流、提示词与知识卡、本地论坛和账户记录等页面，具体范围见 `docs/research/FULL_AUDIT.md`。作品保存在当前浏览器。登录、云端同步、充值等原站服务尚未接入；图片工具目前生成绘图提示词。

## 黄金开篇生成器

入口：侧栏「创意 → 黄金开篇生成器」、作品页「黄金开篇」，或首次引导「生成黄金开篇第一章」。

黄金开篇、通用创作工具和工作流均提供「输出语言」选项：中文或 English（英文）。选择会保存在当前浏览器，并在这些工具间共用。英文模式按英文单词数设定目标长度；故事设定可以用中文或英文填写，正文、对白及标题按所选语言输出。英文开篇已通过真实 MiniMax M3 请求验证。

本地开发环境已在被 Git 忽略的 `.env.local` 中启用 `MiniMax-M3`；GitHub 仓库不包含任何真实密钥。首次安装需要复制 `.env.example` 为 `.env.local`，填写自己的 `WRITING_API_KEY`，其余两项默认指向 MiniMax M3。配置完成后，黄金开篇、通用创作工具和工作流打开时会自动选择服务器模型，无需再输入密钥。生成请求由本地服务发送至 MiniMax 官方接口；故事设定和结果保存在当前浏览器。M3 使用非思考模式，并将推理字段与正文分开，接口依据 [MiniMax 官方文档](https://platform.minimaxi.com/docs/api-reference/text-openai-api)。

仍可在「模型设置」中改用自己的 DeepSeek API Key；该密钥只在当前弹窗打开期间保存在内存，关闭或刷新会清除。费用由实际使用的模型账户承担。

也可以把 `.env.example` 复制为 `.env.local`，配置 `WRITING_API_KEY`、`WRITING_BASE_URL` 和 `WRITING_MODEL`，重启服务后使用服务器模型。服务端支持返回 Chat Completions SSE 的兼容接口，基础地址需包含服务商要求的路径前缀（例如 `/v1`），不要带 `/chat/completions`。服务端密钥不会传到浏览器。此配置面向本地使用；共享部署需先添加用户鉴权和额度限制。

四个内置方案为本项目编写，原站社区作者的私有提示词未复制。可以预览完整提示词或直接改为自定义。

单元测试：`npm test`。接口回归步骤见 `docs/research/QA.md`。2026-09-01 已通过真实 MiniMax M3 请求验证：小说正文流式返回并正常完成；这不代表对所有创作任务的质量保证。

## 验证与参考

`npm run check` 执行 ESLint、TypeScript 与生产构建。

- `docs/research/`：组件规格、交互边界及验证结果。原始 DOM 抓取与界面截图仅保留在本地，不包含在公开上传中。
- `scripts/download-assets.mjs`：下载公开 favicon。
- `scripts/extract-icons.mjs`：从保存的原站 SVG 生成类型安全 React 图标。

工作树中的社区组件已合并到本项目。临时独立构建仓库位于 `.tmp/` 并被 Git、ESLint 和 TypeScript 忽略。
