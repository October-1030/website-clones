import type { CloudAuthContext } from "../cloud/server";
import { getCloudAuthContext } from "../cloud/server";
import {
  FREE_USAGE_LIMITS,
  type AccountUsageStatus,
  type UsageChanges,
  type UsageDimension,
  type UsageMeter,
} from "./types";

export type UsageContextProvider = () => Promise<CloudAuthContext>;

interface UsageRow {
  plan_id?: unknown;
  period_start?: unknown;
  period_end?: unknown;
  ai_requests_used?: unknown;
  file_pages_used?: unknown;
  recording_seconds_used?: unknown;
  ai_detection_chars_used?: unknown;
}

const MAX_SINGLE_CONSUMPTION = {
  aiRequests: 10,
  filePages: 500,
  recordingSeconds: 605,
  aiDetectionChars: FREE_USAGE_LIMITS.aiDetectionChars,
} as const;

const DIMENSION_LABELS: Record<UsageDimension, string> = {
  ai_requests: "Monthly AI request",
  file_pages: "Monthly file page",
  recording_seconds: "Monthly recording time",
  ai_detection_chars: "Monthly writing-signal character",
};

export class UsageAccountingError extends Error {
  constructor(
    message: string,
    public readonly code = "usage_accounting_failed",
    public readonly status = 503,
    public readonly dimension: UsageDimension | null = null,
  ) {
    super(message);
    this.name = "UsageAccountingError";
  }
}

export function currentUsagePeriod(now = new Date()): { start: string; end: string } {
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  return { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) };
}

function meter(usedValue: unknown, limit: number): UsageMeter {
  const numeric = Number(usedValue);
  const used = Number.isSafeInteger(numeric) && numeric >= 0 ? numeric : 0;
  return { used, limit, remaining: Math.max(0, limit - used) };
}

export function localUsageStatus(): AccountUsageStatus {
  return {
    authenticated: false,
    metered: false,
    planId: "local",
    planLabel: "Local",
    periodStart: null,
    periodEnd: null,
    meters: { aiRequests: null, filePages: null, recordingSeconds: null, aiDetectionChars: null },
  };
}

function authenticatedUsageStatus(row: UsageRow | null, period = currentUsagePeriod()): AccountUsageStatus {
  return {
    authenticated: true,
    metered: true,
    planId: "free",
    planLabel: "Free",
    periodStart: typeof row?.period_start === "string" ? row.period_start : period.start,
    periodEnd: typeof row?.period_end === "string" ? row.period_end : period.end,
    meters: {
      aiRequests: meter(row?.ai_requests_used, FREE_USAGE_LIMITS.aiRequests),
      filePages: meter(row?.file_pages_used, FREE_USAGE_LIMITS.filePages),
      recordingSeconds: meter(row?.recording_seconds_used, FREE_USAGE_LIMITS.recordingSeconds),
      aiDetectionChars: meter(row?.ai_detection_chars_used, FREE_USAGE_LIMITS.aiDetectionChars),
    },
  };
}

function positiveInteger(value: number | undefined, maximum: number, label: string): number {
  if (value === undefined) return 0;
  if (!Number.isSafeInteger(value) || value <= 0 || value > maximum) {
    throw new UsageAccountingError(`${label} usage amount is invalid.`, "usage_amount_invalid", 400);
  }
  return value;
}

export function normalizeUsageChanges(changes: UsageChanges): Record<UsageDimension, number> {
  const normalized: Record<UsageDimension, number> = {
    ai_requests: positiveInteger(changes.aiRequests, MAX_SINGLE_CONSUMPTION.aiRequests, "AI request"),
    file_pages: positiveInteger(changes.filePages, MAX_SINGLE_CONSUMPTION.filePages, "File page"),
    recording_seconds: positiveInteger(changes.recordingSeconds, MAX_SINGLE_CONSUMPTION.recordingSeconds, "Recording time"),
    ai_detection_chars: positiveInteger(changes.aiDetectionChars, MAX_SINGLE_CONSUMPTION.aiDetectionChars, "Writing-signal character"),
  };
  if (Object.values(normalized).every((value) => value === 0)) {
    throw new UsageAccountingError("At least one usage amount is required.", "usage_amount_invalid", 400);
  }
  return normalized;
}

export async function getAccountUsageStatus(
  contextProvider: UsageContextProvider = getCloudAuthContext,
): Promise<AccountUsageStatus> {
  const context = await contextProvider();
  if (context.state !== "authenticated") return localUsageStatus();
  const period = currentUsagePeriod();
  const { data, error } = await context.client
    .from("account_usage_periods")
    .select("plan_id,period_start,ai_requests_used,file_pages_used,recording_seconds_used,ai_detection_chars_used")
    .eq("user_id", context.user.id)
    .eq("period_start", period.start)
    .maybeSingle();
  if (error) throw new UsageAccountingError("Unable to load account usage.");
  return authenticatedUsageStatus(data as UsageRow | null, period);
}

function quotaDimension(error: { details?: string | null; message?: string | null }): UsageDimension | null {
  const value = `${error.details || ""} ${error.message || ""}`;
  return (["ai_requests", "file_pages", "recording_seconds", "ai_detection_chars"] as UsageDimension[])
    .find((dimension) => value.includes(dimension)) || null;
}

export async function consumeAccountUsage(
  changes: UsageChanges,
  contextProvider: UsageContextProvider = getCloudAuthContext,
): Promise<AccountUsageStatus> {
  const normalized = normalizeUsageChanges(changes);
  const context = await contextProvider();
  if (context.state !== "authenticated") return localUsageStatus();
  const compact = Object.fromEntries(Object.entries(normalized).filter(([, amount]) => amount > 0));
  const { data, error } = await context.client.rpc("consume_account_usage", { p_changes: compact });
  if (error) {
    const dimension = quotaDimension(error);
    if (error.code === "P0001" && /quota/i.test(error.message || "")) {
      const label = dimension ? DIMENSION_LABELS[dimension] : "Monthly usage";
      throw new UsageAccountingError(`${label} limit reached. It resets at the start of the next UTC month.`, "usage_quota_exceeded", 429, dimension);
    }
    throw new UsageAccountingError("Unable to record account usage.");
  }
  const row = (Array.isArray(data) ? data[0] : data) as UsageRow | null;
  if (!row || typeof row !== "object") throw new UsageAccountingError("Usage accounting response is invalid.");
  return authenticatedUsageStatus(row);
}