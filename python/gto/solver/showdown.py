"""Exact showdown math on a complete board, with card removal. Mirror of
src/engine/solver/showdown.ts.

The solver asks one question over and over: "for each of my hands, how much of the
opponent's (weighted) range do I beat, tie, and lose to?" Opponent hands that share a
card with mine can't exist at the same time, so they must be left out (card removal,
also called blockers).

Checking every pair (mine x theirs) is easy to read but slow: 1000 x 1000 hands is a
million comparisons, many times per iteration. `naive_matchup` does exactly that and
is kept as the reference the tests compare against.

`Matchup.split` gets the same answer in one sorted sweep:
  - sort both ranges weakest to strongest
  - walk up my hands; keep a running total of opponent weight that is strictly weaker
  - that total includes opponent hands that use one of my cards, so also keep a running
    total per card (52 of them) and subtract the totals for my two cards
An opponent hand holding BOTH my cards is my exact hand; it has the same strength, so
it is never in "strictly weaker" and nothing is subtracted twice.
"""
from __future__ import annotations

from typing import List, Sequence, Tuple

from ..cards import Card, Combo
from ..evaluator import score


def naive_matchup(mine: Sequence[Combo], theirs: Sequence[Combo], their_reach: Sequence[float],
                  board: Sequence[Card]) -> Tuple[List[float], List[float], List[float]]:
    """Reference version: (beat, lose, total) weight per hand of mine, checking every pair."""
    beat, lose, total = [], [], []
    for h in mine:
        hs = score([*h, *board])
        b = l = t = 0.0
        for v, r in zip(theirs, their_reach):
            if v[0] in h or v[1] in h:
                continue  # shares a card: impossible
            vs = score([*v, *board])
            t += r
            if hs > vs:
                b += r
            elif hs < vs:
                l += r
        beat.append(b)
        lose.append(l)
        total.append(t)
    return beat, lose, total


class Matchup:
    """Precomputed for one (my range, their range, board). Reused every iteration."""

    def __init__(self, mine: Sequence[Combo], theirs: Sequence[Combo], board: Sequence[Card]):
        self.mine = list(mine)
        self.theirs = list(theirs)
        my_score = [score([*h, *board]) for h in self.mine]
        their_score = [score([*v, *board]) for v in self.theirs]
        self.my_order = sorted(range(len(self.mine)), key=lambda i: (my_score[i], i))
        self.their_order = sorted(range(len(self.theirs)), key=lambda i: (their_score[i], i))
        self.my_score = my_score
        self.their_score = their_score
        # For each of my hands: index of the identical opponent hand, or -1.
        pos = {c: j for j, c in enumerate(self.theirs)}
        self.same = [pos.get(h, -1) for h in self.mine]

    def split(self, their_reach: Sequence[float]) -> Tuple[List[float], List[float], List[float]]:
        """(beat, lose, total) opponent weight per hand of mine, blockers removed."""
        n = len(self.mine)
        beat, lose, total = [0.0] * n, [0.0] * n, [0.0] * n

        # Total opponent weight, and per card.
        all_w = 0.0
        card_w = [0.0] * 52
        for v, r in zip(self.theirs, their_reach):
            all_w += r
            card_w[v[0]] += r
            card_w[v[1]] += r
        for i, h in enumerate(self.mine):
            same = their_reach[self.same[i]] if self.same[i] >= 0 else 0.0
            total[i] = all_w - card_w[h[0]] - card_w[h[1]] + same

        # Upward sweep: opponent weight strictly weaker than each of my hands.
        cum, cum_card, j = 0.0, [0.0] * 52, 0
        for i in self.my_order:
            while j < len(self.their_order) and self.their_score[self.their_order[j]] < self.my_score[i]:
                k = self.their_order[j]
                r = their_reach[k]
                cum += r
                cum_card[self.theirs[k][0]] += r
                cum_card[self.theirs[k][1]] += r
                j += 1
            h = self.mine[i]
            beat[i] = cum - cum_card[h[0]] - cum_card[h[1]]

        # Downward sweep: opponent weight strictly stronger.
        cum, cum_card, j = 0.0, [0.0] * 52, len(self.their_order) - 1
        for i in reversed(self.my_order):
            while j >= 0 and self.their_score[self.their_order[j]] > self.my_score[i]:
                k = self.their_order[j]
                r = their_reach[k]
                cum += r
                cum_card[self.theirs[k][0]] += r
                cum_card[self.theirs[k][1]] += r
                j -= 1
            h = self.mine[i]
            lose[i] = cum - cum_card[h[0]] - cum_card[h[1]]

        return beat, lose, total
