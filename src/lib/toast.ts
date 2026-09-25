"use client";

// 画面下に数秒だけ出る通知（「保存しました」など）
import { useSyncExternalStore } from "react";

export interface Toast {
  id: number;
  message: string;
  tone: "success" | "error";
}

let toasts: Toast[] = [];
let nextId = 1;
const subs = new Set<() => void>();
const emit = () => subs.forEach((fn) => fn());

export function toast(message: string, tone: Toast["tone"] = "success") {
  const id = nextId++;
  toasts = [...toasts.slice(-2), { id, message, tone }];
  emit();
  setTimeout(() => {
    toasts = toasts.filter((t) => t.id !== id);
    emit();
  }, 2600);
}

export function useToasts(): Toast[] {
  return useSyncExternalStore(
    (fn) => {
      subs.add(fn);
      return () => subs.delete(fn);
    },
    () => toasts,
    () => toasts,
  );
}
