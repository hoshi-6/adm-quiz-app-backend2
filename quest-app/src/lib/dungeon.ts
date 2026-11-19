// ダンジョン（放置型RPG）のルール。主人公の強さは「肉体管理」の記録から決まる。
import { toDateKey } from "./date";
import { type GameState, itemDone } from "./game";
import type { Sprite } from "./sprites";
import { ALLIES, type Ally, type AllyId, chapterOf } from "./story";

export type Slot = "weapon" | "armor" | "accessory";

export const SLOT_LABEL: Record<Slot, string> = { weapon: "武器", armor: "防具", accessory: "装飾品" };

export interface Item {
  id: string;
  slot: Slot;
  name: string;
  rarity: number;
  floor: number;
  atk: number;
  hp: number;
  def: number;
  /** % */
  crit: number;
  /** % */
  gold: number;
}

export type UpgradeKey = "atk" | "hp" | "def";

export interface DungeonState {
  floor: number;
  /** そのフロアで何体目か（0〜4。4体目の次はボス or 次のフロア） */
  stage: number;
  deepest: number;
  gold: number;
  totalGold: number;
  kills: number;
  bossKills: number;
  deaths: number;
  upgrades: Record<UpgradeKey, number>;
  equipment: Partial<Record<Slot, Item>>;
  /** 次のフロアへ進まず、今のフロアで稼ぐ */
  farm: boolean;
  lastActive: number;
  /** 語りを表示した章の数 */
  storyChapter: number;
  /** 仲間になった人 */
  allies: AllyId[];
  /** 解放した機能（unlocks.ts） */
  unlocked: string[];
}

export const ENCOUNTERS_PER_FLOOR = 5;

export function newDungeon(): DungeonState {
  return {
    floor: 1,
    stage: 0,
    deepest: 1,
    gold: 0,
    totalGold: 0,
    kills: 0,
    bossKills: 0,
    deaths: 0,
    upgrades: { atk: 0, hp: 0, def: 0 },
    equipment: {},
    farm: false,
    lastActive: Date.now(),
    storyChapter: 0,
    allies: [],
    unlocked: [],
  };
}

export const RARITY = [
  { name: "コモン", color: "#b8c6d8" },
  { name: "アンコモン", color: "#6ee7a8" },
  { name: "レア", color: "#5cc8ff" },
  { name: "エピック", color: "#c08cff" },
  { name: "レジェンド", color: "#ffd35c" },
];

// ---- 主人公 ----

export interface Bonus {
  label: string;
  detail: string;
}

export interface Hero {
  maxHp: number;
  atk: number;
  def: number;
  /** 攻撃間隔（ミリ秒） */
  interval: number;
  /** 0〜1 */
  crit: number;
  critMul: number;
  dodge: number;
  /** 何回攻撃ごとにスキルが出るか */
  skillEvery: number;
  skillMul: number;
  goldMul: number;
  blessed: boolean;
  tired: boolean;
  bonuses: Bonus[];
  /** 一緒に戦う仲間 */
  allies: Ally[];
  /** 受けるダメージの倍率（盾役がいると下がる） */
  takenMul: number;
}

/** これまでのクエストで記録した合計（種目ごと） */
export function trainingTotals(g: GameState): Record<string, number> {
  const t: Record<string, number> = {};
  for (const d of Object.values(g.days)) {
    for (const i of d.items) t[i.exerciseId] = (t[i.exerciseId] ?? 0) + i.done;
  }
  return t;
}

export function heroStats(g: GameState, today: string = toDateKey()): Hero {
  const s = g.stats;
  const dg = g.dungeon;
  const t = trainingTotals(g);
  const eq = Object.values(dg.equipment).filter(Boolean) as Item[];
  const sum = (k: "atk" | "hp" | "def" | "crit" | "gold") => eq.reduce((a, i) => a + i[k], 0);

  // 肉体の記憶：鍛えた合計に応じて永続的に強くなる
  const pushPct = Math.floor((t.pushup ?? 0) / 100);
  const sitPct = Math.floor((t.situp ?? 0) / 100);
  const squatPct = Math.floor((t.squat ?? 0) / 100);
  const runPct = Math.floor((t.run ?? 0) / 5);

  const allies = ALLIES.filter((a) => dg.allies.includes(a.id));
  const rec = g.days[today];
  const blessed = !!rec?.cleared;
  const tired = !!rec && !rec.cleared && rec.items.some((i) => i.penalty && !itemDone(i));

  let atk = (5 + s.str * 1.5 + g.level * 2 + dg.upgrades.atk * 3 + sum("atk")) * (1 + pushPct / 100);
  let maxHp = (50 + s.vit * 8 + g.level * 10 + dg.upgrades.hp * 20 + sum("hp")) * (1 + squatPct / 100);
  const def = (s.vit * 0.5 + g.level * 0.5 + dg.upgrades.def * 1.5 + sum("def")) * (1 + sitPct / 100);
  const speed = 1 + Math.max(0, s.agi - 10) * 0.02 + runPct / 100;
  if (blessed) {
    atk *= 1.15;
    maxHp *= 1.15;
  }
  if (tired) atk *= 0.9;

  const bonuses: Bonus[] = [
    { label: `レベル ${g.level}`, detail: `攻撃 +${g.level * 2}・HP +${g.level * 10}` },
    { label: `腕立て 累計 ${Math.round(t.pushup ?? 0)}回`, detail: `攻撃 +${pushPct}%（100回ごとに+1%）` },
    { label: `スクワット 累計 ${Math.round(t.squat ?? 0)}回`, detail: `HP +${squatPct}%（100回ごとに+1%）` },
    { label: `腹筋 累計 ${Math.round(t.situp ?? 0)}回`, detail: `防御 +${sitPct}%（100回ごとに+1%）` },
    { label: `ランニング 累計 ${(t.run ?? 0).toFixed(1)}km`, detail: `攻撃速度 +${runPct}%（5kmごとに+1%）` },
  ];
  if (blessed) bonuses.unshift({ label: "鍛錬の加護（今日のクエスト達成）", detail: "攻撃・HP +15%、ゴールド +30%" });
  if (tired) bonuses.unshift({ label: "疲労（ペナルティ未消化）", detail: "攻撃 −10%。今日のクエストを達成すると消える" });

  return {
    maxHp: Math.round(maxHp),
    atk: Math.round(atk),
    def: Math.round(def * 10) / 10,
    interval: Math.max(300, Math.round(1200 / speed)),
    crit: Math.min(0.5, 0.05 + Math.max(0, s.sen - 10) * 0.005 + sum("crit") / 100),
    critMul: 2,
    dodge: Math.min(0.3, Math.max(0, s.agi - 10) * 0.003),
    skillEvery: 5,
    skillMul: 1.5 + Math.max(0, s.int - 10) * 0.05,
    goldMul: (1 + sum("gold") / 100) * (blessed ? 1.3 : 1),
    blessed,
    tired,
    bonuses,
    allies,
    takenMul: allies.some((a) => a.id === "tank") ? 0.8 : 1,
  };
}

// ---- 敵 ----

export function isBossFloor(floor: number) {
  return floor % 10 === 0;
}

export function checkpointOf(floor: number) {
  return floor - ((floor - 1) % 10);
}

export interface Enemy {
  name: string;
  sprite: Sprite;
  maxHp: number;
  atk: number;
  def: number;
  interval: number;
  gold: number;
  boss: boolean;
}

export function makeEnemy(floor: number, stage: number, rand: () => number = Math.random): Enemy {
  const { chapter } = chapterOf(floor);
  const boss = isBossFloor(floor) && stage === ENCOUNTERS_PER_FLOOR - 1;
  // 章の中でも、階が深いほど後ろの敵が出やすい
  const pos = ((floor - 1) % 10) / 10;
  const idx = Math.min(chapter.enemies.length - 1, Math.floor((rand() * 0.7 + pos * 0.5) * chapter.enemies.length));
  const f = boss ? chapter.boss : chapter.enemies[idx];
  const g = Math.pow(1.12, floor - 1);
  const ga = Math.pow(1.1, floor - 1);
  return {
    name: f.name,
    sprite: f.sprite,
    maxHp: Math.round(30 * g * (boss ? 8 : 1)),
    atk: Math.round(6 * ga * (boss ? 1.8 : 1)),
    def: Math.round(1 * ga * 10) / 10,
    interval: boss ? 1600 : 1400,
    gold: Math.max(1, Math.round(3 * Math.pow(1.12, floor - 1) * (boss ? 10 : 1))),
    boss,
  };
}

export function damage(atk: number, def: number, rand: () => number = Math.random) {
  return Math.max(1, Math.round(((atk * atk) / (atk + def)) * (0.9 + rand() * 0.2)));
}

// ---- 装備 ----

const BASES: Record<Slot, string[]> = {
  weapon: ["短剣", "長剣", "大斧", "槍", "戦鎚", "双剣"],
  armor: ["革鎧", "鎖帷子", "鋼の鎧", "魔法衣", "竜鱗の鎧"],
  accessory: ["指輪", "護符", "首飾り", "腕輪"],
};
const PREFIX = ["古びた", "上質な", "精鋭の", "英雄の", "伝説の"];

export function rollItem(floor: number, boss: boolean, rand: () => number = Math.random): Item {
  const slots: Slot[] = ["weapon", "armor", "accessory"];
  const slot = slots[Math.floor(rand() * 3)];
  const r = rand() + (boss ? 0.35 : 0);
  const rarity = r > 1.25 ? 4 : r > 1.05 ? 3 : r > 0.85 ? 2 : r > 0.55 ? 1 : 0;
  const mult = [1, 1.3, 1.7, 2.2, 3][rarity];
  const base = 4 * Math.pow(1.1, floor - 1) * mult;
  const names = BASES[slot];
  const item: Item = {
    id: `${Date.now().toString(36)}${Math.floor(rand() * 1e6).toString(36)}`,
    slot,
    name: `${PREFIX[rarity]}${names[Math.floor(rand() * names.length)]}`,
    rarity,
    floor,
    atk: 0,
    hp: 0,
    def: 0,
    crit: 0,
    gold: 0,
  };
  if (slot === "weapon") item.atk = Math.round(base);
  if (slot === "armor") {
    item.hp = Math.round(base * 6);
    item.def = Math.round(base * 0.5 * 10) / 10;
  }
  if (slot === "accessory") {
    item.atk = Math.round(base * 0.3);
    item.crit = 2 + rarity * 2;
    item.gold = 10 + rarity * 10;
  }
  return item;
}

/** 同じ部位どうしで比べるための強さ */
export function itemScore(i: Item): number {
  return i.atk + i.hp / 6 + i.def * 2 + (i.crit * i.floor) / 5 + (i.gold * i.floor) / 20;
}

export function sellPrice(i: Item): number {
  return Math.max(1, Math.round(itemScore(i) * (1 + i.rarity * 0.5)));
}

export function itemStatsText(i: Item): string {
  return [
    i.atk && `攻撃+${i.atk}`,
    i.hp && `HP+${i.hp}`,
    i.def && `防御+${i.def}`,
    i.crit && `会心+${i.crit}%`,
    i.gold && `ゴールド+${i.gold}%`,
  ]
    .filter(Boolean)
    .join(" ");
}

// ---- 町での強化 ----

export const UPGRADES: { key: UpgradeKey; name: string; per: string }[] = [
  { key: "atk", name: "剣の稽古", per: "攻撃 +3" },
  { key: "hp", name: "体力づくり", per: "HP +20" },
  { key: "def", name: "盾の稽古", per: "防御 +1.5" },
];

export function upgradeCost(level: number) {
  return Math.floor(10 * Math.pow(1.18, level));
}

// ---- 放置報酬 ----

/** 主人公がそのフロアの敵を倒すのにかかる時間（倒せないなら null） */
export function killTime(hero: Hero, floor: number): number | null {
  const e = makeEnemy(floor, 0, () => 0.5);
  const avgCrit = 1 + hero.crit * (hero.critMul - 1);
  const allyDps = hero.allies.reduce((a, x) => a + (x.id === "mage" ? (hero.atk * 0.8) / 3000 : x.id === "wolf" ? (hero.atk * 0.35) / 1000 : 0), 0);
  const dmg = damage(hero.atk, e.def, () => 0.5) * avgCrit + allyDps * hero.interval;
  const t = Math.ceil(e.maxHp / dmg) * hero.interval;
  const heal = hero.allies.some((a) => a.id === "healer") ? (t / 4000) * hero.maxHp * 0.08 : 0;
  const taken = (t / e.interval) * damage(e.atk, hero.def, () => 0.5) * (1 - hero.dodge) * hero.takenMul - heal;
  return taken < hero.maxHp ? t : null;
}

export const IDLE_CAP_MS = 12 * 60 * 60 * 1000;

export function idleReward(g: GameState, ms: number): { gold: number; kills: number; floor: number } | null {
  const hero = heroStats(g);
  const elapsed = Math.min(ms, IDLE_CAP_MS);
  for (let f = g.dungeon.floor; f >= 1; f--) {
    const t = killTime(hero, f);
    if (t === null) continue;
    // 画面を開いて戦うより控えめ（2割）にする
    const kills = Math.floor((elapsed / (t + 700)) * 0.2);
    if (kills <= 0) return null;
    const gold = Math.round(kills * makeEnemy(f, 0, () => 0.5).gold * hero.goldMul);
    return { gold, kills, floor: f };
  }
  return null;
}
