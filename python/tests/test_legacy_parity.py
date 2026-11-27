"""The Python engine must give exactly the same answers as the original app.

Fixtures (tests/fixtures/*.json) come from tools/extract-legacy/record-fixtures.mjs,
which runs the legacy JavaScript. tests/engine/legacy-parity.test.ts checks the
TypeScript engine against the same files, so passing both means all three agree.

Run from the repo root:  python3 -m unittest discover -s python
"""
import json
import unittest
from pathlib import Path

from gto.cards import CELL_COMBOS, COMBOS, cell_label, combo_index, grid_cell, parse_cards
from gto.equity import equity, equity_weighted, make_sampler
from gto.evaluator import category_of, score
from gto.rng import mulberry32

FIXTURES = Path(__file__).resolve().parents[2] / "tests" / "fixtures"


def load(name):
    return json.loads((FIXTURES / name).read_text())


class TestRng(unittest.TestCase):
    def test_matches_recorded_stream(self):
        fx = load("rng.json")
        r = mulberry32(fx["seed"])
        for want in fx["values"]:
            self.assertEqual(r(), want)


class TestCards(unittest.TestCase):
    def test_combo_count_and_index(self):
        self.assertEqual(len(COMBOS), 1326)
        for i, (a, b) in enumerate(COMBOS):
            self.assertEqual(combo_index(b, a), i)

    def test_cell_sizes(self):
        for r in range(13):
            for c in range(13):
                want = 6 if r == c else 4 if r < c else 12
                self.assertEqual(len(CELL_COMBOS[r * 13 + c]), want)

    def test_labels(self):
        self.assertEqual(cell_label(*grid_cell(tuple(parse_cards("AhKh")))), "AKs")
        self.assertEqual(cell_label(*grid_cell(tuple(parse_cards("Td9c")))), "T9o")


class TestEvaluator(unittest.TestCase):
    def test_matches_legacy(self):
        for case in load("evaluator.json"):
            self.assertEqual(score(case["cards"]), case["score"], f"cards {case['cards']}")
            self.assertEqual(category_of(case["score"]), case["cat"])


class TestEquity(unittest.TestCase):
    def test_matches_legacy(self):
        for i, f in enumerate(load("equity.json")):
            vills = [[tuple(c) for c in v] for v in f["vills"]]
            got = equity(f["hero"], f["flop"], vills, f["iters"], mulberry32(f["seed"]))
            self.assertEqual(got, f["result"], f"case {i}")

    def test_stable_with_seed(self):
        f = load("equity.json")[0]
        vills = [[tuple(c) for c in v] for v in f["vills"]]
        run = lambda: equity(f["hero"], f["flop"], vills, f["iters"], mulberry32(99))
        self.assertEqual(run(), run())

    def test_weighted_matches_legacy(self):
        for i, f in enumerate(load("eqw.json")):
            samplers = [make_sampler(v) for v in f["vills"]]
            got = equity_weighted(f["hero"], f["board"], samplers, f["iters"], mulberry32(f["seed"]))
            self.assertEqual(got, f["result"], f"case {i}")


if __name__ == "__main__":
    unittest.main()
