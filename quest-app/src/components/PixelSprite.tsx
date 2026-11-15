import type { Sprite } from "@/lib/sprites";

/** ドット絵を SVG で描く（横に続く同じ色はまとめて1つの四角にする） */
export function PixelSprite({ sprite, scale = 4, flip, className, title }: { sprite: Sprite; scale?: number; flip?: boolean; className?: string; title?: string }) {
  const h = sprite.rows.length;
  const w = Math.max(...sprite.rows.map((r) => r.length));
  const rects: { x: number; y: number; w: number; c: string }[] = [];
  sprite.rows.forEach((row, y) => {
    let x = 0;
    while (x < row.length) {
      const ch = row[x];
      if (ch === "." || ch === " " || !sprite.palette[ch]) {
        x++;
        continue;
      }
      let len = 1;
      while (row[x + len] === ch) len++;
      rects.push({ x, y, w: len, c: sprite.palette[ch] });
      x += len;
    }
  });
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
