"use client";
// 端末内（localStorage）に保存する。画面は useGame() で読み、書き込みは下の関数を通す。
import { useSyncExternalStore } from "react";
import { toDateKey } from "./date";
import {
  type Item,
  type Slot,
  type UpgradeKey,
  checkpointOf,
  idleReward,
  itemScore,
  newDungeon,
  sellPrice,
  upgradeCost,
} from "./dungeon";
import { ALLIES, CHAPTERS, chapterLabel, chapterOf } from "./story";
import {
  type BodyEntry,
  type Exercise,
  type GameState,
  type StatKey,
  checkTitles,
  clearXp,
  currentStreak,
  gainXp,
  itemDone,
  newGame,
  POINTS_PER_LEVEL,
  refreshToday,
  rollover,
  roundFor,
} from "./game";

const KEY = "level-quest:v1";

let state: GameState | null = null;
const listeners = new Set<() => void>();

// ---- システムメッセージ（画面に出すお知らせ。保存しない） ----

export interface Notice {
  id: number;
  kind: "clear" | "levelup" | "title" | "penalty" | "info" | "story" | "ally";
  title: string;
  lines: string[];
}

let notices: Notice[] = [];
const noticeListeners = new Set<() => void>();
let noticeSeq = 1;

function pushNotice(n: Omit<Notice, "id">) {
  notices = [...notices, { ...n, id: noticeSeq++ }];
  // 画面の描画中に呼ばれることがあるので、知らせるのは後にする
  queueMicrotask(() => noticeListeners.forEach((l) => l()));
}

export function dismissNotice(id: number) {
  notices = notices.filter((n) => n.id !== id);
  noticeListeners.forEach((l) => l());
}

export function useNotices(): Notice[] {
  return useSyncExternalStore(
    (l) => {
      noticeListeners.add(l);
      return () => noticeListeners.delete(l);
    },
    () => notices,
    () => EMPTY,
  );
}
const EMPTY: Notice[] = [];

// ---- 読み書き ----

function load(): GameState {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as GameState;
      if (parsed && parsed.version === 1) return normalize(parsed);
    }
  } catch {
    // 読めないときは新しく始める
  }
  return newGame();
}

/** 古い保存データに、あとから増えた項目を補う */
function normalize(parsed: GameState): GameState {
  return { ...newGame(), ...parsed, dungeon: { ...newDungeon(), ...parsed.dungeon } };
}

function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    pushNotice({ kind: "info", title: "保存できませんでした", lines: ["ブラウザの保存領域が使えない状態です。プライベートモードを解除してください。"] });
  }
}

function emit() {
  listeners.forEach((l) => l());
}

function ensure(): GameState {
  if (!state) {
    state = load();
    runRollover(false);
  }
  return state;
}

/** 状態を変更する。必ずコピーを書き換えて差し替える（画面が変化に気づけるように） */
function mutate(fn: (s: GameState) => void) {
  const next = structuredClone(ensure());
  fn(next);
  state = next;
  save();
  emit();
}

function runRollover(notify: boolean) {
  const s = structuredClone(state!);
  const missed = rollover(s);
  const changed = JSON.stringify(s) !== JSON.stringify(state);
  state = s;
  if (changed) save();
  if (missed > 0) {
    pushNotice({
      kind: "penalty",
      title: "ペナルティ発生",
      lines: [`未達成のデイリークエストがありました（${missed}日）。`, "今日のクエストにペナルティ項目が追加されます。"],
    });
  }
  if (notify && changed) emit();
}

/** 日付が変わっていないか確かめる（画面を開き直したときや、0時をまたいだとき） */
export function checkDate() {
  if (!state) return;
  runRollover(true);
}

export function useGame(): GameState | null {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      const onStorage = (e: StorageEvent) => {
        if (e.key === KEY) {
          state = load();
          emit();
        }
      };
      window.addEventListener("storage", onStorage);
      return () => {
        listeners.delete(l);
        window.removeEventListener("storage", onStorage);
      };
    },
    () => ensure(),
    () => null,
  );
}

// ---- 操作 ----

export function setPlayer(name: string, heightCm?: number) {
  mutate((s) => {
    s.playerName = name.trim();
    s.heightCm = heightCm;
  });
}

/** クエストの進み具合を変える（delta を足す。value を渡すとその値にする） */
export function recordProgress(exerciseId: string, opts: { delta?: number; value?: number }) {
  const today = toDateKey();
  let clearedNow = false;
  mutate((s) => {
    const rec = s.days[today];
    if (!rec) return;
    const item = rec.items.find((i) => i.exerciseId === exerciseId);
    if (!item) return;
    const v = opts.value ?? item.done + (opts.delta ?? 0);
    item.done = Math.max(0, roundFor(item.unit, v));

    if (!rec.cleared && rec.items.length > 0 && rec.items.every(itemDone)) {
      const streakBefore = currentStreak(s, today);
      const xp = clearXp(streakBefore);
      rec.cleared = true;
      rec.clearedAt = Date.now();
      rec.xpGained = xp;
      const before = s.level;
      const ups = gainXp(s, xp);
      clearedNow = true;
      const streak = currentStreak(s, today);
      pushNotice({
        kind: "clear",
        title: "デイリークエスト クリア",
        lines: [
          `報酬：経験値 +${xp}`,
          streakBefore > 0 ? `連続クリアボーナス（${streak}日目）` : "明日も継続すると経験値ボーナス",
          "ダンジョン：今日は「鍛錬の加護」（攻撃・HP +15%、ゴールド +30%）",
        ],
      });
      if (ups > 0) {
        pushNotice({
          kind: "levelup",
          title: "レベルアップ！",
          lines: [`Lv.${before} → Lv.${s.level}`, `能力値ポイント +${ups * POINTS_PER_LEVEL}`, "明日からクエストの目標が上がります。"],
        });
      }
      for (const t of checkTitles(s)) {
        pushNotice({ kind: "title", title: "称号を獲得", lines: [`「${t}」`] });
      }
    }
  });
  return clearedNow;
}

export function allocateStat(key: StatKey, n: number) {
  mutate((s) => {
    const use = Math.min(n, s.statPoints);
    if (use <= 0) return;
    s.stats[key] += use;
    s.statPoints -= use;
  });
}

export function equipTitle(id?: string) {
  mutate((s) => {
    s.equippedTitle = id;
  });
}

export function saveBody(entry: BodyEntry) {
  mutate((s) => {
    s.body = s.body.filter((b) => b.date !== entry.date);
    s.body.push(entry);
    s.body.sort((a, b) => a.date.localeCompare(b.date));
    for (const t of checkTitles(s)) {
      pushNotice({ kind: "title", title: "称号を獲得", lines: [`「${t}」`] });
    }
  });
}

export function deleteBody(date: string) {
  mutate((s) => {
    s.body = s.body.filter((b) => b.date !== date);
  });
}

export function saveSettings(patch: { exercises: Exercise[]; restDays: number[] }) {
  mutate((s) => {
    s.exercises = patch.exercises;
    s.restDays = patch.restDays;
    refreshToday(s);
  });
}

export function exportData(): string {
  return JSON.stringify(ensure(), null, 2);
}

export function importData(json: string) {
  const parsed = JSON.parse(json) as GameState;
  if (!parsed || parsed.version !== 1 || typeof parsed.level !== "number" || !parsed.days) {
    throw new Error("このアプリのバックアップではありません");
  }
  state = normalize(parsed);
  runRollover(false);
  save();
  emit();
}

export function resetAll() {
  state = newGame();
  runRollover(false);
  save();
  emit();
}

// ---- ダンジョン ----

export type LootResult = { item: Item; equipped: boolean; sold: number } | null;

/** 敵を倒した。advance=true ならそのフロアの次の敵へ進む */
export function dungeonKill(gold: number, item: Item | null): LootResult {
  let loot: LootResult = null;
  mutate((s) => {
    const d = s.dungeon;
    d.gold += gold;
    d.totalGold += gold;
    d.kills++;
    if (d.stage === 4 && d.floor % 10 === 0) d.bossKills++;
    if (item) {
      const cur = d.equipment[item.slot];
      if (!cur || itemScore(item) > itemScore(cur)) {
        const sold = cur ? sellPrice(cur) : 0;
        d.equipment[item.slot] = item;
        d.gold += sold;
        loot = { item, equipped: true, sold };
      } else {
        const sold = sellPrice(item);
        d.gold += sold;
        loot = { item, equipped: false, sold };
      }
    }
    d.stage++;
    if (d.stage >= 5) {
      d.stage = 0;
      if (!d.farm) {
        d.floor++;
        if (d.floor > d.deepest) {
          d.deepest = d.floor;
          storyEvents(d.floor);
        }
      }
    }
    d.lastActive = Date.now();
  });
  return loot;
}

/** 新しい階に初めて着いたときの物語（ボス撃破の語り・次の章・仲間の加入） */
function storyEvents(floor: number) {
  if ((floor - 1) % 10 === 0) {
    const prev = chapterOf(floor - 1).chapter;
    pushNotice({ kind: "story", title: `${prev.rank}級「${prev.title}」踏破`, lines: prev.outro });
    const next = chapterOf(floor).chapter;
    pushNotice({ kind: "story", title: chapterLabel(floor), lines: next.intro });
  }
  const ally = ALLIES.find((a) => a.joinFloor === floor);
  if (ally) {
    pushNotice({ kind: "ally", title: `${ally.name}が仲間になった！`, lines: [`【${ally.role}】${ally.desc}`] });
  }
}

/** ダンジョンに初めて入ったときの語り */
export function showOpening() {
  const d = ensure().dungeon;
  if (d.storyChapter > 0) return;
  pushNotice({ kind: "story", title: chapterLabel(1), lines: CHAPTERS[0].intro });
  mutate((s) => {
    s.dungeon.storyChapter = 1;
  });
}

/** 倒された。チェックポイント（1・11・21…階）まで戻される */
export function dungeonDeath() {
  mutate((s) => {
    const d = s.dungeon;
    d.deaths++;
    d.floor = checkpointOf(d.floor);
    d.stage = 0;
    d.lastActive = Date.now();
  });
}

export function warpTo(floor: number) {
  mutate((s) => {
    const d = s.dungeon;
    d.floor = Math.max(1, Math.min(checkpointOf(d.deepest), checkpointOf(floor)));
    d.stage = 0;
  });
}

export function setFarm(on: boolean) {
  mutate((s) => {
    s.dungeon.farm = on;
  });
}

export function buyUpgrade(key: UpgradeKey) {
  mutate((s) => {
    const d = s.dungeon;
    const cost = upgradeCost(d.upgrades[key]);
    if (d.gold < cost) return;
    d.gold -= cost;
    d.upgrades[key]++;
  });
}

export function unequip(slot: Slot) {
  mutate((s) => {
    const it = s.dungeon.equipment[slot];
    if (!it) return;
    s.dungeon.gold += sellPrice(it);
    delete s.dungeon.equipment[slot];
  });
}

/** ダンジョンを離れていた間の報酬を受け取る（3分以上離れていたとき） */
export function claimIdle() {
  const s0 = ensure();
  const away = Date.now() - s0.dungeon.lastActive;
  if (s0.dungeon.kills === 0 || away < 3 * 60 * 1000) {
    touchDungeon();
    return;
  }
  const r = idleReward(s0, away);
  mutate((s) => {
    s.dungeon.lastActive = Date.now();
    if (!r) return;
    s.dungeon.gold += r.gold;
    s.dungeon.totalGold += r.gold;
    s.dungeon.kills += r.kills;
  });
  if (r) {
    const h = Math.floor(Math.min(away, 12 * 3600000) / 3600000);
    const m = Math.floor((Math.min(away, 12 * 3600000) % 3600000) / 60000);
    pushNotice({
      kind: "info",
      title: "放置報酬",
      lines: [`留守のあいだ（${h ? `${h}時間` : ""}${m}分）も主人公は戦い続けました。`, `${r.floor}階で ${r.kills}体 討伐`, `ゴールド +${r.gold.toLocaleString()}`],
    });
  }
}

/** ダンジョンにいる時刻を記録する（放置報酬の計算用。保存はするが画面は更新しない） */
export function touchDungeon() {
  const s = ensure();
  state = { ...s, dungeon: { ...s.dungeon, lastActive: Date.now() } };
  save();
}
