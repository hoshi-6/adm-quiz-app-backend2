// オリジナル主人公「灰の放浪者」の 64×64 ドット絵を作るスクリプト。
// 図形（多角形・楕円・線）を置いてドットにし、輪郭と陰影を自動で付ける。
// 実行: node scripts/draw-hero.mjs  → src/lib/heroSprite.ts を書き出す
import { writeFileSync } from "node:fs";
import { blank, ellipse, line, poly, put, rect, shadeAndOutline as shadeBase } from "./pixel-draw.mjs";

// 色（1文字のキー）。大文字は影、記号はハイライトなど
const PAL = {
  k: "#0c0708", // 輪郭
  s: "#e9cdb4", S: "#c49a80", // 肌
  h: "#b8b6b4", H: "#7e7a7a", j: "#e4e2de", // 灰銀の髪
  e: "#e0a030", E: "#6a3a10", // 琥珀の目
  r: "#8a1a1e", R: "#561014", q: "#b8323a", // 深紅（スカーフ・裏地）
  c: "#2c2a2e", C: "#1a181c", d: "#45424a", // 炭色の外套
  i: "#3a3438", I: "#26222a", // 中のシャツ
  l: "#4a3222", L: "#2e1e14", // 革（ベルト・手袋・ブーツ）
  g: "#c89a3a", G: "#8a6420", // くすんだ金
  t: "#24222a", T: "#16141a", // ズボン
  x: "#cfd4dc", X: "#8a909c", y: "#f4f6fa", // 刃
  m: "#a8746a", // 傷・口
};

// 陰影：光は左上から。素材ごとに「影の色」「明るい色」を決める
const SHADOW = { s: "S", h: "H", c: "C", d: "c", i: "I", l: "L", t: "T", r: "R", q: "r", x: "X", g: "G", j: "h" };
const LIGHT = { h: "j", c: "d", r: "q", x: "y" };

const shadeAndOutline = (g) => shadeBase(g, SHADOW, LIGHT);

/**
 * pose: "idle0" | "idle1" | "attack"
 * idle1 は上半身が1ドット沈む（呼吸）。attack は剣を振り上げる。
 */
function draw(pose) {
  const g = blank();
  const b = pose === "idle1" ? 1 : 0; // 上半身のずれ
  const atk = pose === "attack";

  // --- 後ろの層：ポニーテールとスカーフのたなびき ---
  poly(g, [[24, 15 + b], [27, 16 + b], [24, 28 + b], [21, 33 + b], [20, 30 + b]], "h");
  line(g, 23, 18 + b, 21, 31 + b, "H");
  // スカーフの端：風にたなびいて波打ち、先が二つに割れる
  poly(g, [[25, 20 + b], [28, 22 + b], [24, 26 + b], [20, 27 + b], [16, 29 + b], [13, 32 + b], [10, 31 + b], [12, 28 + b], [16, 25 + b], [21, 22 + b]], "r");
  poly(g, [[16, 28 + b], [19, 28 + b], [15, 33 + b], [12, 35 + b], [12, 33 + b]], "r");
  line(g, 23, 23 + b, 17, 26 + b, "R");
  line(g, 17, 27 + b, 12, 30 + b, "R");

  // --- 脚とブーツ（動かない） ---
  rect(g, 26, 44, 29, 55, "t");
  rect(g, 32, 44, 35, 55, "t");
  line(g, 29, 46, 29, 55, "T");
  line(g, 35, 46, 35, 55, "T");
  poly(g, [[25, 54], [30, 54], [30, 61], [24, 61], [24, 59]], "l");
  poly(g, [[31, 54], [36, 54], [37, 59], [37, 61], [31, 61]], "l");
  rect(g, 24, 61, 30, 61, "L");
  rect(g, 31, 61, 37, 61, "L");
  rect(g, 25, 56, 29, 56, "L");
  rect(g, 32, 56, 36, 56, "L");

  // --- 外套（裾は広がる） ---
  poly(g, [[22, 23 + b], [39, 23 + b], [41, 34 + b], [43, 52], [37, 50], [33, 42 + b], [28, 42 + b], [24, 50], [18, 52], [20, 34 + b]], "c");
  // 前の開き：中のシャツ
  poly(g, [[28, 24 + b], [33, 24 + b], [33, 42 + b], [28, 42 + b]], "i");
  line(g, 30, 25 + b, 30, 41 + b, "I");
  // 裏地（深紅）が裾と前立てに見える
  line(g, 27, 26 + b, 27, 42 + b, "r");
  line(g, 34, 26 + b, 34, 42 + b, "r");
  line(g, 27, 42 + b, 24, 50, "r", 2);
  line(g, 34, 42 + b, 37, 50, "r", 2);
  // しわと影
  line(g, 23, 36 + b, 21, 50, "C");
  line(g, 38, 36 + b, 40, 50, "C");
  line(g, 25, 28 + b, 25, 40 + b, "C");
  // 肩当て（革）
  poly(g, [[21, 23 + b], [27, 22 + b], [26, 26 + b], [20, 27 + b]], "l");
  poly(g, [[34, 22 + b], [40, 23 + b], [41, 27 + b], [35, 26 + b]], "l");
  // ベルトとバックル
  rect(g, 24, 37 + b, 37, 38 + b, "l");
  rect(g, 29, 36 + b, 32, 39 + b, "g");
  rect(g, 30, 37 + b, 31, 38 + b, "G");
  // 斜めがけのベルト
  line(g, 36, 24 + b, 26, 36 + b, "L", 2);
  put(g, 31, 30 + b, "g");

  // --- 左腕（だらりと下げる） ---
  poly(g, [[20, 24 + b], [24, 25 + b], [22, 38 + b], [19, 39 + b], [18, 34 + b]], "c");
  line(g, 19, 30 + b, 19, 38 + b, "C");
  rect(g, 18, 39 + b, 21, 42 + b, "l"); // 手袋
  put(g, 21, 42 + b, "s");

  // --- 右腕と剣 ---
  if (!atk) {
    poly(g, [[37, 24 + b], [41, 24 + b], [44, 36 + b], [41, 37 + b], [38, 30 + b]], "c");
    line(g, 43, 33 + b, 42, 36 + b, "C");
    rect(g, 41, 37 + b, 44, 40 + b, "l"); // 手袋
    // 剣（下に構える）
    rect(g, 42, 33 + b, 43, 36 + b, "L"); // 柄
    ellipse(g, 42.5, 32 + b, 1, 1, "g"); // 柄頭
    rect(g, 39, 41 + b, 46, 42 + b, "g"); // 鍔
    put(g, 46, 42 + b, "G");
    line(g, 43, 43 + b, 50, 61, "x", 3); // 刃
    line(g, 42, 43 + b, 49, 61, "y"); // 刃の光
    line(g, 44, 43 + b, 51, 60, "X");
  } else {
    // 振り上げ：腕を上へ、剣は右上へ
    poly(g, [[37, 24], [41, 23], [46, 16], [49, 18], [42, 28]], "c");
    rect(g, 46, 13, 49, 17, "l");
    rect(g, 44, 17, 46, 18, "L");
    rect(g, 44, 11, 51, 12, "g"); // 鍔
    line(g, 49, 10, 62, 0, "x", 3);
    line(g, 48, 9, 61, -1, "y");
    line(g, 50, 11, 63, 1, "X");
  }

  // --- 首・スカーフ ---
  rect(g, 28, 19 + b, 32, 22 + b, "s");
  put(g, 32, 21 + b, "S");
  poly(g, [[24, 20 + b], [36, 20 + b], [37, 24 + b], [23, 24 + b]], "r");
  line(g, 25, 23 + b, 35, 23 + b, "R");
  // 結び目から垂れる布
  poly(g, [[33, 23 + b], [36, 23 + b], [36, 31 + b], [34, 30 + b]], "r");
  line(g, 35, 24 + b, 35, 30 + b, "R");

  // --- 頭 ---
  ellipse(g, 30, 13 + b, 6, 7, "s");
  rect(g, 26, 18 + b, 33, 19 + b, "s");
  line(g, 34, 13 + b, 33, 18 + b, "S");
  // 髪（頭頂と、左に流した前髪）
  ellipse(g, 30, 9 + b, 7.5, 5.5, "h");
  poly(g, [[22, 9 + b], [27, 8 + b], [29, 12 + b], [27, 16 + b], [24, 18 + b], [23, 14 + b]], "h"); // 左の束
  poly(g, [[29, 7 + b], [38, 8 + b], [37, 13 + b], [35, 11 + b], [33, 13 + b], [31, 10 + b]], "h"); // 前髪
  poly(g, [[35, 9 + b], [38, 9 + b], [38, 17 + b], [36, 15 + b]], "h"); // 右のもみあげ
  line(g, 24, 7 + b, 27, 15 + b, "H");
  line(g, 32, 8 + b, 35, 11 + b, "H");
  line(g, 26, 5 + b, 33, 5 + b, "j");
  line(g, 28, 6 + b, 31, 9 + b, "j");
  // 目（琥珀）と眉
  rect(g, 27, 13 + b, 28, 14 + b, "e");
  rect(g, 32, 13 + b, 33, 14 + b, "e");
  rect(g, 27, 13 + b, 28, 13 + b, "E");
  rect(g, 32, 13 + b, 33, 13 + b, "E");
  line(g, 26, 11 + b, 28, 11 + b, "H");
  line(g, 32, 11 + b, 34, 12 + b, "H");
  // 左目の古傷
  line(g, 33, 10 + b, 34, 16 + b, "m");
  // 鼻と口
  put(g, 30, 15 + b, "S");
  line(g, 29, 17 + b, 31, 17 + b, "m");

  return shadeAndOutline(g);
}

const frames = { idle0: draw("idle0"), idle1: draw("idle1"), attack: draw("attack") };
const rows = Object.fromEntries(Object.entries(frames).map(([k, g]) => [k, g.map((r) => r.join(""))]));

const src = `// 自動生成：scripts/draw-hero.mjs を実行して作り直す（手で編集しない）
// オリジナル主人公「灰の放浪者」 64×64 ドット
import type { Sprite } from "./sprites";

export const WANDERER_PALETTE = ${JSON.stringify(PAL, null, 2)};

const frame = (rows: string[]): Sprite => ({ rows, palette: WANDERER_PALETTE, hd: true });

export const WANDERER = {
  idle0: frame(${JSON.stringify(rows.idle0, null, 2)}),
  idle1: frame(${JSON.stringify(rows.idle1, null, 2)}),
  attack: frame(${JSON.stringify(rows.attack, null, 2)}),
};
`;
writeFileSync(new URL("../src/lib/heroSprite.ts", import.meta.url), src);
console.log("wrote src/lib/heroSprite.ts");
