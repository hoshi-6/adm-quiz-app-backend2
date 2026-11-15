"use client";

import Link from "next/link";
import { PixelSprite } from "@/components/PixelSprite";
import { Bar, Button, Window, cx } from "@/components/ui";
import { heroLook } from "@/lib/avatar";
import { STATS, TITLE_DEFS, rankOf, targetFor, titleName, xpToNext } from "@/lib/game";
import { allocateStat, equipTitle, useGame } from "@/lib/store";

export default function StatusPage() {
  const game = useGame()!;
  const rank = rankOf(game.level);
  const enabled = game.exercises.filter((e) => e.enabled);

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-4">
      <Window title="STATUS">
        <div className="grid grid-cols-[auto_1fr] items-center gap-x-4 gap-y-1">
          <Link href="/character" className="pixel-box relative row-span-3 grid h-24 w-20 place-items-center" title="主人公の見た目を変える">
            <PixelSprite sprite={heroLook(game.avatar).idle[0]} scale={heroLook(game.avatar).scale * 0.75} />
            <span className="absolute -right-2 -top-2 border-2 bg-bg px-1 font-mono text-sm" style={{ color: rank.color, borderColor: rank.color }}>
              {rank.rank}
            </span>
          </Link>
          <p className="truncate text-lg font-bold">{game.playerName || "名前未登録"}</p>
          <p className="truncate text-xs text-gold">{game.equippedTitle ? `称号：${titleName(game.equippedTitle)}` : "称号：なし"}</p>
          <p className="font-mono text-sm">
            <span className="text-2xl font-bold text-glow-strong glow-text">Lv.{game.level}</span>
          </p>
        </div>
        <div className="mt-4">
          <div className="mb-1 flex justify-between font-mono text-xs text-muted">
            <span>EXP</span>
            <span>
              {game.xp} / {xpToNext(game.level)}（累計 {game.totalXp}）
            </span>
          </div>
          <Bar value={game.xp / xpToNext(game.level)} />
        </div>
      </Window>

      <Window
        title="能力値"
        right={
          <span className={cx("font-mono text-xs", game.statPoints > 0 ? "text-gold" : "text-muted")}>
            残りポイント {game.statPoints}
          </span>
        }
      >
        <ul className="flex flex-col divide-y divide-line/60">
          {STATS.map((s) => (
            <li key={s.key} className="flex items-center gap-3 py-2">
              <span className="w-10 font-mono text-sm font-bold text-glow-strong">{s.label}</span>
              <div className="min-w-0 flex-1">
                <p className="text-sm">{s.name}</p>
                <p className="truncate text-xs text-muted">{s.desc}</p>
              </div>
              <span className="w-10 text-right font-mono text-lg tabular-nums">{game.stats[s.key]}</span>
              <Button className="h-8 w-8 p-0" disabled={game.statPoints <= 0} onClick={() => allocateStat(s.key, 1)} aria-label={`${s.name}に1ポイント振る`}>
                +
              </Button>
            </li>
          ))}
        </ul>
        <p className="mt-2 text-xs text-muted">レベルが 1 上がるごとに 3 ポイントもらえます。能力値はダンジョンの主人公の強さになります（STR→攻撃、VIT→HP・防御、AGI→攻撃速度・回避、SEN→会心、INT→スキル）。</p>
      </Window>

      <Window title="クエストの目標">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs text-muted">
              <th className="pb-1 text-left font-normal">種目</th>
              <th className="pb-1 text-right font-normal">いま</th>
              <th className="pb-1 text-right font-normal">次のLv</th>
              <th className="pb-1 text-right font-normal">上限</th>
            </tr>
          </thead>
          <tbody className="font-mono tabular-nums">
            {enabled.map((e) => {
              const now = targetFor(e, game.level);
              const next = targetFor(e, game.level + 1);
              const reach = e.step > 0 ? Math.max(1, Math.ceil((e.max - e.base) / e.step) + 1) : null;
              return (
                <tr key={e.id} className="border-t border-line/50">
                  <td className="py-1.5 font-sans">{e.name}</td>
                  <td className="py-1.5 text-right">
                    {now}
                    {e.unit}
                  </td>
                  <td className={cx("py-1.5 text-right", next > now ? "text-glow-strong" : "text-muted")}>
                    {next}
                    {e.unit}
                  </td>
                  <td className="py-1.5 text-right text-muted">
                    {e.max}
                    {e.unit}
                    {reach && <span className="block text-[10px]">Lv.{reach}で到達</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Window>

      <Window title="称号">
        <ul className="flex flex-col gap-2">
          {TITLE_DEFS.map((t) => {
            const has = game.titles.includes(t.id);
            const on = game.equippedTitle === t.id;
            return (
              <li key={t.id} className={cx("flex items-center gap-3 rounded border px-3 py-2", has ? "border-line" : "border-line/40 opacity-50")}>
                <div className="min-w-0 flex-1">
                  <p className={cx("text-sm font-semibold", has ? "text-gold" : "text-muted")}>{has ? t.name : "？？？"}</p>
                  <p className="text-xs text-muted">{t.desc}</p>
                </div>
                {has && (
                  <Button variant={on ? "primary" : "ghost"} className="shrink-0 px-2.5 py-1 text-xs" onClick={() => equipTitle(on ? undefined : t.id)}>
                    {on ? "装備中" : "装備"}
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      </Window>
    </div>
  );
}
