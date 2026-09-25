import { generateStructured } from "@/lib/ai/claude";
import { checkPasscode, errorResponse } from "@/lib/server/http";
import { SUGGEST_STYLES, SuggestRequestSchema, SuggestionSchema, type SuggestRequest } from "@/lib/ai/schemas";

// 3案を並行して作るため、1回の呼び出しでは1案だけを作る（料理の方向性は案ごとに変える）
const SYSTEM = `あなたは家庭料理に詳しい管理栄養士です。家にある食材・調味料と、今日の栄養摂取状況をもとに、次の食事の献立を1案提案します。

方針:
- 今日不足している栄養素を優先して補い、上限を超えている栄養素（食塩など）は控えめにしてください。
- できるだけ家にある食材・調味料で作れるものにし、買い足しは最小限にしてください。
- pantryUsage には、在庫リストの「食材」のうち使うものを、在庫リストと同じ名前・同じ単位で、指定人数分の使用量を書いてください（在庫量を超えないこと）。調味料は含めません。
- 賞味期限が近い食材を優先するよう指示された場合は、それを積極的に使ってください。
- ユーザーの好み・アレルギー・苦手なものは必ず守ってください。
- 指定された料理の方向性に沿ってください。ただしユーザーのリクエストと合わない場合は、リクエストを優先します。
- 栄養素の数値は日本食品標準成分表（八訂）を目安に、1人前あたりで推定してください。`;

function buildPrompt(r: SuggestRequest): string {
  const pantry = r.pantry.length
    ? r.pantry
        .map((p) => {
          const kind = p.category === "seasoning" ? "調味料" : "食材";
          const expiry =
            p.daysLeft === null ? "" : p.daysLeft < 0 ? "（期限切れ）" : `（期限まで${p.daysLeft}日）`;
          return `- [${kind}] ${p.name} ${p.quantity}${p.unit}${expiry}`;
        })
        .join("\n")
    : "（在庫の登録なし。一般的な家庭の基本調味料はあるものとする）";

  const status = r.status
    .map((s) => {
      const pct = s.target ? Math.round((s.intake / s.target) * 100) : 0;
      const note = s.kind === "max" ? "上限" : "目標";
      return `- ${s.label}: ${s.intake}${s.unit} / ${note} ${s.target}${s.unit}（${pct}%）`;
    })
    .join("\n");

  return `## 提案してほしい食事
${r.mealType}（${r.servings}人分、調理時間 ${r.maxMinutes}分以内）
${r.prioritizeExpiring ? "賞味期限が近い食材を優先して使ってください。" : ""}
${r.request ? `追加のリクエスト: ${r.request}` : ""}

## 好み・アレルギーなど
${r.preferences || "特になし"}

## 今日すでに食べたもの
${r.eatenToday.length ? r.eatenToday.map((e) => `- ${e}`).join("\n") : "（まだ記録なし）"}

## 今日の栄養摂取状況（1日の目標に対して）
${status}

## 家にある食材・調味料
${pantry}

## 今回の料理の方向性
${SUGGEST_STYLES[r.style]}`;
}

// AI の応答には数十秒かかることがあるため、実行時間の上限を延ばす（Vercel 無料プランの上限内）
export const maxDuration = 300;

export async function POST(req: Request) {
  try {
    checkPasscode(req);
    const parsed = SuggestRequestSchema.safeParse(await req.json());
    if (!parsed.success) {
      return Response.json({ error: "入力内容が正しくありません" }, { status: 400 });
    }
    const result = await generateStructured({
      system: SYSTEM,
      user: buildPrompt(parsed.data),
      schema: SuggestionSchema,
      effort: "medium",
    });
    return Response.json(result);
  } catch (err) {
    return errorResponse(err);
  }
}
