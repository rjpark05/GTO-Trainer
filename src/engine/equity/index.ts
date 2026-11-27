// Monte Carlo equity, ported from legacy equity() and eqW(). Mirror: python/gto/equity.py
//
// Equity = how often hero wins at showdown, with ties split. Each iteration:
//   1. give every villain a random hand from their range (skipping cards already used)
//   2. deal the rest of the board at random
//   3. compare scores: win = 1, n-way tie = 1/n, loss = 0
// The answer is the average over all iterations.
//
// Every function takes an rng so results are reproducible: same seed, same answer.

import type { Card, Combo } from '@/engine/cards';
import { score } from '@/engine/eval';
import { randInt, type Rng } from '@/engine/rng';

/** Hero's share of the pot for one runout: 1 win, 1/(k+1) for a k-way split, 0 loss. */
function showdownShare(hero: Card[], villains: Combo[], board: Card[]): number {
  const heroScore = score([...hero, ...board]);
  let best = -1, ties = 0; // best villain score and how many villains share it
  for (const v of villains) {
    const s = score([...v, ...board]);
    if (s > best) { best = s; ties = 0; }
    else if (s === best) ties++;
  }
  if (heroScore > best) return 1;
  if (heroScore === best) return 1 / (ties + 2);
  return 0;
}

/**
 * Equity vs villains whose ranges are plain combo lists (every combo equally likely).
 * Legacy used this on the flop only; here it fills the board to 5 cards from any start.
 */
export function equity(hero: Card[], board: Card[], villainRanges: Combo[][], iters: number, rng: Rng): number {
  const used = new Uint8Array(52);
  let total = 0, n = 0;
  for (let it = 0; it < iters; it++) {
    used.fill(0);
    for (const c of hero) used[c] = 1;
    for (const c of board) used[c] = 1;

    // Deal villain hands: up to 40 tries per villain to find an unblocked combo.
    const villains: Combo[] = [];
    let ok = true;
    for (const range of villainRanges) {
      let got: Combo | null = null;
      for (let t = 0; t < 40; t++) {
        const c = range[randInt(rng, range.length)];
        if (!used[c[0]] && !used[c[1]]) { got = c; break; }
      }
      if (!got) { ok = false; break; } // skip this iteration entirely
      used[got[0]] = used[got[1]] = 1;
      villains.push(got);
    }
    if (!ok) continue;

    const runout = board.slice();
    while (runout.length < 5) {
      const c = randInt(rng, 52);
      if (!used[c]) { used[c] = 1; runout.push(c); }
    }
    total += showdownShare(hero, villains, runout);
    n++;
  }
  return n ? total / n : 0;
}

// ---- weighted ranges ----

export interface WeightedCombo { c: Combo; w: number }

/** Prepared weighted range: drawing picks combo i with probability w_i / total. */
export interface Sampler { items: Combo[]; cum: number[]; total: number }

export function makeSampler(list: WeightedCombo[]): Sampler {
  const items: Combo[] = [], cum: number[] = [];
  let total = 0;
  for (const x of list) {
    if (x.w > 1e-6) { total += x.w; items.push(x.c); cum.push(total); }
  }
  return { items, cum, total };
}

/** Draw one unblocked combo (30 tries), or null. Binary search on the running weight total. */
export function drawFrom(s: Sampler, used: Uint8Array, rng: Rng): Combo | null {
  if (!s.total) return null;
  for (let k = 0; k < 30; k++) {
    const r = rng() * s.total;
    let lo = 0, hi = s.cum.length - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (s.cum[mid] < r) lo = mid + 1;
      else hi = mid;
    }
    const c = s.items[lo];
    if (!used[c[0]] && !used[c[1]]) return c;
  }
  return null;
}

/**
 * Equity vs weighted ranges, any board length (0-5 cards). Ported from legacy eqW().
 * If a villain's range is empty or fully blocked, they get a random hand instead.
 */
export function equityWeighted(hero: Card[], board: Card[], samplers: Sampler[], iters: number, rng: Rng): number {
  const used = new Uint8Array(52);
  let total = 0, n = 0;
  for (let it = 0; it < iters; it++) {
    used.fill(0);
    for (const c of hero) used[c] = 1;
    for (const c of board) used[c] = 1;

    const villains: Combo[] = [];
    for (const s of samplers) {
      let c = drawFrom(s, used, rng);
      if (!c) {
        let pair: [number, number];
        let g = 0;
        do {
          pair = [randInt(rng, 52), randInt(rng, 52)];
          g++;
        } while ((used[pair[0]] || used[pair[1]] || pair[0] === pair[1]) && g < 50);
        c = pair;
      }
      used[c[0]] = used[c[1]] = 1;
      villains.push(c);
    }

    const runout = board.slice();
    while (runout.length < 5) {
      const c = randInt(rng, 52);
      if (!used[c]) { used[c] = 1; runout.push(c); }
    }
    total += showdownShare(hero, villains, runout);
    n++;
  }
  return n ? total / n : 0;
}
