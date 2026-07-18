export interface CoverTemplateDefinition {
  id: string;
  name: string;
  compositionRule: string;
  titleLayout: string;
  subtitleLayout: string;
  plainHint: string;
}

export const coverTemplates: CoverTemplateDefinition[] = [
  {
    id: "cinematic-poster",
    name: "电影海报感",
    compositionRule: "爆款海报构图法（区别于叙事分镜）：主体醒目且为画面最亮处，背景可用与主题相关的元素虚化环绕（叙事蒙太奇感，压暗不抢主体），整体色调统一、明暗层次分明，中部留出相对干净或可压暗的区域（标题文字区，标题排画面正中而非顶部）",
    titleLayout: "整体按电影海报式排版：主标题「{{TITLE}}」以超大号、粗壮有力的中文艺术字水平横排在画面正中央（垂直方向居中）的视觉焦点位置，严禁竖排、竖向排列或逐字错位斜排，所有字必须在同一水平行上从左到右排列；严禁贴着画面顶部边缘，标题上方必须留出约四分之一画面高度的画面内容（加粗书法笔触或厚重无衬线字体，字色与背景强对比——白字配深色描边或暖金色大字，有专业海报设计感，不是普通印刷体）",
    subtitleLayout: "主标题正下方排副标题{{SUBTITLE}}（每句一行居中，字号约为主标题的二分之一，必须足够醒目——手机信息流缩略图下也清晰可读，严禁小到看不清；字体设计与主标题协调统一：同样的海报字处理——白字配深色描边或半透明色带衬底，挺拔利落有设计感，与主标题像同一张专业海报的一套字体系统，不是普通印刷体）",
    plainHint: "画面中部保持相对干净简洁（后期叠加标题文字用），画面中不出现任何文字",
  },
  {
    id: "minimal-clean",
    name: "极简留白",
    compositionRule: "极简海报构图法：画面元素极度精简，只保留一个视觉重点，大面积留白或纯净背景，配色克制（两三种以内），画面正中或上半部留出充足的干净区域给标题，整体安静、高级、有设计感，避免任何杂乱元素",
    titleLayout: "极简排版：主标题「{{TITLE}}」用简洁利落的中等粗细无衬线中文字，水平横排居中于画面留白区，字号适中不夸张，字色与纯净背景柔和对比（深色字配浅背景或反之），留白充足、克制高级，不要厚重描边或花哨效果",
    subtitleLayout: "主标题下方一行排副标题{{SUBTITLE}}（居中，字号约主标题的一半，同样简洁字体，颜色比主标题略淡，保持极简统一）",
    plainHint: "画面保持极简纯净、大量留白，画面中不出现任何文字",
  },
  {
    id: "portrait-emotion",
    name: "人物情绪",
    compositionRule: "情绪海报构图法：以人物为绝对主体，靠面部或肢体语言传递强烈情绪，浅景深虚化背景突出人物，光线塑造情绪，人物上方或一侧留出可压暗区域放标题，整体有强代入感和故事感",
    titleLayout: "情感海报排版：主标题「{{TITLE}}」用有温度的粗体中文字，水平横排置于人物上方或下方的视觉焦点处（不贴顶，上方留出画面内容），字色与背景强对比、醒目但不抢人物（白字深描边或暖色大字），有电影质感",
    subtitleLayout: "主标题下方排副标题{{SUBTITLE}}（每句一行居中，字号约主标题一半，清晰可读，字体与主标题统一协调）",
    plainHint: "画面聚焦人物情绪、背景虚化留白，画面中不出现任何文字",
  },
  {
    id: "typographic-impact",
    name: "文字冲击",
    compositionRule: "文字冲击海报构图法：标题文字是绝对主视觉，占画面四到六成，背景图退为低饱和或压暗衬底烘托气氛不抢戏，整体高对比、强冲击，第一眼先看到字，适合观点、悬念、反转类内容",
    titleLayout: "冲击式排版：主标题「{{TITLE}}」用极粗、超大号的中文黑体或书法字水平横排占据画面中心主视觉位置，字号尽可能大、撑满主区域，强描边或色块衬底保证极致醒目，字色与背景形成强烈对比，第一眼抓人",
    subtitleLayout: "主标题上方或下方排副标题{{SUBTITLE}}（每句一行居中，字号约主标题三分之一到一半，醒目清晰，与主标题同一套字体风格）",
    plainHint: "画面保留低饱和压暗的衬底氛围、中部留干净区，画面中不出现任何文字",
  },
  {
    id: "guofeng-poster",
    name: "国风古韵",
    compositionRule: "国风海报构图法：讲究意境与留白（计白当黑），主体居中或遵循传统构图，古典元素点缀但不杂乱，色调古雅统一，中部或一侧留出题字区，整体有书卷气与东方美学",
    titleLayout: "国风题字排版：主标题「{{TITLE}}」用毛笔书法字体（行楷、隶书或魏碑感），笔力遒劲、墨色浓厚，置于画面视觉焦点处（横排居中为主，留出上方画面内容不贴顶），可配朱红印章点缀，与古典画面气韵统一，典雅大气",
    subtitleLayout: "主标题下方排副标题{{SUBTITLE}}（每句一行，字号约主标题一半，同为书法字体、墨色协调，排列工整有古韵）",
    plainHint: "画面保持古典意境与留白，中部留出题字区，画面中不出现任何文字",
  },
  {
    id: "legend-portrait",
    name: "人物传奇",
    compositionRule: "人物传奇海报构图法：深色厚重背景，人物用黑白或低饱和老照片质感的半身像置于画面一侧，另一侧大面积留出深色题字区给超大标题，人物与文字明确分区互不遮挡，光影集中在人物面部，整体怀旧、高级、有岁月传奇感",
    titleLayout: "人物传奇式排版：主标题「{{TITLE}}」用超大号、笔力遒劲的中文书法体或厚重黑体，可沿画面一侧竖排（多字时分两列竖排）或横排，按构图选最有冲击力的方向；字色为醒目的暖金或烫金质感配深色描边或发光，压在深色题字区形成强对比，字号撑满题字区、第一眼抓人",
    subtitleLayout: "副标题{{SUBTITLE}}用白色挺拔中文字横排（每句一行从左到右，字号约为主标题的一半、足够大且醒目）排在主标题下方或人物上方；在画面底部用暖金或暗红色块衬底再排一句金句标语收口，形成主标题、副标题、底部金句的三层信息层级",
    plainHint: "深色厚重背景、黑白人物半身像置于一侧、另一侧留出深色题字区，画面中不出现任何文字",
  },
];

const legacyTemplateAliases: Record<string, string> = {
  editorial: "typographic-impact",
  minimal: "minimal-clean",
};

export function getCoverTemplate(id?: string): CoverTemplateDefinition {
  const normalizedId = id ? legacyTemplateAliases[id] || id : "cinematic-poster";
  return coverTemplates.find((template) => template.id === normalizedId) || coverTemplates[0];
}

interface CoverPromptInput {
  corePrompt: string;
  title: string;
  subtitles?: string[];
  mode: "titled" | "plain";
  templateId?: string;
}

export function buildCoverImagePrompt({ corePrompt, title, subtitles = [], mode, templateId }: CoverPromptInput): { prompt: string; negativePrompt: string } {
  const template = getCoverTemplate(templateId);
  const cleanCorePrompt = corePrompt
    .replace(/。画面中避免出现[:：][\s\S]*$/u, "")
    .trim();
  const cleanTitle = title.trim();
  const cleanSubtitles = subtitles.map((item) => item.trim()).filter(Boolean);
  const layout = mode === "titled" && cleanTitle
    ? `，${template.titleLayout.replace("{{TITLE}}", cleanTitle)}${cleanSubtitles.length && template.subtitleLayout ? `；${template.subtitleLayout.replace("{{SUBTITLE}}", cleanSubtitles.map((item) => `「${item}」`).join(""))}` : ""}；文字区域背景做轻微压暗或半透明渐变衬底处理保证文字浮出可读（专业海报的字底层次感）；所有文字必须与提供的文案完全一致，笔画完整、清晰可读、无错字、不变形、不增减字`
    : `，${template.plainHint}`;
  return {
    prompt: `${template.compositionRule}，${cleanCorePrompt}${layout}`,
    negativePrompt: mode === "titled"
      ? "水印，品牌标志，低清晰度，畸形人物，除指定标题与副标题外的多余文字，错别字，漏字，文字变形"
      : "文字，水印，品牌标志，低清晰度，畸形人物",
  };
}
