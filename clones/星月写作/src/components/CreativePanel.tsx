"use client";

import { BookOpen, FileText, Globe2, Image, Lightbulb, ListTree, Sparkles, Tags, UserRound, WandSparkles } from "lucide-react";
import { useState } from "react";

const creativeTools = [
  { name: "封面生成器", description: "封面生成，功能尝鲜", Icon: Image },
  { name: "脑洞生成器", description: "突破想象，脑洞大开", Icon: Lightbulb },
  { name: "书名生成器", description: "爆款书名，超级吸量", Icon: BookOpen },
  { name: "书名测试", description: "一键生成多个书名并批量试装封面", Icon: BookOpen },
  { name: "简介生成器", description: "期待拉满，万量可期", Icon: FileText },
  { name: "大纲生成器", description: "创作蓝图，尽在掌握", Icon: ListTree },
  { name: "细纲生成器", description: "条理分明，轻松创作", Icon: ListTree },
  { name: "黄金开篇生成器", description: "故事起航，点燃期待", Icon: Sparkles },
  { name: "金手指生成器", description: "情节神转，尽在指间", Icon: WandSparkles },
  { name: "名字生成器", description: "人名物品地名势力名……", Icon: Tags },
  { name: "人设生成器", description: "妙笔人设，轻松生成", Icon: UserRound },
  { name: "世界观生成器", description: "虚构天地，成就奇想", Icon: Globe2 },
  { name: "词条生成器", description: "道具、技能、功法、法宝...", Icon: Tags },
];
const scriptTools = [
  { name: "封面生成器", description: "封面生成，功能尝鲜", Icon: Image },
  { name: "剧本脑洞生成器", description: "天马行空，构思精彩剧情", Icon: Lightbulb },
  { name: "剧名生成器", description: "一键生成引爆眼球的剧名", Icon: BookOpen },
  { name: "剧本简介生成器", description: "快速生成吸引观众的剧本简介", Icon: FileText },
  { name: "剧本大纲生成器", description: "构建完整剧本架构蓝图", Icon: ListTree },
  { name: "剧本细纲生成器", description: "场景级细纲，分镜级掌控", Icon: ListTree },
  { name: "剧本开篇生成器", description: "开幕即高能，抓住观众注意力", Icon: Sparkles },
  { name: "剧本金手指生成器", description: "为主角量身打造独特能力设定", Icon: WandSparkles },
  { name: "名字生成器", description: "人名物品地名势力名……", Icon: Tags },
  { name: "人设生成器", description: "妙笔人设，轻松生成", Icon: UserRound },
  { name: "剧本世界观生成器", description: "搭建沉浸式影视世界观", Icon: Globe2 },
  { name: "词条生成器", description: "道具、技能、功法、法宝...", Icon: Tags },
];
const advancedTools = [
  { name: "对标脑洞", description: "参考爆款脑洞，生成你的灵感", Icon: Lightbulb },
  { name: "对标书名", description: "借鉴爆款标题，打造吸睛书名", Icon: BookOpen },
  { name: "对标简介", description: "拆解热门简介，重塑吸引力", Icon: FileText },
];

export function CreativePanel({ onOpening, onTool }: { onOpening: () => void; onTool: (name: string) => void }) {
  const [kind,setKind]=useState<"小说"|"剧本">("小说");
  const tools=kind==="小说"?creativeTools:scriptTools;
  return <section className="creative-panel" aria-label="创作工具箱">
    <div className="creative-heading"><div><h2 className="text-2xl font-semibold">创作工具箱</h2><p className="mt-2 text-muted">突破思维边界，发挥你的想象力开启之旅</p></div><div className="creative-kind" role="tablist" aria-label="创作类型"><button role="tab" aria-selected={kind==="小说"} onClick={()=>setKind("小说")}>小说</button><button role="tab" aria-selected={kind==="剧本"} onClick={()=>setKind("剧本")}>剧本</button></div></div>
    <h3 className="mb-4 mt-7 text-base font-medium">{kind}</h3>
    <div className="creative-grid">{tools.map(({ name, description, Icon }) => name === "黄金开篇生成器"
      ? <button className="creative-tool golden-tool" key={name} onClick={onOpening}><Icon size={25} /><div><h3>{name}</h3><p>{description}</p></div></button>
      : <button className="creative-tool" key={name} onClick={() => onTool(name)}><Icon size={25} /><div><h3>{name}</h3><p>{description}</p></div></button>)}</div>
    <h3 className="mb-4 mt-8 text-base font-medium">进阶工具</h3><div className="creative-grid">{advancedTools.map(({name,description,Icon})=><button className="creative-tool" key={name} onClick={()=>onTool(name)}><Icon size={25}/><div><h3>{name}</h3><p>{description}</p></div></button>)}</div>
  </section>;
}
