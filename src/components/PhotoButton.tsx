"use client";

import { useRef, type ReactNode } from "react";
import { Button } from "./ui";

/** 写真を撮る／選ぶボタン。スマホではカメラと写真ライブラリのどちらかを選べる */
export function PhotoButton({ onFile, disabled, children, variant = "secondary" }: { onFile: (file: File) => void; disabled?: boolean; children: ReactNode; variant?: "primary" | "secondary" }) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <>
      <Button type="button" variant={variant} disabled={disabled} onClick={() => ref.current?.click()}>
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M4 8h3l2-3h6l2 3h3v11H4z" />
          <circle cx="12" cy="13" r="3.5" />
        </svg>
        {children}
      </Button>
      <input
        ref={ref}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onFile(f);
          e.target.value = "";
        }}
      />
    </>
  );
}
