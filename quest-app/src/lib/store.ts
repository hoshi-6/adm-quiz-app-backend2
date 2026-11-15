"use client";
// 端末内（localStorage）に保存する。画面は useGame() で読み、書き込みは下の関数を通す。
import { useSyncExternalStore } from "react";
import { toDateKey } from "./date";
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
  kind: "clear" | "levelup" | "title" | "penalty" | "info";
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
      if (parsed && parsed.version === 1) return { ...newGame(), ...parsed };
    }
  } catch {
    // 読めないときは新しく始める
  }
  return newGame();
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
        lines: [`報酬：経験値 +${xp}`, streakBefore > 0 ? `連続クリアボーナス（${streak}日目）` : "明日も継続すると経験値ボーナス"],
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
  state = { ...newGame(), ...parsed };
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
