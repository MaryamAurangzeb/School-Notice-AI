"use client";

import { useEffect } from "react";

export interface ToastMessage {
  message: string;
  kind: "success" | "error";
}

export default function Toast({ toast, onDismiss }: { toast: ToastMessage | null; onDismiss: () => void }) {
  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(onDismiss, toast.kind === "error" ? 7000 : 3500);
    return () => window.clearTimeout(timer);
  }, [toast, onDismiss]);

  if (!toast) return null;
  const isError = toast.kind === "error";

  return (
    <div className="no-print pointer-events-none fixed inset-x-0 bottom-4 z-50 flex justify-center px-4">
      <div
        role={isError ? "alert" : "status"}
        aria-live={isError ? "assertive" : "polite"}
        className={`pointer-events-auto flex max-w-md items-start gap-3 rounded-md border px-4 py-3 text-sm shadow-lg ${
          isError ? "border-red-300 bg-red-50 text-red-900" : "border-brand bg-white text-ink"
        }`}
      >
        <span className="leading-snug">{toast.message}</span>
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss message"
          className="-mr-1 shrink-0 rounded px-1.5 text-lg leading-none text-muted hover:text-ink"
        >
          &times;
        </button>
      </div>
    </div>
  );
}
