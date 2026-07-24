"use client";

import type { FormEvent } from "react";
import { useEffect, useState } from "react";
import { BookOpenCheck, LoaderCircle, RefreshCw, ShieldCheck, Trash2, Unplug, X } from "lucide-react";

interface Connection {
  id: string;
  provider: "canvas" | "blackboard" | "brightspace";
  instanceUrl: string;
  accountLabel: string;
  status: "connected" | "expired" | "error";
  lastSyncedAt: string | null;
  lastError: string | null;
}

interface LmsStatus {
  authenticated: boolean;
  connections: Connection[];
  courses: Array<{
    id: number;
    connectionId: string;
    externalId: string;
    name: string;
    courseCode: string;
    updatedAt: string;
  }>;
  providers: {
    canvas: { manualToken: boolean; oauthConfigured: boolean; readOnly: boolean };
    blackboard: { configured: boolean; readOnly: boolean; administratorManaged: boolean };
    brightspace: { oauthConfigured: boolean; readOnly: boolean; administratorManaged: boolean };
  };
  error?: string;
}

export default function LmsConnectorDialog({
  onClose,
  onChanged,
}: {
  onClose: () => void;
  onChanged: (message: string) => void;
}) {
  const [status, setStatus] = useState<LmsStatus | null>(null);
  const [instanceUrl, setInstanceUrl] = useState("");
  const [accountLabel, setAccountLabel] = useState("Canvas");
  const [accessToken, setAccessToken] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    setError(null);
    try {
      const response = await fetch("/api/lms/status", { cache: "no-store" });
      const payload = await response.json() as LmsStatus;
      if (!response.ok) throw new Error(payload.error || "Unable to load LMS connections.");
      setStatus(payload);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to load LMS connections.");
    }
  }

  useEffect(() => {
    const timeout = window.setTimeout(() => void refresh(), 0);
    return () => window.clearTimeout(timeout);
  }, []);

  async function connect(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!instanceUrl.trim() || !accessToken.trim()) {
      setError("Enter your Canvas URL and a read-only access token.");
      return;
    }
    setBusy("connect");
    setError(null);
    try {
      const response = await fetch("/api/lms/canvas/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          instanceUrl: instanceUrl.trim(),
          accountLabel: accountLabel.trim() || "Canvas",
          accessToken,
        }),
      });
      const payload = await response.json() as { connection?: Connection; error?: string };
      if (!response.ok) throw new Error(payload.error || "Canvas connection failed.");
      setAccessToken("");
      onChanged("Canvas connected with encrypted token storage.");
      await refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Canvas connection failed.");
    } finally {
      setBusy(null);
    }
  }

  async function connectBlackboard() {
    setBusy("blackboard-connect");
    setError(null);
    try {
      const response = await fetch("/api/lms/blackboard/connect", { method: "POST" });
      const payload = await response.json() as { connection?: Connection; error?: string };
      if (!response.ok) throw new Error(payload.error || "Blackboard connection failed.");
      onChanged("Blackboard connected with an administrator-managed read-only integration.");
      await refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Blackboard connection failed.");
    } finally {
      setBusy(null);
    }
  }
  function connectBrightspace() {
    window.location.href = "/api/lms/brightspace/oauth/start";
  }
  async function sync(connection: Connection) {
    setBusy(`sync:${connection.id}`);
    setError(null);
    try {
      const response = await fetch(`/api/lms/connections/${connection.id}/sync`, { method: "POST" });
      const payload = await response.json() as {
        coursesSynced?: number;
        materialsSynced?: number;
        error?: string;
      };
      if (!response.ok) throw new Error(payload.error || "LMS sync failed.");
      onChanged(`Synced ${payload.coursesSynced || 0} courses and ${payload.materialsSynced || 0} materials.`);
      await refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "LMS sync failed.");
    } finally {
      setBusy(null);
    }
  }

  async function disconnect(connection: Connection) {
    if (!window.confirm(`Disconnect ${connection.accountLabel} and remove its synchronized course data?`)) return;
    setBusy(`delete:${connection.id}`);
    setError(null);
    try {
      const response = await fetch(`/api/lms/connections/${connection.id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmation: "DISCONNECT_LMS" }),
      });
      const payload = await response.json() as { error?: string };
      if (!response.ok) throw new Error(payload.error || "LMS disconnect failed.");
      onChanged(`${connection.accountLabel} connection removed.`);
      await refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "LMS disconnect failed.");
    } finally {
      setBusy(null);
    }
  }

  return <div className="dialog-backdrop" role="presentation"><section className="account-settings-dialog cloud-account-dialog" role="dialog" aria-modal="true" aria-label="LMS connections">
    <button type="button" className="dialog-close" aria-label="Close LMS connections" onClick={onClose}><X size={16} /></button>
    <div className="settings-dialog-heading"><BookOpenCheck size={19} /><div><h2>LMS connections</h2><p>Read-only LMS synchronization imports course structure and material metadata. StudyPal never writes grades, submissions, enrollments, or messages back to a school system.</p></div></div>
    {!status && !error && <div className="cloud-loading"><LoaderCircle size={17} className="spin" />Checking LMS configuration...</div>}
    {status?.authenticated && status.providers.canvas.oauthConfigured && <button type="button" className="settings-save" onClick={() => { window.location.href = "/api/lms/canvas/oauth/start"; }}><ShieldCheck size={14} />Connect Canvas with OAuth</button>}
    {status?.authenticated && status.providers.blackboard.configured && <button type="button" className="settings-save" onClick={() => void connectBlackboard()} disabled={busy !== null}>{busy === "blackboard-connect" ? <LoaderCircle size={14} className="spin" /> : <ShieldCheck size={14} />}Connect Blackboard Learn</button>}
    {status?.authenticated && status.providers.brightspace.oauthConfigured && <button type="button" className="settings-save" onClick={connectBrightspace} disabled={busy !== null}><ShieldCheck size={14} />Connect D2L Brightspace</button>}
    {status?.authenticated && <form className="cloud-auth-form" onSubmit={connect}>
      <label>Canvas URL<input type="url" value={instanceUrl} onChange={(event) => setInstanceUrl(event.target.value)} placeholder="https://school.instructure.com" autoComplete="url" /></label>
      <label>Account label<input type="text" value={accountLabel} onChange={(event) => setAccountLabel(event.target.value)} maxLength={120} /></label>
      <label>Read-only access token<input type="password" value={accessToken} onChange={(event) => setAccessToken(event.target.value)} autoComplete="off" /></label>
      <button type="submit" className="settings-save" disabled={busy !== null}>{busy === "connect" ? <LoaderCircle size={14} className="spin" /> : <ShieldCheck size={14} />}Verify and connect</button>
    </form>}
    {status?.connections.map((connection) => <div className="cloud-signed-in" key={connection.id}>
      <div><span>{connection.provider.toUpperCase()} · {connection.status}</span><strong>{connection.accountLabel}</strong><small>{connection.instanceUrl}{connection.lastSyncedAt ? ` · synced ${new Date(connection.lastSyncedAt).toLocaleString()}` : ""}</small></div>
      <button type="button" onClick={() => void sync(connection)} disabled={busy !== null}>{busy === `sync:${connection.id}` ? <LoaderCircle size={14} className="spin" /> : <RefreshCw size={14} />}Sync courses</button>
      <button type="button" className="cloud-sign-out" onClick={() => void disconnect(connection)} disabled={busy !== null}>{busy === `delete:${connection.id}` ? <LoaderCircle size={14} className="spin" /> : <Trash2 size={14} />}Disconnect</button>
      {connection.lastError && <div className="portrait-error" role="alert">{connection.lastError}</div>}
    </div>)}
    {status && !status.authenticated && <div className="cloud-not-configured"><ShieldCheck size={18} /><div><strong>Sign in to StudyPal cloud first</strong><span>Open Cloud account & sync, sign in, then return here to connect Canvas. No LMS data is exposed while signed out.</span></div></div>}
    {status?.authenticated && status.connections.length === 0 && <div className="cloud-not-configured"><Unplug size={18} /><div><strong>No LMS connected</strong><span>Verify a read-only Canvas token, use an approved OAuth connection, or connect an administrator-configured Blackboard integration.</span></div></div>}
    {error && <div className="portrait-error" role="alert">{error}</div>}
  </section></div>;
}
