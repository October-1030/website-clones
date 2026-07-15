import { useEffect, useMemo, useState } from "react";
import "./ModeBuilder.css";

type ModeBuilderKind = "html-video" | "music-mv";

interface ModeBuilderProps {
  kind: ModeBuilderKind;
}

interface ChoiceProps {
  items: string[];
  value: string;
  onChange: (value: string) => void;
  disabledItems?: string[];
}

function Choices({ items, value, onChange, disabledItems = [] }: ChoiceProps) {
  return (
    <div className="mode-choices">
      {items.map((item) => (
        <button
          className={item === value ? "mode-chip selected" : "mode-chip"}
          disabled={disabledItems.includes(item)}
          key={item}
          onClick={() => onChange(item)}
          type="button"
        >
          {item}
        </button>
      ))}
    </div>
  );
}

const htmlStages = ["改写 + 分句", "场景规划", "素材（图片）", "配音", "动画预览", "出片"];
const mvStages = ["歌词准备", "歌词确认", "智能分句", "分句确认", "绘图提示词", "提示词确认", "批量生图", "图片确认", "歌词对齐", "剪映草稿"];

export function ModeBuilder({ kind }: ModeBuilderProps) {
  const isHtml = kind === "html-video";
  const [text, setText] = useState("");
  const [source, setSource] = useState(isHtml ? "AI 改写" : "AI 作曲");
  const [visualStyle, setVisualStyle] = useState("黑白摄影");
  const [songStyle, setSongStyle] = useState("爱国颂歌");
  const [foreground, setForeground] = useState("生成前景");
  const [singer, setSinger] = useState("不限");
  const [subtitleAnimation, setSubtitleAnimation] = useState("弹入");
  const [layout, setLayout] = useState("动态版式");
  const [mediaSource, setMediaSource] = useState("AI 绘图");
  const [dynamicStoryboard, setDynamicStoryboard] = useState("关闭");
  const [confirmPoint, setConfirmPoint] = useState("歌词确认");
  const [cover, setCover] = useState("带标题文字");
  const [running, setRunning] = useState(false);
  const [stage, setStage] = useState(-1);
  const stages = useMemo(() => (isHtml ? htmlStages : mvStages), [isHtml]);

  useEffect(() => {
    setText("");
    setSource(isHtml ? "AI 改写" : "AI 作曲");
    setVisualStyle("黑白摄影");
    setSongStyle("爱国颂歌");
    setForeground("生成前景");
    setSinger("不限");
    setRunning(false);
    setStage(-1);
  }, [isHtml]);

  useEffect(() => {
    if (!running) return;
    if (stage >= stages.length - 1) {
      setRunning(false);
      return;
    }
    const timer = window.setTimeout(() => setStage((current) => current + 1), 650);
    return () => window.clearTimeout(timer);
  }, [running, stage, stages.length]);

  const start = () => {
    setStage(0);
    setRunning(true);
  };

  return (
    <div className={`mode-builder ${isHtml ? "html" : "mv"}`}>
      <header className="mode-header">
        <h1>{isHtml ? "HTML 动画视频" : "音乐 MV 混剪"}</h1>
        <p>{isHtml ? "输入文案，AI 自动规划分镜 → 出素材 → 配音 → 生成动画分镜" : "AI 写词作曲 + 智能配画面 → 剪映草稿"}</p>
      </header>

      <section className="mode-card">
        <div className="mode-card-title"><span>▧</span><div><h2>{isHtml ? "文案" : "歌曲"}</h2><p>{isHtml ? "粘贴文案 · 处理方式" : "风格 · 演唱方式 · 主题 · 歌词"}</p></div></div>
        {isHtml && <button className="mode-command" type="button">✨ AI 命题创作 <small>没文案？只给主题 + 字数，AI 从零写整篇</small><span>展开 ▼</span></button>}
        <textarea value={text} onChange={(event) => setText(event.target.value)} placeholder={isHtml ? "粘贴一段文案（故事 / 文摘 / 金句）…" : "例如：赞美家乡的山水田园风光"} />
        <label>{isHtml ? "文案处理" : "歌曲来源"}</label>
        <Choices items={isHtml ? ["AI 改写", "直接用原文"] : ["AI 作曲", "本地音乐"]} value={source} onChange={setSource} />
        {!isHtml && <><label>风格模板</label><Choices items={["爱国颂歌", "怀旧经典", "励志奋斗", "田园诗意", "自定义"]} value={songStyle} onChange={setSongStyle} /><label>演唱</label><Choices items={["不限", "女声", "男声", "男女合唱"]} value={singer} onChange={setSinger} /></>}
      </section>

      <section className="mode-card">
        <div className="mode-card-title"><span>▣</span><div><h2>出图</h2><p>{isHtml ? "画面风格 · 前景素材 · 字幕风格" : "画面来源 · 画面风格 · 比例 · 参考图"}</p></div></div>
        <label>画面风格</label>
        <Choices items={isHtml ? ["黑白摄影", "写实彩色", "油画风格", "现代电影", "古风电影", "吉卜力"] : ["黑白摄影", "写实彩色", "油画风格", "复古胶片", "中国水墨", "吉卜力"]} value={visualStyle} onChange={setVisualStyle} />
        {isHtml ? <><label>前景素材</label><Choices items={["生成前景", "纯背景图"]} value={foreground} onChange={setForeground} /><label>字幕动效</label><Choices items={["弹入", "上升", "弹性", "打字机", "擦入", "显影", "呼吸", "横扫", "卡拉OK"]} value={subtitleAnimation} onChange={setSubtitleAnimation} /></> : <><label>画面来源</label><Choices items={["AI 绘图", "视频混剪（开发中）"]} value={mediaSource} onChange={setMediaSource} disabledItems={["视频混剪（开发中）"]} /><label>动态分镜</label><Choices items={["关闭", "前 3 组", "全片", "自定义"]} value={dynamicStoryboard} onChange={setDynamicStoryboard} /></>}
      </section>

      <section className="mode-card compact">
        <div className="mode-card-title"><span>◇</span><div><h2>{isHtml ? "画面布局与配音" : "封面与中途确认"}</h2><p>{isHtml ? "动态版式 · 转场 · 音色" : "发布封面 · 暂停点"}</p></div></div>
        <label>封面海报</label><Choices items={["不生成", "带标题文字", "留白不带字"]} value={cover} onChange={setCover} />
        <label>{isHtml ? "布局模式" : "中途确认"}</label><Choices items={isHtml ? ["动态版式", "默认竖屏", "横屏16:9", "知识卡（分栏）"] : ["歌词确认", "分句确认", "提示词确认", "图片确认"]} value={isHtml ? layout : confirmPoint} onChange={isHtml ? setLayout : setConfirmPoint} />
      </section>

      {stage >= 0 && <section className="mode-card mode-progress"><h2>{isHtml ? "动画流水线" : "MV 流水线"}</h2><div>{stages.map((item, index) => <div className={index < stage ? "done" : index === stage ? "active" : ""} key={item}><span>{index < stage ? "✓" : index + 1}</span><strong>{item}</strong></div>)}</div></section>}

      <footer className="mode-actions">
        <span>{stage === stages.length - 1 ? "演示任务已完成" : running ? `正在执行：${stages[stage]}` : "本地交互演示 · 不调用真实 API"}</span>
        <button className="mode-secondary" type="button">保存为草稿</button>
        <button className="mode-primary" disabled={text.trim().length < 10 || running} onClick={start} type="button">{running ? "生成中…" : "开始生成"}</button>
      </footer>
    </div>
  );
}
