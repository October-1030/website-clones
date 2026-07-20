import { pipelineSteps } from "../data/app-data";
import { draftTemplateById } from "../data/draft-templates";
import type { PipelineStatus } from "../types/app";
import type { ImagePrompt, StoryboardShot } from "../types/llm";
import type { StoredImage, StoryboundTask, TaskTimelineEntry } from "../types/task";

interface TaskWorkbenchProps {
  task: StoryboundTask;
  busy: boolean;
  onTaskChange: (task: StoryboundTask) => void;
  onPause: () => void;
  onContinue: () => void;
  onCancel: () => void;
  onRunFromStep: (step: number) => void;
  onSaveArtifact: (step: number) => void;
  onRegenerateImage: (shotId: number) => void;
  onUploadImage: (shotId: number, file: File) => void;
  onUploadDynamicVideo: (shotId: number, file: File) => void;
  onBorrowImage: (shotId: number) => void;
  onRepairFailedImages: () => void;
  onRegenerateAudio: (shotId: number) => void;
  onUpdateImageCrop: (shotId: number, crop: NonNullable<StoredImage["crop"]>) => void;
  onUpdateTimeline: (index: number, patch: Partial<TaskTimelineEntry>) => void;
  onRepackDraft: () => void;
}

const statusLabels: Record<PipelineStatus, string> = {
  pending: "等待中",
  running: "执行中",
  paused: "待确认",
  done: "已完成",
  skipped: "已跳过",
  failed: "失败",
};

function cloneTask(task: StoryboundTask): StoryboundTask {
  return structuredClone(task);
}

type SopCheckLevel = "pass" | "advice" | "attention" | "info";

interface SopCheck {
  level: SopCheckLevel;
  label: string;
  detail: string;
}

function countChineseCharacters(value: string): number {
  return (value.match(/[\u3400-\u9fff]/g) || []).length;
}

function sopQualityChecks(task: StoryboundTask): SopCheck[] {
  const shots = task.artifacts.storyboard?.shots || [];
  const timeline = task.media.timeline || [];
  const template = draftTemplateById(task.options.draftTemplateId || "default-portrait-9-16").config;
  const tutorialMode = task.options.ttsMode === "continuous";
  const readyImages = task.media.images.filter((image) => image.status === "ready" || image.status === "borrowed").length;
  const narrationVolume = task.options.narrationVolume ?? template.audio.narrationVolume;
  const bgmVolume = task.options.bgmVolume ?? template.audio.bgmVolume;
  const checks: SopCheck[] = [];

  checks.push(template.canvas.width === 1080 && template.canvas.height === 1920
    ? { level: "pass", label: "导出画布", detail: "1080 × 1920；草稿固定为 30 fps。" }
    : { level: "attention", label: "导出画布", detail: `当前为 ${template.canvas.width} × ${template.canvas.height}；教程人物故事基准是竖屏 1080P / 30 fps。` });

  checks.push(template.caption.fontSize >= 11 && template.caption.fontSize <= 15
    ? { level: "pass", label: "字幕可读性", detail: `字号 ${template.caption.fontSize}，落在教程建议的 11–15 范围。` }
    : { level: "attention", label: "字幕可读性", detail: `字号 ${template.caption.fontSize}，教程建议 11–15，建议回到模板设置调整。` });

  if (tutorialMode) {
    const overlong = timeline.filter((item) => item.durationSec > 7.5);
    const tooShort = timeline.filter((item) => item.durationSec < 4.5);
    checks.push(overlong.length || tooShort.length
      ? { level: "advice", label: "连续旁白镜头节奏", detail: `${overlong.length} 镜超过 7.5 秒、${tooShort.length} 镜低于 4.5 秒；教程建议每张图片约 5–7 秒，可在时间线拆镜并补图。` }
      : { level: "pass", label: "连续旁白镜头节奏", detail: `${timeline.length} 镜均落在约 5–7 秒的教程建议范围。` });
    const alignedWords = task.media.continuousAudio?.alignment?.words.length || 0;
    checks.push(alignedWords
      ? { level: "pass", label: "音画对齐依据", detail: `已取得 ${alignedWords} 个 MiniMax 词级时间戳；不用字数估算时长。` }
      : { level: "attention", label: "音画对齐依据", detail: "连续旁白缺少词级时间戳，无法按教程的字幕标记逻辑可靠对齐。" });
    checks.push(Math.min(9, template.caption.maxCharsPerLine) <= 9
      ? { level: "pass", label: "显示字幕分句", detail: "连续模式会按自然停顿限制为不超过 9 个汉字。" }
      : { level: "attention", label: "显示字幕分句", detail: "连续模式必须将显示字幕限制为不超过 9 个汉字。" });
  } else if (shots.length) {
    const readyAudio = task.media.audioSegments.filter((audio) => audio.status === "ready").length;
    checks.push(readyAudio === shots.length
      ? { level: "pass", label: "原客户端逐镜结构", detail: `${shots.length} 镜图片/字幕对应 ${readyAudio} 段独立 TTS。` }
      : { level: "attention", label: "原客户端逐镜结构", detail: `${shots.length} 镜但只有 ${readyAudio} 段可用 TTS；需补齐后再打包。` });
  }

  if (timeline.length > 1) {
    const discontinuities = timeline.slice(1).filter((item, index) => Math.abs(item.startSec - timeline[index].endSec) > 0.12);
    checks.push(discontinuities.length
      ? { level: "attention", label: "时间线连续性", detail: `${discontinuities.length} 处存在重叠或空隙；检查前一镜结束和后一镜开始时间。` }
      : { level: "pass", label: "时间线连续性", detail: `${timeline.length} 个镜头首尾连续，无非预期空隙或重叠。` });
  } else {
    checks.push({ level: "info", label: "时间线连续性", detail: "配音生成后会显示可检查的镜头时间线。" });
  }

  checks.push(shots.length === 0 || readyImages === shots.length
    ? { level: "pass", label: "分镜图片", detail: shots.length ? `${readyImages}/${shots.length} 张图片已可用，并按镜头编号对应。` : "等待生成分镜。" }
    : { level: "attention", label: "分镜图片", detail: `${readyImages}/${shots.length} 张图片可用；缺图不能作为成片交付。` });

  const hasCover = task.media.coverImages.some((image) => image.status === "ready") || (tutorialMode && readyImages > 0);
  checks.push(hasCover
    ? { level: "pass", label: "封面首帧", detail: task.media.coverImages.some((image) => image.status === "ready") ? "使用独立封面图；草稿只占极短首帧。" : "使用第 1 镜作封面；草稿只占极短首帧。" }
    : { level: "advice", label: "封面首帧", detail: "教程要求从分镜中选择一张可表达内容的画面作为首帧封面。" });

  if (!task.media.bgm?.path) {
    checks.push({ level: "info", label: "背景音乐", detail: "BGM 是可选项；如添加，请上传拥有使用权的纯音乐，系统会独立铺轨并淡出。" });
  } else {
    checks.push(bgmVolume < narrationVolume
      ? { level: "pass", label: "背景音乐", detail: `BGM 音量 ${bgmVolume} 低于旁白 ${narrationVolume}，不会按模板直接盖住旁白。` }
      : { level: "attention", label: "背景音乐", detail: `BGM 音量 ${bgmVolume} 不低于旁白 ${narrationVolume}，教程要求 BGM 不得淹没文案音频。` });
  }

  const oversizedText = task.artifacts.rewrite?.subtitle?.find((line) => countChineseCharacters(line) > 9);
  if (tutorialMode && oversizedText) {
    checks.push({ level: "info", label: "封面副标题", detail: "封面副标题可长于 9 字；9 字限制只作用于最终显示字幕。" });
  }
  return checks;
}

export function TaskWorkbench({ task, busy, onTaskChange, onPause, onContinue, onCancel, onRunFromStep, onSaveArtifact, onRegenerateImage, onUploadImage, onUploadDynamicVideo, onBorrowImage, onRepairFailedImages, onRegenerateAudio, onUpdateImageCrop, onUpdateTimeline, onRepackDraft }: TaskWorkbenchProps) {
  const finishedCount = task.stepStatuses.filter((status) => status === "done" || status === "skipped").length;
  const failedImages = task.media.images.filter((image) => image.status === "failed");
  const qualityChecks = sopQualityChecks(task);
  const updatePrecheck = (cleanText: string) => {
    const next = cloneTask(task);
    if (next.artifacts.precheck) next.artifacts.precheck.cleanText = cleanText;
    onTaskChange(next);
  };
  const updateRewrite = (key: "title" | "narration" | "publishCopy" | "summary" | "pinnedComment", value: string) => {
    const next = cloneTask(task);
    if (next.artifacts.rewrite) next.artifacts.rewrite[key] = value;
    onTaskChange(next);
  };
  const updateRewriteList = (key: "subtitle" | "tags" | "comments", value: string[]) => {
    const next = cloneTask(task);
    if (next.artifacts.rewrite) next.artifacts.rewrite[key] = value;
    onTaskChange(next);
  };
  const updateShot = (index: number, patch: Partial<StoryboardShot>) => {
    const next = cloneTask(task);
    if (next.artifacts.storyboard) next.artifacts.storyboard.shots[index] = { ...next.artifacts.storyboard.shots[index], ...patch };
    onTaskChange(next);
  };
  const removeShot = (index: number) => {
    const next = cloneTask(task);
    if (next.artifacts.storyboard) next.artifacts.storyboard.shots.splice(index, 1);
    onTaskChange(next);
  };
  const addShot = () => {
    const next = cloneTask(task);
    const shots = next.artifacts.storyboard?.shots;
    if (shots) shots.push({ id: Math.max(0, ...shots.map((shot) => shot.id)) + 1, text: "新分镜字幕", visual: "描述这个镜头的主体、环境和动作", emotion: "自然", durationSec: 5 });
    onTaskChange(next);
  };
  const moveShot = (index: number, direction: -1 | 1) => {
    const next = cloneTask(task);
    const shots = next.artifacts.storyboard?.shots;
    const target = index + direction;
    if (!shots || target < 0 || target >= shots.length) return;
    const [moved] = shots.splice(index, 1);
    shots.splice(target, 0, moved);
    shots.forEach((shot, shotIndex) => { shot.id = shotIndex + 1; });
    onTaskChange(next);
  };
  const updatePrompt = (index: number, patch: Partial<ImagePrompt>) => {
    const next = cloneTask(task);
    if (next.artifacts.prompts) next.artifacts.prompts.prompts[index] = { ...next.artifacts.prompts.prompts[index], ...patch };
    onTaskChange(next);
  };

  return (
    <section className="pipeline-panel" aria-live="polite">
      <div className="pipeline-panel__header">
        <div><span className={`pipeline-state pipeline-state--${task.runState}`}>{task.runState === "running" ? "流水线执行中" : task.runState === "paused" ? task.error ? "步骤失败，等待处理" : "已暂停，等待确认" : task.runState === "cancelled" ? "任务已取消" : task.runState === "completed" ? "全部完成" : "任务草稿"}</span><h2>{task.title}</h2><p>{finishedCount} / {pipelineSteps.length} 步已处理 · {task.mode === "auto" ? "全自动" : task.mode === "semi_auto" ? "半自动" : "直接出片"} · 已持久化</p></div>
        <div className="pipeline-actions">{task.runState === "running" ? <button type="button" className="secondary-button" onClick={onPause}>本步完成后暂停</button> : null}{task.runState === "paused" || task.runState === "cancelled" ? <button type="button" className="primary-button" disabled={busy} onClick={onContinue}>继续执行</button> : null}{task.runState === "running" || task.runState === "paused" ? <button type="button" className="danger-button" onClick={onCancel}>取消并保留断点</button> : null}</div>
      </div>
      {task.error ? <div className="pipeline-error"><span>步骤失败：{task.error}</span><div><button type="button" disabled={busy} onClick={onContinue}>重试本步骤</button></div></div> : null}
      <progress value={finishedCount} max={pipelineSteps.length}>{finishedCount} / {pipelineSteps.length}</progress>
      <ol className="pipeline-steps">{pipelineSteps.map((step, index) => { const status = task.stepStatuses[index] ?? "pending"; return <li key={step.id} className={`pipeline-step pipeline-step--${status}`}><span className="pipeline-step__number">{status === "done" ? "✓" : status === "skipped" ? "–" : step.id + 1}</span><div className="pipeline-step__copy"><div><strong>{step.title}</strong>{task.mode === "direct" && step.id === 2 ? <em>机械切分</em> : null}</div><span>{task.mode === "direct" && step.id === 2 ? "按空行和标点切分，不调用 AI" : step.description}</span></div><span className="pipeline-step__status">{statusLabels[status]}</span>{status === "done" || status === "failed" ? <button type="button" disabled={busy} onClick={() => onRunFromStep(step.id)}>从此重跑</button> : null}</li>; })}</ol>

      {task.artifacts.precheck ? <div className="artifact-editor"><div className="artifact-editor__head"><div><strong>Step 1 · 文案预审</strong><span>{task.artifacts.precheck.warnings.length} 条提醒 · {task.artifacts.precheck.sensitiveTerms.length} 个敏感词</span></div><button type="button" className="primary-button" disabled={busy} onClick={() => onSaveArtifact(0)}>保存并从改写继续</button></div><textarea className="artifact-textarea" value={task.artifacts.precheck.cleanText} onChange={(event) => updatePrecheck(event.target.value)} />{task.artifacts.precheck.warnings.length ? <div className="artifact-tags">{task.artifacts.precheck.warnings.map((warning) => <span key={warning}>{warning}</span>)}</div> : null}</div> : null}

      {task.artifacts.rewrite ? <div className="artifact-editor"><div className="artifact-editor__head"><div><strong>Step 2 · 改写、封面与发布素材</strong><span>原版 WriterAgent 的正文、封面五字段和自评均已保存</span></div><button type="button" className="primary-button" disabled={busy} onClick={() => onSaveArtifact(1)}>保存并从分镜继续</button></div><div className="form-grid form-grid--two"><label><span>封面主标题</span><input className="text-input" value={task.artifacts.rewrite.title} onChange={(event) => updateRewrite("title", event.target.value)} /></label><label><span>置顶评论</span><input className="text-input" value={task.artifacts.rewrite.pinnedComment} onChange={(event) => updateRewrite("pinnedComment", event.target.value)} /></label></div><div className="form-grid form-grid--two"><label><span>封面副标题（每行一条）</span><textarea className="artifact-textarea artifact-textarea--short" value={(task.artifacts.rewrite.subtitle || []).join("\n")} onChange={(event) => updateRewriteList("subtitle", event.target.value.split(/\r?\n/).map((item) => item.trim()).filter(Boolean))} /></label><label><span>标签（逗号分隔）</span><textarea className="artifact-textarea artifact-textarea--short" value={task.artifacts.rewrite.tags.join("，")} onChange={(event) => updateRewriteList("tags", event.target.value.split(/[,，]/).map((item) => item.trim().replace(/^#/, "")).filter(Boolean))} /></label></div><label><span>改写正文</span><textarea className="artifact-textarea" value={task.artifacts.rewrite.narration} onChange={(event) => updateRewrite("narration", event.target.value)} /></label><div className="form-grid form-grid--two"><label><span>发布简介</span><textarea className="artifact-textarea artifact-textarea--short" value={task.artifacts.rewrite.summary || task.artifacts.rewrite.publishCopy} onChange={(event) => { updateRewrite("summary", event.target.value); }} /></label><label><span>5 条种子评论（每行一条）</span><textarea className="artifact-textarea artifact-textarea--short" value={(task.artifacts.rewrite.comments || []).join("\n")} onChange={(event) => updateRewriteList("comments", event.target.value.split(/\r?\n/).map((item) => item.trim()).filter(Boolean))} /></label></div>{typeof task.artifacts.rewrite.totalScore === "number" ? <div className="artifact-tags"><span>WriterAgent 自评 {task.artifacts.rewrite.totalScore}/100</span></div> : null}</div> : null}

      {task.artifacts.storyboard ? <div className="artifact-editor"><div className="artifact-editor__head"><div><strong>Step 3 · 分镜工作台</strong><span>{task.artifacts.storyboard.shots.length} 镜 · 可增删、排序、改字幕和画面描述</span></div><div><button type="button" className="secondary-button" onClick={addShot}>新增分镜</button><button type="button" className="primary-button" disabled={busy} onClick={() => onSaveArtifact(2)}>保存并生成提示词</button></div></div><div className="shot-editor-list">{task.artifacts.storyboard.shots.map((shot, index) => <article key={shot.id}><header><strong>第 {shot.id} 镜</strong><div><button type="button" disabled={index === 0} onClick={() => moveShot(index, -1)}>上移</button><button type="button" disabled={index === task.artifacts.storyboard!.shots.length - 1} onClick={() => moveShot(index, 1)}>下移</button><button type="button" onClick={() => removeShot(index)}>删除</button></div></header><textarea value={shot.text} onChange={(event) => updateShot(index, { text: event.target.value })} /><textarea value={shot.visual} onChange={(event) => updateShot(index, { visual: event.target.value })} /><div className="form-grid form-grid--two"><input className="text-input" value={shot.emotion} onChange={(event) => updateShot(index, { emotion: event.target.value })} /><input className="text-input" type="number" min="0.3" step="0.1" value={shot.durationSec} onChange={(event) => updateShot(index, { durationSec: Number(event.target.value) || 5 })} /></div></article>)}</div></div> : null}

      {task.artifacts.prompts ? <div className="artifact-editor"><div className="artifact-editor__head"><div><strong>Step 4 · 原版绘图提示词</strong><span>{task.artifacts.prompts.templateVersion} · {task.artifacts.prompts.prompts.length} 条</span></div><button type="button" className="primary-button" disabled={busy} onClick={() => onSaveArtifact(3)}>保存并开始出图</button></div><div className="prompt-editor-list">{task.artifacts.prompts.prompts.map((prompt, index) => <article key={prompt.shotId}><strong>第 {prompt.shotId} 镜</strong><textarea value={prompt.prompt} onChange={(event) => updatePrompt(index, { prompt: event.target.value })} /><input className="text-input" value={prompt.negativePrompt} onChange={(event) => updatePrompt(index, { negativePrompt: event.target.value })} /></article>)}</div></div> : null}

      {task.media.images.length ? <div className="pipeline-images"><div className="pipeline-images__head"><div><strong>Step 5 · 分镜图片工作台</strong><span>{task.media.images.filter((image) => image.status === "ready" || image.status === "borrowed").length}/{task.media.images.length} 张可用</span></div>{failedImages.length ? <button type="button" className="primary-button" disabled={busy} onClick={onRepairFailedImages}>只修复 {failedImages.length} 张失败图</button> : null}</div><div className="pipeline-image-grid">{task.media.images.map((image) => {
        const crop = image.crop || { x: 0, y: 0, scale: 1 };
        const dynamicVideo = (task.media.videos || []).find((video) => video.shotId === image.shotId);
        return <article key={`${image.shotId}-${image.id}`} className={image.status === "failed" ? "is-failed" : ""}>{image.url ? <img src={image.url} alt={`第 ${image.shotId} 镜`} /> : <div className="image-failure">{image.error || "图片生成失败"}</div>}<div><strong>第 {image.shotId} 镜</strong><span>{dynamicVideo ? `动态视频 ${dynamicVideo.durationSec.toFixed(1)}s` : image.status === "borrowed" ? `借用 #${image.borrowedFrom}` : image.status}</span></div><div className="image-card-actions"><button type="button" disabled={busy} onClick={() => onRegenerateImage(image.shotId)}>重画</button><label><input type="file" accept="image/*" onChange={(event) => event.target.files?.[0] && onUploadImage(image.shotId, event.target.files[0])} />替换图片</label><label><input type="file" accept="video/mp4,video/quicktime,video/webm" onChange={(event) => event.target.files?.[0] && onUploadDynamicVideo(image.shotId, event.target.files[0])} />{dynamicVideo ? "替换视频" : "图片转视频产物"}</label>{image.status === "failed" ? <button type="button" onClick={() => onBorrowImage(image.shotId)}>相邻补位</button> : null}<a href={image.url} download={`shot-${image.shotId}.jpg`}>下载</a></div><div className="crop-controls"><button type="button" disabled={busy} onClick={() => onUpdateImageCrop(image.shotId, { ...crop, x: Number((crop.x - 0.05).toFixed(2)) })}>←</button><button type="button" disabled={busy} onClick={() => onUpdateImageCrop(image.shotId, { ...crop, y: Number((crop.y + 0.05).toFixed(2)) })}>↑</button><button type="button" disabled={busy} onClick={() => onUpdateImageCrop(image.shotId, { x: 0, y: 0, scale: 1 })}>居中</button><button type="button" disabled={busy} onClick={() => onUpdateImageCrop(image.shotId, { ...crop, y: Number((crop.y - 0.05).toFixed(2)) })}>↓</button><button type="button" disabled={busy} onClick={() => onUpdateImageCrop(image.shotId, { ...crop, x: Number((crop.x + 0.05).toFixed(2)) })}>→</button><button type="button" disabled={busy} onClick={() => onUpdateImageCrop(image.shotId, { ...crop, scale: Number(Math.max(0.5, crop.scale - 0.1).toFixed(2)) })}>－</button><button type="button" disabled={busy} onClick={() => onUpdateImageCrop(image.shotId, { ...crop, scale: Number(Math.min(3, crop.scale + 0.1).toFixed(2)) })}>＋</button><span>{crop.scale.toFixed(1)}×</span></div><p title={image.prompt}>{image.prompt}</p></article>;
      })}</div></div> : null}

      {task.media.coverImages.length ? <div className="pipeline-images pipeline-covers"><div className="pipeline-images__head"><div><strong>独立封面海报</strong><span>{task.media.coverImages.length} 张 · {task.options.coverMode === "titled" ? "标题版构图" : "纯画面"}</span></div><button type="button" className="secondary-button" disabled={busy} onClick={() => onRunFromStep(4)}>连同分镜重新出图</button></div><div className="pipeline-image-grid">{task.media.coverImages.map((image, index) => <article key={`${image.id}-${index}`} className={image.status === "failed" ? "is-failed" : ""}>{image.url ? <img src={image.url} alt={`封面 ${index + 1}`} /> : <div className="image-failure">{image.error || "封面生成失败"}</div>}<div><strong>封面 {index + 1}</strong><span>{image.status}</span></div><div className="image-card-actions"><a href={image.url} download={`cover-${index + 1}.jpg`}>下载</a></div><p title={image.prompt}>{image.prompt}</p></article>)}</div></div> : null}

      {task.media.audioSegments.length ? <div className="audio-workbench"><div className="artifact-editor__head"><div><strong>Step 6 · 配音与字幕时间线</strong><span>{task.media.audioSegments.filter((audio) => audio.status === "ready").length}/{task.media.audioSegments.length} 段 · {task.videoForm === "podcast" ? "A/B 双人声" : "原版逐镜 TTS · 实测时长对齐"}</span></div></div>{task.media.audioSegments.map((audio) => <article key={audio.id}><span>#{audio.shotId} {audio.speaker ? `[${audio.speaker}]` : ""}</span><p>{audio.text}</p>{audio.url ? <audio controls src={audio.url} /> : <em>{audio.error}</em>}<small>{audio.durationSec.toFixed(1)}s · {audio.voiceId}</small><button type="button" disabled={busy} onClick={() => onRegenerateAudio(audio.shotId)}>重配本段</button></article>)}</div> : null}

      {task.media.continuousAudio ? <div className="pipeline-audio"><div><strong>Step 6 · 教程推荐 · 连贯旁白</strong><span>整篇一次合成 · {task.media.continuousAudio.alignment?.words.length ? `MiniMax ${task.media.continuousAudio.alignment.words.length} 个真实字词时间戳` : "无词级时间戳"} · {task.media.continuousAudio.durationSec.toFixed(1)} 秒</span></div><audio controls src={task.media.continuousAudio.url} /><button type="button" className="secondary-button" disabled={busy} onClick={() => onRegenerateAudio(0)}>重新生成整条旁白</button><a href={task.media.continuousAudio.url} download={task.media.continuousAudio.fileName}>下载</a></div> : null}

      {task.media.externalAudio ? <div className="pipeline-audio"><div><strong>外部配音已接入</strong><span>{task.media.externalAudio.fileName} · 字幕按分镜时间线写入</span></div><audio controls src={task.media.externalAudio.url} /><a href={task.media.externalAudio.url} download={task.media.externalAudio.fileName}>下载</a></div> : null}

      {task.media.timeline?.length ? <div className="artifact-editor timeline-editor"><div className="artifact-editor__head"><div><strong>可编辑字幕时间线</strong><span>{task.media.timeline.length} 段 · 修改后只需重新打包草稿</span></div><button type="button" className="secondary-button" disabled={busy} onClick={onRepackDraft}>保存并重新打包</button></div><div className="timeline-editor__list">{task.media.timeline.map((item, index) => <article key={`${item.shotId}-${index}`}><strong>#{item.shotId}</strong><input className="text-input" value={item.text} onChange={(event) => onUpdateTimeline(index, { text: event.target.value })} /><label>开始<input className="text-input" type="number" min="0" step="0.1" value={item.startSec} onChange={(event) => onUpdateTimeline(index, { startSec: Number(event.target.value) || 0 })} /></label><label>结束<input className="text-input" type="number" min="0.1" step="0.1" value={item.endSec} onChange={(event) => onUpdateTimeline(index, { endSec: Number(event.target.value) || item.endSec })} /></label></article>)}</div></div> : null}

      {task.artifacts.storyboard || task.media.timeline?.length ? <section className="sop-quality-gate"><header><div><strong>教程成片检查</strong><span>依据《剪辑基础篇》与《剪辑进阶篇》；建议项不会阻止打包，客观错误会明确标红。</span></div><a href="https://aipoju.com/docx/63b1a44a-8060-4928-bf33-a9a4d9caf849/LKF4d2PoforF3ex2lZLcca2in7c?from=from_copylink" target="_blank" rel="noreferrer">查看参考 SOP ↗</a></header><div className="sop-quality-gate__checks">{qualityChecks.map((check) => <article key={`${check.label}-${check.detail}`} className={`sop-quality-gate__check sop-quality-gate__check--${check.level}`}><span>{check.level === "pass" ? "✓" : check.level === "attention" ? "!" : check.level === "advice" ? "△" : "i"}</span><div><strong>{check.label}</strong><p>{check.detail}</p></div></article>)}</div></section> : null}

      {task.draft?.ready ? <div className="draft-result"><div><strong>真实剪映草稿已生成</strong><span>{task.draft.projectName} · {task.draft.durationSec.toFixed(1)} 秒 · {task.draft.trackCount} 条轨道 · {task.draft.fileCount} 个文件</span><small>{task.draft.projectDir}</small></div><button type="button" className="secondary-button" disabled={busy} onClick={onRepackDraft}>只重新打包</button><a className="primary-button" href={task.draft.zipUrl}>下载剪映草稿 ZIP</a></div> : task.stepStatuses[5] === "done" ? <div className="draft-result draft-result--pending"><div><strong>音频和图片已经齐备</strong><span>可以直接重新执行 Step 7，不会重复调用 AI、出图或 TTS。</span></div><button type="button" className="primary-button" disabled={busy} onClick={onRepackDraft}>生成剪映草稿</button></div> : null}
    </section>
  );
}
