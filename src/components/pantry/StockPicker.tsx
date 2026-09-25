"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { useState } from "react";
import { db, type MealType } from "@/lib/db";
import { normalize } from "@/lib/foods";
import { fmt } from "@/lib/nutrients";
import { perLabel } from "@/lib/portion";
import { Input, cx } from "../ui";
import { ConsumePanel } from "./ConsumePanel";

/** 食事記録の「在庫から」：在庫の商品を選び、登録済みの栄養成分で記録して在庫を減らす */
export function StockPicker({ date, mealType }: { date: string; mealType: MealType }) {
  const items = useLiveQuery(() => db.pantry.orderBy("name").toArray(), []);
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<number | null>(null);

  const query = normalize(q);
  const list = (items ?? [])
    .filter((i) => !query || normalize(i.name).includes(query))
    // 栄養成分が登録されているもの、食材を先に
    .sort((a, b) => Number(!!b.nutrition) - Number(!!a.nutrition) || (a.category === b.category ? 0 : a.category === "ingredient" ? -1 : 1));

  if (items && items.length === 0) {
    return <p className="text-sm text-muted">在庫が登録されていません。在庫タブで商品を登録すると、ここから選んで記録できます。</p>;
  }

  return (
    <div className="space-y-2">
      <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="在庫から探す（例: ビスケット）" aria-label="在庫から探す" />
      <ul className="max-h-[28rem] divide-y divide-line overflow-auto rounded-xl border border-line">
        {list.map((item) => (
          <li key={item.id}>
            <button
              type="button"
              className={cx("flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left", selected === item.id ? "bg-brand/10" : "hover:bg-subtle")}
              onClick={() => setSelected(selected === item.id ? null : item.id!)}
              aria-expanded={selected === item.id}
            >
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium">{item.name}</span>
                <span className="block text-xs text-muted">
                  残り {item.quantity}
                  {item.unit}
                  {item.nutrition ? `・${perLabel(item.nutrition)} ${fmt(item.nutrition.nutrients.energy, "energy")}kcal` : "・栄養成分 未登録"}
                </span>
              </span>
              <span className="shrink-0 text-xs text-brand">{selected === item.id ? "閉じる" : "選ぶ"}</span>
            </button>
            {selected === item.id && (
              <div className="px-3 pb-3">
                <ConsumePanel item={item} recordDefault date={date} mealTypeDefault={mealType} onDone={() => setSelected(null)} />
              </div>
            )}
          </li>
        ))}
        {list.length === 0 && <li className="px-3 py-4 text-center text-sm text-muted">見つかりません</li>}
      </ul>
    </div>
  );
}
