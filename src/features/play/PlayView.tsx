import { srpBtnVsBb } from '@/features/scenarios/packs/srp-btn-vs-bb';

// Play screen. Planned pieces in this folder:
// Table, ActionBar, CoachCard, dealer.ts (hand state machine), opponents/ (bot models).
export function PlayView() {
  return (
    <section>
      <h2>Play</h2>
      <p class="muted">Pick a scenario (dealing not wired up yet):</p>
      <ul>
        {srpBtnVsBb.map((s) => (
          <li key={s.id}>{s.name}</li>
        ))}
      </ul>
    </section>
  );
}
