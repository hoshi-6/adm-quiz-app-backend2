// 端末内（IndexedDB）にデータを保存する。サーバーには個人データを置かない。
import Dexie, { type EntityTable } from "dexie";
import {
  DEFAULT_PROFILE,
  calcTargets,
  type Nutrients,
  type Profile,
} from "./nutrients";

export type PantryCategory = "ingredient" | "seasoning";

export interface PantryItem {
  id?: number;
  name: string;
  category: PantryCategory;
  quantity: number;
  unit: string;
  /** YYYY-MM-DD */
  expiresOn?: string;
  updatedAt: number;
}

export type MealType = "breakfast" | "lunch" | "dinner" | "snack";

export const MEAL_LABELS: Record<MealType, string> = {
  breakfast: "朝食",
  lunch: "昼食",
  dinner: "夕食",
  snack: "間食",
};

export interface MealEntry {
  id?: number;
  /** YYYY-MM-DD */
  date: string;
  mealType: MealType;
  name: string;
  amount: string;
  nutrients: Nutrients;
  createdAt: number;
}

export interface Settings {
  id: "main";
  profile: Profile;
  targets: Nutrients;
  /** 苦手な食材・アレルギー・好みなど、AI提案時に伝えるメモ */
  preferences: string;
  /** サーバー側で APP_PASSCODE を設定した場合に送るパスコード */
  passcode: string;
}

export const db = new Dexie("nutri-pantry") as Dexie & {
  pantry: EntityTable<PantryItem, "id">;
  meals: EntityTable<MealEntry, "id">;
  settings: EntityTable<Settings, "id">;
};

db.version(1).stores({
  pantry: "++id, name, category, expiresOn",
  meals: "++id, date, mealType",
  settings: "id",
});

/** 食事を記録する（createdAt は追加順を保つよう自動で付ける） */
export async function addMeals(entries: Omit<MealEntry, "id" | "createdAt">[]) {
  const now = Date.now();
  await db.meals.bulkAdd(entries.map((e, i) => ({ ...e, createdAt: now + i })));
}

export async function updatePantryItem(id: number, changes: Partial<Omit<PantryItem, "id" | "updatedAt">>) {
  await db.pantry.update(id, { ...changes, updatedAt: Date.now() });
}

export async function addPantryItems(items: Omit<PantryItem, "id" | "updatedAt">[]) {
  const now = Date.now();
  await db.pantry.bulkAdd(items.map((i) => ({ ...i, updatedAt: now })));
}

export function defaultSettings(): Settings {
  return {
    id: "main",
    profile: DEFAULT_PROFILE,
    targets: calcTargets(DEFAULT_PROFILE),
    preferences: "",
    passcode: "",
  };
}

export async function getSettings(): Promise<Settings> {
  return (await db.settings.get("main")) ?? defaultSettings();
}

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

// 端末間の移行・バックアップ用
export async function exportAll() {
  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    pantry: await db.pantry.toArray(),
    meals: await db.meals.toArray(),
    settings: await db.settings.toArray(),
  };
}

export async function importAll(data: Awaited<ReturnType<typeof exportAll>>) {
  if (data?.version !== 1) throw new Error("対応していないバックアップ形式です");
  await db.transaction("rw", db.pantry, db.meals, db.settings, async () => {
    await Promise.all([db.pantry.clear(), db.meals.clear(), db.settings.clear()]);
    await db.pantry.bulkAdd(data.pantry);
    await db.meals.bulkAdd(data.meals);
    await db.settings.bulkPut(data.settings);
  });
}
