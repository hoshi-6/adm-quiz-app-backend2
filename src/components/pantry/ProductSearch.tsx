"use client";

import { useState, type FormEvent } from "react";
import type { Product } from "@/app/api/products/route";
import { getPasscode } from "@/lib/sync";
import { Button, ErrorNote, Input, Spinner } from "../ui";

/** 実在する市販品を、商品名やバーコードの数字で探す */
export function ProductSearch({ initialQuery, onPick, onClose }: { initialQuery: string; onPick: (p: Product) => void; onClose: () => void }) {
  const [q, setQ] = useState(initialQuery);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<Product[] | null>(null);

  async function search(e?: FormEvent) {
    e?.preventDefault();
    if (!q.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const passcode = getPasscode();
      const res = await fetch(`/api/products?q=${encodeURIComponent(q.trim())}`, {
        headers: passcode ? { "x-app-passcode": passcode } : {},
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "検索できませんでした");
      setResults(data.products);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mt-3 rounded-xl border border-line bg-bg/60 p-3">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-sm font-medium">市販の商品を探す</p>
        <button type="button" className="text-sm text-muted" onClick={onClose}>
          閉じる
        </button>
      </div>
      <form onSubmit={search} className="flex gap-2">
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="商品名・メーカー名、またはバーコードの数字" enterKeyHint="search" />
        <Button type="submit" disabled={loading || !q.trim()} className="shrink-0">
          {loading ? <Spinner /> : "検索"}
        </Button>
      </form>
      <p className="mt-1 text-xs text-muted">世界の食品データベース（Open Food Facts）から探します。日本の商品は登録が少なめです。見つからないときは、パッケージの写真から追加するのが確実です。</p>
      <div className="mt-2">
        <ErrorNote message={error} />
      </div>
      {results && results.length === 0 && <p className="py-3 text-center text-sm text-muted">見つかりませんでした</p>}
      {results && results.length > 0 && (
        <ul className="mt-2 max-h-80 divide-y divide-line overflow-auto rounded-xl border border-line bg-surface">
          {results.map((p) => (
            <li key={p.code + p.name}>
              <button type="button" className="w-full px-3 py-2 text-left hover:bg-subtle" onClick={() => onPick(p)}>
                <span className="block text-sm font-medium">{p.name}</span>
                <span className="block text-xs text-muted">{[p.brand, p.quantity].filter(Boolean).join("・") || "—"}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
