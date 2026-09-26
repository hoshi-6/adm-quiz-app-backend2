// 1日の栄養バランスを 100 点満点で採点する。
// 目標値（日本人の食事摂取基準）に対する達成度を栄養素ごとに点数にし、重みを付けて平均する。
import { NUTRIENT_KEYS, NUTRIENTS, type NutrientKey, type Nutrients } from "./nutrients";

/** 多すぎても少なすぎてもよくない栄養素（目標の 90〜110% が満点） */
const BALANCE: NutrientKey[] = ["energy", "fat", "carbs"];

/** 総合点での重み。エネルギー・主要栄養素・食塩を重く見る */
const WEIGHT: Partial<Record<NutrientKey, number>> = {
  energy: 3,
  protein: 2,
  fat: 1.5,
  carbs: 1.5,
  fiber: 1.5,
  salt: 2,
  saturatedFat: 1,
};

/** 栄養素 1 つの点数（0〜100） */
export function nutrientScore(key: NutrientKey, intake: number, target: number): number {
  if (!target) return 100;
  const r = intake / target;
  if (NUTRIENTS[key].kind === "max") {
    // 上限以下なら満点。上限の 2 倍で 0 点
    return r <= 1 ? 100 : Math.max(0, 100 - (r - 1) * 100);
  }
  if (BALANCE.includes(key)) {
    // 90〜110% で満点。少ない側は 0% で 0 点、多い側は 150% で 0 点
    if (r < 0.9) return (r / 0.9) * 100;
    if (r <= 1.1) return 100;
    return Math.max(0, 100 - ((r - 1.1) / 0.4) * 100);
  }
  // とりたい栄養素は、目標に届けば満点（多い分は加点しない）
  return Math.min(1, r) * 100;
}

export interface DayScore {
  /** 総合点（0〜100） */
  score: number;
  parts: { key: NutrientKey; score: number }[];
  /** 点数が低い順（改善のヒント） */
  weakest: { key: NutrientKey; score: number }[];
}

export function scoreDay(intake: Nutrients, targets: Nutrients): DayScore {
  let sum = 0;
  let weights = 0;
  const parts = NUTRIENT_KEYS.map((key) => {
    const score = nutrientScore(key, intake[key], targets[key]);
    const w = WEIGHT[key] ?? 1;
    sum += score * w;
    weights += w;
    return { key, score };
  });
  return {
    score: Math.round(sum / weights),
    parts,
    weakest: [...parts].sort((a, b) => a.score - b.score).filter((p) => p.score < 80).slice(0, 3),
  };
}

export function scoreLabel(score: number): { text: string; tone: "good" | "warn" | "danger" | "neutral" } {
  if (score >= 90) return { text: "とても良い", tone: "good" };
  if (score >= 75) return { text: "良い", tone: "good" };
  if (score >= 60) return { text: "ふつう", tone: "neutral" };
  if (score >= 40) return { text: "もう少し", tone: "warn" };
  return { text: "要改善", tone: "danger" };
}

/** 記録がある日の平均点 */
export function averageScore(scores: (number | null)[]): number | null {
  const v = scores.filter((s): s is number => s !== null);
  return v.length ? Math.round(v.reduce((a, b) => a + b, 0) / v.length) : null;
}
