import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AskSia Pro APP",
  description: "Your AI Study Copilot.",
  icons: { icon: "/seo/asksia.ico" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en" className="h-full antialiased"><body className="min-h-full">{children}</body></html>;
}
