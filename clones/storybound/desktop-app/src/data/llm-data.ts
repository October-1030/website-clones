import type { LlmConfig, LlmProvider } from "../types/llm";

export const llmProviderOptions: Array<{
  value: LlmProvider;
  name: string;
  description: string;
  baseUrl: string;
  model: string;
}> = [
  {
    value: "minimax",
    name: "MiniMax",
    description: "同一 API 可用于文案、出图和配音",
    baseUrl: "https://api.minimaxi.com/v1",
    model: "MiniMax-M2.7",
  },
  {
    value: "deepseek",
    name: "DeepSeek",
    description: "中文改写性价比高",
    baseUrl: "https://api.deepseek.com/v1",
    model: "deepseek-chat",
  },
  {
    value: "openai",
    name: "OpenAI",
    description: "通用稳定",
    baseUrl: "https://api.openai.com/v1",
    model: "gpt-4.1-mini",
  },
  {
    value: "siliconflow",
    name: "硅基流动",
    description: "OpenAI 兼容接口",
    baseUrl: "https://api.siliconflow.cn/v1",
    model: "Qwen/Qwen3-32B",
  },
  {
    value: "custom",
    name: "自定义",
    description: "任意 OpenAI 兼容服务",
    baseUrl: "",
    model: "",
  },
];

export const defaultLlmConfig: LlmConfig = {
  provider: "minimax",
  apiKey: "",
  baseUrl: "https://api.minimaxi.com/v1",
  model: "MiniMax-M2.7",
};
