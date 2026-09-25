"use client";

import Link from "next/link";
import { useLiveQuery } from "dexie-react-hooks";
import { NutrientBars } from "@/components/NutrientBars";
import { Badge, Card, PageHeader } from "@/components/ui";
import { MEAL_LABELS, daysUntil, db } from "@/lib/db";
import { useDayIntake } from "@/lib/hooks";
import { fmt } from "@/lib/nutrients";

export default function HomePage() {
  const { meals, intake, targets, deficits, excesses } = useDayIntake();
  const expiring = useLiveQuery(async () => {
    const items = await db.pantry.where("expiresOn").above("").toArray();
    return items.filter((i) => daysUntil(i.expiresOn!) <= 3).sort((a, b) => a.expiresOn!.localeCompare(b.expiresOn!));
  }, []);

  const date = new Date().toLocaleDateString("ja-JP", { month: "long", day: "numeric", weekday: "short" });

  return (
    <>
      <PageHeader title="今日の栄養" description={date} />

      <div className="grid gap-4 md:grid-cols-3">
        <Link
          href="/suggest"
          className="flex flex-col justify-between rounded-2xl bg-brand p-4 text-white shadow-sm transition hover:bg-brand-strong md:col-span-1"
        >
          <span className="text-sm opacity-90">不足分を補う献立を</span>
          <span className="mt-2 text-lg font-bold">AIに夕食を提案してもらう →</span>
        </Link>

        <Card title="足りていない栄養素" className="md:col-span-2">
          {meals.length === 0 ? (
            <p className="text-sm text-muted">
              まだ今日の食事が記録されていません。
              <Link href="/meals" className="ml-1 text-brand underline">
                食事を記録する
              </Link>
            </p>
          ) : deficits.length === 0 && excesses.length === 0 ? (
            <p className="text-sm">目標をすべて満たしています 🎉</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {deficits.slice(0, 6).map((d) => (
                <Badge key={d.key} tone={d.ratio < 0.5 ? "danger" : "warn"}>
                  {d.label} あと{fmt(d.gap, d.key)}
                  {d.unit}
                </Badge>
              ))}
              {excesses.map((e) => (
                <Badge key={e.key} tone="danger">
                  {e.label} {fmt(e.gap, e.key)}
                  {e.unit} 超過
                </Badge>
              ))}
            </div>
          )}
        </Card>
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-3">
        <Card title="摂取量 / 目標" className="md:col-span-2">
          <NutrientBars intake={intake} targets={targets} />
        </Card>

        <div className="flex flex-col gap-4">
          <Card title="今日食べたもの" action={<Link href="/meals" className="text-sm text-brand">追加</Link>}>
            {meals.length === 0 ? (
              <p className="text-sm text-muted">記録なし</p>
            ) : (
              <ul className="space-y-1.5 text-sm">
                {meals.map((m) => (
                  <li key={m.id} className="flex justify-between gap-2">
                    <span className="truncate">
                      <span className="mr-1.5 text-xs text-muted">{MEAL_LABELS[m.mealType]}</span>
                      {m.name}
                    </span>
                    <span className="shrink-0 tabular-nums text-muted">{Math.round(m.nutrients.energy)}kcal</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card title="期限が近い食材" action={<Link href="/pantry" className="text-sm text-brand">在庫へ</Link>}>
            {!expiring?.length ? (
              <p className="text-sm text-muted">3日以内に期限が来る食材はありません</p>
            ) : (
              <ul className="space-y-1.5 text-sm">
                {expiring.map((i) => {
                  const d = daysUntil(i.expiresOn!);
                  return (
                    <li key={i.id} className="flex justify-between gap-2">
                      <span className="truncate">{i.name}</span>
                      <Badge tone={d < 0 ? "danger" : "warn"}>{d < 0 ? "期限切れ" : d === 0 ? "今日まで" : `あと${d}日`}</Badge>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}
