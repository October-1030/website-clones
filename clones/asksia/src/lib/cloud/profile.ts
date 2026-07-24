export interface CloudProfilePatch {
  displayName?: string;
  preferences?: {
    preferredLanguage: "auto" | "en" | "zh-CN";
    tone: "clear" | "concise" | "encouraging";
    learningStyles: Array<"examples" | "step-by-step" | "visual" | "practice">;
    memoryEnabled: boolean;
  };
}

const allowedStyles = new Set(["examples", "step-by-step", "visual", "practice"]);

export function parseCloudProfilePatch(value: unknown): CloudProfilePatch {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Profile update must be a JSON object.");
  }
  const input = value as Record<string, unknown>;
  const patch: CloudProfilePatch = {};
  if ("displayName" in input) {
    if (typeof input.displayName !== "string") throw new Error("Display name is invalid.");
    const displayName = input.displayName.trim();
    if (displayName.length < 1 || displayName.length > 40) throw new Error("Display name must contain 1 to 40 characters.");
    patch.displayName = displayName;
  }
  if ("preferences" in input) {
    const preferences = input.preferences;
    if (!preferences || typeof preferences !== "object" || Array.isArray(preferences)) throw new Error("Preferences are invalid.");
    const data = preferences as Record<string, unknown>;
    const language = data.preferredLanguage;
    const tone = data.tone;
    const styles = data.learningStyles;
    if (language !== "auto" && language !== "en" && language !== "zh-CN") throw new Error("Preferred language is invalid.");
    if (tone !== "clear" && tone !== "concise" && tone !== "encouraging") throw new Error("Preferred tone is invalid.");
    if (!Array.isArray(styles) || styles.length > 2 || styles.some((style) => typeof style !== "string" || !allowedStyles.has(style))) {
      throw new Error("Choose up to two valid learning styles.");
    }
    if (typeof data.memoryEnabled !== "boolean") throw new Error("Memory preference is invalid.");
    patch.preferences = {
      preferredLanguage: language,
      tone,
      learningStyles: styles as NonNullable<CloudProfilePatch["preferences"]>["learningStyles"],
      memoryEnabled: data.memoryEnabled,
    };
  }
  if (!patch.displayName && !patch.preferences) throw new Error("No supported profile fields were provided.");
  return patch;
}
