"use client";

import { useState } from "react";
import type { ImageInput, PantryScanResult } from "@/lib/ai/schemas";
import { addToPantry, todayStr, type ItemNutrition } from "@/lib/db";
import { callApi } from "@/lib/hooks";
import { imageFileToInput } from "@/lib/image";
import { completeNutrients, fmt } from "@/lib/nutrients";
import { perLabel } from "@/lib/portion";
import { toast } from "@/lib/toast";
import { PhotoButton } from "../PhotoButton";
import { ProductImage } from "./ProductImage";
import { ProductSearchBox } from "./ProductSearchBox";
import { Badge, Button, DateField, ErrorNote, Input, NumberInput, OptionalNumberInput, ProgressText, Select } from "../ui";

type Row = PantryScanResult["items"][number] & {
  checked: boolean;
  imageUrl?: string | null;
  /** 「違う商品」で探し直すときの入力欄を開いているか */
  fixing?: boolean;
  fixText?: string;
  refinding?: boolean;
};

export function toItemNutrition(n: PantryScanResult["items"][number]["nutrition"] | null | undefined): ItemNutrition | null {
  if (!n || !(n.perAmount > 0)) return null;
  return { per: { amount: n.perAmount, unit: n.perUnit }, nutrients: completeNutrients(n.nutrients), basis: n.basis, source: n.source };
}

export function BasisBadge({ basis, source }: { basis: ItemNutrition["basis"]; source: string | null }) {
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      {basis === "web" && <Badge tone="good">公式サイトの表示</Badge>}
      {basis === "label" && <Badge tone="good">パッケージの表示</Badge>}
      {basis === "estimate" && <Badge>成分表からの推定</Badge>}
      {source && /^https?:\/\//.test(source) && (
        <a href={source} target="_blank" rel="noopener noreferrer" className="text-xs text-brand underline">
          出典
        </a>
      )}
    </span>
  );
}

function NutritionSummary({ n }: { n: ItemNutrition | null }) {
  if (!n) return <p className="col-start-2 text-xs text-muted">栄養成分: 見つかりませんでした（あとで在庫から調べられます）</p>;
  return (
    <div className="col-start-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
      <BasisBadge basis={n.basis} source={n.source} />
      <span>
        {perLabel(n)} {fmt(n.nutrients.energy, "energy")}kcal・たんぱく質 {fmt(n.nutrients.protein, "protein")}g・脂質 {fmt(n.nutrients.fat, "fat")}g・炭水化物{" "}
        {fmt(n.nutrients.carbs, "carbs")}g
      </span>
    </div>
  );
}

/**
 * 商品名の文章や、冷蔵庫・パッケージ・レシートの写真から、AI が実在の商品を調べて在庫の候補にする。
 * 内容量と栄養成分も一緒に持たせるので、あとで「1袋使った」「10g使った」を記録できる。
 */
export function PhotoImport() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<Row[] | null>(null);
  const [note, setNote] = useState("");
  const [preview, setPreview] = useState<string | null>(null);

  async function analyze(input: { image?: ImageInput; text?: string }) {
    setLoading(true);
    setError(null);
    setRows(null);
    try {
      const res = await callApi<PantryScanResult>("/api/pantry-scan", { ...input, today: todayStr() });
      setRows(res.items.map((i) => ({ ...i, checked: true })));
      setNote(res.note);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function fromPhoto(file: File) {
    try {
      const image = await imageFileToInput(file);
      setPreview(`data:${image.mediaType};base64,${image.data}`);
      await analyze({ image });
    } catch (err) {
      setError((err as Error).message);
    }
  }

  function fromText(text: string) {
    setPreview(null);
    void analyze({ text });
  }

  /** 見つかった商品が違っていたとき、その行だけ探し直す */
  async function refind(i: number) {
    const row = rows?.[i];
    if (!row?.fixText?.trim()) return;
    update(i, { refinding: true });
    try {
      const res = await callApi<PantryScanResult>("/api/pantry-scan", {
        text: `${row.fixText.trim()} ${row.quantity}${row.unit}`,
        exclude: row.name,
        today: todayStr(),
      });
      const found = res.items[0];
      if (!found) throw new Error("見つかりませんでした。名前を変えて試してください");
      setRows((rs) => rs && rs.map((x, j) => (j === i ? { ...found, checked: true, imageUrl: null } : x)));
      toast("探し直しました");
    } catch (err) {
      update(i, { refinding: false });
      toast((err as Error).message, "error");
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
        unitSize: r.unitSize && r.unitSize.amount > 0 ? r.unitSize : null,
        nutrition: toItemNutrition(r.nutrition),
        imageUrl: r.imageUrl ?? null,
      })),
    );
    setRows(null);
    setPreview(null);
    toast(`${picked.length}件を在庫に追加しました`);
  }

  const count = rows?.filter((r) => r.checked).length ?? 0;

  return (
    <div>
      <p className="mb-2 text-sm font-medium">AIで調べて登録</p>
      <ProductSearchBox onSearch={fromText} disabled={loading} />
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <PhotoButton onFile={fromPhoto} disabled={loading}>
          写真から
        </PhotoButton>
        {loading ? (
          <ProgressText steps={["商品を探しています…", "公式の栄養成分表示を確認しています…", "内容量と栄養成分をまとめています…", "もうすぐ終わります…"]} />
        ) : (
          !rows && <span className="text-xs text-muted">パッケージ・冷蔵庫の中・レシートを撮ると、商品名・内容量・栄養成分をまとめて調べます</span>
        )}
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
          <ul className="space-y-4">
            {rows.map((r, i) => (
              <li key={i} className="grid grid-cols-[auto_1fr] gap-x-2 gap-y-1.5">
                <input
                  type="checkbox"
                  className="mt-2.5 h-4 w-4 accent-[var(--brand)]"
                  checked={r.checked}
                  onChange={(e) => update(i, { checked: e.target.checked })}
                  aria-label={`${r.name}を追加する`}
                />
                <div className="flex items-start gap-2">
                  <ProductImage key={r.nutrition?.source ?? "none"} source={r.nutrition?.source} size="sm" onResolved={(imageUrl) => update(i, { imageUrl })} />
                  <Input value={r.name} onChange={(e) => update(i, { name: e.target.value })} aria-label="商品名" />
                </div>
                <div className="col-start-2 grid grid-cols-[4.5rem_4.5rem_1fr] gap-1.5">
                  <NumberInput min={0} value={r.quantity} onValueChange={(quantity) => update(i, { quantity })} aria-label="数量" />
                  <Input value={r.unit} onChange={(e) => update(i, { unit: e.target.value })} aria-label="単位" />
                  <Select value={r.category} onChange={(e) => update(i, { category: e.target.value as Row["category"] })} aria-label="種類">
                    <option value="ingredient">食材</option>
                    <option value="seasoning">調味料</option>
                  </Select>
                </div>
                {!["g", "ml", "kg", "L"].includes(r.unit) && (
                  <div className="col-start-2 flex items-center gap-1.5 text-sm">
                    <span className="shrink-0 text-muted">1{r.unit}あたり</span>
                    <OptionalNumberInput
                      className="w-20"
                      value={r.unitSize?.amount ?? null}
                      placeholder="内容量"
                      onValueChange={(amount) => update(i, { unitSize: amount ? { amount, unit: r.unitSize?.unit ?? "g" } : null })}
                      aria-label="1つあたりの内容量"
                    />
                    <Select
                      className="w-20"
                      value={r.unitSize?.unit ?? "g"}
                      onChange={(e) => update(i, { unitSize: { amount: r.unitSize?.amount ?? 0, unit: e.target.value as "g" | "ml" } })}
                      aria-label="内容量の単位"
                    >
                      <option value="g">g</option>
                      <option value="ml">ml</option>
                    </Select>
                  </div>
                )}
                <DateField
                  className="col-start-2"
                  value={r.expiresOn ?? ""}
                  placeholder="賞味・消費期限（任意）"
                  clearable
                  onChange={(v) => update(i, { expiresOn: v || null })}
                  aria-label="期限"
                />
                <NutritionSummary n={toItemNutrition(r.nutrition)} />
                {r.fixing ? (
                  <form
                    className="col-start-2 space-y-2 rounded-lg bg-subtle p-2"
                    onSubmit={(e) => {
                      e.preventDefault();
                      void refind(i);
                    }}
                  >
                    <p className="text-xs text-muted">正しい商品名やメーカー、内容量などを入れて探し直します（今の候補は除いて探します）</p>
                    <Input
                      value={r.fixText ?? ""}
                      onChange={(e) => update(i, { fixText: e.target.value })}
                      placeholder="例: ブルボン ルマンド 12本入"
                      aria-label="探し直す商品名"
                      autoFocus
                    />
                    <div className="flex gap-2">
                      <Button type="submit" disabled={r.refinding || !r.fixText?.trim()} className="flex-1">
                        {r.refinding ? "探しています…" : "探し直す"}
                      </Button>
                      <Button type="button" variant="ghost" onClick={() => update(i, { fixing: false })}>
                        やめる
                      </Button>
                    </div>
                  </form>
                ) : (
                  <div className="col-start-2 flex flex-wrap gap-x-4 gap-y-1 text-sm">
                    <button type="button" className="text-brand underline" onClick={() => update(i, { fixing: true, fixText: r.name })}>
                      違う商品？探し直す
                    </button>
                    <button type="button" className="text-muted underline" onClick={() => setRows((rs) => rs && rs.filter((_, j) => j !== i))}>
                      この行を消す
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
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
