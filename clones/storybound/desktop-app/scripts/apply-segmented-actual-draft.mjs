import { constants } from "node:fs";
import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { basename, join, resolve } from "node:path";

const appRoot = resolve(import.meta.dirname, "..");
const taskId = process.argv[2];
const round = process.argv[3] || "segmented-actual";
const serverBase = process.argv[4] || "http://127.0.0.1:5173";

if (!taskId) {
  throw new Error("用法：node scripts/apply-segmented-actual-draft.mjs <task-id> [round-name] [server-base]");
}

function trackByName(draft, name) {
  return draft.tracks.find((track) => track.name === name);
}

function timerange(segment) {
  return {
    startUs: Number(segment.target_timerange.start),
    durationUs: Number(segment.target_timerange.duration),
    endUs: Number(segment.target_timerange.start) + Number(segment.target_timerange.duration),
  };
}

function contiguous(items, toleranceUs = 1) {
  return items.slice(1).every((item, index) => Math.abs(item.startUs - items[index].endUs) <= toleranceUs);
}

const taskDir = join(appRoot, ".storybound-data", "tasks", taskId);
const reviewDir = join(taskDir, "review", round);
const qcDir = join(reviewDir, "qc");
await mkdir(qcDir, { recursive: true });

const taskPath = join(taskDir, "task.json");
const task = JSON.parse(await readFile(taskPath, "utf8"));
const plan = JSON.parse(await readFile(join(reviewDir, "review-plan.json"), "utf8"));
const analysis = JSON.parse(await readFile(join(qcDir, "tts-segment-analysis.json"), "utf8"));

if (plan.mode !== "original-segmented") throw new Error(`错误的验收模式：${plan.mode}`);
if (plan.timeline.length !== 9 || analysis.segments.length !== 9) throw new Error("怀表验收必须恰好包含 9 个分镜和 9 段 TTS");
if (analysis.segments.some((segment) => segment.abnormalLeading || segment.abnormalTrailing)) {
  throw new Error("仍有异常首尾静音，不能写入正式逐镜草稿");
}

const backupPath = join(reviewDir, "task-before-segmented-actual.json");
await copyFile(taskPath, backupPath, constants.COPYFILE_EXCL).catch((error) => {
  if (error.code !== "EEXIST") throw error;
});

const currentAudio = new Map((task.media?.audioSegments || []).map((segment) => [Number(segment.shotId), segment]));
const audioSegments = plan.timeline.map((item) => {
  const existing = currentAudio.get(Number(item.shotId));
  if (!existing?.path) throw new Error(`分镜 #${item.shotId} 缺少原始 TTS 文件`);
  return {
    ...existing,
    durationSec: Number(item.durationSec),
    startSec: Number(item.startSec),
    status: "ready",
  };
});
const timeline = plan.timeline.map(({ shotId, text, startSec, endSec, durationSec }) => ({
  shotId,
  text,
  startSec,
  endSec,
  durationSec,
}));

const patchResponse = await fetch(`${serverBase}/api/tasks/${encodeURIComponent(taskId)}`, {
  method: "PATCH",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({
    options: { ...task.options, ttsMode: "original-segmented" },
    media: {
      audioSegments,
      continuousAudio: null,
      externalAudio: null,
      timeline,
    },
  }),
});
if (!patchResponse.ok) throw new Error(`更新任务失败（HTTP ${patchResponse.status}）：${await patchResponse.text()}`);

const draftResponse = await fetch(`${serverBase}/api/tasks/${encodeURIComponent(taskId)}/draft`, { method: "POST" });
if (!draftResponse.ok) throw new Error(`生成草稿失败（HTTP ${draftResponse.status}）：${await draftResponse.text()}`);
const draftResult = await draftResponse.json();
const projectDir = draftResult.draft.projectDir;
const draftInfoPath = join(projectDir, "draft_info.json");
const draft = JSON.parse(await readFile(draftInfoPath, "utf8"));

const imageTrack = trackByName(draft, "image_main");
const audioTrack = trackByName(draft, "audio_main");
const subtitleTrack = trackByName(draft, "subtitle");
if (!imageTrack || !audioTrack || !subtitleTrack) throw new Error("剪映草稿缺少 image_main、audio_main 或 subtitle 轨道");

const imageRanges = imageTrack.segments.map(timerange);
const audioRanges = audioTrack.segments.map(timerange);
const subtitleRanges = subtitleTrack.segments.map(timerange);
const expectedRanges = timeline.map((item) => ({
  startUs: Math.round(item.startSec * 1_000_000),
  endUs: Math.round(item.endSec * 1_000_000),
  durationUs: Math.round(item.durationSec * 1_000_000),
}));
const rangeMatches = imageRanges.every((range, index) => range.startUs === expectedRanges[index].startUs && range.endUs === expectedRanges[index].endUs)
  && audioRanges.every((range, index) => range.startUs === expectedRanges[index].startUs && range.endUs === expectedRanges[index].endUs);
const subtitleGroups = expectedRanges.map((shot, index) => {
  const cues = subtitleRanges.filter((cue) => cue.startUs >= shot.startUs && cue.endUs <= shot.endUs);
  return {
    shotId: index + 1,
    cueCount: cues.length,
    startsAtShotBoundary: cues[0]?.startUs === shot.startUs,
    endsAtShotBoundary: cues.at(-1)?.endUs === shot.endUs,
    noOverlapOrGap: contiguous(cues),
  };
});

const finalCue = plan.cues.at(-1);
const validation = {
  mode: "original-segmented",
  evidenceContract: "每镜独立图片、独立 TTS、独立字幕组；按 MP3 实测时长连续排列",
  taskId,
  projectDir,
  draftInfoPath,
  draftZipPath: draftResult.draft.zipPath,
  durationSec: draftResult.draft.durationSec,
  expectedDurationSec: plan.totalDurationSec,
  counts: {
    imageSegments: imageRanges.length,
    audioSegments: audioRanges.length,
    subtitleCues: subtitleRanges.length,
    subtitleGroups: subtitleGroups.length,
  },
  checks: {
    nineImages: imageRanges.length === 9,
    nineAudioSegments: audioRanges.length === 9,
    nineSubtitleGroups: subtitleGroups.length === 9 && subtitleGroups.every((group) => group.cueCount > 0),
    imageTrackContiguous: contiguous(imageRanges),
    audioTrackContiguous: contiguous(audioRanges),
    imageAudioRangesMatchMeasuredTimeline: rangeMatches,
    subtitleGroupsCoverEachShotWithoutUnexpectedGap: subtitleGroups.every((group) => group.startsAtShotBoundary && group.endsAtShotBoundary && group.noOverlapOrGap),
    finalSentenceComplete: finalCue?.text === "重新去找到它" && Math.abs(finalCue.endSec - plan.totalDurationSec) < 0.001,
  },
  subtitleGroups,
  imageRanges,
  audioRanges,
  finalCue,
  backupPath,
};
validation.passed = Object.values(validation.checks).every(Boolean);
const validationPath = join(qcDir, "draft-structure-validation.json");
await writeFile(validationPath, `${JSON.stringify(validation, null, 2)}\n`, "utf8");
if (!validation.passed) throw new Error(`草稿结构验收失败，详见 ${validationPath}`);

process.stdout.write(`${JSON.stringify({
  projectDir,
  projectName: basename(projectDir),
  draftZipPath: draftResult.draft.zipPath,
  durationSec: draftResult.draft.durationSec,
  validationPath,
  counts: validation.counts,
  passed: validation.passed,
})}\n`);
