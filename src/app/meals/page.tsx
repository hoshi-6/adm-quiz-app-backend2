"use client";

import { useState, type FormEvent } from "react";
import { toast } from "@/lib/toast";
import { NutrientBars, NutrientTable } from "@/components/NutrientBars";
import { Badge, Button, Card, ErrorNote, Field, Input, OptionalNumberInput, PageHeader, Select, Spinner, Textarea, cx } from "@/components/ui";
import { PhotoButton } from "@/components/PhotoButton";
import { StockPicker } from "@/components/pantry/StockPicker";
import type { EstimateResult, ImageInput } from "@/lib/ai/schemas";
import { MEAL_LABELS, addMeals, deleteMeal, guessMealType, todayStr, type MealType } from "@/lib/db";
import { callApi, useDayIntake } from "@/lib/hooks";
import { imageFileToInput } from "@/lib/image";
import { GROUP_LABELS, NUTRIENT_GROUPS, NUTRIENTS, completeNutrients, emptyNutrients, type Nutrients } from "@/lib/nutrients";

type Draft = EstimateResult["items"][number] & { checked: boolean };

export default function MealsPage() {
  const [date, setDate] = useState(todayStr());
  const [mealType, setMealType] = useState<MealType>(guessMealType);
  const [mode, setMode] = useState<"ai" | "stock" | "manual">("ai");
  const { meals, intake, targets } = useDayIntake(date);

  // AI 推定
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [note, setNote] = useState("");
  const [photo, setPhoto] = useState<ImageInput | null>(null);

  // 手入力
  const [manual, setManual] = useState({ name: "", amount: "", nutrients: emptyNutrients() });

  async function estimate(e: FormEvent) {
    e.preventDefault();
    if (!text.trim() && !photo) return;
    setLoading(true);
    setError(null);
    try {
      const res = await callApi<EstimateResult>("/api/estimate", { text, image: photo ?? undefined });
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
    toast(`${MEAL_LABELS[mealType]}に${entries.length}件記録しました`);
  }

  async function saveDrafts() {
    await saveEntries(drafts.filter((d) => d.checked));
    setDrafts([]);
    setText("");
    setPhoto(null);
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
      <PageHeader title="食事記録" description="食べたものを文章や写真で入力すると、AIが栄養素を調べます。市販品は公式の栄養成分表示を探します" />

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
              {(["ai", "stock", "manual"] as const).map((m) => (
                <button key={m} onClick={() => setMode(m)} className={cx("rounded-lg px-3 py-1", mode === m ? "bg-surface shadow-sm" : "text-muted")}>
                  {m === "ai" ? "AIで調べる" : m === "stock" ? "在庫から" : "手入力"}
                </button>
              ))}
            </div>

            {mode === "stock" ? (
              <StockPicker date={date} mealType={mealType} />
            ) : mode === "ai" ? (
              <form onSubmit={estimate} className="space-y-3">
                <Textarea
                  rows={3}
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder={photo ? "補足があれば（例: ご飯は半分残した）" : "例: ご飯 茶碗1杯、豚の生姜焼き、キャベツの千切り、味噌汁（豆腐とわかめ）"}
                />
                {photo ? (
                  <div className="flex items-center gap-3">
                    {/* eslint-disable-next-line @next/next/no-img-element -- 端末内の写真のプレビュー */}
                    <img src={`data:${photo.mediaType};base64,${photo.data}`} alt="食事の写真" className="h-16 w-16 rounded-lg object-cover" />
                    <button type="button" className="text-sm text-muted underline" onClick={() => setPhoto(null)}>
                      写真を外す
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-wrap items-center gap-2">
                    <PhotoButton
                      onFile={async (f) => {
                        setError(null);
                        try {
                          setPhoto(await imageFileToInput(f));
                        } catch (err) {
                          setError((err as Error).message);
                        }
                      }}
                    >
                      写真で記録
                    </PhotoButton>
                    <span className="text-xs text-muted">料理の写真や、ほかのアプリの記録画面のスクリーンショットも使えます</span>
                  </div>
                )}
                <ErrorNote message={error} />
                <Button type="submit" disabled={loading || (!text.trim() && !photo)} className="w-full md:w-auto">
                  {loading ? <Spinner /> : null}
                  {loading ? "調べています…（市販品は公式の表示を探します）" : "栄養素を調べる"}
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
                {NUTRIENT_GROUPS.map(({ group, keys }) => {
                  const fields = (
                    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                      {keys.map((k) => (
                        <Field key={k} label={`${NUTRIENTS[k].label} (${NUTRIENTS[k].unit})`}>
                          <OptionalNumberInput
                            value={manual.nutrients[k] || null}
                            onValueChange={(v) => setManual({ ...manual, nutrients: { ...manual.nutrients, [k]: v ?? 0 } })}
                          />
                        </Field>
                      ))}
                    </div>
                  );
                  // 主要な栄養素はそのまま、ミネラル・ビタミンは必要なときだけ開く
                  return group === "main" ? (
                    <div key={group}>{fields}</div>
                  ) : (
                    <details key={group}>
                      <summary className="cursor-pointer text-sm text-brand">{GROUP_LABELS[group]}（任意）</summary>
                      <div className="mt-2">{fields}</div>
                    </details>
                  );
                })}
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
                        <span className="mt-1 flex flex-wrap items-center gap-2">
                          {d.basis === "web" && <Badge tone="good">公式サイトの表示</Badge>}
                          {d.basis === "label" && <Badge tone="good">写真の表示から</Badge>}
                          {d.basis === "estimate" && <Badge>成分表からの推定</Badge>}
                          {d.source && /^https?:\/\//.test(d.source) && (
                            <a href={d.source} target="_blank" rel="noopener noreferrer" className="text-xs text-brand underline" onClick={(e) => e.stopPropagation()}>
                              出典を見る
                            </a>
                          )}
                        </span>
                        <span className="mt-1 block">
                          <NutrientTable nutrients={completeNutrients(d.nutrients)} />
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

          <Card title={`${date === todayStr() ? "今日" : date}の記録`}>
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
