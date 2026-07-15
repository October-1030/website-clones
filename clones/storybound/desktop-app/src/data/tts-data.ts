import type { TtsConfig, TtsVoice } from "../types/tts";

export const volcengineVoices: TtsVoice[] = [
  { id: "zh_male_dongfanghaoran_uranus_bigtts", name: "东方浩然", tag: "沉稳叙述", provider: "volcengine", version: "2.0" },
  { id: "zh_male_xuanyijieshuo_uranus_bigtts", name: "悬疑解说", tag: "纪录片感", provider: "volcengine", version: "2.0" },
  { id: "zh_female_wenrouxiaoya_uranus_bigtts", name: "温柔小雅", tag: "治愈女声", provider: "volcengine", version: "2.0" },
  { id: "zh_female_wenroumama_uranus_bigtts", name: "温柔妈妈", tag: "温柔", provider: "volcengine", version: "2.0" },
  { id: "zh_male_dongfanghaoran_moon_bigtts", name: "东方浩然", tag: "沉稳叙述", provider: "volcengine", version: "1.0" },
  { id: "zh_male_changtianyi_mars_bigtts", name: "悬疑解说", tag: "纪录片感", provider: "volcengine", version: "1.0" },
  { id: "zh_female_wenrouxiaoya_moon_bigtts", name: "温柔小雅", tag: "治愈女声", provider: "volcengine", version: "1.0" },
  { id: "zh_female_shuangkuaisisi_moon_bigtts", name: "爽快思思", tag: "干练", provider: "volcengine", version: "1.0" },
];

export const minimaxVoices: TtsVoice[] = [
  { id: "Chinese (Mandarin)_Reliable_Executive", name: "沉稳高管", tag: "中年男 · 可靠", provider: "minimax" },
  { id: "Chinese (Mandarin)_Stubborn_Friend", name: "嘴硬竹马", tag: "青年男 · 心软", provider: "minimax" },
  { id: "Chinese (Mandarin)_Wise_Women", name: "阅历姐姐", tag: "中年女 · 抒情", provider: "minimax" },
  { id: "Chinese (Mandarin)_Gentle_Senior", name: "温柔学姐", tag: "青年女 · 温暖", provider: "minimax" },
];

export const defaultTtsConfig: TtsConfig = {
  provider: "volcengine",
  volcengine: {
    appId: "",
    accessToken: "",
    version: "2.0",
    voiceId: volcengineVoices[0].id,
  },
  minimax: {
    apiKey: "",
    model: "speech-2.8-hd",
    voiceId: minimaxVoices[0].id,
    clonedVoices: [],
  },
};

export const speedPresets = [
  { label: "慢速", value: 0.85 },
  { label: "默认", value: 1 },
  { label: "快速", value: 1.15 },
  { label: "更快", value: 1.3 },
];
