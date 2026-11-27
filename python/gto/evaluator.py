"""Hand evaluator. Mirror of src/engine/eval/index.ts (ported from legacy score()).

score(cards) takes 5-7 cards and returns one number: higher = better hand.
The number packs the category and up to five tiebreak ranks in base 13:

    score = category * 13**5 + r1 * 13**4 + r2 * 13**3 + ... + r5

so comparing two scores with > compares category first, then kickers in order.
Example: a pair of kings with A,Q,7 kickers is pack(1, [11, 12, 10, 5]).
"""
from __future__ import annotations

from typing import List, Sequence

from .cards import Card

CATEGORY_NAMES = [
    "high card", "pair", "two pair", "trips", "straight",
    "flush", "full house", "quads", "straight flush",
]

CATEGORY_BASE = 13 ** 5  # 371293


def category_of(score_value: int) -> int:
    """0..8, an index into CATEGORY_NAMES."""
    return score_value // CATEGORY_BASE


def straight_high(mask: int) -> int:
    """Highest straight in a rank bitmask (bit r set = rank r present), or -1.
    Returns the straight's top rank; 3 means the wheel A-2-3-4-5 (top card 5)."""
    for high in range(12, 3, -1):
        five = 0b11111 << (high - 4)
        if mask & five == five:
            return high
    wheel = 0x100F  # A (bit 12) + 2,3,4,5 (bits 0-3)
    return 3 if mask & wheel == wheel else -1


def pack(category: int, ranks: List[int]) -> int:
    x = category
    for i in range(5):
        x = x * 13 + (ranks[i] if i < len(ranks) else 0)
    return x


def score(cards: Sequence[Card]) -> int:
    rank_count = [0] * 13
    suit_count = [0] * 4
    suit_mask = [0] * 4  # per suit: bitmask of ranks
    rank_mask = 0  # all ranks present
    for c in cards:
        r, s = c >> 2, c & 3
        rank_count[r] += 1
        suit_count[s] += 1
        suit_mask[s] |= 1 << r
        rank_mask |= 1 << r

    # Flush or straight flush. (With 7 cards a flush rules out quads and full houses.)
    for s in range(4):
        if suit_count[s] >= 5:
            sf = straight_high(suit_mask[s])
            if sf >= 0:
                return pack(8, [sf])
            top = [r for r in range(12, -1, -1) if suit_mask[s] >> r & 1][:5]
            return pack(5, top)

    # Group ranks, highest first.
    quad = -1
    trips: List[int] = []
    pairs: List[int] = []
    for r in range(12, -1, -1):
        if rank_count[r] == 4:
            quad = r
        elif rank_count[r] == 3:
            trips.append(r)
        elif rank_count[r] == 2:
            pairs.append(r)

    def kickers(used: List[int], n: int) -> List[int]:
        """Top n ranks present, skipping the ones already used."""
        return [r for r in range(12, -1, -1) if rank_count[r] and r not in used][:n]

    if quad >= 0:
        return pack(7, [quad] + kickers([quad], 1))
    if trips and (len(trips) > 1 or pairs):
        second = max(trips[1] if len(trips) > 1 else -1, pairs[0] if pairs else -1)
        return pack(6, [trips[0], second])
    st = straight_high(rank_mask)
    if st >= 0:
        return pack(4, [st])
    if trips:
        return pack(3, [trips[0]] + kickers([trips[0]], 2))
    if len(pairs) >= 2:
        return pack(2, [pairs[0], pairs[1]] + kickers([pairs[0], pairs[1]], 1))
    if pairs:
        return pack(1, [pairs[0]] + kickers([pairs[0]], 3))
    return pack(0, kickers([], 5))
