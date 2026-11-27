# GTO / Poker trainer

Postflop practice trainer for ClubWPT Gold / WPT Global. It started as a single-file claude.ai artifact, now kept in `legacy/index.html` (~560KB, ~5,800 lines). New code is being migrated into `src/` piece by piece.

## Layout and commands
- `legacy/index.html`: original app, still runnable (`npm run legacy`). Source of the code being extracted.
- `src/engine/`: pure poker logic, no DOM (cards, eval, equity, ev, ranges, grading). Needs tests.
- `src/strategy/node.ts`: `StrategyNode`, the shape every strategy view reads. `approx/` = live EV engine, `solved/` = solver tables.
- `src/features/`: `matrix/` (hand analysis), `play/` (table, coach card, bots), `scenarios/` (drill recipes + generator, packs in `packs/`), `review/`, `profile/`.
- `src/ui/`: shared presentational components. `data/`: bundled ranges and solutions. `tools/`: offline scripts, never shipped.
- `python/gto/`: readable Python mirror of `src/engine/` (same function names in snake_case). Keep both in sync: any engine change goes in both, and both must pass the shared fixtures in `tests/fixtures/`.
- `tests/fixtures/*.json`: outputs recorded from the legacy app (`npm run fixtures`). Both engines take a seeded `mulberry32` rng and must match these exactly.
- `npm run dev` / `npm test` / `npm run test:py` / `npm run test:all` / `npm run build` (Vite + vite-plugin-singlefile builds to `dist/index.html`).
- Workflow: `main` is the base; do each feature or change on its own branch.

## Hard constraints (from the artifact host)
- The shipped build must stay ONE self-contained .html file under 16 MB.
- External scripts only from cdnjs.cloudflare.com, cdn.jsdelivr.net/npm/, cdn.tailwindcss.com, code.jquery.com (exact pinned versions). External CSS only from fonts.googleapis.com. No other network requests.
- If the code is split into modules, add a build step that bundles back into one index.html.

## Engine map (search these names in legacy/index.html)
- Hand evaluator: `score()`; Monte Carlo equity: `equity()`, `eqW()` (350-900 random iterations per option).
- Preflop EV: `evOpen`, `evVsOpen`, `evVs3bet`, `evVsJam`; realization factors in `preR()` (hard-coded constants).
- Postflop EV: `evPost`, `buildSizeModel`, `respondBal` (balanced-opponent leg), `polFacing` / `polNoBet` (opponent response model), `botClass` (hand classes M, S, m, w, d, a).
- Grading: `heroDecision` picks best option by EV; a loss >= 0.15bb counts as a mistake and feeds leak categories and the Profile tab.
- UI: `decisionCard` (coach card), `renderOpps` (opponents panel), Review tab import (`renderImport`, `parseShorthand`).

## Added in the latest session
- `spotRead()` -> `meta.read` on every postflop decision, shown by `readHTML()` in the coach card:
  - capped vs uncapped: share of combos with two pair or better, for hero (`heroRangeEst`, built from the preflop line in `HND.heroPre` and earlier checks/calls) and for villains. Labels from `CAP_LBL`.
  - fold elasticity: `foldElasticity()`, arc elasticity of folding between 1/3 and 3/4 pot. A balanced defender (folds f/(1+f)) is about 0.7; label cutoffs 0.85 / 0.55.
  - board stickiness: `stickiness()`, continue frequency vs a 2/3-pot bet divided by MDF, scored 0-100 (50 = balanced).
- Hero credibility: `meta.read.cred` (0.94-1.12) multiplies how much villains defend in the balanced leg of `buildSizeModel` / `respondBal`. This changes graded EV for bets and raises. Easy to make display-only.
- Opponents panel: play-style tag replaced by fact chips (`profFacts`, reference hand mix `REFMIX`).

## Known issues / next work
1. Sampling noise: ~2.4 pt equity standard error at 450 iterations is ~0.5bb on a 20bb pot, bigger than the 0.15bb mistake threshold, and options are sampled independently. Fix: exact enumeration on turn/river, shared random boards across options, faster evaluator.
2. Opponent response curves are flat: fold elasticity is 0.24-0.28 for every profile vs a 0.7 balanced benchmark, so bet size barely moves bot folds. Recalibrate `PF_CONT` / `polFacing`.
3. Realization factors in `preR()` should depend on hand class, position, texture.
4. Nash work (goal: equilibrium benchmarks, not exploitable): solve heads-up river spots exactly (CFR or LP) offline, ship tables as data; add an exploitability check of the user's own strategy profile; flop and multiway stay approximate and should be labeled as such.
5. Hand import: Review tab takes screenshot, pasted text, or shorthand like `BTN AhKd vs BB | 6max 100bb | open 2.5 call | F QsJd4c: x b4 c | T 7h: x x | R 2s: b14 c | shows QhTh | -20.5`.

## Working agreements
- Add tests before changing equity or grading code; assert results are stable across runs.
- Describe opponents with facts (elasticity, stickiness, capped/uncapped), not play-style labels.
- Where the app says "equilibrium" it must mean a solved spot; otherwise say "approximation".
