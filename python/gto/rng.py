"""Seeded random number generator (mulberry32).

Same algorithm as src/engine/rng.ts. The same seed gives the exact same numbers in
both languages, which lets the tests prove the Python and TypeScript engines agree.

JavaScript does this math on 32-bit integers; Python integers never overflow, so we
mask with & 0xFFFFFFFF after each step to get the same 32-bit wraparound.
"""
from __future__ import annotations

import math
from typing import Callable

Rng = Callable[[], float]  # returns a float in [0, 1), like random.random()

MASK = 0xFFFFFFFF


def _imul(x: int, y: int) -> int:
    """32-bit multiply (JavaScript's Math.imul), as an unsigned bit pattern."""
    return (x * y) & MASK


def mulberry32(seed: int) -> Rng:
    a = seed & MASK

    def rng() -> float:
        nonlocal a
        a = (a + 0x6D2B79F5) & MASK
        t = _imul(a ^ (a >> 15), 1 | a)
        t = ((t + _imul(t ^ (t >> 7), 61 | t)) & MASK) ^ t
        return ((t ^ (t >> 14)) & MASK) / 4294967296

    return rng


def rand_int(rng: Rng, n: int) -> int:
    """Random integer in [0, n)."""
    return math.floor(rng() * n)
