export const ACCOUNT_SETTINGS_STORAGE_KEY = "studypal.account-settings.v1";

export interface LocalAccountSettings {
  version: 1;
  username: string;
  preferredLanguage: "auto" | "en" | "zh-CN";
  tone: "clear" | "concise" | "encouraging";
  learningStyles: Array<"examples" | "step-by-step" | "visual" | "practice">;
  memoryEnabled: boolean;
  updatedAt: string;
}

export const defaultAccountSettings: LocalAccountSettings = {
  version: 1,
  username: "Elv",
  preferredLanguage: "auto",
  tone: "clear",
  learningStyles: ["step-by-step"],
  memoryEnabled: true,
  updatedAt: new Date(0).toISOString(),
};

export function loadAccountSettings(storage: Pick<Storage, "getItem">): LocalAccountSettings {
  const raw = storage.getItem(ACCOUNT_SETTINGS_STORAGE_KEY);
  if (!raw) return defaultAccountSettings;
  try {
    const value = JSON.parse(raw) as Partial<LocalAccountSettings>;
    if (value.version !== 1 || typeof value.username !== "string") return defaultAccountSettings;
    return {
      ...defaultAccountSettings,
      ...value,
      username: value.username.trim().slice(0, 40) || defaultAccountSettings.username,
      learningStyles: Array.isArray(value.learningStyles) ? value.learningStyles.slice(0, 2) as LocalAccountSettings["learningStyles"] : defaultAccountSettings.learningStyles,
    };
  } catch {
    return defaultAccountSettings;
  }
}

export function saveAccountSettings(storage: Pick<Storage, "setItem">, settings: LocalAccountSettings): void {
  storage.setItem(ACCOUNT_SETTINGS_STORAGE_KEY, JSON.stringify(settings));
}
