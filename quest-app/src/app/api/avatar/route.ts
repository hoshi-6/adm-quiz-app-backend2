// 写真から主人公の見た目（髪型・色・服・武器）を選ぶ。写真は保存しない。
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import { EYE_COLORS, HAIR_COLORS, HAIR_STYLES, OUTFITS, OUTFIT_COLORS, SKIN_COLORS, WEAPONS } from "@/lib/avatar";

export const maxDuration = 60;

const MODEL = process.env.CLAUDE_MODEL || "claude-opus-5-5";

const keys = <T extends object>(o: T) => Object.keys(o) as [Extract<keyof T, string>, ...Extract<keyof T, string>[]];
const label = (o: Record<string, string | { name: string }>) =>
  Object.entries(o)
    .map(([k, v]) => `${k}=${typeof v === "string" ? v : v.name}`)
    .join(", ");

const Result = z.object({
  found: z.boolean().describe("写真に人物がはっきり写っていれば true"),
  hairStyle: z.enum(keys(HAIR_STYLES)),
  hairColor: z.enum(keys(HAIR_COLORS)),
  skinColor: z.enum(keys(SKIN_COLORS)),
  eyeColor: z.enum(keys(EYE_COLORS)),
  outfit: z.enum(keys(OUTFITS)),
  outfitColor: z.enum(keys(OUTFIT_COLORS)),
  glasses: z.boolean(),
  beard: z.boolean(),
  weapon: z.enum(keys(WEAPONS)),
  comment: z.string().describe("どんなキャラクターにしたかを日本語で1文（40字以内）"),
});

const SYSTEM = `あなたはダークファンタジーRPGのキャラクターデザイナーです。
送られた写真の人物の見た目をもとに、ドット絵の主人公の部品を選んでください。
人物が誰かを特定したり、名前や属性を推測したりはしません。見た目（髪型・髪色・肌の色味・目の色・眼鏡・ひげ・服装の色や雰囲気）だけを使います。

選べる部品:
- hairStyle: ${label(HAIR_STYLES)}
- hairColor: ${label(HAIR_COLORS)}
- skinColor: ${label(SKIN_COLORS)}
- eyeColor: ${label(EYE_COLORS)}（写真で判別しにくいときは髪や雰囲気に合う色）
- outfit: ${label(OUTFITS)}
- outfitColor: ${label(OUTFIT_COLORS)}（写真の服の色に近い、暗めの色）
- weapon: ${label(WEAPONS)}（雰囲気に合うもの）

写真に人物が写っていない、または判別できないときは found を false にし、ほかの項目は無難な値にしてください。`;

const MEDIA = ["image/jpeg", "image/png", "image/webp"] as const;
const Body = z.object({ image: z.string().min(100).max(8_000_000), mediaType: z.enum(MEDIA), passcode: z.string().optional() });

let client: Anthropic | null = null;

export async function POST(req: Request) {
  if (!process.env.ANTHROPIC_API_KEY && !process.env.ANTHROPIC_AUTH_TOKEN) {
    return Response.json({ error: "サーバーに ANTHROPIC_API_KEY が設定されていません（README を参照）" }, { status: 503 });
  }
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "画像を読み取れませんでした" }, { status: 400 });
  const { image, mediaType, passcode } = parsed.data;
  // 誰でも AI を使えてしまわないよう、APP_PASSCODE を設定したときは合言葉を確かめる
  if (process.env.APP_PASSCODE && passcode !== process.env.APP_PASSCODE) {
    return Response.json({ error: "合言葉が違います", needPasscode: true }, { status: 401 });
  }

  client ??= new Anthropic({ maxRetries: 3 });
  try {
    const response = await client.beta.messages.parse({
      model: MODEL,
      max_tokens: 4000,
      thinking: { type: "adaptive" },
      output_config: { effort: "low", format: betaZodOutputFormat(Result) },
      // 安全分類器で断られた場合、サーバー側で推奨モデルに自動で切り替える
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      system: SYSTEM,
      messages: [
        {
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: mediaType, data: image } },
            { type: "text", text: "この写真の人物をもとに、主人公の部品を選んでください。" },
          ],
        },
      ],
    });
    if (response.stop_reason === "refusal") return Response.json({ error: "この写真からはキャラクターを作れませんでした" }, { status: 422 });
    const out = response.parsed_output;
    if (!out) return Response.json({ error: "AI の応答を読み取れませんでした。もう一度お試しください" }, { status: 502 });
    if (!out.found) return Response.json({ error: "写真から人物を見つけられませんでした。顔がはっきり写った写真でお試しください" }, { status: 422 });
    const { found: _found, comment, ...avatar } = out;
    return Response.json({ avatar, comment });
  } catch (err) {
    if (err instanceof Anthropic.RateLimitError) return Response.json({ error: "AI が混み合っています。少し待ってからお試しください" }, { status: 429 });
    if (err instanceof Anthropic.AuthenticationError) return Response.json({ error: "API キーが正しくありません" }, { status: 503 });
    if (err instanceof Anthropic.APIError) return Response.json({ error: `AI の呼び出しに失敗しました（${err.status ?? "?"}）` }, { status: 502 });
    return Response.json({ error: "AI の呼び出しに失敗しました" }, { status: 502 });
  }
}
