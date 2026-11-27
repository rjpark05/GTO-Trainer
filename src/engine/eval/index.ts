// Hand evaluator, ported from legacy score(). Mirror: python/gto/evaluator.py
//
// score(cards) takes 5-7 cards and returns one number: higher = better hand.
// The number packs the category and up to five tiebreak ranks in base 13:
//   score = category * 13^5 + r1 * 13^4 + r2 * 13^3 + ... + r5
// so comparing two scores with > compares category first, then kickers.

import type { Card } from '@/engine/cards';

export const CATEGORY_NAMES = [
  'high card', 'pair', 'two pair', 'trips', 'straight',
  'flush', 'full house', 'quads', 'straight flush',
] as const;

/** 13^5: dividing a score by this gives its category (0..8). */
const CATEGORY_BASE = 371293;

export const categoryOf = (score: number) => Math.floor(score / CATEGORY_BASE);

/**
 * Highest straight in a rank bitmask (bit r set = rank r present), or -1.
 * Returns the top rank of the straight; 3 means the wheel A-2-3-4-5 (top card 5).
 */
function straightHigh(mask: number): number {
  for (let high = 12; high >= 4; high--) {
    const five = 0b11111 << (high - 4);
    if ((mask & five) === five) return high;
  }
  const wheel = 0x100f; // A (bit 12) + 2,3,4,5 (bits 0-3)
  return (mask & wheel) === wheel ? 3 : -1;
}

function pack(category: number, ranks: number[]): number {
  let x = category;
  for (let i = 0; i < 5; i++) x = x * 13 + (ranks[i] ?? 0);
  return x;
}

const rankCount = new Int8Array(13); // reused between calls for speed

export function score(cards: readonly Card[]): number {
  rankCount.fill(0);
  const suitCount = [0, 0, 0, 0];
  const suitMask = [0, 0, 0, 0]; // per suit: bitmask of ranks
  let rankMask = 0; // all ranks present
  for (const c of cards) {
    const r = c >> 2, s = c & 3;
    rankCount[r]++;
    suitCount[s]++;
    suitMask[s] |= 1 << r;
    rankMask |= 1 << r;
  }

  // Flush or straight flush. (With 7 cards a flush rules out quads and full houses.)
  for (let s = 0; s < 4; s++) {
    if (suitCount[s] >= 5) {
      const sf = straightHigh(suitMask[s]);
      if (sf >= 0) return pack(8, [sf]);
      const top: number[] = [];
      for (let r = 12; r >= 0 && top.length < 5; r--) if ((suitMask[s] >> r) & 1) top.push(r);
      return pack(5, top);
    }
  }

  // Group ranks, highest first.
  let quad = -1;
  const trips: number[] = [], pairs: number[] = [];
  for (let r = 12; r >= 0; r--) {
    if (rankCount[r] === 4) quad = r;
    else if (rankCount[r] === 3) trips.push(r);
    else if (rankCount[r] === 2) pairs.push(r);
  }
  /** Top n ranks present, skipping the ones already used. */
  const kickers = (used: number[], n: number) => {
    const out: number[] = [];
    for (let r = 12; r >= 0 && out.length < n; r--) if (rankCount[r] && !used.includes(r)) out.push(r);
    return out;
  };

  if (quad >= 0) return pack(7, [quad, ...kickers([quad], 1)]);
  if (trips.length && (trips.length > 1 || pairs.length))
    return pack(6, [trips[0], Math.max(trips[1] ?? -1, pairs[0] ?? -1)]);
  const st = straightHigh(rankMask);
  if (st >= 0) return pack(4, [st]);
  if (trips.length) return pack(3, [trips[0], ...kickers([trips[0]], 2)]);
  if (pairs.length >= 2) return pack(2, [pairs[0], pairs[1], ...kickers([pairs[0], pairs[1]], 1)]);
  if (pairs.length) return pack(1, [pairs[0], ...kickers([pairs[0]], 3)]);
  return pack(0, kickers([], 5));
}
