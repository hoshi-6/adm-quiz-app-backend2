"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { rankOf } from "@/lib/game";
import { checkDate, useGame } from "@/lib/store";
import { SystemNotices } from "./SystemNotices";
import { cx } from "./ui";

const NAV = [
  { href: "/", label: "クエスト", icon: "M9 4h6l1 3h4v13H4V7h4zM9 12l2 2 4-4" },
  { href: "/dungeon", label: "ダンジョン", icon: "M4 21V10l8-6 8 6v11M9 21v-6h6v6M12 4v3" },
  { href: "/status", label: "ステータス", icon: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21c0-4 4-6 8-6s8 2 8 6" },
  { href: "/body", label: "からだ", icon: "M4 20h16M7 20V10M12 20V4M17 20v-7" },
  { href: "/log", label: "記録", icon: "M4 5h16v15H4zM4 10h16M9 3v4M15 3v4" },
  { href: "/settings", label: "設定", icon: "M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0M16 4v4M10 10v4M18 16v4" },
];

function Icon({ d }: { d: string }) {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d={d} />
    </svg>
  );
}

export function Shell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const game = useGame();

  // 0時をまたいだときや、アプリに戻ってきたときに日付を確かめる
  useEffect(() => {
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
    const onVisible = () => document.visibilityState === "visible" && checkDate();
    document.addEventListener("visibilitychange", onVisible);
    const t = setInterval(checkDate, 30_000);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      clearInterval(t);
    };
  }, []);

  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));
  const rank = game ? rankOf(game.level) : null;

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-5xl">
      <aside className="sticky top-0 hidden h-dvh w-52 shrink-0 flex-col gap-6 p-4 md:flex">
        <Link href="/" className="px-2 font-mono text-lg font-bold tracking-[0.25em] text-glow-strong glow-text">
          LEVEL QUEST
        </Link>
        <nav className="flex flex-col gap-1">
          {NAV.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className={cx(
                "flex items-center gap-3 rounded border px-3 py-2 text-sm font-medium transition",
                isActive(n.href) ? "border-glow/60 bg-glow/10 text-glow-strong" : "border-transparent text-muted hover:text-fg",
              )}
            >
              <Icon d={n.icon} />
              {n.label}
            </Link>
          ))}
        </nav>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex items-center justify-between gap-3 border-b border-line/70 bg-bg/85 px-4 py-2.5 backdrop-blur pt-[max(0.625rem,env(safe-area-inset-top))]">
          <span className="font-mono text-sm font-bold tracking-[0.25em] text-glow-strong glow-text md:invisible">LEVEL QUEST</span>
          {game && rank && (
            <Link href="/status" className="flex items-center gap-2 font-mono text-sm">
              <span className="rounded border px-1.5 text-xs font-bold" style={{ color: rank.color, borderColor: rank.color }}>
                {rank.rank}
              </span>
              <span className="text-fg">Lv.{game.level}</span>
              {game.statPoints > 0 && <span className="h-2 w-2 rounded-full bg-gold" title="未使用の能力値ポイントがあります" />}
            </Link>
          )}
        </header>

        <main className="flex-1 px-4 pb-28 pt-4 md:pb-10">
          {game ? children : <p className="py-20 text-center font-mono text-muted">SYSTEM LOADING…</p>}
        </main>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-6 border-t border-line bg-bg/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
        {NAV.map((n) => (
          <Link
            key={n.href}
            href={n.href}
            className={cx("flex min-w-0 flex-col items-center gap-0.5 py-2 text-[10px]", isActive(n.href) ? "text-glow-strong" : "text-muted")}
          >
            <Icon d={n.icon} />
            {n.label}
          </Link>
        ))}
      </nav>

      <SystemNotices />
    </div>
  );
}
