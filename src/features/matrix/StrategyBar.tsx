import type { StrategyNode } from '@/strategy/node';
import { actionColors, pct } from '@/ui/actions';
import { rangeSummary } from './aggregate';

/** Whole-range action mix, e.g. "Check 58% | Bet 33% 30% | Bet 75% 12%". */
export function StrategyBar({ node }: { node: StrategyNode }) {
  const { freqs, combos } = rangeSummary(node);
  const colors = actionColors(node.actions);
  return (
    <div class="strategy-bar">
      <div class="bar">
        {freqs.map((f, k) => (f > 0.001 ? <span key={k} style={{ width: `${f * 100}%`, background: colors[k] }} /> : null))}
      </div>
      <ul class="legend">
        {node.actions.map((a, k) => (
          <li key={a.id}>
            <span class="swatch" style={{ background: colors[k] }} />
            {a.label} <strong>{pct(freqs[k], 1)}</strong>
          </li>
        ))}
        <li class="muted">{combos.toFixed(1)} combos</li>
      </ul>
    </div>
  );
}
