// AI とのやり取りに使うスキーマ。サーバー（構造化出力）とクライアント（型）で共有する。
import { z } from "zod";

export const NutrientsSchema = z.object({
  energy: z.number().describe("エネルギー kcal"),
  protein: z.number().describe("たんぱく質 g"),
  fat: z.number().describe("脂質 g"),
  carbs: z.number().describe("炭水化物 g"),
  fiber: z.number().describe("食物繊維 g"),
  calcium: z.number().describe("カルシウム mg"),
  iron: z.number().describe("鉄 mg"),
  vitaminA: z.number().describe("ビタミンA µgRAE"),
  vitaminC: z.number().describe("ビタミンC mg"),
  vitaminD: z.number().describe("ビタミンD µg"),
  salt: z.number().describe("食塩相当量 g"),
});

// ---- 食事内容からの栄養推定 ----

export const EstimateResultSchema = z.object({
  items: z.array(
    z.object({
      name: z.string().describe("料理・食品名"),
      amount: z.string().describe("量の目安（例: 茶碗1杯 150g）"),
      nutrients: NutrientsSchema.describe("この量あたりの推定栄養素"),
    }),
  ),
  note: z.string().describe("推定の前提や注意点を一言で"),
});
export type EstimateResult = z.infer<typeof EstimateResultSchema>;

export const EstimateRequestSchema = z.object({
  text: z.string().min(1).max(2000),
});

// ---- 献立提案 ----

export const SuggestResultSchema = z.object({
  summary: z.string().describe("今日の栄養状況と提案方針の要約（2〜3文）"),
  suggestions: z.array(
    z.object({
      title: z.string().describe("料理名（主菜・副菜などの組み合わせでもよい）"),
      reason: z.string().describe("どの不足栄養素を補えるか、なぜこの提案か"),
      cookingMinutes: z.number().describe("調理時間の目安（分）"),
      usesFromPantry: z.array(z.string()).describe("家にある食材・調味料のうち使うもの"),
      needToBuy: z.array(z.string()).describe("買い足しが必要なもの（なければ空）"),
      ingredients: z.array(z.string()).describe("材料と分量（例: 鶏むね肉 200g）"),
      steps: z.array(z.string()).describe("作り方の手順"),
      nutrientsPerServing: NutrientsSchema.describe("1人前あたりの推定栄養素"),
    }),
  ),
});
export type SuggestResult = z.infer<typeof SuggestResultSchema>;

const NutrientStatus = z.object({
  label: z.string(),
  unit: z.string(),
  intake: z.number(),
  target: z.number(),
});

export const SuggestRequestSchema = z.object({
  mealType: z.string().max(20),
  servings: z.number().int().min(1).max(10),
  maxMinutes: z.number().int().min(5).max(240),
  prioritizeExpiring: z.boolean(),
  request: z.string().max(1000),
  preferences: z.string().max(1000),
  pantry: z
    .array(
      z.object({
        name: z.string().max(100),
        category: z.enum(["ingredient", "seasoning"]),
        quantity: z.number(),
        unit: z.string().max(20),
        daysLeft: z.number().nullable(),
      }),
    )
    .max(500),
  status: z.array(NutrientStatus.extend({ kind: z.enum(["min", "max"]) })).max(30),
  eatenToday: z.array(z.string().max(200)).max(50),
});
export type SuggestRequest = z.infer<typeof SuggestRequestSchema>;
