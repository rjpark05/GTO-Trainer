// Cards, combos, and the 13x13 grid indexing shared by engine and UI.
// Card id: 0..51 = rank * 4 + suit. Rank 0 = '2' ... 12 = 'A'.

export const RANKS = '23456789TJQKA';
export const SUITS = 'shdc'; // same order as legacy: s=0 h=1 d=2 c=3

export type Card = number;
export type Combo = readonly [Card, Card]; // always [higher id, lower id]

export const rankOf = (c: Card) => c >> 2;
export const suitOf = (c: Card) => c & 3;

export function parseCard(s: string): Card {
  const r = RANKS.indexOf(s[0]?.toUpperCase() ?? '');
  const u = SUITS.indexOf(s[1]?.toLowerCase() ?? '');
  if (r < 0 || u < 0 || s.length !== 2) throw new Error(`bad card: ${s}`);
  return r * 4 + u;
}

export const cardStr = (c: Card) => RANKS[rankOf(c)] + SUITS[suitOf(c)];

/** All 1326 combos in a fixed order; COMBO_INDEX maps a pair back to its slot. */
export const COMBOS: Combo[] = [];
const COMBO_INDEX = new Int16Array(52 * 52).fill(-1);
for (let a = 51; a >= 0; a--)
  for (let b = a - 1; b >= 0; b--) {
    COMBO_INDEX[a * 52 + b] = COMBOS.length;
    COMBOS.push([a, b]);
  }

export function comboIndex(x: Card, y: Card): number {
  const [a, b] = x > y ? [x, y] : [y, x];
  return COMBO_INDEX[a * 52 + b];
}

/**
 * 13x13 grid cell for a combo. Row/col 0 = Ace.
 * Pairs on the diagonal, suited above it (row < col), offsuit below.
 */
export function gridCell(combo: Combo): { row: number; col: number } {
  const hi = 12 - rankOf(combo[0]);
  const lo = 12 - rankOf(combo[1]);
  const suited = suitOf(combo[0]) === suitOf(combo[1]);
  if (hi === lo) return { row: hi, col: hi };
  return suited ? { row: hi, col: lo } : { row: lo, col: hi };
}

/** Label like "AKs", "QQ", "T9o" for a grid cell. */
export function cellLabel(row: number, col: number): string {
  const a = RANKS[12 - Math.min(row, col)];
  const b = RANKS[12 - Math.max(row, col)];
  if (row === col) return a + b;
  return a + b + (row < col ? 's' : 'o');
}

/** Combo indices belonging to each of the 169 grid cells (row * 13 + col). */
export const CELL_COMBOS: number[][] = Array.from({ length: 169 }, () => []);
COMBOS.forEach((c, i) => {
  const { row, col } = gridCell(c);
  CELL_COMBOS[row * 13 + col].push(i);
});
