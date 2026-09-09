"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { X } from "lucide-react";

export function Modal({ title, children, onClose, wide = false, className = "" }: { title: string; children: ReactNode; onClose: () => void; wide?: boolean; className?: string }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    dialog?.showModal();
    return () => dialog?.close();
  }, []);
  return <dialog ref={ref} aria-label={title} onCancel={onClose} onClick={e => { if (e.target === e.currentTarget) onClose(); }} className={`modal ${wide ? "modal-wide" : ""} ${className}`}>
    <div className="flex items-center justify-between gap-4 pb-2">
      <h2 className="text-base font-normal">{title}</h2>
      <button type="button" aria-label="关闭" className="icon-button" onClick={onClose}><X size={20} /></button>
    </div>
    {children}
  </dialog>;
}
