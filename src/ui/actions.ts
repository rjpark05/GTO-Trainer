// Action colors, shared by every strategy view. Values live in styles.css (light + dark).
import type { ActionDef } from '@/strategy/node';

/** CSS color for each action of a node: passive green, fold blue, bets red (darker = bigger). */
export function actionColors(actions: ActionDef[]): string[] {
  const aggressive = actions
    .filter((a) => a.kind === 'bet' || a.kind === 'raise' || a.kind === 'allin')
    .sort((a, b) => (a.amount ?? 0) - (b.amount ?? 0));
  return actions.map((a) => {
    if (a.kind === 'fold') return 'var(--act-fold)';
    if (a.kind === 'check' || a.kind === 'call') return 'var(--act-passive)';
    if (a.kind === 'allin') return 'var(--act-allin)';
    const rank = aggressive.indexOf(a); // 0 = smallest
    const shades = ['var(--act-bet1)', 'var(--act-bet2)', 'var(--act-bet3)'];
    return shades[Math.min(rank, shades.length - 1)];
  });
}

export const pct = (x: number, digits = 0) => `${(x * 100).toFixed(digits)}%`;
