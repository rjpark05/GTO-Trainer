// Seeded random number generator (mulberry32).
// Same algorithm as python/gto/rng.py: the same seed gives the same numbers in both,
// which is how the tests check that the two engines agree exactly.

/** A function returning a float in [0, 1), like Math.random. */
export type Rng = () => number;

export function mulberry32(seed: number): Rng {
  let a = seed | 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Random integer in [0, n). */
export const randInt = (rng: Rng, n: number) => Math.floor(rng() * n);
