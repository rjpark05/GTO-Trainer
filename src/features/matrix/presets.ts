// Example river spots. The ranges are hand-written examples, not solver-derived: the
// equilibrium is exact for THESE ranges and THIS bet tree. Edit them in the form.
import type { RiverSpot } from '@/strategy/solved/river';

export interface Preset { name: string; note: string; spot: RiverSpot }

export const PRESETS: Preset[] = [
  {
    name: 'Textbook: polarized vs bluff-catchers',
    note: 'IP has the nuts (KK) or air (65s); OOP only has a pair of queens and must check. With a pot-size bet, theory says IP bluffs so that 1/3 of bets are bluffs and OOP calls 50%.',
    spot: {
      board: 'KsQd7h4c2s',
      oop: 'QJ',
      ip: 'KK,65s',
      tree: { pot: 10, stack: 100, oop_bets: [], ip_bets: [1.0], raises: [], max_raises: 0, allin: false },
    },
  },
  {
    name: 'Dry paired river, single-raised pot',
    note: 'Example ranges after a flop and turn that went bet-call, check-check. Both players have bets and a raise.',
    spot: {
      board: 'Ks9h5d2c2h',
      oop: '99,55,22,K8s-K2s,KTo-K8o,A9s,98s,87s,T9s,J9s,Q9s,A5s,65s,76s,44,33,66,77,88:0.5',
      ip: 'KK:0.3,K9s,K5s,AK,KQ,KJ,KT,A9s,T9s,QJs,JTs,T8s,86s,AQs,A4s,A3s,43s,99:0.5',
      tree: { pot: 12, stack: 40, oop_bets: [0.33, 0.75], ip_bets: [0.33, 0.75], raises: [0.75], max_raises: 1, allin: true },
    },
  },
  {
    name: 'Flush completes on the river',
    note: 'The third heart arrives. IP is the preflop raiser with more strong hands; watch how OOP checks and how IP splits value bets and bluffs by suit.',
    spot: {
      board: '9h8h3cJd2h',
      oop: 'A9s,K9s,Q9s,T9s,98s,87s,76s,JTs,QJs,KJs,33,88,99:0.5,Ah5h,Ah4h,KhQh,Th7h,7h6h,6h5h,A8s,T8s',
      ip: 'AJ,KJ,QJs,JTs,AA,KK,QQ,TT,AhKh,AhQh,KhQh,AhTh,QhTh,KhTh,AKo,AQs,KQs,T7s,76s,65s',
      tree: { pot: 15, stack: 60, oop_bets: [0.5], ip_bets: [0.33, 0.75, 1.5], raises: [0.75], max_raises: 1, allin: true },
    },
  },
];
