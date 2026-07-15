import type { NavigationItem, PipelineStep } from "../types/app";

export const navGroups: NavigationItem[][] = [
  [
    { page: "queue", label: "任务队列", icon: "☷" },
    { page: "history", label: "历史任务", icon: "◷" },
  ],
  [
    { page: "playground", label: "画图实验室", icon: "◉" },
    { page: "voice-lab", label: "配音实验室", icon: "♬" },
    { page: "person-assets", label: "人物素材库", icon: "▣" },
  ],
  [
    { page: "prompt-templates", label: "提示词模板", icon: "✧" },
    { page: "draft-templates", label: "草稿模板", icon: "▤" },
  ],
  [
    { page: "book-selection", label: "选品助手", icon: "▥" },
    { page: "benchmark", label: "对标监控", icon: "☷" },
    { page: "market", label: "创作市场", icon: "▽" },
  ],
  [
    { page: "settings", label: "系统设置", icon: "⚙" },
    { page: "account", label: "账号管理", icon: "◎" },
    { page: "activation", label: "激活管理", icon: "⌁" },
  ],
];

export const pipelineSteps: PipelineStep[] = [
  { id: 0, title: "文案预审", description: "清理广告 / 敏感词" },
  { id: 1, title: "智能改写与封面生成", description: "正文 / 标题 / 发布文案 / 标签 / 评论" },
  { id: 2, title: "影视分镜分句", description: "拆成可配图的单元" },
  { id: 3, title: "生成绘图提示词", description: "为每个分镜写 prompt" },
  { id: 4, title: "批量生图", description: "并发调用 AI 绘画" },
  { id: 5, title: "TTS 配音", description: "生成音频" },
  { id: 6, title: "生成剪映草稿", description: "打包 JSON + 资源" },
];

export const contentTracks = [
  "人物故事",
  "健康图书",
  "传统文化",
  "绘本故事",
  "电商带货",
  "心灵鸡汤",
  "民间故事",
  "通用故事",
  "美食探店V2",
];

export const visualStyles = [
  "黑白摄影",
  "写实彩色",
  "油画风格",
  "现代电影",
  "古风电影",
  "复古胶片",
  "水彩治愈",
  "杂志插画",
  "皮克斯 3D",
  "中国水墨",
  "民间故事工笔风",
  "吉卜力",
  "黑板橙绘",
];
