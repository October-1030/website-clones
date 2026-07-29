import type { NextConfig } from "next";
import path from "node:path";

const publicDeployment = process.env.STUDYPAL_DEPLOYMENT_MODE === "public";
const contentSecurityPolicy = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data: https://fonts.gstatic.com",
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co",
  "media-src 'self' blob:",
  "worker-src 'self' blob:",
  "manifest-src 'self'",
  ...(publicDeployment ? ["upgrade-insecure-requests"] : []),
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: contentSecurityPolicy },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  { key: "Referrer-Policy", value: "no-referrer" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  {
    key: "Permissions-Policy",
    value: "camera=(), geolocation=(), payment=(), usb=(), browsing-topics=(), microphone=(self), display-capture=(self)",
  },
  { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
];

const nextConfig: NextConfig = {
  output: "standalone",
  outputFileTracingRoot: path.resolve(process.cwd(), "../.."),
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
  outputFileTracingExcludes: {
    "/api/transcribe": [
      "./clones/asksia/.env*",
      "./clones/asksia/docs/**/*",
      "./clones/asksia/e2e/**/*",
      "./clones/asksia/tests/**/*",
      "./clones/asksia/src/**/*",
      "./clones/asksia/public/**/*",
      "./clones/asksia/supabase/**/*",
      "./clones/asksia/extension/**/*",
      "./clones/asksia/scripts/asksia-*.mjs",
      "./clones/asksia/package-lock.json",
      "./clones/asksia/next.config.ts",
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
