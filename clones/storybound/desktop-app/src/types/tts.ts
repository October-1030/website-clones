export type TtsProvider = "volcengine" | "minimax";
export type VolcengineVersion = "2.0" | "1.0";
export type MinimaxModel = "speech-2.8-hd" | "speech-2.8-turbo";

export interface TtsVoice {
  id: string;
  name: string;
  tag: string;
  provider: TtsProvider;
  version?: VolcengineVersion;
  cloned?: boolean;
}

export interface TtsConfig {
  provider: TtsProvider;
  volcengine: {
    appId: string;
    accessToken: string;
    version: VolcengineVersion;
    voiceId: string;
  };
  minimax: {
    apiKey: string;
    model: MinimaxModel;
    voiceId: string;
    clonedVoices: TtsVoice[];
  };
}

export interface TtsCredentialStatus {
  minimax: {
    available: boolean;
    source: string | null;
  };
  volcengine: {
    available: boolean;
    source: string | null;
  };
}

export interface VoiceLabResult {
  id: string;
  fileName: string;
  audioUrl: string;
  voiceName: string;
  speed: number;
  createdAt: string;
  text: string;
  segments: number;
  bytes: number;
}
