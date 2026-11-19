// 大きな数を「万・億・兆・京・垓…」で短く表す（例: 1234567 → 123.4万、1.45e21 → 14.5垓）
const UNITS: [number, string][] = [
  [1e44, "載"],
  [1e40, "正"],
  [1e36, "澗"],
  [1e32, "溝"],
  [1e28, "穣"],
  [1e24, "𥝱"],
  [1e20, "垓"],
  [1e16, "京"],
  [1e12, "兆"],
  [1e8, "億"],
  [1e4, "万"],
];

export function fmtBig(n: number): string {
  const v = Math.abs(n);
  for (const [u, name] of UNITS) {
    if (v >= u) {
      const x = n / u;
      return `${Math.abs(x) < 100 ? x.toFixed(1).replace(/\.0$/, "") : Math.floor(x).toLocaleString()}${name}`;
    }
  }
  return Math.round(n).toLocaleString();
}
