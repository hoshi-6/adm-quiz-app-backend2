"use client";

import { useState } from "react";
import { toast } from "@/lib/toast";
import type { PantryScanResult } from "@/lib/ai/schemas";
import { addToPantry, todayStr } from "@/lib/db";
import { callApi } from "@/lib/hooks";
import { imageFileToInput } from "@/lib/image";
import { PhotoButton } from "../PhotoButton";
import { Button, ErrorNote, Input, NumberInput, Select, Spinner } from "../ui";

type Row = PantryScanResult["items"][number] & { checked: boolean };

/** 冷蔵庫・買ってきた食品・レシートなどの写真から、在庫の候補を読み取って登録する */
export function PhotoImport() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<Row[] | null>(null);
  const [note, setNote] = useState("");
  const [preview, setPreview] = useState<string | null>(null);

  async function analyze(file: File) {
    setLoading(true);
    setError(null);
    setRows(null);
    try {
      const image = await imageFileToInput(file);
      setPreview(`data:${image.mediaType};base64,${image.data}`);
      const res = await callApi<PantryScanResult>("/api/pantry-scan", { image, today: todayStr() });
      setRows(res.items.map((i) => ({ ...i, checked: true })));
      setNote(res.note);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  const update = (i: number, patch: Partial<Row>) => setRows((rs) => rs && rs.map((r, j) => (j === i ? { ...r, ...patch } : r)));

  async function save() {
    if (!rows) return;
    const picked = rows.filter((r) => r.checked && r.name.trim());
    await addToPantry(
      picked.map((r) => ({
        name: r.name.trim(),
        category: r.category,
        quantity: r.quantity,
        unit: r.unit.trim() || "個",
        expiresOn: r.expiresOn || undefined,
      })),
    );
    setRows(null);
    setPreview(null);
    toast(`${picked.length}件を在庫に追加しました`);
  }

  const count = rows?.filter((r) => r.checked).length ?? 0;

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <PhotoButton onFile={analyze} disabled={loading}>
          写真から追加
        </PhotoButton>
        {loading && (
          <span className="flex items-center gap-2 text-sm text-muted">
            <Spinner /> 写真を読み取っています…
          </span>
        )}
        {!loading && !rows && <span className="text-xs text-muted">冷蔵庫の中・買ってきた食品・パッケージ・レシートを撮ると、まとめて登録できます</span>}
      </div>
      <div className="mt-2">
        <ErrorNote message={error} />
      </div>

      {rows && (
        <div className="mt-3 rounded-xl border border-line p-3">
          <div className="mb-3 flex items-start gap-3">
            {preview && (
              // eslint-disable-next-line @next/next/no-img-element -- 端末内の写真のプレビュー
              <img src={preview} alt="読み取った写真" className="h-16 w-16 shrink-0 rounded-lg object-cover" />
            )}
            <div className="text-sm">
              <p className="font-medium">{rows.length}件 見つかりました。内容を確認して追加してください。</p>
              {note && <p className="mt-1 text-xs text-muted">※ {note}</p>}
            </div>
          </div>
          {rows.length > 0 && (
            <ul className="space-y-3">
              {rows.map((r, i) => (
                <li key={i} className="grid grid-cols-[auto_1fr] gap-x-2 gap-y-1.5">
                  <input
                    type="checkbox"
                    className="mt-2.5 h-4 w-4 accent-[var(--brand)]"
                    checked={r.checked}
                    onChange={(e) => update(i, { checked: e.target.checked })}
                    aria-label={`${r.name}を追加する`}
                  />
                  <Input value={r.name} onChange={(e) => update(i, { name: e.target.value })} aria-label="名前" />
                  <div className="col-start-2 grid grid-cols-[4.5rem_4.5rem_1fr] gap-1.5 md:grid-cols-[5rem_5rem_7rem_1fr]">
                    <NumberInput min={0} value={r.quantity} onValueChange={(quantity) => update(i, { quantity })} aria-label="数量" />
                    <Input value={r.unit} onChange={(e) => update(i, { unit: e.target.value })} aria-label="単位" />
                    <Select value={r.category} onChange={(e) => update(i, { category: e.target.value as Row["category"] })} aria-label="種類">
                      <option value="ingredient">食材</option>
                      <option value="seasoning">調味料</option>
                    </Select>
                    <Input
                      type="date"
                      className="col-span-3 md:col-span-1"
                      value={r.expiresOn ?? ""}
                      onChange={(e) => update(i, { expiresOn: e.target.value || null })}
                      aria-label="期限"
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
          <div className="mt-3 flex gap-2">
            <Button onClick={save} disabled={count === 0}>
              {count}件を在庫に追加
            </Button>
            <Button variant="ghost" onClick={() => setRows(null)}>
              やめる
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
