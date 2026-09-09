"use client";

import { ArrowRight, CheckCircle2, FileUp, Sparkles, Upload } from "lucide-react";

export function WelcomeGuide({ onSkip, onImport, onCreate }: { onSkip: () => void; onImport: () => void; onCreate: () => void }) {
  const options = [
    { title: "我要续写已有作品", description: "导入您的作品，让AI帮您续写精彩章节，保持风格一致性", features: ["智能风格识别", "无缝情节衔接", "角色性格保持"], action: "导入书籍，开始续写", Icon: FileUp, onClick: onImport, tone: "indigo" },
    { title: "我要开新书", description: "从零开始，创作引人入胜的黄金开篇，让读者一见倾心", features: ["吸引力开头", "人物快速立体", "情节引人入胜"], action: "生成黄金开篇第一章", Icon: Sparkles, onClick: onCreate, tone: "amber" },
  ];
  return <section role="dialog" aria-modal="true" aria-labelledby="welcome-title" className="welcome-guide">
    <div className="mx-auto max-w-5xl">
      <h1 id="welcome-title" className="mb-10 text-center text-3xl font-bold tracking-tight text-gray-800 lg:text-4xl">选择你的创作方式</h1>
      <div className="mx-auto grid max-w-4xl grid-cols-1 gap-8 lg:grid-cols-2">
        {options.map(({ Icon, ...option }) => <div key={option.title} className={`welcome-card ${option.tone}`}>
          <div className="mb-6 flex items-center justify-between"><div className="welcome-icon"><Icon size={30} /></div><h2 className="flex-1 text-center text-xl font-bold text-gray-800">{option.title}</h2></div>
          <p className="mb-5 text-sm leading-relaxed text-gray-600">{option.description}</p>
          <ul className="mb-6 flex flex-col gap-3">{option.features.map(feature => <li key={feature} className="flex items-center gap-3 text-sm text-gray-700"><CheckCircle2 size={16} className="fill-green-500 text-white" />{feature}</li>)}</ul>
          <button className="welcome-action" onClick={() => option.onClick()}>{option.tone === "amber" ? <Sparkles size={18} /> : <Upload size={18} />}{option.action}</button>
        </div>)}
      </div>
      <div className="mx-auto my-6 flex max-w-2xl items-center gap-6 text-sm text-gray-400"><span className="h-px flex-1 bg-gray-200" />或者<span className="h-px flex-1 bg-gray-200" /></div>
      <div className="mx-auto max-w-2xl rounded-2xl bg-white p-8 text-center shadow-md"><h2 className="mb-3 text-lg font-bold text-gray-800">自由探索AI写作功能</h2><button autoFocus className="mx-auto flex items-center gap-2 text-gray-700 transition-colors hover:text-indigo-600" onClick={onSkip}><ArrowRight size={18} />跳过引导，直接开始</button></div>
    </div>
  </section>;
}
