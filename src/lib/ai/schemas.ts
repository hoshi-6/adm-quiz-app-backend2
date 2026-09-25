// AI とのやり取りに使うスキーマ。サーバー（構造化出力）とクライアント（型）で共有する。
import { z } from "zod";
import { NUTRIENT_KEYS, NUTRIENTS, type NutrientKey } from "../nutrients";

/** 栄養素（nutrients.ts の一覧から作る）。単位は説明に書いて AI に伝える */
export const NutrientsSchema = z.object(
  Object.fromEntries(NUTRIENT_KEYS.map((k) => [k, z.number().describe(`${NUTRIENTS[k].label}（${NUTRIENTS[k].unit === "µg" && k === "vitaminA" ? "µgRAE" : NUTRIENTS[k].unit}）`)])) as Record<
    NutrientKey,
    z.ZodNumber
  >,
);

/** 端末で縮小した写真（base64）。Vercel のリクエスト上限（4.5MB）に収まる大きさまで */
export const ImageSchema = z.object({
  mediaType: z.enum(["image/jpeg", "image/png", "image/webp"]),
  data: z.string().min(1).max(3_500_000),
});
export type ImageInput = z.infer<typeof ImageSchema>;

// ---- 食事内容からの栄養推定 ----

export const EstimateResultSchema = z.object({
  items: z.array(
    z.object({
      name: z.string().describe("料理・食品名（市販品はメーカー名と商品名）"),
      amount: z.string().describe("食べた量（ユーザーが書いた量をそのまま。例: 1袋 21g、茶碗1杯 150g）"),
      nutrients: NutrientsSchema.describe("食べた量あたりの栄養素"),
      basis: z.enum(["label", "web", "estimate"]).describe("label=写真の栄養成分表示、web=Web で見つけた公式の表示、estimate=食品成分表などからの推定"),
      source: z.string().nullable().describe("basis が web のときは参照したページの URL。それ以外は null"),
    }),
  ),
  note: z.string().describe("推定の前提や注意点を一言で"),
});
export type EstimateResult = z.infer<typeof EstimateResultSchema>;

export const EstimateRequestSchema = z
  .object({
    text: z.string().max(2000),
    /** 料理の写真や、ほかのアプリの記録画面のスクリーンショット */
    image: ImageSchema.optional(),
  })
  .refine((r) => r.text.trim() || r.image, "文章か写真のどちらかが必要です");

// ---- 写真から在庫を登録 ----

export const PantryScanResultSchema = z.object({
  items: z.array(
    z.object({
      name: z.string().describe("食品名。パッケージに商品名が読めるときは『メーカー名 商品名』の実際の表記"),
      category: z.enum(["ingredient", "seasoning"]).describe("ingredient=食材、seasoning=調味料・油・だし"),
      quantity: z.number().describe("数量"),
      unit: z.string().describe("単位（個・g・ml・本・パック・袋 など）"),
      expiresOn: z.string().nullable().describe("写真から読み取れた賞味・消費期限（YYYY-MM-DD）。読めなければ null"),
    }),
  ),
  note: z.string().describe("読み取りの注意点を一言で（読み取れなかったものがあれば書く）"),
});
export type PantryScanResult = z.infer<typeof PantryScanResultSchema>;

export const PantryScanRequestSchema = z.object({
  image: ImageSchema,
  /** 期限の年を補うための今日の日付（YYYY-MM-DD） */
  today: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

// ---- 献立提案 ----

export const SuggestionSchema = z.object({
  title: z.string().describe("料理名（主菜・副菜などの組み合わせでもよい）"),
  reason: z.string().describe("どの不足栄養素を補えるか、なぜこの提案か（1〜2文）"),
  cookingMinutes: z.number().describe("調理時間の目安（分）"),
  pantryUsage: z
    .array(
      z.object({
        name: z.string().describe("在庫リストの食材名（そのまま書く）"),
        amount: z.number().describe("指定人数分で使う量（在庫リストと同じ単位で）"),
        unit: z.string().describe("在庫リストと同じ単位"),
      }),
    )
    .describe("家にある『食材』のうち使うもの。調味料は含めない"),
  needToBuy: z.array(z.string()).describe("買い足しが必要なもの（なければ空）"),
  ingredients: z.array(z.string()).describe("指定人数分の材料と分量（調味料も含む。例: 鶏むね肉 200g）"),
  steps: z.array(z.string()).describe("作り方の手順"),
  nutrientsPerServing: NutrientsSchema.describe("1人前あたりの推定栄養素"),
});
export type Suggestion = z.infer<typeof SuggestionSchema>;

/** 3案を並行して作るときの、料理の方向性 */
export const SUGGEST_STYLES = ["和食", "洋食", "中華・エスニック"] as const;

const NutrientStatus = z.object({
  label: z.string(),
  unit: z.string(),
  intake: z.number(),
  target: z.number(),
});

export const SuggestRequestSchema = z.object({
  /** SUGGEST_STYLES の番号 */
  style: z.number().int().min(0).max(SUGGEST_STYLES.length - 1),
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
