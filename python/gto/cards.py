"""Cards, combos, and the 13x13 grid. Mirror of src/engine/cards/index.ts.

A card is an int 0..51:  card = rank * 4 + suit
  rank 0..12 = 2,3,4,5,6,7,8,9,T,J,Q,K,A
  suit 0..3  = s,h,d,c   (same order as the legacy app)
So "Ah" = 12*4 + 1 = 49 and "2s" = 0.
"""
from __future__ import annotations

from typing import Dict, List, Tuple

RANKS = "23456789TJQKA"
SUITS = "shdc"

Card = int
Combo = Tuple[Card, Card]  # always (higher id, lower id)


def rank_of(c: Card) -> int:
    return c >> 2  # same as c // 4


def suit_of(c: Card) -> int:
    return c & 3  # same as c % 4


def parse_card(s: str) -> Card:
    if len(s) != 2 or s[0].upper() not in RANKS or s[1].lower() not in SUITS:
        raise ValueError(f"bad card: {s}")
    return RANKS.index(s[0].upper()) * 4 + SUITS.index(s[1].lower())


def parse_cards(s: str) -> List[Card]:
    """'AhKd' -> [49, 46]"""
    return [parse_card(s[i:i + 2]) for i in range(0, len(s), 2)]


def card_str(c: Card) -> str:
    return RANKS[rank_of(c)] + SUITS[suit_of(c)]


# All 1326 two-card combos in a fixed order (same order as the TypeScript version).
COMBOS: List[Combo] = [(a, b) for a in range(51, -1, -1) for b in range(a - 1, -1, -1)]
_COMBO_INDEX: Dict[Combo, int] = {c: i for i, c in enumerate(COMBOS)}


def combo_index(x: Card, y: Card) -> int:
    return _COMBO_INDEX[(max(x, y), min(x, y))]


def grid_cell(combo: Combo) -> Tuple[int, int]:
    """(row, col) in the 13x13 grid. Row/col 0 = Ace.
    Pairs on the diagonal, suited above it (row < col), offsuit below."""
    hi = 12 - rank_of(combo[0])
    lo = 12 - rank_of(combo[1])
    suited = suit_of(combo[0]) == suit_of(combo[1])
    if hi == lo:
        return hi, hi
    return (hi, lo) if suited else (lo, hi)


def cell_label(row: int, col: int) -> str:
    """'AKs', 'QQ', 'T9o' for a grid cell."""
    a = RANKS[12 - min(row, col)]
    b = RANKS[12 - max(row, col)]
    if row == col:
        return a + b
    return a + b + ("s" if row < col else "o")


# Combo indices in each of the 169 cells, keyed row * 13 + col.
CELL_COMBOS: List[List[int]] = [[] for _ in range(169)]
for _i, _c in enumerate(COMBOS):
    _r, _col = grid_cell(_c)
    CELL_COMBOS[_r * 13 + _col].append(_i)
