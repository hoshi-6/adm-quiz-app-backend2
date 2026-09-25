// 栄養素の定義と、プロフィールから1日の目標量を算出するロジック。
// 目標値は「日本人の食事摂取基準（2025年版）」の成人値をもとにした簡易的な目安。
// 設定画面から個別に上書きできる。

export const NUTRIENT_KEYS = [
  "energy",
  "protein",
  "fat",
  "carbs",
  "fiber",
  "calcium",
  "iron",
  "vitaminA",
  "vitaminC",
  "vitaminD",
  "salt",
] as const;

export type NutrientKey = (typeof NUTRIENT_KEYS)[number];
export type Nutrients = Record<NutrientKey, number>;

export interface NutrientDef {
  key: NutrientKey;
  label: string;
  unit: string;
  /** "min" = 目標以上とりたい / "max" = 上限を超えたくない */
  kind: "min" | "max";
}

export const NUTRIENTS: Record<NutrientKey, NutrientDef> = {
  energy: { key: "energy", label: "エネルギー", unit: "kcal", kind: "min" },
  protein: { key: "protein", label: "たんぱく質", unit: "g", kind: "min" },
  fat: { key: "fat", label: "脂質", unit: "g", kind: "min" },
  carbs: { key: "carbs", label: "炭水化物", unit: "g", kind: "min" },
  fiber: { key: "fiber", label: "食物繊維", unit: "g", kind: "min" },
  calcium: { key: "calcium", label: "カルシウム", unit: "mg", kind: "min" },
  iron: { key: "iron", label: "鉄", unit: "mg", kind: "min" },
  vitaminA: { key: "vitaminA", label: "ビタミンA", unit: "µg", kind: "min" },
  vitaminC: { key: "vitaminC", label: "ビタミンC", unit: "mg", kind: "min" },
  vitaminD: { key: "vitaminD", label: "ビタミンD", unit: "µg", kind: "min" },
  salt: { key: "salt", label: "食塩相当量", unit: "g", kind: "max" },
};

export function emptyNutrients(): Nutrients {
  return Object.fromEntries(NUTRIENT_KEYS.map((k) => [k, 0])) as Nutrients;
}

export function sumNutrients(list: Nutrients[]): Nutrients {
  const total = emptyNutrients();
  for (const n of list) {
    for (const k of NUTRIENT_KEYS) total[k] += n[k] ?? 0;
  }
  return total;
}

export type Sex = "male" | "female";
export type ActivityLevel = "low" | "normal" | "high";

export interface Profile {
  sex: Sex;
  age: number;
  activity: ActivityLevel;
}

export const DEFAULT_PROFILE: Profile = { sex: "female", age: 30, activity: "normal" };

const ACTIVITY_FACTOR: Record<ActivityLevel, number> = { low: 0.86, normal: 1, high: 1.14 };

// 身体活動レベル「ふつう」の推定エネルギー必要量（kcal/日）
function baseEnergy(sex: Sex, age: number): number {
  if (sex === "male") {
    if (age < 30) return 2600;
    if (age < 50) return 2750;
    if (age < 65) return 2650;
    if (age < 75) return 2350;
    return 2250;
  }
  if (age < 30) return 1950;
  if (age < 50) return 2050;
  if (age < 65) return 1950;
  if (age < 75) return 1850;
  return 1750;
}

export function calcTargets(p: Profile): Nutrients {
  const energy = Math.round((baseEnergy(p.sex, p.age) * ACTIVITY_FACTOR[p.activity]) / 10) * 10;
  const male = p.sex === "male";
  const senior = p.age >= 65;
  return {
    energy,
    protein: male ? 65 : 50,
    // 脂質はエネルギーの25%、炭水化物は57.5%を目安にする
    fat: Math.round((energy * 0.25) / 9),
    carbs: Math.round((energy * 0.575) / 4),
    fiber: male ? (senior ? 20 : 22) : senior ? 17 : 18,
    calcium: male ? (p.age < 30 ? 800 : 750) : 650,
    // 女性は月経ありの値。閉経後などは設定画面で調整する
    iron: male ? 7.5 : p.age < 65 ? 10.5 : 6.0,
    vitaminA: male ? (p.age < 30 ? 850 : 900) : 700,
    vitaminC: 100,
    vitaminD: 9,
    salt: male ? 7.5 : 6.5,
  };
}

export interface Shortfall {
  key: NutrientKey;
  label: string;
  unit: string;
  intake: number;
  target: number;
  /** min 系は不足量、max 系は超過量 */
  gap: number;
  ratio: number;
}

/** 目標に対する不足（min 系）と超過（max 系）を返す */
export function analyze(intake: Nutrients, targets: Nutrients) {
  const deficits: Shortfall[] = [];
  const excesses: Shortfall[] = [];
  for (const k of NUTRIENT_KEYS) {
    const def = NUTRIENTS[k];
    const target = targets[k];
    if (!target) continue;
    const ratio = intake[k] / target;
    const base = { key: k, label: def.label, unit: def.unit, intake: intake[k], target, ratio };
    if (def.kind === "min" && ratio < 1) deficits.push({ ...base, gap: target - intake[k] });
    if (def.kind === "max" && ratio > 1) excesses.push({ ...base, gap: intake[k] - target });
  }
  deficits.sort((a, b) => a.ratio - b.ratio);
  return { deficits, excesses };
}

export function fmt(value: number, key: NutrientKey): string {
  const digits = key === "energy" || key === "calcium" || key === "vitaminA" ? 0 : 1;
  return value.toFixed(digits);
}
