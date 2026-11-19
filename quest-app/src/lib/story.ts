// ダンジョンの物語（オリジナル）。10階ごとに1章、章の最後（10階）にボス。下へ進むほど強くなる。
import { BOSS_SPRITES, type BossId } from "./bossSprites";
import { HEALER, MAGE, type Palette, type Sprite, T, TANK, type TemplateName, WOLF_PAL_SILVER, pal } from "./sprites";

export interface Foe {
  name: string;
  sprite: Sprite;
}

export interface Chapter {
  rank: string;
  title: string;
  /** 章に入ったときの語り */
  intro: string[];
  enemies: Foe[];
  boss: Foe;
  /** ボスを倒したときの語り */
  outro: string[];
}

const foe = (name: string, t: TemplateName, p: Palette): Foe => ({ name, sprite: { rows: T[t], palette: p } });
/** ボスは主人公と同じ 64×64 の描きおろし */
const boss = (name: string, id: BossId): Foe => ({ name, sprite: BOSS_SPRITES[id] });

export const CHAPTERS: Chapter[] = [
  {
    rank: "E",
    title: "灰色の地下道",
    intro: ["最弱と呼ばれた見習い探索者。", "鍛えた体だけを頼りに、初めての迷宮へ足を踏み入れる。"],
    enemies: [
      foe("ドブネズミ", "rat", pal("#8a7f72", "#5c544b", "#b3a899")),
      foe("ススコウモリ", "bat", pal("#4a4060", "#2d2640", "#6b5e8a")),
      foe("灰スライム", "slime", pal("#8fa3a8", "#5f7378", "#c9d8db", "#111")),
    ],
    boss: boss("地下道の番犬", "hound"),
    outro: ["番犬が崩れ落ちた。", "この迷宮はまだ、ずっと下へ続いている――。"],
  },
  {
    rank: "D",
    title: "骨の回廊",
    intro: ["回廊で倒れていた癒し手ミオを助けた。", "「お礼に、あなたの傷はわたしが治すね」"],
    enemies: [
      foe("骸骨兵", "skeleton", pal("#e8e2d0", "#a8a090", "#ffffff", "#ff3b4e", { w: "#e8e2d0" })),
      foe("さまよう霊", "ghost", pal("#9fd8e8", "#6aa8b8", "#d8f4ff", "#1a2a40")),
      foe("墓守グモ", "spider", pal("#3a3048", "#241c30", "#5a4a70", "#ff3b4e")),
    ],
    boss: boss("骨の騎士団長", "knight"),
    outro: ["騎士団長の鎧が砕け、回廊に静けさが戻った。"],
  },
  {
    rank: "C",
    title: "獣たちの森層",
    intro: ["迷宮の中に広がる森。盾の戦士ゴウが仲間に加わった。", "「前は任せろ。お前は斬ることだけ考えろ」"],
    enemies: [
      foe("牙狼", "wolf", pal("#6a6f7a", "#44484f", "#9aa0aa")),
      foe("大猪", "boar", pal("#7a4f30", "#4f321e", "#a06a42")),
      foe("森マムシ", "snake", pal("#4f8a3a", "#2f5a22", "#7ab85a", "#ffd35c")),
    ],
    boss: boss("森の王獣", "lion"),
    outro: ["王獣が倒れると、森の木々がざわめいて道を開いた。"],
  },
  {
    rank: "B",
    title: "灼熱の坑道",
    intro: ["溶岩が流れる坑道。魔導士セイラが同行を申し出た。", "「熱いのは嫌いだけど……あなた、見込みがあるわ」"],
    enemies: [
      foe("火の玉", "flame", pal("#ff8a2a", "#d8461a", "#ffe08a", "#3a0a00")),
      foe("溶岩トカゲ", "lizard", pal("#b8401a", "#7a2410", "#ff7a3a", "#ffe08a")),
      foe("岩の番人", "golem", pal("#7a6a5a", "#4f4438", "#a8988a", "#ff8a2a")),
    ],
    boss: boss("炎獄竜", "dragon"),
    outro: ["炎獄竜の咆哮が消え、坑道の熱がゆっくりと引いていく。"],
  },
  {
    rank: "A",
    title: "氷結の深層",
    intro: ["凍てつく深層で、傷ついた銀狼ハクを手当てした。", "ハクは静かに隣を歩きはじめた。"],
    enemies: [
      foe("氷の精", "flame", pal("#8fd6ff", "#4a9ad8", "#e8f8ff", "#1a3a6a")),
      foe("霜の巨兵", "golem", pal("#a8c8e0", "#6a8aa8", "#e8f4ff", "#2a8aff")),
      foe("凍てつく魔眼", "eye", pal("#4a6a9a", "#2a3a5a", "#8aaad8", "#2a8aff", { w: "#e8f4ff" })),
    ],
    boss: boss("氷晶の巨像", "golem"),
    outro: ["巨像が砕け、氷の破片が星のようにきらめいた。"],
  },
  {
    rank: "S",
    title: "魔界の門",
    intro: ["迷宮の最奥とされる門。ここを越えた者はいない。", "仲間たちが、黙ってうなずいた。"],
    enemies: [
      foe("小悪魔", "imp", pal("#a83a5a", "#6a1f38", "#d86a8a", "#ffd35c")),
      foe("双頭の魔犬", "wolf", pal("#3a2040", "#20102a", "#5a3a6a", "#ff3b4e")),
      foe("呪いの騎士", "knight", pal("#4a3a6a", "#2a1f40", "#7a6aa0", "#c08cff", { c: "#6a5a90", r: "#c08cff" })),
    ],
    boss: boss("門の魔王", "demon"),
    outro: ["魔王が膝をつき、門が音を立てて開いた。", "その先には、さらに深い闇があった。"],
  },
  {
    rank: "?",
    title: "星の深淵",
    intro: ["門の向こうは、星空のような果てのない深淵。", "ここから先は、記録に残る者のいない領域だ。"],
    enemies: [
      foe("虚空の泡", "slime", pal("#3a2a6a", "#1f1640", "#6a5ac8", "#5cf2ff")),
      foe("星喰いの眼", "eye", pal("#1f1a3a", "#0f0c20", "#4a3a8a", "#ffd35c", { w: "#c8c0ff" })),
      foe("影法師", "ghost", pal("#2a2a3a", "#16161f", "#4a4a60", "#5cf2ff")),
    ],
    boss: boss("深淵の主", "abyss"),
    outro: ["深淵の主が消えた。だが深淵は、まだ終わらない――。"],
  },
];

export function chapterOf(floor: number): { chapter: Chapter; index: number; cycle: number } {
  const band = Math.floor((floor - 1) / 10);
  return { chapter: CHAPTERS[band % CHAPTERS.length], index: band % CHAPTERS.length, cycle: Math.floor(band / CHAPTERS.length) };
}

export function chapterLabel(floor: number): string {
  const { chapter, index, cycle } = chapterOf(floor);
  return `第${index + 1 + cycle * CHAPTERS.length}章 ${chapter.rank}級「${chapter.title}」${cycle > 0 ? `（${cycle + 1}周目）` : ""}`;
}

// ---- 仲間 ----

export type AllyId = "healer" | "tank" | "mage" | "wolf";

export interface Ally {
  id: AllyId;
  name: string;
  role: string;
  desc: string;
  /** この階に着くと出会う */
  joinFloor: number;
  /** 仲間にするのに必要な現実のレベル */
  level: number;
  /** 仲間にするのに必要なゴールド */
  cost: number;
  sprite: Sprite;
}

export const ALLIES: Ally[] = [
  { id: "healer", name: "ミオ", role: "癒し手", desc: "4秒ごとに最大HPの8%を回復", joinFloor: 11, level: 5, cost: 300, sprite: HEALER },
  { id: "tank", name: "ゴウ", role: "盾の戦士", desc: "受けるダメージを20%減らす。攻撃は控えめ", joinFloor: 21, level: 10, cost: 3000, sprite: TANK },
  { id: "mage", name: "セイラ", role: "魔導士", desc: "3秒ごとに防御を無視する魔法（攻撃×0.8）", joinFloor: 31, level: 15, cost: 20000, sprite: MAGE },
  { id: "wolf", name: "ハク", role: "銀狼", desc: "素早く噛みつく（1秒ごとに攻撃×0.35）", joinFloor: 41, level: 20, cost: 150000, sprite: { rows: T.wolf, palette: WOLF_PAL_SILVER } },
];

export function alliesAt(deepest: number): Ally[] {
  return ALLIES.filter((a) => deepest >= a.joinFloor);
}
