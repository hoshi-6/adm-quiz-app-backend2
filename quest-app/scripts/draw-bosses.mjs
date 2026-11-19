// 各章のボスの 64×64 ドット絵を作るスクリプト（主人公と同じ作り方）。ボスは左（主人公の方）を向く。
// 実行: node scripts/draw-bosses.mjs  → src/lib/bossSprites.ts を書き出す
import { writeFileSync } from "node:fs";
import { blank, ellipse, line, poly, put, rect, shadeAndOutline } from "./pixel-draw.mjs";

// 素材：a / c / m / w / p はそれぞれ「本体・第2・第3・骨や歯・肌」。大文字が影、数字が明るい色
const SHADOW = { a: "A", c: "C", m: "M", w: "W", p: "P", 1: "a", 2: "c", 3: "m", 4: "p" };
const LIGHT = { a: "1", c: "2", m: "3", p: "4" };

const K = "#0c0708";

// ---- 四つ足の獣（番犬・王獣） ----
function beast(g, { mane, antlers }) {
  // しっぽ
  line(g, 50, 32, 56, 24, "a", 3);
  line(g, 56, 24, 61, 19, "a", 2);
  // 奥の脚
  poly(g, [[28, 42], [33, 42], [33, 57], [28, 57]], "A");
  poly(g, [[48, 42], [53, 42], [55, 57], [50, 57]], "A");
  // 胴
  ellipse(g, 37, 36, 16, 10, "a");
  ellipse(g, 35, 42, 11, 4, "1"); // おなか（明るい毛）
  line(g, 30, 30, 46, 29, "A");
  line(g, 34, 33, 48, 33, "A");
  // 手前の脚
  poly(g, [[43, 40], [50, 40], [51, 55], [46, 58], [43, 50]], "a");
  poly(g, [[20, 40], [27, 40], [27, 57], [20, 57]], "a");
  rect(g, 19, 57, 27, 58, "A");
  rect(g, 45, 56, 52, 58, "A");
  for (const x of [20, 23, 26, 46, 49, 52]) put(g, x, 59, "w"); // 爪
  if (mane) {
    // たてがみ
    ellipse(g, 19, 26, 12, 13, "c");
    for (let i = 0; i < 9; i++) {
      const ang = Math.PI * 0.55 + (i / 8) * Math.PI * 1.1;
      line(g, 19 + Math.cos(ang) * 9, 26 + Math.sin(ang) * 10, 19 + Math.cos(ang) * 15, 26 + Math.sin(ang) * 15, "c", 2);
    }
    line(g, 12, 18, 26, 36, "C");
  }
  // 頭
  poly(g, [[12, 20], [26, 18], [30, 32], [18, 37], [10, 32]], "a");
  poly(g, [[3, 27], [14, 25], [16, 33], [5, 35]], "a"); // 鼻先
  poly(g, [[4, 35], [16, 34], [15, 40], [8, 41]], "A"); // 下あご（開いている）
  poly(g, [[4, 33], [15, 32], [15, 35], [5, 36]], "m"); // 口の中
  for (const x of [5, 8, 11, 14]) put(g, x, 33, "w"); // 牙
  for (const x of [6, 10, 13]) put(g, x, 35, "w");
  put(g, 3, 28, "K"); // 鼻
  // 耳
  if (!mane) {
    poly(g, [[17, 21], [21, 10], [25, 21]], "a");
    poly(g, [[22, 20], [27, 11], [29, 22]], "A");
  }
  // 目
  rect(g, 13, 26, 16, 27, "e");
  put(g, 13, 26, "f");
  // 角（王獣）
  if (antlers) {
    line(g, 18, 18, 14, 6, "w", 2);
    line(g, 15, 10, 9, 6, "w");
    line(g, 16, 13, 20, 7, "w");
    line(g, 24, 18, 27, 5, "w", 2);
    line(g, 26, 9, 32, 5, "w");
    line(g, 26, 12, 22, 7, "w");
  } else {
    // とげの首輪
    line(g, 21, 37, 29, 22, "c", 3);
    for (const [x, y] of [[20, 39], [23, 34], [26, 29], [29, 24]]) put(g, x - 2, y, "w");
  }
}

// ---- 竜（炎獄竜・深淵の主） ----
function dragon(g, { eyes = 1, tentacles = false }) {
  // 奥の翼
  poly(g, [[34, 24], [50, 1], [62, 6], [57, 12], [62, 18], [55, 22], [60, 29], [46, 32]], "m");
  line(g, 36, 24, 50, 2, "M");
  line(g, 44, 28, 61, 7, "M");
  line(g, 46, 30, 61, 18, "M");
  // しっぽ
  poly(g, [[46, 40], [54, 44], [62, 52], [61, 58], [57, 55], [50, 48], [44, 46]], "a");
  poly(g, [[60, 52], [63, 50], [63, 57]], "w");
  // 奥の脚
  poly(g, [[44, 46], [51, 46], [51, 58], [44, 58]], "A");
  // 胴
  ellipse(g, 37, 41, 13, 11, "a");
  ellipse(g, 33, 45, 8, 7, "c");
  for (let y = 40; y <= 51; y += 3) line(g, 27, y, 39, y, "C");
  // 手前の脚
  poly(g, [[24, 46], [32, 46], [32, 58], [22, 58]], "a");
  poly(g, [[38, 48], [45, 48], [46, 58], [38, 58]], "a");
  for (const x of [22, 25, 28, 39, 42, 45]) put(g, x, 59, "w");
  // 首
  poly(g, [[27, 36], [34, 33], [25, 15], [18, 18]], "a");
  for (let i = 0; i < 4; i++) line(g, 22 + i * 2, 20 + i * 4, 27 + i * 2, 18 + i * 4, "c");
  // 頭
  poly(g, [[5, 18], [17, 11], [26, 15], [24, 23], [12, 26], [3, 24]], "a");
  poly(g, [[4, 24], [14, 25], [12, 29], [5, 28]], "A"); // 下あご
  line(g, 4, 24, 14, 24, "K");
  for (const x of [5, 8, 11]) put(g, x, 25, "w");
  // 角
  line(g, 19, 12, 28, 3, "w", 2);
  line(g, 15, 13, 19, 4, "w");
  // 目
  rect(g, 14, 16, 16, 17, "e");
  put(g, 14, 16, "f");
  // 手前の翼
  poly(g, [[30, 28], [38, 9], [46, 13], [44, 21], [48, 25], [38, 32]], "m");
  line(g, 31, 28, 38, 10, "M");
  line(g, 36, 30, 46, 14, "M");
  // 口から漏れる炎／瘴気
  poly(g, [[1, 20], [5, 21], [4, 26], [0, 27]], "f");
  put(g, 1, 23, "y");
  put(g, 2, 22, "y");
  if (eyes > 1) {
    // 体じゅうの目
    for (const [x, y] of [[42, 18], [52, 12], [36, 40], [44, 38], [30, 22]]) {
      rect(g, x, y, x + 1, y + 1, "e");
      put(g, x, y, "f");
    }
  }
  if (tentacles) {
    for (let i = 0; i < 4; i++) {
      const x0 = 28 + i * 6;
      for (let t = 0; t < 8; t++) put(g, x0 + Math.round(Math.sin(t / 1.5 + i) * 2), 52 + t, "m");
    }
  }
}

// ---- 骨の騎士団長 ----
function knight(g) {
  // ぼろぼろの外套
  poly(g, [[28, 17], [46, 17], [53, 52], [49, 50], [47, 58], [42, 54], [38, 60], [33, 55], [29, 58], [26, 52]], "m");
  line(g, 40, 22, 47, 55, "M");
  line(g, 33, 24, 33, 54, "M");
  // 盾（奥）
  ellipse(g, 48, 34, 7, 10, "c");
  ellipse(g, 48, 34, 3, 5, "g");
  // 脚（骨）と鉄靴
  line(g, 32, 45, 30, 57, "w", 2);
  line(g, 38, 45, 40, 57, "w", 2);
  rect(g, 27, 56, 33, 60, "c");
  rect(g, 37, 56, 43, 60, "c");
  // 腰と胴の鎧
  rect(g, 28, 40, 42, 45, "c");
  poly(g, [[26, 20], [44, 20], [43, 40], [27, 40]], "c");
  line(g, 35, 22, 35, 39, "C");
  rect(g, 33, 26, 37, 30, "g"); // 紋章
  put(g, 35, 28, "m");
  // 肩当て
  ellipse(g, 26, 22, 5, 4, "c");
  ellipse(g, 44, 22, 5, 4, "c");
  for (const x of [23, 26, 29]) put(g, x, 18, "w");
  // 腕と剣（前に突き立てる）
  poly(g, [[22, 22], [27, 24], [23, 34], [19, 33]], "c");
  rect(g, 18, 32, 23, 35, "w"); // 骨の手
  rect(g, 13, 36, 26, 37, "g"); // 鍔
  line(g, 19, 38, 16, 62, "2", 3); // 刃
  line(g, 18, 38, 15, 61, "c");
  rect(g, 19, 28, 21, 31, "C"); // 柄
  // 頭：兜と骸骨
  ellipse(g, 35, 13, 7, 8, "c");
  rect(g, 31, 11, 39, 18, "w");
  rect(g, 31, 11, 39, 11, "c");
  rect(g, 32, 13, 33, 14, "K");
  rect(g, 36, 13, 37, 14, "K");
  put(g, 32, 13, "e");
  put(g, 36, 13, "e");
  for (const x of [32, 34, 36, 38]) put(g, x, 17, "K"); // 歯のすき間
  // 羽根飾り
  poly(g, [[36, 5], [42, 1], [50, 3], [46, 6], [52, 9], [42, 8]], "m");
}

// ---- 氷晶の巨像 ----
function golem(g) {
  rect(g, 18, 44, 29, 61, "a");
  rect(g, 35, 44, 46, 61, "a");
  line(g, 22, 47, 26, 58, "A");
  line(g, 40, 50, 37, 59, "A");
  // 腕
  poly(g, [[5, 20], [16, 20], [14, 44], [3, 44]], "a");
  poly(g, [[48, 20], [59, 20], [61, 44], [50, 44]], "a");
  ellipse(g, 8, 47, 6, 5, "a");
  ellipse(g, 56, 47, 6, 5, "a");
  // 胴
  poly(g, [[13, 17], [51, 17], [47, 46], [17, 46]], "a");
  line(g, 20, 22, 28, 40, "A");
  line(g, 44, 24, 38, 42, "A");
  // 核
  ellipse(g, 32, 31, 6, 6, "c");
  ellipse(g, 32, 31, 3, 3, "e");
  put(g, 31, 30, "w");
  // 肩の結晶
  poly(g, [[8, 20], [13, 4], [18, 20]], "c");
  poly(g, [[16, 18], [20, 9], [23, 18]], "c");
  poly(g, [[46, 20], [51, 2], [56, 20]], "c");
  poly(g, [[41, 18], [44, 10], [47, 18]], "c");
  // 頭
  rect(g, 25, 6, 39, 17, "a");
  poly(g, [[25, 6], [28, 1], [31, 6]], "c");
  poly(g, [[33, 6], [36, 0], [39, 6]], "c");
  rect(g, 27, 11, 37, 12, "e");
  put(g, 28, 11, "w");
}

// ---- 門の魔王 ----
function demon(g) {
  // 大きな外套
  poly(g, [[14, 16], [50, 16], [61, 62], [3, 62]], "m");
  line(g, 20, 20, 10, 60, "M");
  line(g, 44, 20, 54, 60, "M");
  // 衣
  poly(g, [[22, 20], [42, 20], [46, 61], [18, 61]], "a");
  line(g, 32, 22, 32, 60, "g");
  line(g, 22, 40, 42, 40, "g");
  // 肩当て（とげ）
  ellipse(g, 21, 21, 6, 4, "c");
  ellipse(g, 43, 21, 6, 4, "c");
  for (const [x, y] of [[16, 16], [19, 14], [44, 14], [48, 16]]) line(g, x, y + 3, x, y, "w");
  // 杖（左手）
  line(g, 12, 12, 14, 62, "n", 2);
  ellipse(g, 12, 9, 4, 4, "f");
  put(g, 11, 8, "y");
  poly(g, [[13, 30], [19, 26], [21, 31], [15, 34]], "p"); // 手
  // 頭
  ellipse(g, 32, 12, 6, 7, "p");
  // 角
  poly(g, [[27, 7], [21, 0], [18, 3], [24, 11]], "w");
  poly(g, [[37, 7], [43, 0], [46, 3], [40, 11]], "w");
  // 目と牙
  rect(g, 28, 11, 30, 12, "e");
  rect(g, 34, 11, 36, 12, "e");
  line(g, 29, 16, 35, 16, "K");
  put(g, 30, 17, "w");
  put(g, 34, 17, "w");
}

const BOSSES = {
  hound: {
    draw: (g) => beast(g, { mane: false, antlers: false }),
    pal: { a: "#4a3a30", A: "#2e241e", 1: "#6a5444", c: "#7a7e88", C: "#4a4e58", 2: "#b8bcc4", m: "#6a1418", M: "#3a0a0c", 3: "#a82a2a", w: "#f0e8d8", W: "#b8ae9a", e: "#ff3b2e", f: "#ffd0a0", K },
  },
  knight: {
    draw: knight,
    pal: { c: "#5a5662", C: "#3a3640", 2: "#9a96a4", m: "#6a1418", M: "#3a0a0c", 3: "#a82a2a", w: "#e8e0cc", W: "#a8a090", g: "#c8a24a", e: "#ff3b2e", K },
  },
  lion: {
    draw: (g) => beast(g, { mane: true, antlers: true }),
    pal: { a: "#a8782a", A: "#6a4a18", 1: "#d8a84a", c: "#7a4a1a", C: "#4a2a0c", 2: "#a86a2a", m: "#6a1418", M: "#3a0a0c", 3: "#a82a2a", w: "#e8dcc0", W: "#a89a80", e: "#ffe08a", f: "#ffffff", K },
  },
  dragon: {
    draw: (g) => dragon(g, {}),
    pal: { a: "#c8381a", A: "#7a1a0c", 1: "#ff6a3a", c: "#e8a040", C: "#a86a20", 2: "#ffd080", m: "#6a1a14", M: "#3a0a08", 3: "#a83a24", w: "#f0e0c8", W: "#b0a088", e: "#ffe08a", f: "#ff8a2a", y: "#ffe8a0", K },
  },
  golem: {
    draw: golem,
    pal: { a: "#4a7aa8", A: "#24446a", 1: "#8ab8e0", c: "#b8e8ff", C: "#6aa0c8", 2: "#ffffff", e: "#e0ffff", w: "#ffffff", K },
  },
  demon: {
    draw: demon,
    pal: { a: "#2a1a2a", A: "#160c16", 1: "#4a2a4a", m: "#5a0f18", M: "#2e060c", 3: "#8a1a24", c: "#4a4450", C: "#2a2630", 2: "#7a7484", p: "#8a3a4a", P: "#5a1f2a", 4: "#b05a6a", w: "#e8dcc0", W: "#a89a80", g: "#c8a24a", e: "#ffd35c", n: "#1a1214", f: "#c08cff", y: "#ffffff", K },
  },
  abyss: {
    draw: (g) => dragon(g, { eyes: 6, tentacles: true }),
    pal: { a: "#2a1f5a", A: "#140f30", 1: "#4a3a8a", c: "#3a2a6a", C: "#1f1640", 2: "#5a4ab8", m: "#1a1238", M: "#0c081c", 3: "#3a2a7a", w: "#c8c0ff", W: "#7a70b0", e: "#5cf2ff", f: "#ffffff", y: "#e0ffff", K },
  },
};

const out = {};
for (const [id, b] of Object.entries(BOSSES)) {
  const g = blank();
  b.draw(g);
  out[id] = { rows: shadeAndOutline(g, SHADOW, LIGHT).map((r) => r.join("")), palette: { k: K, ...b.pal } };
}

const src = `// 自動生成：scripts/draw-bosses.mjs を実行して作り直す（手で編集しない）
// 各章のボス 64×64 ドット
import type { Sprite } from "./sprites";

const hd = (s: { rows: string[]; palette: Record<string, string> }): Sprite => ({ ...s, hd: true });

export const BOSS_SPRITES = {
${Object.entries(out)
  .map(([id, s]) => `  ${id}: hd(${JSON.stringify(s)}),`)
  .join("\n")}
};

export type BossId = keyof typeof BOSS_SPRITES;
`;
writeFileSync(new URL("../src/lib/bossSprites.ts", import.meta.url), src);
console.log("wrote src/lib/bossSprites.ts");
