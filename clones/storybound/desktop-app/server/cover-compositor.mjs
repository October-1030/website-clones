import { execFile } from "node:child_process";
import { copyFile, rm, stat, writeFile } from "node:fs/promises";
import { basename, dirname, extname, join } from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const ffmpegCandidates = [
  process.env.FFMPEG_PATH,
  "C:\\Users\\pdb12\\AppData\\Local\\Microsoft\\WinGet\\Packages\\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\\ffmpeg-7.1.1-full_build\\bin\\ffmpeg.exe",
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

function assDocument(title, subtitles, width, height) {
  const safeTitle = assEscape(title);
  const safeSubtitles = subtitles.map(assEscape).filter(Boolean).slice(0, 2);
  const titleSize = Math.max(54, Math.min(96, Math.floor(width * 0.72 / visibleLength(safeTitle))));
  const subtitleSize = Math.max(30, Math.min(46, Math.floor(width * 0.78 / Math.max(12, ...safeSubtitles.map(visibleLength)))));
  const centerX = Math.round(width / 2);
  const centerY = Math.round(height * 0.46);
  const subtitleStart = centerY + Math.round(titleSize * 1.15);
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
Style: Title,Microsoft YaHei,${titleSize},&H0000DEFF,&H0000DEFF,&H00101010,&H00000000,-1,0,0,0,100,100,2,0,1,5,2,5,40,40,40,1
Style: Subtitle,Microsoft YaHei,${subtitleSize},&H00FFFFFF,&H00FFFFFF,&H00101010,&H00000000,-1,0,0,0,100,100,1,0,1,4,1,5,60,60,30,1

[Events]
Format: Layer,Start,End,Style,Name,MarginL,MarginR,MarginV,Effect,Text
${events.join("\n")}
`;
}

export async function renderTitledCover({ sourcePath, destinationPath = sourcePath, title, subtitles = [], width = 1080, height = 1920 }) {
  if (!sourcePath || !String(title || "").trim()) return null;
  const directory = dirname(sourcePath);
  const token = `${process.pid}-${Date.now()}`;
  const assName = `cover-text-${token}.ass`;
  const assPath = join(directory, assName);
  const extension = extname(destinationPath) || extname(sourcePath) || ".jpg";
  const outputPath = join(directory, `cover-composited-${token}${extension}`);
  const backupPath = join(directory, `cover-source-${token}${extension}`);
  await writeFile(assPath, assDocument(title, subtitles, width, height), "utf8");
  let lastError;
  try {
    for (const ffmpeg of ffmpegCandidates) {
      try {
        const filter = `scale=${width}:${height}:force_original_aspect_ratio=increase,crop=${width}:${height},drawbox=x=0:y=ih*0.34:w=iw:h=ih*0.36:color=black@0.82:t=fill,ass=${assName}`;
        await execFileAsync(ffmpeg, ["-y", "-i", basename(sourcePath), "-vf", filter, "-frames:v", "1", "-q:v", "2", basename(outputPath)], {
          cwd: directory,
          windowsHide: true,
          timeout: 120_000,
          maxBuffer: 8 * 1024 * 1024,
        });
        await copyFile(destinationPath, backupPath).catch(() => copyFile(sourcePath, backupPath));
        await copyFile(outputPath, destinationPath);
        const info = await stat(destinationPath);
        return { path: destinationPath, backupPath, bytes: info.size, width, height };
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
