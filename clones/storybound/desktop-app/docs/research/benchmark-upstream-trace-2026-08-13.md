# Storybound 对标监控数据源追踪

更新时间：2026-08-13

## 结论

原版 Storybound 的“整账号作品同步”并不是在客户端直接抓取微信视频号，也不是由 MiniMax 提供。根据原版客户端公开可见代码、接口命名、请求字段、分页字段和公开上游文档，可以高置信度判断：

- Storybound 自有服务充当鉴权、计费和转发层；
- 上游整账号数据来自“极致了数据 / 大家啦”（`dajiala.com`）的视频号接口；
- 单条公开视频解析使用另一条 BugPk 解析链路，与整账号同步不是同一个接口。

后端源码不可见，因此“Storybound 后端如何保存和结算上游密钥”属于基于接口契约的推断，不作为直接源码事实。

## 原版客户端证据

### 服务入口

原版主包中定义了两套 Storybound 服务地址：

- 主服务：`https://jihuo.52aibot.com`
- 备用服务：`https://api.joy1412.cn`
- 客户端通过 `/v1/time` 探测主服务，失败后切到备用服务。

2026-08-13 实测两个 `/v1/time` 均返回 HTTP 200。

### 对标监控请求链

原版 `BenchmarkPage` 调用：

1. 识别账号：`POST /v1/dajiala/feed-info`
   - 请求体：`{ "feed_info": "视频号分享链接" }`
   - 关键返回值：`v2_name`
2. 获取作品：`POST /v1/dajiala/feed-list`
   - 请求体：`{ "v2_name": "账号标识", "last_buffer": "分页游标" }`
   - 每页最多 15 条；通过 `last_buffer` 和 `continue_flag` 翻页。
3. 两个请求都会把已绑定邮箱和本机设备指纹发给 Storybound 服务：
   - `X-Sb-Email`
   - `X-Sb-Fp`
4. 401、缺少邮箱、鉴权失败会被客户端统一显示为“请先绑定邮箱账户”；积分不足会显示充值提示。

这说明邮箱不是微信账号，也不是上游数据账号，而是 Storybound 自己的授权与积分账户。

## 与公开上游接口的对应

“极致了数据 / 大家啦”的公开文档与原版契约逐项对应：

| Storybound 路由 | 大家啦调用模式 | 对应字段 |
| --- | --- | --- |
| `/v1/dajiala/feed-info` | 视频号基础信息，`type=12` | `feed_info` → `v2_name`、`nickname` |
| `/v1/dajiala/feed-list` | 单个视频号作品列表，`type=1` | `v2_name`、`last_buffer` → `object[]`、`contact`、`continue_flag` |

公开上游接口为：`POST https://www.dajiala.com/fbmain/monitor/v3/wxvideo`。它要求上游 `key`，一次最多返回 15 条，返回 `cost` 和余额信息。2026-08-13 对该地址进行无参数 GET 探测返回 HTTP 405，说明地址存活且只接受规定的 POST 请求。

原版客户端没有下发大家啦 `key`，所以合理链路是：Storybound 客户端把邮箱、设备指纹和业务参数交给 Storybound 服务器，服务器验证授权与积分后，再使用服务器保存的大家啦凭据请求上游。

## 单视频解析是另一条链

原版单视频解析调用 `/v1/bugpk/parse?url=...`，没有沿用整账号同步的 Storybound 邮箱与设备指纹请求头。BugPk 公开文档也提供聚合短视频解析能力。因此不能用“单视频可解析”推导“整账号列表也能自动拉取”。

## 独立版可采用的合法方案

为了保持原版交互，同时避免依赖原作者账户，可增加自有数据源设置：

1. 用户自行申请“极致了数据 / 大家啦”API key；
2. key 只保存在本机服务端配置，不写入浏览器、本地导出包或 Git；
3. 本地服务直接调用大家啦接口，并把返回值映射成原版 `feed-info` / `feed-list` 契约；
4. 页面仍保留“刷新最新 15 条”“加载更多”“连续加载”和分页游标；
5. 没有 key 时明确提示“未配置对标数据源”，不再误导用户绑定 Storybound 邮箱。

独立版还接入 Just One API 作为不依赖微信登录态的替代数据源：先用公开视频解析结果中的作者昵称调用账号搜索 V3，取得 `v2Name`，再调用账号视频 V1 按 `last_buffer` 分页。官方文档说明注册后提供有限免费调用次数；成功调用后可能计费。该路线不读取微信 Cookie，不安装根证书，也不修改系统代理。

不得提取、复用或伪造原作者服务器上的上游密钥，也不得伪造 Storybound 邮箱、设备指纹或积分授权。

## 公开参考

- 极致了数据：通过视频链接获取视频号基础信息
  `https://s.apifox.cn/410674f9-f451-4b4f-957a-5f54f243bc83/447634016e0`
- 极致了数据：获取单个视频号作品列表
  `https://s.apifox.cn/410674f9-f451-4b4f-957a-5f54f243bc83/api-209503843`
- 极致了数据主页
  `https://www.dajiala.com/main/indexs`
- BugPk 短视频解析文档
  `https://api.bugpk.com/doc-short_videos.html`
- BugPk 相关开源项目
  `https://github.com/jiuhunwl/short_videos`
- Just One API：视频号账号搜索 V3
  `https://docs.justoneapi.com/zh/api/wechat-channels/account-search-v3`
- Just One API：视频号账号视频 V1
  `https://docs.justoneapi.com/zh/api/wechat-channels/account-videos-v1`

## 本地证据位置

- 原版主包：`.tmp/storybound-1.17.0-assets/assets/index-B_XgV9A-.js`
- 原版对标监控页面：`.tmp/storybound-1.17.0-assets/assets/BenchmarkPage-Cp01SSnj.js`
