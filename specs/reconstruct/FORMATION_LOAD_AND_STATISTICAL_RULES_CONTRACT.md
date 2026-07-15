# FORMATION_LOAD_AND_STATISTICAL_RULES_CONTRACT.md

```yaml
document_metadata:
  doc_id: trainoracle-formation-load-statistical-rules
  spec_id: FORMATION_LOAD_AND_STATISTICAL_RULES_CONTRACT
  version: 0.1
  status: DRAFT_FOR_REVIEW
  owner: TOTAL_RESPONSIBILITY_HOLDER
  created_from:
    - CODEX_WORK_ORDER_010
    - FORMATION_DEFERRED_GOALS.md
    - OI-FA-LOAD-COMPONENT-001
    - OI-FA-MINIMUM-EVIDENCE-001
  open_issues_total: 4
  canonical_blocking_count: 4
  runtime_authority: false
  executed_tests_total: 0
```

## 1. Purpose

This draft defines descriptive accounting for training facts. It does not define a
readiness score, fatigue diagnosis, injury-risk model, safe zone, or prescription.

## 2. Authority Boundary

```yaml
authority:
  may_describe_observed_training: true
  may_compare_compatible_self_history: true
  may_rank_athletes: false
  may_predict_injury: false
  may_diagnose_fatigue_or_recovery: false
  may_clear_or_block_training: false
  may_change_a_plan: false
```

## 3. Measure Taxonomy

External work and internal response are separate facts.

| Family | Examples | Canonical representation | Forbidden interpretation |
|---|---|---|---|
| external | time, distance, elevation, speed, repetitions | typed physical units | total biological load |
| internal | RPE, HR response | value plus scale/protocol/source | medical recovery or readiness |
| derived | pace, sRPE, named TRIMP method | formula/version plus inputs | interchangeable universal load |
| contextual | surface, weather, session role, competition | explicit category/source | causal explanation |

```yaml
canonical_units:
  duration: seconds
  distance: metres
  elevation: metres
  speed: metres_per_second
  pace: seconds_per_kilometre
  heart_rate: beats_per_minute
  power: watts
  repetitions: integer_count
  rpe: dimensionless_named_scale
  method_specific_load: arbitrary_units_with_method_id
```

Values with different dimensions or different arbitrary-unit methods are never added.

## 4. Source And Method Provenance

Every analyzable measure requires:

```yaml
measure_provenance:
  field: required
  source_type: required
  source_id: required
  observed_or_derived: required
  observed_at: required
  recorded_at: required
  unit: required
  method_id: required_for_derived
  method_version: required_for_derived
  device_model: required_for_device_measure
  firmware_or_algorithm: required_when_available
  quality_state: required
```

This structure is subordinate to the adopted journal `fieldProvenance` contract:

```yaml
field_provenance_binding:
  persisted_states: [EXPLICIT, DERIVED, MISSING]
  absent_metadata_read_as: LEGACY_MISSING_PROVENANCE
  direct_analysis_eligible: EXPLICIT_only
  derived_analysis_eligible:
    - derivationRuleId_is_registered
    - derivedFrom_is_complete
    - every_actual_input_is_EXPLICIT
    - no_nested_DERIVED_dependency
  analysis_excluded:
    - MISSING
    - LEGACY_MISSING_PROVENANCE
    - invalid
    - unknown_rule_DERIVED
    - incomplete_DERIVED
```

Display compatibility does not create analysis eligibility. Legacy metadata is never
silently rewritten or inferred as `EXPLICIT`. Device and method provenance supplements
this field-level contract; it does not replace it.

Longitudinal comparisons require compatible unit, method, scale, device class, and
collection protocol. A firmware or method change creates a visible boundary.

## 5. sRPE

The proposed descriptive formula is:

```text
duration_minutes = duration_seconds / 60
srpe_au = duration_minutes * session_rpe
```

It runs only when duration is finite and non-negative, both values were explicitly
observed, and the RPE scale and collection timing are known. The formula preserves the
decimal result; it does not round partial minutes before multiplication. For the named
CR-10 protocol, RPE must be finite and within 0-10 inclusive. A different scale requires
its own method ID and accepted range. Missing or out-of-range RPE is `not_computed`, not
zero. RPE is never inferred from HR.

Required sRPE provenance:

- RPE scale and prompt.
- session end and RPE recording timestamps.
- reporter.
- duration source.
- formula version.

Evidence: [session-RPE validity review](https://pubmed.ncbi.nlm.nih.gov/29163016/)
and [adolescent distance-runner timing study](https://doi.org/10.1123/ijspp.2018-0120).
The latter found collection timing changed values, so different protocols are flagged.

## 6. TRIMP And Vendor Loads

`TRIMP` is not one method. Every result requires a named family, full inputs, zone or
threshold definitions, and formula version. Banister, Edwards, Lucia, individualized
TRIMP, vendor load, and sRPE arbitrary units are not merged or directly compared.

HR-derived load is cardiovascular description only. It cannot represent all mechanical,
neuromuscular, anaerobic, strength, or psychological stress.

Evidence context: [Bourdon et al. consensus](https://doi.org/10.1123/IJSPP.2017-0208)
and [sRPE/TRIMP review](https://doi.org/10.3389/fnins.2017.00612).

## 7. Session Components And Composite Sessions

Additive physical measures may be assigned to observed components. Whole-session RPE
or TRIMP is not proportionally split across warm-up, interval, recovery, strength,
plyometric, or cooldown components.

```yaml
component_accounting:
  canonical_session_id: required
  component_id: required
  parent_session_id: required
  observed_start_end: required_for_time_allocation
  source_record_ids: required
  overlap_state: required
  aggregation_rule: leaves_or_parent_never_both
  graph_must_be_acyclic: true
  leaf_has_exactly_one_parent: true
  source_record_reuse_across_leaves: forbidden
```

Aggregation is idempotent. A composite parent and its leaf components are never counted
together. Overlapping time/source records are quarantined for review.

`neural_fatigue_resistance` is not an accepted measure. It may be a coach-facing label
only when the underlying exercises and observed measures remain visible.

## 8. Missingness

Missing is typed and never zero-filled.

```yaml
missing_reason:
  allowed:
    - not_collected
    - athlete_nonresponse
    - device_failure
    - invalidated
    - not_applicable
    - unavailable
    - unknown
```

Every summary exposes:

- observed count.
- eligible/expected count.
- coverage proportion when the denominator is defined.
- missing reasons.
- date span and method continuity.

Imputed values are separate, labelled, reproducible, and excluded from canonical
observed totals by default.

## 9. Freshness And Revision

There is no evidence-backed universal freshness cutoff for this population.

Persist event, source-update, ingestion, and derivation timestamps plus `data_as_of`.
Late or revised records invalidate dependent summaries and create a new summary version.
A future cutoff is product policy, not a scientific threshold.

## 10. Minimum Evidence

Single observations may be displayed as facts. Every aggregate exposes its sample and
coverage. No fixed number of sessions creates a stable baseline, readiness state, or
injury-risk classification.

```yaml
minimum_evidence_policy:
  descriptive_single_observation: allowed
  aggregate_requires_visible_n: true
  baseline_classification_threshold: UNKNOWN
  readiness_threshold: PROHIBITED
  injury_risk_threshold: PROHIBITED
```

## 11. Uncertainty

Known device/test error may be shown only with model- and protocol-specific validation
provenance. Correlation is not agreement. If compatible error evidence is missing,
uncertainty is `UNKNOWN`.

Do not imply precision through excessive decimals. Do not turn a cohort confidence
interval into individual clinical certainty.

Reference: [Hopkins reliability guidance](https://doi.org/10.2165/00007256-200030010-00001).

## 12. Within-Athlete Comparison

Default comparisons are within the same athlete and require compatible source, method,
modality, device, and context. Age is calculated from dated records; biological
maturity is not inferred from chronological age.

Peer ranking and adult normative thresholds are prohibited in this draft.

## 13. Privacy And Suppression

Statistics cannot consume raw memo text or `PRIVATE_SELF_ONLY` presence. Group output
requires purpose, access control, minimization, and a qualified privacy decision.

`ANALYZABLE_TRAINING_NOTE` raw text is also forbidden as a statistics input and there
is currently no accepted downstream consumer. A future structured note signal remains
ineligible until a closed registered vocabulary, complete provenance, privacy review,
runtime evidence, and separate owner adoption all exist. It may never contain raw text,
quotes, generated narrative, diagnosis, or medical inference. `PRIVATE_SELF_ONLY`
content, presence, frequency, length, and metadata remain zero-signal outside its local
save path.

No universal safe cell count is accepted. Small groups and combinations that enable
singling out are suppressed or coarsened under the later governance contract.

Reference: [HHS de-identification guidance](https://www.hhs.gov/hipaa/for-professionals/special-topics/de-identification/index.html).

## 14. ACWR And Injury Risk

ACWR may exist only as a fully specified descriptive ratio when explicitly requested.
It requires numerator/denominator windows, coupling choice, missing-day behavior, and
zero-denominator behavior.

The following are prohibited:

- safe/danger zones.
- injury probability.
- causal language.
- training adjustment recommendation.

Methodological analysis found no adequate causal basis for ACWR injury-reduction
recommendations and identified ratio artifacts and inconsistent direction:
[Impellizzeri et al.](https://pubmed.ncbi.nlm.nih.gov/32502973/). A prospective runner
cohort even found an inverse association, illustrating instability across settings:
[Dutch runners](https://pubmed.ncbi.nlm.nih.gov/34052983/).

## 15. Readiness And Fatigue

Subjective and objective observations may be displayed separately. They are not
collapsed into a single readiness scalar. No automatic `ready/not ready`, medical,
overtraining, fatigue, or recovery classification is accepted.

## 16. Formula Registry

Initial registry:

| Formula ID | Status | Authority |
|---|---|---|
| `pace_from_duration_distance_v1` | PROPOSED_DESCRIPTIVE | display only |
| `srpe_duration_cr10_v1` | PROPOSED_DESCRIPTIVE | display only; seconds / 60 x CR-10 |
| `component_time_sum_v1` | PROPOSED_DESCRIPTIVE | accounting only |
| `component_distance_sum_v1` | PROPOSED_DESCRIPTIVE | accounting only |

Every other formula is default-denied. `METRIC_ALGORITHM_CONTRACT` draft formula set
remains unaccepted.

## 17. Open Issues

| ID | Priority | Canonical blocking | Status | Resolution needed |
|---|---|---:|---|---|
| `OI-FLS-TARGET-POPULATION-001` | P1 | YES | OPEN | Qualified review before any youth threshold or reference range. |
| `OI-FLS-DEVICE-COMPATIBILITY-001` | P1 | YES | OPEN | Accept device/model validation and compatibility registry. |
| `OI-FLS-PRIVACY-SUPPRESSION-001` | P1 | YES | OPEN | Order 011 governance and qualified privacy review. |
| `OI-FLS-FORMULA-ACCEPTANCE-001` | P1 | YES | OPEN | Owner accepts bounded descriptive formulas; all others remain denied. |

## 18. Non-Claims

This draft does not establish recovery, readiness, fatigue, injury risk, optimal load,
plan authority, medical meaning, or runtime evidence.

[DRAFT_COMPLETE]
