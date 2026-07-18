# P1 Target Patch Plan 03: Minimum Evidence

```yaml
issue_id: OI-FA-MINIMUM-EVIDENCE-001
approved: false
state: READY_FOR_OWNER_APPROVAL
readiness_class: REQUIRES_HIGH_ACCURACY_RESEARCH
classification: EVIDENCE_ELIGIBILITY_AND_STATISTICAL_SUPPRESSION
runtime_authorized: false
canonical_spec_patch_authorized: false
owning_files:
  - `specs/reconstruct/FORMATION_LOAD_AND_STATISTICAL_RULES_CONTRACT.md`
  - `specs/active/PHYSIO_SOURCE_TRUST_SPEC.md`
  - `specs/reconstruct/ANALYSIS_AND_VISUALIZATION_DATA_CONTRACT.md`
  - `specs/reconstruct/METRIC_ALGORITHM_CONTRACT.md`
owning_issues:
  - `OI-FA-MINIMUM-EVIDENCE-001`
  - `OI-PST-LONGITUDINAL-TREND-MODEL-001`
  - `PROPOSED-OI-AVD-FORMATION-EVIDENCE-SUPPRESSION-001`
  - `PROPOSED-OI-MAC-FORMATION-MINIMUM-EVIDENCE-001`
```

## Classification

Evidence eligibility, typed missingness, and privacy-preserving suppression; not proof
of model validity, safety, efficacy, or future performance.

## Governing Decision

`FORMATION_RESEARCH_ACCEPTANCE_DECISION.md` permits descriptive evidence boundaries.
`FORMATION_PRIVACY_GOVERNANCE_DECISION.md` leaves statistical privacy unaccepted.

## Exact Targets

The two proposed issues are created only in the exact listed reconstruct files after
their issue tables are opened/recounted and qualified privacy plus statistics reviewers
accept thresholds, freshness, repeated-query controls, and full suppression behavior.

## Prerequisites

- Owner selects pilot history/freshness thresholds per frame type.
- Statistics reviewer accepts typed absence/staleness and low-n suppression.
- Qualified privacy reviewer accepts cohort/query protections and youth handling.
- Physio source versions eligible for use are explicitly accepted.

## Forbidden Work

No hidden imputation, missing-as-zero, stale-as-current, low-n disclosure, small-cell
subtraction attack, cross-athlete comparison, prediction, or plan authority.

## Impact

Schema: evidence-status, freshness, source-version, suppression reason. API: output is
either eligible descriptive facts or typed suppression. Runtime: none until approved.

## Baseline

Candidate research rules exist, but thresholds and statistical privacy are unresolved;
Physio longitudinal trend policy remains open and group output authority is false.

## RED

Add failing fixtures for insufficient history, stale source, unsupported version,
missing required field, low-n cohort, differencing query, and unauthorized audience.

## Patch Order

1. Record owner/statistics/privacy threshold decisions.
2. Patch evidence state and suppression registry in the load contract.
3. Bind only accepted Physio sources and freshness semantics.
4. Recount and create exact Analysis and Metric issues.
5. Patch typed suppression outputs without exposing counts or source refs when forbidden.

## GREEN

Every ineligible case returns a typed non-disclosing state; eligible cases preserve
sample count, missingness, source version, units, uncertainty, and descriptive-only label.

## Manual QA

Review one sufficient case and six suppression cases at athlete, coach, guardian, and
unauthorized scopes; confirm the screen cannot reveal suppressed counts by comparison.

## Migration, Rollback, And Kill Switch

No migration now. Future derived records are reproducible by policy version; rollback
suppresses newly unsupported output; `formationStatisticsEnabled=false` is fail-closed.

## Privacy And Security Review

Named statistics and qualified privacy reviewers approve thresholds and query controls;
security review verifies tenant/audience scope and repeated-query rate/audit controls.

## Closure Evidence

Signed threshold matrix, source allowlist, RED/GREEN logs, suppression manual QA,
privacy attack review, exact target diffs/recounts, and closure PR.

## Latest Research Reconciliation

```yaml
latest_owner_baseline: reports/review/FORMATION_LATEST_OWNER_DECISION_BASELINE.md
related_conflicts:
  - FRV2-CONF-003
  - FRV2-CONF-010
research_inputs:
  - reports/research/FORMATION_MINIMUM_EVIDENCE_METHODS_REVIEW.md
  - reports/research/RACE_DESCRIPTIVE_ANALYSIS_REVIEW.md
decision_packets:
  - reports/review/FORMATION_MINIMUM_EVIDENCE_DECISION_PACKET_V2.md
prepared_evidence:
  - .omo/evidence/formation-research-v2/within-athlete-minimum-evidence-primary-research.md
remaining_named_gates:
  - COACH_HOJUNE_THRESHOLD_DECISION
  - LONGITUDINAL_N_OF_1_STATISTICIAN_REVIEW
  - QUALIFIED_PRIVACY_REVIEW
  - ACCEPTED_HUMAN_RESEARCH_APPRAISAL
approval_state_unchanged: true
runtime_authorized: false
canonical_spec_patch_authorized: false
```

## Human Decision

`COACH_HOJUNE` selects thresholds or keeps all affected sources rejected and output
fully suppressed. Current answer: NOT_RECORDED; plan unapproved, P1 OPEN.
