const PUBLIC_SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const PUBLIC_SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export type CloudMode = "off" | "optional" | "required";

export interface SupabasePublicConfig {
  url: string;
  publishableKey: string;
}

export class CloudConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CloudConfigError";
  }
}

export function getCloudMode(): CloudMode {
  const value = process.env.STUDYPAL_CLOUD_MODE?.trim().toLowerCase();
  return value === "required" || value === "off" ? value : "optional";
}

export function getSupabasePublicConfig(): SupabasePublicConfig | null {
  const url = PUBLIC_SUPABASE_URL?.trim();
  const publishableKey = PUBLIC_SUPABASE_KEY?.trim();
  if (!url && !publishableKey) return null;
  if (!url || !publishableKey) {
    throw new CloudConfigError("Supabase cloud configuration is incomplete.");
  }
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new CloudConfigError("NEXT_PUBLIC_SUPABASE_URL is not a valid URL.");
  }
  const local = parsed.hostname === "127.0.0.1" || parsed.hostname === "localhost";
  if (parsed.protocol !== "https:" && !(local && parsed.protocol === "http:")) {
    throw new CloudConfigError("Supabase URL must use HTTPS outside local development.");
  }
  if (publishableKey.startsWith("sb_secret_") || /service[_-]?role/i.test(publishableKey)) {
    throw new CloudConfigError("A secret or service-role key must never be exposed as a public Supabase key.");
  }
  return { url: parsed.toString().replace(/\/$/, ""), publishableKey };
}
