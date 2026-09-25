"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { useState, type FormEvent } from "react";
import { Badge, Button, Card, Field, Input, PageHeader, Select, cx } from "@/components/ui";
import { addPantryItems, daysUntil, db, updatePantryItem, type PantryCategory, type PantryItem } from "@/lib/db";

const UNITS = ["個", "g", "kg", "ml", "L", "本", "枚", "パック", "袋", "玉", "束", "少々"];

const SEASONING_PRESET = ["塩", "こしょう", "砂糖", "醤油", "味噌", "みりん", "料理酒", "酢", "サラダ油", "ごま油", "マヨネーズ", "ケチャップ", "コンソメ", "和風だし"];

function ExpiryBadge({ date }: { date?: string }) {
  if (!date) return null;
  const d = daysUntil(date);
  if (d < 0) return <Badge tone="danger">期限切れ</Badge>;
  if (d <= 3) return <Badge tone="warn">{d === 0 ? "今日まで" : `あと${d}日`}</Badge>;
  return <Badge>{date.slice(5).replace("-", "/")}まで</Badge>;
}

export default function PantryPage() {
  const items = useLiveQuery(() => db.pantry.orderBy("name").toArray(), []);
  const [tab, setTab] = useState<PantryCategory>("ingredient");
  const [query, setQuery] = useState("");
  const [form, setForm] = useState({ name: "", quantity: "1", unit: "個", expiresOn: "" });

  const list = (items ?? [])
    .filter((i) => i.category === tab && i.name.includes(query.trim()))
    .sort((a, b) => (a.expiresOn ?? "9999").localeCompare(b.expiresOn ?? "9999"));

  async function add(e: FormEvent) {
    e.preventDefault();
    const name = form.name.trim();
    if (!name) return;
    // 入力欄は先にリセットし、続けて入力しても消えないようにする
    setForm({ ...form, name: "", quantity: "1", expiresOn: "" });
    const existing = await db.pantry.where("name").equals(name).and((i) => i.category === tab).first();
    const quantity = Number(form.quantity) || 0;
    if (existing && existing.unit === form.unit) {
      await updatePantryItem(existing.id!, {
        quantity: existing.quantity + quantity,
        expiresOn: form.expiresOn || existing.expiresOn,
      });
    } else {
      await addPantryItems([{ name, category: tab, quantity, unit: form.unit, expiresOn: form.expiresOn || undefined }]);
    }
  }

  async function addPresetSeasonings() {
    const have = new Set((items ?? []).filter((i) => i.category === "seasoning").map((i) => i.name));
    await addPantryItems(
      SEASONING_PRESET.filter((n) => !have.has(n)).map((name) => ({ name, category: "seasoning" as const, quantity: 1, unit: "本" })),
    );
  }

  async function changeQty(item: PantryItem, delta: number) {
    const quantity = Math.max(0, Math.round((item.quantity + delta) * 100) / 100);
    if (quantity === 0 && !confirm(`「${item.name}」を使い切りましたか？在庫から削除します。`)) return;
    if (quantity === 0) await db.pantry.delete(item.id!);
    else await updatePantryItem(item.id!, { quantity });
  }

  const step = (unit: string) => (["g", "ml"].includes(unit) ? 50 : 1);

  return (
    <>
      <PageHeader title="家にある食材・調味料" description="AIはここにある食材を優先して献立を考えます" />

      <div className="mb-4 inline-flex rounded-xl bg-subtle p-1">
        {(["ingredient", "seasoning"] as const).map((c) => (
          <button
            key={c}
            onClick={() => setTab(c)}
            className={cx("rounded-lg px-4 py-1.5 text-sm font-medium", tab === c ? "bg-surface shadow-sm" : "text-muted")}
          >
            {c === "ingredient" ? "食材" : "調味料"}
            <span className="ml-1 text-xs text-muted">{(items ?? []).filter((i) => i.category === c).length}</span>
          </button>
        ))}
      </div>

      <Card className="mb-4">
        <form onSubmit={add} className="grid grid-cols-2 gap-3 md:grid-cols-[2fr_1fr_1fr_1.3fr_auto] md:items-end">
          <Field label="名前" className="col-span-2 md:col-span-1">
            <Input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder={tab === "ingredient" ? "例: 鶏むね肉" : "例: 醤油"}
              required
            />
          </Field>
          <Field label="数量">
            <Input type="number" inputMode="decimal" min="0" step="any" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} />
          </Field>
          <Field label="単位">
            <Select value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })}>
              {UNITS.map((u) => (
                <option key={u}>{u}</option>
              ))}
            </Select>
          </Field>
          <Field label="賞味・消費期限（任意）" className="col-span-2 md:col-span-1">
            <Input type="date" value={form.expiresOn} onChange={(e) => setForm({ ...form, expiresOn: e.target.value })} />
          </Field>
          <Button type="submit" className="col-span-2 md:col-span-1">
            追加
          </Button>
        </form>
        {tab === "seasoning" && (
          <button onClick={addPresetSeasonings} className="mt-3 text-sm text-brand underline">
            基本の調味料をまとめて追加
          </button>
        )}
      </Card>

      <Input className="mb-3" placeholder="絞り込み" value={query} onChange={(e) => setQuery(e.target.value)} />

      {items && list.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted">登録されていません</p>
      ) : (
        <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
          {list.map((item) => (
            <li key={item.id} className="flex items-center gap-3 px-4 py-3">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{item.name}</span>
                  <ExpiryBadge date={item.expiresOn} />
                </div>
                <span className="text-sm tabular-nums text-muted">
                  {item.quantity}
                  {item.unit}
                </span>
              </div>
              <div className="flex items-center gap-1">
                <Button variant="secondary" className="h-9 w-9 px-0" aria-label="減らす" onClick={() => changeQty(item, -step(item.unit))}>
                  −
                </Button>
                <Button variant="secondary" className="h-9 w-9 px-0" aria-label="増やす" onClick={() => changeQty(item, step(item.unit))}>
                  ＋
                </Button>
                <Button variant="danger" className="h-9 px-2" onClick={() => db.pantry.delete(item.id!)}>
                  削除
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
