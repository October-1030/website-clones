import { useEffect, useMemo, useState } from "react";

import { contentTracks, originalDefaultStyleByTrack, pipelineSteps, visualStyles } from "../data/app-data";
import { draftTemplates } from "../data/draft-templates";
import { speedPresets } from "../data/tts-data";
import {
  customStyleStoreEvent,
  readCustomVisualStyles,
  writeCustomVisualStyles,
} from "../lib/custom-style-store";
import {
  ctaLibraryStoreEvent,
  readCtaLibrary,
  writeCtaLibrary,
} from "../lib/cta-library-store";
import { draftTemplateStoreEvent, readCustomDraftTemplates } from "../lib/draft-template-store";
import {
  imageProviderStoreEvent,
  readImageProviderConfig,
  writeImageProviderConfig,
} from "../lib/image-provider-store";
import {
  marketStoreEvent,
  readInstalledMarketItems,
  type MarketItem,
} from "../lib/market-store";
import {
  personAssetToFile,
  personAssetsStoreEvent,
  readPersonGroups,
} from "../lib/person-assets-store";
import {
  promptTemplateStoreEvent,
  readCustomPromptTemplates,
} from "../lib/prompt-template-store";
import {
  presetFormFromBuilder,
  readTaskPresets,
  taskPresetStoreEvent,
  writeTaskPresets,
} from "../lib/task-preset-store";
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
  coverLocalName?: string;
  externalAudioName?: string;
  bgmName?: string;
  onChange: (patch: Partial<BuilderFormState>) => void;
  onGenerateCopy: () => void;
  onUploadImages: (files: FileList | File[]) => void;
  onUploadReference: (file: File) => void;
  onUploadCover: (file: File) => void;
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
  { value: "none" as const, title: "不暂停", description: "一口气跑完，不打断" },
  { value: "key" as const, title: "关键节点", description: "在第一个 LLM 输出后暂停", badge: "推荐" },
  { value: "every" as const, title: "每步确认", description: "每一步都暂停" },
  { value: "custom" as const, title: "自定义", description: "选择需要确认的步骤" },
];
const ratios = [
  { value: "9:16" as const, label: "9:16 竖屏" },
  { value: "4:3" as const, label: "4:3 标准" },
  { value: "1:1" as const, label: "1:1 方形" },
  { value: "16:9" as const, label: "16:9 横屏" },
];
const coverRatios = [
  { value: "3:4", label: "3:4 封面" },
  { value: "9:16", label: "9:16 全屏" },
  { value: "1:1", label: "1:1 方形" },
  { value: "4:3", label: "4:3 横版" },
  { value: "16:9", label: "16:9 宽屏" },
];
const customPauseOrder = [0, 1, 2, 5, 3, 4];
const podcastPairs = [
  {
    id: "mizai_dayi",
    name: "咪仔 × 大壹（默认）",
    speakers: ["zh_female_mizaitongxue_v2_saturn_bigtts", "zh_male_dayixiansheng_v2_saturn_bigtts"],
  },
  {
    id: "liufei_xiaolei",
    name: "刘飞 × 潇磊",
    speakers: ["zh_male_liufei_v2_saturn_bigtts", "zh_male_xiaolei_v2_saturn_bigtts"],
  },
];
const rewriteOptions = [
  { value: "standard" as const, title: "标准改写", description: "贴近对标结构，延续爆款概率高", badge: "推荐" },
  { value: "deep" as const, title: "深度改写", description: "大幅变换表达和细节，原创度显著提升" },
  { value: "rewrite" as const, title: "高度原创", description: "仅保留核心故事线，结构行文几乎全新" },
];
const narrativeOptions = [
  { value: "original" as const, title: "保持原文", description: "不改变叙事人称，保留原稿视角", badge: "默认" },
  { value: "first" as const, title: "第一人称", description: "以主角「我」的视角讲述，代入感强" },
  { value: "third" as const, title: "第三人称", description: "旁白视角客观叙述，适合故事类" },
];
const povHiddenTracks = new Set(["传统文化", "电商带货", "心灵鸡汤"]);

function NumberField({ value, placeholder, onChange }: { value: number | null; placeholder: string; onChange: (value: number | null) => void }) {
  return <input className="text-input" type="number" min="1" value={value ?? ""} placeholder={placeholder} onChange={(event) => onChange(event.target.value ? Number(event.target.value) : null)} />;
}

function ToggleSwitch({ checked, label, onChange }: { checked: boolean; label: string; onChange: (checked: boolean) => void }) {
  return (
    <button type="button" role="switch" aria-checked={checked} className={`copy-toggle ${checked ? "is-on" : ""}`} onClick={() => onChange(!checked)}>
      <span aria-hidden="true" />
      <small>{label}</small>
    </button>
  );
}

function extractLockedIntro(text: string, count: number): string {
  const trimmed = text.trim();
  if (!trimmed || count < 1) return "";
  const sentencePattern = /[^。！？…；\n]*[。！？…；]+\s*|[^。！？…；\n]+\n+\s*/g;
  let end = 0;
  let matched = 0;
  let result: RegExpExecArray | null;
  while ((result = sentencePattern.exec(trimmed)) && matched < count) {
    end = result.index + result[0].length;
    matched += 1;
  }
  if (!end) return trimmed;
  return trimmed.slice(0, end).trim();
}

export function TaskCreateForm({ form, voices, hasLlmCredentials, hasTtsCredentials, aiGenerating, taskReady, referenceName, coverLocalName, externalAudioName, bgmName, onChange, onGenerateCopy, onUploadImages, onUploadReference, onUploadCover, onUploadTemplateBackground, onUploadExternalAudio, onUploadBgm }: TaskCreateFormProps) {
  const [customTemplates, setCustomTemplates] = useState(readCustomDraftTemplates);
  const [personGroups, setPersonGroups] = useState(readPersonGroups);
  const [selectedPersonGroupId, setSelectedPersonGroupId] = useState(() => readPersonGroups()[0]?.id || "");
  const [personImporting, setPersonImporting] = useState(false);
  const [installedMarketItems, setInstalledMarketItems] = useState(readInstalledMarketItems);
  const [customStyles, setCustomStyles] = useState(readCustomVisualStyles);
  const [imageProviderConfig, setImageProviderConfig] = useState(readImageProviderConfig);
  const [newStyleName, setNewStyleName] = useState("");
  const [newStylePrompt, setNewStylePrompt] = useState("");
  const [ctaLibrary, setCtaLibrary] = useState(readCtaLibrary);
  const [editingCtaIndex, setEditingCtaIndex] = useState<number | null>(null);
  const [editingCtaText, setEditingCtaText] = useState("");
  const [advancedOpen, setAdvancedOpen] = useState(true);
  const [taskPresets, setTaskPresets] = useState(readTaskPresets);
  const [presetName, setPresetName] = useState("");
  const [presetDialogOpen, setPresetDialogOpen] = useState(false);
  const [customPromptTemplates, setCustomPromptTemplates] = useState(readCustomPromptTemplates);
  useEffect(() => {
    const refresh = () => setCustomTemplates(readCustomDraftTemplates());
    window.addEventListener(draftTemplateStoreEvent, refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener(draftTemplateStoreEvent, refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);
  useEffect(() => {
    const refreshStyles = () => setCustomStyles(readCustomVisualStyles());
    const refreshProvider = () => setImageProviderConfig(readImageProviderConfig());
    window.addEventListener(customStyleStoreEvent, refreshStyles);
    window.addEventListener(imageProviderStoreEvent, refreshProvider);
    window.addEventListener("storage", refreshStyles);
    return () => {
      window.removeEventListener(customStyleStoreEvent, refreshStyles);
      window.removeEventListener(imageProviderStoreEvent, refreshProvider);
      window.removeEventListener("storage", refreshStyles);
    };
  }, []);
  useEffect(() => {
    const refresh = () => setInstalledMarketItems(readInstalledMarketItems());
    window.addEventListener(marketStoreEvent, refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener(marketStoreEvent, refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);
  useEffect(() => {
    const refresh = () => setPersonGroups(readPersonGroups());
    window.addEventListener(personAssetsStoreEvent, refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener(personAssetsStoreEvent, refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);
  useEffect(() => {
    const refresh = () => setCtaLibrary(readCtaLibrary());
    window.addEventListener(ctaLibraryStoreEvent, refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener(ctaLibraryStoreEvent, refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);
  useEffect(() => {
    const refresh = () => setTaskPresets(readTaskPresets());
    window.addEventListener(taskPresetStoreEvent, refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener(taskPresetStoreEvent, refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);
  useEffect(() => {
    const refresh = () => setCustomPromptTemplates(readCustomPromptTemplates());
    window.addEventListener(promptTemplateStoreEvent, refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener(promptTemplateStoreEvent, refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);
  const automaticLockIntro = useMemo(
    () => extractLockedIntro(form.inputText, form.lockIntroSentences),
    [form.inputText, form.lockIntroSentences],
  );
  useEffect(() => {
    if (
      form.fixedIntroMode === "lock"
      && !form.lockIntroDirty
      && form.lockIntroText !== automaticLockIntro
    ) {
      onChange({ lockIntroText: automaticLockIntro });
    }
  }, [automaticLockIntro, form.fixedIntroMode, form.lockIntroDirty, form.lockIntroText, onChange]);
  const availableTemplates = useMemo(() => [...draftTemplates, ...customTemplates], [customTemplates]);
  const updateTrack = (track: string) => onChange({
    track,
    promptTemplateId: `system-${track}`,
    promptTemplateOverride: null,
    visualStyle: originalDefaultStyleByTrack[track] ?? form.visualStyle,
    ...(track === "电商带货" ? { keepPromotion: true } : {}),
  });
  const updatePromptTemplate = (templateId: string) => {
    const custom = customPromptTemplates.find((template) => template.id === templateId);
    if (custom) {
      onChange({
        promptTemplateId: custom.id,
        promptTemplateOverride: {
          name: custom.name,
          rewritePrompt: custom.rewritePrompt,
          metadataPrompt: custom.metadataPrompt,
          segmentationPrompt: custom.segmentationPrompt,
          imagePrompt: custom.imagePrompt,
        },
        track: custom.baseTrack,
        visualStyle: originalDefaultStyleByTrack[custom.baseTrack] ?? form.visualStyle,
        ...(custom.baseTrack === "电商带货" ? { keepPromotion: true } : {}),
      });
      return;
    }
    const track = templateId.replace(/^system-/, "");
    updateTrack(contentTracks.includes(track) ? track : form.track);
  };
  const selectedTemplate = availableTemplates.find((template) => template.id === form.draftTemplateId) ?? availableTemplates[0];
  const activeTemplate = form.draftTemplateConfig ?? selectedTemplate.config;
  const availableVisualStyles = useMemo(
    () => [...visualStyles, ...customStyles.map((style) => style.name)],
    [customStyles],
  );
  const applyMarketItem = (item: MarketItem) => onChange({
    ...(item.apply.track ? {
      track: item.apply.track,
      promptTemplateId: `system-${item.apply.track}`,
      promptTemplateOverride: null,
      visualStyle: originalDefaultStyleByTrack[item.apply.track] ?? form.visualStyle,
    } : {}),
    ...(item.apply.visualStyle ? { visualStyle: item.apply.visualStyle } : {}),
    ...(item.apply.coverTemplateId ? { coverMode: "titled", coverTemplateId: item.apply.coverTemplateId } : {}),
  });
  const startCtaEdit = (index: number) => {
    setEditingCtaIndex(index);
    setEditingCtaText(index === ctaLibrary.length ? "" : ctaLibrary[index]);
  };
  const cancelCtaEdit = () => {
    setEditingCtaIndex(null);
    setEditingCtaText("");
  };
  const saveCtaEdit = () => {
    if (editingCtaIndex === null) return;
    const value = editingCtaText.trim();
    if (!value) {
      cancelCtaEdit();
      return;
    }
    const isNew = editingCtaIndex === ctaLibrary.length;
    const previous = isNew ? null : ctaLibrary[editingCtaIndex];
    const next = [...ctaLibrary];
    if (isNew) next.push(value);
    else next[editingCtaIndex] = value;
    writeCtaLibrary(next);
    if (isNew || previous === form.outroCta) onChange({ outroCta: value });
    cancelCtaEdit();
  };
  const deleteCta = (index: number) => {
    const removed = ctaLibrary[index];
    writeCtaLibrary(ctaLibrary.filter((_, itemIndex) => itemIndex !== index));
    if (removed === form.outroCta) onChange({ outroCta: "" });
    if (editingCtaIndex === index) cancelCtaEdit();
  };
  const directPreview = useMemo(
    () => form.inputText
      .split(/\n\s*\n+|(?<=[。！？!?；;])/)
      .map((item) => item.trim())
      .filter(Boolean)
      .slice(0, 20),
    [form.inputText],
  );
  const saveTaskPreset = () => {
    const name = presetName.trim();
    if (!name) return;
    const preset = {
      id: `preset-${crypto.randomUUID()}`,
      name,
      form: presetFormFromBuilder(form),
      createdAt: new Date().toISOString(),
    };
    writeTaskPresets([...taskPresets.filter((item) => item.name !== name), preset]);
    setPresetDialogOpen(false);
    setPresetName("");
  };
  const applyTaskPreset = (presetId: string) => {
    const preset = taskPresets.find((item) => item.id === presetId);
    if (preset) onChange(structuredClone(preset.form));
  };
  const deleteTaskPreset = (presetId: string) => {
    const preset = taskPresets.find((item) => item.id === presetId);
    if (!preset || !window.confirm(`删除预设“${preset.name}”？`)) return;
    writeTaskPresets(taskPresets.filter((item) => item.id !== presetId));
  };
  return (
    <>
      {taskPresets.length ? (
        <section className="builder-card builder-card--compact">
          <div className="builder-card__heading"><span className="builder-card__icon">☆</span><div><h2>我的预设</h2><p>一键套用除文案外的创建配置</p></div></div>
          <div className="preset-list">{taskPresets.map((preset) => <div key={preset.id}><button type="button" className="chip" onClick={() => applyTaskPreset(preset.id)}>{preset.name}</button><button type="button" aria-label={`删除预设 ${preset.name}`} onClick={() => deleteTaskPreset(preset.id)}>×</button></div>)}</div>
        </section>
      ) : null}
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
          <label className="field-label">文案内容 <small>{form.inputText.length} 字 / 至少 50 字</small></label>
          <textarea className="copy-textarea" value={form.inputText} placeholder={form.sourceMode === "ai" ? "AI 生成后会填入这里，也可以手动编辑" : "粘贴一段人物故事、口播稿或带货文案"} onChange={(event) => onChange({ inputText: event.target.value })} />
        </div>
        <div className="field-group"><span className="field-label field-label--standalone">视频形式</span><div className="choice-grid choice-grid--two">
          {[{ value: "narration" as const, title: "旁白视频", description: "单人配音讲述（默认）" }, { value: "podcast" as const, title: "双人播客", description: "两位主播一问一答聊内容" }].map((item) => <button key={item.value} type="button" className={`choice-card ${form.videoForm === item.value ? "is-selected" : ""}`} onClick={() => onChange({ videoForm: item.value })}><span className="choice-card__radio" /><span><strong>{item.title}</strong><small>{item.description}</small></span></button>)}
        </div>
        {form.videoForm === "podcast" ? <div className="copy-nested-panel video-form-nested"><div className="copy-inline-setting"><span>配图方式</span><div className="segmented-control"><button type="button" className={form.podcastImageMode === "multi" ? "is-selected" : ""} onClick={() => onChange({ podcastImageMode: "multi" })}>按分镜配图 · 每轮一张</button><button type="button" className={form.podcastImageMode === "single" ? "is-selected" : ""} onClick={() => onChange({ podcastImageMode: "single" })}>单图封面 · 铺满全程</button></div></div><div className="copy-inline-setting"><span>主播组合</span><div className="segmented-control">{podcastPairs.map((pair) => <button key={pair.id} type="button" className={form.podcastPair === pair.id ? "is-selected" : ""} onClick={() => onChange({ podcastPair: pair.id, ttsVoiceId: pair.speakers[0], ttsVoiceIdB: pair.speakers[1], ttsProvider: "volcengine" })}>{pair.name}</button>)}</div></div><p className="copy-help">播客使用专属双人音色；常规配音与语速选项自动隐藏。</p></div> : null}
        </div>
        <div className="field-group"><span className="field-label field-label--standalone">内容赛道</span><div className="chip-list">{contentTracks.map((item) => <button key={item} type="button" className={`chip ${form.track === item ? "is-selected" : ""}`} onClick={() => updateTrack(item)}>{item}</button>)}</div></div>
        <label className="field-group"><span className="field-label field-label--standalone">提示词模板 <small>系统模板 / 我的模板</small></span><select className="text-input" value={form.promptTemplateId} onChange={(event) => updatePromptTemplate(event.target.value)}>{contentTracks.map((track) => <option key={track} value={`system-${track}`}>系统 · {track}</option>)}{customPromptTemplates.length ? <optgroup label="我的模板">{customPromptTemplates.map((template) => <option key={template.id} value={template.id}>{template.name} · {template.baseTrack}</option>)}</optgroup> : null}</select><span className="template-hint">{form.promptTemplateOverride ? `当前使用本地模板“${form.promptTemplateOverride.name}”，四段提示词会随任务保存并由流水线实际调用。` : "使用从原版 v1.17.0 提取并核对的当前赛道提示词。"}</span></label>
      </section>

      <details className="builder-card builder-card--details" open={advancedOpen} onToggle={(event) => setAdvancedOpen(event.currentTarget.open)}>
        <summary><div className="builder-card__heading"><span className="builder-card__icon">⚙</span><div><h2>高级选项</h2><p>三种运行模式与原版暂停/改写控制</p></div><span className="details-chevron">{advancedOpen ? "收起" : "展开"}</span></div></summary>
        <span className="field-label field-label--standalone">执行模式</span><div className="choice-grid choice-grid--three">{modeOptions.map((item) => <button key={item.value} type="button" className={`choice-card ${form.mode === item.value ? "is-selected" : ""}`} onClick={() => onChange({ mode: item.value })}><span className="choice-card__radio" /><span><strong>{item.title}</strong><small>{item.description}</small></span></button>)}</div>
        <div className="field-group"><span className="field-label field-label--standalone">暂停策略</span><div className="choice-grid choice-grid--four">{pauseOptions.map((item) => <button key={item.value} type="button" className={`choice-card choice-card--compact ${form.pausePreset === item.value ? "is-selected" : ""}`} onClick={() => onChange({ pausePreset: item.value })}><span className="choice-card__radio" /><span><strong>{item.title}{item.badge ? <em>{item.badge}</em> : null}</strong><small>{item.description}</small></span></button>)}</div></div>
        {form.pausePreset === "custom" ? <div className="custom-pause-panel"><span>完成以下步骤后暂停</span><div className="custom-pause-grid">{customPauseOrder.map((stepId) => {
          const step = pipelineSteps[stepId];
          const disabled = (form.mode === "direct" && [0, 1, 2].includes(stepId)) || (form.mode === "semi_auto" && [0, 1].includes(stepId));
          return <label key={step.id} className={disabled ? "is-disabled" : ""}><input type="checkbox" disabled={disabled} checked={!disabled && form.customPauseSteps.includes(step.id)} onChange={(event) => onChange({ customPauseSteps: event.target.checked ? [...new Set([...form.customPauseSteps, step.id])] : form.customPauseSteps.filter((id) => id !== step.id) })} />{step.title}</label>;
        })}</div></div> : null}
        {form.mode === "auto" ? (
          <div className="copy-options-stack field-group">
            <div>
              <div className="copy-field-heading"><span className="field-label field-label--standalone">改写强度</span><small>强度越高原创度越高，但与对标结构差异越大</small></div>
              <div className="choice-grid choice-grid--three">{rewriteOptions.map((item) => <button key={item.value} type="button" className={`choice-card copy-option-card ${form.rewriteIntensity === item.value ? "is-selected" : ""}`} onClick={() => onChange({ rewriteIntensity: item.value })}><span className="choice-card__radio" /><span><strong>{item.title}{item.badge ? <em>{item.badge}</em> : null}</strong><small>{item.description}</small></span></button>)}</div>
            </div>
            {!povHiddenTracks.has(form.track) ? <div>
              <div className="copy-field-heading"><span className="field-label field-label--standalone">叙事视角</span><small>切换人称可大幅提升原创度</small></div>
              <div className="choice-grid choice-grid--three">{narrativeOptions.map((item) => <button key={item.value} type="button" className={`choice-card copy-option-card ${form.narrativePov === item.value ? "is-selected" : ""}`} onClick={() => onChange({ narrativePov: item.value })}><span className="choice-card__radio" /><span><strong>{item.title}{item.badge ? <em>{item.badge}</em> : null}</strong><small>{item.description}</small></span></button>)}</div>
            </div> : null}
            <div className="copy-inline-setting">
              <span className="field-label field-label--standalone">带货模式</span>
              <ToggleSwitch checked={form.track === "电商带货" || form.keepPromotion} label={form.track === "电商带货" ? "电商带货赛道固定保留促单内容" : form.keepPromotion ? "保留产品推荐和促单内容" : "改写时删除带货段落"} onChange={(keepPromotion) => form.track !== "电商带货" && onChange({ keepPromotion })} />
            </div>
          </div>
        ) : (
          <div className="mode-explanation field-group">
            {form.mode === "semi_auto"
              ? "半自动：完全用你的原文，AI 不改写，只帮你智能分句（断句更顺、配图更贴）。"
              : "直接出片：完全用你的原文，AI 不改写也不重新分句，按你写的空行 / 句号机械切分。"}
            <strong>此模式无改写过程，改写强度、叙事视角和带货模式已自动隐藏。</strong>
          </div>
        )}
        {form.videoForm === "narration" ? (
          <div className="copy-options-stack field-group">
            <div className="copy-nested-panel">
              <div className="copy-inline-setting">
                <span className="field-label field-label--standalone">固定开头</span>
                <ToggleSwitch checked={form.fixedIntroEnabled} label={form.fixedIntroEnabled ? "这段开场白原样拼在正文最前，AI 不改写" : "每条视频固定的开场白（如账号人设语）"} onChange={(fixedIntroEnabled) => onChange({ fixedIntroEnabled })} />
              </div>
              {form.fixedIntroEnabled ? (
                <div className="copy-nested-content">
                  <div className="copy-radio-row">
                    <label><input type="radio" name="fixed-intro-mode" checked={form.fixedIntroMode === "account"} onChange={() => onChange({ fixedIntroMode: "account" })} />账号开场白 <small>（自己写，每次任务自动带上）</small></label>
                    <label><input type="radio" name="fixed-intro-mode" checked={form.fixedIntroMode === "lock"} onChange={() => onChange({ fixedIntroMode: "lock" })} />锁定原文开头 <small>（前 N 句原样保留，AI 只改写其余部分）</small></label>
                  </div>
                  {form.fixedIntroMode === "account" ? (
                    <>
                      <textarea className="text-input copy-auto-textarea" rows={2} value={form.fixedIntro} placeholder="例：大家好，我是老张，专注讲述那些不该被遗忘的故事。" onChange={(event) => onChange({ fixedIntro: event.target.value })} />
                      <p className="copy-help">这段原样拼在正文最前，AI 正文自动衔接、不重复自我介绍 · 约多 1 个分镜成本</p>
                    </>
                  ) : (
                    <>
                      <label className="copy-lock-count">锁定前 <input className="text-input" type="number" min="1" max="20" value={form.lockIntroSentences} onChange={(event) => onChange({ lockIntroSentences: Math.max(1, Math.min(20, Number(event.target.value) || 1)), lockIntroDirty: false })} /> 句 <small>（1–20，选中的句子自动回填到下方，可修改删减）</small>{form.lockIntroDirty ? <button type="button" onClick={() => onChange({ lockIntroText: automaticLockIntro, lockIntroDirty: false })}>↺ 重新加载</button> : null}</label>
                      <textarea className="text-input copy-auto-textarea" rows={3} value={form.lockIntroText} placeholder="粘贴文案后，选中的开头几句会自动回填到这里；可修改删减，最终以这里的内容为准" onChange={(event) => onChange({ lockIntroText: event.target.value, lockIntroDirty: true })} />
                      <p className="copy-help">{form.lockIntroDirty ? "已手动编辑——将以此内容作为锁定开头；点「重新加载」可恢复自动切片" : "未编辑时按当前文本自动锁定；AI 只改写其余部分、不复述开头信息"}</p>
                    </>
                  )}
                </div>
              ) : null}
            </div>
            <div className="copy-nested-panel">
              <div className="copy-inline-setting">
                <span className="field-label field-label--standalone">尾部引导</span>
                <ToggleSwitch checked={form.outroCtaEnabled} label={form.outroCtaEnabled ? "选中的引导文案原样拼在正文末尾" : "改写后自动追加引导关注 / 互动文案"} onChange={(outroCtaEnabled) => onChange({ outroCtaEnabled })} />
              </div>
              {form.outroCtaEnabled ? (
                <div className="copy-nested-content cta-library">
                  {ctaLibrary.map((item, index) => editingCtaIndex === index ? (
                    <div className="cta-editor" key={`edit-${index}`}>
                      <textarea className="text-input copy-auto-textarea" rows={2} value={editingCtaText} autoFocus onChange={(event) => setEditingCtaText(event.target.value)} />
                      <div><button type="button" className="primary-button" onClick={saveCtaEdit}>保存</button><button type="button" onClick={cancelCtaEdit}>取消</button></div>
                    </div>
                  ) : (
                    <label key={`${item}-${index}`} className={`cta-item ${form.outroCta === item ? "is-selected" : ""}`}>
                      <input type="radio" name="outro-cta-item" checked={form.outroCta === item} onChange={() => onChange({ outroCta: item })} />
                      <span>{item}</span>
                      <span className="cta-item__actions"><button type="button" onClick={(event) => { event.preventDefault(); startCtaEdit(index); }}>编辑</button><button type="button" className="is-danger" onClick={(event) => { event.preventDefault(); deleteCta(index); }}>删除</button></span>
                    </label>
                  ))}
                  {editingCtaIndex === ctaLibrary.length ? (
                    <div className="cta-editor">
                      <textarea className="text-input copy-auto-textarea" rows={2} value={editingCtaText} autoFocus placeholder="写一条自己的引导文案，可用 {主角} 占位符" onChange={(event) => setEditingCtaText(event.target.value)} />
                      <div><button type="button" className="primary-button" onClick={saveCtaEdit}>保存</button><button type="button" onClick={cancelCtaEdit}>取消</button></div>
                    </div>
                  ) : <button type="button" className="cta-add-button" onClick={() => startCtaEdit(ctaLibrary.length)}>＋ 新增一条</button>}
                  <p className="copy-help">{"{主角}"} 自动替换为当期人物 / 主题名 · 互动类句式建议偶尔使用，避免每条都带 · 约多 1 个分镜的图与配音成本</p>
                </div>
              ) : null}
            </div>
          </div>
        ) : null}
        {form.mode !== "direct" ? <div className="field-group form-grid form-grid--two">{form.mode === "auto" ? <label><span className="field-label field-label--standalone">目标字数 <small>±15%，留空跟随原文</small></span><NumberField value={form.targetLength} placeholder="自动" onChange={(targetLength) => onChange({ targetLength })} /></label> : <div />}<label><span className="field-label field-label--standalone">目标分镜数 <small>±10%，建议每镜 25–45 字</small></span><NumberField value={form.targetScenes} placeholder="自动" onChange={(targetScenes) => onChange({ targetScenes })} /></label></div> : null}
        {form.mode === "direct" && directPreview.length ? <div className="direct-preview field-group"><strong>直接出片分段预览 · {directPreview.length} 段</strong>{directPreview.map((item, index) => <div key={`${index}-${item.slice(0, 8)}`}><span>{index + 1}</span><p>{item}</p></div>)}</div> : null}
      </details>

      <section className="builder-card">
        <div className="builder-card__heading"><span className="builder-card__icon">◇</span><div><h2>出图</h2><p>素材来源、画风、参考图、封面与剪映模板</p></div></div>
        <span className="field-label field-label--standalone">素材来源</span><div className="choice-grid choice-grid--three">{[["ai", "AI 绘图", "按画面风格生成插画 / 写实图"], ["stock", "网络素材", "真实视频画面，免版税可商用"], ["local", "我的素材库", "用你收集的真实照片"]].map(([value, title, description]) => <button key={value} type="button" className={`choice-card choice-card--compact ${form.materialSource === value ? "is-selected" : ""}`} onClick={() => onChange({ materialSource: value as BuilderFormState["materialSource"] })}><span className="choice-card__radio" /><span><strong>{title}</strong><small>{description}</small></span></button>)}</div>
        {form.materialSource === "local" ? <div className="field-group form-grid form-grid--two"><label><span className="field-label field-label--standalone">人物素材组</span><select className="text-input" value={selectedPersonGroupId} onChange={(event) => setSelectedPersonGroupId(event.target.value)}><option value="">请选择素材组</option>{personGroups.map((group) => <option key={group.id} value={group.id}>{group.name} · {group.assets.length} 张</option>)}</select></label><button className="upload-tile upload-tile--compact" type="button" disabled={personImporting || !selectedPersonGroupId} onClick={() => {
          const group = personGroups.find((item) => item.id === selectedPersonGroupId);
          if (!group?.assets.length) return;
          setPersonImporting(true);
          void Promise.all(group.assets.map(personAssetToFile))
            .then((files) => onUploadImages(files))
            .finally(() => setPersonImporting(false));
        }}><strong>{personImporting ? "正在读取人物素材…" : "使用这组人物素材"}</strong><span>按素材库顺序写入当前任务</span></button></div> : null}
        {form.materialSource === "local" || form.materialSource === "stock" ? <label className="upload-tile field-group"><input type="file" accept="image/*" multiple onChange={(event) => event.target.files && onUploadImages(event.target.files)} /><strong>{form.materialSource === "stock" ? "导入已获授权的网络素材图片" : "素材库为空？从本机批量导入"}</strong><span>{form.materialSource === "stock" ? "独立版未接入原作者私有素材检索服务；这里接收你已获授权的素材，不伪造授权" : taskReady ? "按文件顺序匹配分镜，也可在产物区逐张替换" : "上传时会自动创建本地任务目录"}</span></label> : null}
        <div className="field-group option-checks"><label><input type="checkbox" checked={form.autoBorrowImage} onChange={(event) => onChange({ autoBorrowImage: event.target.checked })} />失败图自动使用相邻画面补位</label></div>
        <div className="field-group form-grid form-grid--two"><div><span className="field-label field-label--standalone">画面生成比例</span><div className="segmented-control">{ratios.map((ratio) => <button key={ratio.value} type="button" disabled={Boolean(form.draftTemplateId)} className={form.aspectRatio === ratio.value ? "is-selected" : ""} onClick={() => onChange({ aspectRatio: ratio.value })}>{ratio.label}</button>)}</div><p className="template-hint">{form.draftTemplateId ? `已跟随剪映草稿模板：${activeTemplate.image.ratio}` : "未选择草稿模板时可自由选择"}</p></div><div className="settings-note"><strong>成片时长由真实配音决定</strong><span>目标字数、分镜数和 TTS 语速共同决定总时长；不会强行拉伸音频。</span></div></div>
        <div className="field-group"><span className="field-label field-label--standalone">图片引擎</span><div className="segmented-control"><button type="button" className={imageProviderConfig.provider === "minimax" ? "is-selected" : ""} onClick={() => {
          const next = { ...imageProviderConfig, provider: "minimax" as const };
          setImageProviderConfig(next);
          writeImageProviderConfig(next);
        }}>MiniMax image-01</button><button type="button" className={imageProviderConfig.provider === "openai-compatible" ? "is-selected" : ""} onClick={() => {
          const next = { ...imageProviderConfig, provider: "openai-compatible" as const };
          setImageProviderConfig(next);
          writeImageProviderConfig(next);
        }}>兼容图片引擎</button></div><p className="template-hint">{imageProviderConfig.provider === "minimax" ? "使用系统设置中的 MiniMax 凭据。" : imageProviderConfig.custom.baseUrl && imageProviderConfig.custom.apiKey ? `已配置 ${imageProviderConfig.custom.model}` : "请先在系统设置填写兼容图片引擎。"}</p></div>
        <div className="field-group"><span className="field-label field-label--standalone">视觉风格</span><div className="chip-list">{availableVisualStyles.map((item) => <button key={item} type="button" className={`chip ${form.visualStyle === item ? "is-selected" : ""}`} onClick={() => onChange({ visualStyle: item })}>{item}</button>)}</div></div>
        <details className="custom-pause-panel field-group"><summary>新建自定义画风</summary><div className="form-grid form-grid--two"><label><span className="field-label field-label--standalone">画风名称</span><input className="text-input" value={newStyleName} onChange={(event) => setNewStyleName(event.target.value)} placeholder="例如：赛博朋克雨夜" /></label><label><span className="field-label field-label--standalone">提示词前缀</span><input className="text-input" value={newStylePrompt} onChange={(event) => setNewStylePrompt(event.target.value)} placeholder="描述色调、材质、光线与构图" /></label></div><button className="primary-button" type="button" disabled={!newStyleName.trim() || !newStylePrompt.trim()} onClick={() => {
          const created = { id: `style-${crypto.randomUUID()}`, name: newStyleName.trim(), prompt: newStylePrompt.trim(), negativePrompt: "文字，水印，标志，低清晰度" };
          const next = [...customStyles.filter((style) => style.name !== created.name), created];
          writeCustomVisualStyles(next);
          setCustomStyles(next);
          onChange({ visualStyle: created.name });
          setNewStyleName("");
          setNewStylePrompt("");
        }}>保存并用于当前任务</button>{customStyles.length ? <div className="chip-list">{customStyles.map((style) => <button className="chip" key={style.id} type="button" title="删除自定义画风" onClick={() => {
          if (!window.confirm(`删除自定义画风“${style.name}”？`)) return;
          const next = customStyles.filter((item) => item.id !== style.id);
          writeCustomVisualStyles(next);
          setCustomStyles(next);
          if (form.visualStyle === style.name) onChange({ visualStyle: visualStyles[0] });
        }}>删除 · {style.name}</button>)}</div> : null}</details>
        {installedMarketItems.length ? <div className="field-group"><span className="field-label field-label--standalone">我的市场 · 已安装资源</span><div className="chip-list">{installedMarketItems.map((item) => <button key={item.id} type="button" className="chip" title={item.description} onClick={() => applyMarketItem(item)}>{item.kind === "prompt" ? "提示词" : item.kind === "style" ? "画风" : "封面"} · {item.name}</button>)}</div><p className="template-hint">点击资源会把对应赛道、画风或封面模板应用到当前任务。</p></div> : null}
        <div className="field-group form-grid form-grid--two"><label><span className="field-label field-label--standalone">剪映草稿模板</span><select className="text-input" value={form.draftTemplateId} onChange={(event) => {
          const template = availableTemplates.find((item) => item.id === event.target.value);
          if (!template) {
            onChange({ draftTemplateId: "", draftTemplateConfig: null });
            return;
          }
          const ratio = ratios.find((item) => item.value === template.config.image.ratio)?.value;
          onChange({ draftTemplateId: template.id, draftTemplateConfig: template.id.startsWith("custom-") ? structuredClone(template.config) : null, ...(ratio ? { aspectRatio: ratio } : {}) });
        }}><option value="">不使用模板 · 自由选择比例</option>{availableTemplates.map((template) => <option key={template.id} value={template.id}>{template.name}{template.id.startsWith("custom-") ? " · 我的模板" : ""}</option>)}</select></label><label className="upload-tile upload-tile--compact"><input type="file" accept="image/*" onChange={(event) => event.target.files?.[0] && onUploadReference(event.target.files[0])} /><strong>{referenceName ? "✓ 人物参考图已保存" : form.track === "电商带货" ? "产品参考图" : "主角参考图"}</strong><span>{referenceName || "上传后写入任务人物 / 产品一致性配置"}</span></label></div>
        {form.draftTemplateId ? <div className="template-summary"><div><strong>{selectedTemplate.name}{form.draftTemplateConfig ? " · 已自定义" : ""}</strong><span>{activeTemplate.canvas.width}×{activeTemplate.canvas.height} · 画面 {activeTemplate.image.ratio}</span></div><div><span>正文字幕 {activeTemplate.caption.fontSize} 号 / 每行 {activeTemplate.caption.maxCharsPerLine} 字</span><span>{activeTemplate.caption.color} · 背景透明度 {activeTemplate.caption.background.alpha}</span></div><div><span>免责声明 {activeTemplate.disclaimer.visible ? "开启" : "关闭"}</span><span>旁白 {activeTemplate.audio.narrationVolume} / BGM {activeTemplate.audio.bgmVolume}</span></div></div> : null}
        <DraftTemplateEditor config={activeTemplate} onChange={(draftTemplateConfig) => onChange({ draftTemplateConfig })} onReset={() => onChange({ draftTemplateConfig: null })} onUploadBackground={onUploadTemplateBackground} />
        {form.materialSource === "ai" && form.videoForm === "narration" ? <div className="field-group dynamic-storyboard-panel"><span className="field-label field-label--standalone">动态分镜</span><div className="segmented-control">{[{ value: 0, label: "关闭" }, { value: 3, label: "前 3 张" }, { value: -1, label: "全部" }, { value: 5, label: "自定义" }].map((option) => {
          const custom = ![0, 3, -1].includes(form.videoIntroCount);
          const selected = option.value === 5 ? custom : form.videoIntroCount === option.value;
          return <button key={option.label} type="button" className={selected ? "is-selected" : ""} onClick={() => onChange({ dynamicStoryboard: option.value !== 0, videoIntroCount: option.value })}>{option.label}</button>;
        })}</div>{form.dynamicStoryboard && ![3, -1].includes(form.videoIntroCount) ? <label><span className="field-label field-label--standalone">转视频镜头数</span><input className="text-input" type="number" min="1" max="60" value={Math.max(1, form.videoIntroCount)} onChange={(event) => onChange({ videoIntroCount: Math.max(1, Math.min(60, Number(event.target.value) || 5)) })} /></label> : null}<div><span className="field-label field-label--standalone">每镜生成时长</span><div className="segmented-control"><button type="button" disabled={!form.dynamicStoryboard} className={form.videoIntroDurationMode === "narration" ? "is-selected" : ""} onClick={() => onChange({ videoIntroDurationMode: "narration" })}>跟随配音</button><button type="button" disabled={!form.dynamicStoryboard} className={form.videoIntroDurationMode === "fixed" ? "is-selected" : ""} onClick={() => onChange({ videoIntroDurationMode: "fixed" })}>固定秒数</button></div></div>{form.dynamicStoryboard && form.videoIntroDurationMode === "fixed" ? <label><span className="field-label field-label--standalone">固定时长（6–30 秒）</span><input className="text-input" type="number" min="6" max="30" value={form.videoIntroDuration} onChange={(event) => onChange({ videoIntroDuration: Math.max(6, Math.min(30, Number(event.target.value) || 6)) })} /></label> : null}<p className="template-hint">原版使用 RunningHub 自动生成；独立版保留同一任务参数与逐镜视频替换位，但未接入原作者私有积分服务。</p></div> : null}
        {form.materialSource !== "stock" ? <div className="field-group cover-panel"><span className="field-label field-label--standalone">封面海报 <small>发布封面，独立于正片</small></span><div className="segmented-control">{[["off", "关闭"], ["titled", "带标题文字"], ["plain", "留白不带字"], ["local", "本地上传"]].map(([value, label]) => <button key={value} type="button" className={form.coverMode === value ? "is-selected" : ""} onClick={() => onChange({ coverMode: value as BuilderFormState["coverMode"] })}>{label}</button>)}</div>
          {form.coverMode === "local" ? <label className="upload-tile upload-tile--compact"><input type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => event.target.files?.[0] && onUploadCover(event.target.files[0])} /><strong>{coverLocalName ? "✓ 本地封面已保存" : "把封面图拖到这里，或点击选择"}</strong><span>{coverLocalName || "支持 png / jpg / webp · 建议与所选封面比例一致"}</span></label> : null}
          {form.coverMode !== "off" && form.coverMode !== "local" ? <><label><span className="field-label field-label--standalone">封面模板</span><select className="text-input" value={form.coverTemplateId} onChange={(event) => onChange({ coverTemplateId: event.target.value })}>{coverTemplates.map((template) => <option key={template.id} value={template.id}>{template.name}</option>)}</select></label><div><span className="field-label field-label--standalone">封面比例</span><div className="segmented-control">{coverRatios.map((ratio) => <button key={ratio.value} type="button" className={form.coverRatio === ratio.value ? "is-selected" : ""} onClick={() => onChange({ coverRatio: ratio.value })}>{ratio.label}</button>)}</div></div>
            {form.secondCover ? <div className="second-cover-panel"><div className="copy-inline-setting"><strong>封面 2</strong><button type="button" onClick={() => onChange({ secondCover: false })}>移除</button></div><div className="segmented-control"><button type="button" className={form.secondCoverMode === "titled" ? "is-selected" : ""} onClick={() => onChange({ secondCoverMode: "titled" })}>带标题文字</button><button type="button" className={form.secondCoverMode === "plain" ? "is-selected" : ""} onClick={() => onChange({ secondCoverMode: "plain" })}>留白不带字</button></div><label><span className="field-label field-label--standalone">封面 2 模板</span><select className="text-input" value={form.secondCoverTemplateId} onChange={(event) => onChange({ secondCoverTemplateId: event.target.value })}>{coverTemplates.map((template) => <option key={template.id} value={template.id}>{template.name}</option>)}</select></label><div><span className="field-label field-label--standalone">封面 2 比例</span><div className="segmented-control">{coverRatios.map((ratio) => <button key={ratio.value} type="button" className={form.secondCoverRatio === ratio.value ? "is-selected" : ""} onClick={() => onChange({ secondCoverRatio: ratio.value })}>{ratio.label}</button>)}</div></div></div> : <button type="button" className="cta-add-button" onClick={() => onChange({ secondCover: true })}>＋ 增加一张封面（可选不同模板）</button>}
          </> : null}
        </div> : <p className="template-hint">网络素材模式不生成 AI 封面海报，已按原版隐藏。</p>}
      </section>

      <section className="builder-card">
        <div className="builder-card__heading"><span className="builder-card__icon">♫</span><div><h2>配音</h2><p>原客户端逐镜结构、教程连续旁白、外部音频与 BGM</p></div></div>
        {form.videoForm !== "podcast" ? <div className="segmented-control">{[["tts", "系统配音（TTS 生成）"], ["external", "上传自定义配音"]].map(([value, label]) => <button key={value} type="button" className={form.voiceSource === value ? "is-selected" : ""} onClick={() => onChange({ voiceSource: value as BuilderFormState["voiceSource"] })}>{label}</button>)}</div> : null}
        {form.videoForm !== "podcast" && form.voiceSource === "external" ? <><p className="template-hint">{form.mode === "auto" ? "全自动模式请按改写后的文案录制；改写完成后可在任务详情页上传。" : "当前模式不改写文案，可按上方原文直接录制或生成。"}</p><label className="upload-tile field-group"><input type="file" accept="audio/*" onChange={(event) => event.target.files?.[0] && onUploadExternalAudio(event.target.files[0])} /><strong>{externalAudioName ? "✓ 外部配音已保存" : "上传完整配音"}</strong><span>{externalAudioName || "读取真实时长并生成可编辑字幕时间线"}</span></label></> : null}
        {form.videoForm !== "podcast" && form.voiceSource === "tts" ? <><div className="field-group"><span className="field-label field-label--standalone">配音员</span><div className="segmented-control"><button type="button" className={form.ttsProvider === "volcengine" ? "is-selected" : ""} onClick={() => onChange({ ttsProvider: "volcengine", ttsVoiceId: "" })}>豆包</button><button type="button" className={form.ttsProvider === "minimax" ? "is-selected" : ""} onClick={() => onChange({ ttsProvider: "minimax", ttsVoiceId: "" })}>MiniMax</button></div></div><div className="field-group form-grid form-grid--two"><label><span className="field-label field-label--standalone">音色</span><select className="text-input" value={form.ttsVoiceId} onChange={(event) => onChange({ ttsVoiceId: event.target.value })}>{voices.map((voice) => <option key={voice.id} value={voice.id}>{voice.name} · {voice.tag}</option>)}</select></label><div><span className="field-label field-label--standalone">配音语速</span><div className="segmented-control">{speedPresets.map((speed) => <button key={speed.value} type="button" className={form.ttsSpeed === speed.value ? "is-selected" : ""} onClick={() => onChange({ ttsSpeed: speed.value })}>{speed.label} <small>{speed.value === 1 ? "1.0" : String(speed.value)}×</small></button>)}</div></div></div></> : null}
        {form.voiceSource === "tts" && form.videoForm === "narration" ? <div className="field-group"><span className="field-label field-label--standalone">旁白结构</span><div className="choice-grid choice-grid--two"><button type="button" className={`choice-card ${form.ttsMode === "original-segmented" ? "is-selected" : ""}`} onClick={() => onChange({ ttsMode: "original-segmented" })}><span className="choice-card__radio" /><span><strong>原客户端结构 · 逐镜 TTS</strong><small>每镜独立图片、音频和字幕；对应原客户端 33/33 任务证据</small></span></button><button type="button" className={`choice-card ${form.ttsMode === "continuous" ? "is-selected" : ""}`} onClick={() => onChange({ ttsMode: "continuous" })}><span className="choice-card__radio" /><span><strong>教程推荐 · 连贯旁白</strong><small>整篇一次合成；MiniMax 真实时间戳打分镜，显示字幕≤9字</small></span></button></div><p className="template-hint">两种模式分别保留：前者复刻原客户端产物结构；后者依据同琛剪辑教程优化最终听感，不冒充原客户端内部实现。</p></div> : null}
        {form.videoForm === "podcast" ? <div className="speaker-hint"><span className="speaker-tag">[A]</span><span className="speaker-tag">[B]</span><p>每轮必须以 [A] 或 [B] 开头；已按上方主播组合分别合成。常规音色和语速按原版自动隐藏。</p></div> : null}
        <div className="field-group bgm-picker"><span className="field-label field-label--standalone">背景音乐</span><div className="segmented-control"><button type="button" className={form.bgmId === "__builtin__" ? "is-selected" : ""} onClick={() => onChange({ bgmId: "__builtin__" })}>▶ 内置 BGM · 原版默认</button><button type="button" className={form.bgmId === "uploaded" ? "is-selected" : ""} disabled={!bgmName} onClick={() => onChange({ bgmId: "uploaded" })}>本地 BGM</button><button type="button" className={form.bgmId === "off" ? "is-selected" : ""} onClick={() => onChange({ bgmId: "off" })}>关闭</button></div>{form.bgmId === "__builtin__" ? <audio controls preload="metadata" src="/audio/default-bgm.mp3" /> : null}<span className="template-hint">原版默认选中随安装包内置的 BGM；草稿按模板音量 3、末尾淡出 2 秒。</span></div>
        <label className="upload-tile upload-tile--compact field-group"><input type="file" accept="audio/*" onChange={(event) => { const file = event.target.files?.[0]; if (file) { onChange({ bgmId: "uploaded" }); onUploadBgm(file); } }} /><strong>{bgmName ? "✓ 本地 BGM 已保存" : "＋ 添加自己的 BGM"}</strong><span>{bgmName || "写入剪映独立音轨，可替换原版内置音乐"}</span></label>
        <p className="template-hint">原版默认配音：火山引擎 2.0 · 东方浩然 · 1.0×；MiniMax 的“沉稳高管”是另一套音色，并不等同于东方浩然。</p>
        <p className={`provider-readiness ${hasTtsCredentials ? "is-ready" : ""}`}>{form.videoForm === "podcast" ? (hasTtsCredentials ? "播客专属豆包双人音色已就绪" : "播客需要豆包 TTS 凭据") : form.voiceSource === "external" ? "外部音频模式无需 TTS 凭据" : hasTtsCredentials ? `${form.ttsProvider === "minimax" ? "MiniMax" : "豆包"} TTS 凭据已就绪` : `${form.ttsProvider === "minimax" ? "MiniMax" : "豆包"} TTS 凭据未配置`}</p>
      </section>
      <div className="save-preset-row"><button type="button" className="secondary-button" onClick={() => setPresetDialogOpen(true)}>☆ 存为预设</button></div>
      {presetDialogOpen ? <div className="preset-dialog-backdrop" role="presentation" onClick={() => setPresetDialogOpen(false)}><div className="preset-dialog" role="dialog" aria-modal="true" aria-labelledby="preset-dialog-title" onClick={(event) => event.stopPropagation()}><h2 id="preset-dialog-title">保存任务预设</h2><p>保存当前配置，不包含标题、文案和 AI 创作主题。</p><input className="text-input" autoFocus value={presetName} maxLength={30} placeholder="例如：人物故事 · 现代电影 · MiniMax" onChange={(event) => setPresetName(event.target.value)} onKeyDown={(event) => event.key === "Enter" && saveTaskPreset()} /><div><button type="button" onClick={() => setPresetDialogOpen(false)}>取消</button><button type="button" className="primary-button" disabled={!presetName.trim()} onClick={saveTaskPreset}>保存</button></div></div></div> : null}
    </>
  );
}
