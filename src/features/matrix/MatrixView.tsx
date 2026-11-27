import { RangeGrid } from './RangeGrid';

// Hand analysis screen. Planned pieces in this folder:
// RangeGrid, HandDetail, StrategyBar, ClassFilter, TreeNav, BoardPicker.
export function MatrixView() {
  return (
    <section>
      <h2>Hand analysis</h2>
      <p class="muted">Approximation: no solved spots loaded yet.</p>
      <RangeGrid />
    </section>
  );
}
