// The one data shape every strategy view reads (matrix, coach card, review).
// Both sources produce it: approx/ (live EV engine) and solved/ (Nash solver).

export type StrategySource = 'equilibrium' | 'approximation';

export interface ActionDef {
  id: string; // e.g. "x", "f", "c", "b33", "r75", "allin"
  label: string; // e.g. "Bet 33%"
  kind: 'fold' | 'check' | 'call' | 'bet' | 'raise' | 'allin';
  amount?: number; // bb this action puts in on the street (total for the street)
}

export interface StrategyNode {
  /** "equilibrium" only for solver output, shown with its exploitability. */
  source: StrategySource;
  exploitabilityPct?: number; // % of pot a perfect exploiter gains; required for "equilibrium"
  path: string[]; // action ids from the root of the street
  board: string[]; // e.g. ["Ks","9h","5d","2c","2h"]
  player: 'OOP' | 'IP';
  pot: number; // bb in the middle before this decision (incl. bets so far)
  actions: ActionDef[];
  /** Reach weight per combo (length 1326). 0 = not in range here / blocked. */
  range: Float32Array;
  /** Frequencies, combo-major: strat[combo * actions.length + a]. */
  strat: Float32Array;
  /** EV in bb, same layout as strat. */
  ev: Float32Array;
}
