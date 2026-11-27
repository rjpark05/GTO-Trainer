import { useMemo, useState } from 'preact/hooks';
import { solveRiver, toStrategyNode, type RiverSpot, type SolveProgress, type SolvedRiver } from '@/strategy/solved/river';
import { CardText } from '@/ui/Card';
import { parseCard } from '@/engine/cards';
import { HandDetail } from './HandDetail';
import { RangeGrid } from './RangeGrid';
import { SpotForm } from './SpotForm';
import { StrategyBar } from './StrategyBar';
import { TreeNav } from './TreeNav';

/**
 * Hand analysis: solve a heads-up river spot to Nash equilibrium, then browse the tree.
 * Every number on this screen comes from the solver; the exploitability badge says how
 * close to exact equilibrium it got.
 */
export function MatrixView() {
  const [solved, setSolved] = useState<SolvedRiver | null>(null);
  const [nodeId, setNodeId] = useState(0);
  const [cell, setCell] = useState<number | null>(null);
  const [progress, setProgress] = useState<SolveProgress | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const onSolve = async (spot: RiverSpot) => {
    setBusy(true);
    setError('');
    setProgress(null);
    try {
      const result = await solveRiver(spot, { onProgress: setProgress });
      setSolved(result);
      setNodeId(0);
      setCell(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const node = useMemo(() => (solved ? toStrategyNode(solved, nodeId) : null), [solved, nodeId]);

  return (
    <section class="matrix">
      <h2>River solver</h2>
      <p class="muted">
        Heads-up river spots solved to Nash equilibrium with CFR+. The answer is exact for the ranges and bet sizes you enter.
      </p>
      <SpotForm busy={busy} onSolve={onSolve} />

      {busy && progress && (
        <p class="status" role="status">
          Iteration {progress.iterations}: exploitability {progress.exploitabilityPct.toFixed(2)}% of pot
        </p>
      )}
      {error && <p class="error" role="alert">{error}</p>}

      {solved && node && (
        <div class="results">
          <div class="result-head">
            <div class="board">{node.board.map((c) => <CardText key={c} card={parseCard(c)} />)}</div>
            <span class="badge" title="How much a perfect opponent could gain against this strategy, averaged over both players">
              Equilibrium · exploitability {solved.exploitabilityPct.toFixed(2)}% pot · {solved.solver.iterations} iterations
            </span>
            <span class="muted">Pot {node.pot.toFixed(1)} bb</span>
          </div>
          <TreeNav nodes={solved.solver.nodes} current={nodeId} onGo={(id) => { setNodeId(id); setCell(null); }} />
          <StrategyBar node={node} />
          <div class="grid-and-detail">
            <RangeGrid node={node} selected={cell} onSelect={setCell} />
            {cell !== null ? <HandDetail node={node} cell={cell} /> : <p class="muted hint">Click a hand to see each suit combo and its EV.</p>}
          </div>
        </div>
      )}
    </section>
  );
}
