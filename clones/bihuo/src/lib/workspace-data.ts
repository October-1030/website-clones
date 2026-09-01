export interface GeoProject {
  id: string;
  name: string;
  type: "product" | "ip";
  keywords: string[];
  targetWords: string[];
  createdAt: string;
  updatedAt: string;
}

export interface Company {
  id: string;
  name: string;
  description: string;
  aliases: string[];
  projects: GeoProject[];
  createdAt: string;
  updatedAt: string;
}

export interface CompanyInput {
  name: string;
  description: string;
  aliases: string[];
}

export interface ProjectInput {
  name: string;
  type: "product" | "ip";
  keywords: string[];
  targetWords: string[];
}

export const workflowRoutes: Record<string, string> = {
  添加公司: "#/company?action=create",
  添加GEO项目: "#/company?action=openProjectCreate",
  添加知识库: "#/knowledge",
  生成搜索问题: "#/question-task",
  创建提示词: "#/prompt",
  生成文章: "#/article",
  授权账号: "#/media-account",
  创建发布: "#/publication-task",
  客户端发布: "#/device-management",
  收录查询: "#/collected-history",
};

export const navigationRoutes: Record<string, string> = {
  仪表盘: "#/dashboard",
  品牌管理: "#/company",
  知识库: "#/knowledge",
  问题拓展: "#/question-task",
  搜索问题库: "#/questions",
  文章创作: "#/article-task",
  文章管理: "#/article",
  数字人视频: "#/digital-human",
  自媒体发布: "#/publication-task",
  媒体投稿: "#/media-submission",
  上榜监测: "#/ranking-monitor",
  口碑监测: "#/sentiment-monitor",
  收录站点: "#/collected-history",
  诊断报告: "#/diagnosis-report",
  监测报告: "#/monitor-report",
  "图片&视频": "#/materials",
  AI文生图: "#/text-to-image",
  提示词管理: "#/prompt",
  密钥管理: "#/keys",
  第三方开放配置: "#/integrations",
  大模型配置: "#/models",
  积分明细: "#/credits",
  我的订单: "#/orders",
  设备管理: "#/device-management",
};

export const featureRoutes: Record<string, { title: string; description: string; action: string }> = {
  "#/knowledge": { title: "知识库", description: "维护 GEO 项目知识资料，为内容创作提供依据。", action: "新增知识库" },
  "#/question-task": { title: "AI 拓展问题", description: "围绕公司和 GEO 项目生成用户可能搜索的问题。", action: "创建拓展任务" },
  "#/questions": { title: "搜索问题库", description: "集中管理已生成的搜索问题。", action: "新增搜索问题" },
  "#/prompt": { title: "提示词管理", description: "配置文章写作的风格、结构和约束。", action: "创建提示词" },
  "#/article-task": { title: "AI 文章创作", description: "组合问题、提示词和知识资料生成文章。", action: "创建文章任务" },
  "#/article": { title: "文章管理", description: "查看和维护已生成的文章内容。", action: "新增文章" },
  "#/digital-human": { title: "数字人视频", description: "管理数字人口播视频任务和素材。", action: "创建视频任务" },
  "#/media-account": { title: "发布账号", description: "管理自媒体平台的发布授权。", action: "授权账号" },
  "#/publication-task": { title: "发布任务", description: "创建并查看多平台内容发布任务。", action: "创建发布任务" },
  "#/media-submission": { title: "媒体投稿", description: "管理媒体渠道和内容投稿记录。", action: "创建投稿记录" },
  "#/ranking-monitor": { title: "上榜监测", description: "记录品牌与内容在 AI 平台的上榜情况。", action: "创建监测任务" },
  "#/sentiment-monitor": { title: "口碑监测", description: "记录品牌相关回答和口碑线索。", action: "创建口碑监测" },
  "#/device-management": { title: "设备管理", description: "管理客户端发布与本地采集设备。", action: "添加设备" },
  "#/collected-history": { title: "收录记录", description: "查看客户端或云端采集到的内容收录结果。", action: "创建收录查询" },
  "#/diagnosis-report": { title: "诊断报告", description: "整理 GEO 现状诊断和改进建议。", action: "创建诊断报告" },
  "#/monitor-report": { title: "监测报告", description: "整理阶段性监测结果和趋势。", action: "创建监测报告" },
  "#/materials": { title: "图片与视频", description: "集中管理内容创作使用的媒体素材。", action: "添加素材记录" },
  "#/text-to-image": { title: "AI 文生图", description: "记录图片生成需求和结果。", action: "创建图片任务" },
  "#/keys": { title: "密钥管理", description: "记录非敏感配置说明；请勿在本机记录中填写真实密钥。", action: "新增配置说明" },
  "#/integrations": { title: "第三方开放配置", description: "记录第三方平台的对接配置。", action: "新增开放配置" },
  "#/models": { title: "大模型配置", description: "记录本机大模型服务的使用配置。", action: "新增模型配置" },
  "#/credits": { title: "积分明细", description: "记录本机模拟的积分变化说明。", action: "新增积分记录" },
  "#/orders": { title: "我的订单", description: "记录本机模拟的订单信息。", action: "新增订单记录" },
};

export const integrationRequirements: Record<string, string[]> = {
  "#/digital-human": ["数字人或视频生成服务 API", "声音与形象素材授权", "视频文件存储"],
  "#/media-account": ["目标平台开放应用", "OAuth App ID / Secret", "审核通过的发布权限与回调域名"],
  "#/media-submission": ["媒体投稿 API 或合规客户端", "已授权投稿账号", "失败重试与审计日志"],
  "#/ranking-monitor": ["AI/搜索平台数据源", "查询配额与合规采集策略", "定时任务"],
  "#/sentiment-monitor": ["品牌提及数据源", "情感分析规则或模型", "定时任务"],
  "#/device-management": ["已签名的 Windows/macOS 客户端", "设备注册令牌", "安全更新与版本清单"],
  "#/materials": ["对象存储", "上传大小与文件类型策略", "媒体访问权限"],
  "#/text-to-image": ["图片生成服务 API", "内容审核策略", "图片存储"],
  "#/keys": ["服务端密钥管理方案", "密钥轮换和访问审计"],
  "#/integrations": ["第三方服务商账号", "服务端 API 凭证", "Webhook 或回调地址"],
  "#/models": ["模型服务商 API", "模型与额度配置", "服务端密钥"],
  "#/credits": ["计费规则", "用量账本", "不可篡改的服务端存储"],
  "#/orders": ["支付商户", "商品与价格", "支付签名、Webhook 和退款流程"],
};
