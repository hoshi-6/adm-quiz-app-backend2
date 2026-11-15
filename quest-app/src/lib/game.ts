// ゲームのルール（純粋な関数だけ。保存は store.ts）
import { addDays, diffDays, toDateKey, weekday } from "./date";
import type { Avatar } from "./avatar";
import { type DungeonState, newDungeon } from "./dungeon";

export type Unit = "回" | "km" | "秒" | "分";

export interface Exercise {
  id: string;
  name: string;
  unit: Unit;
  /** レベル1のときの目標 */
  base: number;
  /** レベルが1上がるごとに増える量 */
  step: number;
  /** 目標の上限 */
  max: number;
  enabled: boolean;
}

export type StatKey = "str" | "vit" | "agi" | "sen" | "int";

export const STATS: { key: StatKey; label: string; name: string; desc: string }[] = [
  { key: "str", label: "STR", name: "筋力", desc: "押す・持ち上げる力" },
  { key: "vit", label: "VIT", name: "体力", desc: "打たれ強さと回復力" },
  { key: "agi", label: "AGI", name: "敏捷", desc: "素早さと身のこなし" },
  { key: "sen", label: "SEN", name: "感覚", desc: "集中力と反応" },
  { key: "int", label: "INT", name: "知力", desc: "知識と判断力" },
];

export type Stats = Record<StatKey, number>;

/** その日のクエスト。目標はその日の最初に決めて固定する（途中でレベルが上がっても変わらない） */
export interface QuestItem {
  exerciseId: string;
  name: string;
  unit: Unit;
  target: number;
  done: number;
  /** ペナルティで追加された項目 */
  penalty?: boolean;
}

export interface DayRecord {
  date: string;
  items: QuestItem[];
  cleared: boolean;
  clearedAt?: number;
  xpGained?: number;
  rest?: boolean;
}

export interface BodyEntry {
  date: string;
  weight?: number;
  bodyFat?: number;
  waist?: number;
  note?: string;
}

export interface GameState {
  version: 1;
  playerName: string;
  heightCm?: number;
  startedOn: string;
  level: number;
  /** 今のレベルでためた経験値 */
  xp: number;
  totalXp: number;
  statPoints: number;
  stats: Stats;
  exercises: Exercise[];
  /** 休息日にする曜日（0=日〜6=土） */
  restDays: number[];
  days: Record<string, DayRecord>;
  body: BodyEntry[];
  /** 未達成の日があり、次のクエストにペナルティを付ける */
  penaltyPending: boolean;
  /** 最後に日付の切り替わりを処理した日 */
  lastProcessed: string;
  titles: string[];
  equippedTitle?: string;
  /** ダンジョン（ゲーム）の進み具合 */
  dungeon: DungeonState;
  /** 主人公の見た目 */
  avatar?: Avatar;
}

export const DEFAULT_EXERCISES: Exercise[] = [
  { id: "pushup", name: "腕立て伏せ", unit: "回", base: 10, step: 2, max: 100, enabled: true },
  { id: "situp", name: "腹筋", unit: "回", base: 10, step: 2, max: 100, enabled: true },
  { id: "squat", name: "スクワット", unit: "回", base: 10, step: 2, max: 100, enabled: true },
  { id: "run", name: "ランニング", unit: "km", base: 1, step: 0.2, max: 10, enabled: true },
];

export function newGame(today: string = toDateKey()): GameState {
  return {
    version: 1,
    playerName: "",
    startedOn: today,
    level: 1,
    xp: 0,
    totalXp: 0,
    statPoints: 0,
    stats: { str: 10, vit: 10, agi: 10, sen: 10, int: 10 },
    exercises: DEFAULT_EXERCISES.map((e) => ({ ...e })),
    restDays: [],
    days: {},
    body: [],
    penaltyPending: false,
    lastProcessed: today,
    titles: [],
    dungeon: newDungeon(),
  };
}

// ---- 数値 ----

export function roundFor(unit: Unit, v: number): number {
  return unit === "km" ? Math.round(v * 10) / 10 : Math.round(v);
}

export function targetFor(ex: Exercise, level: number): number {
  return roundFor(ex.unit, Math.min(ex.max, ex.base + ex.step * (level - 1)));
}

/** 次のレベルまでに必要な経験値 */
export function xpToNext(level: number): number {
  return 100 + (level - 1) * 25;
}

export const POINTS_PER_LEVEL = 3;

export function rankOf(level: number): { rank: string; color: string } {
  if (level >= 70) return { rank: "S", color: "#ffd35c" };
  if (level >= 50) return { rank: "A", color: "#ff7a7a" };
  if (level >= 35) return { rank: "B", color: "#c08cff" };
  if (level >= 20) return { rank: "C", color: "#5cc8ff" };
  if (level >= 10) return { rank: "D", color: "#6ee7a8" };
  return { rank: "E", color: "#9fb3c8" };
}

export function isRestDay(state: Pick<GameState, "restDays">, date: string): boolean {
  return state.restDays.includes(weekday(date));
}

// ---- クエスト ----

export function buildItems(state: GameState): QuestItem[] {
  return state.exercises
    .filter((e) => e.enabled)
    .map((e) => ({ exerciseId: e.id, name: e.name, unit: e.unit, target: targetFor(e, state.level), done: 0 }));
}

export function penaltyItem(level: number): QuestItem {
  return {
    exerciseId: "penalty-burpee",
    name: "バーピー（ペナルティ）",
    unit: "回",
    target: Math.min(50, 10 + Math.floor(level / 3) * 2),
    done: 0,
    penalty: true,
  };
}

export function itemDone(i: QuestItem): boolean {
  return i.done >= i.target - 1e-9;
}

export function questProgress(day: DayRecord): number {
  if (day.items.length === 0) return 0;
  return day.items.reduce((s, i) => s + Math.min(1, i.done / i.target), 0) / day.items.length;
}

/** 連続でクリアした日数。休息日は数えずにつなげる。今日がまだなら昨日までで数える */
export function currentStreak(state: GameState, today: string = toDateKey()): number {
  let n = 0;
  let d = today;
  const todayRec = state.days[d];
  if (!todayRec?.cleared) d = addDays(d, -1);
  for (let guard = 0; guard < 3650; guard++) {
    if (diffDays(state.startedOn, d) < 0) break;
    const rec = state.days[d];
    if (rec?.cleared) n++;
    else if (!(rec?.rest ?? isRestDay(state, d))) break;
    d = addDays(d, -1);
  }
  return n;
}

export function bestStreak(state: GameState): number {
  const keys = Object.keys(state.days).sort();
  if (keys.length === 0) return 0;
  let best = 0;
  let run = 0;
  let d = state.startedOn;
  const end = keys[keys.length - 1];
  while (diffDays(d, end) >= 0) {
    const rec = state.days[d];
    if (rec?.cleared) {
      run++;
      best = Math.max(best, run);
    } else if (!(rec?.rest ?? isRestDay(state, d))) {
      run = 0;
    }
    d = addDays(d, 1);
  }
  return best;
}

export function clearXp(streakBefore: number): number {
  return 100 + Math.min(streakBefore, 10) * 10;
}

/** 経験値を加え、レベルアップを処理する。上がったレベル数を返す */
export function gainXp(state: GameState, amount: number): number {
  state.xp += amount;
  state.totalXp += amount;
  let ups = 0;
  while (state.xp >= xpToNext(state.level)) {
    state.xp -= xpToNext(state.level);
    state.level++;
    state.statPoints += POINTS_PER_LEVEL;
    ups++;
  }
  return ups;
}

// ---- 称号 ----

export interface TitleDef {
  id: string;
  name: string;
  desc: string;
  check: (s: GameState, ctx: { streak: number; best: number; clears: number }) => boolean;
}

export const TITLE_DEFS: TitleDef[] = [
  { id: "first", name: "目覚めの一歩", desc: "初めてデイリークエストをクリアする", check: (_, c) => c.clears >= 1 },
  { id: "streak3", name: "三日坊主を越えし者", desc: "3日連続でクリアする", check: (_, c) => c.best >= 3 },
  { id: "streak7", name: "七日間の鍛錬者", desc: "7日連続でクリアする", check: (_, c) => c.best >= 7 },
  { id: "streak30", name: "習慣の支配者", desc: "30日連続でクリアする", check: (_, c) => c.best >= 30 },
  { id: "streak100", name: "百日の求道者", desc: "100日連続でクリアする", check: (_, c) => c.best >= 100 },
  { id: "lv10", name: "D級ハンター", desc: "レベル10に到達する", check: (s) => s.level >= 10 },
  { id: "lv20", name: "C級ハンター", desc: "レベル20に到達する", check: (s) => s.level >= 20 },
  { id: "lv35", name: "B級ハンター", desc: "レベル35に到達する", check: (s) => s.level >= 35 },
  { id: "lv50", name: "A級ハンター", desc: "レベル50に到達する", check: (s) => s.level >= 50 },
  { id: "lv70", name: "S級ハンター", desc: "レベル70に到達する", check: (s) => s.level >= 70 },
  { id: "body", name: "己を知る者", desc: "体の記録を7回つける", check: (s) => s.body.length >= 7 },
  { id: "full", name: "限界突破", desc: "すべての種目が上限に達した状態でクリアする", check: (s, c) => c.clears >= 1 && s.exercises.filter((e) => e.enabled).every((e) => targetFor(e, s.level) >= e.max) },
];

export function clearCount(state: GameState): number {
  return Object.values(state.days).filter((d) => d.cleared).length;
}

/** 新しく得た称号の名前を返す */
export function checkTitles(state: GameState): string[] {
  const ctx = { streak: currentStreak(state), best: bestStreak(state), clears: clearCount(state) };
  const got: string[] = [];
  for (const t of TITLE_DEFS) {
    if (!state.titles.includes(t.id) && t.check(state, ctx)) {
      state.titles.push(t.id);
      got.push(t.name);
    }
  }
  return got;
}

export function titleName(id?: string): string | undefined {
  return TITLE_DEFS.find((t) => t.id === id)?.name;
}

// ---- 日付の切り替わり ----

/**
 * 前回処理した日から今日までを見て、未達成の日があればペナルティを予約し、今日のクエストを用意する。
 * 戻り値: 未達成だった日の数
 */
export function rollover(state: GameState, today: string = toDateKey()): number {
  let missed = 0;
  let d = state.lastProcessed;
  // lastProcessed の日も、まだ未処理なら見る（その日のうちに閉じたあと、翌日開いた場合）
  while (diffDays(d, today) > 0) {
    if (diffDays(state.startedOn, d) >= 0) {
      const rec = state.days[d];
      const rest = rec?.rest ?? isRestDay(state, d);
      if (!rest && !rec?.cleared) missed++;
    }
    d = addDays(d, 1);
  }
  if (missed > 0) state.penaltyPending = true;
  state.lastProcessed = today;

  if (!state.days[today]) {
    const rest = isRestDay(state, today);
    const items = rest ? [] : buildItems(state);
    if (!rest && state.penaltyPending) {
      items.push(penaltyItem(state.level));
      state.penaltyPending = false;
    }
    state.days[today] = { date: today, items, cleared: false, rest };
  }
  return missed;
}

/** 設定を変えたとき、まだクリアしていない今日のクエストに反映する（記録した回数は残す） */
export function refreshToday(state: GameState, today: string = toDateKey()) {
  const rec = state.days[today];
  if (!rec || rec.cleared) return;
  const rest = isRestDay(state, today);
  const prev = new Map(rec.items.map((i) => [i.exerciseId, i]));
  const items = rest ? [] : buildItems(state).map((i) => ({ ...i, done: prev.get(i.exerciseId)?.done ?? 0 }));
  const pen = rec.items.find((i) => i.penalty);
  if (pen) items.push(pen);
  rec.items = items;
  rec.rest = rest && !pen;
}
