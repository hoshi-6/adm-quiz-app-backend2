"use client";

import { dismissNotice, useNotices } from "@/lib/store";
import { Button, Window } from "./ui";

const HEAD: Record<string, string> = {
  clear: "QUEST CLEAR",
  levelup: "LEVEL UP",
  title: "TITLE",
  penalty: "WARNING",
  info: "NOTICE",
  story: "STORY",
  ally: "NEW ALLY",
};

/** システムからのお知らせを 1 つずつ表示する */
export function SystemNotices() {
  const notices = useNotices();
  const n = notices[0];
  if (!n) return null;
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4 backdrop-blur-sm" role="dialog" aria-modal aria-labelledby={`notice-${n.id}`}>
      <Window key={n.id} danger={n.kind === "penalty"} className="animate-sys-in w-full max-w-sm text-center">
        <p className={n.kind === "penalty" ? "font-mono text-xs tracking-[0.4em] text-danger" : "font-mono text-xs tracking-[0.4em] text-glow"}>
          {HEAD[n.kind]}
        </p>
        <h2 id={`notice-${n.id}`} className={n.kind === "penalty" ? "mt-2 text-xl font-bold text-danger" : "mt-2 text-xl font-bold text-glow-strong glow-text"}>
          {n.title}
        </h2>
        <div className="mt-3 space-y-1 text-sm">
          {n.lines.map((l, i) => (
            <p key={i} className={n.kind === "levelup" && i === 0 ? "font-mono text-2xl font-bold text-gold" : "text-fg/90"}>
              {l}
            </p>
          ))}
        </div>
        <Button className="mt-5 w-full" variant={n.kind === "penalty" ? "danger" : "primary"} onClick={() => dismissNotice(n.id)} autoFocus>
          確認
        </Button>
      </Window>
    </div>
  );
}
