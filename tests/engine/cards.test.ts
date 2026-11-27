import { describe, expect, it } from 'vitest';
import { CELL_COMBOS, COMBOS, cellLabel, comboIndex, gridCell, parseCard } from '@/engine/cards';

describe('cards', () => {
  it('has 1326 combos with round-trip indexing', () => {
    expect(COMBOS.length).toBe(1326);
    COMBOS.forEach(([a, b], i) => expect(comboIndex(b, a)).toBe(i));
  });

  it('groups combos into 169 cells: 6 per pair, 4 suited, 12 offsuit', () => {
    for (let r = 0; r < 13; r++)
      for (let c = 0; c < 13; c++) {
        const n = CELL_COMBOS[r * 13 + c].length;
        expect(n).toBe(r === c ? 6 : r < c ? 4 : 12);
      }
  });

  it('places hands in the expected cells', () => {
    const ak = gridCell([parseCard('Ah'), parseCard('Kh')]);
    expect(cellLabel(ak.row, ak.col)).toBe('AKs');
    const t9 = gridCell([parseCard('Td'), parseCard('9c')]);
    expect(cellLabel(t9.row, t9.col)).toBe('T9o');
    expect(cellLabel(0, 0)).toBe('AA');
  });
});
