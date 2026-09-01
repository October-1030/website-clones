export type Locale = "zh-CN" | "en" | "zh-TW";
export type AuthMode = "login" | "register";
export type AuthField = "account" | "password" | "phone" | "code";
export type FormErrors = Partial<Record<AuthField, string>>;
