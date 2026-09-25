"use client";

import { useState, type FormEvent } from "react";
import { NutrientBars } from "@/components/NutrientBars";
import { Button, Card, ErrorNote, Field, Input, PageHeader, Select, Spinner, Textarea, cx } from "@/components/ui";
import type { EstimateResult } from "@/lib/ai/schemas";
import { MEAL_LABELS, addMeals, deleteMeal, todayStr, type MealType } from "@/lib/db";
import { callApi, useDayIntake } from "@/lib/hooks";
import { NUTRIENT_KEYS, NUTRIENTS, emptyNutrients, fmt, type Nutrients } from "@/lib/nutrients";

function guessMealType(): MealType {
  const h = new Date().getHours();
  if (h < 10) return "breakfast";
  if (h < 15) return "lunch";
  if (h < 17) return "snack";
  return "dinner";
}

type Draft = EstimateResult["items"][number] & { checked: boolean };

export default function MealsPage() {
  const [date, setDate] = useState(todayStr());
  const [mealType, setMealType] = useState<MealType>(guessMealType);
  const [mode, setMode] = useState<"ai" | "manual">("ai");
  const { meals, intake, targets } = useDayIntake(date);

  // AI 推定
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [note, setNote] = useState("");

  // 手入力
  const [manual, setManual] = useState({ name: "", amount: "", nutrients: emptyNutrients() });

  async function estimate(e: FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await callApi<EstimateResult>("/api/estimate", { text });
      setDrafts(res.items.map((i) => ({ ...i, checked: true })));
      setNote(res.note);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function saveEntries(entries: { name: string; amount: string; nutrients: Nutrients }[]) {
    await addMeals(entries.map((e) => ({ ...e, date, mealType })));
  }

  async function saveDrafts() {
    await saveEntries(drafts.filter((d) => d.checked));
    setDrafts([]);
    setText("");
    setNote("");
  }

  async function saveManual(e: FormEvent) {
    e.preventDefault();
    if (!manual.name.trim()) return;
    await saveEntries([manual]);
    setManual({ name: "", amount: "", nutrients: emptyNutrients() });
  }

  const grouped = (Object.keys(MEAL_LABELS) as MealType[])
    .map((t) => ({ type: t, items: meals.filter((m) => m.mealType === t) }))
    .filter((g) => g.items.length > 0);

  return (
    <>
      <PageHeader title="食事記録" description="食べたものを文章で入力すると、AIが栄養素を推定します" />

      <div className="grid gap-4 md:grid-cols-[1fr_320px]">
        <div className="flex flex-col gap-4">
          <Card>
            <div className="mb-3 grid grid-cols-2 gap-3">
              <Field label="日付">
                <Input type="date" value={date} max={todayStr()} onChange={(e) => setDate(e.target.value || todayStr())} />
              </Field>
              <Field label="食事">
                <Select value={mealType} onChange={(e) => setMealType(e.target.value as MealType)}>
                  {Object.entries(MEAL_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>

            <div className="mb-3 inline-flex rounded-xl bg-subtle p-1 text-sm">
              {(["ai", "manual"] as const).map((m) => (
                <button key={m} onClick={() => setMode(m)} className={cx("rounded-lg px-3 py-1", mode === m ? "bg-surface shadow-sm" : "text-muted")}>
                  {m === "ai" ? "AIで推定" : "手入力"}
                </button>
              ))}
            </div>

            {mode === "ai" ? (
              <form onSubmit={estimate} className="space-y-3">
                <Textarea
                  rows={3}
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder="例: ご飯 茶碗1杯、豚の生姜焼き、キャベツの千切り、味噌汁（豆腐とわかめ）"
                />
                <ErrorNote message={error} />
                <Button type="submit" disabled={loading || !text.trim()} className="w-full md:w-auto">
                  {loading ? <Spinner /> : null}
                  {loading ? "推定中…" : "栄養素を推定する"}
                </Button>
              </form>
            ) : (
              <form onSubmit={saveManual} className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <Field label="料理・食品名">
                    <Input required value={manual.name} onChange={(e) => setManual({ ...manual, name: e.target.value })} />
                  </Field>
                  <Field label="量">
                    <Input value={manual.amount} placeholder="例: 1人前" onChange={(e) => setManual({ ...manual, amount: e.target.value })} />
                  </Field>
                </div>
                <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                  {NUTRIENT_KEYS.map((k) => (
                    <Field key={k} label={`${NUTRIENTS[k].label} (${NUTRIENTS[k].unit})`}>
                      <Input
                        type="number"
                        inputMode="decimal"
                        min="0"
                        step="any"
                        value={manual.nutrients[k] || ""}
                        onChange={(e) => setManual({ ...manual, nutrients: { ...manual.nutrients, [k]: Number(e.target.value) || 0 } })}
                      />
                    </Field>
                  ))}
                </div>
                <Button type="submit">記録する</Button>
              </form>
            )}
          </Card>

          {drafts.length > 0 && (
            <Card title="推定結果（保存するものを選択）">
              <ul className="space-y-3">
                {drafts.map((d, i) => (
                  <li key={i} className="rounded-xl border border-line p-3">
                    <label className="flex items-start gap-3">
                      <input
                        type="checkbox"
                        className="mt-1 h-4 w-4 accent-[var(--brand)]"
                        checked={d.checked}
                        onChange={(e) => setDrafts(drafts.map((x, j) => (j === i ? { ...x, checked: e.target.checked } : x)))}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="font-medium">{d.name}</span>
                        <span className="ml-2 text-sm text-muted">{d.amount}</span>
                        <span className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted">
                          {NUTRIENT_KEYS.map((k) => (
                            <span key={k}>
                              {NUTRIENTS[k].label} {fmt(d.nutrients[k], k)}
                              {NUTRIENTS[k].unit}
                            </span>
                          ))}
                        </span>
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
              {note && <p className="mt-3 text-xs text-muted">※ {note}</p>}
              <div className="mt-3 flex gap-2">
                <Button onClick={saveDrafts} disabled={!drafts.some((d) => d.checked)}>
                  {MEAL_LABELS[mealType]}として記録
                </Button>
                <Button variant="ghost" onClick={() => setDrafts([])}>
                  取り消し
                </Button>
              </div>
            </Card>
          )}

          <Card title={`${date === todayStr() ? "今日" : date} の記録`}>
            {grouped.length === 0 ? (
              <p className="text-sm text-muted">記録はまだありません</p>
            ) : (
              <div className="space-y-4">
                {grouped.map((g) => (
                  <div key={g.type}>
                    <h3 className="mb-1 text-xs font-semibold text-muted">{MEAL_LABELS[g.type]}</h3>
                    <ul className="divide-y divide-line">
                      {g.items.map((m) => (
                        <li key={m.id} className="flex items-center gap-2 py-2 text-sm">
                          <span className="min-w-0 flex-1 truncate">
                            {m.name}
                            {m.amount && <span className="ml-2 text-muted">{m.amount}</span>}
                          </span>
                          <span className="tabular-nums text-muted">{Math.round(m.nutrients.energy)}kcal</span>
                          <Button variant="danger" className="px-2 py-1" onClick={() => deleteMeal(m.id!)}>
                            削除
                          </Button>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>

        <Card title="この日の合計" className="self-start md:sticky md:top-8">
          <NutrientBars intake={intake} targets={targets} compact />
        </Card>
      </div>
    </>
  );
}
