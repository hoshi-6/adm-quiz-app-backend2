"use client";

import { useState } from "react";
import { Button, Field, Window, cx, inputCls } from "@/components/ui";
import { addDays, diffDays, formatDate, toDateKey } from "@/lib/date";
import type { BodyEntry } from "@/lib/game";
import { deleteBody, saveBody, useGame } from "@/lib/store";

type Metric = "weight" | "bodyFat" | "waist";
const METRICS: { key: Metric; label: string; unit: string }[] = [
  { key: "weight", label: "体重", unit: "kg" },
  { key: "bodyFat", label: "体脂肪率", unit: "%" },
  { key: "waist", label: "ウエスト", unit: "cm" },
];

const num = (s: string) => {
  const n = Number(s);
  return s.trim() !== "" && Number.isFinite(n) && n > 0 ? n : undefined;
};

export default function BodyPage() {
  const game = useGame()!;
  const today = toDateKey();
  const existing = game.body.find((b) => b.date === today);
  const latest = game.body[game.body.length - 1];
  const bmi = latest?.weight && game.heightCm ? latest.weight / (game.heightCm / 100) ** 2 : null;

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-4">
      <Window title="BODY">
        {latest ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {METRICS.map((m) => (
              <Stat key={m.key} label={m.label} unit={m.unit} entries={game.body} metric={m.key} />
            ))}
            <div className="rounded border border-line/70 p-2">
              <p className="text-xs text-muted">BMI</p>
              <p className="font-mono text-xl tabular-nums">{bmi ? bmi.toFixed(1) : "—"}</p>
              <p className="text-[11px] text-muted">{game.heightCm ? `身長 ${game.heightCm}cm` : "身長は設定で登録"}</p>
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted">まだ記録がありません。今日の体重から記録してみましょう。</p>
        )}
      </Window>

      <BodyForm key={existing ? `e-${today}` : "new"} initial={existing} />

      {game.body.length >= 2 && <Chart entries={game.body} />}

      {game.body.length > 0 && (
        <Window title="履歴">
          <ul className="flex flex-col divide-y divide-line/60 text-sm">
            {[...game.body].reverse().slice(0, 60).map((b) => (
              <li key={b.date} className="flex items-center gap-3 py-2">
                <span className="w-20 shrink-0 text-muted">{formatDate(b.date)}</span>
                <span className="min-w-0 flex-1 font-mono tabular-nums">
                  {[b.weight && `${b.weight}kg`, b.bodyFat && `${b.bodyFat}%`, b.waist && `W${b.waist}cm`].filter(Boolean).join("  ")}
                  {b.note && <span className="block truncate font-sans text-xs text-muted">{b.note}</span>}
                </span>
                <button
                  className="shrink-0 text-xs text-muted hover:text-danger"
                  onClick={() => confirm(`${formatDate(b.date)}の記録を削除しますか？`) && deleteBody(b.date)}
                >
                  削除
                </button>
              </li>
            ))}
          </ul>
        </Window>
      )}
    </div>
  );
}

function Stat({ label, unit, entries, metric }: { label: string; unit: string; entries: BodyEntry[]; metric: Metric }) {
  const withVal = entries.filter((e) => e[metric] != null);
  const last = withVal[withVal.length - 1];
  const first = withVal[0];
  const delta = last && first && last !== first ? (last[metric]! - first[metric]!) : null;
  return (
    <div className="rounded border border-line/70 p-2">
      <p className="text-xs text-muted">{label}</p>
      <p className="font-mono text-xl tabular-nums">
        {last ? last[metric] : "—"}
        <span className="ml-0.5 text-xs text-muted">{last ? unit : ""}</span>
      </p>
      <p className={cx("font-mono text-[11px]", delta == null ? "text-muted" : delta <= 0 ? "text-ok" : "text-gold")}>
        {delta == null ? "　" : `開始から ${delta > 0 ? "+" : ""}${delta.toFixed(1)}`}
      </p>
    </div>
  );
}

function BodyForm({ initial }: { initial?: BodyEntry }) {
  const [date, setDate] = useState(initial?.date ?? toDateKey());
  const [weight, setWeight] = useState(initial?.weight?.toString() ?? "");
  const [fat, setFat] = useState(initial?.bodyFat?.toString() ?? "");
  const [waist, setWaist] = useState(initial?.waist?.toString() ?? "");
  const [note, setNote] = useState(initial?.note ?? "");
  const [saved, setSaved] = useState(false);
  const valid = num(weight) || num(fat) || num(waist);

  return (
    <Window title="記録する">
      <form
        className="grid grid-cols-2 gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (!valid) return;
          saveBody({ date, weight: num(weight), bodyFat: num(fat), waist: num(waist), note: note.trim() || undefined });
          setSaved(true);
          setTimeout(() => setSaved(false), 2000);
        }}
      >
        <Field label="日付">
          <input type="date" className={inputCls} value={date} max={toDateKey()} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <Field label="体重（kg）">
          <input className={inputCls} inputMode="decimal" value={weight} onChange={(e) => setWeight(e.target.value)} placeholder="65.0" />
        </Field>
        <Field label="体脂肪率（%）">
          <input className={inputCls} inputMode="decimal" value={fat} onChange={(e) => setFat(e.target.value)} placeholder="18.0" />
        </Field>
        <Field label="ウエスト（cm）">
          <input className={inputCls} inputMode="decimal" value={waist} onChange={(e) => setWaist(e.target.value)} placeholder="78" />
        </Field>
        <div className="col-span-2">
          <Field label="メモ">
            <input className={inputCls} value={note} onChange={(e) => setNote(e.target.value)} placeholder="体調・睡眠など" maxLength={100} />
          </Field>
        </div>
        <Button type="submit" className="col-span-2 py-2.5" disabled={!valid}>
          {saved ? "保存しました" : "保存"}
        </Button>
      </form>
    </Window>
  );
}

function Chart({ entries }: { entries: BodyEntry[] }) {
  const [metric, setMetric] = useState<Metric>("weight");
  const [range, setRange] = useState<30 | 90 | 0>(30);
  const m = METRICS.find((x) => x.key === metric)!;
  const today = toDateKey();
  const from = range ? addDays(today, -range + 1) : entries[0].date;
  const pts = entries.filter((e) => e[metric] != null && e.date >= from);

  const W = 320;
  const H = 160;
  const pad = { l: 36, r: 10, t: 10, b: 22 };
  const span = Math.max(1, diffDays(from, today));
  const vals = pts.map((p) => p[metric]!);
  const lo = Math.min(...vals);
  const hi = Math.max(...vals);
  const margin = Math.max(0.5, (hi - lo) * 0.15);
  const yMin = lo - margin;
  const yMax = hi + margin;
  const x = (d: string) => pad.l + (diffDays(from, d) / span) * (W - pad.l - pad.r);
  const y = (v: number) => pad.t + (1 - (v - yMin) / (yMax - yMin)) * (H - pad.t - pad.b);
  const path = pts.map((p, i) => `${i ? "L" : "M"}${x(p.date).toFixed(1)},${y(p[metric]!).toFixed(1)}`).join(" ");
  const ticks = [yMin + (yMax - yMin) * 0.1, (yMin + yMax) / 2, yMax - (yMax - yMin) * 0.1];

  return (
    <Window title="推移">
      <div className="mb-3 flex flex-wrap gap-1.5">
        {METRICS.map((x) => (
          <Button key={x.key} variant={metric === x.key ? "primary" : "ghost"} className="px-2.5 py-1 text-xs" onClick={() => setMetric(x.key)}>
            {x.label}
          </Button>
        ))}
        <span className="flex-1" />
        {([30, 90, 0] as const).map((r) => (
          <Button key={r} variant={range === r ? "primary" : "ghost"} className="px-2.5 py-1 text-xs" onClick={() => setRange(r)}>
            {r ? `${r}日` : "全期間"}
          </Button>
        ))}
      </div>
      {pts.length < 2 ? (
        <p className="py-8 text-center text-sm text-muted">この期間の{m.label}の記録が2件以上になるとグラフが出ます</p>
      ) : (
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={`${m.label}の推移グラフ`}>
          {ticks.map((t) => (
            <g key={t}>
              <line x1={pad.l} x2={W - pad.r} y1={y(t)} y2={y(t)} stroke="var(--line)" strokeDasharray="2 3" />
              <text x={pad.l - 4} y={y(t) + 3} textAnchor="end" fontSize="9" fill="var(--muted)">
                {t.toFixed(1)}
              </text>
            </g>
          ))}
          <text x={pad.l} y={H - 6} fontSize="9" fill="var(--muted)">
            {formatDate(from)}
          </text>
          <text x={W - pad.r} y={H - 6} fontSize="9" fill="var(--muted)" textAnchor="end">
            {formatDate(today)}
          </text>
          <path d={path} fill="none" stroke="var(--glow)" strokeWidth="2" strokeLinejoin="round" style={{ filter: "drop-shadow(0 0 4px rgba(69,184,255,.6))" }} />
          {pts.map((p) => (
            <circle key={p.date} cx={x(p.date)} cy={y(p[metric]!)} r="2.5" fill="var(--glow-strong)">
              <title>{`${formatDate(p.date)} ${p[metric]}${m.unit}`}</title>
            </circle>
          ))}
        </svg>
      )}
    </Window>
  );
}
