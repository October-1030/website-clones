import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { basename } from "node:path";

const require = createRequire(import.meta.url);
const { parse } = require(
  "C:/Users/pdb12/AppData/Local/Temp/storybound-analysis/node_modules/@babel/parser/lib/index.js",
);

const args = process.argv.slice(2);
const maxLengthArg = args.find((arg) => arg.startsWith("--max-length="));
const maxLength = maxLengthArg ? Number(maxLengthArg.split("=")[1]) : Infinity;
const lines = args.includes("--lines");
const objects = args.includes("--objects");
const files = args.filter((arg) => !arg.startsWith("--"));

if (files.length === 0) {
  throw new Error("Pass one or more extracted JavaScript files.");
}

const hasHan = (value) => /\p{Script=Han}/u.test(value);
const clean = (value) => value.replace(/\s+/g, " ").trim();

function collectStrings(node, result) {
  if (!node || typeof node !== "object") return;

  if (
    (node.type === "StringLiteral" || node.type === "DirectiveLiteral") &&
    hasHan(node.value)
  ) {
    result.add(clean(node.value));
  }

  if (node.type === "TemplateElement") {
    const value = node.value?.cooked ?? node.value?.raw ?? "";
    if (hasHan(value)) result.add(clean(value));
  }

  for (const value of Object.values(node)) {
    if (Array.isArray(value)) {
      for (const child of value) collectStrings(child, result);
    } else if (value && typeof value === "object") {
      collectStrings(value, result);
    }
  }
}

function propertyName(node) {
  if (node?.type === "Identifier") return node.name;
  if (node?.type === "StringLiteral") return node.value;
  return null;
}

function primitiveValue(node) {
  if (node?.type === "StringLiteral" || node?.type === "NumericLiteral" || node?.type === "BooleanLiteral") {
    return node.value;
  }
  if (node?.type === "NullLiteral") return null;
  if (node?.type === "ArrayExpression") {
    const values = node.elements.map(primitiveValue);
    return values.some((value) => value === undefined) ? undefined : values;
  }
  return undefined;
}

function collectObjects(node, result) {
  if (!node || typeof node !== "object") return;
  if (node.type === "ObjectExpression") {
    const item = {};
    for (const property of node.properties) {
      if (property.type !== "ObjectProperty") continue;
      const key = propertyName(property.key);
      const value = primitiveValue(property.value);
      if (key && value !== undefined) item[key] = value;
    }
    const serialized = JSON.stringify(item);
    if (
      Object.keys(item).length >= 2 &&
      ("label" in item || "title" in item || "name" in item || "path" in item) &&
      hasHan(serialized)
    ) {
      result.add(serialized);
    }
  }
  for (const value of Object.values(node)) {
    if (Array.isArray(value)) {
      for (const child of value) collectObjects(child, result);
    } else if (value && typeof value === "object") {
      collectObjects(value, result);
    }
  }
}

for (const file of files) {
  const source = readFileSync(file, "utf8");
  const ast = parse(source, {
    sourceType: "module",
    errorRecovery: true,
    plugins: ["jsx", "typescript"],
  });
  const strings = new Set();
  collectStrings(ast, strings);
  if (objects) {
    const found = new Set();
    collectObjects(ast, found);
    process.stdout.write(`### ${basename(file)}\n${[...found].sort().join("\n")}\n`);
    continue;
  }
  const sorted = [...strings]
    .filter((value) => value && value.length <= maxLength && !value.startsWith("["))
    .sort((a, b) => a.localeCompare(b, "zh-CN"));
  if (lines) {
    process.stdout.write(`### ${basename(file)}\n${sorted.join("\n")}\n`);
  } else {
    process.stdout.write(`${JSON.stringify({ file: basename(file), strings: sorted })}\n`);
  }
}
