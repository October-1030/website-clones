export interface AIToolDefinition {
  name: string;
  description: string;
  inputLabel: string;
  inputHint: string;
  instruction: string;
  defaultWords: number;
}

export const aiTools: AIToolDefinition[] = [
  { name: "封面生成器", description: "提炼封面画面与排版提示词", inputLabel: "作品信息", inputHint: "题材、书名、主角、核心冲突、希望的画面风格……", instruction: "为小说设计三套可直接用于绘图模型的中文封面提示词。每套包含主体、构图、光线、色彩、字体排版和负面提示词。", defaultWords: 1000 },
  { name: "脑洞生成器", description: "生成有冲突、有卖点的故事脑洞", inputLabel: "创作方向", inputHint: "题材、受众、平台、想保留的元素和需要避开的套路……", instruction: "生成五个原创故事脑洞。每个脑洞包含一句话卖点、主角困境、核心机制、升级路线和首个强冲突。", defaultWords: 2000 },
  { name: "书名生成器", description: "按题材生成并筛选书名", inputLabel: "作品设定", inputHint: "题材、男女频、主角身份、核心卖点、书名偏好……", instruction: "生成三组共三十个原创中文小说书名，分为直给型、悬念型和意象型，并点评每组最强的三个。", defaultWords: 1000 },
  { name: "书名测试", description: "批量评估书名的辨识度与点击力", inputLabel: "候选书名", inputHint: "每行一个候选书名，并补充题材与目标读者……", instruction: "从题材识别度、记忆点、口语传播、情绪承诺、同质化风险五个维度逐一评分，给出排序和改名建议。", defaultWords: 1000 },
  { name: "简介生成器", description: "生成有悬念和阅读承诺的简介", inputLabel: "故事信息", inputHint: "主角、世界背景、核心冲突、金手指、最大看点……", instruction: "生成三版小说简介：剧情钩子版、人物关系版、强情绪版。避免空泛口号，不提前泄露结局。", defaultWords: 1000 },
  { name: "大纲生成器", description: "搭建完整故事阶段与主线", inputLabel: "故事设定", inputHint: "题材、主角目标、世界规则、反派、预计篇幅……", instruction: "生成可执行的长篇故事大纲，包含开局、发展、转折、高潮、收束，各阶段给出目标、阻力、关键事件和伏笔回收。", defaultWords: 3000 },
  { name: "细纲生成器", description: "把阶段剧情拆成连续章节", inputLabel: "大纲或剧情方向", inputHint: "粘贴大纲，说明要细化的章节范围和每章字数……", instruction: "将输入拆成连续十章细纲。每章包含标题、场景目标、冲突、人物行动、信息变化和章末钩子，保证因果衔接。", defaultWords: 3000 },
  { name: "金手指生成器", description: "设计能力、限制、代价与成长", inputLabel: "主角和世界设定", inputHint: "主角身份、题材、世界规则、希望的爽点和禁区……", instruction: "设计五套金手指方案，每套包含能力规则、首次获得、限制代价、升级方式、可制造的冲突和防崩机制。", defaultWords: 2000 },
  { name: "名字生成器", description: "生成人物、地点、势力与物品名", inputLabel: "命名需求", inputHint: "时代、文化、题材、需要的名称类型和数量……", instruction: "按输入生成有统一文化语感的名称清单，分人物、地点、势力、物品四类，并解释关键名字的含义。", defaultWords: 1000 },
  { name: "人设生成器", description: "构建能推动剧情的人物档案", inputLabel: "人物方向", inputHint: "角色定位、年龄、身份、目标、与主角的关系……", instruction: "生成完整人物卡：外在目标、内在需求、恐惧、谎言、能力、缺陷、秘密、关系张力、语言习惯和人物弧。", defaultWords: 2000 },
  { name: "世界观生成器", description: "建立一致的规则、势力与矛盾", inputLabel: "世界方向", inputHint: "时代、地理、力量体系、社会结构、故事规模……", instruction: "生成可写作的世界观文档，涵盖核心规则、地理、势力、资源、社会秩序、力量体系、历史矛盾和当前危机。", defaultWords: 3000 },
  { name: "词条生成器", description: "生成道具、技能、功法和设定词条", inputLabel: "词条需求", inputHint: "词条类别、品级、使用者、作用、限制……", instruction: "生成结构化设定词条，包含名称、分类、外观、来源、功能、规则、限制、代价和剧情用途。", defaultWords: 1000 },
  { name: "小说转剧本", description: "把小说片段转换为可拍摄剧本", inputLabel: "小说正文", inputHint: "粘贴要改编的正文，并说明短剧、真人剧或动态漫……", instruction: "将输入改编为分场剧本，使用场次、内外景、时间、人物、动作、对白和必要旁白格式。保留核心冲突，删除不可视化叙述。", defaultWords: 3000 },
  { name: "剧本医生", description: "诊断剧本并给出可执行改稿", inputLabel: "剧本内容", inputHint: "粘贴剧本或分集梗概，说明目标时长和受众……", instruction: "从开场钩子、人物动机、冲突密度、信息节奏、对白、可视化和集尾卡点诊断剧本，按优先级给出具体改稿方案和示例。", defaultWords: 2000 },
  { name: "剧本脑洞生成器", description: "生成适合镜头呈现的高概念故事", inputLabel: "剧本方向", inputHint: "类型、集数、受众、制作规模、希望的核心冲突……", instruction: "生成五个原创剧本脑洞，每个包含一句话高概念、主角困境、视觉奇观、关系冲突、分集推动力和结局方向。", defaultWords: 2000 },
  { name: "剧名生成器", description: "生成辨识度高、便于传播的剧名", inputLabel: "剧本设定", inputHint: "类型、核心人物、冲突、受众、剧名偏好……", instruction: "生成三组共三十个原创剧名，分别突出类型、人物关系和悬念，并点评最适合传播的候选。", defaultWords: 1000 },
  { name: "剧本简介生成器", description: "生成适合项目介绍和观众阅读的简介", inputLabel: "剧本信息", inputHint: "人物、背景、主线、核心冲突、独特卖点……", instruction: "生成项目梗概、观众简介和一句话卖点三种版本。突出可视化冲突和人物选择，避免空泛口号。", defaultWords: 1000 },
  { name: "剧本大纲生成器", description: "构建完整分集架构", inputLabel: "剧本设定", inputHint: "类型、集数、单集时长、人物、主线与结局……", instruction: "生成完整剧本大纲，包含人物关系、总主线、阶段转折和逐集目标。每集写明冲突、变化和结尾卡点。", defaultWords: 3000 },
  { name: "剧本细纲生成器", description: "拆解到场景和节拍", inputLabel: "剧本大纲", inputHint: "粘贴大纲，说明要细化的集数和单集时长……", instruction: "将输入拆为分场细纲。每场注明内外景、时间、人物、目标、动作冲突、信息变化和转场方式。", defaultWords: 3000 },
  { name: "剧本开篇生成器", description: "生成开幕即进入冲突的剧本", inputLabel: "剧本设定", inputHint: "类型、主角、开场事件、目标时长、制作限制……", instruction: "写出剧本开篇，采用标准分场格式。前两场建立人物处境和核心异常，迅速形成可视化冲突，并以强选择推进下一场。", defaultWords: 2000 },
  { name: "剧本金手指生成器", description: "设计能持续制造剧情的独特机制", inputLabel: "主角与类型", inputHint: "主角身份、剧本类型、能力方向、希望的视觉效果……", instruction: "设计五套适合影视呈现的特殊机制，每套包含规则、视觉表现、限制代价、升级方式和能推动分集冲突的用法。", defaultWords: 2000 },
  { name: "剧本世界观生成器", description: "建立适合拍摄和连续叙事的世界规则", inputLabel: "世界方向", inputHint: "时代、地域、类型、社会规则、制作规模……", instruction: "生成剧本世界观，覆盖核心规则、主要场景、势力、资源、社会矛盾和视觉母题，并标注低成本可视化方案。", defaultWords: 3000 },
  { name: "对标脑洞", description: "拆解参考作品结构后生成原创方向", inputLabel: "参考脑洞与新题材", inputHint: "粘贴参考梗概，并说明必须改动的题材、人物和规则……", instruction: "只提炼参考内容的抽象吸引力、冲突结构和情绪承诺，再生成五个角色、设定、事件均原创的新脑洞。列出相似风险并主动规避具体表达。", defaultWords: 2000 },
  { name: "对标书名", description: "提炼标题结构并生成原创书名", inputLabel: "参考书名与作品设定", inputHint: "列出参考书名，再说明自己的题材、主角和卖点……", instruction: "分析参考书名的句式、节奏和阅读承诺，不复用专有名词或独特短语。为新设定生成三十个原创书名并分组点评。", defaultWords: 1000 },
  { name: "对标简介", description: "拆解简介节奏并重写原创版本", inputLabel: "参考简介与原创设定", inputHint: "粘贴参考简介，再写自己的角色、冲突和世界设定……", instruction: "分析参考简介的开场方式、信息顺序和悬念结构，不复制句子和情节。基于原创设定生成三版全新简介。", defaultWords: 1000 },
  { name: "AI写作", description: "根据当前章节方向创作正文", inputLabel: "章节内容与要求", inputHint: "输入章节目标、已有正文或要发生的事件……", instruction: "根据输入写出完整中文小说章节。用人物行动和对话推进冲突，遵守已有设定，只输出章节标题和正文。", defaultWords: 2000 },
  { name: "AI扩写润色", description: "保留事实并增强场景表现", inputLabel: "待扩写正文", inputHint: "粘贴需要扩写或润色的正文……", instruction: "在不改变关键事实和人物意图的前提下润色输入正文，补足必要的动作、对话和环境反馈，删除重复解释。只输出改写后的完整正文。", defaultWords: 2000 },
  { name: "AI续写正文", description: "承接人物目标和未完成冲突续写", inputLabel: "前文", inputHint: "粘贴前文，并可在补充要求里说明后续方向……", instruction: "续写输入正文。先保持人物状态、视角和语言风格一致，再由前文事件自然触发新的阻力与选择，以明确的章末变化结束。只输出续写正文。", defaultWords: 2000 },
  { name: "章纲", description: "把剧情方向拆成可执行章节计划", inputLabel: "现有剧情与目标", inputHint: "输入前文概要、人物状态和后续方向……", instruction: "生成连续十章章纲。每章包含标题、人物目标、核心冲突、关键行动、信息变化和章末钩子，保证前后因果衔接。", defaultWords: 3000 },
  { name: "AI拆书", description: "提炼文本的结构、节奏和技法", inputLabel: "待分析文本", inputHint: "粘贴章节或故事梗概……", instruction: "分析输入文本的开场钩子、人物欲望、冲突升级、信息控制、情绪兑现和章末推动力。只提炼抽象方法，不生成模仿原文的内容。", defaultWords: 2000 },
  { name: "AI审稿", description: "检查逻辑、人物、节奏和阅读体验", inputLabel: "待审正文", inputHint: "粘贴需要审稿的章节……", instruction: "逐项审查人物动机、事件因果、设定一致性、视角、节奏、对白和章末钩子。按严重程度列出定位、原因和可直接执行的修改建议。", defaultWords: 2000 },
  { name: "AI纠错", description: "校正错别字、病句和标点", inputLabel: "待纠错正文", inputHint: "粘贴需要校对的文本……", instruction: "校正错别字、病句、标点、数字和专名不一致。保留原意与文风，直接输出校正后的完整文本，再附极短修改说明。", defaultWords: 2000 },
  { name: "AI去痕", description: "减少模板化和重复表达", inputLabel: "待优化正文", inputHint: "粘贴需要自然化的正文……", instruction: "改写输入文本中机械排比、空泛总结、重复转折和过度解释，让句式随情境变化。保留剧情事实和人物语气，只输出优化后的完整正文。", defaultWords: 2000 },
  { name: "剧本改编", description: "把当前章节转换为分场剧本", inputLabel: "小说章节", inputHint: "粘贴需要改编的章节……", instruction: "把输入章节改编成分场剧本，标明场次、内外景、时间、人物、动作、对白和必要旁白，把心理活动转换成可见行为。", defaultWords: 3000 },
  { name: "生成章节概要", description: "提炼事件与角色状态变化", inputLabel: "章节正文", inputHint: "粘贴章节正文……", instruction: "用精炼中文提炼本章发生的事件、角色状态变化、新增信息、埋设或回收的伏笔，以及下一章必须承接的内容。", defaultWords: 1000 },
  { name: "批量生成章节概要", description: "为缺少概要的章节生成可回填摘要", inputLabel: "待整理章节", inputHint: "系统会按S编号整理需要生成概要的章节……", instruction: "严格遵守输入要求，只输出每章一行的S编号｜概要。概要语言跟随正文，保留人物状态、因果、新信息、伏笔与章末承接点。", defaultWords: 3000 },
  { name: "剧情一致性检查", description: "检查整书人物、时间线、规则与伏笔冲突", inputLabel: "作品上下文", inputHint: "系统会整理作品设定、章节概要和最近正文……", instruction: "基于输入证据检查人物状态、事件因果、时间线、地点、规则、物品、专名与伏笔的一致性。按严重程度列出章节定位、证据、问题和最小修改方案；证据不足时标记待确认。", defaultWords: 3000 },
  { name: "AI 章节起名", description: "根据章节核心变化生成标题", inputLabel: "章节正文", inputHint: "粘贴章节正文……", instruction: "根据章节最关键的冲突、意象或变化生成二十个原创标题，分为直给、悬念、意象三组，并推荐最合适的一个。", defaultWords: 1000 },
  { name: "章节配图", description: "提炼场景并生成绘图提示词", inputLabel: "章节正文", inputHint: "粘贴需要配图的章节……", instruction: "从章节中挑选三个最适合插图的视觉场景。每个场景提供画面描述、构图、人物姿态、环境、光线、色彩、风格和负面提示词。", defaultWords: 1000 },
  { name: "AI生成角色", description: "从作品方向生成角色卡", inputLabel: "作品与角色方向", inputHint: "输入题材、角色定位和与主角的关系……", instruction: "生成可直接保存的角色卡，包含姓名、性别、性格、背景、外貌、欲望、恐惧、秘密、能力缺陷和关系张力。", defaultWords: 2000 },
  { name: "AI整理备忘录", description: "把零散内容整理成清晰笔记", inputLabel: "备忘录内容", inputHint: "粘贴需要整理的笔记……", instruction: "整理输入笔记，保留所有事实，按标题、要点、待办、疑问和关联设定重组，删除重复但不添加未经输入支持的信息。", defaultWords: 2000 },
  { name: "AI生成角色图片", description: "生成角色立绘绘图提示词", inputLabel: "角色资料", inputHint: "输入角色外貌、身份、性格和世界背景……", instruction: "生成三套角色立绘提示词，包含外貌、服装、姿态、表情、道具、背景、光线、风格和负面提示词。", defaultWords: 1000 },
  { name: "识别角色外貌", description: "从角色资料提炼可见特征", inputLabel: "角色资料", inputHint: "粘贴角色设定或图片识别文字……", instruction: "只提炼角色可见外貌：年龄感、体态、面部、发型、服装、饰品、姿态和辨识特征，输出可直接写入角色卡的简洁段落。", defaultWords: 1000 },
  { name: "AI生成", description: "为当前资料类型生成结构化内容", inputLabel: "资料方向", inputHint: "输入题材、用途和需要遵守的设定……", instruction: "根据输入生成结构清晰、可直接保存到创作资料库的中文内容。避免空泛描述，明确规则、限制和剧情用途。", defaultWords: 2000 },
  { name: "智能识别", description: "从输入内容识别可复用设定", inputLabel: "待识别内容", inputHint: "粘贴正文、设定或零散笔记……", instruction: "从输入中识别人物、术语、规则和待办信息，按类别输出，严格基于原文，不补充没有依据的事实。", defaultWords: 2000 },
];

export function findAITool(name: string): AIToolDefinition {
  return aiTools.find(tool => tool.name === name) ?? {
    name,
    description: "按要求完成创作任务",
    inputLabel: "创作要求",
    inputHint: "输入素材、目标和限制……",
    instruction: `完成“${name}”任务，输出可直接使用的中文内容。`,
    defaultWords: 2000,
  };
}
