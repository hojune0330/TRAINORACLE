# P1 Target Patch Plan 02: Load Components

```yaml
issue_id: OI-FA-LOAD-COMPONENT-001
approved: false
state: READY_FOR_OWNER_APPROVAL
readiness_class: REQUIRES_HIGH_ACCURACY_RESEARCH
classification: DESCRIPTIVE_LOAD_ACCOUNTING
runtime_authorized: false
canonical_spec_patch_authorized: false
owning_files:
  - `specs/reconstruct/FORMATION_LOAD_AND_STATISTICAL_RULES_CONTRACT.md`
  - `specs/active/SESSION_CLASSIFIER_SPEC.md`
  - `specs/active/PLAN_GENERATOR_SPEC.md`
  - `specs/reconstruct/METRIC_ALGORITHM_CONTRACT.md`
owning_issues:
  - `OI-FA-LOAD-COMPONENT-001`
  - `OI-SC-ALLOCATION-INVARIANT-FAILURE-001`
  - `OI-SC-MULTI-ENERGY-POLICY-001`
  - `PROPOSED-OI-PG-LOAD-COMPONENT-BINDING-001`
```

## Classification

Descriptive accounting and unit compatibility. It cannot create readiness, injury-risk,
recovery-complete, prescription, or causal conclusions.

## Governing Decision

`FORMATION_RESEARCH_ACCEPTANCE_DECISION.md` accepts only the research/calculation
boundary. `FORMATION_COACH_RULESET_ACCEPTANCE_DECISION.md` remains blocked.

## Exact Targets

Patch the listed source/target files. Create the proposed Plan Generator issue at that
exact file only after target recount and owner acceptance of the component registry,
allocation invariant, unit vocabulary, and whole-session intensity mapping.

## Prerequisites

- Owner accepts component identifiers, measures, units, allocation precision, and dedupe key.
- Sports-science reviewer confirms every mapping is bookkeeping, not validation of effect.
- Privacy review confirms only eligible structured facts enter allocation.

## Forbidden Work

No ACWR risk zone, composite summation across incompatible units, missing-as-zero,
dominant-system collapse, unreviewed load imputation, or automatic plan recommendation.

## Impact

Schema: component allocation and measure-unit discriminators. API: future read-only
descriptive output. Runtime: none now; eventual parsers must reject unknown registries.

## Baseline

Research fixtures define six invariants and proposed formulas. Session Classifier still
has open allocation and multi-energy issues; no accepted Plan Generator binding exists.

## RED

Add failing cases for allocation sum not equal to one, mixed units summed, duplicate
component ingestion, missing treated as zero, and session intensity inferred from one component.

## Patch Order

1. Freeze the accepted registry/version in the load contract.
2. Bind classifier output without overwriting original classifier labels.
3. Define metric parser rejection/suppression states.
4. Recount Plan Generator and create the exact proposed issue.
5. Bind only versioned descriptive allocations; recount all targets.

## GREEN

Allocation precision, dedupe, compatible-unit, missingness, and mixed-session fixtures
pass; unknown versions reject; no readiness or prescription field is emitted.

## Manual QA

Coach and sports-science reviewer inspect easy run, intervals, strength plus plyometric,
cross-training, competition, and incomplete session examples with displayed units.

## Migration, Rollback, And Kill Switch

No migration authorized. Future records retain original values plus registry version;
rollback selects the prior parser; `descriptiveLoadComponentsEnabled=false` suppresses output.

## Privacy And Security Review

Privacy reviewer verifies structured-field allowlist and note zero-signal. Security
reviewer verifies dedupe keys cannot mix athlete, tenant, plan version, or session scope.

## Closure Evidence

Accepted registry, mapping review, RED/GREEN logs, compatibility matrix, diff and
recount for all targets, reviewer names, source commit, and closure PR.

## Human Decision

`COACH_HOJUNE` must accept or revise units, allocation, intensity mapping, and conflict
behavior. Current answer: NOT_RECORDED; the plan is unapproved and P1 remains OPEN.
