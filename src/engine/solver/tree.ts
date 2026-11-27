// The betting tree for one heads-up river. Mirror: python/gto/solver/tree.py
// (read that file's docstring for how bet sizes and all-ins work).

export interface TreeConfig {
  pot: number; // pot at the start of the river, bb
  stack: number; // effective stack behind, bb
  oop_bets: number[]; // pot fractions
  ip_bets: number[];
  raises: number[]; // pot fractions, measured after calling
  max_raises: number; // raises allowed after the first bet
  allin: boolean; // always offer all-in when betting or raising
}

export const DEFAULT_TREE: Omit<TreeConfig, 'pot' | 'stack'> = {
  oop_bets: [0.33, 0.75],
  ip_bets: [0.33, 0.75],
  raises: [0.75],
  max_raises: 1,
  allin: true,
};

export interface TreeNode {
  kind: 'action' | 'fold' | 'showdown';
  player: number; // action: who acts (0 OOP, 1 IP). fold: who folded. showdown: -1
  contrib: [number, number]; // chips in this street (OOP, IP)
  path: string[];
  actions: string[];
  children: TreeNode[];
  id: number; // index among action nodes
}

/** 0.33 -> 33 (halves round up, same as the Python version). */
const pct = (f: number) => Math.floor(f * 100 + 0.5);

export function actionLabel(action: string): string {
  const names: Record<string, string> = { x: 'Check', f: 'Fold', c: 'Call', allin: 'All-in' };
  if (names[action]) return names[action];
  return `${action[0] === 'b' ? 'Bet' : 'Raise'} ${action.slice(1)}%`;
}

export function buildTree(cfg: TreeConfig): { root: TreeNode; nodes: TreeNode[] } {
  const nodes: TreeNode[] = [];
  const terminal = (kind: 'fold' | 'showdown', player: number, contrib: [number, number], path: string[]): TreeNode =>
    ({ kind, player, contrib, path, actions: [], children: [], id: -1 });

  function node(player: number, contrib: [number, number], path: string[], aggressions: number): TreeNode {
    const n: TreeNode = { kind: 'action', player, contrib, path, actions: [], children: [], id: nodes.length };
    nodes.push(n);
    const me = contrib[player], opp = contrib[1 - player];
    const potNow = cfg.pot + contrib[0] + contrib[1];
    const putIn = (newMe: number): [number, number] => (player === 0 ? [newMe, opp] : [opp, newMe]);
    const add = (action: string, child: TreeNode) => { n.actions.push(action); n.children.push(child); };

    const addAggressive = (prefix: string, sizes: number[], toAmount: (f: number) => number) => {
      const seen = new Set<number>();
      let tooBig = false; // a size that would need the whole stack becomes the all-in
      for (const f of sizes) {
        const amt = toAmount(f);
        if (amt >= cfg.stack) { tooBig = true; continue; }
        const key = Math.round(amt * 1e6);
        if (seen.has(key)) continue;
        seen.add(key);
        const aid = `${prefix}${pct(f)}`;
        add(aid, node(1 - player, putIn(amt), [...path, aid], aggressions + 1));
      }
      if ((cfg.allin || tooBig) && cfg.stack > Math.max(me, opp))
        add('allin', node(1 - player, putIn(cfg.stack), [...path, 'allin'], aggressions + 1));
    };

    if (opp > me) {
      add('f', terminal('fold', player, contrib, [...path, 'f']));
      add('c', terminal('showdown', -1, putIn(opp), [...path, 'c']));
      if (aggressions <= cfg.max_raises && opp < cfg.stack)
        addAggressive('r', cfg.raises, (f) => opp + f * (cfg.pot + 2 * opp));
    } else {
      if (player === 0) add('x', node(1, contrib, [...path, 'x'], aggressions));
      else add('x', terminal('showdown', -1, contrib, [...path, 'x']));
      addAggressive('b', player === 0 ? cfg.oop_bets : cfg.ip_bets, (f) => f * potNow);
    }
    return n;
  }

  const root = node(0, [0, 0], [], 0);
  return { root, nodes };
}
