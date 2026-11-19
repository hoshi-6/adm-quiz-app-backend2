"use client";

import { Window, cx } from "@/components/ui";
import { WEEKDAYS, addDays, diffDays, formatDate, toDateKey, weekday } from "@/lib/date";
import { type GameState, bestStreak, clearCount, currentStreak, isRestDay, questProgress } from "@/lib/game";
import { useGame } from "@/lib/store";

type Cell = "clear" | "partial" | "miss" | "rest" | "today" | "none";

function cellOf(game: GameState, d: string, today: string): Cell {
  if (d > today || d < game.startedOn) return "none";
  const rec = game.days[d];
  if (rec?.cleared) return "clear";
  if (rec?.rest ?? isRestDay(game, d)) return "rest";
  if (d === today) return "today";
  if (rec && questProgress(rec) > 0) return "partial";
  return "miss";
}

const CELL_CLS: Record<Cell, string> = {
  clear: "bg-glow shadow-[0_0_6px_rgba(69,184,255,.8)]",
  partial: "bg-glow/30",
  miss: "bg-danger/50",
  rest: "bg-muted/25",
  today: "border border-glow bg-transparent",
  none: "bg-subtle/40",
};

export default function LogPage() {
  const game = useGame()!;
  const today = toDateKey();
  const clears = clearCount(game);
  const elapsed = Math.max(1, diffDays(game.startedOn, today) + 1);
  const questDays = Array.from({ length: elapsed }, (_, i) => addDays(game.startedOn, i)).filter(
    (d) => d < today && !(game.days[d]?.rest ?? isRestDay(game, d)),
  ).length;
  const pastClears = Object.values(game.days).filter((d) => d.cleared && d.date < today).length;

  // 直近 15 週。左上が最も古い日曜日
  const WEEKS = 15;
  const start = addDays(today, -weekday(today) - (WEEKS - 1) * 7);
  const weeks = Array.from({ length: WEEKS }, (_, w) => Array.from({ length: 7 }, (_, d) => addDays(start, w * 7 + d)));

  const totals = new Map<string, { name: string; unit: string; total: number }>();
  for (const rec of Object.values(game.days)) {
    for (const i of rec.items) {
      const t = totals.get(i.exerciseId) ?? { name: i.name, unit: i.unit, total: 0 };
      t.total += i.done;
      totals.set(i.exerciseId, t);
    }
  }

  const recent = Object.values(game.days)
    .filter((d) => d.items.length > 0)
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 14);

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Summary label="クリア回数" value={clears} unit="回" />
        <Summary label="連続クリア" value={currentStreak(game, today)} unit="日" />
        <Summary label="最高連続" value={bestStreak(game)} unit="日" />
        <Summary label="達成率" value={questDays ? Math.round((pastClears / questDays) * 100) : "—"} unit={questDays ? "%" : ""} />
      </div>

      <Window title="クエスト記録">
        <div className="flex gap-1.5">
          <div className="grid grid-rows-7 gap-1 text-[9px] leading-none text-muted">
            {WEEKDAYS.map((w) => (
              <span key={w} className="flex h-3.5 items-center sm:h-4">
                {w}
              </span>
            ))}
          </div>
          <div className="flex flex-1 justify-between gap-1">
            {weeks.map((wk) => (
              <div key={wk[0]} className="grid grid-rows-7 gap-1">
                {wk.map((d) => {
                  const c = cellOf(game, d, today);
                  return <span key={d} className={cx("h-3.5 w-3.5 rounded-sm sm:h-4 sm:w-4", CELL_CLS[c])} title={`${formatDate(d)}`} />;
                })}
              </div>
            ))}
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted">
          {(
            [
              ["clear", "クリア"],
              ["partial", "途中まで"],
              ["miss", "未達成"],
              ["rest", "休息日"],
            ] as const
          ).map(([k, l]) => (
            <span key={k} className="flex items-center gap-1">
              <span className={cx("inline-block h-2.5 w-2.5 rounded-sm", CELL_CLS[k])} />
              {l}
            </span>
          ))}
        </div>
      </Window>

      {totals.size > 0 && (
        <Window title="累計">
          <ul className="grid grid-cols-2 gap-3">
            {[...totals.entries()].map(([id, t]) => (
              <li key={id} className="rounded border border-line/70 p-2">
                <p className="truncate text-xs text-muted">{t.name}</p>
                <p className="font-mono text-xl tabular-nums">
                  {t.unit === "km" ? t.total.toFixed(1) : t.total.toLocaleString()}
                  <span className="ml-1 text-xs text-muted">{t.unit}</span>
                </p>
              </li>
            ))}
          </ul>
        </Window>
      )}

      {recent.length > 0 && (
        <Window title="最近のクエスト">
          <ul className="flex flex-col divide-y divide-line/60 text-sm">
            {recent.map((d) => (
              <li key={d.date} className="flex items-center gap-3 py-2">
                <span className="w-20 shrink-0 text-muted">{formatDate(d.date)}</span>
                <span className="min-w-0 flex-1 truncate text-xs text-fg/80">
                  {d.items.map((i) => `${i.name} ${i.unit === "km" ? i.done.toFixed(1) : i.done}/${i.target}`).join("・")}
                </span>
                <span className={cx("shrink-0 font-mono text-xs font-bold", d.cleared ? "text-ok" : d.date === today ? "text-glow" : "text-danger")}>
                  {d.cleared ? `CLEAR +${d.xpGained ?? 0}` : d.date === today ? `${Math.round(questProgress(d) * 100)}%` : "FAILED"}
                </span>
              </li>
            ))}
          </ul>
        </Window>
      )}
    </div>
  );
}

function Summary({ label, value, unit }: { label: string; value: number | string; unit: string }) {
  return (
    <div className="sys-window rounded-md p-3">
      <p className="text-xs text-muted">{label}</p>
      <p className="font-mono text-2xl font-bold tabular-nums text-glow-strong glow-text">
        {value}
        <span className="ml-1 text-xs font-normal text-muted">{unit}</span>
      </p>
    </div>
  );
}
