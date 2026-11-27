// Records reference outputs from the ORIGINAL app (legacy/index.html) so the new
// TypeScript engine (src/engine) and the Python engine (python/gto) can be checked
// against it. Run: node tools/extract-legacy/record-fixtures.mjs
//
// It copies the legacy functions out of the HTML as text, runs them in a sandbox
// with Math.random replaced by a seeded generator, and writes tests/fixtures/*.json.

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const html = readFileSync(join(root, 'legacy/index.html'), 'utf8');

/** Source of `function name(...) {...}` found by brace matching. */
function fnSource(name) {
  const start = html.indexOf(`function ${name}(`);
  if (start < 0) throw new Error(`legacy function not found: ${name}`);
  let i = html.indexOf('{', start), depth = 0;
  for (; i < html.length; i++) {
    if (html[i] === '{') depth++;
    else if (html[i] === '}' && --depth === 0) return html.slice(start, i + 1);
  }
  throw new Error(`unbalanced braces in ${name}`);
}

/** The evaluator block: CR, CS, strHigh, pack, RC, score, catOf. */
function evaluatorBlock() {
  const a = html.indexOf('/* ---------- postflop: evaluator ---------- */');
  const b = html.indexOf('function combosOf(');
  if (a < 0 || b < 0) throw new Error('evaluator block markers not found');
  return html.slice(a, b);
}

// Same generator as src/engine/rng.ts and python/gto/rng.py.
const MULBERRY = `function mulberry32(a){return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;}}`;

const code = [
  MULBERRY,
  evaluatorBlock(),
  fnSource('equity'),
  fnSource('sampler'),
  fnSource('drawFrom'),
  fnSource('eqW'),
  // expose to the outside of the sandbox
  'globalThis.L={mulberry32,score,catOf,equity,sampler,drawFrom,eqW};',
].join('\n');

const ctx = vm.createContext({});
vm.runInContext(code, ctx);
const L = ctx.L;
const seed = (s) => vm.runInContext(`Math.random=L.mulberry32(${s});`, ctx);

// ---- helpers (driven by their own seeded generator, separate from the sandbox) ----
const gen = L.mulberry32(20261127);
const pick = (n, exclude = new Set()) => {
  const out = [];
  while (out.length < n) {
    const c = (gen() * 52) | 0;
    if (!exclude.has(c)) { exclude.add(c); out.push(c); }
  }
  return out;
};
// legacy card ids: rank*4+suit, rank 0..12 = 2..A, suit s=0 h=1 d=2 c=3
const R = '23456789TJQKA', S = 'shdc';
const card = (s) => R.indexOf(s[0]) * 4 + S.indexOf(s[1]);
const cards = (s) => s.match(/../g).map(card);
/** Every combo of the given grid hands not touching dead cards, e.g. ["AA","KQs","T9o"]. */
function comboList(hands, dead) {
  const out = [];
  for (const h of hands) {
    const r1 = R.indexOf(h[0]), r2 = R.indexOf(h[1]);
    for (let a = 0; a < 4; a++)
      for (let b = 0; b < 4; b++) {
        if (r1 === r2 ? b <= a : h[2] === 's' ? a !== b : a === b) continue;
        const c = [r1 * 4 + a, r2 * 4 + b];
        if (!dead.has(c[0]) && !dead.has(c[1])) out.push(c);
      }
  }
  return out;
}

// ---- 1. RNG stream ----
const rngGen = L.mulberry32(12345);
const rng = { seed: 12345, values: Array.from({ length: 20 }, () => rngGen()) };

// ---- 2. evaluator: hand-picked edge cases + random 5/6/7-card hands ----
const EDGE = [
  'AsKsQsJsTs', '5h4h3h2hAh', 'AsAhAdAcKs', 'KsKhKdQsQh2c3d', 'AsKdQhJcTs', '5s4d3h2cAd',
  'AsKsQs9s2s', 'AhAdAs7c7d', '9s9h9d8c8h8s2d', '7s7h5d5c3s3h2d', 'AsAhKdKc9s', 'Qs8d6h4c2s',
  'AsAdKs', 'AsKs', 'Ts9s8s7s6s5s4s', 'AhKhQhJh9h8h7h',
];
const evalCases = EDGE.map((s) => cards(s));
for (let i = 0; i < 3000; i++) evalCases.push(pick(5 + (i % 3)));
const evaluator = evalCases.map((cs) => ({ cards: cs, score: L.score(cs), cat: L.catOf(L.score(cs)) }));

// ---- 3. equity() (flop only, villain = list of combos) ----
const EQ = [
  { hero: 'AsKs', flop: 'Qs7d2c', vills: [['QQ', 'JJ', 'TT', 'AQs', 'KQs', 'QJs']] },
  { hero: 'Th9h', flop: '8h7c2h', vills: [['AA', 'KK', 'AKo', 'AKs', '88', '77']] },
  { hero: '5c5d', flop: 'AsKhQd', vills: [['AJs', 'KJs', 'JTs', 'T9s'], ['22', '33', '44']] },
  { hero: 'AhAd', flop: '9s8s7s', vills: [['KK', 'QQ', 'T9s', '65s', 'AKs']] },
];
const equity = [];
for (const e of EQ)
  for (const s of [1, 2, 3]) {
    const hero = cards(e.hero), flop = cards(e.flop), dead = new Set([...hero, ...flop]);
    const vills = e.vills.map((v) => comboList(v, dead));
    seed(s);
    const iters = 600;
    equity.push({ hero, flop, vills, iters, seed: s, result: L.equity(hero, flop, vills, iters) });
  }

// ---- 4. eqW() (weighted samplers, any board length) ----
const EQW = [
  { hero: 'AsKs', board: 'Qs7d2c', vills: [[['QQ', 1], ['AQs', 0.5], ['76s', 0.25]]] },
  { hero: 'JcTc', board: '9c8d2h3s', vills: [[['AA', 1], ['KQo', 0.7]], [['99', 1], ['22', 0.3]]] },
  { hero: 'KhKd', board: 'Ah7s2d5c9h', vills: [[['AKo', 1], ['A5s', 0.4], ['QJs', 0.2]]] },
  { hero: '7h6h', board: 'Th9h2c', vills: [[]] }, // empty range -> random-hand fallback
];
const eqw = [];
for (const e of EQW)
  for (const s of [7, 8]) {
    const hero = cards(e.hero), board = cards(e.board), dead = new Set([...hero, ...board]);
    const lists = e.vills.map((v) => v.flatMap(([h, w]) => comboList([h], dead).map((c) => ({ c, w }))));
    const samplers = lists.map((l) => L.sampler(l));
    seed(s);
    const iters = 500;
    eqw.push({ hero, board, vills: lists, iters, seed: s, result: L.eqW(hero, board, samplers, iters) });
  }

const out = join(root, 'tests/fixtures');
mkdirSync(out, { recursive: true });
const write = (name, data) => writeFileSync(join(out, name), JSON.stringify(data) + '\n');
write('rng.json', rng);
write('evaluator.json', evaluator);
write('equity.json', equity);
write('eqw.json', eqw);
console.log(`wrote ${evaluator.length} evaluator, ${equity.length} equity, ${eqw.length} eqW cases`);
