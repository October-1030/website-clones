"use client";

import type { FormEvent } from "react";
import { useEffect, useState } from "react";
import { Cloud, LoaderCircle, LogIn, LogOut, RefreshCw, ShieldCheck, UploadCloud, UserPlus, X } from "lucide-react";
import { createStudyPalBrowserClient } from "@/lib/cloud/browser";

interface CloudStatus {
  configured: boolean;
  authenticated: boolean;
  user?: { id: string; email: string | null };
  profile?: { display_name: string; plan: string } | null;
  error?: string;
}

export default function CloudAccountDialog({
  onClose,
  onChanged,
}: {
  onClose: () => void;
  onChanged: (message: string) => void;
}) {
  const [status, setStatus] = useState<CloudStatus | null>(null);
  const [mode, setMode] = useState<"sign-in" | "sign-up">("sign-in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    setError(null);
    try {
      const response = await fetch("/api/cloud/status", { cache: "no-store" });
      const payload = await response.json() as CloudStatus;
      if (!response.ok) throw new Error(payload.error || "Unable to read cloud status.");
      setStatus(payload);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to read cloud status.");
    }
  }

  useEffect(() => {
    const timeout = window.setTimeout(() => void refresh(), 0);
    return () => window.clearTimeout(timeout);
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const client = createStudyPalBrowserClient();
    if (!client) {
      setError("StudyPal cloud is not configured.");
      return;
    }
    if (!email.trim() || password.length < 8) {
      setError("Enter a valid email and a password of at least 8 characters.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      if (mode === "sign-up") {
        const { error: authError } = await client.auth.signUp({
          email: email.trim(),
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/auth/callback?next=/pro/session`,
          },
        });
        if (authError) throw authError;
        onChanged("Account created. Check your email if verification is enabled.");
      } else {
        const { error: authError } = await client.auth.signInWithPassword({ email: email.trim(), password });
        if (authError) throw authError;
        onChanged("Signed in to StudyPal cloud.");
      }
      setPassword("");
      await refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Authentication failed.");
    } finally {
      setBusy(false);
    }
  }

  async function signOut() {
    const client = createStudyPalBrowserClient();
    if (!client) return;
    setBusy(true);
    const { error: authError } = await client.auth.signOut();
    setBusy(false);
    if (authError) {
      setError(authError.message);
      return;
    }
    onChanged("Signed out of StudyPal cloud. Local mode remains available.");
    await refresh();
  }

  async function importLocal() {
    if (!window.confirm("Import every valid local StudyPal session on this computer into your cloud account? Existing cloud rows with the same IDs will be updated.")) return;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/cloud/import-local", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmation: "IMPORT_LOCAL_SESSIONS" }),
      });
      const payload = await response.json() as { total?: number; error?: string };
      if (!response.ok) throw new Error(payload.error || "Import failed.");
      onChanged(`${payload.total || 0} local session${payload.total === 1 ? "" : "s"} imported.`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Import failed.");
    } finally {
      setBusy(false);
    }
  }

  return <div className="dialog-backdrop" role="presentation"><section className="account-settings-dialog cloud-account-dialog" role="dialog" aria-modal="true" aria-label="Cloud account">
    <button type="button" className="dialog-close" aria-label="Close cloud account" onClick={onClose}><X size={16} /></button>
    <div className="settings-dialog-heading"><Cloud size={19} /><div><h2>StudyPal cloud account</h2><p>Cloud mode uses Supabase Auth cookies and database Row Level Security. Each user can access only their own rows.</p></div></div>
    {!status && !error && <div className="cloud-loading"><LoaderCircle size={17} className="spin" />Checking cloud configuration…</div>}
    {status && !status.configured && <div className="cloud-not-configured"><ShieldCheck size={18} /><div><strong>Cloud backend is ready for configuration</strong><span>Create a dedicated StudyPal Supabase project, apply the included migration, then set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` in `.env.local`. No other project is reused.</span></div></div>}
    {status?.configured && !status.authenticated && <><div className="cloud-auth-tabs"><button type="button" className={mode === "sign-in" ? "cloud-auth-active" : ""} onClick={() => setMode("sign-in")}><LogIn size={14} />Sign in</button><button type="button" className={mode === "sign-up" ? "cloud-auth-active" : ""} onClick={() => setMode("sign-up")}><UserPlus size={14} />Create account</button></div><form className="cloud-auth-form" onSubmit={submit}><label>Email<input type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} /></label><label>Password<input type="password" autoComplete={mode === "sign-up" ? "new-password" : "current-password"} minLength={8} value={password} onChange={(event) => setPassword(event.target.value)} /></label><button type="submit" className="settings-save" disabled={busy}>{busy ? <LoaderCircle size={14} className="spin" /> : mode === "sign-up" ? <UserPlus size={14} /> : <LogIn size={14} />}{mode === "sign-up" ? "Create account" : "Sign in"}</button></form></>}
    {status?.authenticated && <div className="cloud-signed-in"><div><span>Signed in as</span><strong>{status.user?.email || "Authenticated user"}</strong><small>{status.profile?.plan || "free"} plan · RLS protected</small></div><button type="button" onClick={() => void importLocal()} disabled={busy}><UploadCloud size={14} />Import local sessions</button><button type="button" onClick={() => void refresh()} disabled={busy}><RefreshCw size={14} />Refresh</button><button type="button" className="cloud-sign-out" onClick={() => void signOut()} disabled={busy}><LogOut size={14} />Sign out</button></div>}
    {error && <div className="portrait-error" role="alert">{error}</div>}
  </section></div>;
}
