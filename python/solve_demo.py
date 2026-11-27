"""Watch the Nash solver converge on the textbook river spot.
Run from the repo root:  python3 python/solve_demo.py

Setup: board Ks Qd 7h 4c 2s, pot 10 bb.
  OOP holds QJ (a pair of queens): a "bluff-catcher" that beats air but loses to value.
  IP holds KK (a set: the nuts here) or 65s (nothing). OOP must check; IP can check or bet pot.

Theory says, for a pot-size bet:
  IP bets every KK and enough 65s that 1/3 of its bets are bluffs -> 1.5 of 4 air combos = 37.5%
  OOP calls 1 / (1 + 1) = 50% of the time (minimum defense frequency)
Edit the ranges or sizes below and re-run to see how the answer moves.
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from gto.cards import card_str, parse_cards, rank_of  # noqa: E402
from gto.ranges import range_combos  # noqa: E402
from gto.solver import RiverSolver, TreeConfig, action_label  # noqa: E402

board = parse_cards("KsQd7h4c2s")
oop = range_combos("QJ", board)
ip = range_combos("KK,65s", board)
cfg = TreeConfig(pot=10, stack=100, oop_bets=[], ip_bets=[1.0], raises=[], allin=False)
solver = RiverSolver(board, oop, ip, cfg)

print("The betting tree (decision nodes):")
for n in solver.nodes:
    who = "OOP" if n.player == 0 else "IP"
    line = " ".join(n.path) or "(start)"
    print(f"  node {n.id}: after {line:10} {who} chooses from {[action_label(a) for a in n.actions]}")

print("\nIterations -> exploitability (% of pot a perfect opponent could win; 0 = Nash):")
for target in [1, 10, 100, 1000]:
    solver.solve(target - solver.iterations)
    print(f"  {target:>5}: {solver.exploitability_pct():.4f}%")

rep = solver.report()
print("\nIP after OOP checks (node 1): how often each hand bets")
for h, c in enumerate(ip[0]):
    kind = "nuts" if rank_of(c[0]) == 11 else "air"
    print(f"  {card_str(c[0])}{card_str(c[1])} ({kind}): bet {rep[1].strategy[h * 2 + 1]:.1%}")

calls = [rep[2].strategy[h * 2 + 1] for h in range(len(oop[0]))]
print(f"\nOOP facing the pot bet (node 2): calls {sum(calls) / len(calls):.1%} on average")
print(f"\nGame value: OOP {solver.value(0):.2f} bb, IP {solver.value(1):.2f} bb (adds up to the {cfg.pot} bb pot)")
