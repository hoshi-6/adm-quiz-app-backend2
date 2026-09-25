"use client";

// 端末内のデータとクラウドの同期。
// 変更は端末に即保存し（オフラインでも使える）、少し待ってからまとめてクラウドへ送る。
// 同じレコードを両方の端末で変更した場合は、後から変更した方が残る。
import { useSyncExternalStore } from "react";
import { MAX_PUSH, type SyncChange, type SyncResponse } from "./sync-schema";
import { db, getMeta, onLocalChange, setMeta, type Collection, type MealEntry, type PantryItem, type Settings } from "./db";

export type SyncStatus =
  | "starting"
  /** クラウド未設定。この端末だけで使う */
  | "local"
  | "needs-passcode"
  | "syncing"
  | "synced"
  | "offline"
  | "error";

interface SyncState {
  status: SyncStatus;
  message: string | null;
  lastSyncedAt: number | null;
}

let state: SyncState = { status: "starting", message: null, lastSyncedAt: null };
let passcode = "";
const subscribers = new Set<() => void>();

function setState(patch: Partial<SyncState>) {
  state = { ...state, ...patch };
  subscribers.forEach((fn) => fn());
}

export function useSyncState(): SyncState {
  return useSyncExternalStore(
    (fn) => {
      subscribers.add(fn);
      return () => subscribers.delete(fn);
    },
    () => state,
    () => state,
  );
}

export function getPasscode() {
  return passcode;
}

export async function setPasscode(value: string) {
  passcode = value;
  await setMeta("passcode", value);
  return syncNow();
}

export async function forgetPasscode() {
  passcode = "";
  await db.meta.delete("passcode");
  setState({ status: "needs-passcode", message: null });
}

// ---- 同期本体 ----

const COLLECTIONS = ["pantry", "meals", "settings"] as const;
type Row = PantryItem | MealEntry | Settings;

function table(c: Collection) {
  return db.table<Row, number | string>(c);
}

/** 端末側の id / dirty を除いたものをクラウドへ送る */
function toData(row: Row): Record<string, unknown> {
  const { id: _id, dirty: _dirty, ...data } = row as Row & { id?: unknown };
  return data;
}

async function collectChanges(): Promise<SyncChange[]> {
  const changes: SyncChange[] = [];
  for (const c of COLLECTIONS) {
    const rows = c === "settings" ? (await db.settings.toArray()).filter((s) => s.dirty) : await table(c).where("dirty").equals(1).toArray();
    for (const row of rows) changes.push({ collection: c, uid: row.uid, updatedAt: row.updatedAt, deleted: false, data: toData(row) });
  }
  for (const t of await db.tombstones.toArray()) {
    changes.push({ collection: t.collection, uid: t.uid, updatedAt: t.deletedAt, deleted: true, data: null });
  }
  return changes.slice(0, MAX_PUSH);
}

async function applyRemote(changes: SyncChange[]) {
  await db.transaction("rw", [db.pantry, db.meals, db.settings, db.tombstones], async () => {
    for (const ch of changes) {
      const t = table(ch.collection);
      const local = ch.collection === "settings" ? await db.settings.get("main") : await t.where("uid").equals(ch.uid).first();
      // こちらの方が新しい未送信の変更なら、次の送信で上書きするので取り込まない
      if (local?.dirty && local.updatedAt > ch.updatedAt) continue;
      const tomb = await db.tombstones.get(ch.uid);
      if (tomb && tomb.deletedAt > ch.updatedAt) continue;

      if (ch.deleted) {
        if (local) await t.delete((local as { id: number | string }).id);
        await db.tombstones.delete(ch.uid);
      } else if (ch.data) {
        const id = ch.collection === "settings" ? "main" : (local as PantryItem | MealEntry | undefined)?.id;
        await t.put({ ...(ch.data as unknown as Row), ...(id === undefined ? {} : { id }), dirty: 0 } as Row);
        if (tomb) await db.tombstones.delete(ch.uid);
      }
    }
  });
}

/** 送った変更の dirty を下ろす（送信中にさらに編集されたものは残す） */
async function markPushed(pushed: SyncChange[]) {
  await db.transaction("rw", [db.pantry, db.meals, db.settings, db.tombstones], async () => {
    for (const p of pushed) {
      if (p.deleted) {
        const tomb = await db.tombstones.get(p.uid);
        if (tomb && tomb.deletedAt === p.updatedAt) await db.tombstones.delete(p.uid);
        continue;
      }
      const t = table(p.collection);
      const local = p.collection === "settings" ? await db.settings.get("main") : await t.where("uid").equals(p.uid).first();
      if (local && local.updatedAt === p.updatedAt && local.dirty) {
        await t.update((local as { id: number | string }).id, { dirty: 0 });
      }
    }
  });
}

async function post(body: unknown): Promise<SyncResponse> {
  const res = await fetch("/api/sync", {
    method: "POST",
    headers: { "content-type": "application/json", ...(passcode ? { "x-app-passcode": passcode } : {}) },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401) throw Object.assign(new Error(data.error ?? "パスコードが違います"), { code: "passcode" });
  if (!res.ok) throw new Error(data.error ?? `同期に失敗しました (${res.status})`);
  return data as SyncResponse;
}

let running: Promise<void> | null = null;
let again = false;

export function syncNow(): Promise<void> {
  if (running) {
    again = true;
    return running;
  }
  running = (async () => {
    try {
      do {
        again = false;
        await syncOnce();
      } while (again);
    } finally {
      running = null;
    }
  })();
  return running;
}

async function syncOnce() {
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    if (state.status !== "local") setState({ status: "offline", message: null });
    return;
  }
  if (state.status !== "local") setState({ status: "syncing", message: null });
  try {
    let since = (await getMeta<number>("syncSeq")) ?? 0;
    let changes = await collectChanges();
    for (let i = 0; i < 50; i++) {
      const res = await post({ since, changes });
      if (!res.enabled) {
        setState({ status: "local", message: null });
        return;
      }
      if (res.reset) since = 0;
      await markPushed(changes);
      await applyRemote(res.changes);
      since = res.seq;
      await setMeta("syncSeq", since);
      // 送り切れなかった変更や、受け取り切れなかった変更があれば続ける
      changes = await collectChanges();
      if (!res.hasMore && changes.length === 0) break;
    }
    setState({ status: "synced", message: null, lastSyncedAt: Date.now() });
  } catch (err) {
    if ((err as { code?: string }).code === "passcode") {
      setState({ status: "needs-passcode", message: passcode ? (err as Error).message : null });
    } else if (err instanceof TypeError) {
      // fetch のネットワークエラー
      setState({ status: "offline", message: null });
    } else {
      setState({ status: "error", message: (err as Error).message });
    }
  }
}

// ---- 自動同期 ----

let started = false;

export function startSync() {
  if (started) return;
  started = true;

  let timer: ReturnType<typeof setTimeout> | undefined;
  const soon = () => {
    clearTimeout(timer);
    timer = setTimeout(() => void syncNow(), 1500);
  };

  getMeta<string>("passcode").then((p) => {
    passcode = p ?? "";
    void syncNow();
  });

  // 編集したら少し待って送る / アプリに戻ってきたら受け取る / 1分ごとにも確認
  onLocalChange(soon);
  // 表示に戻ったら受け取り、裏に回るときは未送信の変更を送る
  document.addEventListener("visibilitychange", () => void syncNow());
  window.addEventListener("online", () => void syncNow());
  setInterval(() => {
    if (document.visibilityState === "visible" && state.status !== "needs-passcode") void syncNow();
  }, 60_000);
}
