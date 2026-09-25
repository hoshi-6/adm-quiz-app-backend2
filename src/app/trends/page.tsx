"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { useEffect, useRef, useState } from "react";
import { Badge, Card, PageHeader, cx } from "@/components/ui";
import { db, todayStr } from "@/lib/db";
import { useSettings } from "@/lib/hooks";
import { NUTRIENT_KEYS, NUTRIENTS, emptyNutrients, fmt, sumNutrients, type NutrientKey, type Nutrients } from "@/lib/nutrients";

const RANGES = [
  { days: 7, label: "7日" },
  { days: 14, label: "2週間" },
  { days: 30, label: "30日" },
];

interface Day {
  date: string;
  /** その日に記録がなければ null */
  total: Nutrients | null;
}

function lastDays(n: number): string[] {
  const out: string[] = [];
  const d = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const x = new Date(d.getFullYear(), d.getMonth(), d.getDate() - i);
    out.push(todayStr(x));
  }
  return out;
}

export default function TrendsPage() {
  const { targets } = useSettings();
  const [range, setRange] = useState(7);
  const [key, setKey] = useState<NutrientKey>("energy");
  const dates = lastDays(range);

  const days = useLiveQuery(async (): Promise<Day[]> => {
    const meals = await db.meals.where("date").between(dates[0], dates[dates.length - 1], true, true).toArray();
    return dates.map((date) => {
      const mine = meals.filter((m) => m.date === date);
      return { date, total: mine.length ? sumNutrients(mine.map((m) => m.nutrients)) : null };
    });
    // dates は range から決まるので、range を依存に入れれば十分
  }, [range]);

  const recorded = (days ?? []).filter((d) => d.total);
  const average = recorded.length ? sumNutrients(recorded.map((d) => d.total!)) : emptyNutrients();
  for (const k of NUTRIENT_KEYS) average[k] = recorded.length ? average[k] / recorded.length : 0;

  return (
    <>
      <PageHeader title="栄養の推移" description="日ごとの摂取量と、期間の平均を確認できます" />

      {/* 期間と栄養素の切り替え（グラフの上に1列で並べる） */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="inline-flex rounded-xl bg-subtle p-1 text-sm" role="group" aria-label="期間">
          {RANGES.map((r) => (
            <button
              key={r.days}
              onClick={() => setRange(r.days)}
              aria-pressed={range === r.days}
              className={cx("rounded-lg px-3 py-1", range === r.days ? "bg-surface font-medium shadow-sm" : "text-muted")}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      <Card className="mb-4">
        <div className="-mx-1 mb-3 flex gap-1.5 overflow-x-auto px-1 pb-1" role="group" aria-label="栄養素">
          {NUTRIENT_KEYS.map((k) => (
            <button
              key={k}
              onClick={() => setKey(k)}
              aria-pressed={key === k}
              className={cx(
                "shrink-0 rounded-full border px-3 py-1 text-xs",
                key === k ? "border-brand bg-brand/10 font-medium text-brand" : "border-line text-muted",
              )}
            >
              {NUTRIENTS[k].label}
            </button>
          ))}
        </div>
        <h2 className="text-sm font-semibold">
          {NUTRIENTS[key].label}（{NUTRIENTS[key].unit}／日）
        </h2>
        <p className="mb-2 text-xs text-muted">
          {NUTRIENTS[key].kind === "max" ? "上限" : "目標"} {fmt(targets[key], key)}
          {NUTRIENTS[key].unit} ・ 記録した日の平均 {recorded.length ? `${fmt(average[key], key)}${NUTRIENTS[key].unit}` : "—"}
        </p>
        {days && <DailyChart days={days} nutrient={key} target={targets[key]} />}
      </Card>

      <Card title={`期間の平均（記録した${recorded.length}日）`}>
        {recorded.length === 0 ? (
          <p className="text-sm text-muted">この期間の食事記録はありません</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-muted">
                <th className="py-1 font-normal">栄養素</th>
                <th className="py-1 text-right font-normal">平均／日</th>
                <th className="py-1 text-right font-normal">目標</th>
                <th className="py-1 text-right font-normal">達成率</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {NUTRIENT_KEYS.map((k) => {
                const def = NUTRIENTS[k];
                const pct = targets[k] ? Math.round((average[k] / targets[k]) * 100) : 0;
                const status = def.kind === "max" ? (pct > 100 ? "over" : "ok") : pct < 60 ? "low" : pct < 90 ? "short" : "ok";
                return (
                  <tr key={k}>
                    <td className="py-1.5">
                      <button className="text-left hover:underline" onClick={() => setKey(k)}>
                        {def.label}
                      </button>
                    </td>
                    <td className="py-1.5 text-right tabular-nums">
                      {fmt(average[k], k)}
                      <span className="text-xs text-muted">{def.unit}</span>
                    </td>
                    <td className="py-1.5 text-right tabular-nums text-muted">
                      {def.kind === "max" ? "≦" : ""}
                      {fmt(targets[k], k)}
                    </td>
                    <td className="py-1.5 text-right">
                      <span className="mr-1.5 tabular-nums">{pct}%</span>
                      {status === "low" && <Badge tone="danger">不足</Badge>}
                      {status === "short" && <Badge tone="warn">やや不足</Badge>}
                      {status === "over" && <Badge tone="danger">とりすぎ</Badge>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Card>
    </>
  );
}

/** 軸の目盛りをきりのよい数にする */
function niceStep(max: number) {
  const raw = max / 4;
  const pow = 10 ** Math.floor(Math.log10(raw || 1));
  const n = raw / pow;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * pow;
}

function DailyChart({ days, nutrient, target }: { days: Day[]; nutrient: NutrientKey; target: number }) {
  const wrap = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [hover, setHover] = useState<number | null>(null);

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setWidth(e.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const def = NUTRIENTS[nutrient];
  const values = days.map((d) => (d.total ? d.total[nutrient] : null));
  const maxValue = Math.max(target, ...values.map((v) => v ?? 0));
  const step = niceStep(maxValue * 1.1);
  const yMax = Math.ceil((maxValue * 1.1) / step) * step || 1;
  const ticks = Array.from({ length: Math.round(yMax / step) + 1 }, (_, i) => i * step);

  const H = 220;
  const M = { top: 12, right: 8, bottom: 24, left: 44 };
  const plotW = Math.max(0, width - M.left - M.right);
  const plotH = H - M.top - M.bottom;
  const band = days.length ? plotW / days.length : 0;
  const barW = Math.min(24, band * 0.6);
  const y = (v: number) => M.top + plotH - (v / yMax) * plotH;
  const labelEvery = days.length > 14 ? 5 : days.length > 7 ? 2 : 1;

  const hovered = hover === null ? null : days[hover];
  const hoveredValue = hover === null ? null : values[hover];

  return (
    <div ref={wrap} className="relative w-full" onPointerLeave={() => setHover(null)}>
      {width > 0 && (
        <svg width={width} height={H} role="img" aria-label={`${def.label}の日ごとの摂取量`}>
          {/* 目盛り線（控えめな細線） */}
          {ticks.map((t) => (
            <g key={t}>
              <line x1={M.left} x2={width - M.right} y1={y(t)} y2={y(t)} stroke="var(--line)" strokeWidth={1} />
              <text x={M.left - 6} y={y(t)} dy="0.32em" textAnchor="end" fontSize={10} fill="var(--muted)">
                {t.toLocaleString("ja-JP", { maximumFractionDigits: 1 })}
              </text>
            </g>
          ))}

          {/* 棒（下は角なし、上だけ4pxの角丸） */}
          {values.map((v, i) => {
            if (v === null || v <= 0) return null;
            const x = M.left + i * band + (band - barW) / 2;
            const top = y(v);
            const h = M.top + plotH - top;
            const r = Math.min(4, h, barW / 2);
            const d = `M${x},${M.top + plotH} V${top + r} Q${x},${top} ${x + r},${top} H${x + barW - r} Q${x + barW},${top} ${x + barW},${top + r} V${M.top + plotH} Z`;
            return <path key={days[i].date} d={d} fill="var(--chart-1)" opacity={hover === null || hover === i ? 1 : 0.55} />;
          })}

          {/* 目標（上限）の線 */}
          {target > 0 && (
            <g>
              <line x1={M.left} x2={width - M.right} y1={y(target)} y2={y(target)} stroke="var(--fg)" strokeWidth={1} opacity={0.6} />
              <text x={width - M.right} y={y(target) - 4} textAnchor="end" fontSize={10} fill="var(--muted)">
                {def.kind === "max" ? "上限" : "目標"}
              </text>
            </g>
          )}

          {/* 日付 */}
          {days.map((d, i) =>
            i % labelEvery === 0 || i === days.length - 1 ? (
              <text key={d.date} x={M.left + i * band + band / 2} y={H - 6} textAnchor="middle" fontSize={10} fill="var(--muted)">
                {Number(d.date.slice(5, 7))}/{Number(d.date.slice(8))}
              </text>
            ) : null,
          )}

          {/* 当たり判定（棒より広い、日ごとの帯） */}
          {days.map((d, i) => (
            <rect
              key={d.date}
              x={M.left + i * band}
              y={M.top}
              width={band}
              height={plotH}
              fill="transparent"
              tabIndex={0}
              aria-label={`${d.date} ${values[i] === null ? "記録なし" : `${fmt(values[i]!, nutrient)}${def.unit}`}`}
              onPointerEnter={() => setHover(i)}
              onPointerDown={() => setHover(i)}
              onFocus={() => setHover(i)}
              onBlur={() => setHover(null)}
              className="outline-none"
            />
          ))}
        </svg>
      )}

      {hovered && hover !== null && (
        <div
          className="pointer-events-none absolute top-0 z-10 -translate-x-1/2 rounded-lg border border-line bg-surface px-2.5 py-1.5 text-xs shadow-md"
          style={{ left: Math.min(Math.max(M.left + hover * band + band / 2, 60), width - 60) }}
        >
          <div className="text-sm font-semibold tabular-nums">
            {hoveredValue === null ? "記録なし" : `${fmt(hoveredValue, nutrient)}${def.unit}`}
          </div>
          <div className="text-muted">
            {Number(hovered.date.slice(5, 7))}月{Number(hovered.date.slice(8))}日
            {hoveredValue !== null && target > 0 && `・${def.kind === "max" ? "上限" : "目標"}の${Math.round((hoveredValue / target) * 100)}%`}
          </div>
        </div>
      )}
    </div>
  );
}
