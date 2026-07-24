export type LmsProvider = "canvas" | "blackboard" | "brightspace";

export interface LmsConnectionRecord {
  id: string;
  user_id: string;
  provider: LmsProvider;
  instance_url: string;
  account_label: string;
  access_token_ciphertext: string;
  refresh_token_ciphertext: string | null;
  token_expires_at: string | null;
  scopes: string[];
  status: "connected" | "expired" | "error";
  last_synced_at: string | null;
  last_error: string | null;
  created_at: string;
  updated_at: string;
}

export interface LmsConnectionSummary {
  id: string;
  provider: LmsProvider;
  instanceUrl: string;
  accountLabel: string;
  status: "connected" | "expired" | "error";
  scopes: string[];
  tokenExpiresAt: string | null;
  lastSyncedAt: string | null;
  lastError: string | null;
}

export interface LmsCourseInput {
  externalId: string;
  name: string;
  courseCode: string;
  enrollmentState: string;
  workflowState: string;
  startAt: string | null;
  endAt: string | null;
}

export type LmsMaterialKind = "module" | "page" | "file" | "assignment" | "external-link";

export interface LmsMaterialInput {
  externalId: string;
  kind: LmsMaterialKind;
  title: string;
  moduleName: string;
  sourceUrl: string | null;
  mimeType: string | null;
  dueAt: string | null;
  position: number;
  textContent: string;
  contentHash: string;
  metadata: Record<string, unknown>;
}

export interface LmsSyncResult {
  runId: string;
  coursesSynced: number;
  materialsSynced: number;
  warnings: string[];
}

export class LmsError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly status = 422,
  ) {
    super(message);
    this.name = "LmsError";
  }
}
