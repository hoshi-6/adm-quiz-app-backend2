"use client";

import type { Suggestion } from "@/lib/ai/schemas";
import type { PantryItem } from "@/lib/db";
import { parseIngredient, rankPantry, similarity } from "@/lib/match";
import { toStockUnits } from "@/lib/portion";
import { NumberInput, Select, cx } from "./ui";

/** 献立の材料 1 つ分。どの在庫から、どれだけ減らすか */
export interface DeductRow {
  key: string;
  /** 献立に書かれた材料（例: 鶏むね肉 200g） */
  label: string;
  /** 材料名だけ（候補の並び替えに使う） */
  name: string;
  /** AI が「家にある」と判断した材料か */
  inStock: boolean;
  /** 減らす在庫。null なら減らさない */
  itemId: number | null;
  /** 在庫の単位での量 */
  amount: number;
  parsed: { amount: number | null; unit: string | null };
}

const round = (n: number) => Math.round(n * 100) / 100;

/** 材料の量を、選んだ在庫の単位に直す。直せなければ、個数で数える食材は 1、それ以外は 0 */
function defaultAmount(item: PantryItem, parsed: DeductRow["parsed"], servingsHint?: { amount: number; unit: string }): number {
  if (servingsHint && servingsHint.unit === item.unit) return Math.min(servingsHint.amount, item.quantity);
  if (parsed.amount !== null && parsed.unit) {
    const v = toStockUnits(item, parsed.amount, parsed.unit);
    if (v !== null) return Math.min(round(v), item.quantity);
  }
  // 「大さじ1」のように量が読めない調味料は、1本まるごと減らさないよう 0 にしておく
  if (item.category === "seasoning" || ["g", "ml", "kg", "L"].includes(item.unit)) return 0;
  return Math.min(1, item.quantity);
}

/** 献立から、在庫を減らす行を作る。AI が使うと言った在庫のほか、在庫にないと判断された材料も並べる */
export function buildDeductRows(s: Suggestion, pantry: PantryItem[]): DeductRow[] {
  const rows: DeductRow[] = [];
  const used = new Set<number>();
  const best = (name: string, min: number) => rankPantry(name, pantry).find((r) => r.score >= min && !used.has(r.item.id!))?.item;

  for (const u of s.pantryUsage) {
    const item = best(u.name, 0.6);
    if (item?.id !== undefined) used.add(item.id);
    const parsed = { amount: u.amount, unit: u.unit };
    rows.push({
      key: `u-${u.name}`,
      label: `${u.name} ${round(u.amount)}${u.unit}`,
      name: u.name,
      inStock: true,
      itemId: item?.id ?? null,
      amount: item ? defaultAmount(item, parsed, { amount: u.amount, unit: u.unit }) : 0,
      parsed,
    });
  }

  for (const text of s.ingredients) {
    const p = parseIngredient(text);
    // すでに「在庫から使う」に入っている材料は重ねない
    if (s.pantryUsage.some((u) => similarity(u.name, p.name) >= 0.6)) continue;
    rows.push({ key: `i-${text}`, label: text, name: p.name, inStock: false, itemId: null, amount: 0, parsed: { amount: p.amount, unit: p.unit } });
  }
  return rows;
}

/** 材料ごとに「どの在庫を減らすか」を選び直せる一覧 */
export function IngredientDeduct({ rows, onChange, pantry }: { rows: DeductRow[]; onChange: (rows: DeductRow[]) => void; pantry: PantryItem[] }) {
  const byId = new Map(pantry.map((p) => [p.id!, p]));
  const update = (i: number, patch: Partial<DeductRow>) => onChange(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));

  function pick(i: number, value: string) {
    const row = rows[i];
    const item = value ? byId.get(Number(value)) : undefined;
    update(i, { itemId: item?.id ?? null, amount: item ? defaultAmount(item, row.parsed) : 0 });
  }

  const ingredients = pantry.filter((p) => p.category === "ingredient").sort((a, b) => a.name.localeCompare(b.name, "ja"));
  const seasonings = pantry.filter((p) => p.category === "seasoning").sort((a, b) => a.name.localeCompare(b.name, "ja"));
  const option = (p: PantryItem) => (
    <option key={p.id} value={p.id}>
      {p.name}（残り {p.quantity}
      {p.unit}）
    </option>
  );

  const groups = [
    { title: "在庫から使う材料", rows: rows.map((r, i) => ({ r, i })).filter(({ r }) => r.inStock) },
    { title: "在庫にないと判断された材料（家にあれば選べます）", rows: rows.map((r, i) => ({ r, i })).filter(({ r }) => !r.inStock) },
  ];

  return (
    <div className="space-y-4">
      {groups.map(
        (g) =>
          g.rows.length > 0 && (
            <div key={g.title}>
              <p className="mb-2 text-xs font-semibold text-muted">{g.title}</p>
              <ul className="space-y-3">
                {g.rows.map(({ r, i }) => {
                  const item = r.itemId !== null ? byId.get(r.itemId) : undefined;
                  const candidates = rankPantry(r.name, pantry).filter((c) => c.score >= 0.25).slice(0, 4);
                  return (
                    <li key={r.key} className={cx("rounded-lg border p-2.5", item ? "border-brand/40 bg-brand/5" : "border-line")}>
                      {/* 材料名は省略せず、折り返して全部見せる */}
                      <p className="break-words text-sm font-medium leading-snug">{r.label}</p>
                      <div className="mt-2">
                        <Select value={r.itemId ?? ""} onChange={(e) => pick(i, e.target.value)} aria-label={`${r.label}で減らす在庫`}>
                          <option value="">在庫から減らさない</option>
                          {candidates.length > 0 && <optgroup label="名前が近い在庫">{candidates.map((c) => option(c.item))}</optgroup>}
                          {ingredients.length > 0 && <optgroup label="在庫の食材">{ingredients.map(option)}</optgroup>}
                          {seasonings.length > 0 && <optgroup label="在庫の調味料">{seasonings.map(option)}</optgroup>}
                        </Select>
                      </div>
                      {item ? (
                        <div className="mt-2">
                          <p className="break-words text-xs text-muted">
                            「{item.name}」から減らす（残り {item.quantity}
                            {item.unit}）
                          </p>
                          <div className="mt-1 flex items-center gap-2">
                            <div className="w-28">
                              <NumberInput
                                className="text-right"
                                min={0}
                                max={item.quantity}
                                value={r.amount}
                                onValueChange={(amount) => update(i, { amount })}
                                aria-label={`${item.name}の使用量`}
                              />
                            </div>
                            <span className="text-sm text-muted">{item.unit}</span>
                          </div>
                        </div>
                      ) : (
                        <p className="mt-1 text-xs text-muted">在庫は減らしません</p>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          ),
      )}
    </div>
  );
}
