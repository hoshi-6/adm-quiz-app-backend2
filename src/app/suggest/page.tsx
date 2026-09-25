"use client";

import { useLiveQuery } from "dexie-react-hooks";
import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { Badge, Button, Card, ErrorNote, Field, Input, PageHeader, Select, Spinner, Textarea } from "@/components/ui";
import type { SuggestRequest, SuggestResult } from "@/lib/ai/schemas";
import { MEAL_LABELS, addMeals, daysUntil, db, todayStr, type MealType } from "@/lib/db";
import { callApi, useDayIntake, useSettings } from "@/lib/hooks";
import { NUTRIENT_KEYS, NUTRIENTS, fmt } from "@/lib/nutrients";

const STORAGE_KEY = "gohan-navi:last-suggestion";

type Suggestion = SuggestResult["suggestions"][number];

export default function SuggestPage() {
  const settings = useSettings();
  const pantry = useLiveQuery(() => db.pantry.toArray(), []);
  const { meals, intake, targets, deficits } = useDayIntake();

  const [opts, setOpts] = useState({ mealType: "dinner" as MealType, servings: 1, maxMinutes: 30, prioritizeExpiring: true, request: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SuggestResult | null>(null);
  const [saved, setSaved] = useState<Record<number, boolean>>({});

  // 前回の提案を復元（タブを切り替えても消えないように）
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const { date, result } = JSON.parse(raw);
        // eslint-disable-next-line react-hooks/set-state-in-effect -- 初回マウント時に一度だけ復元する
        if (date === todayStr()) setResult(result);
      }
    } catch {}
  }, []);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSaved({});
    const body: SuggestRequest = {
      ...opts,
      mealType: MEAL_LABELS[opts.mealType],
      preferences: settings.preferences,
      pantry: (pantry ?? []).map((p) => ({
        name: p.name,
        category: p.category,
        quantity: p.quantity,
        unit: p.unit,
        daysLeft: p.expiresOn ? daysUntil(p.expiresOn) : null,
      })),
      status: NUTRIENT_KEYS.map((k) => ({
        label: NUTRIENTS[k].label,
        unit: NUTRIENTS[k].unit,
        kind: NUTRIENTS[k].kind,
        intake: Number(fmt(intake[k], k)),
        target: targets[k],
      })),
      eatenToday: meals.map((m) => `${MEAL_LABELS[m.mealType]}: ${m.name}${m.amount ? `（${m.amount}）` : ""}`),
    };
    try {
      const res = await callApi<SuggestResult>("/api/suggest", body);
      setResult(res);
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ date: todayStr(), result: res }));
      } catch {}
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function markEaten(s: Suggestion, index: number) {
    await addMeals([{ date: todayStr(), mealType: opts.mealType, name: s.title, amount: "1人前", nutrients: s.nutrientsPerServing }]);
    setSaved({ ...saved, [index]: true });
  }

  return (
    <>
      <PageHeader title="AI献立提案" description="在庫と今日の不足栄養素から、次の食事を提案します" />

      <Card className="mb-4">
        {deficits.length > 0 && (
          <div className="mb-3 flex flex-wrap items-center gap-1.5 text-sm">
            <span className="text-muted">補いたい栄養素:</span>
            {deficits.slice(0, 5).map((d) => (
              <Badge key={d.key} tone={d.ratio < 0.5 ? "danger" : "warn"}>
                {d.label}
              </Badge>
            ))}
          </div>
        )}
        <form onSubmit={submit} className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Field label="食事">
            <Select value={opts.mealType} onChange={(e) => setOpts({ ...opts, mealType: e.target.value as MealType })}>
              {Object.entries(MEAL_LABELS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="人数">
            <Input type="number" min={1} max={10} value={opts.servings} onChange={(e) => setOpts({ ...opts, servings: Math.max(1, Number(e.target.value) || 1) })} />
          </Field>
          <Field label="調理時間">
            <Select value={opts.maxMinutes} onChange={(e) => setOpts({ ...opts, maxMinutes: Number(e.target.value) })}>
              {[15, 30, 45, 60, 90].map((m) => (
                <option key={m} value={m}>
                  {m}分以内
                </option>
              ))}
            </Select>
          </Field>
          <label className="flex items-center gap-2 self-end pb-2 text-sm">
            <input type="checkbox" className="h-4 w-4 accent-[var(--brand)]" checked={opts.prioritizeExpiring} onChange={(e) => setOpts({ ...opts, prioritizeExpiring: e.target.checked })} />
            期限が近い食材を優先
          </label>
          <Field label="リクエスト（任意）" className="col-span-2 md:col-span-4">
            <Textarea rows={2} value={opts.request} placeholder="例: 魚料理がいい / 洗い物を少なく / 作り置きできるもの" onChange={(e) => setOpts({ ...opts, request: e.target.value })} />
          </Field>
          <div className="col-span-2 flex flex-wrap items-center gap-3 md:col-span-4">
            <Button type="submit" disabled={loading}>
              {loading && <Spinner />}
              {loading ? "考え中…（数十秒かかります）" : "献立を提案してもらう"}
            </Button>
            <span className="text-xs text-muted">
              在庫 {pantry?.length ?? 0}件 ・ 今日の記録 {meals.length}件
              {pantry?.length === 0 && (
                <Link href="/pantry" className="ml-2 text-brand underline">
                  在庫を登録
                </Link>
              )}
            </span>
          </div>
        </form>
        <div className="mt-3">
          <ErrorNote message={error} />
        </div>
      </Card>

      {result && (
        <>
          <p className="mb-4 rounded-2xl bg-brand/10 px-4 py-3 text-sm leading-relaxed">{result.summary}</p>
          <div className="grid gap-4 lg:grid-cols-3">
            {result.suggestions.map((s, i) => (
              <Card key={i} className="flex flex-col">
                <div className="mb-2 flex items-start justify-between gap-2">
                  <h2 className="font-bold leading-snug">{s.title}</h2>
                  <Badge>{s.cookingMinutes}分</Badge>
                </div>
                <p className="mb-3 text-sm text-muted">{s.reason}</p>

                <div className="mb-3 flex flex-wrap gap-1">
                  {s.usesFromPantry.map((p) => (
                    <Badge key={p} tone="good">
                      {p}
                    </Badge>
                  ))}
                  {s.needToBuy.map((p) => (
                    <Badge key={p} tone="warn">
                      買う: {p}
                    </Badge>
                  ))}
                </div>

                <details className="mb-3 text-sm">
                  <summary className="cursor-pointer font-medium text-brand">材料と作り方</summary>
                  <ul className="mt-2 list-disc space-y-0.5 pl-5">
                    {s.ingredients.map((x) => (
                      <li key={x}>{x}</li>
                    ))}
                  </ul>
                  <ol className="mt-2 list-decimal space-y-1 pl-5">
                    {s.steps.map((x, j) => (
                      <li key={j}>{x}</li>
                    ))}
                  </ol>
                </details>

                <div className="mb-3 grid grid-cols-2 gap-x-3 gap-y-0.5 text-xs text-muted">
                  {NUTRIENT_KEYS.map((k) => (
                    <span key={k} className="flex justify-between">
                      <span>{NUTRIENTS[k].label}</span>
                      <span className="tabular-nums">
                        {fmt(s.nutrientsPerServing[k], k)}
                        {NUTRIENTS[k].unit}
                      </span>
                    </span>
                  ))}
                </div>

                <Button variant="secondary" className="mt-auto" disabled={saved[i]} onClick={() => markEaten(s, i)}>
                  {saved[i] ? "記録しました ✓" : "これを食べた（記録する）"}
                </Button>
              </Card>
            ))}
          </div>
          <p className="mt-4 text-xs text-muted">※ 栄養素はAIによる推定値です。アレルギーや持病がある場合は、材料を必ずご自身で確認してください。</p>
        </>
      )}
    </>
  );
}
