// /api/sync のリクエスト・レスポンス（クライアントとサーバーで共有）
import { z } from "zod";

export const MAX_PUSH = 500;
export const PULL_LIMIT = 500;

export const SyncChangeSchema = z.object({
  collection: z.enum(["pantry", "meals", "settings"]),
  uid: z.string().min(1).max(64),
  updatedAt: z.number(),
  deleted: z.boolean(),
  /** 削除時は null */
  data: z.record(z.string(), z.unknown()).nullable(),
});
export type SyncChange = z.infer<typeof SyncChangeSchema>;

export const SyncRequestSchema = z.object({
  /** 前回までに受け取った変更の位置 */
  since: z.number().int().min(0),
  changes: z.array(SyncChangeSchema).max(MAX_PUSH),
});
export type SyncRequest = z.infer<typeof SyncRequestSchema>;

export type SyncResponse =
  | { enabled: false }
  | {
      enabled: true;
      /** since より新しい変更（他の端末の変更を含む） */
      changes: SyncChange[];
      /** 次回の since */
      seq: number;
      /** まだ受け取っていない変更が残っている */
      hasMore: boolean;
      /** クラウド側がリセットされていた。端末は since=0 から取り直している */
      reset: boolean;
    };
