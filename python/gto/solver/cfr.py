"""Heads-up river Nash equilibrium solver (CFR+). Mirror of src/engine/solver/cfr.ts.

HOW IT WORKS (counterfactual regret minimization, the "+" variant)

Both players start out playing every action equally often. Then, for many iterations:
  1. Walk the whole tree. At each decision, work out what every hand would have won
     with each action, given how both players currently play.
  2. "Regret" = how much better an action did than the hand's current mix. Add it up
     over iterations; in CFR+ a total regret never goes below 0.
  3. Next iteration, each hand plays each action in proportion to its positive regret
     ("regret matching"). Actions that keep doing well get played more.
The strategies played each iteration bounce around, but their AVERAGE converges to a
Nash equilibrium: a pair of strategies where neither player can gain by changing.

Exploitability measures how close we are: how much a perfect opponent who knew our
exact strategy could gain, averaged over both players. 0 = exact equilibrium.

UNITS. Values are in bb, measured from the start of the river with the pot up for
grabs: winning a hand that went check-check is worth +pot, folding to a bet is worth
minus what you put in on the river (0 if you put in nothing).

"cfv" (counterfactual value) below is a list with one number per hand of the player we
are computing for: that hand's payoff summed over every opponent hand, each weighted by
how likely the opponent is to hold it AND to have played to this point.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Dict, List, Optional, Sequence, Tuple

from ..cards import Card, Combo
from .showdown import Matchup
from .tree import Node, TreeConfig, build_tree

Vec = List[float]


@dataclass
class NodeReport:
    """What the UI shows for one decision: the acting player's view."""
    reach: Vec  # how much of each hand gets here (range weight x prior actions)
    strategy: Vec  # flat [hand * n_actions + action] frequencies
    ev: Vec  # flat [hand * n_actions + action] EV in bb (0 for hands that never get here)


class RiverSolver:
    def __init__(self, board: Sequence[Card], oop: Tuple[List[Combo], List[float]],
                 ip: Tuple[List[Combo], List[float]], cfg: TreeConfig):
        self.board = list(board)
        self.cfg = cfg
        self.combos = [list(oop[0]), list(ip[0])]
        self.weights = [list(oop[1]), list(ip[1])]
        self.root, self.nodes = build_tree(cfg)
        self.matchups = [Matchup(self.combos[0], self.combos[1], board),
                         Matchup(self.combos[1], self.combos[0], board)]
        size = [len(self.combos[n.player]) * len(n.actions) for n in self.nodes]
        self.regret = [[0.0] * s for s in size]
        self.strat_sum = [[0.0] * s for s in size]
        self.iterations = 0

    # ---- strategies ----

    def current_strategy(self, node: Node) -> Vec:
        """Regret matching: play actions in proportion to positive regret (uniform if none)."""
        A, reg = len(node.actions), self.regret[node.id]
        out = [0.0] * len(reg)
        for h in range(len(reg) // A):
            row = reg[h * A:(h + 1) * A]
            total = sum(row)
            for a in range(A):
                out[h * A + a] = row[a] / total if total > 0 else 1.0 / A
        return out

    def average_strategy(self, node: Node) -> Vec:
        """The converged answer: the iteration-weighted average of every strategy played."""
        A, ss = len(node.actions), self.strat_sum[node.id]
        out = [0.0] * len(ss)
        for h in range(len(ss) // A):
            total = sum(ss[h * A:(h + 1) * A])
            for a in range(A):
                out[h * A + a] = ss[h * A + a] / total if total > 0 else 1.0 / A
        return out

    # ---- payoffs at the end of the hand ----

    def _terminal(self, node: Node, p: int, opp_reach: Vec) -> Vec:
        beat, lose, total = self.matchups[p].split(opp_reach)
        c0, c1 = node.contrib
        mine = node.contrib[p]
        if node.kind == "fold":
            folder = node.player
            payoff = -mine if folder == p else self.cfg.pot + node.contrib[folder]
            return [payoff * t for t in total]
        pot_total = self.cfg.pot + c0 + c1  # showdown: winner takes all, ties split
        return [pot_total * (b + 0.5 * (t - b - l)) - mine * t for b, l, t in zip(beat, lose, total)]

    # ---- one CFR+ iteration ----

    def solve(self, iterations: int) -> None:
        for _ in range(iterations):
            self.iterations += 1
            for p in (0, 1):  # alternate: update OOP, then IP
                self._cfr(self.root, p, self.weights[p], self.weights[1 - p])

    def _cfr(self, node: Node, p: int, my_reach: Vec, opp_reach: Vec) -> Vec:
        if node.kind != "action":
            return self._terminal(node, p, opp_reach)
        A = len(node.actions)
        sigma = self.current_strategy(node)

        if node.player != p:  # opponent decides: split their reach across actions
            result = [0.0] * len(my_reach)
            for a, child in enumerate(node.children):
                child_opp = [opp_reach[k] * sigma[k * A + a] for k in range(len(opp_reach))]
                for h, v in enumerate(self._cfr(child, p, my_reach, child_opp)):
                    result[h] += v
            return result

        # We decide: value of each action, then of our current mix.
        n = len(my_reach)
        action_vals = []
        for a, child in enumerate(node.children):
            child_reach = [my_reach[h] * sigma[h * A + a] for h in range(n)]
            action_vals.append(self._cfr(child, p, child_reach, opp_reach))
        node_val = [sum(sigma[h * A + a] * action_vals[a][h] for a in range(A)) for h in range(n)]

        reg, ss, t = self.regret[node.id], self.strat_sum[node.id], self.iterations
        for h in range(n):
            for a in range(A):
                i = h * A + a
                reg[i] = max(0.0, reg[i] + action_vals[a][h] - node_val[h])  # CFR+: floor at 0
                ss[i] += t * my_reach[h] * sigma[i]  # later iterations count more
        return node_val

    # ---- measuring the result ----

    def _evaluate(self, node: Node, p: int, my_reach: Vec, opp_reach: Vec, best_response: bool,
                  report: Optional[Dict[int, NodeReport]] = None) -> Vec:
        """cfv for player p when both play the average strategy. With best_response=True,
        p instead picks the best action for each hand (a perfect exploiter)."""
        if node.kind != "action":
            return self._terminal(node, p, opp_reach)
        A = len(node.actions)
        sigma = self.average_strategy(node)

        if node.player != p:
            result = [0.0] * len(my_reach)
            for a, child in enumerate(node.children):
                child_opp = [opp_reach[k] * sigma[k * A + a] for k in range(len(opp_reach))]
                for h, v in enumerate(self._evaluate(child, p, my_reach, child_opp, best_response, report)):
                    result[h] += v
            return result

        n = len(my_reach)
        action_vals = []
        for a, child in enumerate(node.children):
            child_reach = [my_reach[h] * sigma[h * A + a] for h in range(n)]
            action_vals.append(self._evaluate(child, p, child_reach, opp_reach, best_response, report))
        if best_response:
            node_val = [max(action_vals[a][h] for a in range(A)) for h in range(n)]
        else:
            node_val = [sum(sigma[h * A + a] * action_vals[a][h] for a in range(A)) for h in range(n)]

        if report is not None:
            _, _, total = self.matchups[p].split(opp_reach)  # opponent weight still here
            ev = [action_vals[a][h] / total[h] if total[h] > 0 else 0.0
                  for h in range(n) for a in range(A)]
            report[node.id] = NodeReport(reach=list(my_reach), strategy=sigma, ev=ev)
        return node_val

    def _pair_mass(self) -> float:
        _, _, total = self.matchups[0].split(self.weights[1])
        return sum(w * t for w, t in zip(self.weights[0], total))

    def value(self, p: int, best_response: bool = False) -> float:
        """Player p's average EV in bb over all hand matchups."""
        cfv = self._evaluate(self.root, p, self.weights[p], self.weights[1 - p], best_response)
        return sum(w * v for w, v in zip(self.weights[p], cfv)) / self._pair_mass()

    def exploitability(self) -> float:
        """Average gain of a perfect exploiter, in bb. Values of the two players add up to
        the pot at any strategy pair, so (BR_OOP + BR_IP - pot) / 2 is >= 0."""
        return (self.value(0, True) + self.value(1, True) - self.cfg.pot) / 2

    def exploitability_pct(self) -> float:
        return 100 * self.exploitability() / self.cfg.pot

    def report(self) -> Dict[int, NodeReport]:
        """Strategy, EV and reach for every decision, keyed by node id."""
        out: Dict[int, NodeReport] = {}
        for p in (0, 1):
            self._evaluate(self.root, p, self.weights[p], self.weights[1 - p], False, out)
        return out
