// ダンジョンで使うスキル。現実のレベル（デイリークエスト）で覚えていく。
export type SkillId = "slash" | "roar" | "heal" | "haste" | "burst";

export interface Skill {
  id: SkillId;
  name: string;
  desc: string;
  /** 再使用までのミリ秒 */
  cd: number;
  /** 効果が続くミリ秒（強化系） */
  dur?: number;
  unlockLevel: number;
}

export const SKILLS: Skill[] = [
  { id: "slash", name: "烈風斬", desc: "攻撃力×3の斬撃", cd: 8000, unlockLevel: 1 },
  { id: "roar", name: "闘気", desc: "10秒間、攻撃力+50%", cd: 25000, dur: 10000, unlockLevel: 5 },
  { id: "heal", name: "再起の息吹", desc: "HPを40%回復", cd: 20000, unlockLevel: 10 },
  { id: "haste", name: "疾風", desc: "8秒間、攻撃速度2倍", cd: 30000, dur: 8000, unlockLevel: 20 },
  { id: "burst", name: "灰燼の一閃", desc: "攻撃力×8の大技", cd: 60000, unlockLevel: 35 },
];
