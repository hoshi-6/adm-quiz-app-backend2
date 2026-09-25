// Claude API 呼び出しの共通処理（サーバー専用）
import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import type { BetaContentBlockParam } from "@anthropic-ai/sdk/resources/beta/messages/messages";
import type { z } from "zod";
import { HttpError } from "@/lib/server/http";

export const MODEL = process.env.CLAUDE_MODEL || "claude-opus-5";

// 高速モード（出力が最大2.5倍速くなる代わりに料金が2倍）。CLAUDE_FAST_MODE=1 で有効。対応モデルのみ
const FAST_MODE_MODELS = ["claude-opus-5", "claude-opus-5-5", "claude-opus-4-8"];
const FAST_MODE = process.env.CLAUDE_FAST_MODE === "1" && FAST_MODE_MODELS.includes(MODEL);

let client: Anthropic | null = null;
function getClient() {
  if (!process.env.ANTHROPIC_API_KEY && !process.env.ANTHROPIC_AUTH_TOKEN) {
    throw new HttpError("サーバーに ANTHROPIC_API_KEY が設定されていません（README を参照）", 503);
  }
  client ??= new Anthropic();
  return client;
}

/** 画像（base64）を Claude に渡すためのブロック */
export function imageBlock(image: { mediaType: "image/jpeg" | "image/png" | "image/webp"; data: string }): BetaContentBlockParam {
  return { type: "image", source: { type: "base64", media_type: image.mediaType, data: image.data } };
}

/** system + user プロンプト（文字列、または画像を含むブロック）を送り、スキーマどおりの JSON を受け取る */
export async function generateStructured<T extends z.ZodType>(opts: {
  system: string;
  user: string | BetaContentBlockParam[];
  schema: T;
  effort?: "low" | "medium" | "high";
}): Promise<z.infer<T>> {
  const request = (fast: boolean) =>
    getClient().beta.messages.parse({
      model: MODEL,
      max_tokens: 16000,
      thinking: { type: "adaptive" },
      output_config: {
        effort: opts.effort ?? "medium",
        format: betaZodOutputFormat(opts.schema),
      },
      // 安全分類器で断られた場合、サーバー側で推奨モデルに自動で切り替える
      betas: fast ? ["server-side-fallback-2026-07-01", "fast-mode-2026-02-01"] : ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      ...(fast ? { speed: "fast" as const } : {}),
      system: opts.system,
      messages: [{ role: "user", content: opts.user }],
    });

  let response;
  try {
    try {
      response = await request(FAST_MODE);
    } catch (err) {
      // 高速モードは専用の利用枠があり、混雑時は通常モードでやり直す
      if (FAST_MODE && err instanceof Anthropic.RateLimitError) response = await request(false);
      else throw err;
    }
  } catch (err) {
    if (err instanceof Anthropic.AuthenticationError) {
      throw new HttpError("ANTHROPIC_API_KEY が正しく設定されていません", 500);
    }
    if (err instanceof Anthropic.RateLimitError) {
      throw new HttpError("AI が混み合っています。少し待ってから再度お試しください", 429);
    }
    if (err instanceof Anthropic.APIConnectionError) {
      throw new HttpError("AI サービスに接続できませんでした", 502);
    }
    if (err instanceof Anthropic.APIError) {
      console.error("Claude API error", err.status, err.message);
      throw new HttpError("AI の呼び出しに失敗しました", 502);
    }
    throw err;
  }

  if (response.stop_reason === "refusal") {
    throw new HttpError("この内容には AI が回答できませんでした", 422);
  }
  if (response.stop_reason === "max_tokens" || !response.parsed_output) {
    throw new HttpError("AI の応答を読み取れませんでした。もう一度お試しください", 502);
  }
  return response.parsed_output as z.infer<T>;
}
