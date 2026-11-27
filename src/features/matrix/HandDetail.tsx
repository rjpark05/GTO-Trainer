import { CELL_COMBOS, COMBOS, cellLabel } from '@/engine/cards';
import type { StrategyNode } from '@/strategy/node';
import { actionColors, pct } from '@/ui/actions';
import { CardText } from '@/ui/Card';

/** Every suit combo of one grid cell: how often it takes each action, and each action's EV. */
export function HandDetail({ node, cell }: { node: StrategyNode; cell: number }) {
  const A = node.actions.length;
  const colors = actionColors(node.actions);
  const rows = CELL_COMBOS[cell].filter((i) => node.range[i] > 0);
  return (
    <div class="hand-detail">
      <h3>
        {cellLabel(Math.floor(cell / 13), cell % 13)} <span class="muted">({node.player} to act)</span>
      </h3>
      {rows.length === 0 ? (
        <p class="muted">Not in range at this point.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Combo</th>
              <th title="How much of this combo reaches this decision">Reach</th>
              {node.actions.map((a, k) => (
                <th key={a.id}>
                  <span class="swatch" style={{ background: colors[k] }} />
                  {a.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((i) => {
              let best = 0;
              for (let a = 1; a < A; a++) if (node.ev[i * A + a] > node.ev[i * A + best]) best = a;
              return (
                <tr key={i}>
                  <td>
                    <CardText card={COMBOS[i][0]} />
                    <CardText card={COMBOS[i][1]} />
                  </td>
                  <td>{pct(node.range[i])}</td>
                  {node.actions.map((_, a) => (
                    <td key={a} class={a === best ? 'best' : ''}>
                      <div>{pct(node.strat[i * A + a])}</div>
                      <div class="ev">{node.ev[i * A + a].toFixed(2)} bb</div>
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
      <p class="muted small">
        EV = bb this combo wins from here on, counting the current pot. At equilibrium, actions a hand
        mixes between have (nearly) equal EV.
      </p>
    </div>
  );
}
