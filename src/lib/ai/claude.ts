// Claude API 呼び出しの共通処理（サーバー専用）
import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import type { z } from "zod";

export const MODEL = process.env.CLAUDE_MODEL || "claude-opus-5";

let client: Anthropic | null = null;
function getClient() {
  if (!process.env.ANTHROPIC_API_KEY && !process.env.ANTHROPIC_AUTH_TOKEN) {
    throw new AiError("サーバーに ANTHROPIC_API_KEY が設定されていません（README を参照）", 503);
  }
  client ??= new Anthropic();
  return client;
}

export class AiError extends Error {
  constructor(
    message: string,
    public status = 500,
  ) {
    super(message);
  }
}

/** system + user プロンプトを送り、スキーマどおりの JSON を受け取る */
export async function generateStructured<T extends z.ZodType>(opts: {
  system: string;
  user: string;
  schema: T;
  effort?: "low" | "medium" | "high";
}): Promise<z.infer<T>> {
  let response;
  try {
    response = await getClient().beta.messages.parse({
      model: MODEL,
      max_tokens: 16000,
      thinking: { type: "adaptive" },
      output_config: {
        effort: opts.effort ?? "medium",
        format: betaZodOutputFormat(opts.schema),
      },
      // 安全分類器で断られた場合、サーバー側で推奨モデルに自動で切り替える
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      system: opts.system,
      messages: [{ role: "user", content: opts.user }],
    });
  } catch (err) {
    if (err instanceof Anthropic.AuthenticationError) {
      throw new AiError("ANTHROPIC_API_KEY が正しく設定されていません", 500);
    }
    if (err instanceof Anthropic.RateLimitError) {
      throw new AiError("AI が混み合っています。少し待ってから再度お試しください", 429);
    }
    if (err instanceof Anthropic.APIConnectionError) {
      throw new AiError("AI サービスに接続できませんでした", 502);
    }
    if (err instanceof Anthropic.APIError) {
      console.error("Claude API error", err.status, err.message);
      throw new AiError("AI の呼び出しに失敗しました", 502);
    }
    throw err;
  }

  if (response.stop_reason === "refusal") {
    throw new AiError("この内容には AI が回答できませんでした", 422);
  }
  if (response.stop_reason === "max_tokens" || !response.parsed_output) {
    throw new AiError("AI の応答を読み取れませんでした。もう一度お試しください", 502);
  }
  return response.parsed_output as z.infer<T>;
}

/** APP_PASSCODE が設定されている場合のみ、リクエストのパスコードを確認する */
export function checkPasscode(req: Request) {
  const expected = process.env.APP_PASSCODE;
  if (!expected) return;
  if (req.headers.get("x-app-passcode") !== expected) {
    throw new AiError("パスコードが違います（設定画面で入力してください）", 401);
  }
}

export function errorResponse(err: unknown) {
  if (err instanceof AiError) {
    return Response.json({ error: err.message }, { status: err.status });
  }
  console.error(err);
  return Response.json({ error: "サーバーでエラーが発生しました" }, { status: 500 });
}
