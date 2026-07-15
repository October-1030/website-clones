import { readFileSync } from "node:fs";

const [file, ...needles] = process.argv.slice(2);

if (!file || needles.length === 0) {
  throw new Error("Usage: node extract-code-context.mjs <file> <needle...>");
}

const source = readFileSync(file, "utf8");

for (const needle of needles) {
  let cursor = 0;
  let count = 0;
  while (count < 8) {
    const index = source.indexOf(needle, cursor);
    if (index === -1) break;
    const start = Math.max(0, index - 1600);
    const end = Math.min(source.length, index + needle.length + 2600);
    process.stdout.write(`\n### ${needle} @ ${index}\n${source.slice(start, end)}\n`);
    cursor = index + needle.length;
    count += 1;
  }
}
