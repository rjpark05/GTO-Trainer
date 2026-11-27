// Runs the river Nash solver for a spot and turns its output into StrategyNodes.

import { cardStr, comboIndex, parseCard, type Card } from '@/engine/cards';
import { rangeCombos } from '@/engine/ranges';
import { RiverSolver, actionLabel, type NodeReport, type TreeConfig, type TreeNode } from '@/engine/solver';
import type { ActionDef, StrategyNode } from '@/strategy/node';

export interface RiverSpot {
  board: string; // "Ks9h5d2c2h"
  oop: string; // range text
  ip: string;
  tree: TreeConfig;
}

export interface SolveProgress { iterations: number; exploitabilityPct: number }

export interface SolvedRiver {
  solver: RiverSolver;
  report: Map<number, NodeReport>;
  exploitabilityPct: number;
}

export function parseBoard(text: string): Card[] {
  const t = text.replace(/[\s,]/g, '');
  if (t.length !== 10) throw new Error('A river board needs exactly 5 cards, e.g. Ks9h5d2c2h');
  const cards = t.match(/../g)!.map(parseCard);
  if (new Set(cards).size !== 5) throw new Error('Board has a repeated card');
  return cards;
}

/**
 * Solve in small chunks so the page stays responsive. Stops once exploitability is below
 * `targetPct` of the pot, or after `maxIterations`.
 */
export async function solveRiver(
  spot: RiverSpot,
  opts: { targetPct?: number; maxIterations?: number; onProgress?: (p: SolveProgress) => void } = {},
): Promise<SolvedRiver> {
  const { targetPct = 0.2, maxIterations = 2000, onProgress } = opts;
  const board = parseBoard(spot.board);
  const oop = rangeCombos(spot.oop, board), ip = rangeCombos(spot.ip, board);
  if (!oop.combos.length || !ip.combos.length) throw new Error('Both ranges need at least one hand not blocked by the board');
  const solver = new RiverSolver(board, oop, ip, spot.tree);

  let expl = Infinity;
  while (solver.iterations < maxIterations) {
    solver.solve(50);
    expl = solver.exploitabilityPct();
    onProgress?.({ iterations: solver.iterations, exploitabilityPct: expl });
    if (expl < targetPct) break;
    await new Promise((r) => setTimeout(r, 0)); // let the browser repaint
  }
  return { solver, report: solver.report(), exploitabilityPct: expl };
}

function actionDef(id: string, child: TreeNode, player: number): ActionDef {
  const kind: ActionDef['kind'] =
    id === 'x' ? 'check' : id === 'f' ? 'fold' : id === 'c' ? 'call' : id === 'allin' ? 'allin' : id[0] === 'b' ? 'bet' : 'raise';
  const amount = child.contrib[player];
  const label = kind === 'bet' || kind === 'raise' || kind === 'allin' ? `${actionLabel(id)} (${round1(amount)})` : actionLabel(id);
  return { id, label, kind, amount };
}

const round1 = (x: number) => Math.round(x * 10) / 10;

/** One decision node as a StrategyNode, with arrays over all 1326 combos. */
export function toStrategyNode(solved: SolvedRiver, nodeId: number): StrategyNode {
  const { solver, report } = solved;
  const node = solver.nodes[nodeId];
  const rep = report.get(nodeId)!;
  const A = node.actions.length;
  const combos = solver.ranges[node.player].combos;
  const range = new Float32Array(1326), strat = new Float32Array(1326 * A), ev = new Float32Array(1326 * A);
  combos.forEach((c, h) => {
    const i = comboIndex(c[0], c[1]);
    range[i] = rep.reach[h];
    for (let a = 0; a < A; a++) {
      strat[i * A + a] = rep.strategy[h * A + a];
      ev[i * A + a] = rep.ev[h * A + a];
    }
  });
  return {
    source: 'equilibrium',
    exploitabilityPct: solved.exploitabilityPct,
    path: node.path,
    board: solver.board.map(cardStr),
    player: node.player === 0 ? 'OOP' : 'IP',
    pot: solver.cfg.pot + node.contrib[0] + node.contrib[1],
    actions: node.actions.map((id, a) => actionDef(id, node.children[a], node.player)),
    range,
    strat,
    ev,
  };
}
