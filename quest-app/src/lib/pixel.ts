// ドット絵を細かくする：Scale2x で解像度を2倍にして斜めの線をなめらかにし、
// 上側にハイライト、下・右側に影を自動で付ける。
import { shade } from "./avatar";
import type { Sprite } from "./sprites";

export interface Bitmap {
  w: number;
  h: number;
  /** 行ごとの色（null は透明） */
  px: (string | null)[];
}

const OUTLINE = "k";

function scale2x(rows: string[]): string[] {
  const h = rows.length;
  const w = Math.max(...rows.map((r) => r.length));
  const at = (x: number, y: number) => (x < 0 || y < 0 || x >= w || y >= h ? "." : (rows[y][x] ?? "."));
  const out: string[][] = Array.from({ length: h * 2 }, () => Array(w * 2).fill("."));
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const p = at(x, y);
      const a = at(x, y - 1);
      const b = at(x + 1, y);
      const c = at(x - 1, y);
      const d = at(x, y + 1);
      out[y * 2][x * 2] = c === a && c !== d && a !== b ? a : p;
      out[y * 2][x * 2 + 1] = a === b && a !== c && b !== d ? b : p;
      out[y * 2 + 1][x * 2] = d === c && d !== b && c !== a ? c : p;
      out[y * 2 + 1][x * 2 + 1] = b === d && b !== a && d !== c ? d : p;
    }
  }
  return out.map((r) => r.join(""));
}

const cache = new WeakMap<Sprite, Bitmap>();

export function refine(sprite: Sprite): Bitmap {
  const hit = cache.get(sprite);
  if (hit) return hit;
  if (sprite.hd) {
    const h = sprite.rows.length;
    const w = Math.max(...sprite.rows.map((r) => r.length));
    const px = sprite.rows.flatMap((r) => Array.from({ length: w }, (_, x) => sprite.palette[r[x]] ?? null));
    const bmp = { w, h, px };
    cache.set(sprite, bmp);
    return bmp;
  }
  const rows = scale2x(sprite.rows);
  const h = rows.length;
  const w = rows[0].length;
  const empty = (x: number, y: number) => {
    const ch = x < 0 || y < 0 || x >= w || y >= h ? "." : rows[y][x];
    return ch === "." || ch === OUTLINE || !sprite.palette[ch];
  };
  const px: (string | null)[] = [];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const ch = rows[y][x];
      const base = sprite.palette[ch];
      if (ch === "." || !base) {
        px.push(null);
        continue;
      }
      if (ch === OUTLINE) {
        px.push(base);
        continue;
      }
      if (empty(x, y - 1) || empty(x - 1, y)) px.push(shade(base, 0.2));
      else if (empty(x, y + 1) || empty(x + 1, y)) px.push(shade(base, -0.28));
      else px.push(base);
    }
  }
  const bmp = { w, h, px };
  cache.set(sprite, bmp);
  return bmp;
}
