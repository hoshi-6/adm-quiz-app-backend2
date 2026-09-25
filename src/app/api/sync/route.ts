import { checkPasscode, errorResponse } from "@/lib/server/http";
import { databaseUrl, sync } from "@/lib/server/store";
import { SyncRequestSchema, type SyncResponse } from "@/lib/sync-schema";

export async function POST(req: Request) {
  try {
    const cloud = Boolean(databaseUrl());
    // クラウドに個人データを置く場合はパスコードを必須にする
    checkPasscode(req, { requireConfigured: cloud });
    if (!cloud) return Response.json({ enabled: false } satisfies SyncResponse);

    const parsed = SyncRequestSchema.safeParse(await req.json());
    if (!parsed.success) {
      return Response.json({ error: "同期データの形式が正しくありません" }, { status: 400 });
    }
    const result = await sync(parsed.data.since, parsed.data.changes);
    return Response.json({ enabled: true, ...result } satisfies SyncResponse);
  } catch (err) {
    return errorResponse(err);
  }
}
