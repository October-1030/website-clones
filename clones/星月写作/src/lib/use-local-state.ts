"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";

const changeEvent = "xingyue-local-change";
function subscribe(callback: () => void) {
  window.addEventListener(changeEvent, callback);
  window.addEventListener("storage", callback);
  return () => { window.removeEventListener(changeEvent, callback); window.removeEventListener("storage", callback); };
}

export function useLocalState<T>(key: string, fallback: T) {
  const getSnapshot = useCallback(() => window.localStorage.getItem(key), [key]);
  const raw = useSyncExternalStore(subscribe, getSnapshot, () => null);
  const value = useMemo<T>(() => { try { return raw === null ? fallback : JSON.parse(raw); } catch { return fallback; } }, [raw, fallback]);
  const setValue = (next: T | ((current: T) => T)) => {
    const currentRaw = window.localStorage.getItem(key);
    let current = fallback;
    try { current = currentRaw === null ? fallback : JSON.parse(currentRaw); } catch { /* Use the initial value for unreadable data. */ }
    const updated = typeof next === "function" ? (next as (current: T) => T)(current) : next;
    window.localStorage.setItem(key, JSON.stringify(updated));
    window.dispatchEvent(new Event(changeEvent));
  };
  return [value, setValue] as const;
}
