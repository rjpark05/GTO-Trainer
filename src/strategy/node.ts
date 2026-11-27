// The one data shape every strategy view reads (matrix, coach card, review).
// Both sources produce it: approx/ (live EV engine) and solved/ (precomputed solver tables).

export type StrategySource = 'equilibrium' | 'approximation';

export interface ActionDef {
  id: string; // e.g. "x", "f", "c", "b33", "r75", "allin"
  label: string; // e.g. "Bet 33%"
  kind: 'fold' | 'check' | 'call' | 'bet' | 'raise' | 'allin';
  sizePct?: number; // fraction of pot, for bets/raises
}

export interface StrategyNode {
  source: StrategySource; // UI must label "approximation" unless this is a solved spot
  path: string[]; // action ids from the root of the postflop tree
  board: string[]; // e.g. ["Qs","Jd","4c"]
  player: 'OOP' | 'IP';
  pot: number; // bb
  actions: ActionDef[];
  /** Reach weight per combo (length 1326). 0 = not in range / blocked. */
  range: Float32Array;
  /** Frequencies, combo-major: strat[combo * actions.length + a]. */
  strat: Float32Array;
  /** EV in bb, same layout as strat. */
  ev: Float32Array;
}
