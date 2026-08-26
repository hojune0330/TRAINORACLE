# Todo 6 Green Verification

- `node --test specs/test-packages/validate-personalized-prescription-v2-race-placement.test.mjs`
  - Exit `0`; `3/3` pass.
- `node specs/test-packages/validate-personalized-prescription-v2-race-placement.mjs`
  - Exit `0`; `0 ACTIVE`, `12 reviewed`, `12 DO_NOT_APPROVE`, `numericTaperAuthority=NOT_GRANTED`, `retentionAuthority=NOT_AUTHORIZED`.
- `./node_modules/.bin/vitest run test/race-placement.contract.test.ts test/plan-beta-generation.test.ts test/plan-beta-continuity.test.ts test/plan-beta-selection.test.ts test/plan-energy-intent.test.ts test/support-only-candidate-pair.contract.test.ts test/plan-adaptation.test.ts --reporter=dot` from `impl/`
  - Exit `0`; `7 files`, `488/488` pass.
- `npm run test:unit -- --run src/domain/plan-beta-v3.contract.test.ts src/domain/detailed-prescription-runtime-authority.contract.test.ts src/domain/plan-beta-detailed-candidates.contract.test.ts src/domain/plan-beta-pace-storage.contract.test.ts src/domain/plan-beta-flow.contract.test.ts src/domain/plan-adaptation-parser-parity.contract.test.ts src/domain/plan-adaptation-store.contract.test.ts` from `app/`
  - Exit `0`; `7 files`, `193/193` pass.
- `node --test specs/test-packages/validate-personalized-prescription-v2-race-placement.test.mjs specs/test-packages/validate-personalized-prescription-v2-taper-authority.test.mjs specs/test-packages/validate-detailed-prescription-catalog.test.mjs specs/test-packages/validate-training-schedule-research-acceptance.test.mjs`
  - Exit `0`; `53/53` pass.
- Standalone race-placement, taper-authority, detailed-catalog, and training-schedule research validators
  - Exit `0` for all four.
- `npm run typecheck` from `impl/`
  - Exit `0`.
- `npm run typecheck` from `app/`
  - Exit `0`.
- `npm run build` from `app/`
  - Exit `0`; Vite transformed `1,929` modules.
- Temporary production-import manual matrix
  - Exit `0`; `1/1` pass, `12` event/projection rows, `0` storage writes, `0` network calls.
- `git diff --check`
  - Exit `0`; only existing line-ending warnings were emitted.

Final dormant-permutation hardening rerun: the focused race-placement suite passed `18/18`; both typechecks and the `1,929`-module production build passed again after spacing was validated on permuted rather than original coordinates.

The exact Todo 6 planned continuity command initially exposed one stale pre-Todo-6 fixture that omitted mandatory `eventDistanceM`. The test-only fixture now supplies `1500`; its isolated rerun passed `2/2`, and the final combined impl aggregate passed `488/488`.
