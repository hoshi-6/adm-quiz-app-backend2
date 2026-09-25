"use client";

// 在庫の商品の内容量・栄養成分を、あとから AI に調べてもらう
import { toItemNutrition } from "@/components/pantry/PhotoImport";
import type { PantryScanResult } from "./ai/schemas";
import { todayStr, updatePantryItem, type PantryItem } from "./db";
import { callApi } from "./hooks";

export async function lookupItemNutrition(item: PantryItem) {
  const size = item.unitSize ? `（1${item.unit} ${item.unitSize.amount}${item.unitSize.unit}）` : "";
  const res = await callApi<PantryScanResult>("/api/pantry-scan", {
    text: `${item.name}${size} ${item.quantity}${item.unit}`,
    today: todayStr(),
  });
  const found = res.items[0];
  const nutrition = toItemNutrition(found?.nutrition);
  if (!found || !nutrition) throw new Error("この商品の栄養成分が見つかりませんでした");
  await updatePantryItem(item.id!, {
    name: item.name,
    unit: item.unit,
    unitSize: item.unitSize ?? (found.unit === item.unit ? found.unitSize : null) ?? null,
    nutrition,
    // 出典が変わるので、商品画像は新しい出典ページから取り直す
    imageUrl: null,
  });
  return found;
}
