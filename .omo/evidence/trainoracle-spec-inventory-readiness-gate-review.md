# TrainOracle SPEC Inventory/Readiness Gate Review

recommendation: REJECT

## originalIntent

Proceed according to plan for the first TrainOracle SPEC work unit only: produce confirmed local inventory, missing/quarantine evidence, and reconstruction readiness under `.omo`; do not edit product SPEC files; do not close issues; do not claim runtime evidence; treat belief files as reference only.

## desiredOutcome

A future worker can rely on the listed `.omo` artifacts as a complete readiness package: C001 inventory sections are present and generated from local files, C002 missing/quarantine search results are explicit and caveated, C003 readiness guardrails are present, and the loop/review state is not stale or misleading.

## userOutcomeReview

The main inventory/readiness documents mostly satisfy the content-level request: C001 contains the required classification sections; C002 contains search roots, explicit found/not-found results, alias/source-map handling, quarantine heuristics, and unsupported-claim caveats; C003 contains the required guardrails for future `RULE_VALIDATION_ENGINE_CONTRACT.md` and `PLAN_SAFETY_GATE_SPEC.md` reconstruction.

I cannot approve unconditionally because the artifact set still has stale completion state and missing final-review coverage. The durable goal remains `pending` while its criteria are marked `pass`, the included draft handoff still says it is waiting on earlier planning inputs, and there is no scoped code-review/manual-QA report demonstrating the required remove-ai-slops/programming overfit/slop coverage.

## checkedArtifactPaths

- `.omo/evidence/trainoracle-confirmed-inventory.md`
- `.omo/evidence/trainoracle-confirmed-inventory.stdout.txt`
- `.omo/evidence/trainoracle-missing-quarantine.md`
- `.omo/evidence/trainoracle-missing-quarantine.stdout.txt`
- `.omo/reports/trainoracle-reconstruction-readiness.md`
- `.omo/evidence/trainoracle-no-product-spec-edits.txt`
- `.omo/ulw-loop/019ef850-bb65-7082-ad74-7dc718b3f8e8/goals.json`
- `.omo/ulw-loop/019ef850-bb65-7082-ad74-7dc718b3f8e8/ledger.jsonl`
- `.omo/drafts/train-oracle-spec-handoff.md`

## directSkillPass

- `omo:remove-ai-slops` was loaded and applied as a final-review criterion over the scoped artifacts. No production-code diff was in scope, so no code cleanup was evaluated directly. The artifact set lacks a code-review report or equivalent reviewer artifact explicitly covering overfit/slop risks such as tautological evidence, implementation-mirroring checks, deletion-only tests, or unnecessary extraction.
- `omo:programming` was loaded and applied as a review criterion. No `.py`, `.ts`, `.tsx`, `.go`, or `.rs` production edit was in scope. The relevant criterion is evidence quality: tests/stdout should not create false confidence, and status artifacts must not drift from actual completion state.

## blockers

1. Stale ULW goal state blocks unconditional approval. In `.omo/ulw-loop/019ef850-bb65-7082-ad74-7dc718b3f8e8/goals.json`, the work-unit goal is still `"status": "pending"` at line 14, while C001, C002, and C003 are each recorded as `"status": "pass"` at lines 23, 33, and 43. This is exactly the stale-state class the user asked the gate to catch.

2. The included handoff draft still reflects an earlier planning state. `.omo/drafts/train-oracle-spec-handoff.md` says `status: drafting` at lines 3 and 92, `pending-action: ingest remaining user materials...` at line 5, and `pending_user_input: more source materials...` at line 93. It also still asks whether to produce an inventory report at lines 88-89, even though this work unit produced the inventory evidence. That can mislead the next worker about whether the first work unit is complete.

3. Required review coverage is absent. The scoped artifacts contain no code-review report/manual-QA matrix with remove-ai-slops/programming overfit/slop coverage. The only skill-related ledger evidence says no programming skill was needed (`ledger.jsonl` line 5), and there is no `remove-ai-slops`, overfit/slop, tautology, implementation-mirroring, or reviewer approval coverage in the scoped artifacts. Per final-gate rules, absent or unsupported report coverage is a rejection condition.

4. No-product proof is partial for external source files. `.omo/evidence/trainoracle-no-product-spec-edits.txt` shows workspace `git status --short` as only `?? .omo/` at lines 4-5, which supports no tracked workspace product SPEC edits. But line 25 explicitly notes the source package is outside workspace git status and then self-attests read-only access. Within the allowed artifact set, there is no independent transcript proving external source-package SPEC files were not modified.

## supportingEvidence

- C001 required sections are present in `.omo/evidence/trainoracle-confirmed-inventory.md`: `SPEC_ACTIVE` lines 17-28, `TEST_PACKAGES` lines 30-34, `LEGACY_REFERENCE` lines 36-47, `MISSING_OR_RECONSTRUCT` lines 49-56, `QUARANTINE_DUPLICATES` lines 58-60, and `UNKNOWN_REVIEW_REQUIRED` lines 62-64. Alias handling is explicit at lines 66-69.
- C002 required search roots and results are present in `.omo/evidence/trainoracle-missing-quarantine.md`: search roots lines 9-10; required filename results lines 16-20; `_SOURCE_TO_DOC_MAP_v3.0.md` and `SOURCE_MAP.md` handling lines 26 and 40; unsupported-claim caveats lines 73-77.
- C003 readiness guardrails are present in `.omo/reports/trainoracle-reconstruction-readiness.md`: scope and no-runtime/no-closure caveat line 5; belief-file reference rule line 9; no original-restored/canonical/closure claim line 11; namespace separation lines 12-14; D9/advisory/raw-text/runtime guardrails lines 15-18; target-specific must-not-claim sections lines 77-88 and 159-170; execution order lines 180-186.

## exactEvidenceGaps

- No scoped reviewer artifact showing the same remove-ai-slops/programming perspective and overfit/slop criteria coverage required by the final gate.
- No clean final state in `goals.json`; pass criteria coexist with a pending top-level goal.
- No updated handoff draft state reflecting that this inventory/readiness work unit has completed.
- No artifact-level proof, beyond self-attestation, that external source-package files under `D:/admin/Downloads/...` were not edited.

