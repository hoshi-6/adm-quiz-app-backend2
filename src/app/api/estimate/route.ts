import { generateWithWebSearch, imageBlock } from "@/lib/ai/claude";
import { checkPasscode, errorResponse } from "@/lib/server/http";
import { EstimateRequestSchema, EstimateResultSchema } from "@/lib/ai/schemas";

const SYSTEM = `あなたは管理栄養士です。ユーザーが食べたものの説明から、料理・食品ごとに分けて栄養素を求め、最後に必ず record_meal ツールで記録します。

量について（最重要）:
- ユーザーが書いた量（g・個数・袋数など）を必ずそのまま使ってください。勝手に別の量に置き換えてはいけません。
- 量が書かれていなければ、市販品は 1 袋（1 個）の内容量、料理は日本の成人の一般的な 1 人前とし、amount にその前提を書きます。

栄養素の求め方:
- 市販品（お菓子・食玩・飲料・冷凍食品・コンビニ商品など）や外食チェーンのメニューは、web_search でメーカーや店の公式サイトの栄養成分表示を探し、その値を使ってください（basis=web、source に URL）。表示が 1 袋あたりなら、食べた量に合わせて比例計算します。検索は 1 商品につき 1 回（見つからないときだけもう 1 回）にし、「メーカー名 商品名 栄養成分」のような語で検索します。
- 写真に栄養成分表示が写っていれば、その値を使います（basis=label）。
- ほかの食事記録アプリの画面の写真なら、表示されている値を使います（basis=label）。
- 一般的な食材・家庭料理は、日本食品標準成分表（八訂）を目安に推定します（basis=estimate）。無理に検索しなくて構いません。
- 表示にない栄養素（ビタミン・ミネラルなど）は、原材料から推定して埋めます。
- 数値は単位どおりの実数で返してください（エネルギー kcal、ビタミンA µgRAE など）。
- note には、公式表示が見つからず推定にした食品などの注意点を一言で書きます。`

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
    const result = await generateWithWebSearch({
      system: SYSTEM,
      user: image ? [imageBlock(image), { type: "text", text: prompt }] : prompt,
      schema: EstimateResultSchema,
      toolName: "record_meal",
      toolDescription: "食べたものと栄養素を記録する。調べ終わったら最後に必ず1回だけ呼ぶ。",
      maxSearches: 3,
      effort: "low",
    });
    return Response.json(result);
  } catch (err) {
    return errorResponse(err);
  }
}
