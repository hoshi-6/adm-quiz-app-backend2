// ダンジョンの戦闘の進行（0.1 秒ごとに step を呼ぶ）。画面の状態は Runtime に直接持つ。
import { ENCOUNTERS_PER_FLOOR, type Enemy, type Hero, RARITY, checkpointOf, damage, makeEnemy, rollItem } from "@/lib/dungeon";
import { fmtBig } from "@/lib/format";
import type { GameState } from "@/lib/game";
import { SKILLS, type SkillId } from "@/lib/skills";
import type { AllyId } from "@/lib/story";
import { dungeonDeath, dungeonKill } from "@/lib/store";

export const TICK = 100;

export interface Float {
  id: number;
  side: "hero" | "enemy" | AllyId;
  text: string;
  kind: "dmg" | "crit" | "skill" | "miss" | "heal" | "gold";
  born: number;
  /** 少しずつずらして重ならないようにする */
  dx: number;
}

export interface Coin {
  id: number;
  born: number;
  dx: number;
  dy: number;
}

export interface Runtime {
  phase: "walk" | "fight" | "dead";
  t: number;
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
  allyAct: Partial<Record<AllyId, number>>;
  /** スキルの残り再使用時間（ミリ秒） */
  skillCd: Record<SkillId, number>;
  atkBuffUntil: number;
  hasteUntil: number;
  floats: Float[];
  coins: Coin[];
  /** 斬撃の光（時刻と大きさ） */
  slash: { born: number; big: boolean } | null;
  /** 画面のフラッシュ（スキル） */
  flash: { born: number; color: string } | null;
  /** 装備を拾ったときなどの帯 */
  banner: { text: string; color: string; born: number } | null;
  log: { id: number; text: string; tone?: string }[];
  heroHit: number;
  enemyHit: number;
}

let seq = 1;

export function newRuntime(hero: Hero, floor: number, stage: number, firstLog: string): Runtime {
  return {
    phase: "walk",
    t: 800,
    now: 0,
    heroHp: hero.maxHp,
    enemy: null,
    enemyFloor: floor,
    enemyStage: stage,
    enemyHp: 0,
    heroCd: 0,
    enemyCd: 0,
    hits: 0,
    allyCd: { healer: 4000, tank: 2000, mage: 3000, wolf: 1000 },
    allyAct: {},
    skillCd: { slash: 0, roar: 0, heal: 0, haste: 0, burst: 0 },
    atkBuffUntil: 0,
    hasteUntil: 0,
    floats: [],
    coins: [],
    slash: null,
    flash: null,
    banner: null,
    log: [{ id: seq++, text: firstLog }],
    heroHit: 0,
    enemyHit: 0,
  };
}

export function log(r: Runtime, text: string, tone?: string) {
  r.log.push({ id: seq++, text, tone });
  if (r.log.length > 30) r.log.splice(0, r.log.length - 30);
}

function float(r: Runtime, side: Float["side"], text: string, kind: Float["kind"]) {
  r.floats.push({ id: seq++, side, text, kind, born: Date.now(), dx: Math.round((Math.random() - 0.5) * 24) });
}

export function resetRuntime(r: Runtime, hero: Hero, msg: string) {
  r.phase = "walk";
  r.t = 800;
  r.enemy = null;
  r.heroHp = hero.maxHp;
  log(r, msg);
}

const atkOf = (r: Runtime, hero: Hero) => hero.atk * (r.now < r.atkBuffUntil ? 1.5 : 1);
const intervalOf = (r: Runtime, hero: Hero) => hero.interval / (r.now < r.hasteUntil ? 2 : 1);

export function skillReady(r: Runtime, id: SkillId, level: number) {
  const s = SKILLS.find((x) => x.id === id)!;
  return level >= s.unlockLevel && r.skillCd[id] <= 0 && r.phase !== "dead";
}

/** スキルを使う。使えたら true */
export function castSkill(r: Runtime, hero: Hero, level: number, id: SkillId): boolean {
  if (!skillReady(r, id, level)) return false;
  const s = SKILLS.find((x) => x.id === id)!;
  const needsEnemy = id === "slash" || id === "burst";
  if (needsEnemy && (r.phase !== "fight" || !r.enemy)) return false;
  const now = Date.now();
  r.skillCd[id] = s.cd;
  if (id === "slash" || id === "burst") {
    const dmg = damage(atkOf(r, hero) * (id === "burst" ? 8 : 3), r.enemy!.def);
    r.enemyHp -= dmg;
    r.enemyHit = now;
    r.slash = { born: now, big: true };
    r.flash = { born: now, color: id === "burst" ? "rgba(192,140,255,0.35)" : "rgba(143,214,255,0.25)" };
    float(r, "enemy", fmtBig(dmg), "skill");
    log(r, `${s.name}！ ${r.enemy!.name}に ${fmtBig(dmg)} のダメージ`, "text-glow-strong");
  } else if (id === "roar") {
    r.atkBuffUntil = now + s.dur!;
    r.flash = { born: now, color: "rgba(200,56,46,0.3)" };
    float(r, "hero", "攻撃UP", "skill");
  } else if (id === "haste") {
    r.hasteUntil = now + s.dur!;
    r.flash = { born: now, color: "rgba(255,224,138,0.25)" };
    float(r, "hero", "速度UP", "skill");
  } else if (id === "heal") {
    const heal = Math.round(hero.maxHp * 0.4);
    r.heroHp = Math.min(hero.maxHp, r.heroHp + heal);
    r.flash = { born: now, color: "rgba(106,208,138,0.25)" };
    float(r, "hero", `+${fmtBig(heal)}`, "heal");
  }
  return true;
}

export function step(r: Runtime, hero: Hero, game: GameState, auto: boolean) {
  const d = game.dungeon;
  const now = Date.now();
  r.now = now;
  r.floats = r.floats.filter((f) => now - f.born < 1000);
  r.coins = r.coins.filter((c) => now - c.born < 1100);
  if (r.banner && now - r.banner.born > 2600) r.banner = null;
  if (r.heroHp > hero.maxHp) r.heroHp = hero.maxHp;
  for (const s of SKILLS) r.skillCd[s.id] = Math.max(0, r.skillCd[s.id] - TICK);

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
      log(r, e.boss ? `⚠ ボス「${e.name}」が現れた！` : `${e.name}が現れた。`, e.boss ? "text-danger" : undefined);
      if (e.boss) r.banner = { text: `BOSS  ${e.name}`, color: "#c8382e", born: now };
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

  // オート：使えるスキルを順に使う（回復は HP が半分を切ったときだけ）
  if (auto) {
    for (const s of SKILLS) {
      if (s.id === "heal" && r.heroHp > hero.maxHp * 0.5) continue;
      if (castSkill(r, hero, game.level, s.id)) break;
    }
  }

  const e = r.enemy!;
  if (r.enemyHp > 0) {
    r.heroCd -= TICK;
    r.enemyCd -= TICK;

    if (r.heroCd <= 0) {
      r.hits++;
      r.heroCd += intervalOf(r, hero);
      r.enemyHit = now;
      const atk = atkOf(r, hero);
      if (r.hits % hero.skillEvery === 0) {
        const dmg = Math.round(atk * hero.skillMul);
        r.enemyHp -= dmg;
        r.slash = { born: now, big: true };
        float(r, "enemy", fmtBig(dmg), "skill");
      } else {
        const crit = Math.random() < hero.crit;
        const dmg = Math.round(damage(atk, e.def) * (crit ? hero.critMul : 1));
        r.enemyHp -= dmg;
        r.slash = { born: now, big: crit };
        float(r, "enemy", crit ? `${fmtBig(dmg)}!` : fmtBig(dmg), crit ? "crit" : "dmg");
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
          float(r, "healer", `+${fmtBig(heal)}`, "heal");
        }
      } else if (a.id === "tank") {
        r.allyCd.tank += 2000;
        const dmg = damage(atkOf(r, hero) * 0.3, e.def);
        r.enemyHp -= dmg;
        float(r, "enemy", fmtBig(dmg), "dmg");
      } else if (a.id === "mage") {
        r.allyCd.mage += 3000;
        const dmg = Math.round(atkOf(r, hero) * 0.8);
        r.enemyHp -= dmg;
        float(r, "enemy", fmtBig(dmg), "skill");
      } else if (a.id === "wolf") {
        r.allyCd.wolf += 1000;
        const dmg = damage(atkOf(r, hero) * 0.35, e.def);
        r.enemyHp -= dmg;
        float(r, "enemy", fmtBig(dmg), "dmg");
      }
    }
  }

  if (r.enemyHp <= 0) {
    const gold = Math.round(e.gold * hero.goldMul);
    const drop = e.boss || Math.random() < 0.08 ? rollItem(d.floor, e.boss) : null;
    const finishedFloor = d.stage + 1 >= ENCOUNTERS_PER_FLOOR;
    const loot = dungeonKill(gold, drop);
    float(r, "enemy", `+${fmtBig(gold)}`, "gold");
    for (let i = 0; i < (e.boss ? 12 : 5); i++) r.coins.push({ id: seq++, born: now + i * 40, dx: Math.round((Math.random() - 0.3) * 90), dy: Math.round(10 + Math.random() * 30) });
    log(r, `${e.name}を倒した。 +${fmtBig(gold)}G`, "text-gold");
    if (loot) {
      const rar = RARITY[loot.item.rarity];
      log(r, loot.equipped ? `【${rar.name}】${loot.item.name}を装備した！` : `【${rar.name}】${loot.item.name}を拾った（${fmtBig(loot.sold)}G で売却）`, loot.equipped ? "text-ok" : "text-muted");
      if (loot.equipped) r.banner = { text: `【${rar.name}】${loot.item.name} を装備！`, color: rar.color, born: now };
    }
    r.heroHp = Math.min(hero.maxHp, r.heroHp + Math.round(hero.maxHp * 0.15));
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
      float(r, "hero", fmtBig(dmg), "dmg");
    }
    if (r.heroHp <= 0) {
      r.heroHp = 0;
      r.phase = "dead";
      r.t = 2200;
      log(r, `${e.name}に倒された……`, "text-danger");
    }
  }
}

/** 画面の中央に帯を出す（解放の条件の案内など） */
export function showBanner(r: Runtime, text: string, color: string) {
  r.banner = { text, color, born: Date.now() };
}
