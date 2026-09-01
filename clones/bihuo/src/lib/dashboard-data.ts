import type { DashIconName } from "@/components/dashboard-icons";

export const navigationGroups: { name: string; icon: DashIconName; children: string[] }[] = [
  { name: "问题拓展", icon: "question", children: ["问题拓展", "搜索问题库"] },
  { name: "内容创作", icon: "magic", children: ["文章创作", "文章管理", "数字人视频"] },
  { name: "内容发布", icon: "send", children: ["自媒体发布", "媒体投稿"] },
  { name: "效果监测", icon: "monitor", children: ["上榜监测", "口碑监测", "收录站点"] },
  { name: "报告管理", icon: "report", children: ["诊断报告", "监测报告"] },
  { name: "资源中心", icon: "resources", children: ["图片&视频", "AI文生图", "提示词管理"] },
  { name: "系统设置", icon: "settings", children: ["密钥管理", "第三方开放配置", "大模型配置", "积分明细", "我的订单", "设备管理"] },
];

export const workflow: { phase: string; title: string; icon: DashIconName; summary: string; steps: { name: string; icon: DashIconName; description: string }[] }[] = [
  { phase: "准备", title: "准备资料", icon: "resources", summary: "建好公司、GEO项目与素材，作为 AI 创作的原料基础", steps: [
    { name: "添加公司", icon: "company", description: "录入公司信息，作为内容与发布的主体" },
    { name: "添加GEO项目", icon: "project", description: "补充GEO项目/业务，让 AI 生成更精准" },
    { name: "添加知识库", icon: "folder", description: "上传知识库文档，为 AI 创作提供依据" },
  ] },
  { phase: "内容", title: "创作内容", icon: "magic", summary: "挖掘选题、配置提示词，AI 一键产出文章", steps: [
    { name: "生成搜索问题", icon: "questionList", description: "挖掘用户真实搜索，定位选题方向" },
    { name: "创建提示词", icon: "prompt", description: "配置写作模板，控制风格与结构" },
    { name: "生成文章", icon: "article", description: "结合素材/问题/提示词产出初稿" },
  ] },
  { phase: "发布", title: "发布分发", icon: "send", summary: "授权账号后，把内容排期分发到各个平台", steps: [
    { name: "授权账号", icon: "account", description: "绑定自媒体账号，准备自动发布" },
    { name: "创建发布", icon: "publish", description: "排期成发布任务，多平台分发" },
    { name: "客户端发布", icon: "checklist", description: "对需授权平台用客户端发布" },
  ] },
  { phase: "收录", title: "验证收录", icon: "monitor", summary: "查询各搜索引擎 / AI 的收录，验证 GEO 效果", steps: [
    { name: "收录查询", icon: "mail", description: "用插件助手查询内容收录情况" },
  ] },
];

export const downloadTools: { title: string; version: string; icon: DashIconName }[] = [
  { title: "GEO 助手 Windows", version: "v1.8.4", icon: "windows" },
  { title: "GEO 助手 Mac", version: "v1.8.3", icon: "mac" },
  { title: "收录提取插件", version: "v1.1.6.4", icon: "plugin" },
];
