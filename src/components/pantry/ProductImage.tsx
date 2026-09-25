"use client";

import { useEffect, useState } from "react";
import { getPasscode } from "@/lib/sync";
import { cx } from "../ui";

/** 商品の画像。imageUrl があればそれを、なければ出典ページから代表画像を探して表示する */
export function ProductImage({
  imageUrl,
  source,
  onResolved,
  size = "md",
  link = true,
}: {
  imageUrl?: string | null;
  source?: string | null;
  onResolved?: (url: string | null) => void;
  size?: "sm" | "md";
  /** false のときはリンクにしない（ボタンの中に置くときなど） */
  link?: boolean;
}) {
  const [found, setFound] = useState<string | null | undefined>(imageUrl ?? undefined);
  const [broken, setBroken] = useState(false);
  const [viewing, setViewing] = useState(false);

  useEffect(() => {
    if (imageUrl || !source || !/^https?:\/\//.test(source)) return;
    let cancelled = false;
    const passcode = getPasscode();
    fetch(`/api/product-image?url=${encodeURIComponent(source)}`, { headers: passcode ? { "x-app-passcode": passcode } : {} })
      .then((r) => (r.ok ? r.json() : { imageUrl: null }))
      .then((d) => {
        if (cancelled) return;
        setFound(d.imageUrl ?? null);
        onResolved?.(d.imageUrl ?? null);
      })
      .catch(() => !cancelled && setFound(null));
    return () => {
      cancelled = true;
    };
    // onResolved は親の再描画で変わるが、画像探しは出典が変わったときだけでよい
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [imageUrl, source]);

  const box = cx("shrink-0 overflow-hidden rounded-lg border border-line bg-subtle", size === "sm" ? "h-12 w-12" : "h-20 w-20");
  const url = imageUrl ?? found;
  if (url && !broken && !link) {
    return (
      <span className={box}>
        {/* eslint-disable-next-line @next/next/no-img-element -- 外部サイトの商品画像をそのまま表示する */}
        <img src={url} alt="商品の画像" referrerPolicy="no-referrer" className="h-full w-full object-contain" onError={() => setBroken(true)} />
      </span>
    );
  }
  if (url && !broken) {
    return (
      <>
        <button type="button" className={box} title="画像を大きく見る" aria-label="商品の画像を大きく見る" onClick={() => setViewing(true)}>
          {/* eslint-disable-next-line @next/next/no-img-element -- 外部サイトの商品画像をそのまま表示する */}
          <img src={url} alt="商品の画像" referrerPolicy="no-referrer" className="h-full w-full object-contain" onError={() => setBroken(true)} />
        </button>
        {viewing && <ImageViewer url={url} source={source} onClose={() => setViewing(false)} />}
      </>
    );
  }
  return (
    <div className={cx(box, "grid place-items-center whitespace-pre-line text-center text-[10px] leading-tight text-muted")}>
      {found === undefined && source ? "画像を\n探しています" : "画像なし"}
    </div>
  );
}

/** 商品画像を画面いっぱいに表示する。背景をタップするか「閉じる」で戻る */
function ImageViewer({ url, source, onClose }: { url: string; source?: string | null; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    // 後ろの画面がスクロールしないようにする
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/90 p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-[calc(1rem+env(safe-area-inset-top))]" role="dialog" aria-modal="true" aria-label="商品の画像" onClick={onClose}>
      <div className="flex justify-end">
        <button type="button" className="rounded-full bg-white/15 px-4 py-2 text-sm text-white" onClick={onClose}>
          閉じる
        </button>
      </div>
      <div className="flex min-h-0 flex-1 items-center justify-center py-4">
        {/* eslint-disable-next-line @next/next/no-img-element -- 外部サイトの商品画像をそのまま表示する */}
        <img src={url} alt="商品の画像（拡大）" referrerPolicy="no-referrer" className="max-h-full max-w-full rounded-lg bg-white object-contain" onClick={(e) => e.stopPropagation()} />
      </div>
      {source && /^https?:\/\//.test(source) && (
        <a
          href={source}
          target="_blank"
          rel="noopener noreferrer"
          className="mx-auto rounded-full bg-white px-5 py-2.5 text-sm font-medium text-black"
          onClick={(e) => e.stopPropagation()}
        >
          商品のページを開く
        </a>
      )}
    </div>
  );
}
