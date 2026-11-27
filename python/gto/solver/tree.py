"""The betting tree for one heads-up river. Mirror of src/engine/solver/tree.ts.

A tree is every possible sequence of actions from the start of the river to the end
of the hand. Each Node is one of:
    "action"    a player (0 = OOP, 1 = IP) chooses one of several actions
    "fold"      someone folded; the other player takes the pot
    "showdown"  bets are matched (check-check or a call); best hand wins

Amounts are chips put in *on this street* ("contrib"). `pot` is the pot before the
river action starts. Bet sizes are fractions of the current pot:
    bet  f:  put in f * (pot + both contribs)
    raise f: call first, then add f * (pot after the call)
Anything that would use the whole remaining stack becomes "allin".
"""
from __future__ import annotations

import math
from dataclasses import dataclass, field
from typing import List, Tuple


@dataclass
class TreeConfig:
    pot: float  # pot at the start of the river, in bb
    stack: float  # effective stack behind at the start of the river, in bb
    oop_bets: List[float] = field(default_factory=lambda: [0.33, 0.75])
    ip_bets: List[float] = field(default_factory=lambda: [0.33, 0.75])
    raises: List[float] = field(default_factory=lambda: [0.75])
    max_raises: int = 1  # raises allowed after the first bet
    allin: bool = True  # always offer an all-in option when betting or raising


@dataclass
class Node:
    kind: str  # "action" | "fold" | "showdown"
    player: int  # action: who acts. fold: who folded. showdown: -1
    contrib: Tuple[float, float]  # chips in this street, (OOP, IP)
    path: Tuple[str, ...]  # action ids from the root, e.g. ("x", "b75", "c")
    actions: List[str] = field(default_factory=list)
    children: List["Node"] = field(default_factory=list)
    id: int = -1  # index among action nodes (where strategies are stored)


def _pct(f: float) -> int:
    """0.33 -> 33. Rounds halves up, like JavaScript's Math.round (Python's round() doesn't)."""
    return math.floor(f * 100 + 0.5)


def action_label(action: str) -> str:
    names = {"x": "Check", "f": "Fold", "c": "Call", "allin": "All-in"}
    if action in names:
        return names[action]
    word = "Bet" if action[0] == "b" else "Raise"
    return f"{word} {action[1:]}%"


def build_tree(cfg: TreeConfig) -> Tuple[Node, List[Node]]:
    """Returns (root, action_nodes). action_nodes[i].id == i."""
    action_nodes: List[Node] = []

    def node(player: int, contrib: Tuple[float, float], path: Tuple[str, ...], aggressions: int) -> Node:
        n = Node("action", player, contrib, path)
        n.id = len(action_nodes)
        action_nodes.append(n)
        me, opp = contrib[player], contrib[1 - player]
        pot_now = cfg.pot + contrib[0] + contrib[1]

        def put_in(new_me: float) -> Tuple[float, float]:
            return (new_me, opp) if player == 0 else (opp, new_me)

        def add(action: str, child: Node) -> None:
            n.actions.append(action)
            n.children.append(child)

        def add_aggressive(prefix: str, sizes: List[float], to_amount) -> None:
            """Bets or raises: dedupe equal amounts, turn stack-sized ones into all-in."""
            seen = set()
            too_big = False  # a size that would need the whole stack becomes the all-in
            for f in sizes:
                amt = to_amount(f)
                if amt >= cfg.stack:
                    too_big = True
                    continue
                key = round(amt, 6)
                if key in seen:
                    continue
                seen.add(key)
                aid = f"{prefix}{_pct(f)}"
                add(aid, node(1 - player, put_in(amt), path + (aid,), aggressions + 1))
            if (cfg.allin or too_big) and cfg.stack > max(me, opp):
                add("allin", node(1 - player, put_in(cfg.stack), path + ("allin",), aggressions + 1))

        if opp > me:  # facing a bet or raise
            add("f", Node("fold", player, contrib, path + ("f",)))
            add("c", Node("showdown", -1, put_in(opp), path + ("c",)))
            if aggressions <= cfg.max_raises and opp < cfg.stack:
                add_aggressive("r", cfg.raises, lambda f: opp + f * (cfg.pot + 2 * opp))
        else:  # checked to, or first to act
            if player == 0:
                add("x", node(1, contrib, path + ("x",), aggressions))
            else:
                add("x", Node("showdown", -1, contrib, path + ("x",)))
            sizes = cfg.oop_bets if player == 0 else cfg.ip_bets
            add_aggressive("b", sizes, lambda f: f * pot_now)
        return n

    root = node(0, (0.0, 0.0), (), 0)
    return root, action_nodes
