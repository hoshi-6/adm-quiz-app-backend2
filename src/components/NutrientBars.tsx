"use client";

import { useState } from "react";
import { GROUP_LABELS, NUTRIENT_GROUPS, NUTRIENTS, fmt, type NutrientKey, type Nutrients } from "@/lib/nutrients";
import { cx } from "./ui";

function Bar({ k, intake, target }: { k: NutrientKey; intake: number; target: number }) {
  const def = NUTRIENTS[k];
  const ratio = intake / (target || 1);
  const over = def.kind === "max" && ratio > 1;
  const done = def.kind === "min" && ratio >= 1;
  const color = over ? "bg-danger" : done ? "bg-brand" : ratio >= 0.6 ? "bg-brand/60" : "bg-warn";
  return (
    <li>
      <div className="mb-1 flex items-baseline justify-between gap-2 text-sm">
        <span>
          {def.label}
          {def.kind === "max" && <span className="ml-1 text-xs text-muted">（上限）</span>}
        </span>
        <span className="shrink-0 tabular-nums text-muted">
          <span className={cx("font-semibold", over ? "text-danger" : "text-fg")}>{fmt(intake, k)}</span> / {fmt(target, k)}
          {def.unit}
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-subtle" role="progressbar" aria-valuenow={Math.round(ratio * 100)} aria-valuemin={0} aria-valuemax={100} aria-label={def.label}>
        <div className={cx("h-full rounded-full transition-all", color)} style={{ width: `${Math.min(ratio, 1) * 100}%` }} />
      </div>
    </li>
  );
}

/** 栄養素ごとの摂取量と目標の棒。ミネラル・ビタミンは開閉できる */
export function NutrientBars({ intake, targets, compact }: { intake: Nutrients; targets: Nutrients; compact?: boolean }) {
  const [open, setOpen] = useState<Record<string, boolean>>({ main: true });
  return (
    <div className="space-y-3">
      {NUTRIENT_GROUPS.map(({ group, keys }) => {
        const short = keys.filter((k) => (NUTRIENTS[k].kind === "min" ? intake[k] < targets[k] : intake[k] > targets[k])).length;
        const isOpen = open[group] ?? false;
        return (
          <section key={group}>
            <button
              type="button"
              className="mb-2 flex w-full items-center justify-between text-left text-xs font-semibold text-muted"
              aria-expanded={isOpen}
              onClick={() => setOpen({ ...open, [group]: !isOpen })}
            >
              <span>
                {GROUP_LABELS[group]}
                {short > 0 && <span className="ml-2 font-normal text-warn">目標に届かない項目 {short}</span>}
              </span>
              <span aria-hidden>{isOpen ? "▲" : "▼"}</span>
            </button>
            {isOpen && (
              <ul className={cx("grid gap-x-6", compact ? "gap-y-2" : "gap-y-3 md:grid-cols-2")}>
                {keys.map((k) => (
                  <Bar key={k} k={k} intake={intake[k]} target={targets[k]} />
                ))}
              </ul>
            )}
          </section>
        );
      })}
    </div>
  );
}

/** 栄養素の一覧を小さな表で見せる（主要な栄養素だけ先に出し、残りは開閉） */
export function NutrientTable({ nutrients, caption }: { nutrients: Nutrients; caption?: string }) {
  const [all, setAll] = useState(false);
  const groups = all ? NUTRIENT_GROUPS : NUTRIENT_GROUPS.slice(0, 1);
  return (
    <div className="text-xs text-muted">
      {caption && <p className="mb-0.5 font-medium">{caption}</p>}
      {groups.map(({ group, keys }) => (
        <div key={group} className="mb-1 grid grid-cols-2 gap-x-3 gap-y-0.5">
          {all && <span className="col-span-2 mt-1 font-medium">{GROUP_LABELS[group]}</span>}
          {keys.map((k) => (
            <span key={k} className="flex justify-between gap-2">
              <span className="truncate">{NUTRIENTS[k].label}</span>
              <span className="shrink-0 tabular-nums">
                {fmt(nutrients[k], k)}
                {NUTRIENTS[k].unit}
              </span>
            </span>
          ))}
        </div>
      ))}
      <button type="button" className="text-brand underline" onClick={() => setAll(!all)}>
        {all ? "主要な栄養素だけ表示" : "ビタミン・ミネラルも表示"}
      </button>
    </div>
  );
}
