# P1 Target Patch Plan 08: Rule, Classifier, And Exposure Binding

```yaml
issue_id: OI-FA-RULE-CLASSIFIER-EXPOSURE-BINDING-001
approved: false
state: READY_FOR_OWNER_APPROVAL
readiness_class: REQUIRES_RUNTIME_TARGET
classification: NORMALIZED_EXPOSURE_ADAPTER
runtime_authorized: false
canonical_spec_patch_authorized: false
owning_files:
  - `specs/active/RULE_SPEC_D1_D9.md`
  - `specs/active/SESSION_CLASSIFIER_SPEC.md`
  - `specs/reconstruct/FORMATION_COACH_RULESET_AND_EXPOSURE_CONTRACT.md`
  - `specs/active/PLAN_GENERATOR_SPEC.md`
owning_issues:
  - `OI-FA-RULE-CLASSIFIER-EXPOSURE-BINDING-001`
  - `OI-D2-MAIN-INTERVAL-001`
  - `OI-SC-MAIN-LABEL-HEURISTIC-001`
  - `PROPOSED-OI-PG-NORMALIZED-EXPOSURE-LEDGER-001`
```

## Classification

Semantic adapter: preserve classifier labels while calculating normalized MAIN exposure.

## Governing Decision

`FORMATION_COACH_RULESET_ACCEPTANCE_DECISION.md` requires competition to remain
`COMPETITION` while counting once as MAIN exposure; the coach ruleset is not accepted.

## Exact Targets

Patch the four listed specs. Create the proposed Plan Generator issue at that exact file
only after recount and acceptance of adapter inputs, output, dedupe, boundary, and failure states.

## Prerequisites

- Coach ruleset plan 01 is approved with exposure registry and frame boundary.
- Rule owner accepts D1/D2 consuming normalized ledger without namespace change.
- Classifier owner accepts immutable original label and adapter lineage.

## Forbidden Work

No rewriting COMPETITION to MAIN, non-MAIN promotion, planned/completed summation,
duplicate exposure, classifier heuristic redefinition, or runtime patch.

## Impact

Schema: future exposure ledger with original classifier label, normalized exposure class,
source session/version, frame and dedupe identity. API/runtime: none now.

## Baseline

Formation counts competition as one MAIN exposure; D1/D2 consume MAIN semantics and
Classifier preserves COMPETITION. No accepted adapter joins those facts.

## RED

Fail cases for COMPETITION not counted, label rewritten, duplicate adapter row, planned
plus completed double count, non-MAIN auto-promotion, and end-boundary counted twice.

## Patch Order

1. Accept adapter contract in coach ruleset/exposure contract.
2. Patch Classifier output lineage without changing label taxonomy; recount.
3. Patch D1/D2 input contract to consume normalized ledger; recount.
4. Recount Plan Generator and create exact proposed issue.
5. Bind Plan Generator to one accepted ledger version and rejection behavior.

## GREEN

Competition label round-trips unchanged and contributes exactly one exposure; duplicates,
unknown versions and boundary conflicts reject; planned/completed remain sibling views.

## Manual QA

Coach reviews MAIN workout, competition, support composite, planned-only, completed-only,
duplicate import, moved session, and exact frame-end examples with ledger trace.

## Migration, Rollback, And Kill Switch

No migration now. Future backfill never invents classification; unresolved legacy is
unknown/review-required. Rollback disables adapter output; `normalizedExposureEnabled=false`.

## Privacy And Security Review

Privacy reviewer confirms ledger excludes note data and sensitive reasons. Security
reviewer verifies athlete/tenant/session/version/frame scope and duplicate resistance.

## Closure Evidence

Accepted adapter version/hash, target diffs/recounts, RED/GREEN logs, label preservation
and exactly-once proofs, manual coach trace, reviewer sign-offs, and closure PR.

## Latest Research Reconciliation

```yaml
latest_owner_baseline: reports/review/FORMATION_LATEST_OWNER_DECISION_BASELINE.md
related_conflicts:
  - FRV2-CONF-011
  - FRV2-CONF-012
research_inputs:
  - reports/research/FORMATION_COMPETITION_ANCHOR_EVIDENCE_SUPPLEMENT.md
  - reports/review/FORMATION_LATEST_DECISION_AND_USER_GAP_AUDIT_V2.md
decision_packets:
  - FORMATION_COACH_RULESET_ACCEPTANCE_DECISION.md
  - reports/review/FORMATION_COMPETITION_ANCHOR_DECISION_PACKET_V1.md
prepared_evidence:
  - specs/test-packages/FORMATION_COACH_RULESET_FIXTURES.md
remaining_named_gates:
  - P1_PLAN_01_APPROVED
  - RULE_OWNER_ADAPTER_DECISION
  - CLASSIFIER_OWNER_ADAPTER_DECISION
  - CA-02_CA-03_OWNER_DECISION
approval_state_unchanged: true
runtime_authorized: false
canonical_spec_patch_authorized: false
```

## Human Decision

`COACH_HOJUNE`, Rule owner, and Classifier owner approve one adapter contract. Current
answer: NOT_RECORDED; plan unapproved and P1 OPEN.
