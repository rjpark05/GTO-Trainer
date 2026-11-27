// A Scenario is a recipe for a drill. generator.ts turns it into a concrete mock hand;
// Play runs that hand, and the matrix can open the same spot for study.

export type Position = 'UTG' | 'HJ' | 'CO' | 'BTN' | 'SB' | 'BB';
export type PotType = 'srp' | '3bet' | '4bet' | 'limped';
export type Street = 'flop' | 'turn' | 'river';

export interface BoardFilter {
  texture?: Array<'monotone' | 'two-tone' | 'rainbow' | 'paired' | 'connected'>;
  highCard?: string[]; // e.g. ["A","K"]
  fixed?: string[]; // exact cards, e.g. ["Qs","Jd","4c"]
}

export interface Scenario {
  id: string;
  name: string;
  description?: string;
  tableSize: 2 | 6 | 9;
  stackBb: number;
  hero: Position;
  villains: Position[];
  potType: PotType;
  preflopLine: string; // shorthand, same grammar as Review import, e.g. "BTN open 2.5, BB call"
  startStreet: Street;
  board?: BoardFilter;
  heroHands?: string[]; // grid labels or classes, e.g. ["AKs","QQ"] or ["flush-draw"]
  tags?: string[];
}
