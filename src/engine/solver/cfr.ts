// Heads-up river Nash equilibrium solver (CFR+). Mirror: python/gto/solver/cfr.py
// Read the Python docstring for how CFR+ works and what the values mean.

import type { Card } from '@/engine/cards';
import type { WeightedRange } from '@/engine/ranges';
import { Matchup } from './showdown';
import { buildTree, type TreeConfig, type TreeNode } from './tree';

type Vec = Float64Array;

export interface NodeReport {
  reach: Vec; // how much of each hand of the acting player gets here
  strategy: Vec; // [hand * nActions + action]
  ev: Vec; // [hand * nActions + action], bb
}

export class RiverSolver {
  readonly root: TreeNode;
  readonly nodes: TreeNode[];
  readonly ranges: [WeightedRange, WeightedRange];
  iterations = 0;
  private weights: [Vec, Vec];
  private matchups: [Matchup, Matchup];
  private regret: Vec[];
  private stratSum: Vec[];

  constructor(readonly board: Card[], oop: WeightedRange, ip: WeightedRange, readonly cfg: TreeConfig) {
    this.ranges = [oop, ip];
    this.weights = [Float64Array.from(oop.weights), Float64Array.from(ip.weights)];
    ({ root: this.root, nodes: this.nodes } = buildTree(cfg));
    this.matchups = [new Matchup(oop.combos, ip.combos, board), new Matchup(ip.combos, oop.combos, board)];
    const sizes = this.nodes.map((n) => this.ranges[n.player].combos.length * n.actions.length);
    this.regret = sizes.map((s) => new Float64Array(s));
    this.stratSum = sizes.map((s) => new Float64Array(s));
  }

  // ---- strategies ----

  /** Regret matching: actions in proportion to positive regret (uniform if none). */
  currentStrategy(node: TreeNode): Vec {
    return normalizeRows(this.regret[node.id], node.actions.length);
  }

  /** Iteration-weighted average of every strategy played: the converged answer. */
  averageStrategy(node: TreeNode): Vec {
    return normalizeRows(this.stratSum[node.id], node.actions.length);
  }

  // ---- payoffs ----

  private terminal(node: TreeNode, p: number, oppReach: Vec): Vec {
    const { beat, lose, total } = this.matchups[p].split(oppReach);
    const mine = node.contrib[p];
    const out = new Float64Array(total.length);
    if (node.kind === 'fold') {
      const payoff = node.player === p ? -mine : this.cfg.pot + node.contrib[node.player];
      for (let h = 0; h < out.length; h++) out[h] = payoff * total[h];
      return out;
    }
    const potTotal = this.cfg.pot + node.contrib[0] + node.contrib[1];
    for (let h = 0; h < out.length; h++)
      out[h] = potTotal * (beat[h] + 0.5 * (total[h] - beat[h] - lose[h])) - mine * total[h];
    return out;
  }

  // ---- CFR+ ----

  solve(iterations: number): void {
    for (let i = 0; i < iterations; i++) {
      this.iterations++;
      for (const p of [0, 1]) this.cfr(this.root, p, this.weights[p], this.weights[1 - p]);
    }
  }

  private cfr(node: TreeNode, p: number, myReach: Vec, oppReach: Vec): Vec {
    if (node.kind !== 'action') return this.terminal(node, p, oppReach);
    const A = node.actions.length;
    const sigma = this.currentStrategy(node);

    if (node.player !== p) {
      const result = new Float64Array(myReach.length);
      node.children.forEach((child, a) => {
        const v = this.cfr(child, p, myReach, scaleBy(oppReach, sigma, A, a));
        for (let h = 0; h < result.length; h++) result[h] += v[h];
      });
      return result;
    }

    const n = myReach.length;
    const actionVals = node.children.map((child, a) => this.cfr(child, p, scaleBy(myReach, sigma, A, a), oppReach));
    const nodeVal = new Float64Array(n);
    for (let h = 0; h < n; h++) {
      let v = 0;
      for (let a = 0; a < A; a++) v += sigma[h * A + a] * actionVals[a][h];
      nodeVal[h] = v;
    }
    const reg = this.regret[node.id], ss = this.stratSum[node.id], t = this.iterations;
    for (let h = 0; h < n; h++)
      for (let a = 0; a < A; a++) {
        const i = h * A + a;
        reg[i] = Math.max(0, reg[i] + actionVals[a][h] - nodeVal[h]);
        ss[i] += t * myReach[h] * sigma[i];
      }
    return nodeVal;
  }

  // ---- measuring ----

  private evaluate(node: TreeNode, p: number, myReach: Vec, oppReach: Vec, bestResponse: boolean,
                   report?: Map<number, NodeReport>): Vec {
    if (node.kind !== 'action') return this.terminal(node, p, oppReach);
    const A = node.actions.length;
    const sigma = this.averageStrategy(node);

    if (node.player !== p) {
      const result = new Float64Array(myReach.length);
      node.children.forEach((child, a) => {
        const v = this.evaluate(child, p, myReach, scaleBy(oppReach, sigma, A, a), bestResponse, report);
        for (let h = 0; h < result.length; h++) result[h] += v[h];
      });
      return result;
    }

    const n = myReach.length;
    const actionVals = node.children.map((child, a) =>
      this.evaluate(child, p, scaleBy(myReach, sigma, A, a), oppReach, bestResponse, report));
    const nodeVal = new Float64Array(n);
    for (let h = 0; h < n; h++) {
      let v = bestResponse ? -Infinity : 0;
      for (let a = 0; a < A; a++)
        v = bestResponse ? Math.max(v, actionVals[a][h]) : v + sigma[h * A + a] * actionVals[a][h];
      nodeVal[h] = v;
    }

    if (report) {
      const { total } = this.matchups[p].split(oppReach);
      const ev = new Float64Array(n * A);
      for (let h = 0; h < n; h++)
        for (let a = 0; a < A; a++) ev[h * A + a] = total[h] > 0 ? actionVals[a][h] / total[h] : 0;
      report.set(node.id, { reach: Float64Array.from(myReach), strategy: sigma, ev });
    }
    return nodeVal;
  }

  private pairMass(): number {
    const { total } = this.matchups[0].split(this.weights[1]);
    let m = 0;
    for (let h = 0; h < total.length; h++) m += this.weights[0][h] * total[h];
    return m;
  }

  /** Player p's average EV in bb over all hand matchups. */
  value(p: number, bestResponse = false): number {
    const cfv = this.evaluate(this.root, p, this.weights[p], this.weights[1 - p], bestResponse);
    let s = 0;
    for (let h = 0; h < cfv.length; h++) s += this.weights[p][h] * cfv[h];
    return s / this.pairMass();
  }

  /** Average gain of a perfect exploiter, bb. 0 = exact Nash equilibrium. */
  exploitability(): number {
    return (this.value(0, true) + this.value(1, true) - this.cfg.pot) / 2;
  }

  exploitabilityPct(): number {
    return (100 * this.exploitability()) / this.cfg.pot;
  }

  /** Strategy, EV and reach for every decision node, keyed by node id. */
  report(): Map<number, NodeReport> {
    const out = new Map<number, NodeReport>();
    for (const p of [0, 1]) this.evaluate(this.root, p, this.weights[p], this.weights[1 - p], false, out);
    return out;
  }
}

function normalizeRows(src: Vec, A: number): Vec {
  const out = new Float64Array(src.length);
  for (let h = 0; h < src.length / A; h++) {
    let total = 0;
    for (let a = 0; a < A; a++) total += src[h * A + a];
    for (let a = 0; a < A; a++) out[h * A + a] = total > 0 ? src[h * A + a] / total : 1 / A;
  }
  return out;
}

/** reach[h] * sigma[h][a] for every hand. */
function scaleBy(reach: Vec, sigma: Vec, A: number, a: number): Vec {
  const out = new Float64Array(reach.length);
  for (let h = 0; h < reach.length; h++) out[h] = reach[h] * sigma[h * A + a];
  return out;
}
