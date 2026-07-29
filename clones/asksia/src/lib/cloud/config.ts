export type CloudMode = "off" | "optional" | "required";
export type DeploymentMode = "local" | "public";
type Environment = Readonly<Record<string, string | undefined>>;

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

export function getCloudMode(environment: Environment = process.env): CloudMode {
  const value = environment.STUDYPAL_CLOUD_MODE?.trim().toLowerCase();
  return value === "required" || value === "off" ? value : "optional";
}

export function getDeploymentMode(environment: Environment = process.env): DeploymentMode {
  const value = environment.STUDYPAL_DEPLOYMENT_MODE?.trim().toLowerCase();
  if (value === "local" || value === "public") return value;
  if (value) {
    throw new CloudConfigError('STUDYPAL_DEPLOYMENT_MODE must be either "local" or "public".');
  }
  return environment.NODE_ENV === "production" ? "public" : "local";
}

export function getCanonicalAppOrigin(environment: Environment = process.env): string | null {
  const value = environment.STUDYPAL_APP_ORIGIN?.trim();
  if (!value) return null;
  let origin: URL;
  try {
    origin = new URL(value);
  } catch {
    throw new CloudConfigError("STUDYPAL_APP_ORIGIN is not a valid URL.");
  }
  if (
    origin.protocol !== "https:"
    || origin.username
    || origin.password
    || origin.pathname !== "/"
    || origin.search
    || origin.hash
  ) {
    throw new CloudConfigError(
      "STUDYPAL_APP_ORIGIN must be one HTTPS origin without credentials, path, query, or fragment.",
    );
  }
  return origin.origin;
}

export function getSupabasePublicConfig(
  environment: Environment = process.env,
): SupabasePublicConfig | null {
  const url = environment.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const publishableKey = (
    environment.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
    || environment.NEXT_PUBLIC_SUPABASE_ANON_KEY
  )?.trim();
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

export function assertPublicDeploymentConfig(environment: Environment = process.env): void {
  if (getDeploymentMode(environment) !== "public") return;
  if ((environment.STUDYPAL_CLOUD_MODE || "").trim().toLowerCase() !== "required") {
    throw new CloudConfigError("Public deployment requires STUDYPAL_CLOUD_MODE=required.");
  }
  if (!getCanonicalAppOrigin(environment)) {
    throw new CloudConfigError("Public deployment requires STUDYPAL_APP_ORIGIN.");
  }
  if (!getSupabasePublicConfig(environment)) {
    throw new CloudConfigError("Public deployment requires Supabase authentication.");
  }
}
