import { contentTracks, originalDefaultStyleByTrack, pipelineSteps, visualStyles } from "../data/app-data";
import { draftTemplateById, draftTemplates } from "../data/draft-templates";
import type { TtsVoice } from "../types/tts";
import { DraftTemplateEditor } from "./DraftTemplateEditor";
import type { BuilderFormState } from "./task-builder-model";
import { coverTemplates } from "../lib/cover-prompt";

interface TaskCreateFormProps {
  form: BuilderFormState;
  voices: TtsVoice[];
  hasLlmCredentials: boolean;
  hasTtsCredentials: boolean;
  aiGenerating: boolean;
  taskReady: boolean;
  referenceName?: string;
  externalAudioName?: string;
  bgmName?: string;
  onChange: (patch: Partial<BuilderFormState>) => void;
  onGenerateCopy: () => void;
  onUploadImages: (files: FileList) => void;
  onUploadReference: (file: File) => void;
  onUploadTemplateBackground: (file: File) => Promise<string>;
  onUploadExternalAudio: (file: File) => void;
  onUploadBgm: (file: File) => void;
}

const modeOptions = [
  { value: "auto" as const, title: "全自动", description: "AI 改写 + 智能分句" },
  { value: "semi_auto" as const, title: "半自动", description: "不改写，AI 智能分句" },
  { value: "direct" as const, title: "直接出片", description: "不改写，按空行机械切" },
];
const pauseOptions = [
  { value: "none" as const, title: "不暂停", description: "一口气执行到底" },
  { value: "key" as const, title: "关键节点", description: "预审、分镜、提示词后确认" },
  { value: "every" as const, title: "每步暂停", description: "逐步检查结果" },
  { value: "custom" as const, title: "自定义", description: "选择需要确认的步骤" },
];
const ratios = ["9:16", "16:9", "1:1", "3:4", "4:3"] as const;

function NumberField({ value, placeholder, onChange }: { value: number | null; placeholder: string; onChange: (value: number | null) => void }) {
  return <input className="text-input" type="number" min="1" value={value ?? ""} placeholder={placeholder} onChange={(event) => onChange(event.target.value ? Number(event.target.value) : null)} />;
}

export function TaskCreateForm({ form, voices, hasLlmCredentials, hasTtsCredentials, aiGenerating, taskReady, referenceName, externalAudioName, bgmName, onChange, onGenerateCopy, onUploadImages, onUploadReference, onUploadTemplateBackground, onUploadExternalAudio, onUploadBgm }: TaskCreateFormProps) {
  const updateTrack = (track: string) => onChange({ track, visualStyle: originalDefaultStyleByTrack[track] ?? form.visualStyle });
  const selectedTemplate = draftTemplateById(form.draftTemplateId);
  const activeTemplate = form.draftTemplateConfig ?? selectedTemplate.config;
  return (
    <>
      <section className="builder-card">
        <div className="builder-card__heading"><span className="builder-card__icon">▤</span><div><h2>文案</h2><p>原版输入模式、改写参数与视频分支</p></div></div>
        <label className="field-label">标题 <small>可选，留空自动提取</small></label>
        <input className="text-input" value={form.title} placeholder="给任务起个名字" onChange={(event) => onChange({ title: event.target.value })} />
        <div className="source-switch">
          <button type="button" className={form.sourceMode === "paste" ? "is-selected" : ""} onClick={() => onChange({ sourceMode: "paste" })}><strong>粘贴文案</strong><span>已有文案，直接处理</span></button>
          <button type="button" className={form.sourceMode === "ai" ? "is-selected" : ""} onClick={() => onChange({ sourceMode: "ai" })}><strong>AI 创作 <em>NEW</em></strong><span>输入主题，按原版 WriterAgent 创作</span></button>
        </div>
        {form.sourceMode === "ai" ? (
          <div className="ai-create-box">
            <label className="field-label">创作主题与要求 <small>{form.aiBrief.length} 字</small></label>
            <textarea className="copy-textarea copy-textarea--brief" value={form.aiBrief} placeholder="例如：写一个关于旧怀表和母亲的悬疑人物故事，开头要有强钩子，结尾温暖反转……" onChange={(event) => onChange({ aiBrief: event.target.value })} />
            <button type="button" className="primary-button" disabled={!hasLlmCredentials || aiGenerating || form.aiBrief.trim().length < 2} onClick={onGenerateCopy}>{aiGenerating ? "正在创作…" : "AI 生成完整文案"}</button>
          </div>
        ) : null}
        <div className="field-group">
          <label className="field-label">文案内容 <small>{form.inputText.length} 字 / 至少 10 字</small></label>
          <textarea className="copy-textarea" value={form.inputText} placeholder={form.sourceMode === "ai" ? "AI 生成后会填入这里，也可以手动编辑" : "粘贴一段人物故事、口播稿或带货文案"} onChange={(event) => onChange({ inputText: event.target.value })} />
        </div>
        <div className="field-group"><span className="field-label field-label--standalone">视频形式</span><div className="choice-grid choice-grid--two">
          {[{ value: "narration" as const, title: "旁白视频", description: "单人旁白 · 两种音频结构" }, { value: "podcast" as const, title: "双人播客", description: "[A] / [B] 双音色对谈" }].map((item) => <button key={item.value} type="button" className={`choice-card ${form.videoForm === item.value ? "is-selected" : ""}`} onClick={() => onChange({ videoForm: item.value })}><span className="choice-card__radio" /><span><strong>{item.title}</strong><small>{item.description}</small></span></button>)}
        </div></div>
        <div className="field-group"><span className="field-label field-label--standalone">内容赛道</span><div className="chip-list">{contentTracks.map((item) => <button key={item} type="button" className={`chip ${form.track === item ? "is-selected" : ""}`} onClick={() => updateTrack(item)}>{item}</button>)}</div></div>
      </section>

      <section className="builder-card">
        <div className="builder-card__heading"><span className="builder-card__icon">⚙</span><div><h2>高级选项</h2><p>三种运行模式与原版暂停/改写控制</p></div></div>
        <span className="field-label field-label--standalone">执行模式</span><div className="choice-grid choice-grid--three">{modeOptions.map((item) => <button key={item.value} type="button" className={`choice-card ${form.mode === item.value ? "is-selected" : ""}`} onClick={() => onChange({ mode: item.value })}><span className="choice-card__radio" /><span><strong>{item.title}</strong><small>{item.description}</small></span></button>)}</div>
        <div className="field-group"><span className="field-label field-label--standalone">暂停策略</span><div className="choice-grid choice-grid--four">{pauseOptions.map((item) => <button key={item.value} type="button" className={`choice-card choice-card--compact ${form.pausePreset === item.value ? "is-selected" : ""}`} onClick={() => onChange({ pausePreset: item.value })}><span className="choice-card__radio" /><span><strong>{item.title}</strong><small>{item.description}</small></span></button>)}</div></div>
        {form.pausePreset === "custom" ? <div className="custom-pause-panel"><span>完成以下步骤后暂停</span><div className="custom-pause-grid">{pipelineSteps.slice(0, 6).map((step) => <label key={step.id}><input type="checkbox" checked={form.customPauseSteps.includes(step.id)} onChange={(event) => onChange({ customPauseSteps: event.target.checked ? [...form.customPauseSteps, step.id] : form.customPauseSteps.filter((id) => id !== step.id) })} />{step.id + 1}. {step.title}</label>)}</div></div> : null}
        <div className="field-group form-grid form-grid--three"><div><span className="field-label field-label--standalone">改写强度</span><div className="segmented-control">{[["light", "轻度"], ["standard", "标准"], ["deep", "深度"]].map(([value, label]) => <button key={value} type="button" className={form.rewriteIntensity === value ? "is-selected" : ""} onClick={() => onChange({ rewriteIntensity: value as BuilderFormState["rewriteIntensity"] })}>{label}</button>)}</div></div><div><span className="field-label field-label--standalone">叙事视角</span><div className="segmented-control">{[["original", "保持"], ["first", "第一人称"], ["third", "第三人称"]].map(([value, label]) => <button key={value} type="button" className={form.narrativePov === value ? "is-selected" : ""} onClick={() => onChange({ narrativePov: value as BuilderFormState["narrativePov"] })}>{label}</button>)}</div></div><div><span className="field-label field-label--standalone">电商内容</span><label className="toggle-row"><input type="checkbox" checked={form.keepPromotion} onChange={(event) => onChange({ keepPromotion: event.target.checked })} />保留商品卖点与促销信息</label></div></div>
        <div className="field-group form-grid form-grid--two"><label><span className="field-label field-label--standalone">目标字数</span><NumberField value={form.targetLength} placeholder="自动" onChange={(targetLength) => onChange({ targetLength })} /></label><label><span className="field-label field-label--standalone">目标分镜数</span><NumberField value={form.targetScenes} placeholder="自动" onChange={(targetScenes) => onChange({ targetScenes })} /></label></div>
        <div className="field-group form-grid form-grid--two"><label><span className="field-label field-label--standalone">固定开场</span><input className="text-input" value={form.fixedIntro} placeholder="可固定前几句钩子" onChange={(event) => onChange({ fixedIntro: event.target.value })} /></label><label><span className="field-label field-label--standalone">锁定开场句数</span><input className="text-input" type="number" min="0" max="10" value={form.lockIntroSentences} onChange={(event) => onChange({ lockIntroSentences: Number(event.target.value) || 0 })} /></label></div>
        <div className="field-group"><label className="field-label">结尾 CTA <small>可选</small></label><input className="text-input" value={form.outroCta} placeholder="例如：关注我，下期继续讲这个故事" onChange={(event) => onChange({ outroCta: event.target.value })} /></div>
      </section>

      <section className="builder-card">
        <div className="builder-card__heading"><span className="builder-card__icon">◇</span><div><h2>出图</h2><p>素材来源、画风、参考图、封面与剪映模板</p></div></div>
        <span className="field-label field-label--standalone">素材来源</span><div className="choice-grid choice-grid--four">{[["ai", "AI 绘图", "MiniMax image-01"], ["local", "本地素材", "批量上传替换"], ["person", "人物素材库", "使用真实人物图"], ["stock", "免版税素材", "保留适配入口"]].map(([value, title, description]) => <button key={value} type="button" className={`choice-card choice-card--compact ${form.materialSource === value ? "is-selected" : ""}`} onClick={() => onChange({ materialSource: value as BuilderFormState["materialSource"] })}><span className="choice-card__radio" /><span><strong>{title}</strong><small>{description}</small></span></button>)}</div>
        {form.materialSource !== "ai" ? <label className="upload-tile field-group"><input type="file" accept="image/*" multiple onChange={(event) => event.target.files && onUploadImages(event.target.files)} /><strong>批量导入分镜图片</strong><span>{taskReady ? "按文件顺序匹配分镜，也可在产物区逐张替换" : "上传时会自动创建本地任务目录"}</span></label> : null}
        <div className="field-group option-checks"><label><input type="checkbox" checked={form.autoBorrowImage} onChange={(event) => onChange({ autoBorrowImage: event.target.checked })} />失败图自动使用相邻画面补位</label></div>
        <div className="field-group form-grid form-grid--two"><div><span className="field-label field-label--standalone">画面生成比例</span><div className="segmented-control">{ratios.map((ratio) => <button key={ratio} type="button" className={form.aspectRatio === ratio ? "is-selected" : ""} onClick={() => onChange({ aspectRatio: ratio })}>{ratio}</button>)}</div></div><div className="settings-note"><strong>成片时长由真实配音决定</strong><span>目标字数、分镜数和 TTS 语速共同决定总时长；不会强行拉伸音频。</span></div></div>
        <div className="field-group"><span className="field-label field-label--standalone">视觉风格</span><div className="chip-list">{visualStyles.map((item) => <button key={item} type="button" className={`chip ${form.visualStyle === item ? "is-selected" : ""}`} onClick={() => onChange({ visualStyle: item })}>{item}</button>)}</div></div>
        <div className="field-group form-grid form-grid--two"><label><span className="field-label field-label--standalone">剪映草稿模板</span><select className="text-input" value={form.draftTemplateId} onChange={(event) => onChange({ draftTemplateId: event.target.value, draftTemplateConfig: null })}>{draftTemplates.map((template) => <option key={template.id} value={template.id}>{template.name}</option>)}</select></label><label className="upload-tile upload-tile--compact"><input type="file" accept="image/*" onChange={(event) => event.target.files?.[0] && onUploadReference(event.target.files[0])} /><strong>{referenceName ? "✓ 人物参考图已保存" : "人物参考图"}</strong><span>{referenceName || "上传后写入任务人物一致性配置"}</span></label></div>
        <div className="template-summary"><div><strong>{selectedTemplate.name}{form.draftTemplateConfig ? " · 已自定义" : ""}</strong><span>{activeTemplate.canvas.width}×{activeTemplate.canvas.height} · 画面 {activeTemplate.image.ratio}</span></div><div><span>正文字幕 {activeTemplate.caption.fontSize} 号 / 每行 {activeTemplate.caption.maxCharsPerLine} 字</span><span>{activeTemplate.caption.color} · 背景透明度 {activeTemplate.caption.background.alpha}</span></div><div><span>免责声明 {activeTemplate.disclaimer.visible ? "开启" : "关闭"}</span><span>旁白 {activeTemplate.audio.narrationVolume} / BGM {activeTemplate.audio.bgmVolume}</span></div></div>
        <DraftTemplateEditor config={activeTemplate} onChange={(draftTemplateConfig) => onChange({ draftTemplateConfig })} onReset={() => onChange({ draftTemplateConfig: null })} onUploadBackground={onUploadTemplateBackground} />
        <div className="field-group form-grid form-grid--three"><label className="toggle-row"><input type="checkbox" checked={form.dynamicStoryboard} onChange={(event) => onChange({ dynamicStoryboard: event.target.checked })} />启用动态分镜（前 N 张图转视频）</label><label><span className="field-label field-label--standalone">转视频镜头数</span><input className="text-input" type="number" min="1" max="20" disabled={!form.dynamicStoryboard} value={form.videoIntroCount} onChange={(event) => onChange({ videoIntroCount: Math.max(1, Math.min(20, Number(event.target.value) || 3)) })} /></label><div><span className="field-label field-label--standalone">每镜时长</span><div className="segmented-control"><button type="button" disabled={!form.dynamicStoryboard} className={form.videoIntroDurationMode === "narration" ? "is-selected" : ""} onClick={() => onChange({ videoIntroDurationMode: "narration" })}>跟随配音</button><button type="button" disabled={!form.dynamicStoryboard} className={form.videoIntroDurationMode === "fixed" ? "is-selected" : ""} onClick={() => onChange({ videoIntroDurationMode: "fixed" })}>固定秒数</button></div></div></div>
        {form.dynamicStoryboard && form.videoIntroDurationMode === "fixed" ? <label className="field-group"><span className="field-label field-label--standalone">固定生成时长（秒）</span><input className="text-input" type="number" min="1" max="15" value={form.videoIntroDuration} onChange={(event) => onChange({ videoIntroDuration: Math.max(1, Math.min(15, Number(event.target.value) || 3)) })} /></label> : null}
        <p className="template-hint">动态视频会自动拉伸或补齐到对应配音镜头时长；生成失败的镜头保留原图。AI 封面存在时主标题与副标题轨自动隐藏，未生成封面时两条轨会保留全片供你在剪映制作封面，导出前可手动隐藏。</p>
        <div className="field-group form-grid form-grid--three"><div><span className="field-label field-label--standalone">封面海报</span><div className="segmented-control">{[["off", "关闭"], ["titled", "标题封面"], ["plain", "纯画面"]].map(([value, label]) => <button key={value} type="button" className={form.coverMode === value ? "is-selected" : ""} onClick={() => onChange({ coverMode: value as BuilderFormState["coverMode"] })}>{label}</button>)}</div></div><label><span className="field-label field-label--standalone">封面模板</span><select className="text-input" disabled={form.coverMode === "off"} value={form.coverTemplateId} onChange={(event) => onChange({ coverTemplateId: event.target.value })}>{coverTemplates.map((template) => <option key={template.id} value={template.id}>{template.name}</option>)}</select></label><label className="toggle-row toggle-row--bottom"><input type="checkbox" disabled={form.coverMode === "off"} checked={form.secondCover} onChange={(event) => onChange({ secondCover: event.target.checked })} />额外生成第二封面</label></div>
      </section>

      <section className="builder-card">
        <div className="builder-card__heading"><span className="builder-card__icon">♫</span><div><h2>配音</h2><p>原客户端逐镜结构、教程连续旁白、外部音频与 BGM</p></div></div>
        <div className="segmented-control">{[["tts", "TTS 配音"], ["external", "上传外部音频"]].map(([value, label]) => <button key={value} type="button" className={form.voiceSource === value ? "is-selected" : ""} onClick={() => onChange({ voiceSource: value as BuilderFormState["voiceSource"] })}>{label}</button>)}</div>
        {form.voiceSource === "external" ? <label className="upload-tile field-group"><input type="file" accept="audio/*" onChange={(event) => event.target.files?.[0] && onUploadExternalAudio(event.target.files[0])} /><strong>{externalAudioName ? "✓ 外部配音已保存" : "上传完整配音"}</strong><span>{externalAudioName || "读取真实时长并生成可编辑字幕时间线"}</span></label> : (
          <div className="field-group form-grid form-grid--three"><label><span className="field-label field-label--standalone">{form.videoForm === "podcast" ? "主播 A" : "音色"}</span><select className="text-input" value={form.ttsVoiceId} onChange={(event) => onChange({ ttsVoiceId: event.target.value })}>{voices.map((voice) => <option key={voice.id} value={voice.id}>{voice.name} · {voice.tag}</option>)}</select></label>{form.videoForm === "podcast" ? <label><span className="field-label field-label--standalone">主播 B</span><select className="text-input" value={form.ttsVoiceIdB} onChange={(event) => onChange({ ttsVoiceIdB: event.target.value })}>{voices.map((voice) => <option key={voice.id} value={voice.id}>{voice.name} · {voice.tag}</option>)}</select></label> : null}<div><span className="field-label field-label--standalone">语速</span><div className="segmented-control">{[0.85, 1, 1.15, 1.3].map((speed) => <button key={speed} type="button" className={form.ttsSpeed === speed ? "is-selected" : ""} onClick={() => onChange({ ttsSpeed: speed })}>{speed === 1 ? "默认 1.0×" : `${speed}×`}</button>)}</div></div></div>
        )}
        {form.voiceSource === "tts" && form.videoForm === "narration" ? <div className="field-group"><span className="field-label field-label--standalone">旁白结构</span><div className="choice-grid choice-grid--two"><button type="button" className={`choice-card ${form.ttsMode === "original-segmented" ? "is-selected" : ""}`} onClick={() => onChange({ ttsMode: "original-segmented" })}><span className="choice-card__radio" /><span><strong>原客户端结构 · 逐镜 TTS</strong><small>每镜独立图片、音频和字幕；对应原客户端 33/33 任务证据</small></span></button><button type="button" className={`choice-card ${form.ttsMode === "continuous" ? "is-selected" : ""}`} onClick={() => onChange({ ttsMode: "continuous" })}><span className="choice-card__radio" /><span><strong>教程推荐 · 连贯旁白</strong><small>整篇一次合成；MiniMax 真实时间戳打分镜，显示字幕≤9字</small></span></button></div><p className="template-hint">两种模式分别保留：前者复刻原客户端产物结构；后者依据同琛剪辑教程优化最终听感，不冒充原客户端内部实现。</p></div> : null}
        {form.videoForm === "podcast" ? <div className="speaker-hint"><span className="speaker-tag">[A]</span><span className="speaker-tag">[B]</span><p>每轮必须以 [A] 或 [B] 开头；系统会使用两种真实音色分别合成。</p><div className="segmented-control"><button type="button" className={form.podcastImageMode === "multi" ? "is-selected" : ""} onClick={() => onChange({ podcastImageMode: "multi" })}>按轮次配图</button><button type="button" className={form.podcastImageMode === "single" ? "is-selected" : ""} onClick={() => onChange({ podcastImageMode: "single" })}>单封面铺满</button></div></div> : null}
        <label className="upload-tile upload-tile--compact field-group"><input type="file" accept="audio/*" onChange={(event) => event.target.files?.[0] && onUploadBgm(event.target.files[0])} /><strong>{bgmName ? "✓ BGM 已保存" : "背景音乐 BGM"}</strong><span>{bgmName || "可选，写入剪映独立音轨"}</span></label>
        <p className={`provider-readiness ${hasTtsCredentials ? "is-ready" : ""}`}>{form.voiceSource === "external" ? "外部音频模式无需 TTS 凭据" : hasTtsCredentials ? "TTS 凭据已就绪" : "TTS 凭据未配置"}</p>
      </section>
    </>
  );
}
