const baseUrl = process.env.STORYBOUND_URL || "http://127.0.0.1:5193";

const context = {
  title: "旧钟表店",
  inputText: "凌晨两点，旧钟表店的门铃忽然响了。老人抬起头，看见门外站着一个浑身湿透的年轻人。年轻人把一只停走多年的怀表放在柜台上，说它昨晚突然开始倒着走。",
  track: "通用故事",
  videoForm: "narration",
  visualStyle: "现代电影",
  aspectRatio: "9:16",
  sourceMode: "paste",
  rewriteIntensity: "standard",
  narrativePov: "original",
};

async function run(step, artifacts) {
  const response = await fetch(`${baseUrl}/api/llm/pipeline`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ step, config: { provider: "minimax", apiKey: "", baseUrl: "", model: "" }, context, artifacts }),
  });
  if (!response.ok) throw new Error(`${step}: HTTP ${response.status} ${await response.text()}`);
  return response.json();
}

const artifacts = {};
const precheck = await run("precheck", artifacts);
artifacts.precheck = precheck.data;
if (!artifacts.precheck?.cleanText) throw new Error("预审未返回 cleanText");

const rewrite = await run("rewrite", artifacts);
artifacts.rewrite = rewrite.data;
if (!artifacts.rewrite?.narration || !artifacts.rewrite?.title || !artifacts.rewrite?.summary) throw new Error("WriterAgent 或封面元数据不完整");

const storyboard = await run("storyboard", artifacts);
artifacts.storyboard = storyboard.data;
if (!artifacts.storyboard?.shots?.length || artifacts.storyboard.shots.some((shot) => !shot.text)) throw new Error("分镜锚点未生成有效镜头");

const prompts = await run("prompts", artifacts);
artifacts.prompts = prompts.data;
if (artifacts.prompts?.prompts?.length !== artifacts.storyboard.shots.length) throw new Error("绘图提示词数量与分镜不一致");
if (artifacts.prompts.prompts.some((item) => !item.prompt || !item.negativePrompt)) throw new Error("绘图提示词缺少正向或负向提示词");

process.stdout.write(`${JSON.stringify({
  ok: true,
  sourceVersion: artifacts.prompts.templateVersion,
  title: artifacts.rewrite.title,
  subtitleCount: artifacts.rewrite.subtitle?.length || 0,
  commentCount: artifacts.rewrite.comments?.length || 0,
  shots: artifacts.storyboard.shots.length,
  prompts: artifacts.prompts.prompts.length,
})}\n`);
