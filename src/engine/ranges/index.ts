// Range text -> weighted combos. Mirror: python/gto/ranges.py (see it for the syntax).
//   "AA,KK,AKs,KQo,22+,A2s+,KTo+,AhKh,QJs:0.5"

import { COMBOS, RANKS, comboIndex, parseCard, rankOf, suitOf, type Combo } from '@/engine/cards';

function handLabels(token: string): string[] {
  let t = token.trim();
  if (t.length === 4 && 'shdc'.includes(t[1]) && 'shdc'.includes(t[3])) return [t];
  if (t.includes('-')) return dashLabels(t);
  const plus = t.endsWith('+');
  if (plus) t = t.slice(0, -1);
  if ((t.length !== 2 && t.length !== 3) || !RANKS.includes(t[0]) || !RANKS.includes(t[1]))
    throw new Error(`bad range token: ${token}`);
  let hi = RANKS.indexOf(t[0]), lo = RANKS.indexOf(t[1]);
  const kind = t.length === 3 ? t[2] : '';
  if (kind !== '' && kind !== 's' && kind !== 'o') throw new Error(`bad range token: ${token}`);
  if (hi < lo) [hi, lo] = [lo, hi];

  if (hi === lo) {
    const out: string[] = [];
    for (let r = hi; r < (plus ? 13 : hi + 1); r++) out.push(RANKS[r] + RANKS[r]);
    return out;
  }
  const kinds = kind ? [kind] : ['s', 'o'];
  const out: string[] = [];
  for (let k = lo; k < (plus ? hi : lo + 1); k++) for (const s of kinds) out.push(RANKS[hi] + RANKS[k] + s);
  return out;
}

/** "K8s-K2s" -> K8s..K2s, "99-66" -> 99..66. */
function dashLabels(token: string): string[] {
  const [a, b] = token.split('-').map((x) => x.trim());
  handLabels(a);
  handLabels(b); // throw if either end isn't a valid hand
  const span = (x: number, y: number) => {
    const out: number[] = [];
    for (let r = Math.min(x, y); r <= Math.max(x, y); r++) out.push(r);
    return out;
  };
  if (a[0] === a[1] && b[0] === b[1]) return span(RANKS.indexOf(a[0]), RANKS.indexOf(b[0])).map((r) => RANKS[r] + RANKS[r]);
  if (a[0] !== b[0] || a.slice(2) !== b.slice(2))
    throw new Error(`bad range token: ${token} (use the same top card and suit type, e.g. K8s-K2s)`);
  return span(RANKS.indexOf(a[1]), RANKS.indexOf(b[1])).flatMap((k) => handLabels(a[0] + RANKS[k] + a.slice(2)));
}

export function combosOfLabel(label: string): Combo[] {
  if (label.length === 4) {
    const a = parseCard(label.slice(0, 2)), b = parseCard(label.slice(2));
    return [a > b ? [a, b] : [b, a]];
  }
  const r1 = RANKS.indexOf(label[0]), r2 = RANKS.indexOf(label[1]);
  const hi = Math.max(r1, r2), lo = Math.min(r1, r2);
  return COMBOS.filter((c) => {
    if (rankOf(c[0]) !== hi || rankOf(c[1]) !== lo) return false;
    const suited = suitOf(c[0]) === suitOf(c[1]);
    return r1 === r2 || (label[2] === 's') === suited;
  });
}

/** Range text -> Map(combo index 0..1325 -> weight). */
export function parseRange(text: string): Map<number, number> {
  const weights = new Map<number, number>();
  for (const raw0 of text.split(',')) {
    const raw = raw0.trim();
    if (!raw) continue;
    const [token, w] = raw.split(':');
    const weight = w ? parseFloat(w) : 1;
    for (const label of handLabels(token)) for (const c of combosOfLabel(label)) weights.set(comboIndex(c[0], c[1]), weight);
  }
  return weights;
}

export interface WeightedRange { combos: Combo[]; weights: number[] }

/** Combos with weight > 0 not touching dead cards, in COMBOS order. */
export function rangeCombos(text: string, dead: Iterable<number>): WeightedRange {
  const deadSet = new Set(dead);
  const w = parseRange(text);
  const combos: Combo[] = [], weights: number[] = [];
  for (const i of [...w.keys()].sort((a, b) => a - b)) {
    const c = COMBOS[i];
    if (w.get(i)! > 0 && !deadSet.has(c[0]) && !deadSet.has(c[1])) {
      combos.push(c);
      weights.push(w.get(i)!);
    }
  }
  return { combos, weights };
}
