import { generateStructured } from "@/lib/ai/claude";
import { checkPasscode, errorResponse } from "@/lib/server/http";
import { EstimateRequestSchema, EstimateResultSchema } from "@/lib/ai/schemas";

const SYSTEM = `あなたは管理栄養士です。ユーザーが食べたものの説明から、料理・食品ごとに分けて栄養素を推定します。
- 日本食品標準成分表（八訂）の値を目安に、一般的な家庭料理・市販品の量で推定してください。
- 量が書かれていなければ、日本の成人が一般的に食べる1人前を想定し、amount にその前提を書いてください。
- 数値は単位どおりの実数で返してください（エネルギー kcal、ビタミンA µgRAE など）。`;

// AI の応答には数十秒かかることがあるため、実行時間の上限を延ばす（Vercel 無料プランの上限内）
export const maxDuration = 300;

export async function POST(req: Request) {
  try {
    checkPasscode(req);
    const parsed = EstimateRequestSchema.safeParse(await req.json());
    if (!parsed.success) {
      return Response.json({ error: "入力内容が正しくありません" }, { status: 400 });
    }
    const result = await generateStructured({
      system: SYSTEM,
      user: `今日食べたもの:\n${parsed.data.text}`,
      schema: EstimateResultSchema,
      effort: "low",
    });
    return Response.json(result);
  } catch (err) {
    return errorResponse(err);
  }
}
