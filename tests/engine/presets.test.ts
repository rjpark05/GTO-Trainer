// Every example spot in the Solver tab must parse and reach a near-equilibrium quickly.
import { describe, expect, it } from 'vitest';
import { PRESETS } from '@/features/matrix/presets';
import { solveRiver, toStrategyNode } from '@/strategy/solved/river';

describe('solver presets', () => {
  it.each(PRESETS.map((p) => [p.name, p] as const))('%s', async (_name, p) => {
    const solved = await solveRiver(p.spot, { targetPct: 0.3, maxIterations: 1500 });
    expect(solved.exploitabilityPct).toBeLessThan(0.3);
    const root = toStrategyNode(solved, 0);
    expect(root.source).toBe('equilibrium');
    expect(root.actions.length).toBeGreaterThan(0);
  }, 20_000);
});
