import type { NextConfig } from "next";
import path from "node:path";
import { existsSync } from "node:fs";

const nextConfig: NextConfig = {
  devIndicators: false,
  turbopack: { root: existsSync(path.join(process.cwd(), "node_modules/next")) ? process.cwd() : path.resolve(process.cwd(), "../..") },
};

export default nextConfig;
