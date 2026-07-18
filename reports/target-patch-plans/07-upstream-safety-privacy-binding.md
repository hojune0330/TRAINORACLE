# P1 Target Patch Plan 07: Upstream Safety And Privacy Binding

```yaml
issue_id: OI-FA-UPSTREAM-SAFETY-PRIVACY-BINDING-001
approved: false
state: READY_FOR_OWNER_APPROVAL
readiness_class: REQUIRES_RUNTIME_TARGET
classification: SAFETY_BLOCK_MATERIALIZATION_AND_NOTE_ZERO_SIGNAL
runtime_authorized: false
canonical_spec_patch_authorized: false
owning_files:
  - `specs/reconstruct/PLAN_SAFETY_GATE_SPEC.md`
  - `specs/reconstruct/RULE_VALIDATION_ENGINE_CONTRACT.md`
  - `specs/active/RVE_RULE_EVALUATOR_BINDING_SPEC.md`
  - `specs/active/PLAN_GENERATOR_SPEC.md`
owning_issues:
  - `OI-FA-UPSTREAM-SAFETY-PRIVACY-BINDING-001`
  - `OI-PSG-RUNTIME-EVIDENCE-001`
  - `OI-PSG-PLAN-GENERATOR-PATCH-001`
  - `OI-PG-RULE-SAFETY-GATE-BINDING-001`
```

## Classification

Safety-critical, privacy-critical upstream contract. It must fail closed and cannot
represent medical clearance.

## Governing Decision

`FORMATION_PRIVACY_GOVERNANCE_DECISION.md` requires private-note zero signal and forbids
note-derived CLEARED authorization. Runtime remains blocked by `FORMATION_RUNTIME_READINESS_DECISION.md`.

## Exact Targets

Patch only the four named contracts in this plan. After contract acceptance, a separate
runtime authorization may target `impl/src/d9/evaluator.ts`, `impl/src/rve/signal.ts`,
`impl/src/safety-gate/gate.ts`, and `impl/src/plan-generator/generator.ts`; this plan does
not authorize those edits.

## Prerequisites

- Named qualified privacy reviewer approves note-origin behavior.
- Safety owner accepts versioned, expiring, target-bound `SafetyBlockRef` states.
- Owner accepts opaque ACTIVE/UNKNOWN/STALE only and no analyzable-note authorization.

## Forbidden Work

No private-note content, presence, length, hash, metadata, audit, cache, or telemetry;
no note-derived CLEARED/advisory authorization; no runtime edit or medical claim now.

## Impact

Schema: future opaque block ref with target/version/expiry, never note origin detail.
API: fail-closed block/unknown/stale. Runtime: separately gated and currently prohibited.

## Baseline

Tracked runtime positively permits a D9_CLEARED path. That is conflict evidence, not
Formation coverage; stable target-bound `SafetyBlockRef` evidence is absent.

## RED

Later authorized runtime work first fails tests for note-derived CLEARED continuation,
private-note trace leakage, expired/wrong-target ref acceptance, and missing ref bypass.

## Patch Order

1. Qualified reviewer accepts privacy origin and opaque-state contract.
2. Patch Safety Gate materialization and validation semantics; recount.
3. Patch RVE contract/binding to emit no analyzable-note authorization signal.
4. Patch Plan Generator consumption contract; recount its binding issue.
5. Seek separate runtime authorization; only then perform RED-to-GREEN implementation.

## GREEN

Contract fixtures prove private-note complete zero signal; analyzable-note positive state
cannot authorize; opaque blocks are versioned, expiring and target-bound; all bypasses reject.

## Manual QA

Privacy and safety reviewers trace private-only, analyzable ACTIVE, CLEARED, UNKNOWN,
STALE, expired, wrong-target, and non-note structured cases through the contract.

## Migration, Rollback, And Kill Switch

No migration now. Future rollout invalidates legacy unbound refs, retains no note-derived
positive artifact, rolls back to global block, and uses `formationSafetyBindingEnabled=false`.

## Privacy And Security Review

Named qualified privacy reviewer and independent security/safety reviewers are mandatory;
threat model covers inference, replay, substitution, stale ref, IDOR, logs, and telemetry.

## Closure Evidence

Signed contract decisions, zero-signal proof, target diffs/recounts, later executable
RED/GREEN logs, threat model, log scrub, ref expiry/target tests, and closure PR.

## Latest Research Reconciliation

```yaml
latest_owner_baseline: reports/review/FORMATION_LATEST_OWNER_DECISION_BASELINE.md
related_conflicts:
  - FRV2-CONF-007
  - FRV2-CONF-010
research_inputs:
  - reports/review/FORMATION_RUNTIME_SECURITY_AND_PRIVACY_AUDIT.md
  - reports/research/RACE_DESCRIPTIVE_ANALYSIS_REVIEW.md
decision_packets:
  - FORMATION_PRIVACY_GOVERNANCE_DECISION.md
  - reports/review/PRIVACY_YOUTH_QUALIFIED_REVIEW_PACKET.md
prepared_evidence:
  - reports/review/FORMATION_USER_SCENARIOS_AND_TEACH_BACK_V1.md
remaining_named_gates:
  - NAMED_QUALIFIED_PRIVACY_REVIEW
  - SAFETY_OWNER_REFERENCE_STATE_DECISION
  - INDEPENDENT_SECURITY_REVIEW
  - COACH_HOJUNE_GOVERNANCE_DECISION
approval_state_unchanged: true
runtime_authorized: false
canonical_spec_patch_authorized: false
```

## Human Decision

`COACH_HOJUNE` may approve the target plan only after qualified privacy and safety review.
Current answer: NOT_RECORDED; plan unapproved and P1 OPEN.
