import { actionLabel, type TreeNode } from '@/engine/solver';

interface Props {
  nodes: TreeNode[];
  current: number;
  onGo: (nodeId: number) => void;
}

const who = (p: number) => (p === 0 ? 'OOP' : 'IP');

/** Breadcrumb of the line so far, plus the actions available next. */
export function TreeNav({ nodes, current, onGo }: Props) {
  // Walk from the root along the current node's path, remembering each decision node.
  const steps: { nodeId: number; action: string; player: number }[] = [];
  let n = nodes[0];
  for (const action of nodes[current].path) {
    steps.push({ nodeId: n.id, action, player: n.player });
    n = n.children[n.actions.indexOf(action)];
  }
  const here = nodes[current];
  return (
    <nav class="tree-nav" aria-label="Action line">
      <ol class="crumbs">
        <li>
          <button class="link" onClick={() => onGo(0)}>River</button>
        </li>
        {steps.map((s, i) => (
          <li key={i}>
            <button class="link" onClick={() => onGo(s.nodeId)} title="Go back to this decision">
              {who(s.player)} {actionLabel(s.action)}
            </button>
          </li>
        ))}
        <li aria-current="step"><strong>{who(here.player)} to act</strong></li>
      </ol>
      <div class="next">
        <span class="muted">Next:</span>
        {here.children.map((child, a) =>
          child.kind === 'action' ? (
            <button key={a} class="chip" onClick={() => onGo(child.id)}>{actionLabel(here.actions[a])}</button>
          ) : (
            <span key={a} class="chip disabled" title={child.kind === 'fold' ? 'Hand ends' : 'Goes to showdown'}>
              {actionLabel(here.actions[a])} · {child.kind === 'fold' ? 'ends' : 'showdown'}
            </span>
          ),
        )}
      </div>
    </nav>
  );
}
