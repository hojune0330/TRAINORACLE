# TRAINING_PLAN_FORMATION_AND_ADAPTATION_SPEC.md

```yaml
document_metadata:
  doc_id: trainoracle-spec-018-training-plan-formation-and-adaptation
  spec_id: TRAINING_PLAN_FORMATION_AND_ADAPTATION_SPEC
  title: TrainOracle Training Plan Formation And Adaptation Spec
  version: "0.2"
  round: RT1_PRODUCTIZATION_DRAFT
  status: DRAFT_FOR_REVIEW
  owner: COACH_HOJUNE
  owner_decision_ref: TO-DEC-TRAINING-METHOD-2026-07-14-001
  pilot_scope: ONE_COACH_LINKED_1500M_ATHLETE
  open_issues_total: 7
  canonical_blocking_count: 6
  contract_vectors_total: 54
  executed_tests_total: 0
  executed_tests_passed: 0
  production_execution_allowed: false
  self_check_is_runtime_evidence: false
  upload_allowed: false
  canonical_promotion_allowed: false
  final_marker_required: "[DRAFT_COMPLETE]"
```

---

## 1. Purpose

This draft defines how TrainOracle will form and adapt auditable training-plan
candidates for the first coach-linked 1500 m pilot after its open rules are accepted.
It owns the missing policy between eligible athlete data and the records already
defined by `PLAN_GENERATOR_SPEC.md`.

It converts the owner-confirmed 9.5-day method boundary into a testable contract
without claiming that 9.5 days or 72 elapsed hours is a universal biological fact.

This document owns:

- the 9.5-day local-civil formation frame
- MAIN exposure-event counting and planning semantics
- multimodal component and measure representation
- deterministic candidate arbitration and identity
- planned, completion, and experienced-response separation
- immediate safety holds, adaptation proposals, and immutable plan versions
- authority and rule registration for each executable decision
- first-pilot contract vectors

---

## 2. Non-Purpose

This document does not:

- prove that 9.5 days is universally optimal
- treat approximately three days as recovery clearance
- define medical, injury, rehabilitation, or return-to-play clearance
- redefine `RULE_SPEC_D1_D9`, Session Classifier, Template Library, Safety Gate, or Calendar ownership
- collapse classifier labels, planning roles, energy focus, and load components into one field
- create one readiness, fatigue, injury-risk, or adaptation scalar
- infer planned load or modality from raw free text
- analyze `PRIVATE_SELF_ONLY` content or metadata
- allow raw `ANALYZABLE_TRAINING_NOTE` text into formation, rationale, audit, statistics, or adaptation
- auto-select or auto-finalize a plan
- mutate accepted plan history
- implement Plan Generator or `app/`
- close an upstream or downstream issue

---

## 3. Decision Provenance And Conflict Resolution

### 3.1 Authority order

1. `TRAINING_PLAN_METHOD_DECISION.md`, decision
   `TO-DEC-TRAINING-METHOD-2026-07-14-001`
2. Accepted current safety, provenance, Plan Generator, classifier, and mapping contracts
3. Current peer-reviewed evidence with applicability limits
4. Legacy coaching documents as historical inputs only
5. Design and product copy as non-prescriptive references

### 3.2 Owner-confirmed boundary

```yaml
owner_confirmed_method_boundary:
  microcycle_model: ROLLING_LOCAL_CIVIL_9_5_DAY_TARGET
  calendar_week_role: DISPLAY_AND_PROJECTION_ONLY
  MAIN_exposure_events_per_frame: TWO_OR_THREE
  approximately_three_day_spacing: PLACEMENT_TENDENCY_NOT_READINESS_CLEARANCE
  fixed_72_hour_rule: forbidden
  intervening_multimodal_load_must_be_modeled: true
  composite_sessions_allowed: true
  candidate_count: TWO_OR_THREE
  candidate_generation: DETERMINISTIC
  coach_final_selection_required: true
```

`BALANCED`, `CONSERVATIVE`, `RECOVERY_FOCUSED`, and `COMPETITION_PREP` are a
**proposed first-pilot option taxonomy**, not an owner-confirmed method fact. The
deterministic procedure in Section 8 is ready for review but cannot execute before
owner acceptance and downstream binding.

The following legacy statements are not executable authority:

| Legacy statement | Conflict | Treatment |
|---|---|---|
| One fixed MAIN at `CYCLE_DAY.D-5` | Conflicts with 2-3 MAIN exposure events | `LEGACY_DISPLAY_EXAMPLE_ONLY` |
| MAIN interval itself is 9.5 days | Confuses frame length with exposure spacing | `RETIRED_FOR_FORMATION` |
| 72 hours always means ready | Recovery is context-dependent | `FORBIDDEN` |
| MAIN gap alone diagnoses overtraining | Ignores intervening load and response | `FORBIDDEN` |
| One aggregate load score represents the cycle | Erases distinct demand dimensions | `HOLD_INSUFFICIENT_EVIDENCE` |
| Six months of journal data is a pilot threshold | Existing text is product-sequencing rationale | `NON_EXECUTABLE_UNLESS_REACCEPTED` |

---

## 4. Decision Authority And Registration

Every formation or adaptation rule declares exactly one authority class.

```yaml
decision_authority_classes:
  AUTOMATED_INVARIANT:
    meaning: deterministic boundary already accepted by an owning contract
    may_create_automatic_change: only_within_declared_non_prescriptive_boundary
  COACH_DECISION_SUPPORT:
    meaning: deterministic proposal with visible inputs, uncertainty, and reason codes
    coach_selection_required: true
  HOLD_INSUFFICIENT_EVIDENCE:
    meaning: structure may be recorded but cannot influence a candidate
    executable: false

rule_registration_required_fields:
  - ruleId
  - authorityClass
  - owner
  - ruleVersion
  - applicability
  - requiredInputs
  - missingInputBehavior
  - output
  - reasonCodeRefs
  - evidenceSourceRefs
  - counterexampleOrFailureState
  - contractTestIds
```

An unregistered rule or one missing applicability, failure behavior, or a test ID
cannot execute. Section 11 is the registry for this draft. Its rules remain
non-production while this document is `DRAFT_FOR_REVIEW`.

---

## 5. Formation Eligibility And Privacy

Formation starts only after Plan Generator authorization and Safety Gate allow the
same scoped generation run.

```yaml
formation_eligibility:
  required_pilot_identity:
    event: 1500M
    athlete_count_per_run: 1
    coach_link_required: true
  required_authorization:
    authorizationDecisionOperation: GENERATE_PLAN_OPTIONS
    authorizationDecision: ALLOW
    authorizationDecisionRef: FormationAuthorizationDecisionId
  required_safety_state:
    safetyBlockRefId: SafetyBlockRefId
    planGenerationAllowed: true
    D9_ACTIVE_allowed: false
    D9_UNKNOWN_allowed: false
  required_context:
    - athlete_timezone
    - frame_start_local
    - coach_intent
    - microcycle_anchor
    - previous_MAIN_exposure_identity_date_and_class_when_available
    - intervening_completed_session_refs_when_available
    - immutable_eligible_formation_source_refs
  provenance:
    direct_values: EXPLICIT_only
    derived_values: all_inputs_EXPLICIT_and_derivation_metadata_complete
    legacy_invalid_or_ineligible_values_may_support_plan: false
  raw_note_input_allowed: false
```

No history-length or freshness threshold is invented here. Until those thresholds
are accepted, missing required prior-MAIN or intervening-load context returns
`NEEDS_COACH_CLARIFICATION`; it does not fall back to a population default.

### 5.1 Closed source contract

```yaml
FormationSourceRefId: string
FormationEligibilityDecisionId: string
FormationAuthorizationDecisionId: string

FormationAuthorizationDecisionRecord:
  authorizationDecisionId: string
  operation: GENERATE_PLAN_OPTIONS | SELECT_PLAN_OPTION | CREATE_ADAPTATION | ACCEPT_ADAPTATION | RELEASE_EXECUTION_HOLD
  tenantId: string
  groupId: string
  athleteId: string
  actorUserId: string_or_SYSTEM_CONTRACT
  requiredCapability: operation_specific_registered_capability
  capabilityGrants:
    - grantId: string
      tenantId: string
      groupId: string
      athleteId: string
      granteeUserId: string
      capability: registered_capability
      status: ACTIVE | REVOKED | EXPIRED
      expiresAt: ISO_DATETIME_or_null
  consentGrants:
    - consentGrantId: string
      tenantId: string
      groupId: string
      athleteId: string
      purpose: PLAN_FORMATION | PLAN_SELECTION | PLAN_ADAPTATION | SAFETY_HOLD_RELEASE
      status: ACTIVE | REVOKED | EXPIRED
      expiresAt: ISO_DATETIME_or_null
  guardianConsentDecision: NOT_REQUIRED | SATISFIED | DENIED | EXPIRED
  guardianConsentGrantId: string_or_null
  guardianConsentExpiresAt: ISO_DATETIME_or_null
  decision: ALLOW | DENY
  checkedAt: ISO_DATETIME
  auditLogId: string
  immutableRecordHash: CanonicalContentHash

FormationEligibilityDecisionRecord:
  eligibilityDecisionId: string
  sourceRefId: FormationSourceRefId_or_SafetyBlockRefId
  tenantId: string
  groupId: string
  athleteId: string
  directInputRefIds: string[]
  privacyOrigin: NO_NOTE_OR_MEMO | ANALYZABLE_NOTE_SAFETY_ONLY
  provenanceState: EXPLICIT | ELIGIBLE_DERIVED | SYSTEM_CONTRACT_RESULT
  derivationRuleId: string_or_null
  derivationRuleVersion: string_or_null
  permittedUseDecision: ALLOW_FORMATION_INPUT | ALLOW_CONTEXT_ONLY | ALLOW_SAFETY_BLOCK_ONLY | REJECT
  decisionPolicyVersion: string
  decision: ALLOW | REJECT
  decidedAt: ISO_DATETIME
  immutableRecordHash: CanonicalContentHash

FormationSourceRef:
  sourceRefId: string
  sourceKind:
    - ATHLETE_PROFILE_SNAPSHOT
    - ELIGIBLE_STRUCTURED_DAILY_LOG_FIELD
    - CLASSIFIED_SESSION_RECORD
    - PHYSIO_SOURCE_TRUST_RESULT
    - COACH_INTENT
    - COMPETITION_ANCHOR
    - ATHLETE_AVAILABILITY_CONSTRAINT
    - ELIGIBLE_SESSION_TEMPLATE
    - PLANNED_SESSION_DRAFT
    - ELIGIBLE_COMPLETED_SESSION_RECORD
    - LONGITUDINAL_LOAD_CONTEXT
  sourceId: string
  sourceVersion: string
  tenantId: string
  groupId: string
  athleteId: string
  observedAt: ISO_DATETIME
  provenanceState: EXPLICIT | ELIGIBLE_DERIVED | SYSTEM_CONTRACT_RESULT
  eligibilityDecisionRef: FormationEligibilityDecisionId
  permittedUse: FORMATION_INPUT | CONTEXT_ONLY
  privacyClass: NON_SENSITIVE_STRUCTURED | CONSENTED_SENSITIVE_STRUCTURED
  containsRawText: false
  containsRawTextHashEmbeddingOrQuote: false
  containsPrivateMemoPresenceLengthOrMetadata: false
  derivedFromPrivateSelfOnly: false
  derivedFromRawAnalyzableNote: false

SafetyBlockRefId: string

SafetyBlockRef:
  safetyBlockRefId: string
  safetyGateResultId: string
  safetyGateVersion: string
  tenantId: string
  groupId: string
  athleteId: string
  gateState: GENERATION_ALLOWED | BLOCKED | D9_UNKNOWN | STALE
  evaluatedAt: ISO_DATETIME
  eligibilityDecisionRef: FormationEligibilityDecisionId
  privacyOrigin: NO_NOTE_OR_MEMO | ANALYZABLE_NOTE_SAFETY_ONLY
  permittedUse: SAFETY_BLOCK_ONLY
  containsPrivateSelfOnlySignal: false
  containsRawTextHashEmbeddingQuoteOrSummary: false
  containsReconstructableReasonDetail: false
  candidateFormationRankingOrExplanationAllowed: false

FormationReasonCodeRef:
  reasonCode: registered_non_sensitive_code
  registryVersion: string
  sourceRefIds: FormationSourceRefId[]
  mayEncodeOrRevealRawText: false
  mayRevealPrivateMemoPresence: false
  mayBeReconstructedIntoAthleteNarrative: false
```

Authorization invariants:

- Operation/capability mapping is exact:
  `GENERATE_PLAN_OPTIONS -> GENERATE_PLAN_OPTIONS`,
  `SELECT_PLAN_OPTION -> SELECT_PLAN_OPTION`,
  `CREATE_ADAPTATION -> CREATE_ADAPTATION`,
  `ACCEPT_ADAPTATION -> ACCEPT_ADAPTATION`, and
  `RELEASE_EXECUTION_HOLD -> RELEASE_EXECUTION_HOLD`.
- Every capability and consent grant must match tenant, group, athlete, operation
  purpose, actor, active status, and `checkedAt`; null expiry is allowed, expired is
  denied.
- Guardian satisfaction is required when the athlete contract requires it.
- An authorization decision is immutable, auditable, operation-specific, and cannot
  be reused for another operation or later recheck.
- The proposed capability names beyond current Plan Generator generation authority
  require registry adoption under `OI-FA-PLAN-VERSION-BINDING-001`.

```yaml
formation_source_invariants:
  unknown_source_kind: reject
  missing_scope_or_eligibility_decision: reject
  tenant_group_athlete_mismatch: reject
  missing_direct_input_lineage: reject
  missing_or_mutable_eligibility_record: reject
  forged_summary_flags_without_verified_lineage: reject
  cyclic_lineage: reject
  lineage_traversal: all_ancestors_required_until_EXPLICIT_roots
  any_PRIVATE_SELF_ONLY_ancestor: reject
  incoming_PRIVATE_SELF_ONLY_attempt: reject_without_persistent_formation_or_safety_record
  any_raw_ANALYZABLE_TRAINING_NOTE_ancestor_in_FormationSourceRef: reject
  analyzable_note_structured_derivative_before_separate_plan_adoption: reject
  private_memo_id_hash_presence_length_or_processing_metadata: reject
  raw_text_quote_summary_token_or_embedding: reject
  favorable_inference_from_source_absence: forbidden
  external_LLM_payload: forbidden
  audit_may_store_source_ref_id_but_not_source_payload: true
  reason_code_must_be_registered_non_sensitive_and_non_reconstructable: true
  analyzable_note_ancestry_exception: SafetyBlockRef_with_ALLOW_SAFETY_BLOCK_ONLY_only
  analyzable_note_SafetyBlockRef_may_return_GENERATION_ALLOWED: false
  PRIVATE_SELF_ONLY_SafetyBlockRef: forbidden
```

Every eligibility decision follows an immutable, scope-bound, acyclic graph of direct
inputs to explicit roots. Cached flags are assertions only; traversal and immutable
decision records are the authority. Missing, cyclic, cross-scope, or unverifiable
lineage fails closed.

`SafetyBlockRef` is deliberately not a `FormationSourceRef`. It may stop an operation,
but cannot form, rank, hash, or explain a candidate. Sanitized analyzable-note D9
ancestry is allowed only for `BLOCKED`, `D9_UNKNOWN`, or `STALE`; it can never produce
`GENERATION_ALLOWED`. `PRIVATE_SELF_ONLY` remains absolute zero-signal, including for
safety refs. A future plan-eligible note derivative requires a separate owner
decision, schema, consent purpose, retention rule, test package, and Plan Generator
adoption.

---

## 6. 9.5-Day Formation Frame Contract

The frame is defined in athlete-local civil time. UTC elapsed duration is not the
source of truth because a daylight-saving transition can change elapsed hours.

```yaml
MicrocycleFormationFrame:
  frameId: string
  tenantId: string
  groupId: string
  athleteId: string
  athleteEvent: 1500M
  timezone: IANA_TIMEZONE
  timezoneDatabaseVersion: string
  frameModel: LOCAL_CIVIL_9_DAYS_12_HOURS
  frameStartBoundary: LocalCivilBoundaryResolution
  frameEndExclusiveBoundary: LocalCivilBoundaryResolution
  endBoundary: EXCLUSIVE
  previousFrameId: string_or_null
  relationToPrevious: INITIAL | CONTIGUOUS_SUCCESSOR | REANCHOR_REPLACEMENT
  lineageEventId: string_or_null
  anchorRef: FormationSourceRefId
  reanchorDecisionRef: string_or_null
  raceAnchorRefs: FormationSourceRefId[]
  coachIntentRef: FormationSourceRefId
  immutableInputRefs: FormationSourceRefId[]
  formationRuleSetVersion: string
  sourceRefs: FormationSourceRef[]
  uncertaintyCodes: string[]

LocalCivilBoundaryResolution:
  requestedLocalDateTime: ISO_LOCAL_DATETIME
  resolvedLocalDateTime: ISO_LOCAL_DATETIME
  resolvedInstantUtc: ISO_DATETIME
  utcOffsetSeconds: integer
  fold: NOT_AMBIGUOUS | EARLIER_OFFSET | LATER_OFFSET
  resolution: EXACT | EXPLICIT_FOLD_SELECTION | EXPLICIT_GAP_ADJUSTMENT
  boundaryDecisionRef: string_or_null

MicrocycleFrameLineageEvent:
  lineageEventId: string
  tenantId: string
  groupId: string
  athleteId: string
  predecessorFrameId: string
  successorFrameId: string
  relation: CONTIGUOUS_SUCCESSOR | REANCHOR_REPLACEMENT
  effectiveFromLocal: ISO_LOCAL_DATETIME
  boundaryDisposition: NO_GAP_NO_OVERLAP | EXPLICIT_GAP | EXPLICIT_OVERLAP
  reanchorDecisionRef: string_or_null
  createdAt: ISO_DATETIME
  auditLogId: string
```

Frame invariants:

- `frameEndExclusiveBoundary.requestedLocalDateTime` equals
  `frameStartBoundary.requestedLocalDateTime + 9 calendar days + 12 hours` in the
  athlete timezone.
- Both resolved boundary instants are derived with the persisted timezone
  database version. UTC elapsed time may differ across DST and must not be forced to
  exactly 228 hours.
- A nonexistent or ambiguous start **or end** boundary is rejected until an explicit
  fold or gap-adjustment decision is persisted; the system cannot guess.
- A `CONTIGUOUS_SUCCESSOR` starts at the predecessor's resolved end-exclusive
  boundary and requires `NO_GAP_NO_OVERLAP`.
- A `REANCHOR_REPLACEMENT` requires an append-only lineage event, explicit effective
  boundary, re-anchor decision, and gap/overlap disposition. The predecessor remains
  historical; the successor governs planning at and after `effectiveFromLocal`.
- No gap or overlap is inferred. `EXPLICIT_GAP` or `EXPLICIT_OVERLAP` requires the
  owner decision ref and never changes prior frame facts.
- `INITIAL` requires null `previousFrameId` and `lineageEventId`. Both successor
  relations require non-null values whose lineage event names the same predecessor,
  successor, scope, and relation.
- No Monday start, calendar-week reset, frame overlap, or fixed `CYCLE_DAY.D-5` is
  assumed.
- Fixed competition and immovable constraints are placed before flexible blocks.
- The frame contains exactly 2 or 3 MAIN exposure events when formation succeeds.
- Multiple components on one session event cannot be counted as several MAIN events.
- Approximately three days is a proposal tendency, never readiness clearance.

Seven-day projection identity is a **target invariant**, not a current fact.
`MICROCYCLE_AND_CALENDAR_MAPPING_SPEC.CalendarSessionProjection` currently lacks
`frameId` and `blockId`, so the binding status is
`BLOCKED_PENDING_MAPPING_SCHEMA_PATCH`.

---

## 7. Planning Role, Exposure Class, Components, And Measures

### 7.1 Planning semantics versus classifier semantics

Planning and post-session classification are separate namespaces:

```yaml
planning_namespace:
  plannedSessionRole: MAIN | SUPPORT | RECOVERY | REST
  proposedMainExposureClassRegistry_pending_owner_acceptance:
    - AEROBIC_PRIORITY
    - THRESHOLD
    - VO2
    - GLYCOLYTIC
    - SPEED_POWER
    - STRENGTH_POWER
    - RACE
    - MIXED_REGISTERED
    - OTHER_COACH_REGISTERED

classifier_namespace:
  sessionLabel:
    - MAIN
    - SUB
    - RECOVERY
    - LD
    - REST
    - CROSS_TRAINING
    - COMPETITION
    - TEST
```

`plannedSessionRole` is pre-session plan structure and is not a Session Classifier
output. A completed `sessionLabel: COMPETITION` remains `COMPETITION`; it is not
rewritten to `MAIN`. For exposure accounting only, one accepted classifier
`COMPETITION` record counts as one MAIN exposure event and receives exposure class
`RACE`. An accepted classifier `MAIN` record counts as one MAIN exposure event with
its separately preserved source-defined or coach-registered exposure class. No
classifier label alone may invent or collapse threshold, VO2, glycolytic,
speed-power, strength-power, or race identity.

### 7.2 Session and component contract

```yaml
TrainingBlockDraft:
  blockId: string
  frameId: string
  planOptionId: string
  blockOrder: integer
  blockIntent: PRIORITY_STIMULUS | SUPPORT | RECOVERY | TRANSITION
  plannedSessionDraftIds: string[]
  sourceConstraintRefs: FormationSourceRefId[]
  rationaleCodeRefs: FormationReasonCodeRef[]
  uncertaintyCodes: string[]

FormationSessionExtension:
  plannedSessionDraftId: string
  canonicalSessionFingerprint: CanonicalContentHash
  plannedSessionRole: MAIN | SUPPORT | RECOVERY | REST
  mainExposureClass: registered_MAIN_exposure_class_or_null
  competition: boolean
  plannedDemandBand: RECOVERY | LIGHT | MODERATE | HIGH
  plannedEnergyFocus: PlanGenerator.PlannedEnergyFocusIntent
  plannedIntensityLabel: PlanGenerator.PlannedIntensityLabel
  components: PlannedLoadComponent[]
  loadVector: PlannedLoadVector
  measureRefs: PlannedMeasureRef[]
  coachDeclared: boolean
  ruleAssisted: boolean
  uncertaintyCodes: string[]

PlannedLoadComponent:
  componentId: string
  activityModality: RUNNING | PLYOMETRIC | STRENGTH | ALTERNATIVE_AEROBIC | MOBILITY | RECOVERY_WORK
  terrainModifier: FLAT | HILL | MIXED | NOT_APPLICABLE
  trainingIntent: BASE | THRESHOLD | VO2 | GLYCOLYTIC | SPEED_POWER | NEURAL_FATIGUE_RESISTANCE | GENERAL_STRENGTH | RECOVERY | OTHER_REGISTERED
  componentIntensityIntent: VERY_EASY | EASY | MODERATE | MODERATELY_HIGH | HIGH | VERY_HIGH | MAX | NOT_APPLICABLE
  measureRefs: PlannedMeasureRef[]
  sourceRefIds: FormationSourceRefId[]
  assignmentRuleRefs: string[]
  uncertaintyCodes: string[]
```

Cross-field invariants for the pilot:

- `competition: true` requires Plan Generator `plannedKind: COMPETITION`,
  `plannedSessionRole: MAIN`, `mainExposureClass: RACE`, and
  `plannedDemandBand: HIGH`.
- `REST` requires `plannedDemandBand: RECOVERY`, no competition, and no load-bearing
  component.
- `RECOVERY` permits only `RECOVERY` or `LIGHT` demand and cannot be competition.
- `MAIN` cannot use `plannedDemandBand: RECOVERY`.
- `SUPPORT` cannot be competition.
- A composite session remains one session and one exposure event even when it has
  several components.

Component intensity does not replace Plan Generator's whole-session
`plannedIntensityLabel`. The whole-session label remains coach-declared. There is no
automatic component-to-whole-session mapping until a registered mapping is accepted;
a later accepted mapping conflict returns `REVIEW_REQUIRED` and never silently
rewrites coach intent.

### 7.3 Planned load vector

```yaml
PlannedLoadVector:
  metabolicIntensity: NONE | LOW | MODERATE | HIGH | UNKNOWN
  mechanicalImpact: NONE | LOW | MODERATE | HIGH | UNKNOWN
  neuromuscularDemand: NONE | LOW | MODERATE | HIGH | UNKNOWN
  strengthPowerDemand: NONE | LOW | MODERATE | HIGH | UNKNOWN
  durationVolumeDemand: NONE | LOW | MODERATE | HIGH | UNKNOWN
  competitionStress: NONE | LOW | MODERATE | HIGH | UNKNOWN
  componentRefs: string[]
  assignmentAuthority: COACH_DECLARED | REGISTERED_RULE_ASSISTED
  assignmentRuleRefs: string[]
  uncertaintyCodes: string[]
```

`plannedDemandBand` is a visible overview band, not measured fatigue, readiness, or
injury probability. Automatic vector aggregation is held.

### 7.4 Measure scope and double-count prevention

```yaml
PlannedMeasureRef:
  measureId: string
  measureKind: DURATION | DISTANCE | REPETITIONS | PACE | LOAD_MASS | CONTACTS | ELEVATION | INTERVAL_STRUCTURE | OTHER_REGISTERED
  measureScope: WHOLE_SESSION | COMPONENT
  componentId: string_or_null
  parentMeasureId: string_or_null
  aggregationKey: string
  dedupeKey: string
  additiveSemantics: ADDITIVE | NON_ADDITIVE | ALLOCATED_FROM_PARENT
  allocationFraction: number_0_to_1_or_null
  canonicalValue: number_or_structured_interval
  canonicalUnit: registered_unit
  displayValue: number_or_string
  displayUnit: registered_unit
  provenance: EXPLICIT | DERIVED
  derivationMetadata: object_or_null
  sourceRefId: FormationSourceRefId
```

- A component copy with `parentMeasureId` cannot be added to its parent again.
- Duplicate `dedupeKey` values within an aggregation are rejected.
- `ALLOCATED_FROM_PARENT` requires explicit fractions. Fractions must sum to at most
  1, or exactly 1 when marked as a full allocation.
- Unknown allocation means no aggregation. It cannot influence a candidate.
- Until component allocation policy is accepted, aggregate/statistical candidate
  influence is forbidden.

### 7.5 Longitudinal context is held

```yaml
LongitudinalLoadContext:
  contextId: string
  tenantId: string
  groupId: string
  athleteId: string
  authorizationDecisionRef: FormationAuthorizationDecisionId
  audiencePolicyRef: string
  privacyPolicyRef: string
  redactionPolicyRef: string
  retentionPolicyRef: string
  samplePolicyRef: string_or_null
  suppressionState: SUPPRESSED_PENDING_POLICY | ELIGIBLE_AFTER_FUTURE_ACCEPTANCE
  modality: registered_modality
  measureKind: registered_measure_kind
  windowStart: ISO_DATE
  windowEnd: ISO_DATE
  eligibleSampleCount: integer_or_null
  missingOrExcludedCount: integer_or_null
  descriptiveStatistics:
    median: null
    interquartileRange: null
    percentilePosition: null
  methodVersion: string
  sourceRefIds: FormationSourceRefId[]
  uncertaintyCodes: string[]
  mayInfluenceCandidate: false
  mayAppearInRationale: false
  mayClearSafetyState: false
  mayCreateInjuryPrediction: false
```

Until sample, freshness, missingness, privacy, redaction, and retention policies are
accepted, statistics remain null and suppressed. Raw samples, source lists, or
descriptive statistics cannot rank candidates or appear in rationale. `sourceRefIds`
remain restricted to the scoped provenance store and are never a coach/user-facing
list.

---

## 8. Deterministic Candidate Formation Policy

### 8.1 Authority split

The **count invariant** is automated: a successful candidate has exactly 2 or 3 MAIN
exposure events. Exact phase, class sequence, and placement are coach-decision
support and remain blocked until the coach rule set in `OI-FA-COACH-RULESET-001` is
accepted.

```yaml
candidate_formation_flow:
  1_validate_scope_consent_provenance_and_safety: AUTOMATED_INVARIANT
  2_create_immutable_local_civil_frame: AUTOMATED_INVARIANT
  3_place_fixed_competition_and_immovable_constraints: AUTOMATED_INVARIANT
  4_build_canonical_base_from_accepted_coach_rules: COACH_DECISION_SUPPORT
  5_validate_exactly_two_or_three_MAIN_exposure_events: AUTOMATED_INVARIANT
  6_preserve_components_measures_and_uncertainty: AUTOMATED_INVARIANT
  7_generate_and_arbitrate_distinct_candidates: AUTOMATED_INVARIANT
  8_require_atomic_authorization_safety_recheck_and_coach_selection: AUTOMATED_INVARIANT
  9_request_RULE_SPEC_validation_after_selection: AUTOMATED_INVARIANT
```

The placement rule may use approximately three local civil days as an initial
tendency. It must consider exposure class, fixed competition, all intervening load
dimensions, athlete response, missingness, and coach intent. Elapsed time alone
cannot return readiness or clearance.

### 8.2 Proposed option taxonomy and exact arbitration

This proposed policy is deterministic for identical canonical inputs and rule-set
versions:

1. Emit candidate 1 `BALANCED` from the canonical coach-rule base.
2. Emit candidate 2 `CONSERVATIVE` by applying the first feasible transformation in
   this priority order:
   `APPLY_FIRST_REGISTERED_SUPPORT_REDUCTION`,
   `MOVE_ONE_FLEXIBLE_MAIN_TO_MAXIMIZE_MINIMUM_CIVIL_GAP`,
   `APPLY_FIRST_REGISTERED_SUPPORT_TO_RECOVERY_REPLACEMENT`.
3. A registered load transform must specify immutable before/after component and
   measure structures, applicability, whole-session label reconciliation, and tests.
   Changing only `plannedDemandBand`, label, or rationale is invalid. These transforms
   cannot execute before `OI-FA-LOAD-COMPONENT-001` is accepted.
4. For support selection, sort by demand `HIGH > MODERATE > LIGHT > RECOVERY`, then
   local start ascending, session-slot order `AM < PM < DOUBLE < FLEX`, then stable
   canonical session fingerprint. Select the first eligible record.
5. For a MAIN move, enumerate valid local half-day slots that preserve fixed anchors,
   exposure count, class constraints, and frame bounds. Maximize the minimum local
   civil duration to adjacent MAIN events; break ties by earliest local slot and then
   canonical session fingerprint. This operation proposes spacing; it does not clear
   readiness.
6. Build contextual candidates in fixed priority order `COMPETITION_PREP`, then
   `RECOVERY_FOCUSED`, and emit the first feasible, meaningfully distinct result as
   candidate 3. Emit at most one contextual candidate.
7. `COMPETITION_PREP` is eligible only with an accepted race anchor and an accepted
   registered competition-prep transform. That transform must alter at least one
   flexible pre-race component, measure, or local slot relative to both prior options;
   preserving the race anchor alone is not a difference.
8. `RECOVERY_FOCUSED` is eligible only when an owner-accepted registered recovery
   trigger and transform apply. When race and recovery both apply, attempt the
   competition candidate first; if it is infeasible or duplicate, attempt recovery.
   Recovery constraints apply to every feasible option; no fourth option is emitted.
9. Without a feasible contextual result, emit exactly two candidates.
10. Discard infeasible or duplicate candidates. If fewer than two remain, return
   `NEEDS_COACH_CLARIFICATION` and emit no selectable set.

The competition and recovery registries are part of
`OI-FA-COACH-RULESET-001`. Neither option claims medical recovery.

```yaml
candidate_identity:
  canonicalInputOrdering: sourceRefId_ascending_after_scope_validation
  canonicalSessionOrdering: localStart_then_slotOrder_then_canonicalSessionFingerprint
  fixedOptionOrder: BALANCED_CONSERVATIVE_CONTEXTUAL
  hashAlgorithm: SHA_256
  canonicalSerialization: RFC_8785_JSON_CANONICALIZATION_SCHEME
  candidateFingerprint: hash(formationRuleSetVersion, optionType, canonicalConstraintAndSessionDocument)
  planOptionId: hash(planGenerationRunId, candidateFingerprint)
  repeatability: candidateFingerprint_and_normalized_content_stable_across_runs; planOptionId_stable_within_one_run
  private_content_in_hash: forbidden
  unstable_display_text_in_hash: forbidden

meaningfully_distinct:
  normalized_session_fields:
    - local_date_time
    - plannedSessionRole
    - mainExposureClass
    - plannedDemandBand
    - plannedKind
    - plannedEnergyFocus
    - plannedIntensityLabel
    - component_structure
    - measure_structure
    - fixed_and_flexible_constraints
  label_or_rationale_only_difference: false
  requirement: at_least_one_normalized_session_field_differs
```

Every option has a `CandidateDifferenceSet` relative to `BALANCED`.

```yaml
CandidateDifferenceSet:
  baselineOptionId: string_or_null
  changedBlockIds: string[]
  changedFields: string[]
  reasonCodeRefs: FormationReasonCodeRef[]
  expectedTradeoffCodes: string[]
  unchangedSafetyConstraints: string[]
  sourceRefIds: FormationSourceRefId[]
  uncertaintyCodes: string[]
```

Auto-selection, label-only differences, hidden constraints, and favorable claims
without accepted evidence are forbidden.

---

## 9. Planned, Completion, And Experienced Response

Plan, completion state, and athlete response are distinct facts.

```yaml
PlannedSessionOutcomePair:
  plannedSessionDraftId: string
  completedSessionRef: FormationSourceRefId_or_null
  plannedDemandBand: RECOVERY | LIGHT | MODERATE | HIGH
  plannedLoadVectorRef: string
  completionState: COMPLETED | PARTIAL | CHANGED | MISSED | NOT_YET_DUE
  experiencedLoad:
    sessionRpe: number_or_null
    durationMin: number_or_null
    respiratoryRpe: number_or_null
    localMuscularRpe: number_or_null
    rpeScaleRef: string_or_null
    provenanceRefs: FormationSourceRefId[]
    capturedAt: ISO_DATETIME_or_null
  readinessRefs: FormationSourceRefId[]
  safetyBlockRefs: SafetyBlockRefId[]
  comparisonState: NOT_COMPARABLE | MISSING
  comparisonRuleVersion: null
  uncertaintyCodes: string[]
```

`rpeScaleRef` is required when any RPE value is present. Until comparison thresholds
are accepted, eligible facts may be displayed side by side but the system returns
`NOT_COMPARABLE`; it cannot automatically select an adaptation action. Session-RPE
is one internal-load dimension and cannot erase external load, mechanical impact,
neuromuscular demand, pain, or missingness.

---

## 10. Safety Hold, Plan Versions, And Adaptation

### 10.1 Immediate execution hold

A safety or authorization stop is not an ordinary coach-selectable adaptation.

```yaml
CanonicalContentHash:
  algorithm: SHA_256
  canonicalization: RFC_8785_JSON_CANONICALIZATION_SCHEME
  schemaVersion: string
  digestHex: lowercase_64_hex
  excludesDisplayTextAndPrivateContent: true

IdempotencyEnvelope:
  tenantId: string
  groupId: string
  athleteId: string
  operation: registered_operation
  idempotencyKey: string
  requestHash: CanonicalContentHash

PlanExecutionHoldActivation:
  holdActivationId: string
  targetKind: PLAN_GENERATION_RUN | PLAN_VERSION
  planGenerationRunId: string
  planVersionId: string_or_null
  tenantId: string
  groupId: string
  athleteId: string
  trigger: D9_ACTIVE | D9_UNKNOWN | SAFETY_GATE_BLOCKED | SAFETY_GATE_STALE | AUTHORIZATION_REVOKED | SCOPE_MISMATCH
  safetyBlockRefId: SafetyBlockRefId_or_null
  authorizationDecisionRef: FormationAuthorizationDecisionId_or_null
  expectedTargetStateHash: CanonicalContentHash
  createdAt: ISO_DATETIME
  createdBy: SYSTEM_CONTRACT
  auditLogId: string
  idempotency: IdempotencyEnvelope
  coachOverrideAllowed: false

PlanExecutionHoldReleaseEvent:
  holdReleaseEventId: string
  holdActivationId: string
  targetKind: PLAN_GENERATION_RUN | PLAN_VERSION
  planGenerationRunId: string
  planVersionId: string_or_null
  tenantId: string
  groupId: string
  athleteId: string
  freshSafetyBlockRefId: SafetyBlockRefId
  releaseAuthorizationDecisionRef: FormationAuthorizationDecisionId
  releasedByUserId: string_or_SYSTEM_CONTRACT
  expectedActiveHoldActivationId: string
  expectedTargetStateHash: CanonicalContentHash
  releasedAt: ISO_DATETIME
  auditLogId: string
  idempotency: IdempotencyEnvelope
```

After option generation or selection, any `D9_ACTIVE`, `D9_UNKNOWN`, stale/blocked
Safety Gate, revoked consent/capability, or scope mismatch immediately and atomically:

1. appends `PlanExecutionHoldActivation` against the generation run when no accepted
   version exists, or against the accepted plan version after selection;
2. invalidates open option sets and adaptation proposals;
3. exposes only the owning contract's non-sensitive blocked output;
4. prevents execution and coach override; and
5. permits release or a later replan only through an append-only release event with
   a fresh scoped `GENERATION_ALLOWED` Safety Block ref and
   `RELEASE_EXECUTION_HOLD` authorization decision.

Authorization, scope, consent, and safety are atomically rechecked immediately before
coach candidate selection and adaptation acceptance.

Hold activation and release never mutate an accepted plan or the activation record.
Current execution state is derived from append-only activation/release events. A
release requires CAS against the active hold and target state, plus an idempotency
envelope. On an activation race or CAS conflict, the operation re-reads and fails
closed; it can never lose an active hold.

For `targetKind: PLAN_GENERATION_RUN`, `planVersionId` must be null. For
`targetKind: PLAN_VERSION`, it must be non-null and belong to the same generation run
and scope. Exactly one of `safetyBlockRefId` and `authorizationDecisionRef` identifies
the activation cause. Release requires both a fresh same-scope
`GENERATION_ALLOWED` safety ref with no note ancestry and an ALLOW authorization
decision for `RELEASE_EXECUTION_HOLD`.

### 10.2 Immutable plan version and adaptation records

```yaml
PlanVersionRecord:
  planVersionId: string
  predecessorPlanVersionId: string_or_null
  planGenerationRunId: string
  originKind: INITIAL_OPTION_SELECTION | ADAPTATION_ACCEPTANCE
  selectedOptionId: string_or_null
  adaptationProposalId: string_or_null
  tenantId: string
  groupId: string
  athleteId: string
  versionNumber: integer
  immutableFrameRef: string
  immutableBlockRefs: string[]
  immutableSessionRefs: string[]
  contentHash: CanonicalContentHash
  initialLifecycle: ACCEPTED
  createdAt: ISO_DATETIME
  createdByUserId: string
  acceptedAt: ISO_DATETIME
  acceptedByUserId: string
  auditLogId: string

PlanAdaptationProposal:
  adaptationProposalId: string
  tenantId: string
  groupId: string
  athleteId: string
  basePlanVersionId: string
  baseContentHash: CanonicalContentHash
  proposedPlanVersionId: string
  proposedContentHash: CanonicalContentHash
  initialStatus: DRAFT | WAITING_FOR_COACH
  evaluationTriggerRefs: FormationSourceRefId[]
  creationAuthorizationDecisionRef: FormationAuthorizationDecisionId
  safetyBlockRefId: SafetyBlockRefId
  proposedActions: AdaptationAction[]
  reasonCodeRefs: FormationReasonCodeRef[]
  sourceRefIds: FormationSourceRefId[]
  uncertaintyCodes: string[]
  requiresCoachSelection: true
  createdAt: ISO_DATETIME
  createdByUserId: string
  auditLogId: string
  idempotency: IdempotencyEnvelope

AdaptationAction:
  action: KEEP | SHIFT_FLEXIBLE_SESSION | REDUCE_SUPPORTING_DEMAND | REPLACE_WITH_RECOVERY_OR_REST | REBUILD_REMAINDER | BLOCK_AND_REVIEW
  targetBlockOrSessionIds: string[]
  beforeRefs: string[]
  proposedAfterRefs: string[]
  constraintRefs: FormationSourceRefId[]
  reasonCodeRefs: FormationReasonCodeRef[]

PlanAdaptationDecisionRecord:
  adaptationDecisionId: string
  adaptationProposalId: string
  tenantId: string
  groupId: string
  athleteId: string
  decision: ACCEPT | REJECT
  decidedByUserId: string
  decidedAt: ISO_DATETIME
  acceptanceAuthorizationDecisionRef: FormationAuthorizationDecisionId
  freshSafetyBlockRefId: SafetyBlockRefId
  compareAndSwapBaseContentHash: CanonicalContentHash
  acceptedProposedContentHash: CanonicalContentHash
  auditLogId: string
  idempotency: IdempotencyEnvelope

PlanAdaptationLifecycleEvent:
  lifecycleEventId: string
  adaptationProposalId: string
  tenantId: string
  groupId: string
  athleteId: string
  eventType: INVALIDATED_BY_SAFETY_OR_AUTH | SUPERSEDED
  safetyBlockRefId: SafetyBlockRefId_or_null
  authorizationDecisionRef: FormationAuthorizationDecisionId_or_null
  createdAt: ISO_DATETIME
  auditLogId: string
  idempotency: IdempotencyEnvelope
```

Version invariants:

- All records and referenced sources must share tenant, group, and athlete scope.
- Accepted plan versions and decisions are append-only.
- Current plan-version lifecycle (`ACCEPTED | SUPERSEDED`) is derived from accepted
  successor records; the predecessor record is never updated in place.
- Plan content and `PlanVersionRecord` never mutate. Current execution state is a
  projection of append-only hold activation/release records.
- Proposal status (`DRAFT | WAITING_FOR_COACH | ACCEPTED | REJECTED | SUPERSEDED |
  INVALIDATED_BY_SAFETY_OR_AUTH`) is a projection of append-only creation,
  lifecycle, and decision records; status changes never overwrite source facts.
- One accepted successor is allowed per base version.
- `INITIAL_OPTION_SELECTION` requires `selectedOptionId` and forbids
  `adaptationProposalId`; `ADAPTATION_ACCEPTANCE` requires the inverse and binds the
  exact reviewed `proposedContentHash` plus immutable frame/block/session refs.
- Every hash uses the declared algorithm, canonicalization, and schema version.
- An idempotency lookup is scoped by tenant, group, athlete, operation, and key. The
  same key with the same request hash returns the original result; the same key with
  a different request hash is rejected.
- Consent, capability, guardian consent, scope, and Safety Gate are checked at both
  proposal creation and acceptance.
- Proposal and acceptance actors must hold the stated purpose-specific capability in
  the same group as the athlete. These proposed capability names require downstream
  registry adoption under `OI-FA-PLAN-VERSION-BINDING-001`.
- Fixed race anchors cannot move automatically.
- The first pilot cannot automatically increase demand.

Adaptation acceptance is one atomic transaction:

1. recheck scope, `ACCEPT_ADAPTATION` authorization, guardian/consent expiry, and a
   fresh `GENERATION_ALLOWED` Safety Block ref;
2. perform the scoped idempotency lookup and payload-hash comparison;
3. compare-and-swap the current base version and content hash;
4. insert the successor under a database-enforced unique constraint on
   `(tenantId, groupId, athleteId, basePlanVersionId)` for accepted successors; and
5. append decision, plan version, lifecycle, and audit records together.

Any failure rolls back all five steps. Proposal creation uses the corresponding
atomic `CREATE_ADAPTATION` authorization, safety, idempotency, append, and audit
transaction.

### 10.3 Deterministic adaptation action mapping

| Trigger | Action |
|---|---|
| Safety/auth/scope stop | Immediate `PlanExecutionHoldActivation`; no selectable proposal |
| Accepted race, availability, or immovable-anchor change | `REBUILD_REMAINDER` |
| Explicit scoped coach request | Exact requested allowed action after validation |
| Provenance invalidation of a required source | `BLOCK_AND_REVIEW` |
| Missing required source that invalidates the remainder | `REBUILD_REMAINDER` |
| Planned/experienced difference before thresholds are accepted | No automatic action; `NOT_COMPARABLE` |

When several non-safety triggers exist, priority is
`PROVENANCE_INVALIDATION > ANCHOR_CHANGE > EXPLICIT_COACH_REQUEST > MISSING_SOURCE`.
Safety/auth/scope stops always preempt this table. A registered coach rule may later
propose `SHIFT_FLEXIBLE_SESSION`, `REDUCE_SUPPORTING_DEMAND`, or
`REPLACE_WITH_RECOVERY_OR_REST`; coach acceptance remains required.

Private memo content or metadata can never trigger adaptation. Raw analyzable-note
text can never enter it.

---

## 11. Registered Rule Instances

Abbreviations: `DEC-001` means
`TO-DEC-TRAINING-METHOD-2026-07-14-001`; `PG` means
`PLAN_GENERATOR_SPEC`; `PSG` means `PLAN_SAFETY_GATE_SPEC`; `SC` means
`SESSION_CLASSIFIER_SPEC`; `MCM` means
`MICROCYCLE_AND_CALENDAR_MAPPING_SPEC`; `DLC` means
`DAILY_LOG_AND_CHECKIN_SPEC`; `WO009A` means `CODEX_WORK_ORDER_009.md` Task A.

| ruleId | authorityClass | owner / version | applicability | requiredInputs | missingInputBehavior | output | reasonCodeRefs | evidenceSourceRefs | counterexampleOrFailureState | contractTestIds |
|---|---|---|---|---|---|---|---|---|---|---|
| `FA-R-001` | `AUTOMATED_INVARIANT` | Coach Hojune / 0.2 | Every formation run | scoped identity, operation-specific auth, consent, Safety Block ref | block | eligible run or block | `FA_SCOPE_OR_SAFETY_BLOCK` | PG, PSG | mismatched scope, grant, purpose, expiry, or stale gate | 001-004, 021-023, 035-040 |
| `FA-R-002` | `AUTOMATED_INVARIANT` | Coach Hojune / 0.2 | Eligible pilot frame | timezone DB, resolved boundaries, anchor | clarification | immutable local-civil frame and lineage event | `FA_FRAME_CREATED` | DEC-001, MCM | ambiguous boundary, UTC 228-hour assumption, or ambiguous re-anchor | 019-020, 048-050 |
| `FA-R-003` | `AUTOMATED_INVARIANT` | Privacy owner / 0.2 | Every source, safety, eligibility, and reason ref | immutable scope-bound ancestry graph | reject | privacy-eligible source or safety-only ref | `FA_SOURCE_REJECTED` | DLC, WO009A | private/raw-text laundering, forged flags, cycle, or missing lineage | 011-012, 017-018, 031-034 |
| `FA-R-004` | `AUTOMATED_INVARIANT` | Coach Hojune / 0.2 | Competition planning/accounting | plan kind, role, demand, classifier label | reject | one RACE exposure event | `FA_COMPETITION_EXPOSURE` | DEC-001, SC | rewrite COMPETITION label or double count | 005, 007, 024 |
| `FA-R-005` | `AUTOMATED_INVARIANT` | Coach Hojune / 0.2 | Every feasible option | normalized exposure events | reject option | exactly 2 or 3 MAIN events | `FA_MAIN_COUNT_INVALID` | DEC-001 | fewer than 2, more than 3, component double count | 001, 005, 007 |
| `FA-R-006` | `COACH_DECISION_SUPPORT` | Coach Hojune / 0.2 | After coach rule-set acceptance | fixed anchors, exposure classes, load, response, intent | clarification | canonical base schedule | `FA_PLACEMENT_REVIEW` | DEC-001, evidence ledger | elapsed-only clearance or unaccepted class sequence | 008, 025 |
| `FA-R-007` | `AUTOMATED_INVARIANT` | Coach Hojune / 0.2 | Accepted taxonomy and canonical base | canonical base, registered transforms, contextual triggers, rule-set version | clarification | ordered 2-or-3 option set and stable fingerprints/IDs | `FA_CANDIDATE_SET_CREATED` | DEC-001, PG | duplicate contextual option, label-only transform, or fewer than 2 feasible | 001, 009, 026-027, 052, 054 |
| `FA-R-008` | `AUTOMATED_INVARIANT` | Coach Hojune / 0.2 | Every option set | normalized options | reject duplicate | meaningful difference set | `FA_DUPLICATE_OPTION` | PG | label/rationale-only difference | 009 |
| `FA-R-009` | `AUTOMATED_INVARIANT` | Plan owner / 0.2 | Immediately before selection/proposal/acceptance | operation-specific auth, consent, guardian, scope, Safety Block ref | hard hold | allowed operation or scoped run/version hold | `FA_SELECTION_BLOCKED` | PG, PSG | wrong-purpose, cross-scope, revoked, expired, or stale grant/gate | 021-023, 035-040, 051 |
| `FA-R-010` | `AUTOMATED_INVARIANT` | Data owner / 0.2 | Session outcome ingestion | plan, completion, response refs | retain missing | immutable paired facts | `FA_OUTCOME_RECORDED` | DEC-001, evidence ledger | planned value overwritten by outcome | 010, 013 |
| `FA-R-011` | `AUTOMATED_INVARIANT` | Safety owner / 0.2 | Any post-generation safety/auth change | generation run or current plan plus stop ref | hard hold | append-only hold activation | `FA_PLAN_ON_HOLD` | PSG, PG | coach override, missing run target, or delayed proposal-only response | 014, 021-023, 039-041 |
| `FA-R-012` | `AUTOMATED_INVARIANT` | Plan owner / 0.2 | Proposal creation and acceptance | canonical hashes, current base, scope, auth, safety, idempotency | reject/rollback | one append-only origin-bound successor | `FA_ADAPTATION_ACCEPTED` | PG, PSG | replay, altered payload, concurrent fork, stale hash, cross-scope ref | 028-030, 044-047, 053 |
| `FA-R-013` | `AUTOMATED_INVARIANT` | Data owner / 0.2 | Measure aggregation | scope, parent, key, semantics, fraction | no aggregation | deduplicated measure set | `FA_MEASURE_NOT_AGGREGATED` | DEC-001 | parent/component copied total | 016 |
| `FA-R-014` | `AUTOMATED_INVARIANT` | Mapping owner / 0.2 | Seven-day projection after schema patch | frameId, blockId, session/source IDs | block projection binding | identity-preserving projection | `FA_MAPPING_SCHEMA_BLOCKED` | MCM | frame/block identity absent | 015 |
| `FA-R-015` | `HOLD_INSUFFICIENT_EVIDENCE` | Research owner / 0.2 | Longitudinal context | accepted sample/privacy policies | suppress | null statistics, no influence | `FA_STATS_SUPPRESSED` | evidence ledger | percentile influences candidate | 025 |
| `FA-R-016` | `COACH_DECISION_SUPPORT` | Coach Hojune / 0.2 | Non-safety adaptation trigger | trigger, current plan, accepted coach rules | review | deterministic proposal action | `FA_ADAPTATION_PROPOSED` | DEC-001, PG | comparison threshold invented | 010, 013, 028 |

---

## 12. Evidence Ledger

| Source | Supports | Does not support | Applicability |
|---|---|---|---|
| Haugen et al., 2021, https://pubmed.ncbi.nlm.nih.gov/34021488/ | 800/1500 practice uses aerobic, anaerobic, strength, power, and plyometric work | Exact 9.5-day superiority or universal 72-hour rule | Event-relevant, descriptive, male-biased sample |
| Dobbin et al., 2017, https://pubmed.ncbi.nlm.nih.gov/28002177/ | Some responses remain altered across 72 hours after prolonged high-intensity intermittent running | 1500 m-specific mandatory recovery threshold | Indirect team-sport sample |
| Bourdon et al., 2017, https://pubmed.ncbi.nlm.nih.gov/28463642/ | Multidimensional internal and external load monitoring | One perfect workload number | General monitoring consensus |
| Haddad et al., 2017, https://pubmed.ncbi.nlm.nih.gov/29163016/ | Session-RPE is a practical internal-load measure | Replacement for external, mechanical, or neuromuscular measures | Multi-sport review |
| Mølmen et al., 2019, https://pubmed.ncbi.nlm.nih.gov/31802956/ | Block periodization is a plausible organization | Universal superiority or 9.5-day validation | Small, generally low-quality endurance evidence |
| Inoue et al., 2022, https://pubmed.ncbi.nlm.nih.gov/35244801/ | Coach-planned and athlete-perceived load can differ | Treating plan and response as one fact | Multi-sport separation evidence |
| Petré et al., 2021, https://pubmed.ncbi.nlm.nih.gov/33751469/ | Concurrent endurance/strength effects vary by context | Universal fixed sequencing rule | Preserves modality and training status |
| Llanos-Lagos et al., 2024, https://pubmed.ncbi.nlm.nih.gov/38165636/ | Strength and plyometric methods may affect running economy differently | One interchangeable strength/plyometric class | Middle/long-distance context |

The evidence supports a conditional, multidimensional, coach-governed process. It
does not independently validate 9.5 days as a causal optimum. The first pilot tests
decision usefulness and safety, not universal proof.

---

## 13. Contract Test Vectors

These are future contract tests, not executed runtime evidence.

| ID | Scenario | Expected result |
|---|---|---|
| `FA-TC-001` | Eligible pilot, accepted rule set, no contextual trigger | Exactly BALANCED and CONSERVATIVE in stable order |
| `FA-TC-002` | `D9_ACTIVE` before formation | No frame option or session draft |
| `FA-TC-003` | `D9_UNKNOWN` before formation | No frame option or session draft |
| `FA-TC-004` | Legacy provenance on required prior MAIN | `NEEDS_COACH_CLARIFICATION` |
| `FA-TC-005` | Race anchor inside frame | Competition remains fixed and counts one RACE/MAIN exposure |
| `FA-TC-006` | Running, plyometric, strength in one session | One session with typed components and preserved vector |
| `FA-TC-007` | Warm-up, race, cool-down components | One MAIN exposure event, not three |
| `FA-TC-008` | 72 elapsed hours with high intervening demand | No automatic readiness clearance |
| `FA-TC-009` | Labels differ but normalized sessions match | Duplicate rejected |
| `FA-TC-010` | Experienced load differs from plan | Plan remains unchanged; comparison is `NOT_COMPARABLE` |
| `FA-TC-011` | Private memo written | No source, trigger, hash, presence event, rationale, or audit payload |
| `FA-TC-012` | Raw analyzable note exists | Raw text excluded everywhere in formation/adaptation |
| `FA-TC-013` | Response missing | Missing remains missing; no favorable action |
| `FA-TC-014` | Safety changes after selection | Immediate `ON_SAFETY_HOLD`; optional replan only after fresh validation |
| `FA-TC-015` | Calendar week cuts frame | Binding blocked until projection has frameId and blockId |
| `FA-TC-016` | Whole duration copied to three components | Aggregation rejected |
| `FA-TC-017` | Source has private-memo ancestor | Source rejected without revealing why to candidate logic |
| `FA-TC-018` | Safety result came from analyzable-note D9 evaluation | May block only; detail cannot form/rank/explain |
| `FA-TC-019` | Frame crosses DST forward transition | End is local +9d12h; UTC elapsed need not be 228h |
| `FA-TC-020` | Accepted contiguous successor or re-anchor | Typed lineage event determines relation/effective frame; prior frame immutable |
| `FA-TC-021` | Consent revoked between generation and selection | Atomic recheck creates hard hold; no selection |
| `FA-TC-022` | Safety Gate becomes stale during selection | Atomic operation fails closed |
| `FA-TC-023` | Cross-tenant source introduced | Entire operation rejected and audited without payload |
| `FA-TC-024` | Completed classifier label is COMPETITION | Label remains COMPETITION and exposure ledger counts exactly one MAIN |
| `FA-TC-025` | Longitudinal sample policy absent | Statistics null/suppressed and no candidate influence |
| `FA-TC-026` | Race and recovery triggers plus feasible distinct competition transform | Third is COMPETITION_PREP; recovery constraints apply to all candidates |
| `FA-TC-027` | Conservative transform is infeasible | Fewer than two candidates causes `NEEDS_COACH_CLARIFICATION` |
| `FA-TC-028` | Same adaptation acceptance replayed | Idempotency returns prior result; no second successor |
| `FA-TC-029` | Base content hash changed before acceptance | Compare-and-swap rejects stale proposal |
| `FA-TC-030` | Adaptation proposal references another athlete | Scope rejection; no successor created |
| `FA-TC-031` | A raw analyzable note is laundered through two structured derivatives | Full ancestry traversal rejects candidate source |
| `FA-TC-032` | Source flags say false but eligibility record or direct lineage is missing | Forged/unverifiable source rejected |
| `FA-TC-033` | Provenance graph contains a cycle | Traversal fails closed; no source or rationale emitted |
| `FA-TC-034` | Analyzable note produces sanitized D9 block; private memo produces attempted safety ref | First may block only; private safety ref is rejected as zero-signal |
| `FA-TC-035` | Actor uses unrelated capability to create adaptation | Authorization decision DENY; no proposal |
| `FA-TC-036` | Create-adaptation capability belongs to another tenant/group/athlete | DENY; no cross-scope join |
| `FA-TC-037` | Consent or guardian grant expires before proposal creation | Atomic recheck DENY; no proposal |
| `FA-TC-038` | Actor lacks `ACCEPT_ADAPTATION` at acceptance | Transaction rolls back |
| `FA-TC-039` | Acceptance grant belongs to another scope | Transaction rolls back without payload leakage |
| `FA-TC-040` | Consent or guardian grant expires before acceptance | Transaction rolls back; proposal remains non-accepted |
| `FA-TC-041` | Actor attempts hold release without release authorization | Release event rejected; target remains held |
| `FA-TC-042` | Hold release uses stale or note-derived GENERATION_ALLOWED safety ref | Release rejected; target remains held |
| `FA-TC-043` | Release and new safety hold race | Monotonic re-read leaves target held and appends auditable events |
| `FA-TC-044` | Same idempotency key is reused with altered payload | Request-hash mismatch rejected |
| `FA-TC-045` | Two successors concurrently accept from one base | Database unique constraint permits exactly one; loser rolls back |
| `FA-TC-046` | Same idempotency key appears in another tenant | Scope isolation prevents collision or result disclosure |
| `FA-TC-047` | Adaptation proposal creation is replayed | Same request returns original proposal; no duplicate append |
| `FA-TC-048` | Frame starts at ambiguous DST fold | Explicit offset/fold decision required and persisted |
| `FA-TC-049` | Computed end-exclusive local time falls in DST gap | Explicit end adjustment decision required; no guessed instant |
| `FA-TC-050` | Re-anchor creates a gap or overlap | Lineage event records relation, effective boundary, disposition, and governing successor |
| `FA-TC-051` | Consent is revoked after options but before any plan version exists | Run-target hold activation invalidates option set |
| `FA-TC-052` | Competition-prep transform duplicates conservative option | Duplicate discarded; next feasible contextual option tried, otherwise exactly two |
| `FA-TC-053` | Accepted adaptation content differs from coach-reviewed proposed hash | CAS/content binding rejects the transaction |
| `FA-TC-054` | Conservative transform changes only overview demand label | Transform rejected until typed component/measure change is registered |

---

## 14. Downstream Binding

After owner acceptance, `PLAN_GENERATOR_SPEC.md` must be patched to:

- register this accepted source and the owner decision ID
- consume frame, block, component, measure, difference, version, hold, and adaptation refs
- adopt the accepted 2-or-3 option taxonomy and exact arbitration
- distinguish `plannedSessionRole` from classifier `sessionLabel`
- preserve existing `plannedKind`, `plannedEnergyFocus`, and
  `plannedIntensityLabel` while adding typed components
- add atomic pre-selection and pre-adaptation auth/safety rechecks
- add `NEEDS_COACH_CLARIFICATION` for missing formation context
- keep coach selection, Safety Gate, Rule Spec validation, and audit ownership

`MICROCYCLE_AND_CALENDAR_MAPPING_SPEC.CalendarSessionProjection` must add non-null
`frameId` and `blockId` for planned projections before seven-day identity preservation
is representable. This requires a target schema patch, target issue recount, timezone
tests, and runtime evidence. Mapping remains projection-only.

`DAILY_LOG_AND_CHECKIN_SPEC.md` remains input/privacy owner. Formation consumes only
eligible structured fields under the closed source contract. No raw note or private
memo metadata reaches plan records.

No downstream patch is authorized by this draft alone.

---

## 15. Open Issues

| ID | Priority | Canonical blocking | Status | Summary | Resolution needed |
|---|---|---:|---|---|---|
| `OI-FA-COACH-RULESET-001` | P1 | YES | OPEN | Phase-specific placement, proposed MAIN exposure-class vocabulary/sequence, proposed option taxonomy/arbitration, progression, taper, recovery, and exceptions are not accepted. | Owner accepts or revises the proposed registries and approves versioned rules with failure states and tests. |
| `OI-FA-LOAD-COMPONENT-001` | P1 | YES | OPEN | Component allocation, measure units, and whole-session intensity mapping are unresolved. | Accept registry, allocation, dedupe, and conflict behavior. |
| `OI-FA-MINIMUM-EVIDENCE-001` | P1 | YES | OPEN | History length, freshness, missingness, statistical privacy, and suppression policies are unresolved. | Accept pilot thresholds or keep statistics suppressed. |
| `OI-FA-PLAN-VERSION-BINDING-001` | P1 | YES | OPEN | Plan Generator lacks formation, version, hold, CAS, and adaptation records. | Patch and recount target after source acceptance. |
| `OI-FA-PILOT-PROTOCOL-001` | P1 | YES | OPEN | One-athlete baseline, decision-usefulness metrics, safety events, and stop criteria are unresolved. | Accept prospective protocol before pilot execution. |
| `OI-FA-CALENDAR-SCHEMA-BINDING-001` | P1 | YES | OPEN | Calendar projection lacks frameId and blockId, so identity preservation is not representable. | Patch mapping schema, recount, and add DST/projection tests. |
| `OI-FA-RUNTIME-EVIDENCE-001` | P2 | NO | OPEN | No implementation or CI evidence exists. | Implement only after acceptance, then run contract/security tests. |

---

## 16. Self-Check

| Check | Status |
|---|---|
| Owner-confirmed facts point to an auditable decision record | PASS |
| Proposed option taxonomy is not misrepresented as confirmed | PASS |
| Local-civil 9.5-day start/end and DST behavior are explicit | PASS |
| MAIN count is invariant; placement remains coach-decision support | PASS |
| Planning role and classifier label are separate | PASS |
| Competition remains COMPETITION and counts one MAIN exposure | PASS |
| Moderate and moderately-high components are representable | PASS |
| Composite measures cannot silently double-count | PASS |
| Candidate count, precedence, IDs, sorting, and fallback are deterministic | PASS |
| Planned, completion, and experienced facts remain separate | PASS |
| Longitudinal statistics are held and suppressed | PASS |
| Private/raw-note content and metadata cannot enter plan logic | PASS |
| Safety/auth state changes create immediate non-overridable holds | PASS |
| Adaptation uses scope checks, append-only versions, CAS, and idempotency | PASS |
| Calendar identity claim is blocked pending schema patch | PASS |
| No production, app, canonical, or runtime claim is made | PASS |
| Open issue count is 7 and canonical blocker count is 6 | PASS |
| Final marker is the final line | PASS |

[DRAFT_COMPLETE]
