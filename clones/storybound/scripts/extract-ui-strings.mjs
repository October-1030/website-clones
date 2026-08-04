import { readFileSync } from "node:fs";

const files = process.argv.slice(2);

if (files.length === 0) {
  throw new Error("Usage: node extract-ui-strings.mjs <file...>");
}

for (const file of files) {
  const source = readFileSync(file, "utf8");
  const strings = new Set();
  const pattern = /(["'`])((?:\\.|(?!\1)[\s\S])*?)\1/g;
  let match;
  while ((match = pattern.exec(source))) {
    const value = match[2]
      .replace(/\\n/g, " ")
      .replace(/\\r/g, " ")
      .replace(/\\t/g, " ")
      .replace(/\\(["'`\\])/g, "$1")
      .replace(/\s+/g, " ")
      .trim();
    if (!/[\u3400-\u9fff]/u.test(value)) continue;
    if (value.length < 2 || value.length > 220) continue;
    strings.add(value);
  }
  process.stdout.write(`\n## ${file}\n`);
  for (const value of [...strings].sort((left, right) => left.localeCompare(right, "zh-CN"))) {
    process.stdout.write(`- ${value}\n`);
  }
}
