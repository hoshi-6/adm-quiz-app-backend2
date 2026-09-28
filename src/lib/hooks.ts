"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { db, defaultSettings, todayStr, type Settings } from "./db";
import { analyze, calcTargets, sumNutrients } from "./nutrients";
import { getPasscode } from "./sync";

export function useSettings(): Settings {
  const s = useLiveQuery(() => db.settings.get("main"), []) ?? defaultSettings();
  // 項目が増える前に保存した設定には、新しい栄養素の目標値がないので基準値で補う
  return { ...s, targets: { ...calcTargets(s.profile), ...s.targets } };
}

export function useDayIntake(date = todayStr()) {
  const meals = useLiveQuery(() => db.meals.where("date").equals(date).sortBy("createdAt"), [date]);
  const settings = useSettings();
  const intake = sumNutrients((meals ?? []).map((m) => m.nutrients));
  const { deficits, excesses } = analyze(intake, settings.targets);
  return { meals: meals ?? [], loading: meals === undefined, intake, targets: settings.targets, deficits, excesses };
}

/** 自前の API ルートを呼ぶ。エラー時はメッセージ付きで throw する */
/** API のエラー。status で「待てば直るか」を判断できる */
export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

export async function callApi<T>(path: string, body: unknown): Promise<T> {
  const passcode = getPasscode();
  const res = await fetch(path, {
    method: "POST",
    headers: { "content-type": "application/json", ...(passcode ? { "x-app-passcode": passcode } : {}) },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const fallback =
      res.status === 504
        ? "処理に時間がかかりすぎて中断されました（タイムアウト）。もう一度お試しください"
        : res.status === 413
          ? "送るデータが大きすぎます"
          : `エラーが発生しました (${res.status})`;
    throw new ApiError(data.error ?? fallback, res.status);
  }
  return data as T;
}
