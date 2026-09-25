// 端末内（IndexedDB）のデータ。画面はここを読み書きし、変更は sync.ts がクラウドと同期する。
// 書き込みは必ずこのファイルの関数を通す（同期用の uid / updatedAt / dirty を付けるため）。
import Dexie, { type EntityTable } from "dexie";
import { DEFAULT_PROFILE, calcTargets, type Nutrients, type Profile } from "./nutrients";

/** 同期対象レコードの共通フィールド */
interface Syncable {
  /** 端末をまたいで同じレコードを識別する ID */
  uid: string;
  updatedAt: number;
  /** 1 = まだクラウドに送っていない変更がある */
  dirty: 0 | 1;
}

export type PantryCategory = "ingredient" | "seasoning";

/** 在庫の商品が持つ栄養成分（パッケージや公式サイトの表示どおり、per あたりの量で持つ） */
export interface ItemNutrition {
  /** 何あたりの値か（例: 100 g、1 袋） */
  per: { amount: number; unit: string };
  nutrients: Nutrients;
  /** label=パッケージの表示、web=公式サイトなど、estimate=食品成分表からの推定 */
  basis: "label" | "web" | "estimate";
  /** 参照したページの URL */
  source: string | null;
}

export interface PantryItem extends Syncable {
  id?: number;
  name: string;
  category: PantryCategory;
  quantity: number;
  unit: string;
  /** YYYY-MM-DD */
  expiresOn?: string;
  /** 在庫の単位1つあたりの内容量（例: 1袋 = 21 g）。単位が g・ml のときは不要 */
  unitSize?: { amount: number; unit: "g" | "ml" } | null;
  /** 栄養成分。食事記録で「在庫から使う」ときにこの値で計算する */
  nutrition?: ItemNutrition | null;
  /** 商品の画像（出典ページの代表画像）。同じ商品か見て確かめるため */
  imageUrl?: string | null;
}

export type MealType = "breakfast" | "lunch" | "dinner" | "snack";

export const MEAL_LABELS: Record<MealType, string> = {
  breakfast: "朝食",
  lunch: "昼食",
  dinner: "夕食",
  snack: "間食",
};

/** 今の時刻から、どの食事かを推測する */
export function guessMealType(): MealType {
  const h = new Date().getHours();
  if (h < 10) return "breakfast";
  if (h < 15) return "lunch";
  if (h < 17) return "snack";
  return "dinner";
}

export interface MealEntry extends Syncable {
  id?: number;
  /** YYYY-MM-DD */
  date: string;
  mealType: MealType;
  name: string;
  amount: string;
  nutrients: Nutrients;
  createdAt: number;
}

export interface Settings extends Syncable {
  id: "main";
  profile: Profile;
  targets: Nutrients;
  /** 苦手な食材・アレルギー・好みなど、AI提案時に伝えるメモ */
  preferences: string;
}

export type Collection = "pantry" | "meals" | "settings";

/** 削除したレコード。次の同期でクラウドにも削除を伝える */
export interface Tombstone {
  uid: string;
  collection: Collection;
  deletedAt: number;
}

/** 端末だけに保存する値（パスコード、同期位置など） */
export interface Meta {
  key: string;
  value: string | number;
}

export const db = new Dexie("nutri-pantry") as Dexie & {
  pantry: EntityTable<PantryItem, "id">;
  meals: EntityTable<MealEntry, "id">;
  settings: EntityTable<Settings, "id">;
  tombstones: EntityTable<Tombstone, "uid">;
  meta: EntityTable<Meta, "key">;
};

db.version(1).stores({
  pantry: "++id, name, category, expiresOn",
  meals: "++id, date, mealType",
  settings: "id",
});

// v2: クラウド同期に対応
db.version(2)
  .stores({
    pantry: "++id, &uid, name, category, expiresOn, dirty",
    meals: "++id, &uid, date, mealType, dirty",
    settings: "id",
    tombstones: "uid",
    meta: "key",
  })
  .upgrade(async (tx) => {
    const markSyncable = (r: Record<string, unknown>) => {
      r.uid ??= newUid();
      r.updatedAt ??= (r.createdAt as number) ?? Date.now();
      r.dirty = 1;
    };
    await tx.table("pantry").toCollection().modify(markSyncable);
    await tx.table("meals").toCollection().modify(markSyncable);
    // パスコードは端末だけに置くので、設定から meta へ移す
    const s = await tx.table("settings").get("main");
    if (s) {
      if (s.passcode) await tx.table("meta").put({ key: "passcode", value: s.passcode });
      delete s.passcode;
      s.uid = "main";
      markSyncable(s);
      await tx.table("settings").put(s);
    }
  });

/** crypto.randomUUID は HTTPS 以外で使えないため、getRandomValues で作る */
export function newUid(): string {
  const b = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
}

// ---- 変更通知（sync.ts が購読して、少し待ってから同期する） ----

const listeners = new Set<() => void>();
export function onLocalChange(fn: () => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
function changed() {
  listeners.forEach((fn) => fn());
}

// ---- 書き込み用の関数 ----

type NewRecord<T> = Omit<T, "id" | "uid" | "updatedAt" | "dirty">;

export async function addMeals(entries: Omit<NewRecord<MealEntry>, "createdAt">[]) {
  const now = Date.now();
  // createdAt は追加順を保つよう 1ms ずつずらす
  await db.meals.bulkAdd(entries.map((e, i) => ({ ...e, uid: newUid(), createdAt: now + i, updatedAt: now, dirty: 1 as const })));
  changed();
}

export async function deleteMeal(id: number) {
  await deleteRecord("meals", id);
}

export async function addPantryItems(items: NewRecord<PantryItem>[]) {
  const now = Date.now();
  await db.pantry.bulkAdd(items.map((i) => ({ ...i, uid: newUid(), updatedAt: now, dirty: 1 as const })));
  changed();
}

/** 在庫に追加する。同じ名前・種類・単位のものがあれば数量を足す */
export async function addToPantry(items: NewRecord<PantryItem>[]) {
  const fresh: NewRecord<PantryItem>[] = [];
  for (const item of items) {
    const existing = await db.pantry
      .where("name")
      .equals(item.name)
      .and((i) => i.category === item.category && i.unit === item.unit)
      .first();
    if (existing?.id) {
      await db.pantry.update(existing.id, {
        quantity: Math.round((existing.quantity + item.quantity) * 100) / 100,
        expiresOn: item.expiresOn || existing.expiresOn,
        // 新しく調べた内容量・栄養成分があれば更新し、なければ今までのものを残す
        unitSize: item.unitSize ?? existing.unitSize ?? null,
        nutrition: item.nutrition ?? existing.nutrition ?? null,
        imageUrl: item.imageUrl ?? existing.imageUrl ?? null,
        updatedAt: Date.now(),
        dirty: 1,
      });
    } else {
      fresh.push(item);
    }
  }
  if (fresh.length) await addPantryItems(fresh);
  else changed();
}

export async function updatePantryItem(id: number, changes: Partial<NewRecord<PantryItem>>) {
  await db.pantry.update(id, { ...changes, updatedAt: Date.now(), dirty: 1 });
  changed();
}

export async function deletePantryItem(id: number) {
  await deleteRecord("pantry", id);
}

/** 使った分を在庫から減らす。なくなったものは在庫から消す */
export async function consumePantry(usages: { id: number; amount: number }[]) {
  for (const u of usages) {
    const item = await db.pantry.get(u.id);
    if (!item || u.amount <= 0) continue;
    const left = Math.round((item.quantity - u.amount) * 100) / 100;
    if (left <= 0) await deleteRecord("pantry", u.id);
    else await db.pantry.update(u.id, { quantity: left, updatedAt: Date.now(), dirty: 1 });
  }
  changed();
}

async function deleteRecord(collection: "pantry" | "meals", id: number) {
  const table = db.table<PantryItem | MealEntry, number>(collection);
  await db.transaction("rw", table, db.tombstones, async () => {
    const rec = await table.get(id);
    if (!rec) return;
    await table.delete(id);
    await db.tombstones.put({ uid: rec.uid, collection, deletedAt: Date.now() });
  });
  changed();
}

export type SettingsInput = Pick<Settings, "profile" | "targets" | "preferences">;

export async function saveSettings(s: SettingsInput) {
  await db.settings.put({ ...s, id: "main", uid: "main", updatedAt: Date.now(), dirty: 1 });
  changed();
}

export function defaultSettings(): Settings {
  return {
    id: "main",
    uid: "main",
    profile: DEFAULT_PROFILE,
    targets: calcTargets(DEFAULT_PROFILE),
    preferences: "",
    // 未保存の初期値。クラウドに設定があればそちらが優先される
    updatedAt: 0,
    dirty: 0,
  };
}

export async function getSettings(): Promise<Settings> {
  return (await db.settings.get("main")) ?? defaultSettings();
}

// ---- 端末だけの値 ----

export async function getMeta<T extends string | number>(key: string): Promise<T | undefined> {
  return (await db.meta.get(key))?.value as T | undefined;
}

export async function setMeta(key: string, value: string | number) {
  await db.meta.put({ key, value });
}

// ---- 日付 ----

export function todayStr(d = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function daysUntil(date: string): number {
  const target = new Date(`${date}T00:00:00`);
  const today = new Date(`${todayStr()}T00:00:00`);
  return Math.round((target.getTime() - today.getTime()) / 86_400_000);
}

// ---- バックアップ ----

const strip = <T extends { id?: unknown; dirty: 0 | 1 }>({ id: _id, dirty: _dirty, ...rest }: T) => rest;

export async function exportAll() {
  return {
    version: 2,
    exportedAt: new Date().toISOString(),
    pantry: (await db.pantry.toArray()).map(strip),
    meals: (await db.meals.toArray()).map(strip),
    settings: (await db.settings.toArray()).map(strip),
  };
}

type Backup = {
  version: number;
  pantry: Partial<PantryItem>[];
  meals: Partial<MealEntry>[];
  settings: Partial<Settings>[];
};

/** バックアップを取り込む。同じレコード（uid が一致）は上書きし、それ以外は追加する */
export async function importAll(data: Backup) {
  if (data?.version !== 1 && data?.version !== 2) throw new Error("対応していないバックアップ形式です");
  const now = Date.now();
  const prep = <T extends { uid?: string; createdAt?: number }>({ id: _id, ...r }: T & { id?: unknown }) => ({
    ...r,
    uid: r.uid ?? newUid(),
    updatedAt: now,
    dirty: 1 as const,
  });
  await db.transaction("rw", db.pantry, db.meals, db.settings, async () => {
    for (const [table, rows] of [
      [db.pantry, data.pantry],
      [db.meals, data.meals],
    ] as const) {
      for (const row of rows ?? []) {
        const rec = prep(row);
        const existing = await table.where("uid").equals(rec.uid).first();
        await table.put({ ...rec, id: existing?.id } as never);
      }
    }
    const s = data.settings?.[0];
    if (s?.profile && s.targets) {
      await db.settings.put({ id: "main", uid: "main", profile: s.profile, targets: s.targets, preferences: s.preferences ?? "", updatedAt: now, dirty: 1 });
    }
  });
  changed();
}

/** この端末のデータだけを消す（クラウド同期中なら、次の同期でクラウドから取り直す） */
export async function clearLocal() {
  const passcode = await getMeta<string>("passcode");
  await db.delete();
  await db.open();
  if (passcode) await setMeta("passcode", passcode);
}
