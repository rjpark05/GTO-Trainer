// Mirror of python/tests/test_solver.py. The parity test re-solves the spot in
// tests/fixtures/solver.json (written by python/record_solver_fixture.py) and must match.

import { describe, expect, it } from 'vitest';
import { parseCard, rankOf, type Card } from '@/engine/cards';
import { parseRange, rangeCombos } from '@/engine/ranges';
import { RiverSolver, buildTree, type TreeConfig } from '@/engine/solver';
import solverJson from '../fixtures/solver.json';

const cards = (s: string): Card[] => s.match(/../g)!.map(parseCard);

function toySolver() {
  const board = cards('KsQd7h4c2s');
  const oop = rangeCombos('QJ', board);
  const ip = rangeCombos('KK,65s', board);
  const cfg: TreeConfig = { pot: 10, stack: 100, oop_bets: [], ip_bets: [1.0], raises: [], max_raises: 1, allin: false };
  return { s: new RiverSolver(board, oop, ip, cfg), oop, ip };
}

describe('ranges', () => {
  it('counts combos', () => {
    const n = (t: string) => parseRange(t).size;
    expect([n('AA'), n('AKs'), n('AKo'), n('AK'), n('22+'), n('A2s+'), n('KTo+'), n('AhKh')])
      .toEqual([6, 4, 12, 16, 78, 48, 36, 1]);
    expect([n('K8s-K2s'), n('KTo-K8o'), n('99-66')]).toEqual([28, 36, 24]);
    expect(rangeCombos('AA', [parseCard('As')]).combos.length).toBe(3);
  });
});

describe('tree', () => {
  it('turns oversize raises into all-in', () => {
    const { root } = buildTree({ pot: 10, stack: 20, oop_bets: [0.5], ip_bets: [0.5], raises: [1.0], max_raises: 1, allin: true });
    expect(root.actions).toEqual(['x', 'b50', 'allin']);
    expect(root.children[1].actions).toEqual(['f', 'c', 'allin']);
  });
});

describe('equilibrium', () => {
  it('solves the textbook polar-vs-bluffcatcher spot', () => {
    const { s, oop, ip } = toySolver();
    s.solve(1000);
    const rep = s.report();
    const bet = ip.combos.map((_, h) => rep.get(1)!.strategy[h * 2 + 1]);
    const isNuts = ip.combos.map((c) => rankOf(c[0]) === 11);
    bet.forEach((b, h) => isNuts[h] && expect(b).toBeGreaterThan(0.99));
    const air = bet.filter((_, h) => !isNuts[h]);
    expect(air.reduce((a, b) => a + b) / air.length).toBeCloseTo(0.375, 2);
    const call = oop.combos.map((_, h) => rep.get(2)!.strategy[h * 2 + 1]);
    expect(call.reduce((a, b) => a + b) / call.length).toBeCloseTo(0.5, 2);
    expect(s.exploitabilityPct()).toBeLessThan(0.1);
  });

  it('values add up to the pot', () => {
    const { s } = toySolver();
    s.solve(50);
    expect(s.value(0) + s.value(1)).toBeCloseTo(10, 9);
  });
});

describe('matches the Python solver', () => {
  const fx = solverJson as unknown as {
    board: string; oop: string; ip: string; cfg: TreeConfig; iterations: number;
    exploitability_pct: number; root_and_first_strategies: Record<string, number[]>;
  };
  it('same exploitability and strategies after the same iterations', () => {
    const board = cards(fx.board);
    const s = new RiverSolver(board, rangeCombos(fx.oop, board), rangeCombos(fx.ip, board), fx.cfg);
    s.solve(fx.iterations);
    expect(s.exploitabilityPct()).toBeCloseTo(fx.exploitability_pct, 9);
    const rep = s.report();
    for (const [id, strat] of Object.entries(fx.root_and_first_strategies)) {
      const got = rep.get(Number(id))!.strategy;
      strat.forEach((v, i) => expect(got[i]).toBeCloseTo(v, 9));
    }
  });
});
