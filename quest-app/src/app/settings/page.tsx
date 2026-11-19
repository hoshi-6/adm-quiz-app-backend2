"use client";

import { useRef, useState } from "react";
import { Button, Field, Window, cx, inputCls } from "@/components/ui";
import { WEEKDAYS, toDateKey } from "@/lib/date";
import { DEFAULT_EXERCISES, type Exercise, type Unit, targetFor } from "@/lib/game";
import { exportData, importData, resetAll, saveSettings, setPlayer, useGame } from "@/lib/store";

const UNITS: Unit[] = ["回", "km", "秒", "分"];

const PRESETS: { label: string; desc: string; apply: (e: Exercise) => Exercise }[] = [
  { label: "やさしめ", desc: "5回・0.5kmから、ゆっくり増える", apply: (e) => (e.unit === "km" ? { ...e, base: 0.5, step: 0.1 } : { ...e, base: 5, step: 1 }) },
  { label: "標準", desc: "10回・1kmから", apply: (e) => { const d = DEFAULT_EXERCISES.find((x) => x.id === e.id); return d ? { ...e, base: d.base, step: d.step, max: d.max } : e; } },
  { label: "最初から全力", desc: "上限（100回・10km）で固定", apply: (e) => ({ ...e, base: e.max, step: 0 }) },
];

export default function SettingsPage() {
  const game = useGame()!;
  return (
    <div className="mx-auto flex max-w-xl flex-col gap-4">
      <Profile key={`${game.playerName}-${game.heightCm}`} name={game.playerName} height={game.heightCm} />
      <QuestSettings key={JSON.stringify([game.exercises, game.restDays])} exercises={game.exercises} restDays={game.restDays} level={game.level} />
      <Backup />
    </div>
  );
}

function Profile({ name: n0, height: h0 }: { name: string; height?: number }) {
  const [name, setName] = useState(n0);
  const [height, setHeight] = useState(h0?.toString() ?? "");
  const changed = name !== n0 || height !== (h0?.toString() ?? "");
  return (
    <Window title="プレイヤー">
      <form
        className="grid grid-cols-2 gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          const h = Number(height);
          setPlayer(name || n0, height && h > 0 ? h : undefined);
        }}
      >
        <Field label="プレイヤー名">
          <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} maxLength={20} />
        </Field>
        <Field label="身長（cm）">
          <input className={inputCls} inputMode="decimal" value={height} onChange={(e) => setHeight(e.target.value)} placeholder="170" />
        </Field>
        <Button type="submit" className="col-span-2" disabled={!changed}>
          保存
        </Button>
      </form>
    </Window>
  );
}

function QuestSettings({ exercises: ex0, restDays: r0, level }: { exercises: Exercise[]; restDays: number[]; level: number }) {
  const [exs, setExs] = useState(ex0);
  const [rest, setRest] = useState(r0);
  const [msg, setMsg] = useState("");
  const changed = JSON.stringify([exs, rest]) !== JSON.stringify([ex0, r0]);
  const upd = (i: number, patch: Partial<Exercise>) => setExs((xs) => xs.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  const valid = exs.every((e) => e.name.trim() && e.base > 0 && e.max >= e.base && e.step >= 0) && exs.some((e) => e.enabled);

  return (
    <Window title="クエスト設定">
      <p className="mb-2 text-xs text-muted">まとめて変更</p>
      <div className="mb-4 grid grid-cols-3 gap-2">
        {PRESETS.map((p) => (
          <button key={p.label} type="button" className="rounded border border-line p-2 text-left hover:border-glow/60" onClick={() => setExs((xs) => xs.map(p.apply))}>
            <p className="text-sm font-semibold">{p.label}</p>
            <p className="text-[11px] leading-snug text-muted">{p.desc}</p>
          </button>
        ))}
      </div>

      <ul className="flex flex-col gap-3">
        {exs.map((e, i) => (
          <li key={e.id} className={cx("rounded border border-line p-3", !e.enabled && "opacity-55")}>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={e.enabled}
                onChange={(ev) => upd(i, { enabled: ev.target.checked })}
                className="h-4 w-4 accent-[var(--glow)]"
                aria-label={`${e.name}をクエストに入れる`}
              />
              <input className={cx(inputCls, "flex-1 py-1.5")} value={e.name} onChange={(ev) => upd(i, { name: ev.target.value })} aria-label="種目名" />
              <select className="w-16 shrink-0 rounded border border-line bg-bg/70 px-2 py-1.5 text-fg outline-none focus:border-glow" value={e.unit} onChange={(ev) => upd(i, { unit: ev.target.value as Unit })} aria-label="単位">
                {UNITS.map((u) => (
                  <option key={u}>{u}</option>
                ))}
              </select>
            </div>
            <div className="mt-2 grid grid-cols-3 gap-2">
              <NumField label="Lv.1の目標" value={e.base} onChange={(v) => upd(i, { base: v })} />
              <NumField label="1Lvごとに+" value={e.step} onChange={(v) => upd(i, { step: v })} />
              <NumField label="上限" value={e.max} onChange={(v) => upd(i, { max: v })} />
            </div>
            <div className="mt-2 flex items-center justify-between text-xs text-muted">
              <span>
                いまのレベル（Lv.{level}）の目標：
                <span className="font-mono text-fg">
                  {targetFor(e, level)}
                  {e.unit}
                </span>
              </span>
              {!DEFAULT_EXERCISES.some((d) => d.id === e.id) && (
                <button type="button" className="hover:text-danger" onClick={() => setExs((xs) => xs.filter((_, j) => j !== i))}>
                  削除
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>
      <Button
        variant="ghost"
        className="mt-3 w-full"
        onClick={() => setExs((xs) => [...xs, { id: `c-${Date.now().toString(36)}`, name: "プランク", unit: "秒", base: 30, step: 3, max: 180, enabled: true }])}
      >
        ＋ 種目を追加
      </Button>

      <p className="mb-2 mt-5 text-sm text-muted">休息日（クエストなし・連続記録は途切れない）</p>
      <div className="grid grid-cols-7 gap-1.5">
        {WEEKDAYS.map((w, d) => {
          const on = rest.includes(d);
          return (
            <button
              key={w}
              type="button"
              className={cx("rounded border py-2 text-sm", on ? "border-glow bg-glow/15 text-glow-strong" : "border-line text-muted")}
              onClick={() => setRest((r) => (on ? r.filter((x) => x !== d) : [...r, d].sort()))}
              aria-pressed={on}
            >
              {w}
            </button>
          );
        })}
      </div>

      <div className="mt-5 flex items-center gap-3">
        <Button
          className="flex-1 py-2.5"
          disabled={!changed || !valid}
          onClick={() => {
            saveSettings({ exercises: exs.map((e) => ({ ...e, name: e.name.trim() })), restDays: rest });
            setMsg("保存しました。まだクリアしていない今日のクエストにも反映しました。");
          }}
        >
          保存
        </Button>
        {changed && (
          <Button variant="ghost" onClick={() => { setExs(ex0); setRest(r0); }}>
            元に戻す
          </Button>
        )}
      </div>
      {!valid && <p className="mt-2 text-xs text-danger">種目名・目標（0より大きい）・上限（目標以上）を確認してください。種目は1つ以上必要です。</p>}
      {msg && !changed && <p className="mt-2 text-xs text-ok">{msg}</p>}
    </Window>
  );
}

function NumField({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  const [text, setText] = useState(String(value));
  return (
    <Field label={label}>
      <input
        className={cx(inputCls, "py-1.5 font-mono")}
        inputMode="decimal"
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          const n = Number(e.target.value);
          if (e.target.value.trim() !== "" && Number.isFinite(n)) onChange(n);
        }}
      />
    </Field>
  );
}

function Backup() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [msg, setMsg] = useState("");
  return (
    <Window title="データ">
      <p className="text-xs leading-relaxed text-muted">
        記録はこの端末のブラウザに保存されています。機種変更やブラウザのデータ削除に備えて、ときどきバックアップしてください。
      </p>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <Button
          onClick={() => {
            const blob = new Blob([exportData()], { type: "application/json" });
            const a = document.createElement("a");
            a.href = URL.createObjectURL(blob);
            a.download = `level-quest-${toDateKey()}.json`;
            a.click();
            URL.revokeObjectURL(a.href);
          }}
        >
          バックアップを保存
        </Button>
        <Button variant="ghost" onClick={() => fileRef.current?.click()}>
          バックアップから復元
        </Button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={async (e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            if (!f) return;
            if (!confirm("いまの記録をバックアップの内容で置き換えます。よろしいですか？")) return;
            try {
              importData(await f.text());
              setMsg("復元しました。");
            } catch (err) {
              setMsg(`復元できませんでした：${err instanceof Error ? err.message : "ファイルを確認してください"}`);
            }
          }}
        />
      </div>
      {msg && <p className="mt-2 text-xs text-fg/80">{msg}</p>}
      <Button
        variant="danger"
        className="mt-4 w-full"
        onClick={() => confirm("レベル・クエスト・体の記録をすべて消して最初からやり直します。元に戻せません。よろしいですか？") && resetAll()}
      >
        すべてのデータを消して最初から
      </Button>
      <p className="mt-4 text-[11px] leading-relaxed text-muted">
        ※ 運動は体調に合わせて行ってください。痛み・めまい・息苦しさがあるときはすぐに中止し、持病のある方は医師に相談してください。
      </p>
    </Window>
  );
}
