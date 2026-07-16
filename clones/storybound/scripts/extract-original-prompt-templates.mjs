import { createRequire } from "node:module";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const args = process.argv.slice(2);
const sourceArg = args.find((arg) => arg.startsWith("--source="));
const outputArg = args.find((arg) => arg.startsWith("--output="));
const listOnly = args.includes("--list");
const mappingsOnly = args.includes("--mappings");
const stylesOnly = args.includes("--styles");
const tracksOnly = args.includes("--tracks");
const functionNeedleArg = args.find((arg) => arg.startsWith("--function-needle="));
const functionIndexArg = args.find((arg) => arg.startsWith("--function-index="));
const functionList = args.includes("--function-list");

if (!sourceArg) {
  throw new Error("Usage: node extract-original-prompt-templates.mjs --source=<index.js> [--list|--output=<file>]");
}

const sourcePath = resolve(sourceArg.slice("--source=".length));
const parserCandidates = [
  process.env.STORYBOUND_BABEL_PARSER,
  resolve(dirname(sourcePath), "node_modules/@babel/parser/lib/index.js"),
  resolve("node_modules/@babel/parser/lib/index.js"),
].filter(Boolean);
const parserPath = parserCandidates.find((candidate) => existsSync(candidate));
if (!parserPath) {
  throw new Error("找不到 @babel/parser；请在源文件同级安装，或通过 STORYBOUND_BABEL_PARSER 指定路径");
}
const { parse } = require(parserPath);
const source = readFileSync(sourcePath, "utf8");
const ast = parse(source, {
  sourceType: "module",
  errorRecovery: true,
  plugins: ["jsx", "typescript"],
});

function templateValue(node) {
  if (node?.type === "StringLiteral") return node.value;
  if (node?.type !== "TemplateLiteral" || node.expressions.length > 0) return null;
  return node.quasis.map((part) => part.value.cooked ?? part.value.raw).join("");
}

function walk(node, visit) {
  if (!node || typeof node !== "object") return;
  visit(node);
  for (const value of Object.values(node)) {
    if (Array.isArray(value)) {
      for (const child of value) walk(child, visit);
    } else if (value && typeof value === "object") {
      walk(value, visit);
    }
  }
}

const candidates = [];
walk(ast.program, (node) => {
  if (node.type !== "VariableDeclarator" || node.id?.type !== "Identifier") return;
  const value = templateValue(node.init);
  if (!value || value.length < 500 || !/\p{Script=Han}/u.test(value)) return;
  const firstHeading = value.split(/\r?\n/).find((line) => line.trim().startsWith("#"))?.trim() ?? "";
  candidates.push({ variable: node.id.name, length: value.length, heading: firstHeading, value });
});

if (functionNeedleArg) {
  const needle = functionNeedleArg.slice("--function-needle=".length);
  const matches = [];
  walk(ast.program, (node) => {
    if (!["FunctionDeclaration", "FunctionExpression", "ArrowFunctionExpression"].includes(node.type)) return;
    if (!Number.isInteger(node.start) || !Number.isInteger(node.end)) return;
    const code = source.slice(node.start, node.end);
    if (code.includes(needle)) matches.push({ length: code.length, code });
  });
  matches.sort((a, b) => a.length - b.length);
  if (functionList) {
    process.stdout.write(`${JSON.stringify(matches.map(({ length }, index) => ({ index, length })), null, 2)}\n`);
    process.exit(0);
  }
  const index = Math.max(0, Number(functionIndexArg?.slice("--function-index=".length) || 0));
  process.stdout.write(`${matches[index]?.code ?? ""}\n`);
  process.exit(0);
}

function staticValue(node) {
  if (["StringLiteral", "NumericLiteral", "BooleanLiteral"].includes(node?.type)) return node.value;
  if (node?.type === "NullLiteral") return null;
  if (node?.type === "UnaryExpression" && node.operator === "!" && node.argument?.type === "NumericLiteral") {
    return !node.argument.value;
  }
  if (node?.type === "ArrayExpression") {
    const values = node.elements.map(staticValue);
    return values.some((value) => value === undefined) ? undefined : values;
  }
  if (node?.type === "ObjectExpression") {
    const object = {};
    for (const property of node.properties) {
      if (property.type !== "ObjectProperty" || property.computed) return undefined;
      const key = property.key.type === "Identifier" ? property.key.name : property.key.value;
      const value = staticValue(property.value);
      if (typeof key !== "string" || value === undefined) return undefined;
      object[key] = value;
    }
    return object;
  }
  return undefined;
}

function collectStaticObjects(predicate) {
  const items = [];
  walk(ast.program, (node) => {
    if (node.type !== "ObjectExpression") return;
    const value = staticValue(node);
    if (value && predicate(value)) items.push(value);
  });
  return items;
}

if (tracksOnly) {
  const tracks = collectStaticObjects((item) =>
    typeof item.id === "string" && Array.isArray(item.skeletonScenes) && typeof item.defaultStyle === "string",
  );
  process.stdout.write(`${JSON.stringify(tracks, null, 2)}\n`);
  process.exit(0);
}

if (stylesOnly) {
  const styles = collectStaticObjects((item) =>
    typeof item.id === "string" && ("prefix" in item || "suffix" in item || "negativePrompt" in item || "allowColor" in item),
  );
  process.stdout.write(`${JSON.stringify(styles, null, 2)}\n`);
  process.exit(0);
}

if (mappingsOnly) {
  const names = new Set(candidates.map((item) => item.variable));
  const mappings = [];
  walk(ast.program, (node) => {
    if (node.type !== "ObjectExpression") return;
    const item = {};
    let referencesPrompt = false;
    for (const property of node.properties) {
      if (property.type !== "ObjectProperty" || property.computed) continue;
      const key = property.key.type === "Identifier" ? property.key.name : property.key.value;
      if (typeof key !== "string") continue;
      if (property.value.type === "Identifier") {
        item[key] = `$${property.value.name}`;
        if (names.has(property.value.name)) referencesPrompt = true;
      } else if (["StringLiteral", "NumericLiteral", "BooleanLiteral"].includes(property.value.type)) {
        item[key] = property.value.value;
      } else if (property.value.type === "NullLiteral") {
        item[key] = null;
      }
    }
    if (referencesPrompt) mappings.push(item);
  });
  process.stdout.write(`${JSON.stringify(mappings, null, 2)}\n`);
  process.exit(0);
}

if (listOnly || !outputArg) {
  process.stdout.write(`${JSON.stringify(candidates.map(({ variable, length, heading }) => ({ variable, length, heading })), null, 2)}\n`);
  process.exit(0);
}

const selected = Object.fromEntries(candidates.map(({ variable, value }) => [variable, value]));
const styleObjects = collectStaticObjects((item) =>
  typeof item.id === "string" && "prefix" in item && "suffix" in item && "negativePrompt" in item,
);
const trackObjects = collectStaticObjects((item) =>
  typeof item.id === "string" && Array.isArray(item.skeletonScenes) && typeof item.defaultStyle === "string",
);
const trackPromptVariables = {
  "character-story": { rewrite: "jx", metadata: "Ix", image: "Lx" },
  "health-book": { rewrite: "qx", metadata: "Hx", image: "Xx" },
  "culture-knowledge": { rewrite: "Dx", metadata: "Mx", image: "Ox" },
  "picture-book": { rewrite: "Wx", metadata: "Jx", image: "Yx" },
  ecommerce: { rewrite: "Ux", metadata: "$x", image: "zx" },
  inspirational: { rewrite: "Kx", metadata: "Vx", image: "Gx" },
  "folk-tale": { rewrite: "Fx", metadata: "Px", image: "Bx" },
  general: { rewrite: "Rx", metadata: "Cx", image: "Nx" },
};

const originalDefaultStyles = {
  "character-story": "black-white",
  "health-book": "oil-painting",
  "culture-knowledge": "ancient-cinematic",
  "picture-book": "pixar-3d",
  ecommerce: "realistic",
  inspirational: "cinematic",
  "folk-tale": "folk-tale-gongbi",
  general: "realistic",
};
const trackDescriptions = {
  "character-story": "历史人物 / 名人传记，纪实质感与情感渲染",
  "health-book": "健康养生 / 医学知识，印象派油画调性",
  "culture-knowledge": "华夏文化 / 传统民俗 / 国学智慧",
  "picture-book": "儿童绘本 / 睡前故事，可爱角色与梦幻场景",
  ecommerce: "产品种草 / 好物推荐，痛点、效果与促单结构",
  inspirational: "情感治愈 / 励志感悟 / 深夜电台",
  "folk-tale": "虚构传说 / 因果寓言 / 乡土传奇",
  general: "通用写实风，没有特定赛道时的兜底",
};
const configuredTracks = Object.fromEntries(trackObjects.map((item) => [item.id, item]));
const tracks = Object.entries(trackPromptVariables).map(([id, variables]) => ({
  id,
  name: configuredTracks[id]?.name ?? (id === "general" ? "通用故事" : id),
  description: trackDescriptions[id],
  defaultStyleId: originalDefaultStyles[id] ?? configuredTracks[id]?.defaultStyle ?? "realistic",
  needsCharacterCard: configuredTracks[id]?.needsCharacterCard ?? false,
  referenceKind: configuredTracks[id]?.referenceKind ?? "character",
  step3SkeletonModules: configuredTracks[id]?.step3SkeletonModules ?? [],
  skeletonScenes: configuredTracks[id]?.skeletonScenes ?? ["与当前字幕内容对应的可执行画面，中景构图，主体清晰"],
  fallbackScenes: configuredTracks[id]?.fallbackScenes ?? {
    l2: "简洁室内或街景，柔和自然光，主体清晰",
    l3: "无人物的环境空镜，柔和光影，画面沉静",
  },
  rewritePrompt: selected[variables.rewrite],
  metadataPrompt: selected[variables.metadata],
  imagePrompt: selected[variables.image],
}));
const library = {
  schemaVersion: 1,
  sourceVersion: "Storybound 1.13.1",
  precheckPrompt: selected.PR,
  sentenceSplitPrompt: selected.zR,
  writerAgentPrompt: selected.FR,
  storyboardAgentPrompt: selected.BR,
  producerAgentPrompt: selected.UR,
  tracks,
  styles: styleObjects,
};
const outputPath = resolve(outputArg.slice("--output=".length));
writeFileSync(outputPath, `${JSON.stringify(library, null, 2)}\n`, "utf8");
process.stdout.write(`Wrote ${tracks.length} tracks and ${styleObjects.length} styles to ${outputPath}\n`);
