import { RANKS, SUITS, rankOf, suitOf, type Card as CardId } from '@/engine/cards';

const SYMBOL: Record<string, string> = { s: '♠', h: '♥', d: '♦', c: '♣' };

/** Inline card text like "K♠", red for hearts and diamonds. */
export function CardText({ card }: { card: CardId }) {
  const s = SUITS[suitOf(card)];
  return (
    <span class={`cardtxt suit-${s}`}>
      {RANKS[rankOf(card)]}
      {SYMBOL[s]}
    </span>
  );
}
