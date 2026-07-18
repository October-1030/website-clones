export interface DraftTextBorder {
  color: string;
  width: number;
  alpha: number;
}

export interface DraftTextLayer {
  visible: boolean;
  x: number;
  y: number;
  fontSize: number;
  color: string;
  alpha: number;
  bold: boolean;
  underline: boolean;
  align: number;
  letterSpacing: number;
  lineSpacing: number;
  border: DraftTextBorder;
}

export interface DraftCaptionLayer extends DraftTextLayer {
  maxCharsPerLine: number;
  background: {
    color: string;
    alpha: number;
    roundRadius: number;
  };
}

export interface DraftDisclaimerLayer extends DraftTextLayer {
  text: string;
}

export interface DraftTemplateConfig {
  canvas: {
    width: number;
    height: number;
    ratio: string;
    backgroundColor: string;
    backgroundImage: string;
  };
  image: {
    ratio: string;
    fit: string;
    top: number;
    height: number;
    animation?: string | string[];
    motion?: string | string[];
    motionStrength?: number;
  };
  title: DraftTextLayer;
  subtitle: DraftTextLayer;
  caption: DraftCaptionLayer;
  disclaimer: DraftDisclaimerLayer;
  audio: {
    narrationVolume: number;
    bgmVolume: number;
    bgmFadeOutMs: number;
  };
  frame: {
    enabled: boolean;
    headerVisible?: boolean;
    footerVisible?: boolean;
    headerColor: string;
    headerColorEnd: string;
    footerColor: string;
    footerColorEnd: string;
    imageBorderColor: string;
    imageBorderWidth: number;
    imageBorderSides: string;
  };
}

export interface DraftTemplateDefinition {
  id: string;
  name: string;
  config: DraftTemplateConfig;
}
