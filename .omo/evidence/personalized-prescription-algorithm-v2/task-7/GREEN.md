# Todo 7 automated verification

All commands ran from the worktree root on 2026-08-23 KST.

## Current-input focused gates

- `npm --prefix impl test -- test/plan-adaptation-registry.contract.test.ts test/plan-adaptation.test.ts test/plan-adaptation-baseline.test.ts test/plan-selection-guard.contract.test.ts`
  - exit 0; 4 files, 77/77 tests passed.
- `npm --prefix app run test:unit -- --run src/domain/plan-adaptation-store.contract.test.ts src/domain/plan-adaptation-parser-parity.contract.test.ts src/domain/plan-adaptation-ui.contract.test.ts src/screens/plan-beta/PlanAdaptationFlow.contract.test.tsx`
  - exit 0; 4 files, 117/117 tests passed.
- `npm --prefix impl run typecheck`
  - exit 0.
- `npm --prefix app run typecheck`
  - exit 0.
- `npm --prefix app run build`
  - exit 0; Vite 6.4.3, 1,930 modules transformed.

## Todo 2-6 adjacent regressions

- Expanded impl generation, continuity, selection, energy-intent, support-pair,
  race-placement, and adaptation command: exit 0; 10 files, 504/504 passed.
- Expanded app v3, detailed-authority, detailed-candidate, pace storage, flow,
  parser, store, UI, and screen command: exit 0; 9 files, 215/215 passed before
  the final additional reverse-UI assertion. The current-input focused 117-test
  gate above includes that final assertion.
- Related validator mutation suites: 73 tests total, 70 passed and 3 failed.
  The failures are the pre-existing adaptive-policy document assertions for
  current-frame prose/mutation targets. Their spec and validator inputs are
  unchanged by Todo 7, and spec edits are outside this task. Race placement,
  taper authority, detailed catalog, and training-research validators all exit
  0.

## Boundary assertions covered

- Exactly two ACTIVE VOLUME edges; FREQUENCY/INTENSITY inactive.
- Existing sibling-only transforms preserve topology, intent, detail, and
  frequency and bind deterministic JSON pointers.
- SELF_SERVICE/SELF mutation only; COACH_AUTHORED remains COACH_REQUIRED and
  read-only at the local acceptance boundary.
- D9 ACTIVE/UNKNOWN, stale safety, active hold, stale base, cross-event,
  no-op, multi-dimension, journal-like trigger fields, raw/private fields,
  malformed nested candidates, and rehashed metadata mutations fail closed.
- Acceptance checks 72 hours minus 1 ms as eligible and exact/plus 1 ms as
  expired; rejected paths preserve active bytes.

