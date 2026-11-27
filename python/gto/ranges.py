"""Range text -> weighted combos. Mirror of src/engine/ranges/index.ts.

Range text is comma separated. Each token is one of:
    AA        a pair (6 combos)
    AKs       suited (4 combos)      AKo  offsuit (12)      AK  both (16)
    22+       pairs 22 up to AA
    A2s+      A2s, A3s, ... AKs  (the kicker climbs up to one below the top card)
    KTo+      KTo, KJo, KQo
    K8s-K2s   K8s down to K2s (same top card)      99-66  99, 88, 77, 66
    AhKh      one exact combo
Add ":weight" to any token for a partial weight, e.g. "AA:0.5,KQs:0.25".
Later tokens overwrite earlier ones.
"""
from __future__ import annotations

from typing import Dict, Iterable, List, Tuple

from .cards import COMBOS, RANKS, Combo, combo_index, parse_card, rank_of, suit_of


def _hand_labels(token: str) -> List[str]:
    """Expand one token (no weight) into grid labels or exact combos like 'AhKh'."""
    t = token.strip()
    if len(t) == 4 and t[1] in "shdc" and t[3] in "shdc":
        return [t]  # exact combo
    if "-" in t:
        return _dash_labels(t)
    plus = t.endswith("+")
    if plus:
        t = t[:-1]
    if len(t) not in (2, 3) or t[0] not in RANKS or t[1] not in RANKS:
        raise ValueError(f"bad range token: {token}")
    hi, lo = RANKS.index(t[0]), RANKS.index(t[1])
    kind = t[2] if len(t) == 3 else ""
    if kind not in ("", "s", "o"):
        raise ValueError(f"bad range token: {token}")
    if hi < lo:
        hi, lo = lo, hi

    if hi == lo:  # pairs
        ranks = range(hi, 13) if plus else [hi]
        return [RANKS[r] * 2 for r in ranks]
    kickers = range(lo, hi) if plus else [lo]
    kinds = [kind] if kind else ["s", "o"]
    return [RANKS[hi] + RANKS[k] + s for k in kickers for s in kinds]


def _dash_labels(token: str) -> List[str]:
    """'K8s-K2s' -> K8s..K2s, '99-66' -> 99..66."""
    a, b = (x.strip() for x in token.split("-"))
    _hand_labels(a), _hand_labels(b)  # raises if either end isn't a valid hand
    if a[0] == a[1] and b[0] == b[1]:  # pairs
        lo, hi = sorted((RANKS.index(a[0]), RANKS.index(b[0])))
        return [RANKS[r] * 2 for r in range(lo, hi + 1)]
    if a[0] != b[0] or a[2:] != b[2:]:
        raise ValueError(f"bad range token: {token} (use the same top card and suit type, e.g. K8s-K2s)")
    lo, hi = sorted((RANKS.index(a[1]), RANKS.index(b[1])))
    out: List[str] = []
    for k in range(lo, hi + 1):
        out += _hand_labels(a[0] + RANKS[k] + a[2:])
    return out


def combos_of_label(label: str) -> List[Combo]:
    """All combos for a grid label ('QQ', 'AKs', 'T9o') or an exact combo ('AhKh')."""
    if len(label) == 4:
        a, b = parse_card(label[:2]), parse_card(label[2:])
        return [(max(a, b), min(a, b))]
    r1, r2 = RANKS.index(label[0]), RANKS.index(label[1])
    out = []
    for c in COMBOS:
        h, l = rank_of(c[0]), rank_of(c[1])
        if (h, l) != (max(r1, r2), min(r1, r2)):
            continue
        suited = suit_of(c[0]) == suit_of(c[1])
        if r1 == r2 or (label[2] == "s") == suited:
            out.append(c)
    return out


def parse_range(text: str) -> Dict[int, float]:
    """Range text -> {combo index (0..1325): weight}."""
    weights: Dict[int, float] = {}
    for raw in text.split(","):
        raw = raw.strip()
        if not raw:
            continue
        token, _, w = raw.partition(":")
        weight = float(w) if w else 1.0
        for label in _hand_labels(token):
            for c in combos_of_label(label):
                weights[combo_index(*c)] = weight
    return weights


def range_combos(text: str, dead: Iterable[int]) -> Tuple[List[Combo], List[float]]:
    """Combos with weight > 0 that don't touch dead cards, in COMBOS order (both languages agree)."""
    dead = set(dead)
    w = parse_range(text)
    combos, weights = [], []
    for i in sorted(w):
        c = COMBOS[i]
        if w[i] > 0 and c[0] not in dead and c[1] not in dead:
            combos.append(c)
            weights.append(w[i])
    return combos, weights
