"""Writes tests/fixtures/solver.json: one realistic river spot solved for a fixed number
of iterations. Both the Python and TypeScript tests re-solve it and must match.
Run from the repo root:  python3 python/record_solver_fixture.py
"""
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from gto.cards import parse_cards  # noqa: E402
from gto.ranges import range_combos  # noqa: E402
from gto.solver import RiverSolver, TreeConfig  # noqa: E402

SPOT = {
    "board": "Ks9h5d2c2h",
    "oop": "99,55,KQ,KJs,KTs,QJs,JTs,T9s,A9s,98s,87s,76s,A5s,65s,A2s:0.5",
    "ip": "KK:0.5,K9s,K5s,AK,KQ,KJ,A9s,QJs,JTs,T8s,86s,AQs,A4s,43s",
    "cfg": {"pot": 12, "stack": 40, "oop_bets": [0.5], "ip_bets": [0.33, 1.0], "raises": [1.0],
            "max_raises": 1, "allin": True},
    "iterations": 40,
}

if __name__ == "__main__":
    board = parse_cards(SPOT["board"])
    s = RiverSolver(board, range_combos(SPOT["oop"], board), range_combos(SPOT["ip"], board),
                    TreeConfig(**SPOT["cfg"]))
    s.solve(SPOT["iterations"])
    rep = s.report()
    out = dict(SPOT, exploitability_pct=s.exploitability_pct(),
               root_and_first_strategies={str(i): rep[i].strategy for i in range(min(4, len(s.nodes)))})
    path = Path(__file__).resolve().parents[1] / "tests" / "fixtures" / "solver.json"
    path.write_text(json.dumps(out) + "\n")
    print(f"{len(s.nodes)} decision nodes, exploitability {out['exploitability_pct']:.3f}% pot -> {path}")
