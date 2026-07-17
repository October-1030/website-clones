import type { DraftTemplateDefinition } from "../types/draft-template";

export const draftTemplates: DraftTemplateDefinition[] = [
  {
    id: "default-portrait-9-16",
    name: "默认竖屏",
    config: {
      canvas: { width: 1080, height: 1920, ratio: "9:16", backgroundColor: "#000000", backgroundImage: "" },
      image: { ratio: "9:16", fit: "cover", top: 0, height: 1, animation: "缩放", motionStrength: 1 },
      title: { visible: true, x: 0, y: 0.04739583333333333, fontSize: 25, color: "#FFDE00", alpha: 1, bold: true, underline: true, align: 1, letterSpacing: 0, lineSpacing: 0, border: { color: "#000000", width: 40, alpha: 1 } },
      subtitle: { visible: true, x: 0, y: -0.21666666666666667, fontSize: 12, color: "#FFFFFF", alpha: 1, bold: false, underline: false, align: 1, letterSpacing: 2, lineSpacing: 4, border: { color: "#000000", width: 40, alpha: 1 } },
      caption: { visible: true, x: 0, y: -0.21510416666666668, fontSize: 12, color: "#FFDE00", alpha: 1, bold: false, underline: false, align: 1, letterSpacing: 0, lineSpacing: 0, border: { color: "#000000", width: 0, alpha: 0 }, maxCharsPerLine: 12, background: { color: "#000000", alpha: 0.5, roundRadius: 0.3 } },
      disclaimer: { visible: true, x: 0, y: -0.903125, fontSize: 8, color: "#FFFFFF", alpha: 0.26, bold: false, underline: false, align: 1, letterSpacing: 0, lineSpacing: 5, border: { color: "#000000", width: 40, alpha: 1 }, text: "图片由AI生成与网络下载\n科普视频，无不良引导" },
      audio: { narrationVolume: 10, bgmVolume: 3, bgmFadeOutMs: 2000 },
      frame: { enabled: false, headerColor: "#13245e", headerColorEnd: "", footerColor: "#000000", footerColorEnd: "", imageBorderColor: "#f5c518", imageBorderWidth: 6, imageBorderSides: "all" },
    },
  },
  {
    id: "builtin-portrait-4-3",
    name: "竖屏4:3",
    config: {
      canvas: { width: 1080, height: 1920, ratio: "9:16", backgroundColor: "#000000", backgroundImage: "" },
      image: { ratio: "4:3", fit: "cover", top: 0.2890625, height: 0.421875, animation: "缩放" },
      title: { visible: true, x: 0, y: 0.8357783211083945, fontSize: 20, color: "#FFDE00", alpha: 1, bold: true, underline: false, align: 1, letterSpacing: 0, lineSpacing: 0, border: { color: "#000000", width: 40, alpha: 1 } },
      subtitle: { visible: true, x: 0, y: 0.5953125, fontSize: 12, color: "#FFFFFF", alpha: 1, bold: false, underline: false, align: 1, letterSpacing: 2, lineSpacing: 4, border: { color: "#000000", width: 40, alpha: 1 } },
      caption: { visible: true, x: 0, y: -0.5572916666666666, fontSize: 12, color: "#FFDE00", alpha: 1, bold: false, underline: false, align: 1, letterSpacing: 0, lineSpacing: 0, border: { color: "#000000", width: 0, alpha: 0 }, maxCharsPerLine: 12, background: { color: "#000000", alpha: 0.5, roundRadius: 0.3 } },
      disclaimer: { visible: true, x: 0, y: -0.8141628912685337, fontSize: 8, color: "#FFFFFF", alpha: 1, bold: false, underline: false, align: 1, letterSpacing: 0, lineSpacing: 5, border: { color: "#000000", width: 40, alpha: 1 }, text: "图片由AI生成与网络下载\n科普视频，无不良引导" },
      audio: { narrationVolume: 10, bgmVolume: 3, bgmFadeOutMs: 2000 },
      frame: { enabled: false, headerColor: "#13245e", headerColorEnd: "", footerColor: "#000000", footerColorEnd: "", imageBorderColor: "#f5c518", imageBorderWidth: 6, imageBorderSides: "all" },
    },
  },
  {
    id: "builtin-landscape-16-9",
    name: "横屏16:9",
    config: {
      canvas: { width: 1920, height: 1080, ratio: "16:9", backgroundColor: "#000000", backgroundImage: "" },
      image: { ratio: "16:9", fit: "cover", top: 0, height: 1, animation: "缩放" },
      title: { visible: true, x: 0, y: 0.12777777777777777, fontSize: 20, color: "#FFDE00", alpha: 1, bold: true, underline: false, align: 1, letterSpacing: 0, lineSpacing: 0, border: { color: "#000000", width: 40, alpha: 1 } },
      subtitle: { visible: true, x: 0, y: -0.43333333333333335, fontSize: 8, color: "#FFFFFF", alpha: 1, bold: false, underline: false, align: 1, letterSpacing: 2, lineSpacing: 4, border: { color: "#000000", width: 40, alpha: 1 } },
      caption: { visible: true, x: 0, y: -0.6425925925925926, fontSize: 8, color: "#FFDE00", alpha: 1, bold: false, underline: false, align: 1, letterSpacing: 0, lineSpacing: 0, border: { color: "#000000", width: 0, alpha: 0 }, maxCharsPerLine: 12, background: { color: "#000000", alpha: 0.5, roundRadius: 0.3 } },
      disclaimer: { visible: true, x: 0, y: -0.8787037037037037, fontSize: 5, color: "#FFFFFF", alpha: 0.5, bold: false, underline: false, align: 1, letterSpacing: 0, lineSpacing: 5, border: { color: "#000000", width: 40, alpha: 1 }, text: "图片由AI生成与网络下载 科普视频，无不良引导" },
      audio: { narrationVolume: 10, bgmVolume: 3, bgmFadeOutMs: 2000 },
      frame: { enabled: false, headerColor: "#13245e", headerColorEnd: "", footerColor: "#000000", footerColorEnd: "", imageBorderColor: "#f5c518", imageBorderWidth: 6, imageBorderSides: "all" },
    },
  },
  {
    id: "builtin-knowledge-card",
    name: "知识卡（分栏）",
    config: {
      canvas: { width: 1080, height: 1920, ratio: "9:16", backgroundColor: "#0a1430", backgroundImage: "" },
      image: { ratio: "1:1", fit: "cover", top: 0.24, height: 0.5, animation: "", motion: "zoom_in", motionStrength: 1 },
      title: { visible: true, x: 0, y: 0.84, fontSize: 27, color: "#FFFFFF", alpha: 1, bold: true, underline: false, align: 1, letterSpacing: 1, lineSpacing: 0, border: { color: "#000000", width: 0, alpha: 0 } },
      subtitle: { visible: true, x: 0, y: 0.68, fontSize: 27, color: "#FF7A18", alpha: 1, bold: true, underline: false, align: 1, letterSpacing: 1, lineSpacing: 0, border: { color: "#000000", width: 0, alpha: 0 } },
      caption: { visible: true, x: 0, y: -0.78, fontSize: 20, color: "#FFFFFF", alpha: 1, bold: true, underline: false, align: 1, letterSpacing: 0, lineSpacing: 0, border: { color: "#000000", width: 0, alpha: 0 }, maxCharsPerLine: 14, background: { color: "#000000", alpha: 0, roundRadius: 0 } },
      disclaimer: { visible: false, x: 0, y: -0.92, fontSize: 8, color: "#FFFFFF", alpha: 0.4, bold: false, underline: false, align: 1, letterSpacing: 0, lineSpacing: 5, border: { color: "#000000", width: 40, alpha: 1 }, text: "图片由AI生成" },
      audio: { narrationVolume: 10, bgmVolume: 3, bgmFadeOutMs: 2000 },
      frame: { enabled: true, headerColor: "#1e3a8a", headerColorEnd: "#0d1b4a", footerColor: "#000000", footerColorEnd: "", imageBorderColor: "#f5c518", imageBorderWidth: 6, imageBorderSides: "all" },
    },
  },
];

export function draftTemplateById(id: string): DraftTemplateDefinition {
  return draftTemplates.find((template) => template.id === id) ?? draftTemplates[0];
}
