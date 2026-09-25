// 栄養素の定義と、プロフィールから1日の目標量を算出するロジック。
// 目標値は厚生労働省「日本人の食事摂取基準（2025年版）」の成人（18歳以上）の値に基づく。
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
  /** 体重（kg）。入力があれば、公式の計算式で本人の体格に合わせたエネルギー量を出す */
  weightKg?: number | null;
  /** 女性（18〜64歳）で月経があるか。鉄の推奨量が変わる */
  menstruation?: boolean;
}

export const DEFAULT_PROFILE: Profile = { sex: "female", age: 30, activity: "normal", weightKg: null, menstruation: true };
export const DEFAULT_AGE = DEFAULT_PROFILE.age;

// ---- 日本人の食事摂取基準（2025年版）の成人の値 ----
// 年齢区分: 18〜29 / 30〜49 / 50〜64 / 65〜74 / 75以上

const AGE_BANDS = [30, 50, 65, 75, Infinity];
function band(age: number): number {
  return AGE_BANDS.findIndex((upper) => age < upper);
}

type ByBand = [number, number, number, number, number];
const table = (male: ByBand, female: ByBand) => ({ male, female });

/** 推定エネルギー必要量（kcal/日）[身体活動レベル 低い, ふつう, 高い]。75歳以上の「高い」は設定がないので「ふつう」を使う */
const EER: Record<Sex, [number, number, number][]> = {
  male: [
    [2250, 2600, 3000],
    [2350, 2750, 3150],
    [2250, 2650, 3000],
    [2100, 2350, 2650],
    [1850, 2250, 2250],
  ],
  female: [
    [1700, 1950, 2250],
    [1750, 2050, 2350],
    [1700, 1950, 2250],
    [1650, 1850, 2050],
    [1450, 1750, 1750],
  ],
};
const LEVEL: Record<ActivityLevel, 0 | 1 | 2> = { low: 0, normal: 1, high: 2 };

/** 体重1kgあたりの基礎代謝基準値（kcal/kg/日） */
const BMR_PER_KG = table([23.7, 22.5, 21.8, 21.6, 21.5], [22.1, 21.9, 20.7, 20.7, 20.7]);
/** 身体活動レベルの値 [低い, ふつう, 高い] */
const PAL: [number, number, number][] = [
  [1.5, 1.75, 2.0],
  [1.5, 1.75, 2.0],
  [1.5, 1.75, 2.0],
  [1.5, 1.7, 1.9],
  [1.4, 1.65, 1.65],
];

/** たんぱく質 推奨量（g/日）と 目標量の下限（%エネルギー） */
const PROTEIN_RDA = table([65, 65, 65, 60, 60], [50, 50, 50, 50, 50]);
const PROTEIN_DG_MIN: ByBand = [13, 13, 14, 15, 15];
/** 食物繊維 目標量（g/日以上） */
const FIBER = table([20, 22, 22, 21, 20], [18, 18, 18, 18, 17]);
/** カルシウム 推奨量（mg/日） */
const CALCIUM = table([800, 750, 750, 750, 750], [650, 650, 650, 650, 600]);
/** 鉄 推奨量（mg/日）。女性は月経なし／月経あり（月経ありは18〜64歳のみ） */
const IRON_MALE: ByBand = [7.0, 7.5, 7.0, 7.0, 6.5];
const IRON_FEMALE: ByBand = [6.0, 6.0, 6.0, 6.0, 5.5];
const IRON_FEMALE_MENSTRUATION: ByBand = [10.0, 10.5, 10.5, 6.0, 5.5];
/** ビタミンA 推奨量（µgRAE/日） */
const VITAMIN_A = table([850, 900, 900, 850, 800], [650, 700, 700, 700, 650]);

/** 推定エネルギー必要量。体重があれば「基礎代謝基準値 × 体重 × 身体活動レベル」、なければ参照体位での値 */
export function estimateEnergy(p: Profile): number {
  const b = band(p.age);
  const level = LEVEL[p.activity];
  if (p.weightKg && p.weightKg > 0) {
    return Math.round((BMR_PER_KG[p.sex][b] * p.weightKg * PAL[b][level]) / 10) * 10;
  }
  return EER[p.sex][b][level];
}

export function calcTargets(p: Profile): Nutrients {
  const b = band(p.age);
  const male = p.sex === "male";
  const energy = estimateEnergy(p);
  return {
    energy,
    // 推奨量と、目標量（%エネルギー）の下限から求めた量の多い方
    protein: Math.max(PROTEIN_RDA[p.sex][b], Math.round((energy * PROTEIN_DG_MIN[b]) / 100 / 4)),
    // 目標量（脂質 20〜30%、炭水化物 50〜65%）の中央値
    fat: Math.round((energy * 0.25) / 9),
    carbs: Math.round((energy * 0.575) / 4),
    fiber: FIBER[p.sex][b],
    calcium: CALCIUM[p.sex][b],
    iron: male ? IRON_MALE[b] : (p.menstruation ?? true) ? IRON_FEMALE_MENSTRUATION[b] : IRON_FEMALE[b],
    vitaminA: VITAMIN_A[p.sex][b],
    vitaminC: 100,
    vitaminD: 9.0,
    // 目標量（未満）
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
