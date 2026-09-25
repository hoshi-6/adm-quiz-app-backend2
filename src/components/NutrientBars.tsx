"use client";

import { NUTRIENT_KEYS, NUTRIENTS, fmt, type Nutrients } from "@/lib/nutrients";
import { cx } from "./ui";

export function NutrientBars({ intake, targets, compact }: { intake: Nutrients; targets: Nutrients; compact?: boolean }) {
  return (
    <ul className={cx("grid gap-x-6", compact ? "gap-y-2" : "gap-y-3 md:grid-cols-2")}>
      {NUTRIENT_KEYS.map((k) => {
        const def = NUTRIENTS[k];
        const target = targets[k] || 1;
        const ratio = intake[k] / target;
        const over = def.kind === "max" && ratio > 1;
        const done = def.kind === "min" && ratio >= 1;
        const color = over ? "bg-danger" : done ? "bg-brand" : ratio >= 0.6 ? "bg-brand/60" : "bg-warn";
        return (
          <li key={k}>
            <div className="mb-1 flex items-baseline justify-between text-sm">
              <span>
                {def.label}
                {def.kind === "max" && <span className="ml-1 text-xs text-muted">（上限）</span>}
              </span>
              <span className="tabular-nums text-muted">
                <span className={cx("font-semibold", over ? "text-danger" : "text-fg")}>{fmt(intake[k], k)}</span> / {fmt(targets[k], k)}
                {def.unit}
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-subtle" role="progressbar" aria-valuenow={Math.round(ratio * 100)} aria-valuemin={0} aria-valuemax={100} aria-label={def.label}>
              <div className={cx("h-full rounded-full transition-all", color)} style={{ width: `${Math.min(ratio, 1) * 100}%` }} />
            </div>
          </li>
        );
      })}
    </ul>
  );
}
