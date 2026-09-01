"use client";

import { useState, useSyncExternalStore } from "react";
import { AuthForm } from "@/components/auth-form";
import { AuthShell } from "@/components/auth-shell";
import type { AuthMode, Locale } from "@/types/auth";

function subscribeToHash(callback: () => void) {
  window.addEventListener("hashchange", callback);
  return () => window.removeEventListener("hashchange", callback);
}

function getMode(): AuthMode {
  return window.location.hash === "#/auth/register" ? "register" : "login";
}

function getServerMode(): AuthMode { return "login"; }

export function AuthApp() {
  const mode = useSyncExternalStore(subscribeToHash, getMode, getServerMode);
  const [locale, setLocale] = useState<Locale>("zh-CN");

  return (
    <AuthShell showFooter={mode === "login"}>
      <AuthForm key={mode} mode={mode} locale={locale} onLocaleChange={setLocale} />
    </AuthShell>
  );
}
