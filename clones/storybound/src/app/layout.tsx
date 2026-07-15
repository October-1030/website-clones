import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Storybound · 一句话，一段故事，一键成片",
  description:
    "Storybound — AI 桌面工具，把文案变成视频。从分镜到剪映草稿全自动。粘贴文案，几分钟出片，剪映里直接微调。下载即送 5 次免费试用。",
  keywords: [
    "Storybound",
    "AI视频",
    "文案变视频",
    "剪映草稿",
    "AI改写",
    "AI生图",
    "AI配音",
    "声音克隆",
    "自媒体工具",
    "短视频创作",
  ],
  icons: {
    icon: {
      url: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' rx='7' fill='%234ade80'/%3E%3Ctext x='16' y='23' font-family='Inter,system-ui' font-size='20' font-weight='800' text-anchor='middle' fill='%23061612'%3ES%3C/text%3E%3C/svg%3E",
      type: "image/svg+xml",
    },
  },
};

export const viewport: Viewport = {
  themeColor: "#061612",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
