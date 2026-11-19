"use client";
// ダンジョン画面のボタンから開くパネル（下からせり上がる）
import Link from "next/link";
import { type ReactNode, useEffect } from "react";
import { PixelSprite } from "@/components/PixelSprite";
import { Button, cx } from "@/components/ui";
import { type Hero, RARITY, SLOT_LABEL, type Slot, UPGRADES, checkpointOf, itemStatsText, upgradeCost } from "@/lib/dungeon";
import { fmtBig } from "@/lib/format";
import type { GameState } from "@/lib/game";
import { SKILLS } from "@/lib/skills";
import { ALLIES, CHAPTERS, chapterLabel } from "@/lib/story";
import { buyUpgrade, recruitAlly, setFarm, unequip, warpTo } from "@/lib/store";

export function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/55" onClick={onClose} role="dialog" aria-modal aria-label={title}>
      <div className="sheet-in sys-window flex max-h-[78dvh] w-full max-w-xl flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between gap-2 border-b-2 border-black px-4 py-2.5">
          <h2 className="text-glow-strong glow-text tracking-widest">{title}</h2>
          <button onClick={onClose} className="px-2 text-lg text-muted hover:text-fg" aria-label="閉じる">
            ✕
          </button>
        </div>
        <div className="overflow-y-auto px-4 py-3 pb-[max(1rem,env(safe-area-inset-bottom))]">{children}</div>
      </div>
    </div>
  );
}

export function HeroPanel({ hero, game }: { hero: Hero; game: GameState }) {
  const rows: [string, string][] = [
    ["HP", fmtBig(hero.maxHp)],
    ["攻撃", fmtBig(hero.atk)],
    ["防御", fmtBig(hero.def)],
    ["攻撃間隔", `${(hero.interval / 1000).toFixed(2)}秒`],
    ["会心率", `${Math.round(hero.crit * 100)}%`],
    ["回避率", `${Math.round(hero.dodge * 100)}%`],
    ["連撃倍率", `×${hero.skillMul.toFixed(2)}`],
    ["ゴールド", `×${hero.goldMul.toFixed(2)}`],
  ];
  return (
    <div>
      <div className="flex items-center justify-between">
        <p className="text-sm">
          {game.playerName} <span className="font-mono text-glow-strong">Lv.{game.level}</span>
        </p>
        <Link href="/character" className="text-xs text-glow-strong underline">
          見た目を変える
        </Link>
      </div>
      <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
        {rows.map(([k, v]) => (
          <div key={k} className="flex justify-between gap-2 border-b border-line/40 py-0.5">
            <dt className="text-muted">{k}</dt>
            <dd className="font-mono tabular-nums">{v}</dd>
          </div>
        ))}
      </dl>
      <p className="mb-1.5 mt-4 text-xs text-glow-strong">スキル（現実のレベルで覚える）</p>
      <ul className="space-y-1 text-xs">
        {SKILLS.map((s) => (
          <li key={s.id} className={cx("flex justify-between gap-2", game.level < s.unlockLevel && "text-muted")}>
            <span>
              {s.name}
              <span className="ml-1 text-muted">（再使用 {s.cd / 1000}秒）</span>
            </span>
            <span className="text-right">{game.level >= s.unlockLevel ? s.desc : `Lv.${s.unlockLevel} で習得`}</span>
          </li>
        ))}
      </ul>
      <p className="mb-1.5 mt-4 text-xs text-glow-strong">現実の鍛錬による強化</p>
      <ul className="space-y-1 text-xs">
        {hero.bonuses.map((b) => (
          <li key={b.label} className={cx("flex justify-between gap-2", b.label.startsWith("疲労") && "text-danger", b.label.startsWith("鍛錬の加護") && "text-ok")}>
            <span className="min-w-0 truncate">{b.label}</span>
            <span className="shrink-0 text-right text-muted">{b.detail}</span>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-[11px] leading-relaxed text-muted">
        能力値（ステータス画面で振り分け）：STR→攻撃、VIT→HP・防御、AGI→攻撃速度・回避、SEN→会心率、INT→連撃の威力。レベルは現実のデイリークエストでしか上がりません。
      </p>
    </div>
  );
}

export function TownPanel({ game }: { game: GameState }) {
  const d = game.dungeon;
  return (
    <div>
      <p className="mb-3 text-right font-mono text-sm text-gold">所持 {fmtBig(d.gold)} G</p>
      <ul className="flex flex-col gap-3">
        {UPGRADES.map((u) => {
          const lv = d.upgrades[u.key];
          const cost = upgradeCost(lv);
          return (
            <li key={u.key} className="flex items-center gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-sm">
                  {u.name} <span className="font-mono text-xs text-muted">Lv.{lv}</span>
                </p>
                <p className="text-xs text-muted">{u.per}</p>
              </div>
              <Button className="shrink-0 px-3 py-1.5 text-xs" disabled={d.gold < cost} onClick={() => buyUpgrade(u.key)}>
                {fmtBig(cost)} G
              </Button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function EquipPanel({ game }: { game: GameState }) {
  const slots: Slot[] = ["weapon", "armor", "accessory"];
  return (
    <div>
      <ul className="flex flex-col gap-2">
        {slots.map((s) => {
          const it = game.dungeon.equipment[s];
          return (
            <li key={s} className="pixel-box flex items-center gap-3 px-3 py-2">
              <span className="w-12 shrink-0 text-xs text-muted">{SLOT_LABEL[s]}</span>
              {it ? (
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm" style={{ color: RARITY[it.rarity].color }}>
                    {it.name} <span className="font-mono text-[10px] text-muted">B{it.floor}F</span>
                  </p>
                  <p className="truncate text-xs text-muted">{itemStatsText(it)}</p>
                </div>
              ) : (
                <p className="flex-1 text-xs text-muted">なし（敵が落とすことがあります）</p>
              )}
              {it && (
                <button className="shrink-0 text-[11px] text-muted hover:text-danger" onClick={() => confirm(`${it.name}を売却しますか？`) && unequip(s)}>
                  売却
                </button>
              )}
            </li>
          );
        })}
      </ul>
      <p className="mt-2 text-[11px] text-muted">拾った装備は、今より強ければ自動で付け替え、弱ければ自動で売却します。ボスは必ず装備を落とします。</p>
    </div>
  );
}

export function PartyPanel({ hero, game }: { hero: Hero; game: GameState }) {
  const d = game.dungeon;
  return (
    <div>
      <p className="mb-3 text-xs leading-relaxed text-muted">
        仲間は、ダンジョンで出会ったあと「仲間にする」で加わります。条件は<span className="text-glow-strong">現実のレベル</span>（デイリークエストで上がる）とゴールドです。
      </p>
      <ul className="flex flex-col gap-2 text-xs">
        {ALLIES.map((a) => {
          const joined = hero.allies.includes(a);
          const met = d.deepest >= a.joinFloor;
          const lvOk = game.level >= a.level;
          const goldOk = d.gold >= a.cost;
          const dark = { ...a.sprite, palette: Object.fromEntries(Object.keys(a.sprite.palette).map((k) => [k, "#2a2226"])) };
          return (
            <li key={a.id} className={cx("pixel-box flex items-center gap-3 p-2", !met && "opacity-50")}>
              <PixelSprite sprite={met ? a.sprite : dark} scale={1.5} flip={a.id === "wolf"} />
              <div className="min-w-0 flex-1">
                <p className="text-sm">
                  {met ? `${a.name}（${a.role}）` : "？？？"}
                  {joined && <span className="ml-1 text-ok">加入中</span>}
                </p>
                <p className="text-[11px] leading-snug text-muted">{met ? a.desc : `B${a.joinFloor}F で出会う`}</p>
                {met && !joined && (
                  <p className="mt-0.5 text-[11px]">
                    <span className={lvOk ? "text-ok" : "text-danger"}>Lv.{a.level}以上</span>
                    <span className="mx-1 text-muted">・</span>
                    <span className={goldOk ? "text-ok" : "text-danger"}>{fmtBig(a.cost)}G</span>
                  </p>
                )}
              </div>
              {met && !joined && (
                <Button className="shrink-0 px-2.5 py-1.5 text-xs" disabled={!lvOk || !goldOk} onClick={() => recruitAlly(a.id)}>
                  仲間にする
                </Button>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function RecordPanel({ game, log }: { game: GameState; log: { id: number; text: string; tone?: string }[] }) {
  const d = game.dungeon;
  const reached = Math.floor((d.deepest - 1) / 10);
  return (
    <div>
      <dl className="grid grid-cols-2 gap-y-1 text-sm">
        <dt className="text-muted">討伐数</dt>
        <dd className="text-right font-mono">{fmtBig(d.kills)}</dd>
        <dt className="text-muted">ボス討伐</dt>
        <dd className="text-right font-mono">{d.bossKills}</dd>
        <dt className="text-muted">力尽きた回数</dt>
        <dd className="text-right font-mono">{d.deaths}</dd>
        <dt className="text-muted">累計ゴールド</dt>
        <dd className="text-right font-mono">{fmtBig(d.totalGold)}</dd>
        <dt className="text-muted">最深</dt>
        <dd className="text-right font-mono">B{d.deepest}F</dd>
      </dl>
      <p className="mb-1.5 mt-4 text-xs text-glow-strong">物語</p>
      <ul className="space-y-1 text-xs">
        {CHAPTERS.map((c, i) => (
          <li key={c.title} className={i <= reached ? "text-fg/90" : "text-muted"}>
            {i <= reached ? chapterLabel(i * 10 + 1) : `第${i + 1}章 ？？？`}
            {i < reached && <span className="ml-1 text-ok">踏破</span>}
          </li>
        ))}
      </ul>
      <p className="mb-1.5 mt-4 text-xs text-glow-strong">戦いの記録</p>
      <ul className="space-y-0.5 text-xs">
        {log
          .slice(-20)
          .reverse()
          .map((l) => (
            <li key={l.id} className={cx("truncate", l.tone ?? "text-fg/75")}>
              {l.text}
            </li>
          ))}
      </ul>
    </div>
  );
}

export function SettingsPanel({ game, onWarp }: { game: GameState; onWarp: (floor: number) => void }) {
  const d = game.dungeon;
  const checkpoints = Array.from({ length: Math.floor((checkpointOf(d.deepest) - 1) / 10) + 1 }, (_, i) => i * 10 + 1);
  return (
    <div className="flex flex-col gap-4 text-sm">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p>このフロアで稼ぐ</p>
          <p className="text-xs text-muted">次の階へ進まず、今の階で戦い続ける</p>
        </div>
        <Button variant={d.farm ? "primary" : "ghost"} className="shrink-0 px-3 py-1.5 text-xs" onClick={() => setFarm(!d.farm)} aria-pressed={d.farm}>
          {d.farm ? "ON" : "OFF"}
        </Button>
      </div>
      <div>
        <p>移動（10階ごとのチェックポイント）</p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {checkpoints.map((c) => (
            <Button
              key={c}
              variant={checkpointOf(d.floor) === c ? "primary" : "ghost"}
              className="px-2.5 py-1 text-xs"
              onClick={() => {
                warpTo(c);
                onWarp(c);
              }}
            >
              B{c}F
            </Button>
          ))}
        </div>
      </div>
    </div>
  );
}
