import { cellLabel } from '@/engine/cards';
import type { StrategyNode } from '@/strategy/node';
import { actionColors, pct } from '@/ui/actions';
import { cellStats } from './aggregate';

interface Props {
  node: StrategyNode;
  selected: number | null; // cell index row * 13 + col
  onSelect: (cell: number) => void;
}

/**
 * 13x13 grid. Each cell is split left-to-right into the node's actions by frequency.
 * The colored part's height shows how much of that hand is still in range here,
 * so hands that folded earlier or were never in range fade out.
 */
export function RangeGrid({ node, selected, onSelect }: Props) {
  const stats = cellStats(node);
  const colors = actionColors(node.actions);
  return (
    <div class="range-grid" role="grid" aria-label={`${node.player} strategy by hand`}>
      {stats.map((st, i) => {
        const r = Math.floor(i / 13), c = i % 13, label = cellLabel(r, c);
        const title = st.fill
          ? `${label}: ${node.actions.map((a, k) => `${a.label} ${pct(st.freqs[k])}`).join(', ')}`
          : `${label}: not in range`;
        return (
          <button
            key={i}
            class={`cell${st.fill ? '' : ' empty'}${selected === i ? ' selected' : ''}`}
            title={title}
            onClick={() => st.fill && onSelect(i)}
          >
            <span class="cell-bars" style={{ height: `${Math.max(st.fill, st.fill ? 0.08 : 0) * 100}%` }}>
              {st.freqs.map((f, k) => (f > 0.001 ? <span key={k} style={{ width: `${f * 100}%`, background: colors[k] }} /> : null))}
            </span>
            <span class="cell-label">{label}</span>
          </button>
        );
      })}
    </div>
  );
}
