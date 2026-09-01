import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// URLs observed in the original page. Only public image files are downloaded.
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const assets = [
  ["https://nbgeo.oss-cn-shenzhen.aliyuncs.com/img/20260401123557_1772.png", "public/images/login-background.png"],
  ["https://geo.bihuogeo.com/favicon.ico", "public/seo/favicon.ico"],
  ["https://geo.bihuogeo.com/assets/geo-agent-CtRbLfrG.png", "public/images/geo-agent-CtRbLfrG.png"],
  ...["deepseek", "doubao", "yuanbao", "qwen", "wenxin", "kimi", "zhipu"].map((name) => [
    `https://ai-pm-test.oss-cn-shenzhen.aliyuncs.com/test/${name}-color.png`,
    `public/images/${name}-color.png`,
  ]),
];

const results = await Promise.allSettled(assets.map(async ([url, destination]) => {
  const response = await fetch(url, { signal: AbortSignal.timeout(30000) });
  if (!response.ok) throw new Error(`${response.status} downloading ${url}`);
  const target = resolve(root, destination);
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, new Uint8Array(await response.arrayBuffer()));
  console.log(`Saved ${destination}`);
}));
for (const result of results) {
  if (result.status === "rejected") { console.error(result.reason); process.exitCode = 1; }
}
