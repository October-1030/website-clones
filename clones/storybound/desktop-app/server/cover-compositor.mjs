import { execFile } from "node:child_process";
import { copyFile, rm, stat, writeFile } from "node:fs/promises";
import { basename, dirname, extname, join } from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const ffmpegCandidates = [
  process.env.FFMPEG_PATH,
  "ffmpeg",
].filter(Boolean);

function assEscape(value) {
  return String(value || "")
    .replaceAll("\\", "\\\\")
    .replaceAll("{", "\\{")
    .replaceAll("}", "\\}")
    .replace(/[\r\n]+/g, " ")
    .trim();
}

function visibleLength(value) {
  return Math.max(1, [...String(value || "").replace(/\s/g, "")].length);
}

const templateStyles = {
  "cinematic-poster": { titleColor: "&H0000DEFF", subtitleColor: "&H00FFFFFF", titleY: 0.43, boxY: 0.31, boxHeight: 0.34 },
  "minimal-clean": { titleColor: "&H00FFFFFF", subtitleColor: "&H00E6E6E6", titleY: 0.39, boxY: 0.30, boxHeight: 0.30 },
  "portrait-emotion": { titleColor: "&H0000DEFF", subtitleColor: "&H00FFFFFF", titleY: 0.64, boxY: 0.52, boxHeight: 0.30 },
  "typographic-impact": { titleColor: "&H0000DEFF", subtitleColor: "&H00FFFFFF", titleY: 0.40, boxY: 0.27, boxHeight: 0.43 },
  "guofeng-poster": { titleColor: "&H0000D8FF", subtitleColor: "&H00FFFFFF", titleY: 0.43, boxY: 0.31, boxHeight: 0.34 },
  "legend-portrait": { titleColor: "&H0000D8FF", subtitleColor: "&H00FFFFFF", titleY: 0.39, boxY: 0.26, boxHeight: 0.43 },
  // Legacy task files created before the template ids were aligned.
  minimal: { titleColor: "&H00FFFFFF", subtitleColor: "&H00E6E6E6", titleY: 0.39, boxY: 0.30, boxHeight: 0.30 },
  emotional: { titleColor: "&H0000DEFF", subtitleColor: "&H00FFFFFF", titleY: 0.64, boxY: 0.52, boxHeight: 0.30 },
  "chinese-ink": { titleColor: "&H0000D8FF", subtitleColor: "&H00FFFFFF", titleY: 0.43, boxY: 0.31, boxHeight: 0.34 },
  "legendary-portrait": { titleColor: "&H0000D8FF", subtitleColor: "&H00FFFFFF", titleY: 0.39, boxY: 0.26, boxHeight: 0.43 },
};

function clamp(value, minimum, maximum) {
  return Math.max(minimum, Math.min(maximum, value));
}

function assDocument(title, subtitles, width, height, templateId) {
  const safeTitle = assEscape(title);
  const safeSubtitles = subtitles.map(assEscape).filter(Boolean).slice(0, 2);
  const style = templateStyles[templateId] || templateStyles["cinematic-poster"];
  const titleSize = clamp(Math.floor(width * 0.82 / (visibleLength(safeTitle) * 0.96)), 72, 180);
  const subtitleSize = clamp(Math.floor(width * 0.82 / (Math.max(10, ...safeSubtitles.map(visibleLength)) * 0.96)), 34, 58);
  const centerX = Math.round(width / 2);
  const centerY = Math.round(height * style.titleY);
  const subtitleStart = centerY + Math.round(titleSize * 0.78 + subtitleSize * 0.55);
  const events = [
    `Dialogue: 0,0:00:00.00,9:59:59.00,Title,,0,0,0,,{\\an5\\pos(${centerX},${centerY})}${safeTitle}`,
    ...safeSubtitles.map((text, index) => `Dialogue: 0,0:00:00.00,9:59:59.00,Subtitle,,0,0,0,,{\\an5\\pos(${centerX},${subtitleStart + index * Math.round(subtitleSize * 1.45)})}${text}`),
  ];
  return `[Script Info]
ScriptType: v4.00+
PlayResX: ${width}
PlayResY: ${height}
WrapStyle: 2
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name,Fontname,Fontsize,PrimaryColour,SecondaryColour,OutlineColour,BackColour,Bold,Italic,Underline,StrikeOut,ScaleX,ScaleY,Spacing,Angle,BorderStyle,Outline,Shadow,Alignment,MarginL,MarginR,MarginV,Encoding
Style: Title,Microsoft YaHei,${titleSize},${style.titleColor},${style.titleColor},&H00101010,&H00000000,-1,0,0,0,100,100,2,0,1,7,2,5,40,40,40,1
Style: Subtitle,Microsoft YaHei,${subtitleSize},${style.subtitleColor},${style.subtitleColor},&H00101010,&H00000000,-1,0,0,0,100,100,1,0,1,5,1,5,60,60,30,1

[Events]
Format: Layer,Start,End,Style,Name,MarginL,MarginR,MarginV,Effect,Text
${events.join("\n")}
`;
}

export async function renderTitledCover({ sourcePath, destinationPath = sourcePath, title, subtitles = [], width = 1080, height = 1920, templateId = "cinematic-poster" }) {
  if (!sourcePath || !String(title || "").trim()) return null;
  const directory = dirname(sourcePath);
  const token = `${process.pid}-${Date.now()}`;
  const assName = `cover-text-${token}.ass`;
  const assPath = join(directory, assName);
  const extension = extname(destinationPath) || extname(sourcePath) || ".jpg";
  const outputPath = join(directory, `cover-composited-${token}${extension}`);
  const backupPath = join(directory, `cover-source-${token}${extension}`);
  const style = templateStyles[templateId] || templateStyles["cinematic-poster"];
  await writeFile(assPath, assDocument(title, subtitles, width, height, templateId), "utf8");
  let lastError;
  try {
    for (const ffmpeg of ffmpegCandidates) {
      try {
        const filter = `scale=${width}:${height}:force_original_aspect_ratio=increase,crop=${width}:${height},drawbox=x=0:y=ih*${style.boxY}:w=iw:h=ih*${style.boxHeight}:color=black@0.78:t=fill,ass=${assName}`;
        await execFileAsync(ffmpeg, ["-y", "-i", basename(sourcePath), "-vf", filter, "-frames:v", "1", "-q:v", "2", basename(outputPath)], {
          cwd: directory,
          windowsHide: true,
          timeout: 120_000,
          maxBuffer: 8 * 1024 * 1024,
        });
        await copyFile(destinationPath, backupPath).catch(() => copyFile(sourcePath, backupPath));
        await copyFile(outputPath, destinationPath);
        const info = await stat(destinationPath);
        return { path: destinationPath, backupPath, bytes: info.size, width, height, textRenderer: `original-template:${templateId}` };
      } catch (error) {
        lastError = error;
      }
    }
    throw lastError || new Error("找不到可用的 ffmpeg");
  } finally {
    await Promise.all([
      rm(assPath, { force: true }),
      rm(outputPath, { force: true }),
    ]);
  }
}
