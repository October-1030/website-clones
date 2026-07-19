import { readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";

const appRoot = resolve(import.meta.dirname, "..");
const taskId = process.argv[2];
const beforeRound = process.argv[3] || "round-2";
const afterRound = process.argv[4] || "audio-fix";

if (!taskId) {
  throw new Error("用法：node scripts/summarize-audio-continuity.mjs <task-id> [before-round] [after-round]");
}

const taskPath = join(appRoot, ".storybound-data", "tasks", taskId, "task.json");
const taskDir = dirname(taskPath);
const load = async (round) => JSON.parse(await readFile(join(taskDir, "review", round, "qc", "audio-continuity.json"), "utf8"));
const before = await load(beforeRound);
const after = await load(afterRound);
const rows = after.seams.map((afterSeam, index) => {
  const beforeSeam = before.seams[index];
  return {
    seam: afterSeam.seam,
    beforeSilenceSec: beforeSeam.silenceSec,
    afterSilenceSec: afterSeam.silenceSec,
    silenceReducedSec: Number((beforeSeam.silenceSec - afterSeam.silenceSec).toFixed(3)),
    beforeLoudnessJumpDb: beforeSeam.loudnessJumpDb,
    afterLoudnessJumpDb: afterSeam.loudnessJumpDb,
    treatment: "改单条连续 MiniMax TTS；取消独立音频硬拼和估算时长补白；依据连续音频 ASR 发声点重建镜头与字幕时间轴",
  };
});
const summary = {
  taskId,
  beforeRound,
  afterRound,
  treatment: "优先方案 1：整篇文案一次合成，不使用 9 段拼接、裁剪或交叉淡化",
  before: {
    averageSilenceSec: before.averageSilenceSec,
    maxSilenceSec: before.maxSilenceSec,
    maxLoudnessJumpDb: before.maxLoudnessJumpDb,
  },
  after: {
    averageSilenceSec: after.averageSilenceSec,
    maxSilenceSec: after.maxSilenceSec,
    maxLoudnessJumpDb: after.maxLoudnessJumpDb,
  },
  rows,
  note: "响度跳变是接缝前后短窗平均值之差；连续音频内不存在数字剪接点，因此该值同时包含正常语气、重音和音素差异，只用于辅助定位。",
};
const qcDir = join(taskDir, "review", afterRound, "qc");
const jsonPath = join(qcDir, "audio-continuity-comparison.json");
const markdownPath = join(qcDir, "audio-continuity-comparison.md");
const table = rows.map((row) => `| ${row.seam} | ${row.beforeSilenceSec.toFixed(3)} | ${row.afterSilenceSec.toFixed(3)} | ${row.beforeLoudnessJumpDb.toFixed(1)} | ${row.afterLoudnessJumpDb.toFixed(1)} | ${row.treatment} |`).join("\n");
const markdown = `# 配音连续性修复对照\n\n- 处理方式：${summary.treatment}\n- 平均接缝静音：${summary.before.averageSilenceSec.toFixed(3)} 秒 → ${summary.after.averageSilenceSec.toFixed(3)} 秒\n- 最长接缝静音：${summary.before.maxSilenceSec.toFixed(3)} 秒 → ${summary.after.maxSilenceSec.toFixed(3)} 秒\n- 最大短窗响度差：${summary.before.maxLoudnessJumpDb.toFixed(1)} dB → ${summary.after.maxLoudnessJumpDb.toFixed(1)} dB\n\n| 接缝 | 修复前静音(s) | 修复后静音(s) | 修复前响度差(dB) | 修复后响度差(dB) | 处理方式 |\n| --- | ---: | ---: | ---: | ---: | --- |\n${table}\n\n> ${summary.note}\n`;
await writeFile(jsonPath, `${JSON.stringify(summary, null, 2)}\n`, "utf8");
await writeFile(markdownPath, markdown, "utf8");
process.stdout.write(`${JSON.stringify({ jsonPath, markdownPath, before: summary.before, after: summary.after })}\n`);
