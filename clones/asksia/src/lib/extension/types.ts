export interface ExtensionCaptureInput {
  clientCaptureId: string;
  sourceUrl: string;
  title: string;
  textContent: string;
  capturedAt: string;
  metadata: {
    source: "chromium-extension";
    scope: "page" | "selection";
    truncated: boolean;
    wordCount: number;
    language: string;
    description: string;
  };
}

export interface ExtensionTokenSummary {
  id: string;
  label: string;
  tokenHint: string;
  expiresAt: string;
  lastUsedAt: string | null;
  createdAt: string;
}

export interface ExtensionCaptureSummary {
  id: string;
  sourceUrl: string;
  title: string;
  capturedAt: string;
  createdAt: string;
  scope: "page" | "selection";
  truncated: boolean;
  wordCount: number;
}

export class ExtensionSyncError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly status = 400,
  ) {
    super(message);
    this.name = "ExtensionSyncError";
  }
}
