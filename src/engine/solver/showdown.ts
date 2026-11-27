// Exact showdown math with card removal. Mirror: python/gto/solver/showdown.py
// (its docstring explains the sorted-sweep trick).

import type { Card, Combo } from '@/engine/cards';
import { score } from '@/engine/eval';

export interface Split { beat: Float64Array; lose: Float64Array; total: Float64Array }

export class Matchup {
  private myScore: number[];
  private theirScore: number[];
  private myOrder: number[];
  private theirOrder: number[];
  private same: number[];

  constructor(private mine: Combo[], private theirs: Combo[], board: Card[]) {
    this.myScore = mine.map((h) => score([...h, ...board]));
    this.theirScore = theirs.map((v) => score([...v, ...board]));
    const order = (s: number[]) => s.map((_, i) => i).sort((a, b) => s[a] - s[b] || a - b);
    this.myOrder = order(this.myScore);
    this.theirOrder = order(this.theirScore);
    const pos = new Map(theirs.map((c, j) => [c[0] * 52 + c[1], j]));
    this.same = mine.map((h) => pos.get(h[0] * 52 + h[1]) ?? -1);
  }

  /** Opponent weight each of my hands beats, loses to, and can face at all (blockers removed). */
  split(theirReach: ArrayLike<number>): Split {
    const n = this.mine.length;
    const beat = new Float64Array(n), lose = new Float64Array(n), total = new Float64Array(n);
    const { mine, theirs, myScore, theirScore, myOrder, theirOrder } = this;

    let all = 0;
    const cardW = new Float64Array(52);
    for (let k = 0; k < theirs.length; k++) {
      const r = theirReach[k];
      all += r;
      cardW[theirs[k][0]] += r;
      cardW[theirs[k][1]] += r;
    }
    for (let i = 0; i < n; i++) {
      const same = this.same[i] >= 0 ? theirReach[this.same[i]] : 0;
      total[i] = all - cardW[mine[i][0]] - cardW[mine[i][1]] + same;
    }

    // Upward sweep: weight strictly weaker than each of my hands.
    let cum = 0, j = 0;
    let cumCard = new Float64Array(52);
    for (const i of myOrder) {
      while (j < theirOrder.length && theirScore[theirOrder[j]] < myScore[i]) {
        const k = theirOrder[j], r = theirReach[k];
        cum += r;
        cumCard[theirs[k][0]] += r;
        cumCard[theirs[k][1]] += r;
        j++;
      }
      beat[i] = cum - cumCard[mine[i][0]] - cumCard[mine[i][1]];
    }

    // Downward sweep: weight strictly stronger.
    cum = 0;
    j = theirOrder.length - 1;
    cumCard = new Float64Array(52);
    for (let o = myOrder.length - 1; o >= 0; o--) {
      const i = myOrder[o];
      while (j >= 0 && theirScore[theirOrder[j]] > myScore[i]) {
        const k = theirOrder[j], r = theirReach[k];
        cum += r;
        cumCard[theirs[k][0]] += r;
        cumCard[theirs[k][1]] += r;
        j--;
      }
      lose[i] = cum - cumCard[mine[i][0]] - cumCard[mine[i][1]];
    }
    return { beat, lose, total };
  }
}
