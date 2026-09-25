import { generateStructured, imageBlock } from "@/lib/ai/claude";
import { PantryScanRequestSchema, PantryScanResultSchema } from "@/lib/ai/schemas";
import { checkPasscode, errorResponse } from "@/lib/server/http";

const SYSTEM = `あなたは家庭の食材管理を手伝うアシスタントです。写真に写っている食品を読み取り、在庫として登録する一覧を作ります。

- 写真は、冷蔵庫の中・買ってきた食品・レシート・食品のパッケージのいずれかです。
- パッケージに商品名やメーカー名が読めるときは、実際の表記どおりに書いてください（例: 「明治 おいしい牛乳 900ml」）。読めないときは一般的な名前にします（例: 「玉ねぎ」）。
- レシートの場合は、食品・調味料・飲料だけを拾い、日用品などは除きます。数量はレシートの個数を使います。
- 数量と単位は、見える範囲で現実的に見積もってください（例: 卵パック → 10個、肉のトレー → 表示の g）。
- 賞味・消費期限が読める場合だけ expiresOn に書きます。年が省略されている場合は今日の日付から推測します。
- 食品でないものは含めません。確信が持てないものは note に書いてください。`;

// AI の応答には数十秒かかることがあるため、実行時間の上限を延ばす（Vercel 無料プランの上限内）
export const maxDuration = 300;

export async function POST(req: Request) {
  try {
    checkPasscode(req);
    const parsed = PantryScanRequestSchema.safeParse(await req.json());
    if (!parsed.success) {
      return Response.json({ error: "写真のデータが正しくありません" }, { status: 400 });
    }
    const result = await generateStructured({
      system: SYSTEM,
      user: [imageBlock(parsed.data.image), { type: "text", text: `今日の日付: ${parsed.data.today}\n写真に写っている食品を在庫リストにしてください。` }],
      schema: PantryScanResultSchema,
      effort: "low",
    });
    return Response.json(result);
  } catch (err) {
    return errorResponse(err);
  }
}
