import type { DraftTemplateConfig, DraftTextLayer } from "../types/draft-template";

const animationOptions = [
  "none", "缩放", "缩放_II", "左拉镜", "右拉镜", "向左缩小", "向右缩小", "形变左缩", "形变右缩",
  "上下分割", "左右分割", "向左下降", "向右下降", "旋转缩小", "旋转上升", "翻转", "形变缩小",
  "回弹伸缩", "滑滑梯", "四格滑动", "百叶窗", "抖入放大",
];
const motionOptions = ["none", "zoom_in", "zoom_out", "kenburns_up", "kenburns_down", "pan_left", "pan_right"];

interface DraftTemplateEditorProps {
  config: DraftTemplateConfig;
  onChange: (config: DraftTemplateConfig) => void;
  onReset: () => void;
  onUploadBackground: (file: File) => Promise<string>;
}

function poolText(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value : [value]).filter(Boolean).join("，");
}

function parsePool(value: string): string | string[] {
  const pool = value.split(/[,，]/).map((item) => item.trim()).filter(Boolean);
  return pool.length <= 1 ? pool[0] || "none" : pool;
}

function TextLayerEditor({ label, layer, onChange }: { label: string; layer: DraftTextLayer; onChange: (patch: Partial<DraftTextLayer>) => void }) {
  return (
    <details className="template-editor__layer">
      <summary>{label} · {layer.visible ? `${layer.fontSize} 号 / Y ${layer.y.toFixed(3)}` : "关闭"}</summary>
      <div className="form-grid form-grid--three">
        <label className="toggle-row"><input type="checkbox" checked={layer.visible} onChange={(event) => onChange({ visible: event.target.checked })} />显示</label>
        <label><span className="field-label field-label--standalone">字号</span><input className="text-input" type="number" min="1" max="80" value={layer.fontSize} onChange={(event) => onChange({ fontSize: Number(event.target.value) || layer.fontSize })} /></label>
        <label><span className="field-label field-label--standalone">颜色</span><input className="text-input" type="color" value={layer.color} onChange={(event) => onChange({ color: event.target.value.toUpperCase() })} /></label>
        <label><span className="field-label field-label--standalone">X（-1 到 1）</span><input className="text-input" type="number" min="-1" max="1" step="0.01" value={layer.x} onChange={(event) => onChange({ x: Number(event.target.value) })} /></label>
        <label><span className="field-label field-label--standalone">Y（-1 到 1）</span><input className="text-input" type="number" min="-1" max="1" step="0.01" value={layer.y} onChange={(event) => onChange({ y: Number(event.target.value) })} /></label>
        <label><span className="field-label field-label--standalone">透明度</span><input className="text-input" type="number" min="0" max="1" step="0.05" value={layer.alpha} onChange={(event) => onChange({ alpha: Number(event.target.value) })} /></label>
        <label className="toggle-row"><input type="checkbox" checked={layer.bold} onChange={(event) => onChange({ bold: event.target.checked })} />粗体</label>
        <label className="toggle-row"><input type="checkbox" checked={layer.underline} onChange={(event) => onChange({ underline: event.target.checked })} />下划线</label>
        <label><span className="field-label field-label--standalone">描边宽度</span><input className="text-input" type="number" min="0" max="100" value={layer.border.width} onChange={(event) => onChange({ border: { ...layer.border, width: Number(event.target.value) || 0 } })} /></label>
      </div>
    </details>
  );
}

export function DraftTemplateEditor({ config, onChange, onReset, onUploadBackground }: DraftTemplateEditorProps) {
  const update = <K extends keyof DraftTemplateConfig>(key: K, patch: Partial<DraftTemplateConfig[K]>) => {
    onChange({ ...config, [key]: { ...config[key], ...patch } });
  };
  const updateText = (key: "title" | "subtitle" | "caption" | "disclaimer", patch: Partial<DraftTemplateConfig[typeof key]>) => {
    onChange({ ...config, [key]: { ...config[key], ...patch } });
  };

  return (
    <details className="template-editor">
      <summary>编辑这次任务的剪映模板参数</summary>
      <div className="template-catalog__notice"><strong>参数会直接写进剪映草稿</strong><span>运镜优先于动画；动画/运镜支持用中文逗号填写多项并按镜头循环。修改图片或字幕后只需重新打包 Step 7。</span></div>
      <div className="form-grid form-grid--three">
        <label><span className="field-label field-label--standalone">画布宽</span><input className="text-input" type="number" value={config.canvas.width} onChange={(event) => update("canvas", { width: Number(event.target.value) || 1080 })} /></label>
        <label><span className="field-label field-label--standalone">画布高</span><input className="text-input" type="number" value={config.canvas.height} onChange={(event) => update("canvas", { height: Number(event.target.value) || 1920 })} /></label>
        <label><span className="field-label field-label--standalone">背景色</span><input className="text-input" type="color" value={config.canvas.backgroundColor} onChange={(event) => update("canvas", { backgroundColor: event.target.value.toUpperCase() })} /></label>
        <label><span className="field-label field-label--standalone">画面比例</span><select className="text-input" value={config.image.ratio} onChange={(event) => update("image", { ratio: event.target.value })}>{["9:16", "3:4", "1:1", "4:3", "16:9"].map((value) => <option key={value}>{value}</option>)}</select></label>
        <label><span className="field-label field-label--standalone">画面顶部（0-1）</span><input className="text-input" type="number" min="0" max="1" step="0.01" value={config.image.top} onChange={(event) => update("image", { top: Number(event.target.value) })} /></label>
        <label><span className="field-label field-label--standalone">画面高度（0-1）</span><input className="text-input" type="number" min="0.1" max="1" step="0.01" value={config.image.height} onChange={(event) => update("image", { height: Number(event.target.value) })} /></label>
        <label><span className="field-label field-label--standalone">动画循环池</span><input className="text-input" list="draft-animation-options" value={poolText(config.image.animation)} onChange={(event) => update("image", { animation: parsePool(event.target.value) })} /><datalist id="draft-animation-options">{animationOptions.map((value) => <option key={value} value={value} />)}</datalist></label>
        <label><span className="field-label field-label--standalone">运镜循环池</span><input className="text-input" list="draft-motion-options" value={poolText(config.image.motion)} onChange={(event) => update("image", { motion: parsePool(event.target.value) })} /><datalist id="draft-motion-options">{motionOptions.map((value) => <option key={value} value={value} />)}</datalist></label>
        <label><span className="field-label field-label--standalone">运镜强度</span><input className="text-input" type="number" min="0.5" max="2" step="0.1" value={config.image.motionStrength ?? 1} onChange={(event) => update("image", { motionStrength: Number(event.target.value) || 1 })} /></label>
      </div>
      <label className="upload-tile upload-tile--compact field-group"><input type="file" accept="image/*" onChange={(event) => { const file = event.target.files?.[0]; if (file) void onUploadBackground(file).then((backgroundImage) => update("canvas", { backgroundImage })); }} /><strong>{config.canvas.backgroundImage ? "✓ 模板背景图已设置" : "上传模板背景图"}</strong><span>{config.canvas.backgroundImage || "会铺在画面轨下方"}</span></label>
      <TextLayerEditor label="主标题轨" layer={config.title} onChange={(patch) => updateText("title", patch)} />
      <TextLayerEditor label="副标题轨" layer={config.subtitle} onChange={(patch) => updateText("subtitle", patch)} />
      <TextLayerEditor label="口播字幕轨" layer={config.caption} onChange={(patch) => updateText("caption", patch)} />
      <div className="form-grid form-grid--three field-group">
        <label><span className="field-label field-label--standalone">每行最多字数</span><input className="text-input" type="number" min="4" max="40" value={config.caption.maxCharsPerLine} onChange={(event) => updateText("caption", { maxCharsPerLine: Number(event.target.value) || 12 })} /></label>
        <label><span className="field-label field-label--standalone">字幕底色</span><input className="text-input" type="color" value={config.caption.background.color} onChange={(event) => updateText("caption", { background: { ...config.caption.background, color: event.target.value.toUpperCase() } })} /></label>
        <label><span className="field-label field-label--standalone">字幕底色透明度</span><input className="text-input" type="number" min="0" max="1" step="0.05" value={config.caption.background.alpha} onChange={(event) => updateText("caption", { background: { ...config.caption.background, alpha: Number(event.target.value) } })} /></label>
      </div>
      <TextLayerEditor label="底部 AI 标注轨" layer={config.disclaimer} onChange={(patch) => updateText("disclaimer", patch)} />
      <label className="field-group"><span className="field-label field-label--standalone">底部标注文字</span><textarea className="artifact-textarea artifact-textarea--short" value={config.disclaimer.text} onChange={(event) => updateText("disclaimer", { text: event.target.value })} /></label>
      <div className="form-grid form-grid--three field-group">
        <label><span className="field-label field-label--standalone">旁白音量</span><input className="text-input" type="number" min="0" max="10" step="0.1" value={config.audio.narrationVolume} onChange={(event) => update("audio", { narrationVolume: Number(event.target.value) })} /></label>
        <label><span className="field-label field-label--standalone">BGM 音量</span><input className="text-input" type="number" min="0" max="10" step="0.1" value={config.audio.bgmVolume} onChange={(event) => update("audio", { bgmVolume: Number(event.target.value) })} /></label>
        <label><span className="field-label field-label--standalone">BGM 尾部淡出（毫秒）</span><input className="text-input" type="number" min="0" max="10000" step="100" value={config.audio.bgmFadeOutMs} onChange={(event) => update("audio", { bgmFadeOutMs: Number(event.target.value) })} /></label>
        <label className="toggle-row"><input type="checkbox" checked={config.frame.enabled} onChange={(event) => update("frame", { enabled: event.target.checked })} />启用上下背景/边框</label>
        <label><span className="field-label field-label--standalone">上部颜色</span><input className="text-input" type="color" value={config.frame.headerColor} onChange={(event) => update("frame", { headerColor: event.target.value.toUpperCase() })} /></label>
        <label><span className="field-label field-label--standalone">下部颜色</span><input className="text-input" type="color" value={config.frame.footerColor} onChange={(event) => update("frame", { footerColor: event.target.value.toUpperCase() })} /></label>
      </div>
      <button type="button" className="secondary-button" onClick={onReset}>恢复所选内置模板</button>
    </details>
  );
}
