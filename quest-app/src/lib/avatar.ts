// 主人公の見た目（髪型・色・服・武器）を組み合わせてドット絵を作る。16×24 ドット。
import type { Sprite } from "./sprites";

export const HAIR_STYLES = {
  short: "短髪",
  spiky: "ツンツン",
  long: "ロング",
  ponytail: "ポニーテール",
  bob: "ボブ",
  buzz: "坊主",
  hood: "フード",
} as const;
export type HairStyle = keyof typeof HAIR_STYLES;

export const HAIR_COLORS = {
  black: { name: "黒", hex: "#1c1a24" },
  darkbrown: { name: "こげ茶", hex: "#3a2618" },
  brown: { name: "茶", hex: "#6b4426" },
  blonde: { name: "金", hex: "#c8a24a" },
  silver: { name: "銀", hex: "#a8b0bc" },
  white: { name: "白", hex: "#e4e0d8" },
  red: { name: "赤", hex: "#8a2a24" },
  navy: { name: "紺", hex: "#1f2a4a" },
  ash: { name: "灰", hex: "#5a5a60" },
} as const;

export const SKIN_COLORS = {
  fair: { name: "白め", hex: "#f4d6bc" },
  light: { name: "明るめ", hex: "#eac2a0" },
  medium: { name: "ふつう", hex: "#d6a47c" },
  tan: { name: "小麦色", hex: "#b47e56" },
  deep: { name: "濃いめ", hex: "#7a4e32" },
} as const;

export const EYE_COLORS = {
  black: { name: "黒", hex: "#1a1414" },
  brown: { name: "茶", hex: "#5a3420" },
  blue: { name: "青", hex: "#3a7ad8" },
  green: { name: "緑", hex: "#3a8a4a" },
  red: { name: "赤", hex: "#c8323a" },
  gold: { name: "金", hex: "#d8a830" },
  violet: { name: "紫", hex: "#7a4ac8" },
} as const;

export const OUTFITS = { coat: "コート", robe: "ローブ", armor: "鎧" } as const;
export type Outfit = keyof typeof OUTFITS;

export const OUTFIT_COLORS = {
  black: { name: "漆黒", hex: "#1e1c24" },
  navy: { name: "深い紺", hex: "#1f2c4c" },
  crimson: { name: "深紅", hex: "#6a1a22" },
  forest: { name: "深緑", hex: "#1f3a2a" },
  brown: { name: "革の茶", hex: "#4a3020" },
  violet: { name: "暗い紫", hex: "#3a2450" },
  gray: { name: "鉄灰", hex: "#3c4048" },
  white: { name: "白", hex: "#b8b4ac" },
} as const;

export const WEAPONS = { sword: "長剣", dagger: "短剣", axe: "斧", staff: "杖" } as const;
export type Weapon = keyof typeof WEAPONS;

export interface Avatar {
  hairStyle: HairStyle;
  hairColor: keyof typeof HAIR_COLORS;
  skinColor: keyof typeof SKIN_COLORS;
  eyeColor: keyof typeof EYE_COLORS;
  outfit: Outfit;
  outfitColor: keyof typeof OUTFIT_COLORS;
  glasses: boolean;
  beard: boolean;
  weapon: Weapon;
}

export const DEFAULT_AVATAR: Avatar = {
  hairStyle: "short",
  hairColor: "black",
  skinColor: "light",
  eyeColor: "black",
  outfit: "coat",
  outfitColor: "black",
  glasses: false,
  beard: false,
  weapon: "sword",
};

// ---- 色の計算 ----

function hexToRgb(h: string): [number, number, number] {
  const n = parseInt(h.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** amt > 0 で明るく、< 0 で暗く（-1〜1） */
export function shade(hex: string, amt: number): string {
  const [r, g, b] = hexToRgb(hex);
  const f = (c: number) => Math.round(amt >= 0 ? c + (255 - c) * amt : c * (1 + amt));
  return `#${[f(r), f(g), f(b)].map((c) => Math.max(0, Math.min(255, c)).toString(16).padStart(2, "0")).join("")}`;
}

// ---- 部品（"." は下の層を残す、"_" は透明にする） ----

const BASE = [
  "................",
  "................",
  "................",
  ".....kkkkkk.....",
  "....kssssssk....",
  "...kssssssssk...",
  "...kssssssssk...",
  "...kseWsseWsk...",
  "...kseesseesk...",
  "...kssssssssk...",
  "....kssmmssk....",
  ".....kkkkkk.....",
  "......kssk......",
  "...kkbbiibbkk...",
  "..kbbbbiibbbbk..",
  ".kbbcbbiibbcbbk.",
  ".kbbcbbiibbcbbk.",
  ".ksbcbbiibbcbsk.",
  ".ksbbbffffbbbsk.",
  "..kbbbbbbbbbbk..",
  "..kbbdppppdbbk..",
  "...kdppkkppdk...",
  "...kpppkkpppk...",
  "..kookk..kkook..",
];

const HAIR: Record<HairStyle, string[]> = {
  short: [
    "................",
    "................",
    "................",
    ".....kkkkkk.....",
    "....khhHhhhk....",
    "...khhHHhhhhk...",
    "...khhhhhhhhk...",
    "...kh......hk...",
    "...kk......kk...",
  ],
  spiky: [
    "................",
    "....k..k..k.....",
    "...khkkhkkhk.k..",
    "..khhhhHhhhhkhk.",
    "..khhHHhhhhhhk..",
    ".khhHhhhhhhhhhk.",
    "..khhhkhhkhhhk..",
    "..khk......khk..",
    "...k........k...",
  ],
  long: [
    "................",
    "................",
    "................",
    ".....kkkkkk.....",
    "....khhHhhhk....",
    "...khhHHhhhhk...",
    "..khhhhhhhhhhk..",
    "..khh......hhk..",
    "..khh......hhk..",
    "..khh......hhk..",
    "..khhk....khhk..",
    "..khhk....khhk..",
    "..khhk....khhk..",
    "..khhk....khhk..",
    "..kkhk....khkk..",
    "...kk......kk...",
  ],
  ponytail: [
    "................",
    "................",
    "................",
    ".....kkkkkk.....",
    "....khhHhhhkk...",
    "...khhHHhhhhhk..",
    "...khhhhhhhhhhk.",
    "...kh......hkhk.",
    "...kk......k.hk.",
    "............khk.",
    "............khk.",
    ".............k..",
  ],
  bob: [
    "................",
    "................",
    "................",
    ".....kkkkkk.....",
    "....khhHhhhk....",
    "...khhHHhhhhk...",
    "..khhhhhhhhhhk..",
    "..khh......hhk..",
    "..khh......hhk..",
    "..khhh....hhhk..",
    "...kkk....kkk...",
  ],
  buzz: [
    "................",
    "................",
    "................",
    ".....kkkkkk.....",
    "....khhhhhhk....",
    "...khhhhhhhhk...",
  ],
  hood: [
    "................",
    "................",
    ".....kkkkkk.....",
    "....kbbbbbbk....",
    "...kbbccbbbbk...",
    "..kbbcdddddbbk..",
    "..kbcd......dbk.",
    "..kbd.......dbk.",
    "..kbd.......dbk.",
    "..kbd.......dbk.",
    "..kbbd.....dbbk.",
    "..kbbbd...dbbbk.",
    "..kbbbbkkkbbbbk.",
    "...kbbbbbbbbbk..",
  ],
};

const OUTFIT_LAYER: Record<Outfit, string[]> = {
  coat: [],
  robe: [
    ...Array(19).fill("................"),
    "..kbbbbiibbbbk..",
    "..kbbbbiibbbbk..",
    "..kbbcbiibcbbk..",
    "..kbbcbiibcbbk..",
    "..kkkkkkkkkkkk..",
  ],
  armor: [
    ...Array(13).fill("................"),
    "..kkaaaiiaaakk..",
    ".kaAaaaiiaaAaak.",
    ".kaaakbiibkaaak.",
    ".kaakbaaaabkaak.",
    ".ksbkaAaaAakbsk.",
    ".ksbbbffffbbbsk.",
    "..kbaaaaaaaabk..",
  ],
};

const GLASSES = [
  ...Array(7).fill("................"),
  "....ggg..ggg....",
  "....g.g..g.g....",
];

const BEARD = [
  ...Array(9).fill("................"),
  "...kh......hk...",
  "....khhmmhhk....",
  ".....khhhhk.....",
];

const WEAPON_LAYER: Record<Weapon, string[]> = {
  sword: [
    "................",
    "................",
    "................",
    "..............k.",
    ".............kXk",
    ".............kxk",
    ".............kxk",
    ".............kxk",
    ".............kxk",
    ".............kxk",
    ".............kxk",
    ".............kxk",
    ".............kxk",
    ".............kxk",
    ".............kxk",
    "............kyyy",
    "............kyny",
    ".............sn.",
    "..............n.",
    "..............k.",
  ],
  dagger: [
    ...Array(12).fill("................"),
    "..............k.",
    ".............kXk",
    ".............kxk",
    "............kyyy",
    ".............sn.",
    "..............k.",
  ],
  axe: [
    ...Array(5).fill("................"),
    ".............kk.",
    "............kxxk",
    "...........kXxxk",
    "...........kxxnk",
    "............kxnk",
    ".............knk",
    "..............n.",
    "..............n.",
    "..............n.",
    "..............n.",
    "..............n.",
    ".............sn.",
    "..............n.",
    "..............n.",
    "..............k.",
  ],
  staff: [
    "..............k.",
    ".............kqk",
    "............kQqk",
    ".............kqk",
    "..............n.",
    "..............n.",
    "..............n.",
    "..............n.",
    "..............n.",
    "..............n.",
    "..............n.",
    "..............n.",
    "..............n.",
    "..............n.",
    "..............n.",
    "..............n.",
    "..............n.",
    ".............sn.",
    "..............n.",
    "..............n.",
    "..............n.",
    "..............n.",
    "..............k.",
  ],
};

const W = 16;
const H = 24;

function overlay(grid: string[][], layer: string[]) {
  layer.forEach((row, y) => {
    if (y >= H) return;
    for (let x = 0; x < Math.min(W, row.length); x++) {
      const ch = row[x];
      if (ch === ".") continue;
      grid[y][x] = ch === "_" ? "." : ch;
    }
  });
}

export function buildAvatar(a: Avatar): Sprite {
  const grid = BASE.map((r) => r.padEnd(W, ".").split(""));
  overlay(grid, OUTFIT_LAYER[a.outfit]);
  if (a.beard) overlay(grid, BEARD);
  overlay(grid, HAIR[a.hairStyle]);
  if (a.glasses) overlay(grid, GLASSES);
  overlay(grid, WEAPON_LAYER[a.weapon]);

  const hair = HAIR_COLORS[a.hairColor].hex;
  const cloth = OUTFIT_COLORS[a.outfitColor].hex;
  const skin = SKIN_COLORS[a.skinColor].hex;
  return {
    rows: grid.map((r) => r.join("")),
    palette: {
      k: "#0c0808",
      s: skin,
      m: shade(skin, -0.22),
      e: EYE_COLORS[a.eyeColor].hex,
      W: "#f4efe6",
      h: hair,
      H: shade(hair, 0.3),
      b: cloth,
      c: shade(cloth, 0.22),
      d: shade(cloth, -0.35),
      i: a.outfit === "robe" ? shade(cloth, 0.4) : "#7a6a58",
      f: "#3a2416",
      p: "#22201e",
      o: "#2e1e14",
      a: "#7a7e88",
      A: "#b8bcc4",
      g: "#c8a24a",
      x: "#c8ccd4",
      X: "#ffffff",
      y: "#a8822a",
      n: "#5a3a20",
      q: "#8a3ac8",
      Q: "#e0b0ff",
    },
  };
}
