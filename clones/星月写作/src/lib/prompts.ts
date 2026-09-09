export interface PromptRecord {
  id: string; title: string; type: string; category: string; content: string; description: string; uses: number; favorite: boolean; owned: boolean; updatedAt: string;
}

export const promptSeeds: PromptRecord[] = [
  { id: "seed-continuation", title: "连续剧情续写", type: "续写要求", category: "长篇", description: "保持人物动机和前文因果，推进一个明确的新变化。", content: "阅读关联前文，列出仍在生效的人物目标、冲突和伏笔，再续写下一章。新章节必须由前文事件触发，至少推进一条主线，并在结尾产生新的选择或代价。只输出章节标题与正文。", uses: 0, favorite: false, owned: false, updatedAt: "2026-08-01" },
  { id: "seed-review", title: "章节逻辑审稿", type: "审稿要求", category: "全部", description: "检查动机、因果、信息差和节奏，给出可执行修改。", content: "逐段检查输入章节。分别指出人物动机、事件因果、视角信息、时间空间、冲突强度和章末钩子的问题。每个问题引用简短定位语句，并给出一条可以直接改写的方案。", uses: 0, favorite: false, owned: false, updatedAt: "2026-08-01" },
  { id: "seed-dialogue", title: "人物对白润色", type: "扩写要求", category: "短篇", description: "让对白体现身份、关系和未说出口的意图。", content: "润色输入片段中的对白。保留情节事实，让每个人的措辞符合身份和当下目的，用动作和停顿承载潜台词，删除解释性复述。输出润色后的完整片段。", uses: 0, favorite: false, owned: false, updatedAt: "2026-08-01" },
];

