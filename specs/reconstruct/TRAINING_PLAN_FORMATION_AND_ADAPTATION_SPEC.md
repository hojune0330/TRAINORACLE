# TRAINING_PLAN_FORMATION_AND_ADAPTATION_SPEC.md

```yaml
document_metadata:
  doc_id: trainoracle-spec-018-training-plan-formation-and-adaptation
  spec_id: TRAINING_PLAN_FORMATION_AND_ADAPTATION_SPEC
  title: TrainOracle Training Plan Formation And Adaptation Spec
  version: "0.4"
  round: RT3_OWNER_SHADOW_PILOT_BINDING
  status: DRAFT_FOR_REVIEW
  owner: COACH_HOJUNE
  owner_decision_ref: TO-DEC-TRAINING-METHOD-2026-07-14-001
  owner_product_decision_ref: TO-DEC-ATHLETE-VISIBLE-SHADOW-2026-07-14-001
  pilot_scope: ONE_COACH_LINKED_1500M_ATHLETE
  open_issues_total: 11
  canonical_blocking_count: 10
  contract_vectors_total: 104
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

1. Accepted safety, D9, privacy, authorization, tenancy, consent, provenance, and
   App Bridge contracts. These are non-overridable by coaching or product policy.
2. `TRAINING_PLAN_METHOD_DECISION.md`, decision
   `TO-DEC-TRAINING-METHOD-2026-07-14-001`, within its stated coaching-method scope.
3. Accepted Plan Generator, classifier, and mapping contracts within their ownership.
4. Current peer-reviewed evidence with applicability limits.
5. Legacy coaching documents as historical inputs only.
6. Design and product copy as non-prescriptive references.

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

The 9.5-day frame, 2-3 MAIN count, and approximately three-day tendency are
**first-pilot scheduling conventions** authorized for scoped decision support. Owner
acceptance governs execution policy; it does not establish biological truth, raise
evidence certainty, or override medical, safety, privacy, or research limitations.

---

## 4. Decision Authority And Registration

Every formation or adaptation rule declares exactly one authority class.

```yaml
decision_authority_classes:
  AUTOMATED_INVARIANT:
    meaning: deterministic boundary already accepted by an owning contract
    may_create_automatic_change: only_within_declared_non_prescriptive_boundary
  PROPOSED_PENDING_OWNER_ACCEPTANCE:
    meaning: deterministic proposal whose owning target contract has not accepted it
    executable: false
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
cannot execute. A rule cannot be `AUTOMATED_INVARIANT` merely because this draft
describes it: its named owning contract must already accept the exact behavior.
Section 11 is the registry for this draft. Proposed rules remain non-executable and
all rules remain non-production while this document is `DRAFT_FOR_REVIEW`.

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
    - typed_previous_MAIN_context_status
    - typed_intervening_session_context_status
    - immutable_eligible_formation_source_refs
  provenance:
    direct_values: EXPLICIT_only
    derived_values: all_inputs_EXPLICIT_and_derivation_metadata_complete
    legacy_invalid_or_ineligible_values_may_support_plan: false
  raw_note_input_allowed: false
```

No history-length or freshness threshold is invented here. Prior-MAIN and
intervening-session context must explicitly declare `PRESENT_ELIGIBLE`, `ABSENT`,
`STALE`, or `EXCLUDED`; the bare phrase "when available" is forbidden. Until the
minimum-evidence policy defines which states are sufficient for an initial frame,
later frame, and re-anchor, any state other than `PRESENT_ELIGIBLE` returns
`NEEDS_COACH_CLARIFICATION`. It does not silently disappear or fall back to a
population default.

### 5.1 Closed source contract

```yaml
FormationSourceRefId: string
FormationEligibilityDecisionId: string
FormationAuthorizationDecisionId: string
RecordGovernanceEnvelopeRefId: string

FormationContextAvailabilityRecord:
  contextKind: PREVIOUS_MAIN | INTERVENING_COMPLETED_SESSIONS
  status: PRESENT_ELIGIBLE | ABSENT | STALE | EXCLUDED
  sourceRefIds: FormationSourceRefId[]
  evaluatedAt: ISO_DATETIME
  policyVersion: string
  uncertaintyCodes: string[]
  governanceEnvelopeRef: RecordGovernanceEnvelopeRefId

RecordGovernanceEnvelope:
  governanceEnvelopeRefId: string
  audiencePolicyRef: string
  accessPolicyRef: string
  retentionPolicyRef: string
  deletionAndAgeOutPolicyRef: string
  consentRevocationPolicyRef: string
  legalHoldPolicyRef: string
  keyErasurePolicyRef: string
  auditMinimizationPolicyRef: string
  policyVersion: string

FormationAuthorizationDecisionRecord:
  authorizationDecisionId: string
  operation: GENERATE_PLAN_OPTIONS | SELECT_PLAN_OPTION | CREATE_ADAPTATION | ACCEPT_ADAPTATION | REJECT_ADAPTATION | RELEASE_EXECUTION_HOLD
  tenantId: string
  groupId: string
  athleteId: string
  actorUserId: string_or_SYSTEM_CONTRACT
  linkedCoachDecisionRef: string_or_null
  linkedCoachUserId: string_or_null
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
      grantVersion: integer
      revocationEpoch: integer
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
  guardianUserId: string_or_null
  guardianSubjectAthleteId: string_or_null
  guardianVerifiedIdentityRef: string_or_null
  guardianOperation: registered_operation_or_null
  guardianDataCategories: registered_data_category_array
  guardianGrantStatus: ACTIVE | REVOKED | EXPIRED | NOT_REQUIRED
  guardianGrantVersion: integer_or_null
  guardianRevocationEpoch: integer_or_null
  guardianConsentExpiresAt: ISO_DATETIME_or_null
  authorizationSnapshotVersion: integer
  decision: ALLOW | DENY
  checkedAt: ISO_DATETIME
  auditLogId: string
  governanceEnvelopeRef: RecordGovernanceEnvelopeRefId
  immutableRecordHash: CanonicalContentHash

FormationEligibilityDecisionRecord:
  eligibilityDecisionId: string
  sourceRefId: FormationSourceRefId_or_SafetyBlockRefId
  sourceContentHash: CanonicalContentHash
  tenantId: string
  groupId: string
  athleteId: string
  directInputRefIds: string[]
  directInputContentHashes: CanonicalContentHash[]
  privacyOrigin: NO_NOTE_OR_MEMO | ANALYZABLE_NOTE_SAFETY_ONLY
  provenanceState: EXPLICIT | ELIGIBLE_DERIVED | SYSTEM_CONTRACT_RESULT
  derivationRuleId: string_or_null
  derivationRuleVersion: string_or_null
  permittedUseDecision: ALLOW_FORMATION_INPUT | ALLOW_CONTEXT_ONLY | ALLOW_SAFETY_BLOCK_ONLY | REJECT
  decisionPolicyVersion: string
  decision: ALLOW | REJECT
  decidedAt: ISO_DATETIME
  governanceEnvelopeRef: RecordGovernanceEnvelopeRefId
  immutableRecordHash: CanonicalContentHash

FormationSourceRef:
  sourceRefId: string
  sourceKind:
    - ATHLETE_PROFILE_SNAPSHOT
    - ELIGIBLE_STRUCTURED_DAILY_LOG_FIELD
    - CLASSIFIED_SESSION_RECORD
    - COACH_INTENT
    - COMPETITION_ANCHOR
    - ATHLETE_AVAILABILITY_CONSTRAINT
    - ELIGIBLE_SESSION_TEMPLATE
    - PLANNED_SESSION_DRAFT
    - ELIGIBLE_COMPLETED_SESSION_RECORD
    - LONGITUDINAL_LOAD_CONTEXT
  sourceId: string
  sourceVersion: string
  sourceContentHash: CanonicalContentHash
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
  governanceEnvelopeRef: RecordGovernanceEnvelopeRefId

SafetyBlockRefId: string

SafetyBlockRef:
  safetyBlockRefId: string
  safetyGateResultId: string
  safetyGateVersion: string
  tenantId: string
  groupId: string
  athleteId: string
  gateState: GENERATION_ALLOWED | BLOCKED | D9_UNKNOWN | STALE
  targetKind: PLAN_GENERATION_RUN | PLAN_VERSION | OPERATION_REQUEST
  targetId: string
  evaluatedAt: ISO_DATETIME
  issuedAt: ISO_DATETIME
  expiresAt: ISO_DATETIME
  inputSnapshotHash: CanonicalContentHash
  sourceEventWatermark: integer
  eligibilityDecisionRef: FormationEligibilityDecisionId
  privacyOrigin: NO_NOTE_OR_MEMO | ANALYZABLE_NOTE_SAFETY_ONLY
  permittedUse: SAFETY_BLOCK_ONLY
  containsPrivateSelfOnlySignal: false
  containsRawTextHashEmbeddingQuoteOrSummary: false
  containsReconstructableReasonDetail: false
  candidateFormationRankingOrExplanationAllowed: false
  productProjection: GENERIC_BLOCKED_OR_PAUSED_ONLY
  governanceEnvelopeRef: RecordGovernanceEnvelopeRefId

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
  `REJECT_ADAPTATION -> REJECT_ADAPTATION`, and
  `RELEASE_EXECUTION_HOLD -> RELEASE_EXECUTION_HOLD`.
- Every capability and consent grant must match tenant, group, athlete, operation
  purpose, actor, active status, grant version, revocation epoch, and `checkedAt`;
  null expiry is allowed only when the owning contract permits it, and expiry is denied.
- Selection and acceptance require a verified same-group linked-coach decision whose
  linked user equals the acting user. Generic capability alone is insufficient.
- Guardian satisfaction is required when the athlete contract requires it and must
  bind verified guardian and subject identity, exact operation, data categories,
  status, grant version, revocation epoch, expiry, and immutable content.
- An authorization decision is immutable, auditable, operation-specific, and cannot
  be reused for another operation or later recheck.
- Authorization/guardian recheck and mutation commit are one serializable transaction
  or a target-accepted equivalent using locked grant rows and revocation-epoch CAS.
- The proposed capability names beyond current Plan Generator generation authority
  require registry adoption under `OI-FA-PLAN-VERSION-BINDING-001`.

```yaml
formation_source_invariants:
  unknown_source_kind: reject
  PHYSIO_SOURCE_TRUST_RESULT_before_Formation_acceptance_and_version_guard: reject
  missing_scope_or_eligibility_decision: reject
  tenant_group_athlete_mismatch: reject
  missing_direct_input_lineage: reject
  missing_or_mutable_eligibility_record: reject
  source_content_hash_mismatch_or_substitution: reject
  lineage_edge_ref_hash_mismatch: reject
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
inputs and their content hashes to explicit roots. Cached flags are assertions only;
traversal, content-bound edges, and immutable decision records are the authority.
Missing, substituted, cyclic, cross-scope, or unverifiable lineage fails closed.

`SafetyBlockRef` is deliberately not a `FormationSourceRef`. It may stop an operation,
but cannot form, rank, hash, or explain a candidate. Sanitized analyzable-note D9
ancestry is allowed only for `BLOCKED`, `D9_UNKNOWN`, or `STALE`; it can never produce
`GENERATION_ALLOWED`. Its athlete/coach/plan projection is one opaque generic
blocked/paused state and cannot expose note presence, origin, medical category,
detailed D9 reason, evaluator timing, source hash, or audit correlation.
`PRIVATE_SELF_ONLY` remains absolute zero-signal, including for safety refs. A future
plan-eligible note derivative requires a separate owner decision, schema, consent
purpose, retention rule, test package, and Plan Generator adoption.

Every source, authorization, safety, plan, hold, adaptation, selection, and audit
record requires an accepted `RecordGovernanceEnvelope`. Missing retention, access,
youth age-out/deletion, revocation suppression, legal-hold, key-erasure, or audit
minimization policy blocks persistence and formation; append-only does not mean
retain forever.

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
  effectiveBoundary: LocalCivilBoundaryResolution
  boundaryDisposition: NO_GAP_NO_OVERLAP | EXPLICIT_GAP | EXPLICIT_OVERLAP
  predecessorHeadRevision: integer
  predecessorFrameContentHash: CanonicalContentHash
  successorFrameContentHash: CanonicalContentHash
  displacedSessionDispositions:
    - plannedSessionDraftId: string
      disposition: RETAIN_PREDECESSOR | MOVE_TO_SUCCESSOR | CANCEL_BY_COACH | NEEDS_COACH_CLARIFICATION
  reanchorDecisionRef: string_or_null
  createdAt: ISO_DATETIME
  auditLogId: string
  governanceEnvelopeRef: RecordGovernanceEnvelopeRefId

MicrocycleFrameHeadRecord:
  tenantId: string
  groupId: string
  athleteId: string
  currentFrameId: string
  headRevision: integer
  frameContentHash: CanonicalContentHash
  updatedByLineageEventId: string_or_null
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
- A `REANCHOR_REPLACEMENT` requires an append-only lineage event, resolved effective
  boundary, re-anchor decision, gap/overlap disposition, and explicit disposition for
  every displaced session. The effective boundary must equal the successor start
  boundary. The predecessor remains historical; the successor governs planning at
  and after the resolved effective boundary.
- No gap or overlap is inferred. `EXPLICIT_GAP` or `EXPLICIT_OVERLAP` requires the
  owner decision ref and never changes prior frame facts.
- `INITIAL` requires null `previousFrameId` and `lineageEventId`. Both successor
  relations require non-null values whose lineage event names the same predecessor,
  successor, scope, and relation.
- Frame creation and lineage append compare-and-swap one scoped frame head. A unique
  successor is allowed for one predecessor head revision. The head, frame, lineage,
  audit, and outbox event become visible atomically or not at all.
- The owner has not yet chosen every-sliding-window versus named-lineage-frame MAIN
  accounting. Until `OI-FA-COACH-RULESET-001` accepts carry-over semantics and a
  predecessor lookback rule, a re-anchor cannot emit a selectable candidate.
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
`COMPETITION` record counts as one MAIN exposure event. It does not automatically
receive the still-unaccepted `RACE` class. An accepted classifier `MAIN` record counts
as one MAIN exposure event with its separately preserved source-defined or
coach-registered exposure class. No classifier label alone may invent or collapse
threshold, VO2, glycolytic, speed-power, strength-power, or race identity.

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

MainExposureLedgerRecord:
  exposureLedgerRecordId: string
  planVersionId: string
  plannedSessionDraftId: string
  completedSessionRef: FormationSourceRefId_or_null
  classifierSessionLabel: MAIN | COMPETITION | null
  exposureKind: TRAINING_MAIN | COMPETITION
  acceptedMainExposureClass: registered_MAIN_exposure_class_or_null
  countsAsMainExposure: true
  localStartBoundary: LocalCivilBoundaryResolution
  sourceContentHashes: CanonicalContentHash[]
  ruleSetVersion: string
  governanceEnvelopeRef: RecordGovernanceEnvelopeRefId

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
  `plannedSessionRole: MAIN`, and `plannedDemandBand: HIGH`. Until the exposure-class
  registry is accepted, `mainExposureClass` remains null or pending; it is `RACE`
  only after explicit registry acceptance.
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
injury probability. The vector dimensions and `NONE/LOW/MODERATE/HIGH` bands are
pilot documentation fields, not validated latent physiology, prediction, or
readiness. Automatic vector aggregation is held.

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
  governanceEnvelopeRef: RecordGovernanceEnvelopeRefId
```

Until sample, freshness, missingness, privacy, redaction, and retention policies are
accepted, statistics and both count fields remain null and suppressed. `sourceRefIds`
must be empty and no athlete-history source list is created for this record. Raw
samples, counts, source lists, or descriptive statistics cannot rank candidates,
appear in rationale, or be exposed to any product surface. Once a future policy is
accepted, source access remains confined to the scoped provenance store and is never
a coach/user-facing list.

---

## 8. Deterministic Candidate Formation Policy

### 8.1 Authority split

The **count boundary** is owner-confirmed method policy: a successful candidate has
exactly 2 or 3 planned MAIN exposure events. Its automated target enforcement remains
`PROPOSED_PENDING_OWNER_ACCEPTANCE` until the owning Plan Generator/Rule binding
accepts the exact behavior. Exact phase, class sequence, and placement are
coach-decision support and remain blocked until the coach rule set in
`OI-FA-COACH-RULESET-001` is accepted.

```yaml
candidate_formation_flow:
  1_validate_scope_consent_provenance_and_safety: PROPOSED_PENDING_OWNER_ACCEPTANCE
  2_create_immutable_local_civil_frame: PROPOSED_PENDING_OWNER_ACCEPTANCE
  3_place_fixed_competition_and_immovable_constraints: PROPOSED_PENDING_OWNER_ACCEPTANCE
  4_build_canonical_base_from_accepted_coach_rules: COACH_DECISION_SUPPORT
  5_validate_exactly_two_or_three_MAIN_exposure_events: PROPOSED_PENDING_OWNER_ACCEPTANCE
  6_preserve_components_measures_and_uncertainty: PROPOSED_PENDING_OWNER_ACCEPTANCE
  7_generate_and_arbitrate_distinct_candidates: PROPOSED_PENDING_OWNER_ACCEPTANCE
  8_require_atomic_authorization_safety_recheck_and_coach_selection: PROPOSED_PENDING_OWNER_ACCEPTANCE
  9_request_RULE_SPEC_validation_after_selection: PROPOSED_PENDING_OWNER_ACCEPTANCE
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
   `CONSERVATIVE` is mandatory for a selectable set. If no conservative transform is
   feasible, stop with `NEEDS_COACH_CLARIFICATION` before contextual evaluation.
3. A registered load transform must specify immutable before/after component and
   measure structures, applicability, whole-session label reconciliation, and tests.
   Changing only `plannedDemandBand`, label, or rationale is invalid. These transforms
   cannot execute before `OI-FA-LOAD-COMPONENT-001` is accepted.
4. For support selection, sort by demand `HIGH > MODERATE > LIGHT > RECOVERY`, then
   local start ascending, session-slot order `AM < PM < DOUBLE < FLEX`, then stable
   canonical session fingerprint, then stable source/session identity by unsigned
   UTF-8 byte order. Select the first eligible record. An exact duplicate identity or
   comparator tuple collision is ambiguous input and is rejected rather than resolved
   by input iteration order.
5. For a MAIN move, enumerate valid local half-day slots that preserve fixed anchors,
   exposure count, class constraints, frame bounds, and every accepted intervening
   metabolic, mechanical, neuromuscular, strength-power, duration-volume, and
   competition-stress constraint. Only after feasibility passes may it maximize the
   minimum local civil duration to adjacent MAIN events; break ties by earliest local
   slot, canonical session fingerprint, and stable source identity. If the component
   feasibility registry is not accepted, the move is infeasible. This operation
   proposes spacing; it does not clear readiness.
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
9. Apply all global recovery and safety constraints to the canonical base and every
   transform before feasibility, meaningful-distinctness, or contextual arbitration.
10. Without a feasible contextual result, emit exactly two candidates.
11. Discard infeasible or duplicate candidates. If fewer than two remain, return
   `NEEDS_COACH_CLARIFICATION` and emit no selectable set.

The competition and recovery registries are part of
`OI-FA-COACH-RULESET-001`. Neither option claims medical recovery.

```yaml
candidate_identity:
  canonicalInputOrdering: sourceRefId_ascending_after_scope_validation
  canonicalSessionOrdering: localStart_then_slotOrder_then_canonicalSessionFingerprint_then_stableSourceIdentityUnsignedUTF8
  fixedOptionOrder: BALANCED_CONSERVATIVE_CONTEXTUAL
  hashAlgorithm: SHA_256
  canonicalSerialization: RFC_8785_JSON_CANONICALIZATION_SCHEME
  candidateFingerprint: SHA256(JCS(CanonicalCandidateHashEnvelope))
  planOptionId: SHA256(JCS(PlanOptionIdHashEnvelope))
  repeatability: candidateFingerprint_and_normalized_content_stable_across_runs; planOptionId_stable_within_one_run
  private_content_in_hash: forbidden
  unstable_display_text_in_hash: forbidden

CanonicalCandidateHashEnvelope:
  domainTag: TRAINORACLE_FORMATION_CANDIDATE
  schemaVersion: string
  formationRuleSetVersion: string
  optionType: registered_option_type
  timezoneDatabaseVersion: string
  resolvedFrameBoundaryDocument: object
  canonicalConstraintAndSessionDocument: object
  collectionOrderingRulesVersion: string
  canonicalUnitsRegistryVersion: string

PlanOptionIdHashEnvelope:
  domainTag: TRAINORACLE_FORMATION_PLAN_OPTION_ID
  schemaVersion: string
  planGenerationRunId: string
  candidateFingerprintDigestHex: lowercase_64_hex

canonical_hash_preimage_rules:
  serialization: RFC_8785_JSON_CANONICALIZATION_SCHEME
  textNormalizationBeforeJCS: Unicode_NFC
  nullVersusOmitted: schema_declared_and_never_interchangeable
  defaults: materialized_before_hash
  numbers: finite_JSON_numbers_only_no_negative_zero
  units: canonical_units_only
  arrays: ordered_by_declared_semantics_or_canonical_bytewise_key
  localTime: persisted_resolved_boundaries_and_timezone_database_version
  replay: never_re_resolve_timezone_or_defaults
  domainSeparation: required

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

Outcome invariants:

- `COMPLETED`, `PARTIAL`, and `CHANGED` require a non-null eligible completed-session
  ref from the same accepted plan-version lineage.
- `MISSED` requires a null completed-session ref and cannot carry experienced-load
  values unless a separate owner-accepted missed-session response contract exists.
- `NOT_YET_DUE` requires a null completed-session ref and all experienced-load values,
  provenance refs, and capture time to be null or empty.
- Stale, excluded, cross-version, or post-cutoff response/readiness refs cannot
  influence an adaptation proposal.
- A missed MAIN remains a planned MAIN but is not a completed exposure. It never
  triggers automatic catch-up, compression, back-to-back placement, or movement to
  preserve the planned count. Rescheduling requires a new coach-reviewed class,
  load, spacing, and safety decision; safety takes priority over count.

`rpeScaleRef` is required when any RPE value is present. Until comparison thresholds
are accepted, eligible facts may be displayed side by side but the system returns
`NOT_COMPARABLE`; it cannot automatically select an adaptation action. Session-RPE
rating is one internal-load dimension; an sRPE load method (normally rating multiplied
by duration) is a separate derived measure with its own rule/version. Neither can
erase external load, mechanical impact, neuromuscular demand, pain, or missingness.

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

IdempotencyResult:
  tenantId: string
  groupId: string
  athleteId: string
  operation: registered_operation
  idempotencyKey: string
  requestHash: CanonicalContentHash
  resultKind: COMMITTED_SUCCESS | COMMITTED_REJECTION
  resultRef: string
  committedAt: ISO_DATETIME
  uniqueKey: tenant_group_athlete_operation_idempotencyKey

EventEnvelope:
  streamId: string
  eventId: string
  eventSequence: integer
  predecessorRevision: integer
  sourceEventId: string
  sourceEventWatermark: integer
  occurredAt: ISO_DATETIME
  recordedAt: ISO_DATETIME

PlanLifecycleAggregate:
  aggregateId: string
  tenantId: string
  groupId: string
  athleteId: string
  planGenerationRunId: string
  aggregateRevision: integer
  safetyEpoch: integer
  authorizationRevocationEpoch: integer
  optionSetRevision: integer
  frameHeadRevision: integer
  currentPlanVersionId: string_or_null
  currentPlanLifecycle: NO_VERSION | SELECTED_PENDING_VALIDATION | VALIDATED_ACCEPTED | VALIDATION_REJECTED | SUPERSEDED
  activeHoldActivationIds: string[]
  stateHash: CanonicalContentHash

PlanExecutionHoldActivation:
  holdActivationId: string
  eventEnvelope: EventEnvelope
  targetKind: PLAN_GENERATION_RUN | PLAN_VERSION
  planGenerationRunId: string
  planVersionId: string_or_null
  tenantId: string
  groupId: string
  athleteId: string
  triggers: sorted_unique_array_of_D9_ACTIVE_D9_UNKNOWN_SAFETY_GATE_BLOCKED_SAFETY_GATE_STALE_AUTHORIZATION_REVOKED_SCOPE_MISMATCH
  safetyBlockRefIds: SafetyBlockRefId[]
  authorizationDecisionRefs: FormationAuthorizationDecisionId[]
  expectedTargetStateHash: CanonicalContentHash
  createdAt: ISO_DATETIME
  createdBy: SYSTEM_CONTRACT
  auditLogId: string
  idempotency: IdempotencyEnvelope
  governanceEnvelopeRef: RecordGovernanceEnvelopeRefId
  coachOverrideAllowed: false

PlanExecutionHoldReleaseEvent:
  holdReleaseEventId: string
  eventEnvelope: EventEnvelope
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
  governanceEnvelopeRef: RecordGovernanceEnvelopeRefId
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

Authorization, scope, consent, safety, active-hold state, option-set revision, and
plan lifecycle are atomically rechecked in the same shared aggregate transaction as
coach candidate selection and adaptation acceptance. Selection and a concurrent
safety/authorization revocation serialize on `aggregateRevision`, `safetyEpoch`, and
`authorizationRevocationEpoch`; neither may commit from a stale snapshot.

Hold activation and release never mutate an accepted plan or the activation record.
All hold causes for one target use one sequenced stream. A target is `HELD` iff at
least one activation has no valid later release; release of one cause cannot erase
another. Duplicate or late upstream events are deduplicated by scoped `sourceEventId`
and projected by sequence/watermark. A release requires CAS against the active hold,
aggregate revision, safety epoch, and target state, plus an idempotency envelope. On
an activation race or CAS conflict, the operation re-reads and fails closed; it can
never lose an active hold.

For `targetKind: PLAN_GENERATION_RUN`, `planVersionId` must be null. For
`targetKind: PLAN_VERSION`, it must be non-null and belong to the same generation run
and scope. Each sorted trigger has one matching typed cause ref; simultaneous causes
are stored together in canonical trigger order. Release requires a same-scope
`GENERATION_ALLOWED` safety ref with no note ancestry whose issue time and source
watermark are later than the latest active hold, whose target and input snapshot hash
match the aggregate, and whose expiry is after commit. It also requires an ALLOW
authorization decision for `RELEASE_EXECUTION_HOLD`. Active holds are checked in the
adaptation-acceptance transaction; a fresh allow ref alone cannot bypass an
unreleased activation.

### 10.2 Immutable plan version and adaptation records

```yaml
PlanOptionSetRecord:
  optionSetId: string
  planGenerationRunId: string
  aggregateRevision: integer
  formationRuleSetVersion: string
  canonicalInputHash: CanonicalContentHash
  orderedOptionIds: string[]
  orderedCandidateFingerprints: CanonicalContentHash[]
  state: COMPLETE_SELECTABLE | INVALIDATED
  contentHash: CanonicalContentHash
  governanceEnvelopeRef: RecordGovernanceEnvelopeRefId

CoachPlanSelectionRecord:
  selectionId: string
  optionSetId: string
  optionSetRevision: integer
  selectedOptionId: string
  selectedCandidateFingerprint: CanonicalContentHash
  linkedCoachDecisionRef: string
  selectedByLinkedCoachUserId: string
  expectedAggregateRevision: integer
  expectedSafetyEpoch: integer
  authorizationDecisionRef: FormationAuthorizationDecisionId
  safetyBlockRefId: SafetyBlockRefId
  idempotency: IdempotencyEnvelope
  governanceEnvelopeRef: RecordGovernanceEnvelopeRefId

PlanValidationEvent:
  validationEventId: string
  eventEnvelope: EventEnvelope
  planVersionId: string
  validationContext: INITIAL_SELECTION | ADAPTATION_ACCEPTANCE
  eventType: RULE_VALIDATION_ACCEPTED | RULE_VALIDATION_REJECTED
  ruleSpecVersion: string
  validatedContentHash: CanonicalContentHash
  exposureLedgerHash: CanonicalContentHash
  expectedAggregateRevision: integer
  expectedSafetyEpoch: integer
  validationRequestHash: CanonicalContentHash
  idempotency: IdempotencyEnvelope
  createdAt: ISO_DATETIME
  auditLogId: string
  governanceEnvelopeRef: RecordGovernanceEnvelopeRefId

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
  initialLifecycle: SELECTED_PENDING_VALIDATION | VALIDATED_ACCEPTED
  expectedAggregateRevision: integer
  expectedSafetyEpoch: integer
  createdAt: ISO_DATETIME
  createdByUserId: string
  acceptedAt: ISO_DATETIME_or_null
  acceptedByUserId: string_or_null
  auditLogId: string
  governanceEnvelopeRef: RecordGovernanceEnvelopeRefId

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
  governanceEnvelopeRef: RecordGovernanceEnvelopeRefId

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
  decisionAuthorizationDecisionRef: FormationAuthorizationDecisionId
  freshSafetyBlockRefId: SafetyBlockRefId_or_null
  compareAndSwapBaseContentHash: CanonicalContentHash_or_null
  acceptedProposedContentHash: CanonicalContentHash_or_null
  auditLogId: string
  idempotency: IdempotencyEnvelope
  governanceEnvelopeRef: RecordGovernanceEnvelopeRefId

PlanAdaptationLifecycleEvent:
  lifecycleEventId: string
  adaptationProposalId: string
  tenantId: string
  groupId: string
  athleteId: string
  eventType: INVALIDATED_BY_SAFETY_OR_AUTH | INVALIDATED_BY_RULE_VALIDATION | SUPERSEDED_BY_ACCEPTED_SIBLING
  safetyBlockRefId: SafetyBlockRefId_or_null
  authorizationDecisionRef: FormationAuthorizationDecisionId_or_null
  createdAt: ISO_DATETIME
  auditLogId: string
  idempotency: IdempotencyEnvelope
  governanceEnvelopeRef: RecordGovernanceEnvelopeRefId
```

Version invariants:

- All records and referenced sources must share tenant, group, and athlete scope.
- Plan versions, selections, validations, and decisions are append-only.
- Initial selection creates `SELECTED_PENDING_VALIDATION`, not an executable accepted
  plan. Rule Spec validation appends `RULE_VALIDATION_ACCEPTED` or
  `RULE_VALIDATION_REJECTED`; only `VALIDATED_ACCEPTED` may execute or project to a
  calendar. The predecessor record is never updated in place.
- Plan content and `PlanVersionRecord` never mutate. Current execution state is a
  projection of append-only hold activation/release records.
- Proposal status (`DRAFT | WAITING_FOR_COACH | ACCEPTED | REJECTED | SUPERSEDED |
  INVALIDATED_BY_SAFETY_OR_AUTH | INVALIDATED_BY_RULE_VALIDATION`) is a projection of append-only creation,
  lifecycle, and decision records; status changes never overwrite source facts.
- One accepted successor is allowed per predecessor plan version. Every proposal has
  at most one terminal decision. Acceptance atomically appends
  `SUPERSEDED_BY_ACCEPTED_SIBLING` for every still-open sibling proposal.
- `ACCEPT` requires `ACCEPT_ADAPTATION` authorization and non-null fresh safety/base/
  proposed-content fields. `REJECT` requires `REJECT_ADAPTATION` authorization and
  null safety/base/accepted-content fields; rejection cannot release a hold, validate
  a plan, create a version, supersede a sibling, or make the current plan executable.
- `PlanAdaptationProposal.proposedPlanVersionId`, the matching adaptation
  `PlanValidationEvent.planVersionId`, and the accepted successor
  `PlanVersionRecord.planVersionId` must be exactly equal. That reserved ID is unique,
  scope-bound, content-hash-bound, and cannot be reused by another proposal, initial
  selection, validation context, or plan version.
- Every reserved plan version and validation context has exactly one terminal
  validation result, enforced by a database unique constraint. Validation events use
  the shared aggregate revision/safety epoch, sequenced event envelope, scoped
  idempotency result, source-event dedupe, current Rule Spec version, and exact
  content/exposure-ledger hashes. Concurrent ACCEPT/REJECT callbacks cannot both win.
- `INITIAL_OPTION_SELECTION` requires `selectedOptionId` and forbids
  `adaptationProposalId`; `ADAPTATION_ACCEPTANCE` requires the inverse and binds the
  exact reviewed `proposedContentHash` plus immutable frame/block/session refs.
- Every hash uses the declared domain-separated preimage, canonicalization, schema,
  ordering, unit, Unicode, number, timezone-database, and resolved-boundary rules.
- Idempotency preflight first authenticates the caller to the scoped namespace and
  compares the request hash. An exact committed retry never mutates, reruns operation
  safety, or creates a second result; it returns the original result only when current
  read authorization permits disclosure. A different hash is rejected. A request
  without a committed result proceeds through fresh operation authorization, safety,
  hold, and aggregate checks in the mutation transaction.
- Consent, capability, guardian consent, scope, and Safety Gate are checked at both
  proposal creation and acceptance.
- Selection, proposal, and acceptance actors must hold the purpose-specific
  capability and a verified linked-coach identity in the same group as the athlete.
  These proposed capability names require downstream registry adoption under
  `OI-FA-PLAN-VERSION-BINDING-001`.
- Fixed race anchors cannot move automatically.
- The first pilot cannot automatically increase demand.

Initial selection is one target-owned atomic transaction: preflight idempotency,
recheck linked-coach authorization/guardian/consent/safety/no-active-hold, CAS the
shared aggregate and complete option-set revision, enforce one selection and one
initial version per run, then append selection, `SELECTED_PENDING_VALIDATION` plan
version, aggregate event, audit, outbox, and idempotency result. Any failure exposes
none of them. A separate validation transaction CAS-checks aggregate/safety/hold state,
validates the exact selected content and exposure ledger under the current Rule Spec,
enforces one terminal result, and appends validation, aggregate, audit, outbox, and
idempotency records atomically. Validation rejection creates `VALIDATION_REJECTED`,
never `VALIDATED_ACCEPTED`; replay returns the one committed result.

Adaptation rejection is a target-owned atomic non-execution transaction: preflight
idempotency, recheck scope, verified linked coach, `REJECT_ADAPTATION` authorization,
guardian/consent grant versions and revocation epochs, CAS the proposal's open terminal
state, then append the `REJECT` decision, aggregate/audit/outbox, and idempotency result
together. An active hold does not prevent proposal rejection, but remains unchanged.
Concurrent accept/reject permits one terminal decision; an exact authorized retry
returns the committed result and any other loser rolls back.

Adaptation acceptance is one target-owned atomic transaction:

1. run idempotency preflight and, for a new request, recheck scope, linked-coach
   `ACCEPT_ADAPTATION` authorization, guardian/consent grant versions and revocation
   epochs, fresh target-bound `GENERATION_ALLOWED` safety, and no active hold;
2. run fresh Rule Spec validation on the exact reviewed proposed content and exposure
   ledger under the current rule version, with one terminal validation constraint;
3. compare-and-swap aggregate revision, safety epoch, authorization revocation epoch,
   current predecessor version, base content hash, and reviewed proposed content hash;
4. enforce unique terminal decision per proposal and the database unique constraint
   `(tenantId, groupId, athleteId, predecessorPlanVersionId)` for accepted successors;
5. append accepted validation, decision, and validated successor plan version,
   supersede the predecessor and open sibling proposals, and append aggregate, audit,
   outbox, and idempotency result records together.

If step 2 rejects, a separate atomic rejection outcome appends
`RULE_VALIDATION_REJECTED`, `INVALIDATED_BY_RULE_VALIDATION`, aggregate/audit/outbox,
and the idempotency result; it creates no successor and supersedes neither the current
plan nor sibling proposals. Any other failure rolls back all five acceptance steps.
Proposal creation uses the corresponding
atomic `CREATE_ADAPTATION` authorization, safety, hold, idempotency, append, audit,
and outbox transaction. Frame/lineage, option-set formation, selection, hold
activation/release, and adaptation use the same no-partial-visibility rule.

### 10.3 Deterministic adaptation action mapping

| Trigger | Action |
|---|---|
| Safety/auth/scope stop | Immediate `PlanExecutionHoldActivation`; no selectable proposal |
| Accepted race, availability, or immovable-anchor change | `REBUILD_REMAINDER` |
| Explicit scoped coach request | Exact requested allowed action after validation |
| Provenance invalidation of a required source | `BLOCK_AND_REVIEW` |
| Missing required source that invalidates the remainder | `REBUILD_REMAINDER` |
| Missed MAIN without an explicit coach reschedule request | Preserve plan/outcome; no catch-up or compression |
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
`DAILY_LOG_AND_CHECKIN_SPEC`; `AB` means `APP_IMPLEMENTATION_BRIDGE`; `RS` means
`RULE_SPEC_D1_D9`; `JDD` means `JOURNAL_DELIGHT_AND_DECORATION_SPEC`; `AVD` means
`ANALYSIS_AND_VISUALIZATION_DATA_CONTRACT`; `DEC-SHADOW` means
`TO-DEC-ATHLETE-VISIBLE-SHADOW-2026-07-14-001`; `WO009A` means
`CODEX_WORK_ORDER_009.md` Task A.

Reason codes are non-sensitive system states, not medical or note-derived categories:

| Code | Projection-safe meaning |
|---|---|
| `FA_SCOPE_OR_SAFETY_BLOCK` | Operation unavailable; athlete/coach surfaces receive only generic blocked/paused state. |
| `FA_FRAME_CREATED` | Resolved local-civil frame proposed. |
| `FA_SOURCE_REJECTED` | Required structured source was not eligible; no private cause is disclosed. |
| `FA_COMPETITION_EXPOSURE` | Competition counted once in exposure ledger. |
| `FA_MAIN_COUNT_INVALID` | Proposed exposure count is outside the accepted pilot convention. |
| `FA_PLACEMENT_REVIEW` | Coach review is required before placement. |
| `FA_CANDIDATE_SET_CREATED` | Complete proposed option set created. |
| `FA_DUPLICATE_OPTION` | Candidate is not meaningfully distinct. |
| `FA_SELECTION_BLOCKED` | Selection unavailable; product output is generic. |
| `FA_OUTCOME_RECORDED` | Planned, completed, and experienced facts remain separate. |
| `FA_PLAN_ON_HOLD` | Execution paused; no detailed cause is product-visible. |
| `FA_ADAPTATION_ACCEPTED` | Reviewed successor committed atomically. |
| `FA_MEASURE_NOT_AGGREGATED` | Measure aggregation was unsafe or undefined. |
| `FA_MAPPING_SCHEMA_BLOCKED` | Projection contract cannot preserve identity. |
| `FA_STATS_SUPPRESSED` | Longitudinal output is unavailable pending policy. |
| `FA_ADAPTATION_PROPOSED` | Coach-reviewed change proposal created. |
| `FA_SHADOW_ACTIVE` | Disclosed non-executing comparison is active; real training remains coach-governed. |
| `FA_SHADOW_PAUSED` | Comparison needs review or eligible structured data; the athlete is not blamed. |
| `FA_SHADOW_COMPLETE` | Accepted comparison protocol finished; no safety, efficacy, or performance claim is implied. |

| ruleId | authorityClass | owner / version | applicability | requiredInputs | missingInputBehavior | output | reasonCodeRefs | evidenceSourceRefs | counterexampleOrFailureState | contractTestIds |
|---|---|---|---|---|---|---|---|---|---|---|
| `FA-R-001` | `PROPOSED_PENDING_OWNER_ACCEPTANCE` | AB + PSG / 0.3 | Every formation mutation; non-execution rejection uses the hold exception in FA-R-009 | scoped linked-coach identity, operation auth, consent/guardian versions, operation-scoped safety/hold state | block | eligible mutation or generic block | `FA_SCOPE_OR_SAFETY_BLOCK` | AB, PSG | mismatched scope, link, grant, purpose, epoch, expiry, stale gate, or active hold on an execution-enabling operation | 001-004, 021-023, 035-040, 067-069, 075-076, 081-083, 096 |
| `FA-R-002` | `PROPOSED_PENDING_OWNER_ACCEPTANCE` | MCM + Formation / 0.3 | Eligible pilot frame | timezone DB, resolved boundaries, frame-head CAS, anchor | clarification | immutable local-civil frame and lineage event | `FA_FRAME_CREATED` | DEC-001, MCM | ambiguous boundary, UTC 228-hour assumption, fork, or carry-over ambiguity | 019-020, 048-050, 073-074 |
| `FA-R-003` | `PROPOSED_PENDING_OWNER_ACCEPTANCE` | DLC + AB + PSG / 0.3 | Every source, safety, eligibility, reason, and governance ref | scope/content-hash-bound ancestry and governance graph | reject | privacy-eligible source or opaque safety-only ref | `FA_SOURCE_REJECTED` | DLC, WO009A, AB, PSG | private/raw-text laundering, substitution, detailed reason, missing governance, or cycle | 011-012, 017-018, 031-034, 055-057, 080, 084-086 |
| `FA-R-004` | `PROPOSED_PENDING_OWNER_ACCEPTANCE` | RS + SC + PG / 0.3 | Competition planning/accounting | plan kind, role, demand, classifier label, exposure ledger | reject | one competition exposure without label rewrite | `FA_COMPETITION_EXPOSURE` | DEC-001, SC, RS | rewrite COMPETITION, invent RACE, omit from D1/D2, or double count | 005, 007, 024, 065-066 |
| `FA-R-005` | `PROPOSED_PENDING_OWNER_ACCEPTANCE` | Formation + PG / 0.3 | Every feasible option | normalized exposure ledger | reject option | exactly 2 or 3 planned MAIN exposures | `FA_MAIN_COUNT_INVALID` | DEC-001 | fewer than 2, more than 3, or component double count | 001, 005, 007, 064-066 |
| `FA-R-006` | `COACH_DECISION_SUPPORT` | Coach Hojune / 0.3 | After coach rule-set acceptance | fixed anchors, exposure classes, multidimensional intervening load, response, intent | clarification | canonical base schedule | `FA_PLACEMENT_REVIEW` | DEC-001, evidence ledger | elapsed-only clearance, unsafe catch-up, or unaccepted feasibility rule | 008, 025, 055, 063-064 |
| `FA-R-007` | `PROPOSED_PENDING_OWNER_ACCEPTANCE` | Formation + PG / 0.3 | Accepted taxonomy and canonical base | canonical base, registered transforms, contextual triggers, hash envelope | clarification | ordered 2-or-3 option set and stable fingerprints/IDs | `FA_CANDIDATE_SET_CREATED` | DEC-001, PG | missing conservative, collision, duplicate, label-only transform, or fewer than 2 feasible | 001, 009, 026-027, 052, 054, 061-063, 078, 093 |
| `FA-R-008` | `PROPOSED_PENDING_OWNER_ACCEPTANCE` | Formation + PG / 0.3 | Every option set | normalized options and total comparator | reject duplicate/collision | meaningful difference set | `FA_DUPLICATE_OPTION` | PG | label/rationale-only difference or input-order tie | 009, 052, 062 |
| `FA-R-009` | `PROPOSED_PENDING_OWNER_ACCEPTANCE` | PG + AB + PSG / 0.3 | Selection, proposal, validation, and acceptance; `REJECT_ADAPTATION` rechecks authority but may execute while preserving an active hold | linked-coach auth, consent/guardian, scope, safety epoch, operation-scoped hold rule, and aggregate revisions | hard hold except for non-execution rejection | allowed operation or scoped hold | `FA_SELECTION_BLOCKED` | PG, AB, PSG | stale aggregate, wrong-purpose, cross-scope, revoked/expired grant, or active hold on an execution-enabling operation | 021-023, 035-043, 051, 067-076, 081-083, 096 |
| `FA-R-010` | `PROPOSED_PENDING_OWNER_ACCEPTANCE` | PG + DLC / 0.3 | Session outcome ingestion | accepted plan version, completion and response refs, cutoff | retain missing/reject stale | immutable paired facts | `FA_OUTCOME_RECORDED` | DLC, evidence ledger | null completed ref, future response, stale ref, overwrite, or catch-up | 010, 013, 058-060, 064 |
| `FA-R-011` | `PROPOSED_PENDING_OWNER_ACCEPTANCE` | PSG + PG + AB / 0.3 | Any post-generation safety/auth change | shared aggregate, sequenced causes, target-bound block refs | hard hold | append-only multi-cause hold projection | `FA_PLAN_ON_HOLD` | PSG, PG, AB | coach override, lost cause, stale release, or unheld executable version | 014, 021-023, 039-043, 069-070, 083-084 |
| `FA-R-012` | `PROPOSED_PENDING_OWNER_ACCEPTANCE` | PG + AB + PSG / 0.3 | Selection, proposal, validation, rejection, and acceptance | canonical hashes, aggregate/base revisions, scope, linked auth, operation-scoped safety/hold inputs, idempotency | reject/rollback | one terminal decision and at most one validated append-only origin-bound version; rejection preserves any hold | `FA_ADAPTATION_ACCEPTED` | PG, AB, PSG | ID substitution, replay, altered payload, validation/decision race, fork, stale hash, partial commit, cross-scope ref, or rejection that releases/bypasses hold | 028-030, 044-047, 053, 069, 071-079, 082-083, 091-096 |
| `FA-R-013` | `PROPOSED_PENDING_OWNER_ACCEPTANCE` | PG + Formation / 0.3 | Component/measure preservation and aggregation | scope, parent, key, semantics, fraction | no aggregation | deduplicated typed component/measure set | `FA_MEASURE_NOT_AGGREGATED` | DEC-001 | parent/component copied total or unaccepted load feasibility | 006, 016, 054, 063 |
| `FA-R-014` | `PROPOSED_PENDING_OWNER_ACCEPTANCE` | MCM + product projection owner / 0.3 | Seven-day and audience projection after schema patch | frame/block/version/session identity, resolved boundaries, audience, action state, visual grammar | block projection binding | identity-preserving accessible projection | `FA_MAPPING_SCHEMA_BLOCKED` | MCM | fixed D-5, missing version, slot mismatch, color/hover-only meaning, or composite collapse | 015, 050, 071-072, 074, 087-090 |
| `FA-R-015` | `HOLD_INSUFFICIENT_EVIDENCE` | Research and privacy target owners / 0.3 | Longitudinal context | accepted sample/privacy/redaction/retention policies | suppress | null counts/statistics, empty refs, no influence | `FA_STATS_SUPPRESSED` | evidence ledger | count, source list, percentile, or unaccepted Physio result influences candidate | 025, 056-057 |
| `FA-R-016` | `COACH_DECISION_SUPPORT` | Coach Hojune / 0.3 | Non-safety adaptation trigger | valid outcome, current accepted plan, accepted coach rules | review | deterministic proposal action | `FA_ADAPTATION_PROPOSED` | DEC-001, PG | threshold invented, stale response, or missed MAIN compressed | 010, 013, 028, 058-060, 064 |
| `FA-R-017` | `PROPOSED_PENDING_OWNER_ACCEPTANCE` | Product + AB + JDD + AVD / 0.4 | Shadow enrollment, generation, progress, pause, completion, and withdrawal | separate consent, immutable source/frame state, non-executing candidate result, linked-coach review, privacy-safe progress refs | block or show paused state | athlete-visible non-executing status plus safe progress projection | `FA_SHADOW_ACTIVE`, `FA_SHADOW_PAUSED`, `FA_SHADOW_COMPLETE` | DEC-SHADOW, AB, DLC, JDD, AVD | hidden operation, bundled consent, real-plan mutation, private-note signal, fake completion, coercive reward, inaccessible progress, or withdrawal penalty | 097-104 |

---

## 11A. Athlete-Visible Shadow Pilot Contract

Shadow operation is a disclosed, non-executing comparison period. It is not a
hidden experiment and not a quiet release of automatic coaching. The athlete keeps
following the real linked-coach plan while TrainOracle forms a separate candidate
from an immutable eligible snapshot for later comparison.

The owner-confirmed product boundary is recorded as
`TO-DEC-ATHLETE-VISIBLE-SHADOW-2026-07-14-001`. The exact three-frame protocol,
monitoring cadence, incentives, and stop criteria remain proposed until the pilot
protocol and owning target contracts accept them.

```yaml
athlete_visible_shadow_pilot:
  mode: ATHLETE_VISIBLE_NON_EXECUTING_COMPARISON
  real_training_authority: LINKED_HUMAN_COACH_ONLY
  generated_candidate:
    athlete_execution_allowed: false
    calendar_write_allowed: false
    notification_as_instruction_allowed: false
    may_replace_or_edit_real_plan: false
    may_claim_safety_or_efficacy: false
  enrollment:
    separate_plain_language_notice_required: true
    separate_active_consent_purpose: SHADOW_PILOT_DATA_USE
    bundled_with_base_journal_service: forbidden
    refusal_keeps_base_journal_available: true
    withdrawal_available_at_any_time: true
  notice_must_explain:
    - what_is_being_compared
    - that_the_shadow_candidate_does_not_govern_training
    - structured_data_categories_used
    - private_and_raw_note_exclusions
    - proposed_duration_and_current_progress
    - coach_review_role
    - how_to_pause_withdraw_and_request_deletion
    - no_medical_safety_or_performance_guarantee
  data_boundary:
    eligible_structured_EXPLICIT_data_only: true
    PRIVATE_SELF_ONLY_presence_and_content: zero_signal
    raw_ANALYZABLE_TRAINING_NOTE_plan_or_reward_use: forbidden
    missing_values_may_be_imputed_favorably: false
  proposed_sequence:
    complete_frames: 3
    frame_duration: LOCAL_CIVIL_9_DAYS_12_HOURS
    production_execution_during_sequence: forbidden
  progress_projection:
    states:
      - NOT_STARTED
      - ACTIVE_FRAME_1_OF_3
      - ACTIVE_FRAME_2_OF_3
      - ACTIVE_FRAME_3_OF_3
      - PAUSED_NEEDS_REVIEW
      - COMPLETE
      - WITHDRAWN
    completion_requires:
      - immutable_shadow_candidate_or_typed_no_candidate_result
      - linked_coach_review_record
      - no_privacy_authorization_or_safety_contract_violation
    display_requires:
      - number_and_text_not_color_only
      - completed_check_mark_plus_label
      - actual_date_boundary
      - simulation_not_execution_label
      - accessible_middle_school_language
  analysis_projection:
    descriptive_development_allowed: true
    athlete_display_requires_sample_count_missingness_and_uncertainty: true
    causal_or_performance_claim: forbidden
    real_plan_influence_before_separate_acceptance: forbidden
  delight_binding:
    owner: JOURNAL_DELIGHT_AND_DECORATION_SPEC
    safe_recording_check_or_sticker_allowed: true
    frame_progress_marker_is_informational: true
    training_load_speed_pain_silence_or_consent_reward: forbidden
    withdrawal_penalty_or_earned_item_clawback: forbidden
```

### 11A.1 Plain-language projection intent

Final copy remains a product/design decision, but every implementation must preserve
the following meaning at explanation levels 1 and 2:

| Surface element | Required plain meaning |
|---|---|
| Title | "내 훈련 리듬을 알아가는 중" or an equivalent non-clinical phrase. |
| One-line explanation | TrainOracle is comparing a draft with the real coach plan; the draft does not change today's training. |
| Progress | "1/3 비교 완료" with a check mark, date, and text label. |
| Paused state | More review or eligible structured data is needed; the athlete did nothing wrong. |
| Completion | The comparison period finished; show what was compared and uncertainty, not a success/performance claim. |
| Exit | Pause or leave at any time without losing base journaling or being punished. |

### 11A.2 Cross-spec ownership

| Concern | Owning contract | Formation use |
|---|---|---|
| Consent, revocation, retention, deletion, guardian scope | `APP_IMPLEMENTATION_BRIDGE.md` and `ATHLETE_PROFILE_SPEC.md` | Requires an accepted `SHADOW_PILOT_DATA_USE` purpose; does not invent persistence. |
| Private/analyzable memo boundary and structured daily sources | `DAILY_LOG_AND_CHECKIN_SPEC.md` | Consumes eligible structured refs only; private memo is byte-identical zero-signal. |
| Descriptive trends, missingness, sample counts, uncertainty | `ANALYSIS_AND_VISUALIZATION_DATA_CONTRACT.md` | May project accepted descriptive comparison only; no causal or plan authority. |
| Checks, stickers, streaks, and collection safety | `JOURNAL_DELIGHT_AND_DECORATION_SPEC.md` | Delegates all unlock meaning; frame progress itself is not training reward. |
| Candidate rationale and audience redaction | `PLAN_OUTPUT_RATIONALE_PRIVACY_SPEC.md` | Uses only athlete-authorized plain explanation and privacy-safe reason codes. |
| Frame/calendar identity and dates | `MICROCYCLE_AND_CALENDAR_MAPPING_SPEC.md` | Shows the shadow boundary without writing an executable plan to the real calendar. |

This section narrows athlete transparency and product experience. It does not close
`OI-FA-PILOT-PROTOCOL-001`, authorize a three-frame run, or bypass any canonical
blocker. The proposed sequence may start only after the remaining protocol details
and exact target bindings are accepted.

---

## 12. Evidence Ledger

| Source | Source type | Supports | Does not support | Applicability |
|---|---|---|---|---|
| Haugen et al., 2021, https://pubmed.ncbi.nlm.nih.gov/34021488/ | Narrative review | 800/1500 literature and practice use varied aerobic, anaerobic, strength, power, and plyometric work | Exact taxonomy, dose, frequency, 9.5-day superiority, or universal 72-hour rule | Event-relevant narrative review; reviewed literature/practice material is male-biased |
| Dobbin et al., 2017, https://pubmed.ncbi.nlm.nih.gov/28002177/ | Primary empirical study, n=8 subelite soccer players | Elapsed time alone is insufficient: some markers remained altered through 72 hours after two prolonged intermittent-running bouts | That every athlete is unrecovered at 72 hours or any 1500 m recovery threshold | Small, indirect team-sport sample; caution only |
| Bourdon et al., 2017, https://pubmed.ncbi.nlm.nih.gov/28463642/ | Consensus statement | Internal and external load are distinct monitoring concepts | Validation of this exact vector, its bands, aggregation, weighting, ranking, fatigue inference, or prediction | General monitoring terminology and expert consensus |
| Haddad et al., 2017, https://pubmed.ncbi.nlm.nih.gov/29163016/ | Review | A session-RPE rating is practical; an sRPE load method is a separate duration-linked derived measure | Validation of this schema's respiratory/local-muscular fields or adaptation thresholds | Multi-sport review; does not by itself require a multidimensional product policy |
| Mølmen et al., 2019, https://pubmed.ncbi.nlm.nih.gov/31802956/ | Systematic review and meta-analysis | Block periodization is a contextual organizational approach | Universal superiority, this rolling 9.5-day model, or 1500 m-specific timing | Six small, generally low-quality endurance studies; secondary context only |
| Inoue et al., 2022, https://pubmed.ncbi.nlm.nih.gov/35244801/ | Systematic review and meta-analysis | Overall and moderate/hard coach-athlete RPE agreement can coexist with easy-session disagreement | Systematic mismatch or merging planned and experienced facts | Supports separate provenance, not an assumed direction of disagreement |
| Petré et al., 2021, https://pubmed.ncbi.nlm.nih.gov/33751469/ | Systematic review and meta-analysis | Training status and same/separate-session context can affect lower-body 1RM development | Broad running-performance, readiness, recovery, or universal sequence claims | Narrow lower-body 1RM outcome |
| Llanos-Lagos et al., 2024, https://pubmed.ncbi.nlm.nih.gov/38165636/ | Systematic review and meta-analysis | Strength and plyometric methods can affect running economy differently | Acute recovery, universal modality ranking, spacing, dose, or athlete-specific prescription | Effects vary by duration, test speed, population, and evidence certainty |

Only one of these eight PubMed-indexed sources is a primary empirical study. The
others are narrative review, consensus, or systematic review/meta-analysis. The
single-score risk control is an `[INFERENCE]` from the need to preserve distinct
facts, not a direct finding that validates this schema.

The cited evidence is compatible with representing multiple training modalities and
storing planned, completed, subjective, and external measures separately. This
supports model structure only. It does not validate the 9.5-day frame, 2-3 MAIN
count, approximate spacing, candidate ordering or transforms, readiness/adaptation
thresholds, injury prediction, physiological safety, or performance efficacy. The
one-athlete pilot evaluates workflow feasibility and decision usefulness and
prospectively records predefined adverse/safety events; it cannot establish safety
or efficacy.

---

## 13. Contract Test Vectors

These are future contract tests, not executed runtime evidence. All 104 vectors test
policy, data, privacy, authorization, identity, deterministic arbitration, and
fail-closed mechanics. They do not validate physiological efficacy, recovery
adequacy, performance benefit, injury-risk reduction, or safety.

| ID | Scenario | Expected result |
|---|---|---|
| `FA-TC-001` | Eligible pilot, accepted rule set, no contextual trigger | Exactly BALANCED and CONSERVATIVE in stable order |
| `FA-TC-002` | `D9_ACTIVE` before formation | No frame option or session draft |
| `FA-TC-003` | `D9_UNKNOWN` before formation | No frame option or session draft |
| `FA-TC-004` | Legacy provenance on required prior MAIN | `NEEDS_COACH_CLARIFICATION` |
| `FA-TC-005` | Race anchor inside frame | Competition remains fixed and counts one MAIN exposure without inventing an unaccepted class |
| `FA-TC-006` | Running, plyometric, strength in one session | One session with typed components and preserved vector |
| `FA-TC-007` | Warm-up, race, cool-down components | One MAIN exposure event, not three |
| `FA-TC-008` | 72 elapsed hours with high intervening demand | No automatic readiness clearance |
| `FA-TC-009` | Labels differ but normalized sessions match | Duplicate rejected |
| `FA-TC-010` | Experienced load differs from plan | Plan remains unchanged; comparison is `NOT_COMPARABLE` |
| `FA-TC-011` | Private memo written | No source, trigger, hash, presence event, rationale, or audit payload |
| `FA-TC-012` | Raw analyzable note exists | Raw text excluded everywhere in formation/adaptation |
| `FA-TC-013` | Response missing | Missing remains missing; no favorable action |
| `FA-TC-014` | Safety changes after selection | Immediate `ON_SAFETY_HOLD`; optional replan only after fresh validation |
| `FA-TC-015` | Calendar week cuts frame | Binding blocked until projection preserves frame/block/version/session/hash/boundary/watermark identity |
| `FA-TC-016` | Whole duration copied to three components | Aggregation rejected |
| `FA-TC-017` | Source has private-memo ancestor | Source rejected without revealing why to candidate logic |
| `FA-TC-018` | Safety result came from analyzable-note D9 evaluation | May block only; detail cannot form/rank/explain |
| `FA-TC-019` | Frame crosses DST forward transition | End is local +9d12h; UTC elapsed need not be 228h |
| `FA-TC-020` | Accepted contiguous successor or re-anchor | Typed lineage event determines relation/effective frame; prior frame immutable |
| `FA-TC-021` | Consent revoked between generation and selection | Atomic recheck creates hard hold; no selection |
| `FA-TC-022` | Safety Gate becomes stale during selection | Atomic operation fails closed |
| `FA-TC-023` | Cross-tenant source introduced | Entire operation rejected and audited without payload |
| `FA-TC-024` | Completed classifier label is COMPETITION | Label remains COMPETITION and the normalized exposure ledger counts exactly one MAIN |
| `FA-TC-025` | Longitudinal sample policy absent | Statistics null/suppressed and no candidate influence |
| `FA-TC-026` | Race plus a synthetic owner-accepted registered recovery-policy trigger and feasible distinct competition transform | Third is COMPETITION_PREP; recovery constraints apply before arbitration to all candidates; no physiology is implied |
| `FA-TC-027` | Conservative transform is infeasible | Stop before contextual evaluation with `NEEDS_COACH_CLARIFICATION` |
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
| `FA-TC-055` | Prior MAIN or intervening history is silently unavailable | Typed `ABSENT`, `STALE`, or `EXCLUDED` state is required and fails closed pending policy |
| `FA-TC-056` | Unaccepted Physio Source Trust result is supplied | Source kind rejected until Formation acceptance and version guard exist |
| `FA-TC-057` | Longitudinal context is suppressed | Counts/statistics are null, source refs empty, no history-derived artifact or product signal exists |
| `FA-TC-058` | COMPLETED/PARTIAL/CHANGED outcome has null completed-session ref | Outcome rejected |
| `FA-TC-059` | NOT_YET_DUE contains experienced values or refs | Outcome rejected; no future response is fabricated |
| `FA-TC-060` | Response/readiness ref is stale, excluded, or outside accepted-version cutoff | It cannot influence adaptation |
| `FA-TC-061` | BALANCED and contextual option are feasible but CONSERVATIVE is not | Stop before contextual evaluation with `NEEDS_COACH_CLARIFICATION` |
| `FA-TC-062` | Two sessions tie on all comparator keys or duplicate stable identity | Collision/duplicate input rejected; permutation cannot change output |
| `FA-TC-063` | MAIN move maximizes gap but violates intervening mechanical/neural/strength constraints | Move infeasible; no candidate until accepted multidimensional feasibility passes |
| `FA-TC-064` | A planned MAIN is missed before the next MAIN | Record MISSED; no automatic catch-up, compression, or back-to-back move |
| `FA-TC-065` | Competition is counted before exposure-class registry acceptance | Counts once with null/pending class; `RACE` is not invented |
| `FA-TC-066` | Competition reaches Rule D1/D2 validation | Target binding must consume normalized exposure ledger or remain blocked; race cannot disappear |
| `FA-TC-067` | Selector has capability but no verified linked-coach decision | Selection denied |
| `FA-TC-068` | Same-group non-linked actor has generic selection capability | Selection denied without leaking plan payload |
| `FA-TC-069` | Selection and safety revocation cross a deterministic barrier | Shared aggregate CAS permits only a held/non-executable outcome or a selection preceding a recorded hold; never executable-unheld |
| `FA-TC-070` | Simultaneous, duplicate, late, and independently released hold causes arrive | One sequenced stream deduplicates sources; target stays held while any cause is active |
| `FA-TC-071` | Coach selects a complete option set | Initial version is `SELECTED_PENDING_VALIDATION` and cannot execute/project |
| `FA-TC-072` | Rule validation rejects selected content | `VALIDATION_REJECTED`; no accepted/executable version exists |
| `FA-TC-073` | Two re-anchors race from one frame-head revision | Unique successor/head CAS allows one; loser rolls back without partial lineage |
| `FA-TC-074` | Re-anchor occurs at a DST fold with displaced sessions | Resolved effective boundary equals successor start and every displaced session has explicit disposition |
| `FA-TC-075` | Exact committed idempotent retry occurs after operation authorization revocation | No mutation/recheck; prior result is disclosed only with current read authorization |
| `FA-TC-076` | Same scoped key and hash are submitted concurrently | One durable `IdempotencyResult`; all exact authorized retries resolve to it |
| `FA-TC-077` | Accept/reject decisions race and sibling proposals remain open | One terminal decision; accepted successor atomically supersedes open siblings |
| `FA-TC-078` | Two independent runtimes hash a golden candidate fixture including null/default/unit/DST cases | Exact preimage bytes and SHA-256 digest match |
| `FA-TC-079` | Failure injected after each frame/option/selection/hold/adaptation append step | No partial visibility; aggregate, audit, outbox, and idempotency result commit together or not at all |
| `FA-TC-080` | Eligible source content is substituted after eligibility decision | Content-hash/lineage-edge mismatch rejects the source |
| `FA-TC-081` | Guardian grant is active for another operation or data category | Authorization denied |
| `FA-TC-082` | Guardian/athlete revocation races selection or adaptation commit | Grant-version/revocation-epoch serialization yields deterministic allow-before-revoke or deny; no stale commit |
| `FA-TC-083` | Hold release presents clearance issued before activation, for another target/snapshot, or already expired | Release rejected; target remains held |
| `FA-TC-084` | Note-derived D9 block contains detailed medical/category reason internally | Product/coach/plan receives only generic paused/blocked state with no origin, timing, hash, or audit correlation |
| `FA-TC-085` | Compare no memo with a PRIVATE_SELF_ONLY memo | Network, plan, analysis, sync, coach, reward, telemetry, cache, hash, and audit outputs are byte-identical |
| `FA-TC-086` | Required source/plan/audit record lacks accepted governance envelope | Persistence and formation blocked |
| `FA-TC-087` | Projection fixes a single MAIN at D-5 | Projection rejected as legacy; accepted plan version controls 2-3 exposure display |
| `FA-TC-088` | Meaning is available only by color or hover | Projection rejected; icon/code/text and touch/print/screen-reader equivalents required |
| `FA-TC-089` | Composite run+plyometric+strength session is collapsed to one dominant system or multiple sessions | Projection rejected; one session with ordered typed components preserved |
| `FA-TC-090` | Audience requests explanation levels 1-5 | Only authorized level/fields project; athlete plain language and technical trace remain distinct |
| `FA-TC-091` | Coach accepts an adaptation whose exact proposed content fails fresh Rule Spec validation | Append validation rejection and proposal invalidation only; no successor or sibling supersession |
| `FA-TC-092` | Rule Spec version or exposure-ledger hash changes between adaptation review and commit | Stale acceptance rejected; fresh exact validation required |
| `FA-TC-093` | Two runtimes derive planOptionId from the same run ID and candidate fingerprint golden fixture | Exact `PlanOptionIdHashEnvelope` preimage bytes and SHA-256 digest match |
| `FA-TC-094` | Concurrent validation ACCEPT/REJECT callbacks and duplicate replay target one reserved version | Shared aggregate/unique terminal constraint commits one result; exact replay returns it without duplicate transition |
| `FA-TC-095` | Proposal reserves version A, validation targets A, but acceptance attempts successor B or reuses A elsewhere | Equality/unique reservation invariant rejects substitution or reuse; no successor commits |
| `FA-TC-096` | Authorized proposal rejection races acceptance, is replayed, or occurs while target is held | One terminal decision; rejection appends no version/validation/hold release/sibling supersession; exact retry returns prior result |
| `FA-TC-097` | Athlete has no active separate `SHADOW_PILOT_DATA_USE` consent | No shadow generation, analysis, progress, or reward event; base journal remains available |
| `FA-TC-098` | Enrollment copy hides simulation status, omits data categories/exit, or implies AI controls training | Enrollment blocked; no consent or shadow state created |
| `FA-TC-099` | Shadow candidate attempts to write the real calendar, notify an instruction, or replace the linked-coach plan | Mutation rejected and audited without athlete payload; real plan remains unchanged |
| `FA-TC-100` | UI attempts to mark a frame complete without a typed candidate/no-candidate result and linked-coach review | Progress remains paused/incomplete with plain non-blaming copy |
| `FA-TC-101` | Rest-day or injury/pain check-in is the day's eligible structured record | Safe journal check eligibility matches a training-day record; load, pace, and pain silence add no reward advantage |
| `FA-TC-102` | Identical structured sources are compared with no memo versus a `PRIVATE_SELF_ONLY` memo | Shadow candidate, analysis, progress, reward, telemetry, and audit outputs are byte-identical |
| `FA-TC-103` | Athlete withdraws during frame 2 | No new shadow processing; real plan and base journal continue; no shame/penalty/clawback; accepted retention/deletion policy governs existing records |
| `FA-TC-104` | Progress is viewed on touch, grayscale/print, and screen reader | Frame number, text state, check label, dates, simulation status, and exit remain perceivable without color or hover |

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
- create a complete option set and selection through the shared aggregate revision
- use `SELECTED_PENDING_VALIDATION -> VALIDATED_ACCEPTED | VALIDATION_REJECTED`;
  selection alone cannot execute
- adopt the domain-separated hash envelope, durable idempotency result, hold stream,
  linked-coach binding, governance envelope, and no-partial-visibility transactions
- add `NEEDS_COACH_CLARIFICATION` for missing formation context
- keep coach selection, Safety Gate, Rule Spec validation, and audit ownership

`RULE_SPEC_D1_D9` must consume a target-accepted `MainExposureLedgerRecord` or exact
adapter for D1/D2. Both training MAIN and competition exposure must be visible without
rewriting Session Classifier's `COMPETITION` label. Until that binding is accepted,
post-selection Rule validation is blocked.

`MICROCYCLE_AND_CALENDAR_MAPPING_SPEC.CalendarSessionProjection` must add non-null
`frameId`, `blockId`, `planVersionId`, immutable session identity, frame content hash,
resolved local boundary/tzdb identity, projection watermark, and a target-accepted
crosswalk for Formation `AM | PM | DOUBLE | FLEX` versus mapping slots. It projects
only `VALIDATED_ACCEPTED` versions. This requires a target schema patch, target issue
recount, timezone/re-anchor tests, and runtime evidence. Mapping remains projection-only.

`APP_IMPLEMENTATION_BRIDGE` must own and accept operation capabilities, exact consent
purposes, linked-coach/guardian grant versions, scoped idempotency namespace,
aggregate/CAS primitives, records, endpoints, tenant isolation, append-only storage,
governance envelopes, audit/outbox, and uniqueness constraints. Formation states
target requirements; it does not create a parallel backend owner.

Before an athlete-visible shadow run, App Bridge must also accept a separate
`SHADOW_PILOT_DATA_USE` consent purpose, refusal-with-base-journal behavior,
revocation/withdrawal processing, progress-state storage, retention/deletion, and
guardian handling. `JOURNAL_DELIGHT_AND_DECORATION_SPEC` must accept the exact safe
check/sticker thresholds without rewarding consent, continued enrollment, training
load, speed, favorable reports, or silence about pain. `ANALYSIS_AND_VISUALIZATION_DATA_CONTRACT`
must accept the descriptive shadow comparison projection with sample count,
missingness, uncertainty, and no causal or plan authority.

`PLAN_SAFETY_GATE_SPEC` must own a stable, versioned, expiring, target-bound
`SafetyBlockRef` materialization with opaque note-derived blocking. The tracked D9/RVE
implementation currently treats `D9_CLEARED` as nonblocking and has positive contract
coverage for plan-draft creation from that path. That evidence is real but conflicts
with this proposed note-safety boundary; it must be patched and re-evidenced before
Formation source acceptance.

`DAILY_LOG_AND_CHECKIN_SPEC.md` remains input/privacy owner. Formation consumes only
eligible structured fields under the closed source contract. No raw note or private
memo metadata reaches plan records. Daily Log must also bind planned-session facts to
the accepted plan-version lineage.

Product projection remains blocked pending a target-owned contract for audience,
linked-coach action state, youth/plain-language glossary, five explanation levels,
fatigue-first paired facts without a single readiness scalar, composite encoding,
planned/completed/experienced separation, accessible non-color/hover-only meaning,
and privacy copy. Existing design files that prescribe fixed D-5, color/hover-only
states, dominant-system MIXED collapse, or "AI is the coach" are target conflicts,
not authority for this draft.

No downstream patch is authorized by this draft alone.

---

## 15. Open Issues

| ID | Priority | Canonical blocking | Status | Summary | Resolution needed |
|---|---|---:|---|---|---|
| `OI-FA-COACH-RULESET-001` | P1 | YES | OPEN | Phase placement, exposure classes, option taxonomy, race/taper/recovery rules, missed-MAIN accounting, re-anchor carry-over, sliding-window versus named-frame semantics, progression, and exceptions are not accepted. | Owner accepts or revises versioned registries, defines no-catch-up and cross-boundary accounting, and approves failure states/tests. |
| `OI-FA-LOAD-COMPONENT-001` | P1 | YES | OPEN | Component allocation, measure units, and whole-session intensity mapping are unresolved. | Accept registry, allocation, dedupe, and conflict behavior. |
| `OI-FA-MINIMUM-EVIDENCE-001` | P1 | YES | OPEN | Required history by frame type, freshness, typed absence/staleness, Physio-source acceptance, statistical privacy, and suppression policies are unresolved. | Accept pilot thresholds/source versions or keep sources rejected and statistics/counts/refs fully suppressed. |
| `OI-FA-PLAN-VERSION-BINDING-001` | P1 | YES | OPEN | Plan Generator/App Bridge lack complete option sets, linked selection, shared aggregate/safety epochs, validation lifecycle, sequenced holds, durable idempotency, canonical preimages, atomicity, and adaptation records. | Owning targets accept exact extensions, patch/recount, add database constraints/outbox, and publish concurrency/hash fixtures. |
| `OI-FA-PILOT-PROTOCOL-001` | P1 | YES | OPEN | Athlete visibility, separate participation, and non-executing progress meaning are narrowed by `DEC-SHADOW`; exact duration acceptance, baseline, feasibility/usefulness metrics, adverse/safety event recording, intervention rules, abort/stop criteria, monitoring cadence, and target bindings remain unresolved. | Accept a prospective athlete-visible protocol that does not claim safety or efficacy before pilot execution. |
| `OI-FA-CALENDAR-SCHEMA-BINDING-001` | P1 | YES | OPEN | Calendar lacks frame/block/version/session/hash/boundary/watermark identity and a DOUBLE/FLEX slot crosswalk. | Patch mapping schema, recount, and add accepted-only DST/re-anchor/projection tests. |
| `OI-FA-UPSTREAM-SAFETY-PRIVACY-BINDING-001` | P1 | YES | OPEN | Safety Gate cannot materialize the required stable target-bound opaque ref, and current D9/RVE runtime positively encodes note-derived CLEARED as nonblocking. | Patch owning contracts/runtime so analyzable-note origin can emit only opaque blocking/unknown/stale state, then re-run privacy/safety evidence. |
| `OI-FA-RULE-CLASSIFIER-EXPOSURE-BINDING-001` | P1 | YES | OPEN | Formation counts competition as MAIN exposure while Rule D1/D2 consume MAIN-only semantics and Session Classifier preserves COMPETITION. | Bind Rule D1/D2 to a normalized exposure ledger/adapter without rewriting classifier labels. |
| `OI-FA-PRODUCT-PROJECTION-001` | P1 | YES | OPEN | Authority/action state, five explanation levels, fatigue-first paired facts, composite sessions, accessibility, and current design conflicts are unresolved. | Product/design owners accept an audience-aware projection contract and replace fixed D-5, color/hover-only, dominant-MIXED, and AI-coach conflicts. |
| `OI-FA-RECORD-GOVERNANCE-001` | P1 | YES | OPEN | Source/safety/plan/hold/adaptation/audit records lack accepted access, retention, youth age-out/deletion, revocation, legal-hold, key-erasure, and minimization policy. | Accept governance envelopes and enforcement tests before persistence. |
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
| Proposed candidate count, precedence, IDs, sorting, collision rejection, and fallback are explicit | PASS |
| Planned, completion, and experienced facts remain separate | PASS |
| Longitudinal statistics are held and suppressed | PASS |
| Private/raw-note content and metadata cannot enter plan logic | PASS |
| Safety/auth requirements include a shared aggregate, sequenced multi-cause holds, and non-overridable state | PASS |
| Selection/adaptation target requirements include validation lifecycle, scope, append-only records, CAS, atomicity, and durable idempotency | PASS |
| Calendar identity claim is blocked pending schema patch | PASS |
| Evidence types and one-athlete safety/efficacy limits are explicit | PASS |
| Athlete-visible shadow operation is disclosed, non-executing, withdrawable, and separated from coercive reward | PASS |
| All 104 vectors are labeled policy mechanics rather than physiology validation | PASS |
| No production, app, canonical, or runtime claim is made | PASS |
| Open issue count is 11 and canonical blocker count is 10 | PASS |
| Final marker is the final line | PASS |

[DRAFT_COMPLETE]
