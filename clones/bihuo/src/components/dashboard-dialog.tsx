"use client";

import { useEffect, useRef, type ReactNode } from "react";

export function DashboardDialog({ children, onClose, label, className = "", modal = true }: { children: ReactNode; onClose: () => void; label: string; className?: string; modal?: boolean }) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const element = dialog.current;
    if (modal) element?.showModal();
    else element?.show();
    return () => element?.close();
  }, [modal]);
  return <dialog ref={dialog} aria-label={label} className={`dashboard-dialog ${className}`} onCancel={onClose} onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}>{children}</dialog>;
}
