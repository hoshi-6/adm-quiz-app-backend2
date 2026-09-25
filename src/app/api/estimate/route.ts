import { generateStructured, imageBlock } from "@/lib/ai/claude";
import { checkPasscode, errorResponse } from "@/lib/server/http";
import { EstimateRequestSchema, EstimateResultSchema } from "@/lib/ai/schemas";

const SYSTEM = `あなたは管理栄養士です。ユーザーが食べたものの説明から、料理・食品ごとに分けて栄養素を推定します。
- 日本食品標準成分表（八訂）の値を目安に、一般的な家庭料理・市販品の量で推定してください。
- 量が書かれていなければ、日本の成人が一般的に食べる1人前を想定し、amount にその前提を書いてください。
- 数値は単位どおりの実数で返してください（エネルギー kcal、ビタミンA µgRAE など）。
- 写真が付いている場合:
  - 料理の写真なら、写っている料理と量を見積もってください。文章の説明があればそちらを優先します。
  - ほかの食事記録アプリの画面（スクリーンショット）なら、記録されている料理と量を読み取ってください。画面に栄養素の数値が表示されていれば、その値を使ってください。
  - 食品のパッケージや栄養成分表示なら、その表示の値を使ってください。`;

// AI の応答には数十秒かかることがあるため、実行時間の上限を延ばす（Vercel 無料プランの上限内）
export const maxDuration = 300;

export async function POST(req: Request) {
  try {
    checkPasscode(req);
    const parsed = EstimateRequestSchema.safeParse(await req.json());
    if (!parsed.success) {
      return Response.json({ error: "入力内容が正しくありません" }, { status: 400 });
    }
    const { text, image } = parsed.data;
    const prompt = text.trim() ? `今日食べたもの:\n${text}` : "写真の食事の栄養素を推定してください。";
    const result = await generateStructured({
      system: SYSTEM,
      user: image ? [imageBlock(image), { type: "text", text: prompt }] : prompt,
      schema: EstimateResultSchema,
      effort: "low",
    });
    return Response.json(result);
  } catch (err) {
    return errorResponse(err);
  }
}
