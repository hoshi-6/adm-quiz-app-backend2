// 主人公「黒衣の短剣使い」（ユーザーのデザイン画をもとに）の 64×64 ドット絵を作るスクリプト。
// 実行: node scripts/draw-blackcoat.mjs  → src/lib/blackcoatSprite.ts を書き出す
import { writeFileSync } from "node:fs";
import { blank, ellipse, line, poly, put, rect, shadeAndOutline } from "./pixel-draw.mjs";

const PAL = {
  k: "#08070a", // 輪郭
  s: "#ecd8c8", S: "#c4a490", m: "#a07868", // 肌・口
  h: "#1c1a24", H: "#0e0c12", j: "#3e3c50", // 黒髪（青みのつや）
  e: "#7a80a0", K: "#14121a", // 目・まつげ
  c: "#2a2830", C: "#17151b", d: "#46424e", // 黒い外套とフード
  i: "#1e1d24", I: "#121116", // 黒いシャツ
  L: "#141318", // ベルト
  x: "#b8bcc4", X: "#6a6e78", y: "#f0f2f6", // 金具・短剣の刃
  g: "#8a7a5a", // 柄の飾り
  t: "#1e1e26", T: "#121218", // ズボン
  o: "#1a1a20", O: "#0c0c10", w: "#e4e4e8", // スニーカー
};
const SHADOW = { s: "S", h: "H", c: "C", d: "c", i: "I", t: "T", o: "O", x: "X", j: "h" };
const LIGHT = { h: "j", c: "d", x: "y" };

function draw(pose) {
  const g = blank();
  const b = pose === "idle1" ? 1 : 0;
  const atk = pose === "attack";

  // フード（首の後ろでたるむ）
  poly(g, [[21, 16 + b], [39, 16 + b], [41, 23 + b], [19, 23 + b]], "c");

  // 長い外套（裾は左右非対称にほつれる）
  poly(g, [[20, 19 + b], [40, 19 + b], [43, 30 + b], [45, 55], [42, 52], [40, 59], [37, 51], [33, 40 + b], [27, 40 + b], [25, 50], [22, 58], [19, 52], [16, 56], [18, 30 + b]], "c");
  line(g, 22, 34 + b, 20, 54, "C");
  line(g, 38, 34 + b, 41, 54, "C");
  line(g, 43, 40, 44, 52, "d");

  // ズボンとスニーカー（動かない）
  rect(g, 26, 37, 29, 57, "t");
  rect(g, 31, 37, 34, 57, "t");
  line(g, 29, 40, 29, 57, "T");
  line(g, 34, 40, 34, 57, "T");
  poly(g, [[24, 57], [30, 57], [30, 61], [23, 61]], "o");
  poly(g, [[31, 57], [37, 57], [38, 61], [31, 61]], "o");
  rect(g, 23, 62, 30, 62, "w");
  rect(g, 31, 62, 38, 62, "w");
  put(g, 26, 59, "w"); // 靴ひも
  put(g, 34, 59, "w");

  // 黒いシャツと襟
  poly(g, [[26, 19 + b], [34, 19 + b], [33, 36 + b], [27, 36 + b]], "i");
  poly(g, [[25, 19 + b], [28, 19 + b], [27, 30 + b], [24, 24 + b]], "d");
  poly(g, [[32, 19 + b], [35, 19 + b], [36, 24 + b], [33, 30 + b]], "d");
  put(g, 25, 22 + b, "x"); // 襟の鋲
  put(g, 35, 22 + b, "x");

  // ベルトと鎖
  rect(g, 26, 35 + b, 34, 36 + b, "L");
  rect(g, 29, 35 + b, 31, 36 + b, "x");
  for (let i = 0; i < 4; i++) put(g, 34 + i, 37 + b + i, i % 2 ? "X" : "x");

  // 左腕（だらりと下げる。袖はまくり上げ、ベルトが垂れる）
  poly(g, [[18, 20 + b], [23, 21 + b], [22, 33 + b], [18, 34 + b], [16, 28 + b]], "c");
  rect(g, 17, 32 + b, 22, 34 + b, "d");
  line(g, 16, 25 + b, 14, 34 + b, "d");
  poly(g, [[18, 35 + b], [22, 35 + b], [21, 41 + b], [18, 41 + b]], "s");
  ellipse(g, 19.5, 43 + b, 2, 2, "s");

  if (!atk) {
    // 右腕：短剣を逆手ぎみに下げて持つ
    poly(g, [[37, 20 + b], [42, 21 + b], [44, 30 + b], [42, 34 + b], [38, 33 + b]], "c");
    rect(g, 38, 32 + b, 43, 34 + b, "d");
    line(g, 44, 24 + b, 47, 33 + b, "d");
    poly(g, [[39, 35 + b], [43, 35 + b], [44, 40 + b], [40, 41 + b]], "s");
    put(g, 41, 39 + b, "g"); // 柄頭
    ellipse(g, 42, 42 + b, 2.2, 2, "s");
    rect(g, 39, 45 + b, 46, 45 + b, "x"); // 鍔
    put(g, 39, 46 + b, "x");
    put(g, 46, 44 + b, "x");
    rect(g, 42, 44 + b, 43, 44 + b, "g");
    line(g, 43, 46 + b, 50, 60, "x", 2); // 刃
    line(g, 42, 46 + b, 49, 59, "y");
  } else {
    // 突き：腕を前へ伸ばし、短剣を水平に
    poly(g, [[37, 20], [42, 20], [50, 25], [48, 30], [40, 28]], "c");
    rect(g, 46, 24, 49, 30, "d");
    line(g, 42, 21, 44, 30, "d");
    poly(g, [[49, 25], [52, 25], [53, 30], [49, 30]], "s");
    rect(g, 54, 24, 54, 31, "x"); // 鍔
    rect(g, 53, 27, 53, 28, "g");
    line(g, 55, 27, 63, 27, "x", 2); // 刃
    line(g, 55, 26, 62, 26, "y");
  }

  // 首
  rect(g, 28, 16 + b, 32, 19 + b, "s");
  put(g, 32, 18 + b, "S");

  // 頭
  ellipse(g, 30, 11 + b, 5.5, 6.5, "s");
  rect(g, 27, 16 + b, 33, 17 + b, "s");
  line(g, 34, 11 + b, 33, 16 + b, "S");
  // 無造作な黒髪
  ellipse(g, 30, 7 + b, 7.5, 5.5, "h");
  // 無造作にはねた毛束（低め）
  poly(g, [[23, 5 + b], [24, 2 + b], [27, 4 + b]], "h");
  poly(g, [[28, 3 + b], [30, 1 + b], [32, 2 + b], [32, 4 + b]], "h");
  poly(g, [[33, 3 + b], [36, 2 + b], [38, 6 + b], [35, 5 + b]], "h");
  put(g, 21, 9 + b, "h");
  put(g, 39, 10 + b, "h");
  poly(g, [[24, 7 + b], [27, 14 + b], [29, 8 + b]], "h"); // 前髪
  poly(g, [[28, 8 + b], [30, 13 + b], [32, 8 + b]], "h");
  poly(g, [[31, 8 + b], [34, 14 + b], [36, 8 + b]], "h");
  poly(g, [[23, 7 + b], [24, 16 + b], [26, 10 + b]], "h"); // 横の髪
  poly(g, [[35, 8 + b], [37, 16 + b], [37, 9 + b]], "h");
  line(g, 26, 3 + b, 31, 5 + b, "j");
  line(g, 33, 4 + b, 35, 6 + b, "j");
  // 目（鋭く、少し伏し目がち）
  rect(g, 26, 12 + b, 28, 12 + b, "K");
  rect(g, 27, 13 + b, 28, 13 + b, "e");
  rect(g, 32, 12 + b, 34, 12 + b, "K");
  rect(g, 32, 13 + b, 33, 13 + b, "e");
  // 鼻と口
  put(g, 30, 14 + b, "S");
  line(g, 29, 16 + b, 31, 16 + b, "m");

  return shadeAndOutline(g, SHADOW, LIGHT);
}

const rows = Object.fromEntries(["idle0", "idle1", "attack"].map((p) => [p, draw(p).map((r) => r.join(""))]));
const src = `// 自動生成：scripts/draw-blackcoat.mjs を実行して作り直す（手で編集しない）
// 主人公「黒衣の短剣使い」 64×64 ドット
import type { Sprite } from "./sprites";

export const BLACKCOAT_PALETTE = ${JSON.stringify(PAL, null, 2)};

const frame = (rows: string[]): Sprite => ({ rows, palette: BLACKCOAT_PALETTE, hd: true });

export const BLACKCOAT = {
  idle0: frame(${JSON.stringify(rows.idle0, null, 2)}),
  idle1: frame(${JSON.stringify(rows.idle1, null, 2)}),
  attack: frame(${JSON.stringify(rows.attack, null, 2)}),
};
`;
writeFileSync(new URL("../src/lib/blackcoatSprite.ts", import.meta.url), src);
console.log("wrote src/lib/blackcoatSprite.ts");
