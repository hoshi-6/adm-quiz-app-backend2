"use client";

import { useState } from "react";
import { MEAL_LABELS, addMeals, consumePantry, guessMealType, todayStr, type MealType, type PantryItem } from "@/lib/db";
import { fmt } from "@/lib/nutrients";
import { lookupItemNutrition } from "@/lib/pantry-ai";
import { nutrientsForPortion, perLabel, portionUnits, toStockUnits } from "@/lib/portion";
import { toast } from "@/lib/toast";
import { Button, ErrorNote, NumberInput, Select, Spinner, cx } from "../ui";
import { BasisBadge } from "./PhotoImport";

const round = (n: number) => Math.round(n * 100) / 100;

/**
 * 在庫の商品を使う。使った量（在庫の単位、または g・ml）を選ぶと在庫を減らし、
 * 食事として記録するときは、商品が持っている栄養成分から計算して記録する。
 */
export function ConsumePanel({
  item,
  recordDefault,
  date = todayStr(),
  mealTypeDefault,
  onDone,
}: {
  item: PantryItem;
  recordDefault: boolean;
  date?: string;
  mealTypeDefault?: MealType;
  onDone?: () => void;
}) {
  const units = portionUnits(item);
  const contentUnit = ["g", "ml"].includes(item.unit);
  const [unit, setUnit] = useState(units[0]);
  const [amount, setAmount] = useState(contentUnit ? Math.min(100, item.quantity) : Math.min(1, item.quantity));
  const [record, setRecord] = useState(recordDefault);
  const [mealType, setMealType] = useState<MealType>(mealTypeDefault ?? guessMealType());
  const [looking, setLooking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const stock = toStockUnits(item, amount, unit);
  const nutrients = nutrientsForPortion(item, amount, unit);
  const over = stock !== null && stock > item.quantity + 1e-9;

  // よく使う量のボタン
  const presets: { label: string; amount: number; unit: string }[] =
    unit === item.unit
      ? contentUnit
        ? [50, 100, 200].filter((v) => v < item.quantity).map((v) => ({ label: `${v}${unit}`, amount: v, unit }))
        : [0.5, 1, 2].filter((v) => v <= item.quantity).map((v) => ({ label: `${v}${unit}`, amount: v, unit }))
      : [];
  presets.push({ label: "全部", amount: item.quantity, unit: item.unit });

  async function lookup() {
    setLooking(true);
    setError(null);
    try {
      await lookupItemNutrition(item);
      toast("栄養成分を登録しました");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLooking(false);
    }
  }

  async function submit() {
    if (stock !== null) await consumePantry([{ id: item.id!, amount: Math.min(stock, item.quantity) }]);
    if (record && nutrients) {
      await addMeals([{ date, mealType, name: item.name, amount: `${round(amount)}${unit}`, nutrients }]);
    }
    toast(record && nutrients ? `${MEAL_LABELS[mealType]}に記録し、在庫を減らしました` : "在庫を減らしました");
    onDone?.();
  }

  return (
    <div className="space-y-3 rounded-xl border border-line bg-bg/60 p-3">
      <div>
        <p className="mb-1 text-xs font-medium text-muted">使った量</p>
        <div className="flex items-center gap-2">
          <div className="min-w-0 flex-1">
            <NumberInput min={0} value={amount} onValueChange={setAmount} aria-label="使った量" />
          </div>
          <div className="w-24 shrink-0">
            <Select value={unit} onChange={(e) => setUnit(e.target.value)} aria-label="使った量の単位">
              {units.map((u) => (
                <option key={u}>{u}</option>
              ))}
            </Select>
          </div>
        </div>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {presets.map((p) => (
          <button
            key={p.label}
            type="button"
            onClick={() => {
              setAmount(p.amount);
              setUnit(p.unit);
            }}
            className={cx("rounded-full border px-3 py-1 text-xs", amount === p.amount && unit === p.unit ? "border-brand bg-brand/10 text-brand" : "border-line text-muted")}
          >
            {p.label}
          </button>
        ))}
      </div>
      <p className={cx("text-xs", over ? "text-danger" : "text-muted")}>
        {stock === null
          ? `1${item.unit}あたりの内容量が未登録のため、${unit}では在庫を減らせません`
          : over
            ? `在庫（${item.quantity}${item.unit}）より多い量です`
            : `在庫から ${round(stock)}${item.unit} 減らします（残り ${round(item.quantity - stock)}${item.unit}）`}
      </p>

      <div className="flex items-center gap-2 text-sm">
        <label className="flex flex-1 items-center gap-2">
          <input type="checkbox" className="h-4 w-4 accent-[var(--brand)]" checked={record} onChange={(e) => setRecord(e.target.checked)} />
          食事として記録する
        </label>
        {record && (
          <div className="w-24 shrink-0">
            <Select className="py-1" value={mealType} onChange={(e) => setMealType(e.target.value as MealType)} aria-label="食事">
              {Object.entries(MEAL_LABELS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </Select>
          </div>
        )}
      </div>

      {record &&
        (item.nutrition ? (
          nutrients ? (
            <div className="rounded-lg bg-surface px-3 py-2 text-xs">
              <div className="mb-1 flex flex-wrap items-center gap-2 text-muted">
                <BasisBadge basis={item.nutrition.basis} source={item.nutrition.source} />
                <span>{perLabel(item.nutrition)}の値から計算</span>
              </div>
              <span className="text-sm font-semibold tabular-nums">{fmt(nutrients.energy, "energy")}kcal</span>
              <span className="ml-2 text-muted">
                たんぱく質 {fmt(nutrients.protein, "protein")}g・脂質 {fmt(nutrients.fat, "fat")}g・炭水化物 {fmt(nutrients.carbs, "carbs")}g・食塩 {fmt(nutrients.salt, "salt")}g
              </span>
            </div>
          ) : (
            <p className="text-xs text-danger">
              栄養成分は{perLabel(item.nutrition)}で登録されていますが、{unit}からは計算できません。単位を変えるか、1{item.unit}あたりの内容量を登録してください。
            </p>
          )
        ) : (
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
            この商品には栄養成分が登録されていません。
            <Button variant="secondary" className="px-3 py-1 text-xs" onClick={lookup} disabled={looking}>
              {looking ? <Spinner /> : null}
              {looking ? "調べています…" : "AIで栄養成分を調べる"}
            </Button>
          </div>
        ))}
      <ErrorNote message={error} />

      <div className="flex gap-2">
        <Button className="flex-1" onClick={submit} disabled={amount <= 0 || over || (stock === null && !(record && nutrients))}>
          {record && nutrients ? "記録して在庫を減らす" : "在庫を減らす"}
        </Button>
        {onDone && (
          <Button variant="ghost" onClick={onDone}>
            閉じる
          </Button>
        )}
      </div>
    </div>
  );
}
