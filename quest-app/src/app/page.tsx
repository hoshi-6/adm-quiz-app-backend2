"use client";

import { useEffect, useState } from "react";
import { Bar, Button, Field, Window, cx, inputCls } from "@/components/ui";
import { formatCountdown, formatDate, msUntilMidnight, toDateKey } from "@/lib/date";
import { type QuestItem, currentStreak, itemDone, questProgress, rankOf, titleName, xpToNext } from "@/lib/game";
import { recordProgress, setPlayer, useGame } from "@/lib/store";

export default function QuestPage() {
  const game = useGame()!;
  if (!game.playerName) return <Register />;

  const today = toDateKey();
  const rec = game.days[today];
  const streak = currentStreak(game, today);
  const rank = rankOf(game.level);

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-4">
      <div className="flex items-end justify-between gap-3">
        <div className="min-w-0">
          {game.equippedTitle && <p className="truncate text-xs text-gold">〈{titleName(game.equippedTitle)}〉</p>}
          <p className="truncate text-lg font-bold">{game.playerName}</p>
        </div>
        <div className="shrink-0 text-right font-mono text-xs text-muted">
          <p>
            RANK <span style={{ color: rank.color }}>{rank.rank}</span> ・ 連続 <span className="text-fg">{streak}</span> 日
          </p>
          <p>
            EXP {game.xp} / {xpToNext(game.level)}
          </p>
        </div>
      </div>
      <Bar value={game.xp / xpToNext(game.level)} />

      {!rec || rec.rest ? (
        <Window title="休息日">
          <p className="text-sm leading-relaxed text-fg/90">本日はクエストがありません。しっかり休んで体を回復させましょう。</p>
          <p className="mt-2 text-xs text-muted">休息日は連続記録が途切れません。休息日の曜日は「設定」で変えられます。</p>
        </Window>
      ) : (
        <DailyQuest date={today} items={rec.items} cleared={rec.cleared} xp={rec.xpGained} progress={questProgress(rec)} />
      )}
    </div>
  );
}

function Countdown() {
  const [ms, setMs] = useState<number | null>(null);
  useEffect(() => {
    const tick = () => setMs(msUntilMidnight());
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, []);
  return <span className="font-mono tabular-nums">{ms === null ? "--:--:--" : formatCountdown(ms)}</span>;
}

function DailyQuest({ date, items, cleared, xp, progress }: { date: string; items: QuestItem[]; cleared: boolean; xp?: number; progress: number }) {
  const hasPenalty = items.some((i) => i.penalty);
  return (
    <Window
      title="DAILY QUEST"
      right={<span className="text-xs text-muted">{formatDate(date)}</span>}
      className={cx(cleared && "border-ok/60")}
    >
      <p className="text-center text-sm font-semibold tracking-wider text-glow-strong">［ 肉体強化の日課 ］</p>
      {hasPenalty && !cleared && (
        <p className="mt-2 rounded border border-danger/50 bg-danger/10 px-3 py-1.5 text-center text-xs text-danger">
          未達成の日があったため、ペナルティが追加されました
        </p>
      )}

      <ul className="mt-4 flex flex-col gap-4">
        {items.map((i) => (
          <QuestRow key={i.exerciseId} item={i} />
        ))}
      </ul>

      <div className="mt-5 border-t border-line pt-3">
        {cleared ? (
          <div className="text-center">
            <p className="font-mono text-2xl font-bold tracking-[0.3em] text-ok" style={{ textShadow: "0 0 12px rgba(92,242,176,.7)" }}>
              CLEAR
            </p>
            <p className="mt-1 text-sm text-fg/90">報酬：経験値 +{xp ?? 0} を獲得しました</p>
            <p className="mt-1 text-xs text-muted">次のクエストまで</p>
            <p className="text-lg text-glow-strong">
              <Countdown />
            </p>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between text-xs text-muted">
              <span>達成率 {Math.round(progress * 100)}%</span>
              <span>
                残り時間 <span className="text-base text-fg">{<Countdown />}</span>
              </span>
            </div>
            <p className="mt-3 text-xs leading-relaxed text-danger/90">
              ⚠ 日付が変わるまでに全項目を達成できなかった場合、次のクエストにペナルティが課されます。
            </p>
          </>
        )}
      </div>
    </Window>
  );
}

function QuestRow({ item }: { item: QuestItem }) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState("");
  const done = itemDone(item);
  const steps = item.unit === "km" ? [0.5, 1] : item.unit === "回" ? [1, 5, 10] : item.unit === "秒" ? [10, 30] : [1, 5];
  const show = (v: number) => (item.unit === "km" ? v.toFixed(1) : String(v));

  return (
    <li>
      <div className="flex items-baseline justify-between gap-2">
        <span className={cx("min-w-0 truncate font-semibold", item.penalty && "text-danger", done && "text-ok")}>
          {done ? "✔ " : "・"}
          {item.name}
        </span>
        <button
          type="button"
          className="shrink-0 font-mono tabular-nums underline decoration-line decoration-dotted underline-offset-4"
          onClick={() => {
            setVal(show(item.done));
            setEditing((e) => !e);
          }}
          title="タップして数値を直接入力"
        >
          <span className={done ? "text-ok" : "text-fg"}>{show(item.done)}</span>
          <span className="text-muted">
            {" "}
            / {show(item.target)} {item.unit}
          </span>
        </button>
      </div>
      <Bar value={item.done / item.target} ok={done} className="mt-1.5" />
      {editing ? (
        <form
          className="mt-2 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            const n = Number(val);
            if (Number.isFinite(n) && n >= 0) recordProgress(item.exerciseId, { value: n });
            setEditing(false);
          }}
        >
          <input
            className={inputCls}
            inputMode="decimal"
            value={val}
            onChange={(e) => setVal(e.target.value)}
            autoFocus
            aria-label={`${item.name}の${item.unit === "km" ? "距離" : "回数"}`}
          />
          <Button type="submit" className="shrink-0">
            決定
          </Button>
        </form>
      ) : (
        <div className="mt-2 flex flex-wrap gap-1.5">
          <Button variant="ghost" className="px-2.5 py-1.5" onClick={() => recordProgress(item.exerciseId, { delta: -steps[0] })} disabled={item.done <= 0} aria-label="減らす">
            −{show(steps[0])}
          </Button>
          {steps.map((s) => (
            <Button key={s} className="px-3 py-1.5" onClick={() => recordProgress(item.exerciseId, { delta: s })}>
              +{show(s)}
            </Button>
          ))}
          {!done && (
            <Button variant="ghost" className="ml-auto px-2.5 py-1.5" onClick={() => recordProgress(item.exerciseId, { value: item.target })}>
              達成
            </Button>
          )}
        </div>
      )}
    </li>
  );
}

function Register() {
  const [name, setName] = useState("");
  const [height, setHeight] = useState("");
  return (
    <div className="mx-auto max-w-md pt-6">
      <Window title="SYSTEM" className="animate-sys-in">
        <p className="leading-relaxed">
          システムへの登録を開始します。
          <br />
          今日から毎日<span className="text-glow-strong">デイリークエスト</span>が届きます。
        </p>
        <ul className="mt-3 space-y-1 text-sm text-fg/85">
          <li>・クエストを達成すると経験値を獲得し、レベルが上がる</li>
          <li>・レベルが上がるほど、クエストの目標も上がる</li>
          <li>・未達成のまま日付が変わると、ペナルティが課される</li>
        </ul>
        <form
          className="mt-5 flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (!name.trim()) return;
            const h = Number(height);
            setPlayer(name, height && h > 0 ? h : undefined);
          }}
        >
          <Field label="プレイヤー名">
            <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} placeholder="名前を入力" maxLength={20} autoFocus />
          </Field>
          <Field label="身長（cm・任意）" hint="BMI の計算に使います">
            <input className={inputCls} inputMode="decimal" value={height} onChange={(e) => setHeight(e.target.value)} placeholder="170" />
          </Field>
          <p className="text-xs leading-relaxed text-muted">
            最初は無理のない量から始まります。種目や回数、休息日は「設定」でいつでも変えられます。痛みや体調不良があるときは無理をせず中止してください。
          </p>
          <Button type="submit" disabled={!name.trim()} className="py-2.5">
            登録する
          </Button>
        </form>
      </Window>
    </div>
  );
}
