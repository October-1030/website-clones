import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "星月写作",
  description: "星月写作，灵感随行。你的 AI 创作工作台。",
  icons: { icon: "/seo/favicon.ico" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  // Some browser extensions add attributes to body before React hydrates.
  return <html lang="zh-CN"><body suppressHydrationWarning>{children}</body></html>;
}
