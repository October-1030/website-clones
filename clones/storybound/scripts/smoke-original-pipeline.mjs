const baseUrl = process.env.STORYBOUND_URL || "http://127.0.0.1:5173";
const promptsOnly = process.argv.includes("--prompts-only");
const context = {
  title: "停在凌晨两点十七分的怀表",
  inputText: "她第一次见到那只旧怀表，是在外婆去世后的第三天。表针停在凌晨两点十七分，可每到深夜，她总能听见抽屉里传来细微的滴答声。直到某天，她把表贴近耳边，里面传出的不是机械声，而是外婆年轻时留下的一句话。",
  track: "人物故事",
  videoForm: "narration",
  visualStyle: "黑白摄影",
  aspectRatio: "9:16",
};
const artifacts = promptsOnly ? {
  precheck: { title: context.title, cleanText: context.inputText, warnings: [], sensitiveTerms: [] },
  rewrite: { title: context.title, narration: context.inputText, publishCopy: "", tags: [], pinnedComment: "" },
  storyboard: {
    characterCard: {
      name: "外孙女",
      identity: "整理外婆遗物的年轻女性",
      age: "二十多岁",
      gender: "女",
      appearance: "黑色长发，清瘦脸型，眼神安静",
      clothing: "深色针织衫",
    },
    shots: [
      { id: 1, text: context.inputText.slice(0, 48), visual: "年轻女性在旧房间窗边打开怀表", emotion: "怀念、悬疑", durationSec: 5 },
      { id: 2, text: context.inputText.slice(48), visual: "怀表指针与抽屉的近景", emotion: "神秘、克制", durationSec: 5 },
    ],
  },
} : {};

for (const step of promptsOnly ? ["prompts"] : ["precheck", "rewrite", "storyboard", "prompts"]) {
  const response = await fetch(`${baseUrl}/api/llm/pipeline`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ step, config: {}, context, artifacts }),
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(`${step}: ${payload.error || response.status}`);
  artifacts[payload.step] = payload.data;
  console.log(JSON.stringify({
    step,
    title: payload.data.title,
    shotCount: payload.data.shots?.length,
    hasCharacterCard: Boolean(payload.data.characterCard),
    promptCount: payload.data.prompts?.length,
    templateVersion: payload.data.templateVersion,
    trackId: payload.data.trackId,
    styleId: payload.data.styleId,
  }));
}

if (!artifacts.storyboard?.characterCard) throw new Error("人物故事未生成人物一致性卡");
if (artifacts.prompts?.templateVersion !== "Storybound 1.13.1") throw new Error("未使用原版提示词库");
if (artifacts.prompts?.trackId !== "character-story" || artifacts.prompts?.styleId !== "black-white") {
  throw new Error("赛道或原版默认画风映射错误");
}
if (artifacts.prompts.prompts.length !== artifacts.storyboard.shots.length) throw new Error("分镜与提示词数量不一致");
if (!artifacts.prompts.prompts.every((item) => item.prompt.includes("画面中避免出现"))) {
  throw new Error("原版负面提示词未适配进 MiniMax prompt");
}
console.log("Storybound 1.13.1 原版提示词流水线 smoke test passed");
