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
      <a href={url} target="_blank" rel="noopener noreferrer" className={box} title="画像を大きく見る">
        {/* eslint-disable-next-line @next/next/no-img-element -- 外部サイトの商品画像をそのまま表示する */}
        <img src={url} alt="商品の画像" referrerPolicy="no-referrer" className="h-full w-full object-contain" onError={() => setBroken(true)} />
      </a>
    );
  }
  return (
    <div className={cx(box, "grid place-items-center whitespace-pre-line text-center text-[10px] leading-tight text-muted")}>
      {found === undefined && source ? "画像を\n探しています" : "画像なし"}
    </div>
  );
}
