"""Solver checks: exact showdown math, the betting tree, and convergence to known
equilibria. Run from the repo root:  python3 -m unittest discover -s python
"""
import json
import unittest
from pathlib import Path

from gto.cards import COMBOS, parse_cards
from gto.ranges import parse_range, range_combos
from gto.rng import mulberry32
from gto.solver import RiverSolver, TreeConfig, build_tree
from gto.solver.showdown import Matchup, naive_matchup

FIXTURES = Path(__file__).resolve().parents[2] / "tests" / "fixtures"


def toy_solver():
    """Polarized IP (nuts + air) vs OOP bluff-catchers, IP may only check or bet pot."""
    board = parse_cards("KsQd7h4c2s")
    oop = range_combos("QJ", board)  # pair of queens: beats 65s, loses to KK
    ip = range_combos("KK,65s", board)  # 3 combos of a set + 4 combos of air
    cfg = TreeConfig(pot=10, stack=100, oop_bets=[], ip_bets=[1.0], raises=[], allin=False)
    return RiverSolver(board, oop, ip, cfg), oop, ip


class TestRanges(unittest.TestCase):
    def test_counts(self):
        self.assertEqual(len(parse_range("AA")), 6)
        self.assertEqual(len(parse_range("AKs")), 4)
        self.assertEqual(len(parse_range("AKo")), 12)
        self.assertEqual(len(parse_range("AK")), 16)
        self.assertEqual(len(parse_range("22+")), 78)
        self.assertEqual(len(parse_range("A2s+")), 48)
        self.assertEqual(len(parse_range("KTo+")), 36)
        self.assertEqual(len(parse_range("AhKh")), 1)
        self.assertEqual(len(parse_range("K8s-K2s")), 28)
        self.assertEqual(len(parse_range("KTo-K8o")), 36)
        self.assertEqual(len(parse_range("99-66")), 24)

    def test_weights_and_dead_cards(self):
        w = parse_range("AA:0.5,KK")
        self.assertEqual(sorted(set(w.values())), [0.5, 1.0])
        combos, _ = range_combos("AA", parse_cards("As"))
        self.assertEqual(len(combos), 3)


class TestShowdown(unittest.TestCase):
    def test_sweep_matches_naive(self):
        rng = mulberry32(5)
        board = parse_cards("Ah9d9c4s2h")
        mine, _ = range_combos("22+,A2s+,K9o+,QTs+,65s,T8s", board)
        theirs, _ = range_combos("33+,A5s+,KTo+,J9s+,76s,54s", board)
        reach = [rng() for _ in theirs]
        fast = Matchup(mine, theirs, board).split(reach)
        slow = naive_matchup(mine, theirs, reach, board)
        for f_list, s_list in zip(fast, slow):
            for f, s in zip(f_list, s_list):
                self.assertAlmostEqual(f, s, places=9)


class TestTree(unittest.TestCase):
    def test_shape(self):
        root, nodes = build_tree(TreeConfig(pot=10, stack=20, oop_bets=[0.5], ip_bets=[0.5],
                                            raises=[1.0], max_raises=1))
        self.assertEqual(root.actions, ["x", "b50", "allin"])  # bet 0.5 * 10 = 5
        self.assertEqual(root.children[1].contrib, (5.0, 0.0))
        # IP facing 5: raise to 5 + 1.0 * (10 + 2*5) = 25 > stack 20, so only all-in remains
        self.assertEqual(root.children[1].actions, ["f", "c", "allin"])
        # after OOP checks, IP has the same bet options
        self.assertEqual(root.children[0].actions, ["x", "b50", "allin"])
        self.assertTrue(all(n.id == i for i, n in enumerate(nodes)))

    def test_oversize_raise_becomes_allin(self):
        root, _ = build_tree(TreeConfig(pot=10, stack=20, oop_bets=[0.5], ip_bets=[], raises=[1.0],
                                        allin=False))
        self.assertEqual(root.children[1].actions, ["f", "c", "allin"])
        self.assertEqual(root.children[1].children[2].contrib, (5.0, 20.0))


class TestEquilibrium(unittest.TestCase):
    def test_textbook_polar_vs_bluffcatcher(self):
        s, oop, ip = toy_solver()
        s.solve(1000)
        rep = s.report()
        # IP after OOP checks: actions [x, b100]
        bet = [rep[1].strategy[h * 2 + 1] for h in range(len(ip[0]))]
        nuts = [b for c, b in zip(ip[0], bet) if c[0] >> 2 == 11]  # KK
        air = [b for c, b in zip(ip[0], bet) if c[0] >> 2 != 11]
        for b in nuts:
            self.assertGreater(b, 0.99)  # always value bet
        # pot-size bet: bluffs are 1/3 of bets -> 3 nut combos support 1.5 of 4 air combos
        self.assertAlmostEqual(sum(air) / len(air), 0.375, delta=0.01)
        # OOP facing pot: calls 1/(1+1) = 50% (minimum defense frequency)
        call = [rep[2].strategy[h * 2 + 1] for h in range(len(oop[0]))]
        self.assertAlmostEqual(sum(call) / len(call), 0.5, delta=0.01)
        self.assertLess(s.exploitability_pct(), 0.1)

    def test_exploitability_shrinks(self):
        s, _, _ = toy_solver()
        s.solve(10)
        early = s.exploitability_pct()
        s.solve(290)
        self.assertLess(s.exploitability_pct(), early)

    def test_values_add_to_pot(self):
        s, _, _ = toy_solver()
        s.solve(50)
        self.assertAlmostEqual(s.value(0) + s.value(1), s.cfg.pot, places=9)


class TestSolverParity(unittest.TestCase):
    """Same spot, same iterations as tests/engine/solver.test.ts (fixture written by Python)."""

    def test_matches_fixture(self):
        fx = json.loads((FIXTURES / "solver.json").read_text())
        board = parse_cards(fx["board"])
        cfg = TreeConfig(**fx["cfg"])
        s = RiverSolver(board, range_combos(fx["oop"], board), range_combos(fx["ip"], board), cfg)
        s.solve(fx["iterations"])
        self.assertAlmostEqual(s.exploitability_pct(), fx["exploitability_pct"], places=9)
        rep = s.report()
        for node_id, strat in fx["root_and_first_strategies"].items():
            for a, b in zip(rep[int(node_id)].strategy, strat):
                self.assertAlmostEqual(a, b, places=9)


if __name__ == "__main__":
    unittest.main()
