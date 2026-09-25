"use client";

import { useToasts } from "@/lib/toast";
import { cx } from "./ui";

export function Toaster() {
  const toasts = useToasts();
  return (
    <div
      className="pointer-events-none fixed inset-x-0 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-40 flex flex-col items-center gap-2 px-4 md:bottom-6"
      role="status"
      aria-live="polite"
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          className={cx(
            "animate-[toast-in_.18s_ease-out] flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium shadow-lg",
            t.tone === "success" ? "bg-fg text-bg" : "bg-danger text-white",
          )}
        >
          <span aria-hidden>{t.tone === "success" ? "✓" : "!"}</span>
          {t.message}
        </div>
      ))}
    </div>
  );
}
