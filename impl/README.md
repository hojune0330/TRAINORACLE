# TrainOracle Implementation Skeleton

```yaml
status: IMPLEMENTATION_SKELETON
runtime_evidence_source: runtime-evidence/d9-evaluator/
d9_evaluator_source_sha256: 5caf8dd5c2e860435e2eba3d7966ab173a125bc5f1d55aab663f113ed60649a3
source_package: specs/test-packages/D9_SAFETY_EVALUATOR_V2_1_1_TEST_PACKAGE.md @ origin/main 90cbd61
```

This skeleton implements the minimum D9 -> RVE -> Safety Gate -> Plan Generator contract slice from `CODEX_WORK_ORDER_001.md`.

It does not claim production readiness, canonical promotion, or issue closure.

## Typed MAIN Ledger (Draft Decision Support)

The public skeleton exposes a typed `LOCAL_CIVIL_9_5` Formation input and
`compileExposureLedger()` data helper. A normal 9.5-day frame has 19 ordered
local-civil half-day slots and explicit `TRAINING_MAIN`, `COMPETITION`, or
`NONE` classifications. Generic `QUALITY` or energy-intent labels do not count
as MAIN.

Only a valid ledger with exactly two or three explicit MAIN exposures can yield
a generated candidate. Older 7/9/10 frame requests, collisions, malformed
ledger data, or other MAIN counts yield `NEEDS_REVIEW_WITH_REASON` with the
conservative `KEEP_CURRENT_PLAN_AND_RECOVERY_GUIDANCE` alternative.

This is a product convention and draft decision-support mechanic, not a claim
that 9.5 days or two-to-three MAIN exposures are universally optimal or safer.
It does not create an automatic prescription, activate a plan, define UI marker
meaning, or enable an application feature. A selection result is only a
`SELECTED_BETA_SNAPSHOT`; later activation and display work remain outside this
skeleton.

[DRAFT_COMPLETE]
