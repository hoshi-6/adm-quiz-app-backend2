// 階ごとの背景（ドット絵）。章ごとに舞台が変わり、同じ章でも階によって飾りの配置が変わる。
// 120×80 ドット。y=60 より下が床。
import { chapterOf } from "./story";

export interface Px {
  x: number;
  y: number;
  w: number;
  h: number;
  c: string;
  /** ゆらぐ炎など */
  cls?: string;
}

export const SCENE_W = 120;
export const SCENE_H = 80;
export const FLOOR_Y = 60;

function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type R = () => number;
const ri = (r: R, a: number, b: number) => Math.floor(a + r() * (b - a + 1));

function circle(out: Px[], cx: number, cy: number, rad: number, c: string) {
  for (let dy = -rad; dy <= rad; dy++) {
    const hw = Math.round(Math.sqrt(rad * rad - dy * dy));
    out.push({ x: cx - hw, y: cy + dy, w: hw * 2 + 1, h: 1, c });
  }
}

function bricks(out: Px[], r: R, base: string, mortar: string, tints: string[], bw = 12, bh = 6, top = 0, bottom = FLOOR_Y) {
  out.push({ x: 0, y: top, w: SCENE_W, h: bottom - top, c: base });
  for (let y = top, row = 0; y < bottom; y += bh, row++) {
    out.push({ x: 0, y, w: SCENE_W, h: 1, c: mortar });
    const off = row % 2 ? bw / 2 : 0;
    for (let x = -off; x < SCENE_W; x += bw) {
      out.push({ x: Math.max(0, x), y, w: 1, h: bh, c: mortar });
      if (r() < 0.22) out.push({ x: Math.max(0, x + 1), y: y + 1, w: bw - 1, h: bh - 1, c: tints[ri(r, 0, tints.length - 1)] });
    }
  }
}

function floorTiles(out: Px[], base: string, line: string, accent?: string) {
  out.push({ x: 0, y: FLOOR_Y, w: SCENE_W, h: SCENE_H - FLOOR_Y, c: base });
  out.push({ x: 0, y: FLOOR_Y, w: SCENE_W, h: 1, c: accent ?? line });
  [FLOOR_Y + 5, FLOOR_Y + 11, FLOOR_Y + 18].forEach((y) => out.push({ x: 0, y, w: SCENE_W, h: 1, c: line }));
  // 手前ほど広がる目地（遠近感）
  for (let i = -6; i <= 6; i++) {
    const x0 = 60 + i * 9;
    const x1 = 60 + i * 16;
    for (let y = FLOOR_Y + 1; y < SCENE_H; y += 2) {
      const t = (y - FLOOR_Y) / (SCENE_H - FLOOR_Y);
      out.push({ x: Math.round(x0 + (x1 - x0) * t), y, w: 1, h: 2, c: line });
    }
  }
}

function torch(out: Px[], x: number, y: number) {
  out.push({ x: x - 10, y: y - 10, w: 21, h: 21, c: "rgba(255,140,40,0.06)", cls: "flicker-slow" });
  out.push({ x: x - 6, y: y - 6, w: 13, h: 13, c: "rgba(255,150,50,0.10)", cls: "flicker" });
  out.push({ x: x - 1, y: y + 2, w: 3, h: 1, c: "#3a3030" });
  out.push({ x: x, y: y + 2, w: 1, h: 6, c: "#4a3020" });
  out.push({ x: x - 1, y: y - 1, w: 3, h: 3, c: "#e8641a", cls: "flicker" });
  out.push({ x: x, y: y - 3, w: 1, h: 3, c: "#ffb040", cls: "flicker" });
  out.push({ x: x, y: y, w: 1, h: 1, c: "#fff0b0" });
}

function candle(out: Px[], x: number, y: number) {
  out.push({ x: x - 3, y: y - 4, w: 7, h: 7, c: "rgba(255,170,60,0.08)", cls: "flicker" });
  out.push({ x, y, w: 2, h: 4, c: "#d8ccb0" });
  out.push({ x, y: y - 2, w: 1, h: 2, c: "#ffb040", cls: "flicker" });
}

function vignette(out: Px[], strength = 1) {
  for (let i = 0; i < 4; i++) {
    const a = (0.4 - i * 0.09) * strength;
    out.push({ x: i * 3, y: 0, w: 3, h: SCENE_H, c: `rgba(0,0,0,${a})` });
    out.push({ x: SCENE_W - (i + 1) * 3, y: 0, w: 3, h: SCENE_H, c: `rgba(0,0,0,${a})` });
    out.push({ x: 0, y: i * 2, w: SCENE_W, h: 2, c: `rgba(0,0,0,${a * 0.8})` });
  }
}

// ---- 章ごとの舞台 ----

function sewer(out: Px[], r: R) {
  bricks(out, r, "#2a2522", "#171412", ["#322b26", "#241f1c", "#2c2a20"]);
  // 苔
  for (let i = 0; i < 10; i++) out.push({ x: ri(r, 0, 115), y: ri(r, 40, 58), w: ri(r, 2, 6), h: ri(r, 1, 2), c: "#2a3a1e" });
  // 配管
  const py = ri(r, 10, 22);
  out.push({ x: 0, y: py, w: SCENE_W, h: 4, c: "#3a3430" }, { x: 0, y: py, w: SCENE_W, h: 1, c: "#5a504a" }, { x: 0, y: py + 3, w: SCENE_W, h: 1, c: "#1a1614" });
  for (let x = ri(r, 4, 20); x < SCENE_W; x += ri(r, 22, 34)) {
    out.push({ x, y: py - 1, w: 3, h: 6, c: "#4a403a" });
    out.push({ x: x + 1, y: py + 4, w: 1, h: ri(r, 2, 6), c: "#3a4a5a" }); // しずく
  }
  // 錆
  for (let i = 0; i < 4; i++) out.push({ x: ri(r, 0, 110), y: py + 1, w: ri(r, 2, 5), h: 2, c: "#5a3018" });
  floorTiles(out, "#1c1a18", "#121010");
  for (let i = 0; i < 3; i++) out.push({ x: ri(r, 6, 96), y: ri(r, 64, 74), w: ri(r, 10, 20), h: 2, c: "#1a2630" }, { x: ri(r, 10, 100), y: ri(r, 64, 74), w: 4, h: 1, c: "#2e4050" });
  [ri(r, 18, 34), ri(r, 82, 100)].forEach((x) => torch(out, x, ri(r, 28, 36)));
}

function ossuary(out: Px[], r: R) {
  bricks(out, r, "#211d24", "#141118", ["#29242d", "#1b1820"], 16, 8);
  const off = ri(r, 0, 14);
  for (let x = off; x < SCENE_W; x += 30) {
    out.push({ x, y: 6, w: 10, h: 3, c: "#4a4450" }, { x: x + 1, y: 9, w: 8, h: 47, c: "#38323e" }, { x: x + 1, y: 9, w: 2, h: 47, c: "#4a4450" }, { x: x + 7, y: 9, w: 2, h: 47, c: "#26222a" }, { x, y: 56, w: 10, h: 4, c: "#4a4450" });
    if (r() < 0.6) candle(out, x + 4, 50);
  }
  // 壁の頭蓋骨の棚
  for (let i = 0; i < 5; i++) {
    const x = ri(r, 4, 112);
    const y = ri(r, 14, 44);
    out.push({ x, y, w: 4, h: 3, c: "#cfc6b0" }, { x: x + 1, y: y + 1, w: 1, h: 1, c: "#141118" }, { x: x + 2, y: y + 1, w: 1, h: 1, c: "#141118" }, { x: x + 1, y: y + 3, w: 2, h: 1, c: "#a8a090" });
  }
  floorTiles(out, "#18151b", "#0f0d12");
  // 床の骨
  for (let i = 0; i < 6; i++) out.push({ x: ri(r, 4, 112), y: ri(r, 62, 76), w: ri(r, 3, 6), h: 1, c: "#b8b0a0" });
}

function forest(out: Px[], r: R) {
  const bands = ["#070b08", "#0a100b", "#0d150e", "#101a11", "#13200f"];
  bands.forEach((c, i) => out.push({ x: 0, y: i * 12, w: SCENE_W, h: 12, c }));
  // 遠くの木々
  for (let x = 0; x < SCENE_W; x += ri(r, 6, 11)) {
    const h = ri(r, 20, 40);
    out.push({ x, y: FLOOR_Y - h, w: ri(r, 3, 6), h, c: "#060a07" });
  }
  // 手前の枯れ木
  for (let k = 0; k < 2; k++) {
    const x = k === 0 ? ri(r, 4, 30) : ri(r, 84, 108);
    out.push({ x, y: 4, w: 6, h: 56, c: "#1e150e" }, { x, y: 4, w: 2, h: 56, c: "#2c2014" });
    for (let b = 0; b < 4; b++) {
      const by = ri(r, 8, 36);
      const dir = r() < 0.5 ? -1 : 1;
      const len = ri(r, 6, 14);
      for (let j = 0; j < len; j++) out.push({ x: x + 3 + dir * (3 + j), y: by - Math.floor(j / 2), w: 1, h: 2, c: "#1e150e" });
    }
  }
  // 霧
  for (let i = 0; i < 4; i++) out.push({ x: ri(r, -20, 80), y: ri(r, 30, 56), w: ri(r, 40, 70), h: 2, c: "rgba(170,190,170,0.06)" });
  floorTiles(out, "#14160c", "#0c0e08", "#22281a");
  // 光るきのこ
  for (let i = 0; i < 5; i++) {
    const x = ri(r, 4, 114);
    const y = ri(r, 61, 70);
    out.push({ x: x - 2, y: y - 2, w: 5, h: 5, c: "rgba(120,255,200,0.07)", cls: "flicker-slow" }, { x, y, w: 1, h: 2, c: "#c8c0a0" }, { x: x - 1, y: y - 1, w: 3, h: 1, c: "#5ad8b0" });
  }
}

function mine(out: Px[], r: R) {
  out.push({ x: 0, y: 0, w: SCENE_W, h: FLOOR_Y, c: "#24140e" });
  for (let i = 0; i < 40; i++) out.push({ x: ri(r, 0, 114), y: ri(r, 0, 56), w: ri(r, 3, 9), h: ri(r, 2, 5), c: r() < 0.5 ? "#2e1a12" : "#1a0e0a" });
  for (let i = 0; i < 6; i++) out.push({ x: ri(r, 0, 118), y: ri(r, 4, 56), w: 1, h: 1, c: "#e8641a", cls: "flicker-slow" });
  // 坑木
  const off = ri(r, 0, 20);
  for (let x = off; x < SCENE_W; x += 44) {
    out.push({ x, y: 6, w: 4, h: 54, c: "#4a2e18" }, { x, y: 6, w: 1, h: 54, c: "#6a4424" }, { x: x + 30, y: 6, w: 4, h: 54, c: "#4a2e18" }, { x: x - 2, y: 4, w: 38, h: 4, c: "#5a3820" }, { x: x - 2, y: 4, w: 38, h: 1, c: "#7a5030" });
  }
  torch(out, ri(r, 40, 80), 30);
  floorTiles(out, "#1a0e0a", "#120806");
  // 溶岩の割れ目
  for (let i = 0; i < 4; i++) {
    let x = ri(r, 4, 100);
    let y = ri(r, 62, 76);
    for (let j = 0; j < 8; j++) {
      out.push({ x, y, w: 2, h: 1, c: j % 3 ? "#e8641a" : "#ffb040", cls: "flicker-slow" });
      x += ri(r, 1, 3);
      y += ri(r, -1, 1);
    }
  }
}

function ice(out: Px[], r: R) {
  bricks(out, r, "#16222e", "#0c141c", ["#1c2c3a", "#142030", "#20344a"], 14, 7);
  for (let i = 0; i < 8; i++) out.push({ x: ri(r, 0, 110), y: ri(r, 4, 54), w: ri(r, 4, 10), h: 1, c: "#3a5a7a" });
  // つらら
  for (let x = ri(r, 0, 4); x < SCENE_W; x += ri(r, 4, 8)) {
    const len = ri(r, 3, 12);
    for (let j = 0; j < len; j++) out.push({ x: x + (j > len * 0.6 ? 1 : 0), y: j, w: j > len * 0.6 ? 1 : 3, h: 1, c: j === 0 ? "#a8d8f0" : "#6aa8d0" });
  }
  floorTiles(out, "#1a2836", "#101a24", "#4a6a8a");
  // 氷の結晶
  for (let i = 0; i < 4; i++) {
    const x = ri(r, 6, 110);
    const h = ri(r, 4, 9);
    for (let j = 0; j < h; j++) {
      const w = Math.max(1, Math.round((1 - Math.abs(j - h / 2) / (h / 2)) * 3));
      out.push({ x: x - Math.floor(w / 2), y: FLOOR_Y + 2 - h + j + ri(r, 0, 0), w, h: 1, c: j < h / 2 ? "#c8f0ff" : "#6ab0d8" });
    }
  }
  for (let i = 0; i < 14; i++) out.push({ x: ri(r, 0, 119), y: ri(r, 0, 78), w: 1, h: 1, c: "rgba(230,245,255,0.6)", cls: "flicker-slow" });
}

function hellgate(out: Px[], r: R) {
  const bands = ["#140406", "#1c0608", "#26080a", "#30090c", "#3a0c0e"];
  bands.forEach((c, i) => out.push({ x: 0, y: i * 12, w: SCENE_W, h: 12, c }));
  // 赤い月
  const mx = ri(r, 82, 104);
  circle(out, mx, 14, 9, "rgba(200,40,30,0.15)");
  circle(out, mx, 14, 6, "#8a1a14");
  circle(out, mx - 1, 13, 4, "#b02a1e");
  // 巨大な門
  out.push({ x: 34, y: 12, w: 52, h: 48, c: "#0e0607" });
  for (let i = 0; i < 6; i++) out.push({ x: 36 + i * 9, y: 6 + (i % 2) * 2, w: 2, h: 8, c: "#0e0607" });
  out.push({ x: 50, y: 24, w: 20, h: 36, c: "#2a0a0c" }, { x: 59, y: 24, w: 2, h: 36, c: "#0e0607" });
  out.push({ x: 52, y: 26, w: 16, h: 1, c: "rgba(255,80,40,0.35)", cls: "flicker-slow" });
  // 鎖
  for (let k = 0; k < 2; k++) {
    const x = ri(r, 8, 26) + k * ri(r, 70, 84);
    for (let y = 0; y < ri(r, 20, 36); y += 3) out.push({ x, y, w: 2, h: 2, c: "#3a3434" });
  }
  floorTiles(out, "#120808", "#0a0404", "#3a0c0e");
  for (let i = 0; i < 5; i++) {
    let x = ri(r, 4, 100);
    let y = ri(r, 62, 76);
    for (let j = 0; j < 6; j++) {
      out.push({ x, y, w: 2, h: 1, c: "#a81e14", cls: "flicker-slow" });
      x += ri(r, 1, 3);
      y += ri(r, -1, 1);
    }
  }
  torch(out, 28, 36);
  torch(out, 92, 36);
}

function abyss(out: Px[], r: R) {
  const bands = ["#030208", "#06040e", "#0a0616", "#0e081e", "#120a26"];
  bands.forEach((c, i) => out.push({ x: 0, y: i * 12, w: SCENE_W, h: 12, c }));
  for (let i = 0; i < 6; i++) out.push({ x: ri(r, -10, 100), y: ri(r, 4, 50), w: ri(r, 20, 40), h: ri(r, 2, 5), c: "rgba(120,60,200,0.08)" });
  for (let i = 0; i < 40; i++) out.push({ x: ri(r, 0, 119), y: ri(r, 0, 58), w: 1, h: 1, c: r() < 0.2 ? "#fff6d0" : "#8a80c0", cls: r() < 0.3 ? "flicker-slow" : undefined });
  // 浮かぶ岩
  for (let i = 0; i < 3; i++) {
    const x = ri(r, 6, 100);
    const y = ri(r, 8, 40);
    const w = ri(r, 8, 16);
    out.push({ x, y, w, h: 3, c: "#1e1830" }, { x: x + 2, y: y + 3, w: w - 4, h: 2, c: "#16122a" }, { x: x + 4, y: y + 5, w: w - 8, h: 1, c: "#100c20" }, { x, y, w, h: 1, c: "#5a4ab8" });
  }
  out.push({ x: 0, y: FLOOR_Y, w: SCENE_W, h: SCENE_H - FLOOR_Y, c: "#0c0818" });
  for (let x = 0; x < SCENE_W; x += 10) out.push({ x, y: FLOOR_Y, w: 9, h: 1, c: "#3a2a7a" });
  for (let y = FLOOR_Y + 4; y < SCENE_H; y += 5) out.push({ x: 0, y, w: SCENE_W, h: 1, c: "rgba(90,74,184,0.15)" });
}

const STAGES = [sewer, ossuary, forest, mine, ice, hellgate, abyss];

function bossDecor(out: Px[]) {
  // 祭壇と血の色の旗
  out.push({ x: 48, y: 46, w: 24, h: 14, c: "#1a1012" }, { x: 46, y: 44, w: 28, h: 3, c: "#2a1a1c" }, { x: 46, y: 44, w: 28, h: 1, c: "#4a3030" });
  out.push({ x: 56, y: 40, w: 8, h: 4, c: "#5a1414" }, { x: 58, y: 37, w: 4, h: 3, c: "#c8382e", cls: "flicker" });
  for (const x of [14, 98]) {
    out.push({ x: x - 1, y: 2, w: 10, h: 2, c: "#3a2a1a" });
    out.push({ x, y: 4, w: 8, h: 30, c: "#5a1214" }, { x, y: 4, w: 1, h: 30, c: "#7a1a1a" });
    out.push({ x, y: 34, w: 2, h: 3, c: "#5a1214" }, { x: x + 3, y: 34, w: 2, h: 4, c: "#5a1214" }, { x: x + 6, y: 34, w: 2, h: 3, c: "#5a1214" });
    out.push({ x: x + 2, y: 14, w: 4, h: 4, c: "#c8a24a" }, { x: x + 3, y: 15, w: 2, h: 2, c: "#5a1214" });
  }
  out.push({ x: 0, y: 0, w: SCENE_W, h: SCENE_H, c: "rgba(122,26,26,0.16)" });
}

export function sceneFor(floor: number, boss: boolean): Px[] {
  const { index } = chapterOf(floor);
  const r = rng(floor * 9973 + 17);
  const out: Px[] = [];
  STAGES[index](out, r);
  if (boss) bossDecor(out);
  vignette(out, boss ? 1.4 : 1);
  return out;
}

/** 画面の上（背景の続き）と下（床の続き）を塗る色。章の順 */
const COLORS = [
  { top: "#1e1a17", floor: "#1c1a18" },
  { top: "#18151b", floor: "#18151b" },
  { top: "#050806", floor: "#14160c" },
  { top: "#1a0e0a", floor: "#1a0e0a" },
  { top: "#101a24", floor: "#1a2836" },
  { top: "#0e0304", floor: "#120808" },
  { top: "#020106", floor: "#0c0818" },
];

export function sceneColors(floor: number) {
  return COLORS[chapterOf(floor).index];
}
