"use client";

import Link from "next/link";
import { memo, useEffect, useMemo, useRef, useState } from "react";
import { Button, Window, cx } from "@/components/ui";
import {
  ENCOUNTERS_PER_FLOOR,
  type Enemy,
  type Hero,
  RARITY,
  SLOT_LABEL,
  type Slot,
  UPGRADES,
  checkpointOf,
  damage,
  heroStats,
  isBossFloor,
  itemStatsText,
  makeEnemy,
  rollItem,
  upgradeCost,
} from "@/lib/dungeon";
import { PixelSprite } from "@/components/PixelSprite";
import { heroLook } from "@/lib/avatar";
import { SCENE_H, SCENE_W, sceneFor } from "@/lib/scenes";
import { type AllyId, ALLIES, chapterLabel, chapterOf } from "@/lib/story";
import type { GameState } from "@/lib/game";
import { buyUpgrade, claimIdle, showOpening, dungeonDeath, dungeonKill, setFarm, touchDungeon, unequip, useGame, warpTo } from "@/lib/store";

const TICK = 100;

interface Float {
  id: number;
  side: "hero" | "enemy" | AllyId;
  text: string;
  kind: "dmg" | "crit" | "skill" | "miss" | "heal" | "gold";
  born: number;
}

interface Runtime {
  phase: "walk" | "fight" | "dead";
  t: number;
  /** 最後に進めた時刻 */
  now: number;
  heroHp: number;
  enemy: Enemy | null;
  enemyFloor: number;
  enemyStage: number;
  enemyHp: number;
  heroCd: number;
  enemyCd: number;
  hits: number;
  allyCd: Record<AllyId, number>;
  /** 最後に行動した仲間と時刻（動きの表示用） */
  allyAct: Partial<Record<AllyId, number>>;
  floats: Float[];
  log: { id: number; text: string; tone?: string }[];
  heroHit: number;
  enemyHit: number;
}

let seq = 1;

export default function DungeonPage() {
  const game = useGame()!;
  if (!game.playerName) {
    return (
      <Window title="DUNGEON" className="mx-auto max-w-md">
        <p className="text-sm">先に「クエスト」画面でプレイヤー登録をしてください。</p>
        <Link href="/" className="mt-3 inline-block text-glow-strong underline">
          クエストへ
        </Link>
      </Window>
    );
  }
  return <Dungeon game={game} />;
}

function Dungeon({ game }: { game: GameState }) {
  const hero = useMemo(() => heroStats(game), [game]);
  const d = game.dungeon;
  const [paused, setPaused] = useState(false);
  const [, setFrame] = useState(0);

  const heroRef = useRef(hero);
  const gameRef = useRef(game);
  const pausedRef = useRef(paused);
  useEffect(() => {
    heroRef.current = hero;
    gameRef.current = game;
    pausedRef.current = paused;
  });

  // 戦闘中の状態は 0.1 秒ごとに書き換わるので、保存せずこのオブジェクトに直接持つ
  const [r] = useState<Runtime>(() => ({
    phase: "walk",
    t: 800,
    now: 0,
    heroHp: hero.maxHp,
    enemy: null,
    enemyFloor: d.floor,
    enemyStage: d.stage,
    enemyHp: 0,
    heroCd: 0,
    enemyCd: 0,
    hits: 0,
    allyCd: { healer: 4000, tank: 2000, mage: 3000, wolf: 1000 },
    allyAct: {},
    floats: [],
    log: [{ id: seq++, text: `${chapterOf(d.floor).chapter.title}に足を踏み入れた。` }],
    heroHit: 0,
    enemyHit: 0,
  }));

  // 放置報酬と、離れた時刻の記録
  useEffect(() => {
    showOpening();
    claimIdle();
    const onVis = () => (document.visibilityState === "visible" ? claimIdle() : touchDungeon());
    document.addEventListener("visibilitychange", onVis);
    const keep = setInterval(touchDungeon, 60_000);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      clearInterval(keep);
      touchDungeon();
    };
  }, []);

  useEffect(() => {
    const id = setInterval(() => {
      if (pausedRef.current) return;
      step(r, heroRef.current, gameRef.current);
      setFrame((f) => (f + 1) % 1_000_000);
    }, TICK);
    return () => clearInterval(id);
  }, [r]);

  const now = r.now;
  const { chapter } = chapterOf(d.floor);
  const look = heroLook(game.avatar);
  const heroAttacking = r.phase === "fight" && r.heroCd > hero.interval - 220;
  const heroSprite = heroAttacking ? look.attack : look.idle[Math.floor(now / 600) % 2];
  const checkpoints = Array.from({ length: Math.floor((checkpointOf(d.deepest) - 1) / 10) + 1 }, (_, i) => i * 10 + 1);

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-4">
      <div className="flex items-end justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-xs text-muted">{chapterLabel(d.floor)}</p>
          <p className="font-mono text-2xl font-bold text-glow-strong glow-text">
            B{d.floor}F{isBossFloor(d.floor) && <span className="ml-2 text-sm text-danger">BOSS</span>}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p className="font-mono text-lg text-gold">{d.gold.toLocaleString()} G</p>
          <p className="text-[11px] text-muted">最深 B{d.deepest}F</p>
        </div>
      </div>
      <div className="flex gap-1.5">
        {Array.from({ length: ENCOUNTERS_PER_FLOOR }, (_, i) => {
          const boss = isBossFloor(d.floor) && i === ENCOUNTERS_PER_FLOOR - 1;
          return (
            <span
              key={i}
              className={cx(
                "h-1.5 flex-1 rounded-full",
                i < d.stage ? "bg-glow" : i === d.stage ? "bg-glow/40 animate-pulse" : "bg-subtle",
                boss && i >= d.stage && "bg-danger/50",
              )}
            />
          );
        })}
      </div>

      {/* 戦闘の場面 */}
      <div className="pixel-frame relative aspect-[3/2] w-full overflow-hidden bg-black">
        <Scene floor={d.floor} boss={isBossFloor(d.floor)} />
        {/* 主人公と仲間（左）と敵（右） */}
        <div className="absolute inset-x-3 bottom-[13%] flex items-end justify-between gap-2">
          <div className="flex min-w-0 items-end gap-1">
            {hero.allies
              .slice()
              .reverse()
              .map((a) => (
                <div key={a.id} className={cx("flex flex-col items-center transition-transform", now - (r.allyAct[a.id] ?? 0) < 200 && "-translate-y-1")}>
                  <PixelSprite sprite={a.sprite} scale={1.5} flip={a.id === "wolf"} />
                  <span className="mt-0.5 text-[9px] text-fg/70">{a.name}</span>
                </div>
              ))}
            <div className="flex w-24 flex-col items-center">
              <HpBar value={r.heroHp / hero.maxHp} label={`${Math.max(0, Math.ceil(r.heroHp))}`} />
              <div className={cx("mt-1 transition-transform", now - r.heroHit < 150 && "-translate-x-1", r.phase === "fight" && r.heroCd > hero.interval - 150 && "translate-x-2", r.phase === "dead" && "rotate-90 opacity-40")}>
                <PixelSprite sprite={heroSprite} scale={look.scale} className={hero.blessed ? "blessed" : undefined} />
              </div>
              <p className="mt-0.5 max-w-full truncate text-[10px] text-fg/90">{game.playerName}</p>
            </div>
          </div>
          {r.enemy && r.phase !== "walk" && (
            <div className="flex w-24 shrink-0 flex-col items-center">
              <HpBar value={r.enemyHp / r.enemy.maxHp} danger label={`${Math.max(0, Math.ceil(r.enemyHp))}`} />
              <div className={cx("mt-1 transition-transform", now - r.enemyHit < 150 && "translate-x-1 brightness-200")}>
                <PixelSprite sprite={r.enemy.sprite} scale={r.enemy.boss ? 4 : 3} title={r.enemy.name} />
              </div>
              <p className={cx("mt-0.5 max-w-full truncate text-[10px]", r.enemy.boss ? "text-danger" : "text-fg/90")}>{r.enemy.name}</p>
            </div>
          )}
        </div>
        {r.phase === "walk" && <p className="blink absolute right-[10%] top-1/2 -translate-y-1/2 text-xs tracking-widest text-muted">探索中…</p>}
        {/* ダメージの数字 */}
        {r.floats.map((f) => (
          <span
            key={f.id}
            className={cx("dmg-float pointer-events-none absolute", floatCls(f.kind))}
            style={{ left: f.side === "enemy" ? "76%" : f.side === "hero" ? "36%" : "18%", top: "36%" }}
          >
            {f.text}
          </span>
        ))}
        {r.phase === "dead" && (
          <div className="absolute inset-0 grid place-items-center bg-black/60">
            <div className="text-center">
              <p className="text-xl tracking-[0.3em] text-danger">GAME OVER</p>
              <p className="mt-1 text-xs text-fg/80">B{checkpointOf(d.floor)}F から再挑戦します</p>
            </div>
          </div>
        )}
        {paused && (
          <div className="absolute inset-0 grid place-items-center bg-black/50">
            <p className="tracking-[0.3em] text-glow-strong">PAUSE</p>
          </div>
        )}
      </div>

      <div className="pixel-box px-3 py-2">
        <p className="text-[11px] text-muted">
          {chapter.rank}級ボス：<span className="text-danger">{chapter.boss.name}</span>（B{Math.floor((d.floor - 1) / 10) * 10 + 10}F）
        </p>
      </div>

      <ul className="flex h-24 flex-col-reverse overflow-hidden text-xs" aria-live="polite">
        {r.log.slice(-6).map((l) => (
          <li key={l.id} className={cx("truncate py-0.5", l.tone ?? "text-fg/75")}>
            {l.text}
          </li>
        ))}
      </ul>

      <div className="flex flex-wrap items-center gap-2">
        <Button variant={paused ? "primary" : "ghost"} className="px-3 py-1.5 text-xs" onClick={() => setPaused((p) => !p)}>
          {paused ? "▶ 再開" : "❚❚ 一時停止"}
        </Button>
        <Button variant={d.farm ? "primary" : "ghost"} className="px-3 py-1.5 text-xs" onClick={() => setFarm(!d.farm)} aria-pressed={d.farm}>
          {d.farm ? "このフロアで稼ぐ：ON" : "このフロアで稼ぐ：OFF"}
        </Button>
        <label className="ml-auto flex items-center gap-1.5 text-xs text-muted">
          移動
          <select
            className="rounded border border-line bg-bg px-2 py-1.5 text-fg"
            value={checkpointOf(d.floor)}
            onChange={(e) => {
              warpTo(Number(e.target.value));
              resetRuntime(r, hero, `B${e.target.value}F へ移動した。`);
            }}
          >
            {checkpoints.map((c) => (
              <option key={c} value={c}>
                B{c}F
              </option>
            ))}
          </select>
        </label>
      </div>

      <HeroPanel hero={hero} />
      <Town game={game} />
      <Equipment game={game} />
      <Window title="記録">
        <dl className="grid grid-cols-2 gap-y-1 text-sm">
          <dt className="text-muted">討伐数</dt>
          <dd className="text-right font-mono">{d.kills.toLocaleString()}</dd>
          <dt className="text-muted">ボス討伐</dt>
          <dd className="text-right font-mono">{d.bossKills}</dd>
          <dt className="text-muted">力尽きた回数</dt>
          <dd className="text-right font-mono">{d.deaths}</dd>
          <dt className="text-muted">累計ゴールド</dt>
          <dd className="text-right font-mono">{d.totalGold.toLocaleString()}</dd>
        </dl>
      </Window>
    </div>
  );
}

// ---- 戦闘の進行 ----

function log(r: Runtime, text: string, tone?: string) {
  r.log.push({ id: seq++, text, tone });
  if (r.log.length > 30) r.log.splice(0, r.log.length - 30);
}

function float(r: Runtime, side: Float["side"], text: string, kind: Float["kind"]) {
  r.floats.push({ id: seq++, side, text, kind, born: Date.now() });
}

function resetRuntime(r: Runtime, hero: Hero, msg: string) {
  r.phase = "walk";
  r.t = 800;
  r.enemy = null;
  r.heroHp = hero.maxHp;
  log(r, msg);
}

function step(r: Runtime, hero: Hero, game: GameState) {
  const d = game.dungeon;
  const now = Date.now();
  r.now = now;
  r.floats = r.floats.filter((f) => now - f.born < 900);
  if (r.heroHp > hero.maxHp) r.heroHp = hero.maxHp;

  // フロアや進み具合が外から変わったとき（移動など）は、敵を出し直す
  if (r.enemy && (r.enemyFloor !== d.floor || r.enemyStage !== d.stage) && r.phase === "fight") {
    r.enemy = null;
    r.phase = "walk";
    r.t = 600;
  }

  if (r.phase === "walk") {
    r.t -= TICK;
    if (r.t <= 0) {
      const e = makeEnemy(d.floor, d.stage);
      r.enemy = e;
      r.enemyFloor = d.floor;
      r.enemyStage = d.stage;
      r.enemyHp = e.maxHp;
      r.heroCd = 300;
      r.enemyCd = e.interval * 0.8;
      r.phase = "fight";
      log(r, e.boss ? `⚠ ボス「${e.name}」が現れた！` : `${e.name}が現れた。`, e.boss ? "text-danger font-bold" : undefined);
    }
    return;
  }

  if (r.phase === "dead") {
    r.t -= TICK;
    if (r.t <= 0) {
      dungeonDeath();
      r.heroHp = hero.maxHp;
      r.phase = "walk";
      r.t = 1000;
      r.enemy = null;
      log(r, `B${checkpointOf(d.floor)}F で目を覚ました。もう一度挑む。`);
    }
    return;
  }

  const e = r.enemy!;
  r.heroCd -= TICK;
  r.enemyCd -= TICK;

  if (r.heroCd <= 0) {
    r.hits++;
    r.heroCd += hero.interval;
    r.enemyHit = now;
    if (r.hits % hero.skillEvery === 0) {
      const dmg = Math.round(hero.atk * hero.skillMul);
      r.enemyHp -= dmg;
      float(r, "enemy", `${dmg}`, "skill");
      log(r, `スキル「烈風斬」！ ${e.name}に ${dmg} のダメージ`, "text-glow-strong");
    } else {
      const crit = Math.random() < hero.crit;
      const dmg = Math.round(damage(hero.atk, e.def) * (crit ? hero.critMul : 1));
      r.enemyHp -= dmg;
      float(r, "enemy", crit ? `${dmg}!` : `${dmg}`, crit ? "crit" : "dmg");
    }
  }

  for (const a of hero.allies) {
    r.allyCd[a.id] -= TICK;
    if (r.allyCd[a.id] > 0) continue;
    r.allyAct[a.id] = now;
    if (a.id === "healer") {
      r.allyCd.healer += 4000;
      if (r.heroHp < hero.maxHp) {
        const heal = Math.round(hero.maxHp * 0.08);
        r.heroHp = Math.min(hero.maxHp, r.heroHp + heal);
        float(r, "healer", `+${heal}`, "heal");
      }
    } else if (a.id === "tank") {
      r.allyCd.tank += 2000;
      const dmg = damage(hero.atk * 0.3, e.def);
      r.enemyHp -= dmg;
      float(r, "enemy", `${dmg}`, "dmg");
    } else if (a.id === "mage") {
      r.allyCd.mage += 3000;
      const dmg = Math.round(hero.atk * 0.8);
      r.enemyHp -= dmg;
      float(r, "enemy", `${dmg}`, "skill");
    } else if (a.id === "wolf") {
      r.allyCd.wolf += 1000;
      const dmg = damage(hero.atk * 0.35, e.def);
      r.enemyHp -= dmg;
      float(r, "enemy", `${dmg}`, "dmg");
    }
  }

  if (r.enemyHp <= 0) {
    const gold = Math.round(e.gold * hero.goldMul);
    const drop = e.boss || Math.random() < 0.08 ? rollItem(d.floor, e.boss) : null;
    const finishedFloor = d.stage + 1 >= ENCOUNTERS_PER_FLOOR;
    const loot = dungeonKill(gold, drop);
    float(r, "enemy", `+${gold}G`, "gold");
    log(r, `${e.name}を倒した。 +${gold}G`, "text-gold");
    if (loot) {
      const rar = RARITY[loot.item.rarity];
      log(
        r,
        loot.equipped
          ? `【${rar.name}】${loot.item.name}を手に入れ、装備した！`
          : `【${rar.name}】${loot.item.name}を拾った（今の装備の方が強いので ${loot.sold}G で売却）`,
        loot.equipped ? "text-ok" : "text-muted",
      );
    }
    const heal = Math.round(hero.maxHp * 0.15);
    r.heroHp = Math.min(hero.maxHp, r.heroHp + heal);
    if (finishedFloor) {
      r.heroHp = hero.maxHp;
      log(r, d.farm ? "フロアを一周した。同じフロアで稼ぎ続ける。" : `B${d.floor + 1}F へ進んだ。HP が全回復した。`, "text-glow");
    }
    r.enemy = null;
    r.phase = "walk";
    r.t = 700;
    return;
  }

  if (r.enemyCd <= 0) {
    r.enemyCd += e.interval;
    if (Math.random() < hero.dodge) {
      float(r, "hero", "MISS", "miss");
    } else {
      const dmg = Math.max(1, Math.round(damage(e.atk, hero.def) * hero.takenMul));
      r.heroHp -= dmg;
      r.heroHit = now;
      float(r, "hero", `${dmg}`, "dmg");
    }
    if (r.heroHp <= 0) {
      r.heroHp = 0;
      r.phase = "dead";
      r.t = 2200;
      log(r, `${e.name}に倒された……`, "text-danger");
    }
  }
}

// ---- 表示の部品 ----

/** 階ごとの背景。描くのは階が変わったときだけ */
const Scene = memo(function Scene({ floor, boss }: { floor: number; boss: boolean }) {
  const px = useMemo(() => sceneFor(floor, boss), [floor, boss]);
  return (
    <svg viewBox={`0 0 ${SCENE_W} ${SCENE_H}`} className="absolute inset-0 h-full w-full" shapeRendering="crispEdges" preserveAspectRatio="xMidYMid slice" aria-hidden>
      {px.map((p, i) => (
        <rect key={i} x={p.x} y={p.y} width={p.w} height={p.h} fill={p.c} className={p.cls} />
      ))}
    </svg>
  );
});

function floatCls(k: Float["kind"]) {
  return {
    dmg: "text-base text-white",
    crit: "text-xl text-gold",
    skill: "text-xl text-glow-strong",
    miss: "text-sm text-muted",
    heal: "text-sm text-ok",
    gold: "text-sm text-gold",
  }[k];
}

function HpBar({ value, label, danger }: { value: number; label: string; danger?: boolean }) {
  return (
    <div className="w-full">
      <div className="h-2 overflow-hidden border border-black bg-black/70">
        <div
          className={cx("pixel-segments h-full", danger ? "bg-danger" : value < 0.3 ? "bg-gold" : "bg-ok")}
          style={{ width: `${Math.max(0, Math.min(1, value)) * 100}%` }}
        />
      </div>
      <p className="mt-0.5 text-center text-[10px] text-fg/80">{label}</p>
    </div>
  );
}

function HeroPanel({ hero }: { hero: Hero }) {
  const rows: [string, string][] = [
    ["HP", hero.maxHp.toLocaleString()],
    ["攻撃", hero.atk.toLocaleString()],
    ["防御", String(hero.def)],
    ["攻撃間隔", `${(hero.interval / 1000).toFixed(2)}秒`],
    ["会心率", `${Math.round(hero.crit * 100)}%`],
    ["回避率", `${Math.round(hero.dodge * 100)}%`],
    ["スキル倍率", `×${hero.skillMul.toFixed(2)}`],
    ["ゴールド", `×${hero.goldMul.toFixed(2)}`],
  ];
  return (
    <Window
      title="主人公"
      right={
        <Link href="/character" className="text-xs text-glow-strong underline">
          見た目を変える
        </Link>
      }
    >
      <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm sm:grid-cols-4">
        {rows.map(([k, v]) => (
          <div key={k} className="flex justify-between gap-2 border-b border-line/40 py-0.5">
            <dt className="text-muted">{k}</dt>
            <dd className="font-mono tabular-nums">{v}</dd>
          </div>
        ))}
      </dl>
      <p className="mb-1.5 mt-4 text-xs text-glow-strong">パーティ</p>
      <ul className="grid grid-cols-2 gap-2 text-xs">
        {ALLIES.map((a) => {
          const joined = hero.allies.includes(a);
          return (
            <li key={a.id} className={cx("pixel-box flex items-center gap-2 p-2", !joined && "opacity-45")}>
              <PixelSprite sprite={joined ? a.sprite : { ...a.sprite, palette: Object.fromEntries(Object.keys(a.sprite.palette).map((k) => [k, "#2a3346"])) }} scale={2} flip={a.id === "wolf"} />
              <div className="min-w-0">
                <p className="truncate">{joined ? `${a.name}（${a.role}）` : "？？？"}</p>
                <p className="text-[10px] leading-snug text-muted">{joined ? a.desc : `B${a.joinFloor}F で出会う`}</p>
              </div>
            </li>
          );
        })}
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
        能力値（ステータス画面で振り分け）：STR→攻撃、VIT→HP・防御、AGI→攻撃速度・回避、SEN→会心率、INT→スキル威力。
        レベルは現実のデイリークエストでしか上がりません。
      </p>
    </Window>
  );
}

function Town({ game }: { game: GameState }) {
  const d = game.dungeon;
  return (
    <Window title="町：訓練所" right={<span className="font-mono text-xs text-gold">{d.gold.toLocaleString()} G</span>}>
      <ul className="flex flex-col gap-2">
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
                {cost.toLocaleString()} G
              </Button>
            </li>
          );
        })}
      </ul>
    </Window>
  );
}

function Equipment({ game }: { game: GameState }) {
  const slots: Slot[] = ["weapon", "armor", "accessory"];
  return (
    <Window title="装備">
      <ul className="flex flex-col gap-2">
        {slots.map((s) => {
          const it = game.dungeon.equipment[s];
          return (
            <li key={s} className="flex items-center gap-3 rounded border border-line/70 px-3 py-2">
              <span className="w-12 shrink-0 text-xs text-muted">{SLOT_LABEL[s]}</span>
              {it ? (
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold" style={{ color: RARITY[it.rarity].color }}>
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
    </Window>
  );
}
