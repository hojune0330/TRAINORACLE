# PLAN_EVENT_BREADTH_V1_IMPLEMENTATION_2026-08-28.md

## Implemented

- Added 10km, half-marathon, and marathon to the existing 800m-5000m intake.
- Bound each distance to one explicit event group across intake, candidate
  identity, storage, history, successor, and adaptation parsing.
- Kept all three new targets on honest duration-and-RPE plans because no active
  detailed pace template exists for them yet.
- Preserved the four currently approved same-event detailed prescriptions.

## Verified So Far

| Check | Result |
|---|---:|
| Focused app event/intake/storage/successor tests | 39 PASS |
| App TypeScript | PASS |
| Impl TypeScript | PASS |
| Full impl tests | 633 PASS |
| Full app tests, default timezone | 1,748 PASS |
| Full app tests, KST | 1,748 PASS |
| Hosted release environment tests | 11 PASS |
| Browser event picker and marathon RPE flow | 8 PASS |
| Production build | PASS |

## Final Boundary Audit

- The browser matrix covers desktop, mobile, 320px, and reduced-motion modes.
- The mobile flow confirms no horizontal overflow and no invented marathon race-pace notation.
- The detailed-template manifest and its four current runtime approvals were not changed.

## Explicit Non-Claim

This implementation does not activate 10km, half-marathon, or marathon numeric
pace prescriptions. Those remain separate reviewed-template work.
