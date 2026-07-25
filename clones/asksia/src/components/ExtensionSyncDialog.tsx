"use client";

import { notifyUsageChanged } from "@/lib/usage/client";

import type { FormEvent } from "react";
import { useEffect, useState } from "react";
import {
  Copy,
  ExternalLink,
  LoaderCircle,
  Puzzle,
  RefreshCw,
  ShieldCheck,
  Trash2,
  WandSparkles,
  X,
} from "lucide-react";

interface ExtensionConnection {
  id: string;
  label: string;
  tokenHint: string;
  expiresAt: string;
  lastUsedAt: string | null;
  createdAt: string;
}

interface ExtensionCapture {
  id: string;
  sourceUrl: string;
  title: string;
  capturedAt: string;
  createdAt: string;
  scope: "page" | "selection";
  truncated: boolean;
  wordCount: number;
}

interface ExtensionStatus {
  authenticated: boolean;
  connections: ExtensionConnection[];
  captures: ExtensionCapture[];
  error?: string;
}

function dateLabel(value: string): string {
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return "Unknown time";
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(timestamp));
}

function hostname(value: string): string {
  try {
    return new URL(value).hostname;
  } catch {
    return "Captured webpage";
  }
}

export default function ExtensionSyncDialog({
  onClose,
  onChanged,
}: {
  onClose: () => void;
  onChanged: (message: string) => void;
}) {
  const [status, setStatus] = useState<ExtensionStatus | null>(null);
  const [label, setLabel] = useState("Chrome on this computer");
  const [createdToken, setCreatedToken] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    setError(null);
    try {
      const response = await fetch("/api/extension/status", { cache: "no-store" });
      const payload = await response.json() as ExtensionStatus;
      if (!response.ok) throw new Error(payload.error || "Unable to load extension sync.");
      setStatus(payload);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to load extension sync.");
    }
  }

  useEffect(() => {
    const timeout = window.setTimeout(() => void refresh(), 0);
    return () => window.clearTimeout(timeout);
  }, []);

  async function createToken(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy("create");
    setError(null);
    setCreatedToken(null);
    try {
      const response = await fetch("/api/extension/tokens", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label }),
      });
      const payload = await response.json() as { token?: string; error?: string };
      if (!response.ok || !payload.token) throw new Error(payload.error || "Unable to create extension token.");
      setCreatedToken(payload.token);
      onChanged("Extension pairing token created. Copy it now; StudyPal will not show it again.");
      await refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to create extension token.");
    } finally {
      setBusy(null);
    }
  }

  async function copyToken() {
    if (!createdToken) return;
    try {
      await navigator.clipboard.writeText(createdToken);
      onChanged("Extension pairing token copied.");
    } catch {
      setError("Clipboard access failed. Select and copy the token manually.");
    }
  }

  async function revoke(connection: ExtensionConnection) {
    if (!window.confirm(`Revoke ${connection.label}? Its saved token will stop syncing immediately.`)) return;
    setBusy(`revoke:${connection.id}`);
    setError(null);
    try {
      const response = await fetch(`/api/extension/tokens/${connection.id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmation: "REVOKE_EXTENSION" }),
      });
      const payload = await response.json() as { error?: string };
      if (!response.ok) throw new Error(payload.error || "Unable to revoke extension connection.");
      onChanged(`${connection.label} revoked.`);
      await refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to revoke extension connection.");
    } finally {
      setBusy(null);
    }
  }

  async function summarize(capture: ExtensionCapture) {
    setBusy(`summary:${capture.id}`);
    setError(null);
    try {
      const response = await fetch(`/api/extension/captures/${capture.id}/study`, { method: "POST" });
      const payload = await response.json() as { href?: string; error?: string };
      if (!response.ok || !payload.href) throw new Error(payload.error || "Unable to summarize captured webpage.");
      notifyUsageChanged();
      onChanged("Captured webpage converted into a grounded StudyPal session.");
      window.location.href = payload.href;
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to summarize captured webpage.");
      setBusy(null);
    }
  }

  return <div className="dialog-backdrop" role="presentation"><section className="account-settings-dialog cloud-account-dialog extension-sync-dialog" role="dialog" aria-modal="true" aria-label="Browser extension sync">
    <button type="button" className="dialog-close" aria-label="Close browser extension sync" onClick={onClose}><X size={16} /></button>
    <div className="settings-dialog-heading"><Puzzle size={19} /><div><h2>StudyPal browser extension</h2><p>Capture only the selected text or visible study page you explicitly choose. Form values, password fields, hidden content, and background browsing are excluded.</p></div></div>
    {!status && !error && <div className="cloud-loading"><LoaderCircle size={17} className="spin" />Checking extension connections…</div>}
    {status && !status.authenticated && <div className="cloud-not-configured"><ShieldCheck size={18} /><div><strong>Sign in to StudyPal cloud first</strong><span>Open Cloud account & sync from the profile menu. Pairing tokens and captured pages are isolated by your authenticated user ID.</span></div></div>}
    {status?.authenticated && <>
      <div className="extension-install-steps"><strong>Local installation</strong><span>1. Open <code>chrome://extensions</code> and enable Developer mode.</span><span>2. Choose Load unpacked and select this project&apos;s <code>extension</code> folder.</span><span>3. Create a token below and paste it into the StudyPal side panel.</span></div>
      <form className="cloud-auth-form" onSubmit={createToken}>
        <label>Connection label<input type="text" value={label} onChange={(event) => setLabel(event.target.value)} maxLength={80} /></label>
        <button type="submit" className="settings-save" disabled={busy !== null}>{busy === "create" ? <LoaderCircle size={14} className="spin" /> : <ShieldCheck size={14} />}Create one-time pairing token</button>
      </form>
      {createdToken && <div className="extension-token-once" role="status"><strong>Copy this token now</strong><span>It is stored only as a SHA-256 hash in StudyPal and cannot be shown again.</span><div><code>{createdToken}</code><button type="button" onClick={() => void copyToken()}><Copy size={14} />Copy</button></div></div>}
      <div className="extension-section-heading"><div><strong>Connected browsers</strong><span>{status.connections.length}/5 active</span></div><button type="button" onClick={() => void refresh()} disabled={busy !== null}><RefreshCw size={13} />Refresh</button></div>
      {status.connections.length === 0 ? <div className="extension-empty">No browser is paired yet.</div> : <div className="extension-connection-list">{status.connections.map((connection) => <div key={connection.id}><div><strong>{connection.label}</strong><span>{connection.tokenHint} · expires {dateLabel(connection.expiresAt)}</span><small>{connection.lastUsedAt ? `Last sync ${dateLabel(connection.lastUsedAt)}` : "Not used yet"}</small></div><button type="button" aria-label={`Revoke ${connection.label}`} onClick={() => void revoke(connection)} disabled={busy !== null}>{busy === `revoke:${connection.id}` ? <LoaderCircle size={13} className="spin" /> : <Trash2 size={13} />}Revoke</button></div>)}</div>}
      <div className="extension-section-heading"><div><strong>Recent captures</strong><span>{status.captures.length} shown</span></div></div>
      {status.captures.length === 0 ? <div className="extension-empty">Captured pages will appear here after you press Sync this page in the Chrome side panel.</div> : <div className="extension-capture-list">{status.captures.map((capture) => <article key={capture.id}><div><strong>{capture.title}</strong><span>{hostname(capture.sourceUrl)} · {capture.scope} · {capture.wordCount} words{capture.truncated ? " · truncated" : ""}</span><small>{dateLabel(capture.capturedAt)}</small></div><a href={capture.sourceUrl} target="_blank" rel="noreferrer"><ExternalLink size={13} />Source</a><button type="button" onClick={() => void summarize(capture)} disabled={busy !== null}>{busy === `summary:${capture.id}` ? <LoaderCircle size={13} className="spin" /> : <WandSparkles size={13} />}Summarize</button></article>)}</div>}
    </>}
    {error && <div className="portrait-error" role="alert">{error}</div>}
  </section></div>;
}
