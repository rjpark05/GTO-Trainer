import { cellLabel } from '@/engine/cards';

// Placeholder 13x13 grid. Next step: color each cell by action frequency
// from a StrategyNode (see src/strategy/node.ts).
export function RangeGrid() {
  const cells = [];
  for (let r = 0; r < 13; r++)
    for (let c = 0; c < 13; c++)
      cells.push(
        <div key={r * 13 + c} class={`cell ${r === c ? 'pair' : r < c ? 'suited' : 'offsuit'}`}>
          {cellLabel(r, c)}
        </div>,
      );
  return <div class="range-grid">{cells}</div>;
}
