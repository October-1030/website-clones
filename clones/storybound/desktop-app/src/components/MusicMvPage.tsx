import { useEffect, useRef, useState } from "react";
import { defaultTtsConfig } from "../data/tts-data";
import { generateMinimaxImages } from "../lib/image-api";
import {
  cancelMediaJob,
  createMediaJob,
  getMediaJob,
  listMediaJobs,
  renderMediaJob,
  updateMediaJob,
  uploadMediaAsset,
} from "../lib/media-workbench-api";
import {
  musicSingerLabels,
  musicStyleLabels,
  type MediaWorkbenchAsset,
  type MediaWorkbenchJobSummary,
  type MusicLyricGroup,
  type MusicMvJob,
  type MusicMvManifest,
  type MusicMvSinger,
  type MusicMvStyle,
} from "../types/media-workbench";
import type { TtsConfig } from "../types/tts";
import "./MusicMvPage.css";

interface MusicMvPageProps {
  ttsConfig?: TtsConfig;
}

const visualStyles = ["现代电影", "复古胶片", "中国水墨", "写实彩色", "油画风格", "水彩治愈", "民间故事工笔风"];
const mvStages = ["本地音乐", "歌词确认", "歌词分组", "绘图提示词", "MiniMax 图片", "真实时长对齐", "MP4 出片", "剪映草稿"];

function splitLyrics(value: string): string[] {
  const lines = value.replace(/\r/g, "").split(/\n+/u).map((line) => line.trim()).filter(Boolean);
  const chunks = lines.length > 1
    ? lines
    : value.split(/(?<=[。！？!?；;])|\n+/u).map((line) => line.trim()).filter(Boolean);
  return chunks.slice(0, 60);
}

function promptForGroup(
  lyrics: string,
  style: MusicMvStyle,
  customStyle: string,
  singer: MusicMvSinger,
  visualStyle: string,
): string {
  const styleText = style === "custom" ? customStyle.trim() || "自定义音乐情绪" : musicStyleLabels[style];
  return `${visualStyle}，${styleText}音乐 MV，${musicSingerLabels[singer]}演唱氛围，歌词意象：${lyrics}，电影感灯光，画面主体明确，竖屏构图，无文字，无水印`;
}

function createGroups(
  lyrics: string,
  style: MusicMvStyle,
  customStyle: string,
  singer: MusicMvSinger,
  visualStyle: string,
): MusicLyricGroup[] {
  return splitLyrics(lyrics).map((line, index) => ({
    id: index + 1,
    lyrics: line,
    prompt: promptForGroup(line, style, customStyle, singer, visualStyle),
    selected: false,
    status: "pending",
  }));
}

function createManifest(
  title: string,
  lyrics: string,
  style: MusicMvStyle,
  customStyle: string,
  singer: MusicMvSinger,
  visualStyle: string,
  groups: MusicLyricGroup[],
): MusicMvManifest {
  const timestamp = new Date().toISOString();
  return {
    schemaVersion: 1,
    kind: "music-mv",
    title: title.trim() || lyrics.replace(/\s+/g, " ").slice(0, 24) || "音乐 MV",
    lyrics,
    style,
    customStyle: style === "custom" ? customStyle : undefined,
    singer,
    visualStyle,
    aspectRatio: "9:16",
    width: 1080,
    height: 1920,
    fps: 30,
    groups,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

function imageAsset(input: { fileName?: string; path?: string; url?: string; bytes?: number }): MediaWorkbenchAsset {
  return {
    fileName: input.fileName || "image.jpg",
    path: input.path || "",
    url: input.url || "",
    bytes: input.bytes || 0,
    mimeType: "image/jpeg",
  };
}

function numberedFileValue(file: File): number {
  const match = file.name.match(/\d+/u);
  return match ? Number(match[0]) : Number.MAX_SAFE_INTEGER;
}

export function MusicMvPage({ ttsConfig = defaultTtsConfig }: MusicMvPageProps) {
  const [title, setTitle] = useState("");
  const [lyrics, setLyrics] = useState("");
  const [style, setStyle] = useState<MusicMvStyle>("nostalgic");
  const [customStyle, setCustomStyle] = useState("");
  const [singer, setSinger] = useState<MusicMvSinger>("any");
  const [visualStyle, setVisualStyle] = useState("现代电影");
  const [musicFile, setMusicFile] = useState<File | null>(null);
  const [job, setJob] = useState<MusicMvJob | null>(null);
  const [groups, setGroups] = useState<MusicLyricGroup[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [recentJobs, setRecentJobs] = useState<MediaWorkbenchJobSummary[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("选择本地 MP3/WAV/FLAC 并粘贴歌词；本地音乐路线不依赖 AI 作曲。");
  const [error, setError] = useState("");
  const abortRef = useRef<AbortController | null>(null);
  const musicInputRef = useRef<HTMLInputElement | null>(null);
  const imageImportRef = useRef<HTMLInputElement | null>(null);
  const coverInputRef = useRef<HTMLInputElement | null>(null);

  const selectedGroup = groups[selectedIndex];
  const readyImages = groups.filter((group) => group.image?.path).length;
  const currentStage = job?.status === "completed"
    ? 7
    : readyImages === groups.length && groups.length > 0
      ? 5
      : readyImages > 0
        ? 4
        : groups.length > 0
          ? 2
          : job?.manifest.music?.path
            ? 1
            : 0;

  useEffect(() => {
    let active = true;
    listMediaJobs()
      .then((payload) => {
        if (active) setRecentJobs(payload.jobs.filter((item) => item.kind === "music-mv").slice(0, 6));
      })
      .catch(() => undefined);
    return () => { active = false; };
  }, []);

  async function restoreJob(jobId: string) {
    setBusy(true);
    setError("");
    try {
      const restored = await getMediaJob<MusicMvManifest>(jobId);
      setJob(restored);
      setTitle(restored.manifest.title);
      setLyrics(restored.manifest.lyrics);
      setStyle(restored.manifest.style);
      setCustomStyle(restored.manifest.customStyle || "");
      setSinger(restored.manifest.singer);
      setVisualStyle(restored.manifest.visualStyle);
      setGroups(restored.manifest.groups);
      setSelectedIndex(0);
      setMessage(restored.status === "completed" ? "已恢复真实成片任务。" : "已恢复音乐 MV 断点。");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "恢复任务失败");
    } finally {
      setBusy(false);
    }
  }

  async function persistGroups(
    activeJob: MusicMvJob,
    nextGroups: MusicLyricGroup[],
    patch?: Partial<MusicMvManifest>,
    signal?: AbortSignal,
  ): Promise<MusicMvJob> {
    const manifest: MusicMvManifest = {
      ...activeJob.manifest,
      title: title.trim() || activeJob.manifest.title,
      lyrics,
      style,
      customStyle: style === "custom" ? customStyle : undefined,
      singer,
      visualStyle,
      groups: nextGroups,
      ...patch,
      updatedAt: new Date().toISOString(),
    };
    const updated = await updateMediaJob<MusicMvManifest>(activeJob.id, { title: manifest.title, manifest }, signal);
    setJob(updated);
    setGroups(updated.manifest.groups);
    return updated;
  }

  async function prepareTask() {
    if (!musicFile) throw new Error("请先选择本地 MP3、WAV 或 FLAC");
    if (lyrics.trim().length < 2) throw new Error("请粘贴歌词");
    const nextGroups = createGroups(lyrics, style, customStyle, singer, visualStyle);
    if (nextGroups.length === 0) throw new Error("没有拆出歌词分组");
    const controller = new AbortController();
    abortRef.current = controller;
    setBusy(true);
    setError("");
    setMessage("正在把本地音乐复制到隔离任务目录并读取真实时长…");
    try {
      const manifest = createManifest(title, lyrics, style, customStyle, singer, visualStyle, nextGroups);
      let created = await createMediaJob({ kind: "music-mv", title: manifest.title, manifest }, controller.signal) as MusicMvJob;
      const music = await uploadMediaAsset(created.id, musicFile, "music", controller.signal);
      created = await persistGroups(created, nextGroups, { music }, controller.signal);
      setJob(created);
      setGroups(created.manifest.groups);
      setSelectedIndex(0);
      setMessage(`本地音乐已保存并探测：${music.durationSec?.toFixed(2) || "未知"} 秒；已生成 ${nextGroups.length} 个可编辑歌词组。`);
    } catch (reason) {
      if ((reason as Error).name !== "AbortError") setError(reason instanceof Error ? reason.message : "创建任务失败");
    } finally {
      abortRef.current = null;
      setBusy(false);
    }
  }

  async function generateGroupImage(activeJob: MusicMvJob, group: MusicLyricGroup, signal?: AbortSignal): Promise<MusicLyricGroup> {
    setMessage(`正在用 MiniMax 生成第 ${group.id} 组画面…`);
    const result = await generateMinimaxImages({
      taskId: activeJob.id,
      prompts: [{ shotId: group.id, prompt: group.prompt, negativePrompt: "文字，歌词，水印，标志，低清晰度，畸形肢体" }],
      apiKey: ttsConfig.minimax.apiKey,
      aspectRatio: activeJob.manifest.aspectRatio,
      maxImages: 1,
      track: "音乐 MV",
      visualStyle,
    }, signal);
    const generated = result.images[0];
    if (!generated || generated.status !== "ready" || !generated.path) {
      throw new Error(generated?.error || `第 ${group.id} 组 MiniMax 生图失败`);
    }
    return {
      ...group,
      image: imageAsset({
        fileName: generated.path.split(/[\\/]/u).at(-1),
        path: generated.path,
        url: generated.url,
        bytes: generated.bytes,
      }),
      status: "ready",
      error: undefined,
    };
  }

  async function generateSelectedOrBatch() {
    if (!job) return;
    const selected = groups.filter((group) => group.selected);
    const targets = new Set((selected.length ? selected : groups).map((group) => group.id));
    const controller = new AbortController();
    abortRef.current = controller;
    setBusy(true);
    setError("");
    try {
      let workingJob = job;
      let workingGroups = [...groups];
      for (let index = 0; index < workingGroups.length; index += 1) {
        if (!targets.has(workingGroups[index].id)) continue;
        workingGroups[index] = await generateGroupImage(workingJob, workingGroups[index], controller.signal);
        workingJob = await persistGroups(workingJob, workingGroups, undefined, controller.signal);
        workingGroups = [...workingJob.manifest.groups];
      }
      setMessage(`MiniMax 已真实生成 ${targets.size} 张分镜图。`);
    } catch (reason) {
      if ((reason as Error).name !== "AbortError") setError(reason instanceof Error ? reason.message : "批量生图失败");
    } finally {
      abortRef.current = null;
      setBusy(false);
    }
  }

  async function importNumberedImages(files: FileList) {
    if (!job) return;
    const ordered = [...files].sort((left, right) => numberedFileValue(left) - numberedFileValue(right));
    if (ordered.length === 0) return;
    setBusy(true);
    setError("");
    try {
      const nextGroups = [...groups];
      for (let index = 0; index < Math.min(ordered.length, nextGroups.length); index += 1) {
        const asset = await uploadMediaAsset(job.id, ordered[index], "images");
        nextGroups[index] = { ...nextGroups[index], image: asset, status: "ready", error: undefined };
      }
      await persistGroups(job, nextGroups);
      setMessage(`已按文件名编号导入 ${Math.min(ordered.length, nextGroups.length)} 张本地图。`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "批量导入失败");
    } finally {
      setBusy(false);
    }
  }

  async function uploadCover(file: File) {
    if (!job) return;
    setBusy(true);
    setError("");
    try {
      const cover = await uploadMediaAsset(job.id, file, "cover");
      await persistGroups(job, groups, { cover });
      setMessage("本地封面已复制到任务目录。");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "上传封面失败");
    } finally {
      setBusy(false);
    }
  }

  async function generateCover() {
    if (!job) return;
    const controller = new AbortController();
    abortRef.current = controller;
    setBusy(true);
    setError("");
    setMessage("正在用 MiniMax 生成不带文字的 MV 封面底图…");
    try {
      const result = await generateMinimaxImages({
        taskId: job.id,
        prompts: [{
          shotId: 9001,
          prompt: `${visualStyle}，${musicStyleLabels[style]}音乐 MV 封面，主题：${title || lyrics.slice(0, 40)}，视觉中心明确，留出标题安全区，无文字，无水印`,
          negativePrompt: "文字，歌词，水印，标志，低清晰度",
        }],
        apiKey: ttsConfig.minimax.apiKey,
        aspectRatio: "9:16",
        maxImages: 1,
        track: "音乐 MV",
        visualStyle,
        coverBackgroundOnly: true,
      }, controller.signal);
      const generated = result.images[0];
      if (!generated?.path || generated.status !== "ready") throw new Error(generated?.error || "MiniMax 封面生成失败");
      await persistGroups(job, groups, {
        cover: imageAsset({ fileName: generated.path.split(/[\\/]/u).at(-1), path: generated.path, url: generated.url, bytes: generated.bytes }),
      }, controller.signal);
      setMessage("真实封面图片已保存。");
    } catch (reason) {
      if ((reason as Error).name !== "AbortError") setError(reason instanceof Error ? reason.message : "生成封面失败");
    } finally {
      abortRef.current = null;
      setBusy(false);
    }
  }

  async function renderOutput(timelineOnly = false) {
    if (!job) return;
    if (!job.manifest.music?.path) {
      setError("本地音乐文件尚未保存");
      return;
    }
    if (readyImages !== groups.length) {
      setError("每个歌词组都必须有真实图片");
      return;
    }
    setBusy(true);
    setError("");
    setMessage(timelineOnly ? "正在按真实音频时长重建时间轴…" : "正在用 ffmpeg 生成真实 MP4，并构建剪映草稿 ZIP…");
    try {
      const latest = await persistGroups(job, groups);
      const rendered = await renderMediaJob<MusicMvManifest>(latest.id, { manifest: latest.manifest, timelineOnly });
      setJob(rendered);
      setGroups(rendered.manifest.groups);
      setMessage("完成：音乐时长、歌词时间轴、MP4 和剪映草稿均来自真实本地文件。");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "音乐 MV 出片失败");
    } finally {
      setBusy(false);
    }
  }

  async function cancel() {
    abortRef.current?.abort();
    if (job) {
      try {
        setJob(await cancelMediaJob<MusicMvManifest>(job.id));
      } catch {
        // Persisted files are retained even if the active fetch already closed.
      }
    }
    setBusy(false);
    setMessage("已暂停；音乐、分组、prompt、图片和渲染分段均保留。");
  }

  function updateGroup(index: number, patch: Partial<MusicLyricGroup>) {
    setGroups((current) => current.map((group, itemIndex) => itemIndex === index ? { ...group, ...patch } : group));
  }

  function regeneratePrompts() {
    setGroups((current) => current.map((group) => ({
      ...group,
      prompt: promptForGroup(group.lyrics, style, customStyle, singer, visualStyle),
    })));
    setMessage("已按当前风格和演唱选择重建全部 prompt，尚未调用生图。");
  }

  function mergeWithNext(index: number) {
    if (index >= groups.length - 1) return;
    const mergedLyrics = `${groups[index].lyrics}\n${groups[index + 1].lyrics}`;
    const merged = {
      ...groups[index],
      lyrics: mergedLyrics,
      prompt: promptForGroup(mergedLyrics, style, customStyle, singer, visualStyle),
      image: undefined,
      status: "pending" as const,
    };
    const next = [...groups.slice(0, index), merged, ...groups.slice(index + 2)]
      .map((group, itemIndex) => ({ ...group, id: itemIndex + 1 }));
    setGroups(next);
    setSelectedIndex(Math.min(index, next.length - 1));
  }

  function deleteGroup(index: number) {
    const next = groups.filter((_, itemIndex) => itemIndex !== index).map((group, itemIndex) => ({ ...group, id: itemIndex + 1 }));
    setGroups(next);
    setSelectedIndex(Math.max(0, Math.min(selectedIndex, next.length - 1)));
  }

  function addGroup() {
    const text = "新增歌词组";
    const next = [...groups, {
      id: groups.length + 1,
      lyrics: text,
      prompt: promptForGroup(text, style, customStyle, singer, visualStyle),
      selected: false,
      status: "pending" as const,
    }];
    setGroups(next);
    setSelectedIndex(next.length - 1);
  }

  return (
    <div className={groups.length ? "music-mv-page running" : "music-mv-page"}>
      {groups.length > 0 && (
        <aside className="mv-step-rail">
          <div className="mv-brand"><span>MV</span><div><strong>音乐 MV</strong><small>本地音频真实流水线</small></div></div>
          {mvStages.map((stage, index) => (
            <div className={index < currentStage ? "done" : index === currentStage ? "active" : ""} key={stage}>
              <span>{index < currentStage ? "✓" : index + 1}</span>
              <div><strong>{stage}</strong><small>{index < currentStage ? "已有真实数据" : index === currentStage ? job?.stage || "当前步骤" : "等待上游"}</small></div>
            </div>
          ))}
          <div className="mv-rail-summary"><span>分组 {groups.length}</span><span>图片 {readyImages}/{groups.length}</span><span>音频 {job?.manifest.music?.durationSec?.toFixed(2) || "—"} 秒</span></div>
        </aside>
      )}

      <main className="music-mv-main">
        <header className="mv-page-header">
          <div><span>STORYBOUND · MUSIC MV</span><h1>音乐 MV 混剪</h1><p>本地音乐、歌词分组、MiniMax 分镜、真实时长对齐和剪映草稿。</p></div>
          {recentJobs.length > 0 && !job && <button disabled={busy} onClick={() => void restoreJob(recentJobs[0].id)} type="button">恢复最近断点</button>}
        </header>

        {groups.length === 0 ? (
          <div className="mv-config">
            <section className="mv-card">
              <div className="mv-card-title"><span>01</span><div><h2>本地歌曲与歌词</h2><p>MP3 / WAV / FLAC 必须真实可读；歌词由你提供。</p></div></div>
              <div className="mv-title-row"><label>MV 标题<input onChange={(event) => setTitle(event.target.value)} placeholder="可选，留空从歌词提取" value={title} /></label><button onClick={() => musicInputRef.current?.click()} type="button">{musicFile ? "更换本地音乐" : "选择本地音乐"}</button></div>
              <input accept=".mp3,.wav,.flac,audio/mpeg,audio/wav,audio/flac" hidden onChange={(event) => setMusicFile(event.target.files?.[0] || null)} ref={musicInputRef} type="file" />
              {musicFile && <div className="mv-file-chip"><strong>{musicFile.name}</strong><span>{(musicFile.size / 1024 / 1024).toFixed(2)} MB · 上传后由 ffprobe 读取真实时长</span></div>}
              <textarea onChange={(event) => setLyrics(event.target.value)} placeholder="粘贴完整歌词。建议一行一句，后续仍可合并、删除和新增分组。" value={lyrics} />
            </section>

            <section className="mv-card">
              <div className="mv-card-title"><span>02</span><div><h2>音乐风格与演唱</h2><p>用于歌词分组的视觉 prompt，不会伪造 AI 作曲。</p></div></div>
              <label>风格</label><div className="mv-chip-grid">{Object.entries(musicStyleLabels).map(([value, label]) => <button className={style === value ? "selected" : ""} key={value} onClick={() => setStyle(value as MusicMvStyle)} type="button">{label}</button>)}</div>
              {style === "custom" && <input className="mv-custom-style" onChange={(event) => setCustomStyle(event.target.value)} placeholder="例如：城市民谣，克制温暖，夜晚霓虹" value={customStyle} />}
              <label>演唱选择</label><div className="mv-chip-grid">{Object.entries(musicSingerLabels).map(([value, label]) => <button className={singer === value ? "selected" : ""} key={value} onClick={() => setSinger(value as MusicMvSinger)} type="button">{label}</button>)}</div>
              <label>画面风格</label><div className="mv-chip-grid">{visualStyles.map((item) => <button className={visualStyle === item ? "selected" : ""} key={item} onClick={() => setVisualStyle(item)} type="button">{item}</button>)}</div>
            </section>

            <div className="mv-start-row">
              <div><strong>本地音频路线完整可用</strong><span>不会因为没有 AI 作曲供应商而禁用。</span></div>
              <button disabled={busy || !musicFile || lyrics.trim().length < 2} onClick={() => void prepareTask()} type="button">{busy ? "读取真实音频…" : "保存音乐并拆分歌词"}</button>
            </div>
          </div>
        ) : (
          <div className="mv-workbench">
            <section className="mv-audio-card">
              <div><strong>{job?.manifest.title}</strong><span>{job?.manifest.music?.fileName} · {job?.manifest.music?.durationSec?.toFixed(2) || "等待探测"} 秒</span></div>
              {job?.manifest.music?.url && <audio controls preload="metadata" src={job.manifest.music.url} />}
              <button disabled={busy} onClick={regeneratePrompts} type="button">按当前设置重建 prompts</button>
            </section>

            <section className="mv-editor-grid">
              <div className="mv-selected-preview">
                <div className="mv-cover-frame">
                  {selectedGroup?.image?.url ? <img alt="" src={selectedGroup.image.url} /> : <span>第 {selectedGroup?.id} 组<br />等待真实图片</span>}
                  <div>{selectedGroup?.lyrics}</div>
                </div>
                <div className="mv-selected-actions">
                  <button disabled={busy} onClick={() => void generateSelectedOrBatch()} type="button">生成所选图片</button>
                  <button disabled={busy || selectedIndex >= groups.length - 1} onClick={() => mergeWithNext(selectedIndex)} type="button">与下一组合并</button>
                  <button className="danger" disabled={busy || groups.length <= 1} onClick={() => deleteGroup(selectedIndex)} type="button">删除本组</button>
                </div>
              </div>
              <div className="mv-group-editor">
                <label>歌词组<textarea onChange={(event) => updateGroup(selectedIndex, { lyrics: event.target.value })} value={selectedGroup?.lyrics || ""} /></label>
                <label>MiniMax prompt<textarea onChange={(event) => updateGroup(selectedIndex, { prompt: event.target.value })} value={selectedGroup?.prompt || ""} /></label>
                <div className="mv-timing-fact"><span>开始 {selectedGroup?.startSec?.toFixed(2) || "自动"}s</span><span>结束 {selectedGroup?.endSec?.toFixed(2) || "自动"}s</span><strong>{selectedGroup?.durationSec?.toFixed(2) || "出片时按真实音频分配"}s</strong></div>
                <div className="mv-cover-controls">
                  <span>发布封面：{job?.manifest.cover?.fileName || "默认使用第一张分镜"}</span>
                  <button disabled={busy} onClick={() => void generateCover()} type="button">MiniMax 生成封面</button>
                  <button disabled={busy} onClick={() => coverInputRef.current?.click()} type="button">上传本地封面</button>
                  <input accept=".png,.jpg,.jpeg,.webp" hidden onChange={(event) => { const file = event.target.files?.[0]; if (file) void uploadCover(file); event.target.value = ""; }} ref={coverInputRef} type="file" />
                </div>
              </div>
            </section>

            <section className="mv-toolbar">
              <label><input checked={groups.length > 0 && groups.every((group) => group.selected)} onChange={(event) => setGroups((current) => current.map((group) => ({ ...group, selected: event.target.checked })))} type="checkbox" /> 全选</label>
              <span>已选 {groups.filter((group) => group.selected).length} 组</span>
              <button disabled={busy} onClick={() => void generateSelectedOrBatch()} type="button">批量生成 / 重生</button>
              <button disabled={busy} onClick={() => imageImportRef.current?.click()} type="button">导入编号图片</button>
              <button disabled={busy} onClick={addGroup} type="button">＋ 新增歌词组</button>
              <input accept=".png,.jpg,.jpeg,.webp" hidden multiple onChange={(event) => { if (event.target.files) void importNumberedImages(event.target.files); event.target.value = ""; }} ref={imageImportRef} type="file" />
            </section>

            <section className="mv-storyboard-gallery">
              {groups.map((group, index) => (
                <article className={selectedIndex === index ? "selected" : group.error ? "failed" : ""} key={`${group.id}-${index}`}>
                  <button className="mv-card-select" onClick={() => setSelectedIndex(index)} type="button">
                    <span className="mv-shot-number">#{String(group.id).padStart(2, "0")}</span>
                    {group.image?.url ? <img alt={`第 ${group.id} 组`} src={group.image.url} /> : <span className="mv-image-empty">等待图片</span>}
                  </button>
                  <div className="mv-gallery-body">
                    <label><input checked={Boolean(group.selected)} onChange={(event) => updateGroup(index, { selected: event.target.checked })} type="checkbox" /> 选择</label>
                    <strong>{group.lyrics}</strong>
                    <p>{group.prompt}</p>
                    <span>{group.durationSec ? `${group.durationSec.toFixed(2)} 秒` : "待真实音频对齐"} · {group.image?.path ? "图片就绪" : "缺少图片"}</span>
                  </div>
                </article>
              ))}
            </section>

            {job?.output && (
              <section className="mv-output-card">
                <div><strong>真实音乐 MV 已生成</strong><span>{job.output.width}×{job.output.height} · {job.output.fps}fps · {job.output.videoCodec}/{job.output.audioCodec} · {job.output.durationSec.toFixed(2)} 秒</span></div>
                <a href={job.output.mp4Url}>下载 MP4</a>
                <a href={job.output.jianyingZipUrl}>下载剪映草稿 ZIP</a>
                <a href={job.output.manifestUrl}>查看时间轴清单</a>
              </section>
            )}
          </div>
        )}

        {(message || error) && <div className={error ? "mv-status error" : "mv-status"}><strong>{error ? "未完成" : busy ? "真实任务执行中" : "状态"}</strong><span>{error || message}</span></div>}

        {groups.length > 0 && (
          <footer className="mv-action-bar">
            <div><strong>{job?.status === "completed" ? "MP4 与剪映草稿已落盘" : "任务自动持久化"}</strong><span>{job?.stage || "可继续编辑"}</span></div>
            {busy && <button className="danger" onClick={() => void cancel()} type="button">取消并保留断点</button>}
            <button disabled={busy || readyImages !== groups.length} onClick={() => void renderOutput(true)} type="button">只重排时间轴</button>
            <button className="primary" disabled={busy || readyImages !== groups.length || !job?.manifest.music?.path} onClick={() => void renderOutput(false)} type="button">{busy ? "真实生成中…" : "生成 MP4 + 剪映草稿"}</button>
          </footer>
        )}
      </main>
    </div>
  );
}
