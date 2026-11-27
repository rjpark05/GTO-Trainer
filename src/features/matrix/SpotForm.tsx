import { useState } from 'preact/hooks';
import type { RiverSpot } from '@/strategy/solved/river';
import { PRESETS } from './presets';

interface Props {
  busy: boolean;
  onSolve: (spot: RiverSpot) => void;
}

const sizesToText = (s: number[]) => s.map((f) => Math.round(f * 100)).join(', ');
const textToSizes = (t: string) =>
  t.split(/[,\s]+/).filter(Boolean).map((x) => {
    const v = Number(x);
    if (!Number.isFinite(v) || v <= 0) throw new Error(`Bad size "${x}": use percents of pot, e.g. 33, 75`);
    return v / 100;
  });

/** Board, ranges, pot/stack and bet sizes for one river spot. */
export function SpotForm({ busy, onSolve }: Props) {
  const [preset, setPreset] = useState(0);
  const p = PRESETS[preset].spot;
  const [f, setF] = useState(() => toFields(p));
  const [error, setError] = useState('');
  const set = (k: keyof Fields) => (e: Event) => setF({ ...f, [k]: (e.target as HTMLInputElement).value });

  const pick = (i: number) => { setPreset(i); setF(toFields(PRESETS[i].spot)); setError(''); };

  const submit = (e: Event) => {
    e.preventDefault();
    try {
      const spot: RiverSpot = {
        board: f.board, oop: f.oop, ip: f.ip,
        tree: {
          pot: num(f.pot, 'Pot'), stack: num(f.stack, 'Stack'),
          oop_bets: textToSizes(f.oopBets), ip_bets: textToSizes(f.ipBets), raises: textToSizes(f.raises),
          max_raises: 1, allin: f.allin === 'yes',
        },
      };
      setError('');
      onSolve(spot);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  return (
    <form class="spot-form" onSubmit={submit}>
      <label class="wide">
        Example spot
        <select value={preset} onChange={(e) => pick(Number((e.target as HTMLSelectElement).value))}>
          {PRESETS.map((x, i) => <option key={i} value={i}>{x.name}</option>)}
        </select>
      </label>
      <p class="muted small wide">{PRESETS[preset].note}</p>
      <label>Board <input value={f.board} onInput={set('board')} placeholder="Ks9h5d2c2h" /></label>
      <label>Pot (bb) <input value={f.pot} onInput={set('pot')} inputMode="decimal" /></label>
      <label>Stack behind (bb) <input value={f.stack} onInput={set('stack')} inputMode="decimal" /></label>
      <label class="wide">OOP range <textarea rows={2} value={f.oop} onInput={set('oop')} /></label>
      <label class="wide">IP range <textarea rows={2} value={f.ip} onInput={set('ip')} /></label>
      <label>OOP bets (% pot) <input value={f.oopBets} onInput={set('oopBets')} /></label>
      <label>IP bets (% pot) <input value={f.ipBets} onInput={set('ipBets')} /></label>
      <label>Raises (% pot) <input value={f.raises} onInput={set('raises')} /></label>
      <label>
        All-in option
        <select value={f.allin} onChange={set('allin')}>
          <option value="yes">yes</option>
          <option value="no">no</option>
        </select>
      </label>
      <div class="wide row">
        <button type="submit" class="primary" disabled={busy}>{busy ? 'Solving…' : 'Solve'}</button>
        {error && <span class="error" role="alert">{error}</span>}
      </div>
      <p class="muted small wide">
        Ranges: AA, AKs, AKo, AK, 22+, A2s+, KTo+, K8s-K2s, exact combos like AhKh, weights like QQ:0.5.
      </p>
    </form>
  );
}

interface Fields { board: string; oop: string; ip: string; pot: string; stack: string; oopBets: string; ipBets: string; raises: string; allin: string }

function toFields(s: RiverSpot): Fields {
  return {
    board: s.board, oop: s.oop, ip: s.ip, pot: String(s.tree.pot), stack: String(s.tree.stack),
    oopBets: sizesToText(s.tree.oop_bets), ipBets: sizesToText(s.tree.ip_bets), raises: sizesToText(s.tree.raises),
    allin: s.tree.allin ? 'yes' : 'no',
  };
}

function num(x: string, name: string): number {
  const v = Number(x);
  if (!Number.isFinite(v) || v <= 0) throw new Error(`${name} must be a positive number`);
  return v;
}
