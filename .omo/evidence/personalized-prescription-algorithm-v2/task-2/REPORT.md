# Todo 2 DoneClaim

## Result

Todo 2 domain/storage boundary is implemented at base HEAD `5ea2eed9fce0f0ddb314358d57c0b2fc538b9daa` with no commit or push.

- New writes use strict stored plan v3.
- `eventDistanceM` is the sole exact target event; evidence records remain independently scoped.
- Null template selection stays RPE-only; explicit same-event approved selection can bind one detailed session in both candidates.
- Template, target, candidate, pair, active state, history, and adaptation identities are strict and atomically invalidated on tamper.
- Race date is date-only in request/preview memory. The pinned `NOT_AUTHORIZED` artifact permits no persisted race or placement bytes.
- Race-date futurity is measured against the authoritative process-local civil date, not UTC. At `2026-08-24 00:30 KST`, `2026-08-24` is rejected and `2026-08-25` remains a preview-only future date.
- v1/v2 retain their strict parsers, are load/view-only, and cannot be rewritten through the v3 writer.
- Legacy plans cannot progress or adapt through the v3-only mutation boundaries.

## Verification

Verifier-blocker green totals: KST boundary 10/10, impacted app domain/storage 98/98, and impl generation/selection 31/31. The input-unchanged prior Todo 2 adaptation receipts remain 107/107 domain and 6/6 screen. App and impl typechecks pass. Production build passes with 1,925 transformed modules. The production-import KST matrix passed 1/1 with zero observed persistence/network writes. `git diff --check` exits 0.

The exact command receipts are in `GREEN.log`; production matrix and persistence classifications are machine-readable JSON.

## Stage Boundaries

Two later-plan dependencies remain intentionally visible rather than hidden:

1. `PlanBeta.contract.test.tsx` has 19 intake-flow failures because exact 800/1500/3000 selection UI is assigned to Todo 9. An implicit 1500m default would violate Todo 2.
2. The immutable Todo 1 authority validator exits 1 with `stored plan schema characterization is stale` because it records baseline v2. Todo 2 ownership forbids changing that validator; validator/spec reconciliation belongs to the later reconciliation task.

`PlanBeta.persistence-retry.contract.test.tsx` passed in the combined screen run, and the exact-event adaptation screen caller is green 6/6.

## Residual Risk

- The current pre-Todo-9 athlete screen cannot create a new exact middle-distance target, although production domain APIs and storage are complete.
- IndexedDB/export/backup/telemetry were classified from actual reviewed surfaces; no nonexistent product surface was fabricated for testing.
- Full repository suites and browser UI were not run because this Todo's planned boundary is domain/storage and the user requested only the remaining focused gates.
- The local civil date follows the host process timezone, matching the existing journal date convention; timezone remains internal and is not athlete/request supplied.
