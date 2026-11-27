import type { Scenario } from '../schema';

// Example pack. Add new drills by adding data here, not by changing Play code.
export const srpBtnVsBb: Scenario[] = [
  {
    id: 'srp-btn-bb-flop-ip',
    name: 'BTN vs BB single-raised pot, flop in position',
    tableSize: 6,
    stackBb: 100,
    hero: 'BTN',
    villains: ['BB'],
    potType: 'srp',
    preflopLine: 'BTN open 2.5, BB call',
    startStreet: 'flop',
    tags: ['srp', 'ip', 'cbet'],
  },
  {
    id: 'srp-btn-bb-monotone-oop',
    name: 'BB defending on monotone flops',
    tableSize: 6,
    stackBb: 100,
    hero: 'BB',
    villains: ['BTN'],
    potType: 'srp',
    preflopLine: 'BTN open 2.5, BB call',
    startStreet: 'flop',
    board: { texture: ['monotone'] },
    tags: ['srp', 'oop', 'defense'],
  },
];
