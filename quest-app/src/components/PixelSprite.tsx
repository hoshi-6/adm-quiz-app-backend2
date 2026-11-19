import { refine } from "@/lib/pixel";
import type { Sprite } from "@/lib/sprites";

/**
 * ドット絵を SVG で描く。細かくした（2倍の解像度にした）絵を、scale 倍で表示する。
 * 横に続く同じ色はまとめて1つの四角にする。
 */
export function PixelSprite({ sprite, scale = 2, flip, className, title }: { sprite: Sprite; scale?: number; flip?: boolean; className?: string; title?: string }) {
  const { w, h, px } = refine(sprite);
  const rects: { x: number; y: number; w: number; c: string }[] = [];
  for (let y = 0; y < h; y++) {
    let x = 0;
    while (x < w) {
      const c = px[y * w + x];
      if (!c) {
        x++;
        continue;
      }
      let len = 1;
      while (x + len < w && px[y * w + x + len] === c) len++;
      rects.push({ x, y, w: len, c });
      x += len;
    }
  }
  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      width={w * scale}
      height={h * scale}
      shapeRendering="crispEdges"
      className={className}
      style={flip ? { transform: "scaleX(-1)" } : undefined}
      role={title ? "img" : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
    >
      {rects.map((r, i) => (
        <rect key={i} x={r.x} y={r.y} width={r.w} height={1} fill={r.c} />
      ))}
    </svg>
  );
}
