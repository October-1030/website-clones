export const FREE_USAGE_LIMITS = {
  aiRequests: 10,
  filePages: 100,
  recordingSeconds: 600,
  aiDetectionChars: 10_000,
} as const;

export type UsageDimension = "ai_requests" | "file_pages" | "recording_seconds" | "ai_detection_chars";

export interface UsageMeter {
  used: number;
  limit: number;
  remaining: number;
}

export interface AccountUsageStatus {
  authenticated: boolean;
  metered: boolean;
  planId: "free" | "local";
  planLabel: string;
  periodStart: string | null;
  periodEnd: string | null;
  meters: {
    aiRequests: UsageMeter | null;
    filePages: UsageMeter | null;
    recordingSeconds: UsageMeter | null;
    aiDetectionChars: UsageMeter | null;
  };
}

export interface UsageChanges {
  aiRequests?: number;
  filePages?: number;
  recordingSeconds?: number;
  aiDetectionChars?: number;
}