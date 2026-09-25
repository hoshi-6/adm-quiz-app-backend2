// API ルート共通のエラー処理とパスコード確認（サーバー専用）
import "server-only";
import { createHash, timingSafeEqual } from "node:crypto";

export class HttpError extends Error {
  constructor(
    message: string,
    public status = 500,
  ) {
    super(message);
  }
}

function sameSecret(a: string, b: string) {
  // 長さの違いで比較時間が変わらないよう、ハッシュどうしを比べる
  const ha = createHash("sha256").update(a).digest();
  const hb = createHash("sha256").update(b).digest();
  return timingSafeEqual(ha, hb);
}

/**
 * APP_PASSCODE が設定されていれば、リクエストのパスコードを確認する。
 * requireConfigured = true のときは、APP_PASSCODE 未設定そのものをエラーにする
 * （個人データを誰でも読めるようにしないため）。
 */
export function checkPasscode(req: Request, { requireConfigured = false } = {}) {
  const expected = process.env.APP_PASSCODE;
  if (!expected) {
    if (requireConfigured) {
      throw new HttpError("サーバーに APP_PASSCODE が設定されていません（README を参照）", 503);
    }
    return;
  }
  if (!sameSecret(req.headers.get("x-app-passcode") ?? "", expected)) {
    throw new HttpError("パスコードが違います", 401);
  }
}

export function errorResponse(err: unknown) {
  if (err instanceof HttpError) {
    return Response.json({ error: err.message }, { status: err.status });
  }
  console.error(err);
  return Response.json({ error: "サーバーでエラーが発生しました" }, { status: 500 });
}
