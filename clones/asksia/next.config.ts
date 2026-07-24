import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  output: "standalone",
  outputFileTracingExcludes: {
    "/api/transcribe": [
      "./docs/**/*",
      "./e2e/**/*",
      "./tests/**/*",
      "./scripts/**/*",
      "./public/**/*",
      "./src/**/*",
      "./.studypal-data/**/*",
      "./*.md",
      "./components.json",
      "./next.config.ts",
      "./eslint.config.mjs",
      "./postcss.config.mjs",
      "./tsconfig.json",
      "./package-lock.json",
    ],
  },
  allowedDevOrigins: ["127.0.0.1", "localhost", "192.168.0.250"],
  turbopack: {
    root: path.resolve(process.cwd(), "../.."),
  },
};

export default nextConfig;
