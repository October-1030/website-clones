export const openingPresets = [
  { id: "first", name: "黄金第一章", description: "人物登场 · 核心冲突 · 章末悬念", instruction: "写出完整第一章。开场即呈现具体困境，通过行动和对话建立主角性格，在章末留下明确的未解冲突。" },
  { id: "three", name: "黄金前三章", description: "建立期待 · 冲突升级 · 首次兑现", instruction: "写出连续的前三章，每章有独立标题。第一章建立主角目标和困境；第二章升级代价；第三章兑现一次小胜利，同时打开更大的矛盾。" },
  { id: "suspense", name: "悬疑开篇", description: "异常事件 · 可见线索 · 认知反转", instruction: "写出悬疑故事第一章。从一个异常事件开始，布置可回溯的具体线索，通过有限视角制造信息差，结尾用新事实改变读者判断。" },
  { id: "romance", name: "言情开篇", description: "人物关系 · 情感张力 · 命运交汇", instruction: "写出言情故事第一章。用有具体利益冲突的相遇呈现两位角色，展示各自欲望和边界，让感情张力从行为细节中产生。" },
] as const;

export type WritingLanguage = "zh" | "en";

export function formatWritingLength(count: number, language: WritingLanguage = "zh"): string {
  return `${count} ${language === "en" ? "words" : "字"}`;
}

export function countWritingUnits(text: string, language: WritingLanguage = "zh"): number {
  return language === "en" ? (text.match(/[\p{L}\p{N}]+(?:['’\-][\p{L}\p{N}]+)*/gu)?.length ?? 0) : text.replace(/\s/g, "").length;
}

export function buildWritingSystemPrompt(task: "opening" | "tool", language: WritingLanguage): string {
  if (language === "en") return `${task === "opening" ? "You write original English fiction." : "You are an English-language creative writing assistant."} Follow the requested task and format. Write all prose, dialogue, headings and explanations in natural English, even when the source material or task template is in Chinese. Count target length in English words, not characters.`;
  return task === "tool" ? "你是一位中文创作助手，严格按用户提供的任务和输出格式处理内容。输出语言为中文。" : "你是一位中文小说写作助手，按用户提供的设定创作原创小说正文。输出语言为中文。";
}

export interface OpeningInput {
  title: string;
  theme: string;
  setting: string;
  tags: string;
  genre: string;
  ability: string;
  protagonist: string;
  extra: string;
  preset: string;
  customPrompt: string;
  useCustom: boolean;
  words: number;
  language: WritingLanguage;
  context: string;
}

export const defaultOpening: OpeningInput = {
  title: "", theme: "", setting: "", tags: "", genre: "", ability: "",
  protagonist: "", extra: "", preset: "first", customPrompt: "", useCustom: false,
  words: 2000, language: "zh", context: "",
};

export function validateOpening(value: unknown): OpeningInput {
  if (!value || typeof value !== "object") throw new Error("请填写故事设定。");
  const source = value as Record<string, unknown>;
  const limits = { title: 30, theme: 500, setting: 500, tags: 500, genre: 500, ability: 500, protagonist: 500, extra: 1000, preset: 30, customPrompt: 30000, context: 6000 };
  const result = { ...defaultOpening };
  for (const [key, limit] of Object.entries(limits)) {
    const field = key as keyof typeof limits;
    const text = source[field];
    if (typeof text !== "string" || text.length > limit) throw new Error("故事设定格式有误，或内容超过字数限制。");
    result[field] = text.trim();
  }
  if (!result.theme) throw new Error("请填写故事主题。");
  if (!openingPresets.some(preset => preset.id === result.preset)) throw new Error("请选择开篇方案。");
  if (typeof source.useCustom !== "boolean") throw new Error("请选择提示词模式。");
  result.useCustom = source.useCustom;
  if (result.useCustom && !result.customPrompt) throw new Error("请填写自定义提示词。");
  if (typeof source.words !== "number" || ![1000, 2000, 3000, 6000].includes(source.words)) throw new Error("请选择有效的目标字数。");
  result.words = source.words;
  if (source.language !== undefined && source.language !== "zh" && source.language !== "en") throw new Error("请选择有效的输出语言。");
  result.language = source.language === "en" ? "en" : "zh";
  return result;
}

export function buildOpeningPrompt(input: OpeningInput): string {
  const preset = openingPresets.find(item => item.id === input.preset) ?? openingPresets[0];
  if (input.language === "en") {
    const instructions: Record<string, string> = {
      first: "Write a complete first chapter. Open with a concrete predicament, establish the protagonist through action and dialogue, and end with an unresolved conflict.",
      three: "Write the first three consecutive chapters, each with its own title. Establish the protagonist's goal and predicament in chapter one, raise the cost in chapter two, then deliver a small victory and introduce a larger conflict in chapter three.",
      suspense: "Write the first chapter of a mystery. Start with an unusual incident, plant specific fair-play clues, use a limited viewpoint to create tension, and end with a discovery that changes the reader's interpretation.",
      romance: "Write the first chapter of a romance. Bring the two leads together through a concrete clash of interests, establish their desires and boundaries, and build emotional tension through behavior and subtext.",
    };
    const fields = [
      ["Working title", input.title], ["Theme", input.theme], ["Setting", input.setting],
      ["Tags", input.tags], ["Genre", input.genre], ["Special abilities and limits", input.ability],
      ["Protagonist and core conflict", input.protagonist], ["Additional requirements", input.extra],
    ].filter(([, value]) => value.trim()).map(([label, value]) => `${label}: ${value}`).join("\n");
    return `Write an original novel opening in English based on the following brief.\n\n${input.useCustom ? input.customPrompt : instructions[preset.id]}\n\n${fields}\n\nTarget total length: approximately ${input.words} English words across all chapters.\nKeep character motivations, world rules and cause and effect consistent. Advance the story through action, dialogue and sensory detail instead of exposition. Use idiomatic English narration and dialogue. Output only English chapter titles and novel prose, without analysis, writing advice or a Chinese translation.${input.context ? `\n\nReference material for continuity only; do not copy it:\n<reference>\n${input.context}\n</reference>` : ""}`;
  }
  const fields = [
    ["书名", input.title], ["主题", input.theme], ["故事背景", input.setting],
    ["标签", input.tags], ["流派", input.genre], ["金手指或特殊能力", input.ability],
    ["主角人设与核心情节", input.protagonist], ["补充信息", input.extra],
  ].filter(([, value]) => value.trim()).map(([label, value]) => `${label}：${value}`).join("\n");
  return `请根据以下设定创作中文小说开篇。\n\n${input.useCustom ? input.customPrompt : preset.instruction}\n\n${fields}\n\n目标总字数：约 ${input.words} 字（所有章节合计）。\n保持人物动机、世界规则和因果关系一致。避免用设定说明代替情节；用具体动作、对话和感官细节推进。只输出章节标题与小说正文，不输出分析、写作建议或说明。${input.context ? `\n\n以下是参考资料，仅用于保持设定一致，请勿照抄：\n<reference>\n${input.context}\n</reference>` : ""}`;
}

export function buildToolPrompt(input: OpeningInput): string {
  if (input.language === "en") return `${input.customPrompt}\n\nOutput language: English. Write every part of the requested result in natural English, including headings and dialogue, even if the task template or source material uses another language.\nTarget length: approximately ${input.words} English words. Follow the requested task format and do not repeat the instructions.${input.context ? `\n\nRelated work, for context only:\n<reference>\n${input.context}\n</reference>` : ""}`;
  return `${input.customPrompt}\n\n目标输出长度：约 ${input.words} 字。以任务要求的格式输出，不要复述指令。${input.context ? `\n\n以下是关联作品的参考资料，请仅用作上下文：\n<reference>\n${input.context}\n</reference>` : ""}`;
}
