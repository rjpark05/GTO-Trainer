// Summaries of a StrategyNode for the grid and the strategy bar.
import { CELL_COMBOS } from '@/engine/cards';
import type { StrategyNode } from '@/strategy/node';

export interface CellStat {
  /** Share of the cell's combos in range here, 0..1 (weights and earlier actions included). */
  fill: number;
  /** Action frequencies within the cell, weighted by reach. Sums to 1 when fill > 0. */
  freqs: number[];
}

export function cellStats(node: StrategyNode): CellStat[] {
  const A = node.actions.length;
  return CELL_COMBOS.map((combos) => {
    let reach = 0;
    const freqs = new Array(A).fill(0);
    for (const i of combos) {
      const r = node.range[i];
      if (!r) continue;
      reach += r;
      for (let a = 0; a < A; a++) freqs[a] += r * node.strat[i * A + a];
    }
    return { fill: reach / combos.length, freqs: reach ? freqs.map((f) => f / reach) : freqs };
  });
}

/** Whole-range action frequencies (weighted by reach) and the share of combos in range. */
export function rangeSummary(node: StrategyNode): { freqs: number[]; combos: number } {
  const A = node.actions.length;
  const freqs = new Array(A).fill(0);
  let reach = 0;
  for (let i = 0; i < 1326; i++) {
    const r = node.range[i];
    if (!r) continue;
    reach += r;
    for (let a = 0; a < A; a++) freqs[a] += r * node.strat[i * A + a];
  }
  return { freqs: reach ? freqs.map((f) => f / reach) : freqs, combos: reach };
}
