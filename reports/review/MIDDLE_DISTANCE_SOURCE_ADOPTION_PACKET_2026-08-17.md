# MIDDLE_DISTANCE_SOURCE_ADOPTION_PACKET_2026-08-17.md

document_metadata:
  doc_id: MIDDLE_DISTANCE_SOURCE_ADOPTION_PACKET_2026-08-17
  title: 800m, 1500m, 3000m same-event source adoption packet
  version: 1.0
  round: RT1
  status: SOURCE_ACCEPTED_DRAFT_FOR_RUNTIME_BINDING
  owner: TrainOracle specification governance
  runtime_authority: false
  selected_templates_total: 3
  runtime_active_templates_total: 0
  open_issues_total: 3
  canonical_blocking_count: 3

## 1. Decision boundary

This packet accepts three exact sessions as working-source drafts. It does not
activate them. Runtime activation requires a trusted manifest decision,
component hashes, deterministic tests, safety-gate tests and public browser
evidence. Source protocol and TrainOracle adaptation remain separate; selecting
one value from a source range is an explicit product decision, not a universal
scientific prescription.

## 2. Shared contract

shared_contract:
  candidateEventGroup: MIDDLE_DISTANCE
  allowedExperienceBands: [EXPERIENCED]
  populationApplicability: YOUTH_AND_ADULT_SAME_CRITERIA_NO_AGE_DOSE_BRANCH
  anchorRequirements: [CURRENT, SAME_EVENT, CURRENT_CAPABILITY, EXPLICIT_SELECTION]
  trainingEligibilityRule: AGE_SEX_AND_SCHOOL_DIVISION_DO_NOT_CHANGE_DOSE
  processingAuthorizationRule: GUARDIAN_PRIVACY_AND_ACCOUNT_RULES_REMAIN_SEPARATE
  safetyGate: D9_ACTIVE_AND_UNKNOWN_BLOCK
  fallbackRule: RETURN_RPE_ONLY_CANDIDATES_ATOMICALLY
  warmupComponent: WU-MD-01@1.0.0
  cooldownComponent: CD-MD-01@1.0.0
  fallbackComponent: RPE-ONLY-CONTROLLED-01@1.0.0
  stopConditionComponent: STOP-MD-01@1.0.0
  numericReducedRepetitionVariant: null

The athlete deliberately selects a current same-event result. The fastest result
is never auto-selected. Missing, stale, unknown or cross-event evidence cannot
create a pace-target session. Age alone neither rejects nor reduces an otherwise
equal case; experience, current capability and safety gates still apply.

## 3. Shared components

- WU-MD-01@1.0.0: 15 minutes easy at RPE 2-3, then 4x20 seconds progressive strides with 40 seconds walk or jog
- CD-MD-01@1.0.0: 10 minutes easy at RPE 1-2
- RPE-ONLY-CONTROLLED-01@1.0.0: retain RPE guidance when exact pace authority is unavailable
- STOP-MD-01@1.0.0: PAIN_SIGNAL, FORM_BREAKDOWN, DIZZINESS_OR_CHEST_SYMPTOM, TARGET_PACE_UNCONTROLLABLE

## 4. Exact working-source drafts

- templateId: MD-800-01
  lifecycleStatus: DRAFT
  eligibilityStatus: REVIEW_REQUIRED
  sourceAdoptionStatus: ACCEPTED_AS_WORKING_SOURCE
  runtimeActivationAuthorized: false
  candidateEventGroup: MIDDLE_DISTANCE
  targetEventDistanceM: 800
  allowedExperienceBands: [EXPERIENCED]
  populationApplicability: YOUTH_AND_ADULT_SAME_CRITERIA_NO_AGE_DOSE_BRANCH
  anchorRequirements: [CURRENT, SAME_EVENT, CURRENT_CAPABILITY, EXPLICIT_SELECTION]
  machineNotation: "10×200m @800m RP · r60″ STAND"
  totalRepetitions: 10
  qualityDistanceM: 2000
  repetitionRecoveryOccurrences: 9
  repetitionRecoveryTotalSeconds: 540
  warmupComponent: WU-MD-01@1.0.0
  cooldownComponent: CD-MD-01@1.0.0
  fallbackComponent: RPE-ONLY-CONTROLLED-01@1.0.0
  stopConditionComponent: STOP-MD-01@1.0.0
  numericReducedRepetitionVariant: null
  sourceUrl: "https://pmc.ncbi.nlm.nih.gov/articles/PMC8363530/"
  sourceDoi: "10.1007/s40279-021-01481-2"
  observedSourceProtocol: "Review table: 10-16x200m at 800-1500m race pace with 1 minute recovery."
  trainOracleOperationalAdaptation: "Lower 10 repetitions, current same-event 800m capability and explicit STAND recovery."
  transferLimitations: "Elite/international evidence is not a universal or youth-specific dose; STAND is operational."

- templateId: MD-1500-01
  lifecycleStatus: DRAFT
  eligibilityStatus: REVIEW_REQUIRED
  sourceAdoptionStatus: ACCEPTED_AS_WORKING_SOURCE
  runtimeActivationAuthorized: false
  candidateEventGroup: MIDDLE_DISTANCE
  targetEventDistanceM: 1500
  allowedExperienceBands: [EXPERIENCED]
  populationApplicability: YOUTH_AND_ADULT_SAME_CRITERIA_NO_AGE_DOSE_BRANCH
  anchorRequirements: [CURRENT, SAME_EVENT, CURRENT_CAPABILITY, EXPLICIT_SELECTION]
  machineNotation: "3×500m @1500m RP · r180″ STAND"
  totalRepetitions: 3
  qualityDistanceM: 1500
  repetitionRecoveryOccurrences: 2
  repetitionRecoveryTotalSeconds: 360
  warmupComponent: WU-MD-01@1.0.0
  cooldownComponent: CD-MD-01@1.0.0
  fallbackComponent: RPE-ONLY-CONTROLLED-01@1.0.0
  stopConditionComponent: STOP-MD-01@1.0.0
  numericReducedRepetitionVariant: null
  sourceUrl: "https://worldathletics.org/personal-best/performance/speed-training-endurance-runners-benefits-limits"
  observedSourceProtocol: "World Athletics: 3-4x500m at target 1500m pace with 2-3 minutes recovery."
  trainOracleOperationalAdaptation: "Three repetitions, 180 seconds, current same-event capability and explicit STAND recovery."
  transferLimitations: "Coaching guidance is not a controlled youth trial; exact count, current pace and STAND are operational."

- templateId: MD-3000-01
  lifecycleStatus: DRAFT
  eligibilityStatus: REVIEW_REQUIRED
  sourceAdoptionStatus: ACCEPTED_AS_WORKING_SOURCE
  runtimeActivationAuthorized: false
  candidateEventGroup: MIDDLE_DISTANCE
  targetEventDistanceM: 3000
  allowedExperienceBands: [EXPERIENCED]
  populationApplicability: YOUTH_AND_ADULT_SAME_CRITERIA_NO_AGE_DOSE_BRANCH
  anchorRequirements: [CURRENT, SAME_EVENT, CURRENT_CAPABILITY, EXPLICIT_SELECTION]
  machineNotation: "4×800m @3000m RP · r180″ WALK"
  totalRepetitions: 4
  qualityDistanceM: 3200
  repetitionRecoveryOccurrences: 3
  repetitionRecoveryTotalSeconds: 540
  warmupComponent: WU-MD-01@1.0.0
  cooldownComponent: CD-MD-01@1.0.0
  fallbackComponent: RPE-ONLY-CONTROLLED-01@1.0.0
  stopConditionComponent: STOP-MD-01@1.0.0
  numericReducedRepetitionVariant: null
  sourceUrl: "https://pmc.ncbi.nlm.nih.gov/articles/PMC8363530/"
  sourceDoi: "10.1007/s40279-021-01481-2"
  observedSourceProtocol: "Review table: 4-7x800-1000m at 3-10km race pace with 2-3 minutes recovery."
  trainOracleOperationalAdaptation: "Four 800m repetitions, 180 seconds, current same-event 3000m capability and WALK recovery."
  transferLimitations: "The source spans events and elite adults; WALK and the exact lower-bound dose are operational choices."

## 5. Arithmetic and display

Recovery occurs only between repetitions: 10 repetitions have 9 recoveries, 3
have 2, and 4 have 3. Warm-up and cooldown are outside quality distance. The
athlete view must show target time, recovery mode/time, quality distance,
warm-up, cooldown, RPE meaning and stop rules.

## 6. Open issues

| Issue ID | Status | Canonical blocker | Required evidence |
|---|---|---:|---|
| OI-MD-800-RUNTIME-001 | OPEN | YES | Manifest, hashes, mutation tests and public browser proof |
| OI-MD-1500-RUNTIME-001 | OPEN | YES | Manifest, hashes, mutation tests and public browser proof |
| OI-MD-3000-RUNTIME-001 | OPEN | YES | Manifest, hashes, mutation tests and public browser proof |

No issue is closed here. Dedicated 100m, 200m and 400m plans remain deferred.
No cross-event formula or age, sex or school-division multiplier is authorized.

## 7. Sources

- Haugen et al., DOI 10.1007/s40279-021-01481-2: https://pmc.ncbi.nlm.nih.gov/articles/PMC8363530/
- World Athletics: https://worldathletics.org/personal-best/performance/speed-training-endurance-runners-benefits-limits
- Ingham et al., PMID 22868404, DOI 10.1123/ijspp.8.1.77: https://pubmed.ncbi.nlm.nih.gov/22868404/

[DRAFT_COMPLETE]
