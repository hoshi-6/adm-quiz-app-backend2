// 64×64 のドット絵を図形から作るための共通の道具
export const N = 64;

export function blank() {
  return Array.from({ length: N }, () => Array(N).fill("."));
}

export function put(g, x, y, c) {
  x = Math.round(x);
  y = Math.round(y);
  if (x >= 0 && y >= 0 && x < N && y < N) g[y][x] = c;
}

export function rect(g, x0, y0, x1, y1, c) {
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) put(g, x, y, c);
}

export function ellipse(g, cx, cy, rx, ry, c) {
  for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++)
    for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
      const dx = (x - cx) / rx;
      const dy = (y - cy) / ry;
      if (dx * dx + dy * dy <= 1) put(g, x, y, c);
    }
}

export function poly(g, pts, c) {
  const ys = pts.map((p) => p[1]);
  for (let y = Math.floor(Math.min(...ys)); y <= Math.ceil(Math.max(...ys)); y++) {
    const xs = [];
    const yc = y + 0.5;
    for (let i = 0; i < pts.length; i++) {
      const [x0, y0] = pts[i];
      const [x1, y1] = pts[(i + 1) % pts.length];
      if ((y0 <= yc && y1 > yc) || (y1 <= yc && y0 > yc)) xs.push(x0 + ((yc - y0) / (y1 - y0)) * (x1 - x0));
    }
    xs.sort((a, b) => a - b);
    for (let k = 0; k + 1 < xs.length; k += 2) for (let x = Math.ceil(xs[k] - 0.5); x <= Math.floor(xs[k + 1] - 0.5); x++) put(g, x, y, c);
  }
}

export function line(g, x0, y0, x1, y1, c, w = 1) {
  const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) * 2 + 1;
  for (let i = 0; i <= n; i++) {
    const x = x0 + ((x1 - x0) * i) / n;
    const y = y0 + ((y1 - y0) * i) / n;
    if (w === 1) put(g, x, y, c);
    else rect(g, Math.round(x - (w - 1) / 2), Math.round(y - (w - 1) / 2), Math.round(x + w / 2 - 0.5), Math.round(y + w / 2 - 0.5), c);
  }
}

/** 陰影（光は左上から）と外側の輪郭を付ける。shadow / light は「素材 → 影色・明色」の対応 */
export function shadeAndOutline(g, shadow, light) {
  const out = g.map((r) => r.slice());
  const at = (x, y) => (x < 0 || y < 0 || x >= N || y >= N ? "." : g[y][x]);
  for (let y = 0; y < N; y++)
    for (let x = 0; x < N; x++) {
      const c = g[y][x];
      if (c === "." || c === "k") continue;
      if ((at(x + 1, y) === "." || at(x, y + 1) === ".") && shadow[c]) out[y][x] = shadow[c];
      else if ((at(x - 1, y) === "." || at(x, y - 1) === ".") && light[c]) out[y][x] = light[c];
    }
  const res = out.map((r) => r.slice());
  for (let y = 0; y < N; y++)
    for (let x = 0; x < N; x++) {
      if (out[y][x] !== ".") continue;
      const near = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => {
        const v = x + dx >= 0 && y + dy >= 0 && x + dx < N && y + dy < N ? out[y + dy][x + dx] : ".";
        return v !== "." && v !== "k";
      });
      if (near) res[y][x] = "k";
    }
  return res;
}
