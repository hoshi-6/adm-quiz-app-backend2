// 在庫の商品を「どれだけ使ったか」から、在庫の減らす量と栄養素を計算する。
import type { ItemNutrition, PantryItem } from "./db";
import { NUTRIENT_KEYS, emptyNutrients, type Nutrients } from "./nutrients";

const CONTENT_UNITS = ["g", "ml"];

/** その商品で使える量の単位（在庫の単位と、内容量が分かれば g・ml） */
export function portionUnits(item: Pick<PantryItem, "unit" | "unitSize">): string[] {
  const units = [item.unit];
  if (item.unitSize && !units.includes(item.unitSize.unit)) units.push(item.unitSize.unit);
  if (item.unit === "kg") units.push("g");
  if (item.unit === "L") units.push("ml");
  return units;
}

/** amount unit を g（ml）に直す。直せなければ null */
function toContent(item: Pick<PantryItem, "unit" | "unitSize">, amount: number, unit: string): number | null {
  if (CONTENT_UNITS.includes(unit)) return amount;
  if (unit === "kg") return amount * 1000;
  if (unit === "L") return amount * 1000;
  if (unit === item.unit && item.unitSize) return amount * item.unitSize.amount;
  return null;
}

/** 使った量を在庫の単位に直す（在庫を減らす量）。直せなければ null */
export function toStockUnits(item: Pick<PantryItem, "unit" | "unitSize">, amount: number, unit: string): number | null {
  if (unit === item.unit) return amount;
  const content = toContent(item, amount, unit);
  if (content === null) return null;
  if (item.unit === "kg" || item.unit === "L") return content / 1000;
  if (CONTENT_UNITS.includes(item.unit)) return content;
  if (item.unitSize) return content / item.unitSize.amount;
  return null;
}

/** 使った量に対する栄養素。栄養成分がない・単位を換算できないときは null */
export function nutrientsForPortion(
  item: Pick<PantryItem, "unit" | "unitSize"> & { nutrition?: ItemNutrition | null },
  amount: number,
  unit: string,
): Nutrients | null {
  const n = item.nutrition;
  if (!n || n.per.amount <= 0) return null;
  let ratio: number | null = null;
  if (unit === n.per.unit) {
    ratio = amount / n.per.amount;
  } else {
    const used = toContent(item, amount, unit);
    const base = toContent(item, n.per.amount, n.per.unit);
    if (used !== null && base) ratio = used / base;
  }
  if (ratio === null) return null;
  const out = emptyNutrients();
  for (const k of NUTRIENT_KEYS) out[k] = Math.round((Number(n.nutrients[k]) || 0) * ratio * 1000) / 1000;
  return out;
}

/** 「100 g あたり」「1 袋あたり」のような表記 */
export function perLabel(n: ItemNutrition): string {
  return `${n.per.amount === 1 ? "1" : n.per.amount}${n.per.unit}あたり`;
}
