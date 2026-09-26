// 献立の材料名と在庫の商品名を照らし合わせる（表記ゆれがあっても近いものを候補にする）
import type { PantryItem } from "./db";
import { normalize } from "./foods";

function bigrams(s: string): string[] {
  const t = normalize(s).replace(/[\s・（）()「」、,。.]/g, "");
  if (t.length < 2) return t ? [t] : [];
  return Array.from({ length: t.length - 1 }, (_, i) => t.slice(i, i + 2));
}

/** 0〜1 の近さ。片方がもう片方を含むときは高めにする */
export function similarity(a: string, b: string): number {
  const na = normalize(a).replace(/\s/g, "");
  const nb = normalize(b).replace(/\s/g, "");
  if (!na || !nb) return 0;
  if (na === nb) return 1;
  if (na.includes(nb) || nb.includes(na)) return 0.8;
  // 2文字ずつの一致（語の並びの近さ）と、1文字ずつの一致（「鶏むね肉」と「鶏もも肉」のような近さ）を合わせる
  const chars = (s: string) => Array.from(normalize(s).replace(/[\s・（）()「」、,。.\d]/g, ""));
  return Math.max(dice(bigrams(a), bigrams(b)), 0.8 * dice(chars(a), chars(b)));
}

function dice(x: string[], y: string[]): number {
  if (!x.length || !y.length) return 0;
  const pool = [...y];
  let hit = 0;
  for (const g of x) {
    const i = pool.indexOf(g);
    if (i >= 0) {
      hit++;
      pool.splice(i, 1);
    }
  }
  return (2 * hit) / (x.length + y.length);
}

/** 名前が近い順に在庫を並べる */
export function rankPantry(name: string, pantry: PantryItem[]): { item: PantryItem; score: number }[] {
  return pantry.map((item) => ({ item, score: similarity(name, item.name) })).sort((p, q) => q.score - p.score);
}

const UNIT = "g|kg|ml|mL|L|cc|個|本|枚|袋|パック|切れ|切|丁|玉|束|株|尾|缶|杯|房|片|かけ|合|カップ";

/** 「鶏むね肉 200g」「卵 2個」「醤油 大さじ1」のような材料の文字列を、名前と量に分ける */
export function parseIngredient(text: string): { name: string; amount: number | null; unit: string | null } {
  const t = text.replace(/[０-９．]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0)).trim();
  // 大さじ・小さじは在庫の単位に直せないので、量なしとして扱う
  const spoon = t.match(/^(.*?)[\s　]*(大さじ|小さじ|少々|適量|ひとつまみ)/);
  if (spoon) return { name: spoon[1].trim() || t, amount: null, unit: null };
  // 「小松菜 1/2束」のような分数（先に見ないと「2束」と読んでしまう）
  const f = t.match(new RegExp(`^(.*?)[\\s　]*(\\d+)\\/(\\d+)\\s*(${UNIT})`));
  if (f) return { name: f[1].trim() || t, amount: Number(f[2]) / Number(f[3]), unit: f[4] };
  const m = t.match(new RegExp(`^(.*?)[\\s　]*(\\d+(?:\\.\\d+)?)(?:[〜~-]\\d+(?:\\.\\d+)?)?\\s*(${UNIT})`));
  if (m) {
    const unit = m[3] === "mL" || m[3] === "cc" ? "ml" : m[3] === "切" ? "切れ" : m[3];
    return { name: m[1].trim() || t, amount: Number(m[2]), unit };
  }
  return { name: t.replace(/[\s　].*$/, "") || t, amount: null, unit: null };
}
