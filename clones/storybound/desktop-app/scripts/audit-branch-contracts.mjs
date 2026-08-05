import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { sourceContentForm, rewriteStructureIssue, taskRewriteIntegrityIssue } from "../server/pipeline-integrity.mjs";
import { createTaskStore } from "../server/task-store.mjs";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const expectedTracks = [
  "人物故事",
  "健康图书",
  "传统文化",
  "绘本故事",
  "电商带货",
  "心灵鸡汤",
  "民间故事",
  "通用故事",
];
const expectedStyles = [
  "黑白摄影",
  "写实彩色",
  "油画风格",
  "现代电影",
  "古风电影",
  "复古胶片",
  "水彩治愈",
  "杂志插画",
  "皮克斯 3D",
  "中国水墨",
  "民间故事工笔风",
  "吉卜力",
  "黑板橙绘",
];

async function text(relativePath) {
  return readFile(join(root, relativePath), "utf8");
}

function includesAll(contents, values, label) {
  for (const value of values) {
    assert.ok(contents.includes(value), `${label} 缺少 ${value}`);
  }
}

const checks = [];
async function check(name, run) {
  try {
    await run();
    checks.push({ name, ok: true });
  } catch (error) {
    checks.push({ name, ok: false, error: error instanceof Error ? error.message : String(error) });
  }
}

const [promptLibraryText, appData, appSource, createForm, builderModel, taskBuilder, draftBuilder] = await Promise.all([
  text("original-prompt-library.json"),
  text("src/data/app-data.ts"),
  text("src/App.tsx"),
  text("src/components/TaskCreateForm.tsx"),
  text("src/components/task-builder-model.ts"),
  text("src/components/TaskBuilder.tsx"),
  text("server/draft-builder.mjs"),
]);
const promptLibrary = JSON.parse(promptLibraryText);

await check("8 个赛道与原版提示词库一致", () => {
  assert.deepEqual(promptLibrary.tracks.map((item) => item.name), expectedTracks);
  includesAll(appData, expectedTracks, "创建页赛道");
  for (const track of promptLibrary.tracks) {
    assert.ok(track.rewritePrompt?.length > 300, `${track.name} 缺少改写提示词`);
    assert.ok(track.metadataPrompt?.length > 300, `${track.name} 缺少元数据提示词`);
    assert.ok(track.imagePrompt?.length > 300, `${track.name} 缺少绘图提示词`);
  }
});

await check("13 套画风与原版提示词库一致", () => {
  assert.deepEqual(promptLibrary.styles.map((item) => item.name), expectedStyles);
  includesAll(appData, expectedStyles, "创建页画风");
  for (const style of promptLibrary.styles) {
    assert.ok(style.prefix && style.suffix && style.negativePrompt, `${style.name} 的正负提示词不完整`);
  }
});

await check("19 个原版路由入口均有本地挂载", () => {
  includesAll(appSource, [
    "/create", "/home", "/html-video", "/music-mv", "/queue", "/batch-summary/",
    "/history", "/playground", "/voice-lab", "/person-assets", "/prompt-templates",
    "/templates", "/book-selection", "/benchmark", "/market", "/settings", "/account", "/activation",
  ], "路由表");
  assert.ok(appSource.includes("/task/${encodeURIComponent(taskId)}"), "缺少任务详情动态路由");
});

await check("创建页公开分支值完整", () => {
  includesAll(createForm, [
    'value: "auto"', 'value: "semi_auto"', 'value: "direct"',
    'value: "none"', 'value: "key"', 'value: "every"', 'value: "custom"',
    'value: "standard"', 'value: "deep"', 'value: "rewrite"',
    'value: "original"', 'value: "first"', 'value: "third"',
    'value: "narration"', 'value: "podcast"',
    '["ai", "AI 绘图"', '["stock", "网络素材"', '["local", "我的素材库"',
    '["off", "关闭"]', '["titled", "带标题文字"]', '["plain", "留白不带字"]', '["local", "本地上传"]',
    '["tts", "系统配音（TTS 生成）"]', '["external", "上传自定义配音"]',
    'ttsMode === "original-segmented"', 'ttsMode === "continuous"',
  ], "创建页");
});

await check("赛道切换同时更新模板和默认画风", () => {
  includesAll(createForm, [
    "promptTemplateId: `system-${track}`",
    "promptTemplateOverride: null",
    "visualStyle: originalDefaultStyleByTrack[track]",
  ], "赛道联动");
  includesAll(builderModel, [
    "promptTemplateId: form.promptTemplateId",
    "promptTemplateOverride: form.promptTemplateOverride",
  ], "任务落盘");
});

await check("不支持的组合在落盘前被确定性关闭", () => {
  includesAll(builderModel, [
    'form.materialSource === "ai"',
    'form.videoForm === "narration"',
    'form.materialSource !== "stock" && form.coverMode !== "off"',
    'coverMode: coverEnabled ? form.coverMode : "off"',
    'secondCover: coverEnabled && form.coverMode !== "local" && form.secondCover',
    'ttsProvider: form.videoForm === "podcast" ? "volcengine" : form.ttsProvider',
  ], "分支约束");
});

await check("三种执行模式和四种暂停策略有真实执行端", () => {
  assert.ok(builderModel.includes('mode === "auto" ? 0 : 2'), "执行模式没有映射到正确起始步骤");
  includesAll(taskBuilder, [
    'activeTask.mode === "direct"',
    'activeTask.pausePreset === "every"',
    'activeTask.pausePreset === "key"',
    'activeTask.pausePreset === "custom"',
    "activeTask.customPauseSteps.includes(step)",
  ], "流水线模式");
});

await check("AI/网络/本地素材三条路径有明确消费端或边界", () => {
  assert.ok(createForm.includes("独立版未接入原作者私有素材检索服务"), "网络素材分支没有公开能力边界");
  includesAll(taskBuilder, [
    'activeTask.options.materialSource === "ai"',
    'activeTask.options.materialSource === "stock" ? "网络素材" : "我的素材库"',
    "replaceDynamicVideo",
  ], "素材路径");
});

await check("逐镜/连续/外部音频/播客均进入真实时间线与草稿", () => {
  includesAll(taskBuilder, [
    'activeTask.options.voiceSource === "external"',
    'activeTask.videoForm === "podcast"',
    'activeTask.options.ttsMode === "continuous"',
    "timelineFromWordAlignment",
    "timelineForTotalDuration",
    "timelineFromShots",
  ], "配音流水线");
  includesAll(draftBuilder, ["continuousAudio", "externalAudio", "podcastImageMode", "audioSegments"], "草稿打包器");
});

await check("观点清单文案不会再被赛道模板改成虚构故事", () => {
  const source = "真正困住一个人的，往往不是没有机会，而是四种听起来正确的自我安慰。第一，只看碎片信息。第二，只等待完美时机。第三，只计划不行动。第四，只想长期结果却不付短期成本。";
  const drifted = "有个人叫李勤，村里人都说他聪明。几年后他遇见老和尚，拜师之后终于盖起了新房。";
  assert.equal(sourceContentForm(source), "opinion-list");
  assert.ok(rewriteStructureIssue(drifted, source));
  const task = {
    mode: "auto",
    track: "心灵鸡汤",
    inputText: source,
    options: { promptTemplateId: "system-民间故事" },
    artifacts: {},
  };
  assert.match(taskRewriteIntegrityIssue(task), /赛道.*模板.*不一致/u);
});

await check("任务存储覆盖每个枚举值并可无损恢复", async () => {
  const dataRoot = await mkdtemp(join(tmpdir(), "storybound-branch-audit-"));
  const previous = process.env.STORYBOUND_DATA_DIR;
  process.env.STORYBOUND_DATA_DIR = dataRoot;
  try {
    const store = createTaskStore(root);
    const cases = [
      ["mode", ["auto", "semi_auto", "direct"]],
      ["pausePreset", ["none", "key", "every", "custom"]],
      ["videoForm", ["narration", "podcast"]],
    ];
    let serial = 0;
    for (const [field, values] of cases) {
      for (const value of values) {
        serial += 1;
        const id = `audit-${field}-${serial}`;
        const created = await store.createTask({ id, [field]: value, inputText: "用于枚举分支持久化验证的测试文案，内容不会调用外部服务，也不会生成图片或音频。" });
        const restored = await store.readTask(created.id);
        assert.equal(restored[field], value, `${field}=${value} 未正确恢复`);
      }
    }
    const optionValues = {
      materialSource: ["ai", "stock", "local"],
      coverMode: ["off", "titled", "plain", "local"],
      voiceSource: ["tts", "external"],
      ttsProvider: ["minimax", "volcengine"],
      ttsMode: ["original-segmented", "continuous"],
      podcastImageMode: ["multi", "single"],
    };
    for (const [field, values] of Object.entries(optionValues)) {
      for (const value of values) {
        serial += 1;
        const id = `audit-option-${serial}`;
        await store.createTask({ id, inputText: "用于选项分支持久化验证的测试文案，测试后会自动删除。", options: { [field]: value } });
        const restored = await store.readTask(id);
        assert.equal(restored.options[field], value, `${field}=${value} 未正确恢复`);
      }
    }
  } finally {
    if (previous === undefined) delete process.env.STORYBOUND_DATA_DIR;
    else process.env.STORYBOUND_DATA_DIR = previous;
    await rm(dataRoot, { recursive: true, force: true });
  }
});

const failed = checks.filter((item) => !item.ok);
for (const item of checks) {
  console.log(`${item.ok ? "PASS" : "FAIL"} ${item.name}${item.error ? ` — ${item.error}` : ""}`);
}
console.log(`\n${checks.length - failed.length}/${checks.length} branch contract checks passed`);
if (failed.length) process.exitCode = 1;
