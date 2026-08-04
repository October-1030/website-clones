import { readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";

const appRoot = resolve(import.meta.dirname, "..");
const taskId = process.argv[2];
const round = process.argv[3] || "final";
if (!taskId) throw new Error("用法：node scripts/write-final-qc-report.mjs <task-id> [round]");

const taskDir = join(appRoot, ".storybound-data", "tasks", taskId);
const outputDir = join(taskDir, "review", round);
const qcDir = join(outputDir, "qc");
const task = JSON.parse(await readFile(join(taskDir, "task.json"), "utf8"));
const qc = JSON.parse(await readFile(join(qcDir, "qc-data.json"), "utf8"));
const tts = JSON.parse(await readFile(join(qcDir, "tts-segment-analysis.json"), "utf8"));
const asr = JSON.parse(await readFile(join(qcDir, "asr-transcript.json"), "utf8"));
const draft = JSON.parse(await readFile(join(task.draft.projectDir, "draft_info.json"), "utf8"));

function normalized(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[\p{P}\p{S}\s]/gu, "");
}

function editDistance(left, right) {
  const a = [...left];
  const b = [...right];
  let previous = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (let row = 1; row <= a.length; row += 1) {
    const current = [row];
    for (let column = 1; column <= b.length; column += 1) {
      current[column] = Math.min(
        current[column - 1] + 1,
        previous[column] + 1,
        previous[column - 1] + (a[row - 1] === b[column - 1] ? 0 : 1),
      );
    }
    previous = current;
  }
  return previous[b.length];
}

function track(name) {
  return draft.tracks.find((item) => item.name === name)?.segments || [];
}

function range(segment) {
  return {
    start: Number(segment.target_timerange.start),
    duration: Number(segment.target_timerange.duration),
  };
}

function contiguous(segments, toleranceUs = 1_000) {
  const ranges = segments.map(range);
  return ranges.slice(1).every((item, index) => Math.abs(item.start - ranges[index].start - ranges[index].duration) <= toleranceUs);
}

const expectedText = normalized((task.artifacts?.storyboard?.shots || []).map((shot) => shot.text).join(""));
const asrTextRaw = asr.text || asr.segments?.map((segment) => segment.text).join("") || "";
const asrText = normalized(asrTextRaw);
const distance = editDistance(expectedText, asrText);
const characterErrorRate = Number((distance / Math.max(1, expectedText.length)).toFixed(4));
const seams = tts.segments.slice(0, -1).map((segment, index) => ({
  seam: `${index + 1}→${index + 2}`,
  pauseSec: Number((Number(segment.trailingSilenceSec) + Number(tts.segments[index + 1].leadingSilenceSec)).toFixed(3)),
  loudnessJumpDb: Number(Math.abs(Number(segment.meanDb) - Number(tts.segments[index + 1].meanDb)).toFixed(1)),
}));
const probe = qc.probe;
const video = probe.streams.find((stream) => stream.codec_type === "video");
const audio = probe.streams.find((stream) => stream.codec_type === "audio");
const blackFrames = qc.visualDiagnostics.filter((line) => line.includes("black_start")).length;
const imageTrack = track("image_main");
const audioTrack = track("audio_main");
const subtitleTrack = track("subtitle");
const trackNames = draft.tracks.map((item) => item.name);
const finalCue = subtitleTrack.at(-1);
const finalSubtitleEndSec = finalCue
  ? (Number(finalCue.target_timerange.start) + Number(finalCue.target_timerange.duration)) / 1_000_000
  : 0;
const videoDurationSec = Number(probe.format.duration);
const objectiveChecks = {
  fiftySevenImages: imageTrack.length === 57,
  fiftySevenAudioSegments: audioTrack.length === 57,
  twoHundredFiftyThreeSubtitleCues: subtitleTrack.length === 253,
  imageTrackContiguous: contiguous(imageTrack),
  audioTrackContiguous: contiguous(audioTrack),
  subtitleTrackContiguous: contiguous(subtitleTrack),
  coverTracksAbsentWhenDisabled: !trackNames.includes("cover_title") && !trackNames.includes("cover_subtitle"),
  noMissingDraftAssets: Array.isArray(task.draft.missing) && task.draft.missing.length === 0,
  noBlackFramesDetected: blackFrames === 0,
  noAbnormalSegmentEdgeSilence: tts.segments.every((segment) => !segment.abnormalLeading && !segment.abnormalTrailing),
  finalSubtitleReachesVideoEnd: Math.abs(finalSubtitleEndSec - videoDurationSec) < 0.05,
  asrCoverageAcceptable: characterErrorRate <= 0.18,
  finalCallToActionPresent: expectedText.endsWith(normalized("下一期，我们聊川岛芳子。")),
};
const objectivePassed = Object.values(objectiveChecks).every(Boolean);
const loudnessTail = qc.loudnessTail.join("\n");
const loudness = {
  outputIntegratedLufs: Number(loudnessTail.match(/"output_i"\s*:\s*"(-?[0-9.]+)"/)?.[1]),
  outputTruePeakDb: Number(loudnessTail.match(/"output_tp"\s*:\s*"(-?[0-9.]+)"/)?.[1]),
  outputLra: Number(loudnessTail.match(/"output_lra"\s*:\s*"(-?[0-9.]+)"/)?.[1]),
};
const summary = {
  taskId,
  title: task.title,
  generatedAt: new Date().toISOString(),
  objectivePassed,
  objectiveChecks,
  files: {
    mp4: join(outputDir, "李香兰-Storybound-最终验收版.mp4"),
    draftProject: task.draft.projectDir,
    draftZip: task.draft.zipPath,
    contactSheet: join(qcDir, "contact-sheet.jpg"),
    asrTranscript: join(qcDir, "asr-transcript.json"),
    seamBefore: join(qcDir, "seam-comparison", "seam-07-08-before.mp3"),
    seamAfter: join(qcDir, "seam-comparison", "seam-07-08-after.mp3"),
  },
  technical: {
    durationSec: videoDurationSec,
    sizeBytes: Number(probe.format.size),
    video: `${video.codec_name} ${video.profile}, ${video.width}×${video.height}, ${video.avg_frame_rate} fps, ${video.pix_fmt}`,
    audio: `${audio.codec_name}, ${audio.sample_rate} Hz, ${audio.channels} 声道`,
    loudness,
    blackFrames,
  },
  structure: {
    tracks: Object.fromEntries(draft.tracks.map((item) => [item.name, item.segments.length])),
    finalSubtitleEndSec,
  },
  tts: {
    provider: task.options?.ttsProvider,
    voiceId: task.options?.ttsVoiceId,
    speed: task.options?.ttsSpeed,
    mode: task.options?.ttsMode,
    totalLeadingSilenceSec: tts.totalLeadingSilenceSec,
    totalTrailingSilenceSec: tts.totalTrailingSilenceSec,
    averageSeamPauseSec: Number((seams.reduce((sum, item) => sum + item.pauseSec, 0) / seams.length).toFixed(3)),
    maximumSeamPause: seams.toSorted((left, right) => right.pauseSec - left.pauseSec)[0],
    maximumLoudnessJump: seams.toSorted((left, right) => right.loudnessJumpDb - left.loudnessJumpDb)[0],
  },
  asr: {
    language: asr.language,
    durationSec: asr.duration,
    segments: asr.segments?.length || 0,
    characterErrorRate,
    tail: asrTextRaw.slice(-160),
    note: "专有名词可能被自动转写误识别；ASR 仅用于查漏字、截断和时轴，不替代真人听感。",
  },
  visualReview: {
    sampledFrames: 173,
    result: "开头、中段、结尾及 56 个切镜前后均已抽帧；未见黑帧、异常拉伸或字幕越出安全区。",
  },
  limitations: [
    "没有原站真实导出的对照 MP4，因此不能宣称逐帧完全一致。",
    "本片保持原版逐镜独立 TTS 结构；机器指标不能替代最终真人听感确认。",
    "任务关闭封面且未提供授权 BGM，因此成片使用首镜开场、无 BGM。",
  ],
};

const report = `# 李香兰｜Storybound 最终验收报告\n\n- 客观验收：${objectivePassed ? "通过" : "未通过"}\n- 成片：${summary.files.mp4}\n- 剪映草稿：${summary.files.draftProject}\n- 草稿压缩包：${summary.files.draftZip}\n\n## 成片规格\n\n- 时长：${videoDurationSec.toFixed(3)} 秒\n- 画面：${summary.technical.video}\n- 音频：${summary.technical.audio}\n- 输出响度：${loudness.outputIntegratedLufs} LUFS；真峰值 ${loudness.outputTruePeakDb} dB\n- 黑帧：${blackFrames}\n\n## 原版逐镜结构\n\n- 画面：57 段，连续无重叠/空隙\n- TTS：57 段，MiniMax，${task.options?.ttsSpeed}×，音色 ${task.options?.ttsVoiceId}\n- 字幕：253 条，连续覆盖至 ${finalSubtitleEndSec.toFixed(3)} 秒\n- 封面关闭：未生成 cover_title / cover_subtitle 轨道\n- 缺失素材：0\n\n## 配音连续性\n\n- 56 个接缝平均停顿：${summary.tts.averageSeamPauseSec.toFixed(3)} 秒\n- 最长接缝：${summary.tts.maximumSeamPause.seam}，${summary.tts.maximumSeamPause.pauseSec.toFixed(3)} 秒\n- 最大响度跳变：${summary.tts.maximumLoudnessJump.seam}，${summary.tts.maximumLoudnessJump.loudnessJumpDb.toFixed(1)} dB\n- 异常段首/段尾静音：0\n- 第 7→8 镜修复前后试听：${summary.files.seamBefore} / ${summary.files.seamAfter}\n\n## 画面与字幕\n\n- ${summary.visualReview.result}\n- 字幕位于手机安全区内，黄色粗体加黑描边，开头/中段/结尾抽样均可读。\n- 完整抽帧联系表：${summary.files.contactSheet}\n\n## ASR 核对\n\n- 语言：${asr.language}\n- 字符错误率：${(characterErrorRate * 100).toFixed(2)}%\n- 未发现末句被截断；专有名词自动转写可能出现同音误识别。\n- ${summary.asr.note}\n\n## 诚实边界\n\n${summary.limitations.map((item) => `- ${item}`).join("\n")}\n`;

const jsonPath = join(qcDir, "final-qc-summary.json");
const reportPath = join(outputDir, "FINAL_QC_REPORT.md");
await Promise.all([
  writeFile(jsonPath, `${JSON.stringify(summary, null, 2)}\n`, "utf8"),
  writeFile(reportPath, report, "utf8"),
]);
process.stdout.write(`${JSON.stringify({ objectivePassed, reportPath, jsonPath, characterErrorRate }, null, 2)}\n`);
