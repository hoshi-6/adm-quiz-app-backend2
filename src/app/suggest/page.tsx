"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { toast } from "@/lib/toast";
import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { Badge, Button, Card, ErrorNote, Field, NumberInput, PageHeader, Select, Spinner, Textarea } from "@/components/ui";
import { SUGGEST_STYLES, type SuggestRequest, type Suggestion } from "@/lib/ai/schemas";
import { MEAL_LABELS, addMeals, consumePantry, daysUntil, db, todayStr, type MealType, type PantryItem } from "@/lib/db";
import { ApiError, callApi, useDayIntake, useSettings } from "@/lib/hooks";
import { IngredientDeduct, buildDeductRows, type DeductRow } from "@/components/IngredientDeduct";
import { ConsultChat, type ChatMessage } from "@/components/ConsultChat";
import { NutrientTable } from "@/components/NutrientBars";
import { NUTRIENT_KEYS, NUTRIENTS, completeNutrients, fmt } from "@/lib/nutrients";

const STORAGE_KEY = "gohan-navi:last-suggestion-v2";

/** 1案ごとの状態。3案を同時に作り、できたものから表示する */
type Slot = { state: "loading"; note?: string } | { state: "done"; suggestion: Suggestion } | { state: "error"; message: string };

/** 1分あたりの利用上限・混雑のときは、少し待てば通るので自動でやり直す（待つ秒数） */
const RETRY_WAIT_SEC = [20, 40];
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export default function SuggestPage() {
  const settings = useSettings();
  const pantry = useLiveQuery(() => db.pantry.toArray(), []);
  const { meals, intake, targets, deficits, excesses } = useDayIntake();

  const [opts, setOpts] = useState({ mealType: "dinner" as MealType, servings: 1, maxMinutes: 30, prioritizeExpiring: true, request: "" });
  const [slots, setSlots] = useState<Slot[]>([]);
  const [servings, setServings] = useState(1);
  // 作ると決めた献立（その献立について AI に相談できる）と、案ごとの相談の履歴
  const [selected, setSelected] = useState<number | null>(null);
  const [chats, setChats] = useState<Record<number, ChatMessage[]>>({});
  const loading = slots.some((s) => s.state === "loading");
  // 「もう一度」で同じ条件のまま作り直せるよう、最後に送った条件を覚えておく
  const lastRequest = useRef<Omit<SuggestRequest, "style"> | null>(null);
  const generation = useRef(0);

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
          setSelected(saved.selected ?? null);
          setChats(saved.chats ?? {});
        }
      }
    } catch {}
  }, []);

  // 提案・選んだ献立・相談の履歴を保存（タブを切り替えても続きから相談できるように）
  useEffect(() => {
    if (!slots.length || loading) return;
    const done = slots.flatMap((s) => (s.state === "done" ? [s.suggestion] : []));
    // 失敗した案を除くと番号がずれるので、選んだ献立の番号を詰め直す
    const index = (i: number) => slots.slice(0, i).filter((s) => s.state === "done").length;
    const keep = (i: number) => slots[i]?.state === "done";
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          date: todayStr(),
          servings,
          suggestions: done,
          selected: selected !== null && keep(selected) ? index(selected) : null,
          chats: Object.fromEntries(Object.entries(chats).filter(([i]) => keep(Number(i))).map(([i, m]) => [index(Number(i)), m])),
        }),
      );
    } catch {}
  }, [slots, loading, servings, selected, chats]);

  function updateSuggestion(i: number, suggestion: Suggestion) {
    setSlots((prev) => prev.map((p, j) => (j === i ? { state: "done", suggestion } : p)));
  }

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
    setSlots(SUGGEST_STYLES.map(() => ({ state: "loading" })));
    setSelected(null);
    setChats({});
    lastRequest.current = base;
    const gen = ++generation.current;
    // 3案を同時に依頼し、届いたものから表示する（1案ずつ順番に作るより速い）
    SUGGEST_STYLES.forEach((_, style) => void runSlot(style, gen));
  }

  /** 1案を作る。利用上限などで断られたら、少し待って自動でやり直す */
  async function runSlot(style: number, gen = generation.current) {
    const base = lastRequest.current;
    if (!base) return;
    // 新しく提案を頼み直したあとに、古い結果で上書きしない
    const set = (slot: Slot) => {
      // ほかの案を相談で書き換えている途中でも消さないよう、この案だけを差し替える
      if (gen === generation.current) setSlots((prev) => prev.map((p, j) => (j === style ? slot : p)));
    };
    set({ state: "loading" });
    for (let attempt = 0; ; attempt++) {
      try {
        const suggestion = await callApi<Suggestion>("/api/suggest", { ...base, style });
        return set({ state: "done", suggestion });
      } catch (err) {
        const status = err instanceof ApiError ? err.status : 0;
        const wait = RETRY_WAIT_SEC[attempt];
        if ((status === 429 || status === 503) && wait !== undefined && gen === generation.current) {
          set({ state: "loading", note: `AIの利用上限に達したため、${wait}秒待ってからやり直します…` });
          await sleep(wait * 1000);
          set({ state: "loading" });
          continue;
        }
        return set({ state: "error", message: (err as Error).message });
      }
    }
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
          {selected !== null && slots[selected]?.state === "done" ? (
            <div className="mx-auto max-w-2xl space-y-3">
              <button type="button" className="text-sm text-brand" onClick={() => setSelected(null)}>
                ← ほかの案も見る
              </button>
              <SuggestionCard
                key={selected}
                s={(slots[selected] as { suggestion: Suggestion }).suggestion}
                servings={servings}
                mealType={opts.mealType}
                pantry={pantry ?? []}
                selected
                consult={
                  <ConsultChat
                    suggestion={(slots[selected] as { suggestion: Suggestion }).suggestion}
                    messages={chats[selected] ?? []}
                    onMessages={(m) => setChats((c) => ({ ...c, [selected]: m }))}
                    onUpdate={(s) => updateSuggestion(selected, s)}
                    pantry={pantry ?? []}
                    servings={servings}
                    mealType={MEAL_LABELS[opts.mealType]}
                    preferences={settings.preferences}
                  />
                }
              />
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
              {slots.map((slot, i) =>
                slot.state === "loading" ? (
                  <Card key={i} className="flex min-h-48 flex-col items-center justify-center gap-2 text-center text-sm text-muted">
                    <Spinner />
                    {SUGGEST_STYLES[i]}の献立を考えています…
                    {slot.note && <span className="text-xs text-warn">{slot.note}</span>}
                  </Card>
                ) : slot.state === "error" ? (
                  <Card key={i} className="text-sm text-muted">
                    <p className="break-words">
                      {SUGGEST_STYLES[i]}の提案は作れませんでした（{slot.message}）
                    </p>
                    {lastRequest.current && (
                      <Button variant="secondary" className="mt-3" onClick={() => void runSlot(i)}>
                        もう一度
                      </Button>
                    )}
                  </Card>
                ) : (
                  <SuggestionCard
                    key={i}
                    s={slot.suggestion}
                    servings={servings}
                    mealType={opts.mealType}
                    pantry={pantry ?? []}
                    onSelect={() => {
                      setSelected(i);
                      window.scrollTo({ top: 0, behavior: "smooth" });
                    }}
                    chatCount={chats[i]?.length ?? 0}
                  />
                ),
              )}
            </div>
          )}
          <p className="mt-4 text-xs text-muted">※ 栄養素はAIによる推定値です。アレルギーや持病がある場合は、材料を必ずご自身で確認してください。</p>
        </>
      )}
    </>
  );
}

function SuggestionCard({
  s,
  servings,
  mealType,
  pantry,
  selected,
  onSelect,
  consult,
  chatCount = 0,
}: {
  s: Suggestion;
  servings: number;
  mealType: MealType;
  pantry: PantryItem[];
  /** 作ると決めた献立として大きく表示する */
  selected?: boolean;
  onSelect?: () => void;
  consult?: ReactNode;
  chatCount?: number;
}) {
  const [step, setStep] = useState<"idle" | "confirm" | "saved">("idle");
  const [deduct, setDeduct] = useState<DeductRow[]>([]);

  function openConfirm() {
    setDeduct(buildDeductRows(s, pantry));
    setStep("confirm");
  }

  async function save() {
    await addMeals([{ date: todayStr(), mealType, name: s.title, amount: "1人前", nutrients: completeNutrients(s.nutrientsPerServing) }]);
    const used = deduct.filter((d) => d.itemId !== null && d.amount > 0);
    await consumePantry(used.map((d) => ({ id: d.itemId!, amount: d.amount })));
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
          <Badge key={p.name} tone="good" wrap>
            {p.name}
          </Badge>
        ))}
        {s.needToBuy.map((p) => (
          <Badge key={p} tone="warn" wrap>
            買う: {p}
          </Badge>
        ))}
      </div>

      <details className="mb-3 text-sm" open={selected || undefined}>
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

      {consult && <div className="mb-3">{consult}</div>}

      {step === "idle" && (
        <div className="mt-auto flex flex-col gap-2">
          {onSelect && (
            <Button onClick={onSelect}>{chatCount > 0 ? "この献立の相談を続ける" : "この献立で作る（AIに相談）"}</Button>
          )}
          <Button variant="secondary" onClick={openConfirm}>
            これを食べた（記録する）
          </Button>
        </div>
      )}

      {step === "confirm" && (
        <div className="mt-auto rounded-xl border border-line p-3">
          <p className="mb-1 text-sm font-medium">使った材料と、減らす在庫</p>
          <p className="mb-3 text-xs text-muted">違う在庫が選ばれていたら、選び直してください。在庫にない材料も、家にあれば選べます。</p>
          <div className="mb-3">
            <IngredientDeduct rows={deduct} onChange={setDeduct} pantry={pantry} />
          </div>
          <div className="flex gap-2">
            <Button className="flex-1" onClick={save}>
              {deduct.some((d) => d.itemId !== null && d.amount > 0) ? "記録して在庫を減らす" : "記録する"}
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
