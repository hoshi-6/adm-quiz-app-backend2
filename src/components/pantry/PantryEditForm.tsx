"use client";

import { useState } from "react";
import { deletePantryItem, updatePantryItem, type ItemNutrition, type PantryCategory, type PantryItem } from "@/lib/db";
import { GROUP_LABELS, NUTRIENT_GROUPS, NUTRIENTS, emptyNutrients } from "@/lib/nutrients";
import { lookupItemNutrition } from "@/lib/pantry-ai";
import { toast } from "@/lib/toast";
import { Button, DateField, Field, Input, NumberInput, OptionalNumberInput, Select } from "../ui";
import { BasisBadge } from "./PhotoImport";

const COUNT_UNITS = ["個", "袋", "本", "パック", "缶", "瓶", "箱", "枚", "玉", "束", "株", "切れ", "尾", "丁", "g", "kg", "ml", "L", "少々"];

/** 登録済みの在庫を編集する（名前・数量・内容量・期限・栄養成分） */
export function PantryEditForm({ item, onDone }: { item: PantryItem; onDone: () => void }) {
  const [name, setName] = useState(item.name);
  const [category, setCategory] = useState<PantryCategory>(item.category);
  const [quantity, setQuantity] = useState(item.quantity);
  const [unit, setUnit] = useState(item.unit);
  const [sizeAmount, setSizeAmount] = useState<number | null>(item.unitSize?.amount ?? null);
  const [sizeUnit, setSizeUnit] = useState<"g" | "ml">(item.unitSize?.unit ?? "g");
  const [expiresOn, setExpiresOn] = useState(item.expiresOn ?? "");
  const [nutrition, setNutrition] = useState<ItemNutrition | null>(item.nutrition ?? null);
  const [looking, setLooking] = useState(false);

  const units = COUNT_UNITS.includes(unit) ? COUNT_UNITS : [unit, ...COUNT_UNITS];
  const countUnit = !["g", "kg", "ml", "L"].includes(unit);

  function setNutrient(k: keyof ItemNutrition["nutrients"], v: number | null) {
    const base = nutrition ?? { per: { amount: 100, unit: "g" }, nutrients: emptyNutrients(), basis: "estimate" as const, source: null };
    // 手で直した値は「推定」ではなくなるので、出どころはそのまま残し、値だけ変える
    setNutrition({ ...base, nutrients: { ...base.nutrients, [k]: v ?? 0 } });
  }

  async function save() {
    if (!name.trim()) return toast("名前を入力してください", "error");
    await updatePantryItem(item.id!, {
      name: name.trim(),
      category,
      quantity,
      unit,
      unitSize: countUnit && sizeAmount && sizeAmount > 0 ? { amount: sizeAmount, unit: sizeUnit } : null,
      expiresOn: expiresOn || undefined,
      nutrition,
    });
    toast(`${name.trim()}を更新しました`);
    onDone();
  }

  async function remove() {
    if (!confirm(`「${item.name}」を在庫から削除しますか？`)) return;
    await deletePantryItem(item.id!);
    toast(`${item.name}を在庫から削除しました`);
  }

  async function relookup() {
    setLooking(true);
    try {
      // 名前を直していれば、その名前で調べ直す
      await lookupItemNutrition({ ...item, name: name.trim() || item.name, unit, unitSize: countUnit && sizeAmount ? { amount: sizeAmount, unit: sizeUnit } : null });
      toast("内容量・栄養成分を調べ直しました");
      onDone();
    } catch (err) {
      toast((err as Error).message, "error");
    } finally {
      setLooking(false);
    }
  }

  return (
    <div className="space-y-3 rounded-xl border border-line bg-bg/60 p-3">
      <Field label="名前">
        <Input value={name} onChange={(e) => setName(e.target.value)} />
      </Field>
      <div className="grid grid-cols-3 gap-2">
        <Field label="数量">
          <NumberInput min={0} value={quantity} onValueChange={setQuantity} />
        </Field>
        <Field label="単位">
          <Select value={unit} onChange={(e) => setUnit(e.target.value)}>
            {units.map((u) => (
              <option key={u}>{u}</option>
            ))}
          </Select>
        </Field>
        <Field label="種類">
          <Select value={category} onChange={(e) => setCategory(e.target.value as PantryCategory)}>
            <option value="ingredient">食材</option>
            <option value="seasoning">調味料</option>
          </Select>
        </Field>
      </div>
      {countUnit && (
        <div className="flex items-end gap-2">
          <Field label={`1${unit}あたりの内容量`} className="flex-1">
            <OptionalNumberInput value={sizeAmount} placeholder="例: 21" onValueChange={setSizeAmount} />
          </Field>
          <div className="w-20">
            <Select value={sizeUnit} onChange={(e) => setSizeUnit(e.target.value as "g" | "ml")} aria-label="内容量の単位">
              <option value="g">g</option>
              <option value="ml">ml</option>
            </Select>
          </div>
        </div>
      )}
      <Field label="賞味・消費期限">
        <DateField value={expiresOn} onChange={setExpiresOn} placeholder="期限を選ぶ（任意）" clearable aria-label="賞味・消費期限" />
      </Field>

      <details className="rounded-lg bg-surface p-2">
        <summary className="cursor-pointer text-sm font-medium">
          栄養成分{nutrition ? `（${nutrition.per.amount}${nutrition.per.unit}あたり）` : "（未登録）"}
        </summary>
        <div className="mt-2 space-y-3">
          {nutrition && <BasisBadge basis={nutrition.basis} source={nutrition.source} />}
          <div className="flex items-end gap-2">
            <Field label="基準量" className="flex-1">
              <NumberInput
                min={0}
                value={nutrition?.per.amount ?? 100}
                onValueChange={(amount) => setNutrition({ ...(nutrition ?? { nutrients: emptyNutrients(), basis: "estimate", source: null, per: { amount: 100, unit: "g" } }), per: { amount, unit: nutrition?.per.unit ?? "g" } })}
              />
            </Field>
            <Field label="単位" className="w-24">
              <Input
                value={nutrition?.per.unit ?? "g"}
                onChange={(e) => setNutrition({ ...(nutrition ?? { nutrients: emptyNutrients(), basis: "estimate", source: null, per: { amount: 100, unit: "g" } }), per: { amount: nutrition?.per.amount ?? 100, unit: e.target.value } })}
              />
            </Field>
          </div>
          {NUTRIENT_GROUPS.map(({ group, keys }) => (
            <div key={group}>
              <p className="mb-1 text-xs font-semibold text-muted">{GROUP_LABELS[group]}</p>
              <div className="grid grid-cols-2 gap-2">
                {keys.map((k) => (
                  <Field key={k} label={`${NUTRIENTS[k].label} (${NUTRIENTS[k].unit})`}>
                    <OptionalNumberInput value={nutrition ? nutrition.nutrients[k] : null} onValueChange={(v) => setNutrient(k, v)} />
                  </Field>
                ))}
              </div>
            </div>
          ))}
        </div>
      </details>

      <div className="flex flex-wrap gap-2">
        <Button className="flex-1" onClick={save}>
          保存
        </Button>
        <Button variant="ghost" onClick={onDone}>
          やめる
        </Button>
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
        <button type="button" className="text-brand underline disabled:opacity-50" disabled={looking} onClick={relookup}>
          {looking ? "調べています…" : "この名前でAIに調べ直す"}
        </button>
        <button type="button" className="text-danger underline" onClick={remove}>
          在庫から削除
        </button>
      </div>
    </div>
  );
}
