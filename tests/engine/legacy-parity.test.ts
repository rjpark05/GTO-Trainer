// The new TypeScript engine must give exactly the same answers as the original app.
// Fixtures come from tools/extract-legacy/record-fixtures.mjs, which runs the legacy code.
// python/tests/test_legacy_parity.py checks the Python engine against the same files.

import { describe, expect, it } from 'vitest';
import type { Card, Combo } from '@/engine/cards';
import { categoryOf, score } from '@/engine/eval';
import { equity, equityWeighted, makeSampler } from '@/engine/equity';
import { mulberry32 } from '@/engine/rng';
import rngJson from '../fixtures/rng.json';
import evalJson from '../fixtures/evaluator.json';
import eqJson from '../fixtures/equity.json';
import eqwJson from '../fixtures/eqw.json';

// JSON arrays load as number[]; tell TypeScript the real shapes once, here.
const rngFx = rngJson as { seed: number; values: number[] };
const evalFx = evalJson as { cards: Card[]; score: number; cat: number }[];
const eqFx = eqJson as unknown as { hero: Card[]; flop: Card[]; vills: Combo[][]; iters: number; seed: number; result: number }[];
const eqwFx = eqwJson as unknown as {
  hero: Card[]; board: Card[]; vills: { c: Combo; w: number }[][]; iters: number; seed: number; result: number;
}[];

describe('rng', () => {
  it('matches the recorded mulberry32 stream', () => {
    const r = mulberry32(rngFx.seed);
    for (const v of rngFx.values) expect(r()).toBe(v);
  });
});

describe('evaluator matches legacy score()', () => {
  it(`agrees on all ${evalFx.length} hands`, () => {
    for (const { cards, score: want, cat } of evalFx) {
      expect(score(cards), `cards ${cards}`).toBe(want);
      expect(categoryOf(want)).toBe(cat);
    }
  });
});

describe('equity matches legacy equity()', () => {
  it.each(eqFx.map((f, i) => [i, f] as const))('case %i', (_i, f) => {
    const got = equity(f.hero, f.flop, f.vills, f.iters, mulberry32(f.seed));
    expect(got).toBe(f.result);
  });

  it('is stable: same seed gives the same answer', () => {
    const f = eqFx[0];
    const run = () => equity(f.hero, f.flop, f.vills, f.iters, mulberry32(99));
    expect(run()).toBe(run());
  });
});

describe('equityWeighted matches legacy eqW()', () => {
  it.each(eqwFx.map((f, i) => [i, f] as const))('case %i', (_i, f) => {
    const samplers = f.vills.map((l) => makeSampler(l));
    const got = equityWeighted(f.hero, f.board, samplers, f.iters, mulberry32(f.seed));
    expect(got).toBe(f.result);
  });
});
