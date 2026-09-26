import { generateStructured } from "@/lib/ai/claude";
import { checkPasscode, errorResponse } from "@/lib/server/http";
import { ConsultReplySchema, ConsultRequestSchema, type ConsultRequest } from "@/lib/ai/schemas";

// 選んだ献立を作る前・作りながらの相談に答える。材料を変えるときは献立そのものも書き直して返す
function buildSystem(r: ConsultRequest): string {
  const pantry = r.pantry.length
    ? r.pantry
        .map((p) => {
          const kind = p.category === "seasoning" ? "調味料" : "食材";
          const expiry = p.daysLeft === null ? "" : p.daysLeft < 0 ? "（期限切れ）" : `（期限まで${p.daysLeft}日）`;
          return `- [${kind}] ${p.name} ${p.quantity}${p.unit}${expiry}`;
        })
        .join("\n")
    : "（在庫の登録なし。一般的な家庭の基本調味料はあるものとする）";

  return `あなたは家庭料理に詳しい管理栄養士です。ユーザーはこれから下の献立を作ります。使う食材・分量・代用品・作り方などの相談に、短く具体的に答えてください。

方針:
- 代用品は、まず家にある食材・調味料から探してください。なければ手に入りやすいものを挙げます。
- 材料の置き換え・分量や人数の変更など、献立の内容が変わる答えのときは、updatedSuggestion に変更後の献立全体を入れてください（料理名・材料・作り方・栄養素もあわせて直す）。質問に答えるだけで献立が変わらないときは null にします。
- updatedSuggestion の pantryUsage は、在庫リストの「食材」のうち使うものを、在庫リストと同じ名前・同じ単位で書いてください（在庫量を超えないこと。調味料は含めない）。needToBuy には買い足しが必要なものを書きます。
- nutrientsPerServing は 1人前あたりの値です。日本食品標準成分表（八訂）を目安に推定してください。
- ユーザーの好み・アレルギー・苦手なものは必ず守ってください。

## 食事
${r.mealType}（${r.servings}人分）

## 好み・アレルギーなど
${r.preferences || "特になし"}

## 家にある食材・調味料
${pantry}

## いま作ろうとしている献立（JSON）
${JSON.stringify(r.suggestion)}`;
}

export const maxDuration = 300;

export async function POST(req: Request) {
  try {
    checkPasscode(req);
    const parsed = ConsultRequestSchema.safeParse(await req.json());
    if (!parsed.success) {
      return Response.json({ error: "入力内容が正しくありません" }, { status: 400 });
    }
    const result = await generateStructured({
      system: buildSystem(parsed.data),
      messages: parsed.data.messages,
      schema: ConsultReplySchema,
      effort: "low",
    });
    return Response.json(result);
  } catch (err) {
    return errorResponse(err);
  }
}
