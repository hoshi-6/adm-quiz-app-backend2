// 段階的に解放される機能。最初は主人公ひとりで、進むほどできることが増える。
import type { GameState } from "./game";

export type Feature = "train" | "equip" | "auto" | "party" | "move";

export const FEATURES: Record<Feature, { name: string; cond: string; ok: (g: GameState) => boolean }> = {
  train: { name: "訓練所", cond: "B3F に到達", ok: (g) => g.dungeon.deepest >= 3 },
  equip: { name: "装備", cond: "B6F に到達", ok: (g) => g.dungeon.deepest >= 6 || Object.keys(g.dungeon.equipment).length > 0 },
  auto: { name: "スキルの AUTO", cond: "最初のボス（B10F）を倒す", ok: (g) => g.dungeon.bossKills >= 1 },
  party: { name: "仲間", cond: "B11F に到達", ok: (g) => g.dungeon.deepest >= 11 },
  move: { name: "移動・このフロアで稼ぐ", cond: "B11F に到達", ok: (g) => g.dungeon.deepest >= 11 },
};

export function isUnlocked(g: GameState, f: Feature): boolean {
  return g.dungeon.unlocked.includes(f) || FEATURES[f].ok(g);
}

/** 新しく条件を満たした機能を記録し、その名前を返す */
export function checkUnlocks(g: GameState): string[] {
  const got: string[] = [];
  for (const f of Object.keys(FEATURES) as Feature[]) {
    if (!g.dungeon.unlocked.includes(f) && FEATURES[f].ok(g)) {
      g.dungeon.unlocked.push(f);
      got.push(FEATURES[f].name);
    }
  }
  return got;
}
