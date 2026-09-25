// クラウド側のデータ保存（PostgreSQL）。在庫・食事・設定を 1 つのテーブルに JSON で保存する。
// 変更ごとに連番 seq を振り、各端末は「前回の seq 以降の変更」を受け取って同期する。
import "server-only";
import postgres from "postgres";
import { PULL_LIMIT, type SyncChange } from "@/lib/sync-schema";

/** Vercel の Neon 連携は DATABASE_URL（または POSTGRES_URL）を自動で設定する */
export function databaseUrl() {
  return process.env.DATABASE_URL || process.env.POSTGRES_URL || "";
}

let sql: postgres.Sql | null = null;
let ready: Promise<void> | null = null;

function getSql() {
  // prepare: false は、Neon などの接続プーラー（PgBouncer）経由でも動かすため
  sql ??= postgres(databaseUrl(), { max: 3, idle_timeout: 20, prepare: false, onnotice: () => {} });
  // 初回だけテーブルを作る（手動で SQL を実行しなくてよいように）
  ready ??= (async () => {
    await sql!`create sequence if not exists gohan_seq`;
    await sql!`
      create table if not exists gohan_records (
        collection text not null,
        uid text not null,
        data jsonb,
        updated_at bigint not null,
        deleted boolean not null default false,
        seq bigint not null default nextval('gohan_seq'),
        primary key (collection, uid)
      )`;
    await sql!`create index if not exists gohan_records_seq on gohan_records (seq)`;
  })().catch((err) => {
    ready = null;
    throw err;
  });
  return { sql, ready };
}

export async function sync(since: number, changes: SyncChange[]) {
  const { sql, ready } = getSql();
  await ready;

  if (changes.length) {
    // 同じレコードが複数あれば新しいものだけ残す
    const latest = new Map<string, SyncChange>();
    for (const c of changes) {
      const key = `${c.collection}:${c.uid}`;
      const prev = latest.get(key);
      if (!prev || prev.updatedAt <= c.updatedAt) latest.set(key, c);
    }
    const rows = [...latest.values()].map((c) => ({
      collection: c.collection,
      uid: c.uid,
      data: c.deleted ? null : c.data,
      updated_at: Math.round(c.updatedAt),
      deleted: c.deleted,
    }));

    await sql.begin(async (tx) => {
      // 書き込みを直列化して、seq の順番とコミットの順番を一致させる（取りこぼし防止）
      await tx`select pg_advisory_xact_lock(724001)`;
      // 新しい方の変更を残す（後から来た古い変更では上書きしない）
      await tx`
        insert into gohan_records (collection, uid, data, updated_at, deleted)
        select collection, uid, data, updated_at, deleted
        from jsonb_to_recordset(${JSON.stringify(rows)}::text::jsonb)
          as x(collection text, uid text, data jsonb, updated_at bigint, deleted boolean)
        on conflict (collection, uid) do update set
          data = excluded.data,
          updated_at = excluded.updated_at,
          deleted = excluded.deleted,
          seq = excluded.seq
        where gohan_records.updated_at <= excluded.updated_at`;
    });
  }

  // クラウド側が作り直されていたら、最初から取り直す
  const [{ max }] = await sql<{ max: number }[]>`select coalesce(max(seq), 0)::float8 as max from gohan_records`;
  const reset = since > max;
  const from = reset ? 0 : since;

  const found = await sql<{ collection: SyncChange["collection"]; uid: string; data: Record<string, unknown> | null; updated_at: number; deleted: boolean; seq: number }[]>`
    select collection, uid, data, updated_at::float8 as updated_at, deleted, seq::float8 as seq
    from gohan_records
    where seq > ${from}
    order by seq
    limit ${PULL_LIMIT}`;

  return {
    changes: found.map((r) => ({ collection: r.collection, uid: r.uid, data: r.data, updatedAt: r.updated_at, deleted: r.deleted })),
    seq: found.length ? found[found.length - 1].seq : from,
    hasMore: found.length === PULL_LIMIT,
    reset,
  };
}
