"use client";

import Link from "next/link";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { PixelSprite } from "@/components/PixelSprite";
import { Window, cx } from "@/components/ui";
import { heroLook } from "@/lib/avatar";
import { toDateKey } from "@/lib/date";
import { ENCOUNTERS_PER_FLOOR, type Hero, checkpointOf, heroStats, isBossFloor } from "@/lib/dungeon";
import { fmtBig } from "@/lib/format";
import type { GameState } from "@/lib/game";
import { ICONS, type IconName } from "@/lib/icons";
import { SCENE_H, SCENE_W, sceneColors, sceneFor } from "@/lib/scenes";
import { SKILLS, type SkillId } from "@/lib/skills";
import { chapterLabel, chapterOf } from "@/lib/story";
import { claimIdle, showOpening, touchDungeon, useGame } from "@/lib/store";
import { FEATURES, type Feature, isUnlocked } from "@/lib/unlocks";
import { type Float, type Runtime, TICK, castSkill, newRuntime, resetRuntime, showBanner, step } from "./engine";
import { EquipPanel, HeroPanel, PartyPanel, RecordPanel, SettingsPanel, Sheet, TownPanel } from "./panels";

type PanelId = "hero" | "train" | "equip" | "party" | "record" | "settings";
const PANELS: { id: PanelId; icon: IconName; label: string; feature?: Feature }[] = [
  { id: "hero", icon: "hero", label: "主人公" },
  { id: "train", icon: "train", label: "訓練所", feature: "train" },
  { id: "equip", icon: "equip", label: "装備", feature: "equip" },
  { id: "party", icon: "party", label: "仲間", feature: "party" },
  { id: "record", icon: "record", label: "記録" },
  { id: "settings", icon: "settings", label: "移動", feature: "move" },
];

const AUTO_KEY = "level-quest:auto-skill";

export default function DungeonPage() {
  const game = useGame()!;
  if (!game.playerName) {
    return (
      <div className="p-4">
        <Window title="DUNGEON" className="mx-auto max-w-md">
          <p className="text-sm">先に「クエスト」画面でプレイヤー登録をしてください。</p>
          <Link href="/" className="mt-3 inline-block text-glow-strong underline">
            クエストへ
          </Link>
        </Window>
      </div>
    );
  }
  return <Dungeon game={game} />;
}

function Dungeon({ game }: { game: GameState }) {
  const hero = useMemo(() => heroStats(game), [game]);
  const d = game.dungeon;
  const [paused, setPaused] = useState(false);
  const [panel, setPanel] = useState<PanelId | null>(null);
  const [auto, setAuto] = useState(() => {
    try {
      return localStorage.getItem(AUTO_KEY) !== "0";
    } catch {
      return true;
    }
  });
  const [, setFrame] = useState(0);

  const heroRef = useRef(hero);
  const gameRef = useRef(game);
  const pausedRef = useRef(paused);
  const autoRef = useRef(auto);
  useEffect(() => {
    heroRef.current = hero;
    gameRef.current = game;
    pausedRef.current = paused || panel !== null;
    autoRef.current = auto;
  });

  // 戦闘中の状態は 0.1 秒ごとに書き換わるので、保存せずこのオブジェクトに直接持つ
  const [r] = useState<Runtime>(() => newRuntime(hero, d.floor, d.stage, `${chapterOf(d.floor).chapter.title}に足を踏み入れた。`));

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
      step(r, heroRef.current, gameRef.current, autoRef.current && isUnlocked(gameRef.current, "auto"));
      setFrame((f) => (f + 1) % 1_000_000);
    }, TICK);
    return () => clearInterval(id);
  }, [r]);

  const closePanel = useCallback(() => setPanel(null), []);
  const toggleAuto = () => {
    setAuto((a) => {
      try {
        localStorage.setItem(AUTO_KEY, a ? "0" : "1");
      } catch {}
      return !a;
    });
  };

  const now = r.now;
  const { chapter } = chapterOf(d.floor);
  const colors = sceneColors(d.floor);
  const bossFloor = Math.floor((d.floor - 1) / 10) * 10 + 10;
  const onBoss = isBossFloor(d.floor) && d.stage === ENCOUNTERS_PER_FLOOR - 1;
  const can = (f?: Feature) => !f || isUnlocked(game, f);
  /** まだ使えない機能を押したとき：解放の条件を帯で知らせる */
  const lockedTap = (f: Feature) => {
    showBanner(r, `${FEATURES[f].name}：${FEATURES[f].cond}で解放`, "#9a8a76");
    setFrame((x) => x + 1);
  };
  const autoOn = auto && can("auto");
  const questDone = !!game.days[toDateKey()]?.cleared || !!game.days[toDateKey()]?.rest;

  return (
    <div className="relative mx-auto h-[calc(100dvh-108px-env(safe-area-inset-top)-env(safe-area-inset-bottom))] w-full max-w-xl overflow-hidden md:h-[calc(100dvh-49px)]" style={{ background: colors.top }}>
      {/* 背景：上は闇に溶け、下は床が続く */}
      <div className="absolute inset-0" style={{ background: `linear-gradient(180deg, #000 0%, transparent 45%), radial-gradient(ellipse 70% 40% at 50% 62%, rgba(255,140,60,0.10), transparent 70%)` }} />
      <div className="absolute inset-x-0 bottom-0 h-[24%]" style={{ background: `linear-gradient(180deg, ${colors.floor}, #050304)` }} />

      {/* 舞台（背景の絵と登場人物） */}
      <div className="absolute inset-x-0 bottom-[22%] aspect-[3/2]">
        <Scene floor={d.floor} boss={isBossFloor(d.floor)} />
        {r.flash && now - r.flash.born < 260 && <div className="pointer-events-none absolute inset-0" style={{ background: r.flash.color }} />}
        <Actors r={r} hero={hero} game={game} now={now} />
        {/* 床に映る影 */}
        <div className="reflection pointer-events-none absolute inset-x-0 top-[87%] h-[60%] overflow-hidden" aria-hidden>
          <div className="absolute inset-0" style={{ transform: "scaleY(-1)" }}>
            <Actors r={r} hero={hero} game={game} now={now} reflection />
          </div>
        </div>
        {/* 斬撃の光 */}
        {r.slash && now - r.slash.born < 160 && r.enemy && (
          <svg className="pointer-events-none absolute bottom-[18%] right-[6%] h-[26%] w-[22%]" viewBox="0 0 40 40" aria-hidden>
            <path d="M4 34 Q20 4 38 2" fill="none" stroke="#fff" strokeWidth={r.slash.big ? 4 : 2.5} strokeLinecap="square" opacity="0.9" />
            <path d="M8 36 Q24 10 38 8" fill="none" stroke="#e6c27a" strokeWidth={r.slash.big ? 2 : 1} opacity="0.7" />
          </svg>
        )}
        {/* 飛び散るコイン */}
        {r.coins.map((c) => (
          <span key={c.id} className="coin-pop pointer-events-none absolute bottom-[30%] right-[22%]" style={{ ["--dx" as string]: `${c.dx}px`, ["--dy" as string]: `${c.dy}px`, animationDelay: `${Math.max(0, c.born - now)}ms` }}>
            <PixelSprite sprite={ICONS.coin} scale={0.5} />
          </span>
        ))}
        {/* ダメージの数字 */}
        {r.floats.map((f) => (
          <span key={f.id} className={cx("dmg-float pointer-events-none absolute whitespace-nowrap", floatCls(f.kind))} style={floatPos(f)}>
            {f.kind === "gold" && <PixelSprite sprite={ICONS.coin} scale={0.75} className="mr-0.5 inline-block align-[-3px]" />}
            {f.text}
          </span>
        ))}
        {r.phase === "walk" && <p className="blink absolute right-[12%] top-[52%] text-xs tracking-widest text-muted">探索中…</p>}
      </div>

      {/* 戦いの記録（下の床に小さく） */}
      <ul className="pointer-events-none absolute inset-x-3 bottom-2 flex flex-col-reverse text-[10px] leading-tight" aria-live="polite">
        {r.log
          .slice(-3)
          .reverse()
          .map((l, i) => (
            <li key={l.id} className={cx("truncate", l.tone ?? "text-fg/70")} style={{ opacity: 1 - i * 0.3 }}>
              {l.text}
            </li>
          ))}
      </ul>

      {/* 上の HUD */}
      <div className="absolute inset-x-0 top-0 flex flex-col gap-1.5 p-2">
        <div className="flex justify-end gap-1">
          {PANELS.map((p) => (
            <RoundButton key={p.id} icon={p.icon} label={p.label} locked={!can(p.feature)} onClick={() => (can(p.feature) ? setPanel(p.id) : lockedTap(p.feature!))} />
          ))}
        </div>
        <div className="hud-bar px-3 py-1.5 text-xs">
          {onBoss ? (
            <span className="text-danger">ボス戦：{chapter.boss.name} を倒せ！</span>
          ) : (
            <span>
              次の目標：<span className="text-ok">B{bossFloor}F</span> の <span className="text-danger">{chapter.boss.name}</span> を討伐する
            </span>
          )}
        </div>
        <div className="grid grid-cols-3 gap-1.5">
          <Pill icon="coin" value={fmtBig(d.gold)} color="text-gold" />
          <Pill label="討伐" value={fmtBig(d.kills)} color="text-fg" />
          <Pill label="最深" value={`B${d.deepest}F`} color="text-glow-strong" />
        </div>
        <div className="flex items-center gap-2 px-1">
          <div className="min-w-0 flex-1">
            <p className="truncate text-[10px] text-muted">{chapterLabel(d.floor)}</p>
            <div className="flex items-center gap-1.5">
              <span className="font-mono text-base text-glow-strong glow-text">B{d.floor}F</span>
              <span className="flex gap-0.5">
                {Array.from({ length: ENCOUNTERS_PER_FLOOR }, (_, i) => (
                  <span
                    key={i}
                    className={cx("h-2 w-2", i < d.stage ? "bg-glow-strong" : i === d.stage ? "blink bg-glow" : "bg-black/60", isBossFloor(d.floor) && i === ENCOUNTERS_PER_FLOOR - 1 && i >= d.stage && "bg-danger")}
                  />
                ))}
              </span>
              {d.farm && <span className="text-[10px] text-gold">稼ぎ中</span>}
            </div>
          </div>
          <div className="flex w-[45%] items-center gap-1.5">
            <PixelSprite sprite={heroLook(game.avatar).idle[0]} scale={heroLook(game.avatar).scale * 0.5} />
            <div className="flex-1">
              <div className="h-3 border-2 border-black bg-black/70">
                <div className={cx("pixel-segments h-full", r.heroHp / hero.maxHp < 0.3 ? "bg-gold" : "bg-ok")} style={{ width: `${Math.max(0, Math.min(1, r.heroHp / hero.maxHp)) * 100}%` }} />
              </div>
              <p className="text-right font-mono text-[10px] text-fg/80">
                {fmtBig(Math.max(0, Math.ceil(r.heroHp)))} / {fmtBig(hero.maxHp)}
              </p>
            </div>
          </div>
        </div>
        {/* スキル */}
        <div className="flex items-start justify-end gap-1.5">
          <button
            type="button"
            onClick={() => (can("auto") ? toggleAuto() : lockedTap("auto"))}
            aria-pressed={autoOn}
            className={cx("hud-bar mt-3 px-2 py-1 font-mono text-[10px]", autoOn ? "text-ok" : "text-muted")}
          >
            AUTO
            <br />
            {can("auto") ? (autoOn ? "ON" : "OFF") : "🔒"}
          </button>
          {SKILLS.map((s) => (
            <SkillButton key={s.id} id={s.id} r={r} level={game.level} onUse={() => castSkill(r, hero, game.level, s.id)} />
          ))}
        </div>
      </div>

      {/* 左のボタン */}
      <div className="absolute left-2 top-[50%] flex flex-col gap-2.5">
        <Link href="/" className="side-btn relative" aria-label="今日のクエスト">
          <PixelSprite sprite={ICONS.quest} scale={1.25} />
          {!questDone && <span className="round absolute -right-1.5 -top-1.5 grid h-5 w-5 place-items-center bg-danger text-[11px] text-white">!</span>}
        </Link>
        <button type="button" className={cx("side-btn", !can("equip") && "opacity-50")} onClick={() => (can("equip") ? setPanel("equip") : lockedTap("equip"))} aria-label="装備">
          <PixelSprite sprite={can("equip") ? ICONS.chest : ICONS.lock} scale={1.25} />
        </button>
        <button type="button" className="side-btn" onClick={() => setPaused((p) => !p)} aria-label={paused ? "再開" : "一時停止"}>
          <PixelSprite sprite={paused ? ICONS.play : ICONS.pause} scale={1.25} />
        </button>
      </div>

      {/* 状態の帯 */}
      {r.banner && (
        <div className="banner-in pointer-events-none absolute inset-x-0 top-[44%] py-1.5 text-center text-sm" style={{ background: "linear-gradient(90deg, transparent, rgba(0,0,0,.75) 20%, rgba(0,0,0,.75) 80%, transparent)", color: r.banner.color }}>
          {r.banner.text}
        </div>
      )}
      {r.phase === "dead" && (
        <div className="absolute inset-0 grid place-items-center bg-black/60">
          <div className="text-center">
            <p className="text-2xl tracking-[0.3em] text-danger">GAME OVER</p>
            <p className="mt-1 text-xs text-fg/80">B{checkpointOf(d.floor)}F から再挑戦します</p>
          </div>
        </div>
      )}
      {paused && (
        <button type="button" className="absolute inset-0 grid place-items-center bg-black/50" onClick={() => setPaused(false)}>
          <span className="tracking-[0.3em] text-glow-strong">PAUSE（タップで再開）</span>
        </button>
      )}

      {panel && (
        <Sheet title={PANELS.find((p) => p.id === panel)!.label} onClose={closePanel}>
          {panel === "hero" && <HeroPanel hero={hero} game={game} />}
          {panel === "train" && <TownPanel game={game} />}
          {panel === "equip" && <EquipPanel game={game} />}
          {panel === "party" && <PartyPanel hero={hero} game={game} />}
          {panel === "record" && <RecordPanel game={game} log={r.log} />}
          {panel === "settings" && <SettingsPanel game={game} onWarp={(f) => resetRuntime(r, hero, `B${f}F へ移動した。`)} />}
        </Sheet>
      )}
    </div>
  );
}

// ---- 登場人物 ----

function Actors({ r, hero, game, now, reflection }: { r: Runtime; hero: Hero; game: GameState; now: number; reflection?: boolean }) {
  const look = heroLook(game.avatar);
  const attacking = r.phase === "fight" && r.heroCd > hero.interval - 220;
  const heroSprite = attacking ? look.attack : look.idle[Math.floor(now / 600) % 2];
  const showUi = !reflection;
  return (
    <div className={cx("absolute left-[54px] right-2 flex items-end justify-between gap-1", reflection ? "bottom-0" : "bottom-[13%]")}>
      <div className="flex min-w-0 items-end">
        {hero.allies
          .slice()
          .reverse()
          .map((a, i) => (
            <div key={a.id} className={cx("flex flex-col items-center transition-transform", i > 0 && "-ml-3", now - (r.allyAct[a.id] ?? 0) < 200 && "-translate-y-1")}>
              {/* 仲間は 24×32 を 2 倍＝主人公と同じ高さ */}
              <PixelSprite sprite={a.sprite} scale={2} flip={a.id === "wolf"} />
              {showUi && <span className="text-[9px] text-fg/70">{a.name}</span>}
            </div>
          ))}
        <div className={cx("flex w-16 flex-col items-center", hero.allies.length > 0 && "-ml-2")}>
          <div className={cx("transition-transform", now - r.heroHit < 150 && "-translate-x-1", attacking && "translate-x-2", r.phase === "dead" && "rotate-90 opacity-40")}>
            <PixelSprite sprite={heroSprite} scale={look.scale} flip={look.flip} className={hero.blessed ? "blessed" : undefined} />
          </div>
          {showUi && <p className="max-w-full truncate text-[10px] text-fg/90">{game.playerName}</p>}
        </div>
      </div>
      {r.enemy && r.phase !== "walk" && (
        <div className="flex w-20 shrink-0 flex-col items-center">
          {showUi && (
            <div className="mb-1 w-full">
              <div className="h-2 border border-black bg-black/70">
                <div className="pixel-segments h-full bg-danger" style={{ width: `${Math.max(0, Math.min(1, r.enemyHp / r.enemy.maxHp)) * 100}%` }} />
              </div>
            </div>
          )}
          <div className={cx("transition-transform", now - r.enemyHit < 150 && "translate-x-1 brightness-200")}>
            {/* 雑魚は 24×24 を 2.5 倍、ボスは 64×64 を 1.25 倍（少しだけ大きく） */}
            <PixelSprite sprite={r.enemy.sprite} scale={r.enemy.boss ? 1.25 : 2.5} title={showUi ? r.enemy.name : undefined} />
          </div>
          {showUi && <p className={cx("max-w-full truncate text-[10px]", r.enemy.boss ? "text-danger" : "text-fg/90")}>{r.enemy.name}</p>}
        </div>
      )}
    </div>
  );
}

/** 階ごとの背景。描くのは階が変わったときだけ */
const Scene = memo(function Scene({ floor, boss }: { floor: number; boss: boolean }) {
  const px = useMemo(() => sceneFor(floor, boss), [floor, boss]);
  return (
    <svg viewBox={`0 0 ${SCENE_W} ${SCENE_H}`} className="absolute inset-0 h-full w-full" shapeRendering="crispEdges" preserveAspectRatio="xMidYMax slice" aria-hidden>
      {px.map((p, i) => (
        <rect key={i} x={p.x} y={p.y} width={p.w} height={p.h} fill={p.c} className={p.cls} />
      ))}
    </svg>
  );
});

function floatCls(k: Float["kind"]) {
  return {
    dmg: "text-lg text-white",
    crit: "text-2xl text-gold",
    skill: "text-3xl text-glow-strong",
    miss: "text-sm text-muted",
    heal: "text-lg text-ok",
    gold: "text-lg text-gold",
  }[k];
}

function floatPos(f: Float): React.CSSProperties {
  const left = f.side === "enemy" ? 74 : f.side === "hero" ? 40 : 16;
  const top = f.kind === "gold" ? 20 : f.kind === "skill" ? 24 : 32;
  return { left: `calc(${left}% + ${f.dx}px)`, top: `${top}%` };
}

// ---- HUD の部品 ----

function RoundButton({ icon, label, onClick, locked }: { icon: IconName; label: string; onClick: () => void; locked?: boolean }) {
  return (
    <button type="button" onClick={onClick} className="flex w-12 flex-col items-center" aria-label={locked ? `${label}（未解放）` : label}>
      <span className={cx("round-btn relative grid h-11 w-11 place-items-center", locked && "opacity-60 grayscale")}>
        <PixelSprite sprite={locked ? ICONS.lock : ICONS[icon]} scale={1.1} />
      </span>
      <span className="mt-0.5 text-[9px] leading-none text-fg/80" style={{ textShadow: "1px 1px 0 #000" }}>
        {label}
      </span>
    </button>
  );
}

function Pill({ icon, label, value, color }: { icon?: IconName; label?: string; value: string; color: string }) {
  return (
    <div className="hud-pill flex items-center justify-between gap-1 px-3 py-1">
      {icon ? <PixelSprite sprite={ICONS[icon]} scale={0.9} /> : <span className="text-[10px] text-muted">{label}</span>}
      <span className={cx("truncate font-mono text-sm", color)}>{value}</span>
    </div>
  );
}

function SkillButton({ id, r, level, onUse }: { id: SkillId; r: Runtime; level: number; onUse: () => void }) {
  const s = SKILLS.find((x) => x.id === id)!;
  const locked = level < s.unlockLevel;
  const left = r.skillCd[id];
  const pct = locked ? 1 : left / s.cd;
  const active = (id === "roar" && r.now < r.atkBuffUntil) || (id === "haste" && r.now < r.hasteUntil);
  return (
    <button type="button" onClick={onUse} disabled={locked} className="flex w-[52px] flex-col items-center disabled:opacity-80" aria-label={locked ? `${s.name}（Lv.${s.unlockLevel}で習得）` : s.name}>
      <span className={cx("round-btn relative grid h-[52px] w-[52px] place-items-center overflow-hidden", active && "skill-active")}>
        <PixelSprite sprite={locked ? ICONS.lock : ICONS[id]} scale={1.3} />
        {pct > 0 && <span className="round absolute inset-0" style={{ background: `conic-gradient(rgba(0,0,0,.68) ${pct * 360}deg, transparent 0)` }} />}
        {!locked && left > 0 && <span className="absolute inset-0 grid place-items-center font-mono text-sm text-white" style={{ textShadow: "1px 1px 0 #000" }}>{Math.ceil(left / 1000)}</span>}
        {locked && <span className="absolute bottom-0.5 font-mono text-[9px] text-gold">Lv.{s.unlockLevel}</span>}
      </span>
      <span className="mt-0.5 max-w-full truncate text-[9px] leading-none text-fg/80" style={{ textShadow: "1px 1px 0 #000" }}>
        {s.name}
      </span>
    </button>
  );
}
