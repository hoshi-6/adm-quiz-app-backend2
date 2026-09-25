import { generateWithWebSearch, imageBlock } from "@/lib/ai/claude";
import { PantryScanRequestSchema, PantryScanResultSchema } from "@/lib/ai/schemas";
import { checkPasscode, errorResponse } from "@/lib/server/http";

const SYSTEM = `あなたは家庭の食材管理を手伝うアシスタントです。写真または文章から在庫に登録する商品を特定し、最後に必ず record_pantry ツールで一覧を記録します。

商品の特定:
- 写真は、冷蔵庫の中・買ってきた食品・パッケージ・レシートのいずれかです。
- 市販品は、パッケージの表記やレシートの品名をもとに web_search で実在の商品を確認し、正式な「メーカー名 商品名」、1つあたりの内容量、栄養成分表示を調べてください（basis=web、source に URL）。
- 写真に栄養成分表示や内容量が写っていれば、その値を優先します（basis=label）。
- 生鮮品（野菜・肉・魚・卵など）や一般的な食材は検索せず、日本食品標準成分表（八訂）の値を使います（basis=estimate、100g あたり、または 1個あたり）。
- レシートの場合は、食品・調味料・飲料だけを拾い、日用品などは除きます。

在庫の数え方（あとで「1袋使った」「10g使った」と減らしやすくするため）:
- 袋・箱・個・本・缶・パックなど、実際に数えられる単位で数量を書きます（例: ポテトチップス 2袋、卵 10個、牛乳 1本）。
- その単位 1つあたりの内容量を unitSize に書きます（例: 1袋 60g、1本 1000ml、卵 1個 約50g）。
- 肉・魚のトレーなど重さで使うものは unit を g にして、表示の重さを数量にします（unitSize は null）。

その他:
- 賞味・消費期限が読める場合だけ expiresOn に書きます。年が省略されていれば今日の日付から推測します。
- 表示にないビタミン・ミネラルは、原材料から推定して埋めます。
- 確信が持てない点や、公式の表示が見つからなかった商品は note に書きます。`;

// AI の応答には数十秒かかることがあるため、実行時間の上限を延ばす（Vercel 無料プランの上限内）
export const maxDuration = 300;

export async function POST(req: Request) {
  try {
    checkPasscode(req);
    const parsed = PantryScanRequestSchema.safeParse(await req.json());
    if (!parsed.success) {
      return Response.json({ error: "写真または文章が正しくありません" }, { status: 400 });
    }
    const { image, text, today } = parsed.data;
    const prompt = `今日の日付: ${today}\n${text?.trim() ? `登録したいもの: ${text.trim()}` : "写真に写っている食品を在庫リストにしてください。"}`;
    const result = await generateWithWebSearch({
      system: SYSTEM,
      user: image ? [imageBlock(image), { type: "text", text: prompt }] : prompt,
      schema: PantryScanResultSchema,
      toolName: "record_pantry",
      toolDescription: "在庫に登録する商品の一覧を記録する。調べ終わったら最後に必ず1回だけ呼ぶ。",
      maxSearches: 5,
      effort: "low",
    });
    return Response.json(result);
  } catch (err) {
    return errorResponse(err);
  }
}
