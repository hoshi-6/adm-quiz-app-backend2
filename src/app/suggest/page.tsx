"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { toast } from "@/lib/toast";
import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { Badge, Button, Card, ErrorNote, Field, NumberInput, PageHeader, Select, Spinner, Textarea } from "@/components/ui";
import { SUGGEST_STYLES, type SuggestRequest, type Suggestion } from "@/lib/ai/schemas";
import { MEAL_LABELS, addMeals, consumePantry, daysUntil, db, todayStr, type MealType, type PantryItem } from "@/lib/db";
import { callApi, useDayIntake, useSettings } from "@/lib/hooks";
import { NutrientTable } from "@/components/NutrientBars";
import { NUTRIENT_KEYS, NUTRIENTS, completeNutrients, fmt } from "@/lib/nutrients";

const STORAGE_KEY = "gohan-navi:last-suggestion-v2";

/** 1案ごとの状態。3案を同時に作り、できたものから表示する */
type Slot = { state: "loading" } | { state: "done"; suggestion: Suggestion } | { state: "error"; message: string };

export default function SuggestPage() {
  const settings = useSettings();
  const pantry = useLiveQuery(() => db.pantry.toArray(), []);
  const { meals, intake, targets, deficits, excesses } = useDayIntake();

  const [opts, setOpts] = useState({ mealType: "dinner" as MealType, servings: 1, maxMinutes: 30, prioritizeExpiring: true, request: "" });
  const [slots, setSlots] = useState<Slot[]>([]);
  const [servings, setServings] = useState(1);
  const loading = slots.some((s) => s.state === "loading");

  // 前回の提案を復元（タブを切り替えても消えないように）
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const saved = JSON.parse(raw);
        if (saved.date === todayStr()) {
          // eslint-disable-next-line react-hooks/set-state-in-effect -- 初回マウント時に一度だけ復元する
          setSlots(saved.suggestions.map((suggestion: Suggestion) => ({ state: "done", suggestion })));
          setServings(saved.servings ?? 1);
        }
      }
    } catch {}
  }, []);

  function submit(e: FormEvent) {
    e.preventDefault();
    const base: Omit<SuggestRequest, "style"> = {
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

    setServings(opts.servings);
    const next: Slot[] = SUGGEST_STYLES.map(() => ({ state: "loading" }));
    setSlots(next);

    // 3案を同時に依頼し、届いたものから表示する（1案ずつ順番に作るより速い）
    SUGGEST_STYLES.forEach((_, style) => {
      callApi<Suggestion>("/api/suggest", { ...base, style })
        .then((suggestion) => {
          next[style] = { state: "done", suggestion };
        })
        .catch((err) => {
          next[style] = { state: "error", message: (err as Error).message };
        })
        .finally(() => {
          setSlots([...next]);
          if (next.every((s) => s.state !== "loading")) {
            const done = next.flatMap((s) => (s.state === "done" ? [s.suggestion] : []));
            try {
              localStorage.setItem(STORAGE_KEY, JSON.stringify({ date: todayStr(), servings: opts.servings, suggestions: done }));
            } catch {}
          }
        });
    });
  }

  const errors = slots.flatMap((s) => (s.state === "error" ? [s.message] : []));
  const allFailed = slots.length > 0 && errors.length === slots.length;
  const summary = [
    deficits.length ? `不足している ${deficits.slice(0, 4).map((d) => d.label).join("・")} を補える献立を選びました。` : "今日の栄養はおおむね足りています。バランスを保てる献立を選びました。",
    excesses.length ? `${excesses.map((e) => e.label).join("・")} はとりすぎなので控えめにしています。` : "",
  ].join("");

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
            <NumberInput integer min={1} max={10} value={opts.servings} onValueChange={(servings) => setOpts({ ...opts, servings })} />
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
              {loading ? "考え中…" : "献立を提案してもらう"}
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
        {allFailed && (
          <div className="mt-3">
            <ErrorNote message={errors[0]} />
          </div>
        )}
      </Card>

      {slots.length > 0 && !allFailed && (
        <>
          <p className="mb-4 rounded-2xl bg-brand/10 px-4 py-3 text-sm leading-relaxed">{summary}</p>
          <div className="grid gap-4 lg:grid-cols-3">
            {slots.map((slot, i) =>
              slot.state === "loading" ? (
                <Card key={i} className="flex min-h-48 flex-col items-center justify-center gap-2 text-sm text-muted">
                  <Spinner />
                  {SUGGEST_STYLES[i]}の献立を考えています…
                </Card>
              ) : slot.state === "error" ? (
                <Card key={i} className="text-sm text-muted">
                  {SUGGEST_STYLES[i]}の提案は作れませんでした（{slot.message}）
                </Card>
              ) : (
                <SuggestionCard key={i} s={slot.suggestion} servings={servings} mealType={opts.mealType} pantry={pantry ?? []} />
              ),
            )}
          </div>
          <p className="mt-4 text-xs text-muted">※ 栄養素はAIによる推定値です。アレルギーや持病がある場合は、材料を必ずご自身で確認してください。</p>
        </>
      )}
    </>
  );
}

/** 提案の食材名を在庫と照らし合わせる（完全一致を優先し、なければ部分一致） */
function matchPantry(name: string, pantry: PantryItem[]) {
  const ingredients = pantry.filter((p) => p.category === "ingredient");
  return ingredients.find((p) => p.name === name) ?? ingredients.find((p) => p.name.includes(name) || name.includes(p.name));
}

function SuggestionCard({ s, servings, mealType, pantry }: { s: Suggestion; servings: number; mealType: MealType; pantry: PantryItem[] }) {
  const [step, setStep] = useState<"idle" | "confirm" | "saved">("idle");
  const [deduct, setDeduct] = useState<{ id: number; name: string; unit: string; have: number; amount: number; checked: boolean }[]>([]);

  function openConfirm() {
    const rows = s.pantryUsage.flatMap((u) => {
      const item = matchPantry(u.name, pantry);
      if (!item?.id) return [];
      // 単位が違うときは量を推測できないので 0 にして、利用者に入れてもらう
      const amount = item.unit === u.unit ? Math.min(u.amount, item.quantity) : 0;
      return [{ id: item.id, name: item.name, unit: item.unit, have: item.quantity, amount, checked: amount > 0 }];
    });
    setDeduct(rows);
    setStep("confirm");
  }

  async function save() {
    await addMeals([{ date: todayStr(), mealType, name: s.title, amount: "1人前", nutrients: completeNutrients(s.nutrientsPerServing) }]);
    const used = deduct.filter((d) => d.checked);
    await consumePantry(used.map((d) => ({ id: d.id, amount: d.amount })));
    setStep("saved");
    toast(used.length ? `記録して、在庫を${used.length}件減らしました` : "食事を記録しました");
  }

  return (
    <Card className="flex flex-col">
      <div className="mb-2 flex items-start justify-between gap-2">
        <h2 className="font-bold leading-snug">{s.title}</h2>
        <Badge>{s.cookingMinutes}分</Badge>
      </div>
      <p className="mb-3 text-sm text-muted">{s.reason}</p>

      <div className="mb-3 flex flex-wrap gap-1">
        {s.pantryUsage.map((p) => (
          <Badge key={p.name} tone="good">
            {p.name}
          </Badge>
        ))}
        {s.needToBuy.map((p) => (
          <Badge key={p} tone="warn">
            買う: {p}
          </Badge>
        ))}
      </div>

      <details className="mb-3 text-sm">
        <summary className="cursor-pointer font-medium text-brand">材料（{servings}人分）と作り方</summary>
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

      <div className="mb-3">
        <NutrientTable nutrients={completeNutrients(s.nutrientsPerServing)} caption="1人前あたり" />
      </div>

      {step === "idle" && (
        <Button variant="secondary" className="mt-auto" onClick={openConfirm}>
          これを食べた（記録する）
        </Button>
      )}

      {step === "confirm" && (
        <div className="mt-auto rounded-xl border border-line p-3">
          <p className="mb-2 text-sm font-medium">在庫から減らす食材</p>
          {deduct.length === 0 ? (
            <p className="mb-2 text-xs text-muted">在庫と一致する食材はありませんでした。食事の記録だけ行います。</p>
          ) : (
            <ul className="mb-3 space-y-2">
              {deduct.map((d, j) => (
                <li key={d.id} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    className="h-4 w-4 shrink-0 accent-[var(--brand)]"
                    checked={d.checked}
                    onChange={(e) => setDeduct(deduct.map((x, k) => (k === j ? { ...x, checked: e.target.checked } : x)))}
                    aria-label={`${d.name}を減らす`}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate">{d.name}</span>
                    <span className="block text-xs text-muted">
                      残り {d.have}
                      {d.unit}
                    </span>
                  </span>
                  <span className="w-20 shrink-0">
                    <NumberInput
                      className="py-1 text-right"
                      min={0}
                      max={d.have}
                      value={d.amount}
                      onValueChange={(amount) => setDeduct(deduct.map((x, k) => (k === j ? { ...x, amount, checked: amount > 0 } : x)))}
                      aria-label={`${d.name}の使用量`}
                    />
                  </span>
                  <span className="w-8 shrink-0 text-xs text-muted">{d.unit}</span>
                </li>
              ))}
            </ul>
          )}
          <div className="flex gap-2">
            <Button className="flex-1" onClick={save}>
              {deduct.some((d) => d.checked) ? "記録して在庫を減らす" : "記録する"}
            </Button>
            <Button variant="ghost" onClick={() => setStep("idle")}>
              戻る
            </Button>
          </div>
        </div>
      )}

      {step === "saved" && (
        <p className="mt-auto rounded-xl bg-brand/10 px-3 py-2 text-center text-sm text-brand">記録しました ✓</p>
      )}
    </Card>
  );
}
