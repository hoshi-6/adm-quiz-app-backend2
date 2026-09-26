"use client";

import Link from "next/link";
import { useLiveQuery } from "dexie-react-hooks";
import { db, todayStr } from "@/lib/db";
import { useSettings } from "@/lib/hooks";
import { NUTRIENTS, sumNutrients, type Nutrients } from "@/lib/nutrients";
import { averageScore, scoreDay, scoreLabel } from "@/lib/score";
import { Badge, Card, cx } from "./ui";

function last7(): string[] {
  const d = new Date();
  return Array.from({ length: 7 }, (_, i) => todayStr(new Date(d.getFullYear(), d.getMonth(), d.getDate() - (6 - i))));
}

/** ホームの「今日のスコア」と「この7日の平均」 */
export function ScoreCard({ intake, recordedToday }: { intake: Nutrients; recordedToday: boolean }) {
  const { targets } = useSettings();
  const dates = last7();
  const week = useLiveQuery(async () => {
    const meals = await db.meals.where("date").between(dates[0], dates[6], true, true).toArray();
    return dates.map((date) => {
      const mine = meals.filter((m) => m.date === date);
      return mine.length ? sumNutrients(mine.map((m) => m.nutrients)) : null;
    });
    // 日付は今日から決まるので、日が変わったときだけ取り直せばよい
  }, [dates[6]]);

  const today = recordedToday ? scoreDay(intake, targets) : null;
  const weekAvg = averageScore((week ?? []).map((t) => (t ? scoreDay(t, targets).score : null)));
  const label = today ? scoreLabel(today.score) : null;

  return (
    <Card title="栄養スコア" action={<Link href="/trends" className="text-sm text-brand">推移を見る</Link>}>
      <div className="flex items-end gap-6">
        <div>
          <p className="text-xs text-muted">今日（記録した分）</p>
          <p className="mt-1 flex items-baseline gap-1">
            <span className={cx("text-5xl font-bold tabular-nums", !today && "text-muted")}>{today ? today.score : "—"}</span>
            {today && <span className="text-sm text-muted">/ 100点</span>}
          </p>
          {label && (
            <div className="mt-1">
              <Badge tone={label.tone}>{label.text}</Badge>
            </div>
          )}
        </div>
        <div>
          <p className="text-xs text-muted">この7日の平均</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">{weekAvg === null ? "—" : `${weekAvg}点`}</p>
        </div>
      </div>
      {today && today.weakest.length > 0 && (
        <p className="mt-3 text-sm text-muted">
          点数を上げるには：
          {[
            today.weakest.filter((w) => intake[w.key] <= targets[w.key]).map((w) => NUTRIENTS[w.key].label),
            today.weakest.filter((w) => intake[w.key] > targets[w.key]).map((w) => NUTRIENTS[w.key].label),
          ]
            .map((names, i) => (names.length ? `${names.join("・")}${i === 0 ? " を補う" : " を控える"}` : ""))
            .filter(Boolean)
            .join("、")}
        </p>
      )}
      {!today && <p className="mt-3 text-sm text-muted">食事を記録すると、今日のスコアが出ます。</p>}
      <p className="mt-2 text-xs text-muted">目標値に対する達成度を栄養素ごとに点数にし、エネルギー・たんぱく質・食塩などを重く見て平均しています。1日の途中は、まだ食べていない分だけ低めに出ます。</p>
    </Card>
  );
}
