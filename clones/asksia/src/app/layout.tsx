import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "StudyPal AI",
  description: "你的个人大学学习 AI 助手。",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="zh-CN" className="h-full antialiased"><body className="min-h-full">{children}</body></html>;
}
