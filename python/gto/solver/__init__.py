"""Heads-up river Nash equilibrium solver.

    tree.py      every possible action sequence (the betting tree)
    showdown.py  who beats whom, exactly, with card removal
    cfr.py       CFR+: the learning loop that converges to equilibrium
"""
from .cfr import NodeReport, RiverSolver
from .tree import Node, TreeConfig, action_label, build_tree

__all__ = ["NodeReport", "RiverSolver", "Node", "TreeConfig", "action_label", "build_tree"]
