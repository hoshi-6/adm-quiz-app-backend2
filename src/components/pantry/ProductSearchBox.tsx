"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { useState, type FormEvent } from "react";
import { db, updatePantryItem } from "@/lib/db";
import { normalize, searchFoods } from "@/lib/foods";
import { toast } from "@/lib/toast";
import { cx } from "../ui";

/**
 * 在庫登録の検索窓。入力すると候補を出す：
 * - 「◯◯」を AI で調べて登録
 * - すでに在庫にある商品（＋1 ですぐ増やせる）
 * - よく使う食材の候補（選ぶと AI で調べる）
 */
export function ProductSearchBox({ onSearch, disabled }: { onSearch: (text: string) => void; disabled?: boolean }) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const stock = useLiveQuery(() => db.pantry.toArray(), []);

  const query = normalize(q);
  const inStock = query ? (stock ?? []).filter((i) => normalize(i.name).includes(query)).slice(0, 3) : [];
  const foods = q.trim() ? searchFoods(q, undefined, 5).filter((f) => !inStock.some((i) => i.name === f.name)) : [];
  const show = open && q.trim().length > 0 && !disabled;

  function run(text: string) {
    if (!text.trim() || disabled) return;
    setOpen(false);
    onSearch(text.trim());
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    run(q);
  }

  return (
    <form onSubmit={submit} className="relative" role="search">
      <div className="flex h-11 items-center gap-2 rounded-full border border-line bg-surface px-4 focus-within:border-brand focus-within:ring-2 focus-within:ring-brand/20">
        <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0 text-muted" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden>
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.5-3.5" />
        </svg>
        <input
          type="search"
          enterKeyHint="search"
          autoComplete="off"
          value={q}
          disabled={disabled}
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          placeholder="商品名で検索（例: ポテトチップス 2袋）"
          aria-label="登録したい商品"
          className="min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-muted md:text-sm [&::-webkit-search-cancel-button]:hidden"
        />
        {q && (
          <button type="button" className="shrink-0 rounded-full px-1 text-muted" aria-label="入力を消す" onMouseDown={(e) => e.preventDefault()} onClick={() => setQ("")}>
            ✕
          </button>
        )}
      </div>

      {show && (
        <ul className="absolute inset-x-0 top-full z-30 mt-1 max-h-80 overflow-auto rounded-2xl border border-line bg-surface py-1 shadow-lg" role="listbox">
          <li>
            <button type="button" className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm hover:bg-subtle" onMouseDown={(e) => e.preventDefault()} onClick={() => run(q)}>
              <span className="font-medium text-brand">「{q.trim()}」をAIで調べて登録</span>
            </button>
          </li>
          {inStock.length > 0 && <li className="px-4 pb-1 pt-2 text-xs font-semibold text-muted">在庫にあるもの</li>}
          {inStock.map((i) => (
            <li key={i.id} className="flex items-center justify-between gap-2 px-4 py-2 text-sm">
              <span className="min-w-0 truncate">
                {i.name}
                <span className="ml-2 text-xs text-muted">
                  残り {i.quantity}
                  {i.unit}
                </span>
              </span>
              <button
                type="button"
                className="shrink-0 rounded-full border border-brand px-3 py-1 text-xs text-brand"
                onMouseDown={(e) => e.preventDefault()}
                onClick={async () => {
                  const step = ["g", "ml"].includes(i.unit) ? 100 : 1;
                  await updatePantryItem(i.id!, { quantity: Math.round((i.quantity + step) * 100) / 100 });
                  toast(`${i.name}を${step}${i.unit}増やしました`);
                }}
              >
                ＋{["g", "ml"].includes(i.unit) ? 100 : 1}
                {i.unit}
              </button>
            </li>
          ))}
          {foods.length > 0 && <li className="px-4 pb-1 pt-2 text-xs font-semibold text-muted">候補</li>}
          {foods.map((f) => (
            <li key={f.name}>
              <button
                type="button"
                className={cx("flex w-full items-center justify-between gap-2 px-4 py-2 text-left text-sm hover:bg-subtle")}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  setQ(f.name);
                  run(f.name);
                }}
              >
                <span>{f.name}</span>
                <span className="text-xs text-muted">{f.group}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </form>
  );
}
