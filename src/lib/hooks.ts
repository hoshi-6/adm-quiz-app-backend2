"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { db, defaultSettings, todayStr, type Settings } from "./db";
import { analyze, sumNutrients } from "./nutrients";

export function useSettings(): Settings {
  return useLiveQuery(() => db.settings.get("main"), []) ?? defaultSettings();
}

export function useDayIntake(date = todayStr()) {
  const meals = useLiveQuery(() => db.meals.where("date").equals(date).sortBy("createdAt"), [date]);
  const settings = useSettings();
  const intake = sumNutrients((meals ?? []).map((m) => m.nutrients));
  const { deficits, excesses } = analyze(intake, settings.targets);
  return { meals: meals ?? [], loading: meals === undefined, intake, targets: settings.targets, deficits, excesses };
}

/** 自前の API ルートを呼ぶ。エラー時はメッセージ付きで throw する */
export async function callApi<T>(path: string, body: unknown, passcode: string): Promise<T> {
  const res = await fetch(path, {
    method: "POST",
    headers: { "content-type": "application/json", ...(passcode ? { "x-app-passcode": passcode } : {}) },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? `エラーが発生しました (${res.status})`);
  return data as T;
}
