"""Try the engine by hand. Run from the repo root:  python3 python/demo.py

Edit the hands and boards below and re-run to see how the numbers change.
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from gto.cards import RANKS, combo_index, parse_cards
from gto.equity import equity
from gto.evaluator import CATEGORY_NAMES, category_of, score
from gto.rng import mulberry32


def describe(cards_str: str) -> None:
    s = score(parse_cards(cards_str))
    print(f"{cards_str:16} score={s:>8}  -> {CATEGORY_NAMES[category_of(s)]}")


def hand_combos(hand: str, dead):
    """All combos of a grid hand like 'QQ', 'AKs', 'T9o' that don't use dead cards."""
    r1, r2 = RANKS.index(hand[0]), RANKS.index(hand[1])
    out = []
    for a in range(4):
        for b in range(4):
            if r1 == r2:
                if b <= a:
                    continue
            elif (hand[2] == "s") != (a == b):
                continue
            c = (max(r1 * 4 + a, r2 * 4 + b), min(r1 * 4 + a, r2 * 4 + b))
            if c[0] not in dead and c[1] not in dead:
                out.append(c)
    return out


if __name__ == "__main__":
    print("== Hand evaluator ==")
    for h in ["AsKsQsJsTs", "KsKhKdQsQh2c3d", "5s4d3h2cAd", "AsAhKdKc9s", "Qs8d6h4c2s"]:
        describe(h)

    print("\n== Equity: AsKs on Qs7d2c vs a range of overpairs and queens ==")
    hero, flop = parse_cards("AsKs"), parse_cards("Qs7d2c")
    dead = set(hero + flop)
    villain = [c for h in ["QQ", "JJ", "TT", "AQs", "KQs", "QJs"] for c in hand_combos(h, dead)]
    print(f"villain range: {len(villain)} combos")
    for iters in [200, 1000, 5000]:
        e = equity(hero, flop, [villain], iters, mulberry32(1))
        print(f"  {iters:>5} iterations: {e:.3f}")
    print("(more iterations = less noise; the app uses 350-900)")
    print(f"\ncombo index of AhKd: {combo_index(*parse_cards('AhKd'))} of 1326")
