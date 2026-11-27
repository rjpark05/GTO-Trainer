"""Monte Carlo equity. Mirror of src/engine/equity/index.ts (legacy equity() and eqW()).

Equity = how often hero wins at showdown, with ties split. Each iteration:
  1. give every villain a random hand from their range (skipping cards already used)
  2. deal the rest of the board at random
  3. compare scores: win = 1, n-way tie = 1/n, loss = 0
The answer is the average over all iterations.

Every function takes an rng so results are reproducible: same seed, same answer.
The order of random draws matches the TypeScript exactly, so given the same seed both
versions return the identical float.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import List, Optional, Sequence

from .cards import Card, Combo
from .evaluator import score
from .rng import Rng, rand_int


def showdown_share(hero: Sequence[Card], villains: Sequence[Combo], board: Sequence[Card]) -> float:
    """Hero's share of the pot for one runout: 1 win, 1/(k+1) for a k-way split, 0 loss."""
    hero_score = score([*hero, *board])
    best, ties = -1, 0  # best villain score and how many villains share it
    for v in villains:
        s = score([*v, *board])
        if s > best:
            best, ties = s, 0
        elif s == best:
            ties += 1
    if hero_score > best:
        return 1.0
    if hero_score == best:
        return 1 / (ties + 2)
    return 0.0


def _deal_runout(board: Sequence[Card], used: List[int], rng: Rng) -> List[Card]:
    runout = list(board)
    while len(runout) < 5:
        c = rand_int(rng, 52)
        if not used[c]:
            used[c] = 1
            runout.append(c)
    return runout


def equity(hero: Sequence[Card], board: Sequence[Card], villain_ranges: Sequence[Sequence[Combo]],
           iters: int, rng: Rng) -> float:
    """Equity vs villains whose ranges are plain combo lists (every combo equally likely)."""
    total, n = 0.0, 0
    for _ in range(iters):
        used = [0] * 52
        for c in [*hero, *board]:
            used[c] = 1

        # Deal villain hands: up to 40 tries per villain to find an unblocked combo.
        villains: List[Combo] = []
        ok = True
        for vrange in villain_ranges:
            got: Optional[Combo] = None
            for _t in range(40):
                c = vrange[rand_int(rng, len(vrange))]
                if not used[c[0]] and not used[c[1]]:
                    got = c
                    break
            if got is None:
                ok = False  # skip this iteration entirely
                break
            used[got[0]] = used[got[1]] = 1
            villains.append(got)
        if not ok:
            continue

        total += showdown_share(hero, villains, _deal_runout(board, used, rng))
        n += 1
    return total / n if n else 0.0


# ---- weighted ranges ----

@dataclass
class Sampler:
    """Prepared weighted range: drawing picks combo i with probability w_i / total."""
    items: List[Combo] = field(default_factory=list)
    cum: List[float] = field(default_factory=list)  # running total of weights
    total: float = 0.0


def make_sampler(weighted: Sequence[dict]) -> Sampler:
    """weighted: [{"c": (card, card), "w": weight}, ...]"""
    s = Sampler()
    for x in weighted:
        if x["w"] > 1e-6:
            s.total += x["w"]
            s.items.append(tuple(x["c"]))
            s.cum.append(s.total)
    return s


def draw_from(s: Sampler, used: List[int], rng: Rng) -> Optional[Combo]:
    """Draw one unblocked combo (30 tries), or None. Binary search on the running total."""
    if not s.total:
        return None
    for _ in range(30):
        r = rng() * s.total
        lo, hi = 0, len(s.cum) - 1
        while lo < hi:
            mid = (lo + hi) >> 1
            if s.cum[mid] < r:
                lo = mid + 1
            else:
                hi = mid
        c = s.items[lo]
        if not used[c[0]] and not used[c[1]]:
            return c
    return None


def equity_weighted(hero: Sequence[Card], board: Sequence[Card], samplers: Sequence[Sampler],
                    iters: int, rng: Rng) -> float:
    """Equity vs weighted ranges, any board length (0-5 cards). Legacy eqW().
    If a villain's range is empty or fully blocked, they get a random hand instead."""
    total, n = 0.0, 0
    for _ in range(iters):
        used = [0] * 52
        for c in [*hero, *board]:
            used[c] = 1

        villains: List[Combo] = []
        for s in samplers:
            c = draw_from(s, used, rng)
            if c is None:
                g = 0
                while True:  # same as the JS do/while: draw at least once
                    c = (rand_int(rng, 52), rand_int(rng, 52))
                    g += 1
                    if not ((used[c[0]] or used[c[1]] or c[0] == c[1]) and g < 50):
                        break
            used[c[0]] = used[c[1]] = 1
            villains.append(c)

        total += showdown_share(hero, villains, _deal_runout(board, used, rng))
        n += 1
    return total / n if n else 0.0
