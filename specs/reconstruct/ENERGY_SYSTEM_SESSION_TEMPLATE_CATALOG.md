# ENERGY_SYSTEM_SESSION_TEMPLATE_CATALOG.md

```yaml
document_metadata:
  doc_id: trainoracle-spec-energy-system-session-template-catalog
  status: RECONSTRUCTED_DRAFT_FOR_REVIEW
  owner: COACH_HOJUNE
  version: "0.1"
  local_original_found: false
  reconstructed_from_current_review_sources: true
  executed_tests_total: 0
  executed_tests_passed: 0
  runtime_authority: false
  automatic_prescription_authorized: false
  numeric_template_activation_authorized: false
  catalog_entries:
    energy_intent_seeds: 25
    recovery_support_seeds: 5
  final_marker_required: "[DRAFT_COMPLETE]"
```

## 1. 읽는 방법과 안전 경계

이 목록은 선수에게 쓸 수 있는 자동 처방표가 아니다. 각 항목은 원문 링크, 대상
집단, 전이 한계, 코치·스포츠과학·청소년 검토 상태를 보존한 연구 시드다. 모든
항목은 `lifecycleStatus: DRAFT`, `eligibilityStatus: REVIEW_REQUIRED`이며 Template
Library 조회와 Plan Generator 자동 선택에서 제외된다.

`BASE`, `LT`, `VO2`, `GLY`, `ATP_PC`는 계획 의도 라벨이다. 생리 측정 결과,
개인 능력 점수, 안전 승인, 회복 완료 선언이 아니다. `RECOVERY_INTENT`는 별도
지원 축이지 여섯 번째 측정 에너지 시스템이 아니다.

```yaml
catalog_invariants:
  numeric_template_activation: forbidden
  automatic_plan_binding: forbidden
  D9_ACTIVE_or_UNKNOWN: blocks_or_requires_human_review_before_any_future_query
  raw_free_text_for_dose: forbidden
  private_self_only_signal: forbidden
  goal_anchor_as_current_capability: forbidden
  cross_event_pace_conversion: CROSS_EVENT_MODEL_REQUIRED
  sprint_under_60m_using_race_pace: forbidden
  no_template_claims_medical_clearance: true
```

## 2. Source registry and verification record

The linked materials were re-opened on 2026-07-26 where the provider allowed
access. `SOURCE_URL_RECORDED_ACCESS_RESTRICTED` means the provider URL is retained
but its content could not be fetched in this environment; it does not upgrade the
seed to direct evidence. PubMed titles/metadata were confirmed through NCBI E-utilities.

An exact numeric seed may be `DIRECT_SOURCE_EXAMPLE` only when the current review
re-opened that exact notation in the linked source. If the source body or full
protocol could not be re-opened, this catalog keeps the seed for audit but marks it
`REJECTED_OR_UNUSABLE`; a reviewer must not treat an earlier summary as the original
source.

| Source ref | URL | Recheck | Use limit |
|---|---|---|---|
| `SRC-VDOT-PACES` | https://vdoto2.com/calculator/ | `SOURCE_CONTENT_REOPENED` | Coach-facing examples, not TrainOracle dose authority. |
| `SRC-VDOT-T` | https://support.vdoto2.com/2017/12/whats-threshold-pace/ | `SOURCE_CONTENT_REOPENED` | Threshold examples; no youth or universal-volume claim. |
| `SRC-VDOT-CRUISE` | https://news.vdoto2.com/2025/06/get-the-most-out-of-your-threshold-training/ | `SOURCE_CONTENT_REOPENED` | Cruise example; do not copy as default dose. |
| `SRC-VDOT-GUIDE` | https://support.vdoto2.com/vdot-adaptive-trainer-instructional-guide/ | `SOURCE_CONTENT_REOPENED` | Preference/context guidance; no 9.5-day superiority claim. |
| `SRC-WA-SPRINT-INTRO` | https://worldathletics.org/download/downloadnsa?filename=a0cae133-1056-4b89-9f93-16d87fd3bbd4.pdf&urlslug=introduction-to-sprinting | `SOURCE_URL_RECORDED_ACCESS_RESTRICTED` | Sprint coaching case; human sprint review required. |
| `SRC-WA-SPRINT-RT` | https://worldathletics.org/download/downloadnsa?filename=f5f00a69-bc4e-46c7-af53-e356d5b9630b.pdf&urlslug=nsa-round-table-no-3-sprints | `SOURCE_URL_RECORDED_ACCESS_RESTRICTED` | Sprint-category context only. |
| `SRC-WA-DECATHLON` | https://worldathletics.org/download/downloadnsa?filename=ac054a49-c021-4864-a46b-5a33fb94b144.pdf&urlslug=the-development-and-training-of-decathletes-i | `SOURCE_URL_RECORDED_ACCESS_RESTRICTED` | Adult decathlon examples are indirect for other events. |
| `SRC-WA-SPRINTS` | https://worldathletics.org/download/downloadnsa?filename=f411d6b2-f0be-456f-b969-28abad2159ce.pdf&urlslug=the-sprints | `SOURCE_URL_RECORDED_ACCESS_RESTRICTED` | Sprint/bounds example; no automatic plyometric use. |
| `SRC-WA-1500` | https://worldathletics.org/personal-best/performance/speed-training-endurance-runners-benefits-limits | `SOURCE_URL_RECORDED_ACCESS_RESTRICTED` | Endurance-runner speed examples, not introductory defaults. |
| `SRC-WA-MEDICAL` | https://worldathletics.org/download/download?filename=3f74b21a-2a83-4f92-9a30-759603533e5d.pdf&urlslug=Medical+Manual+%28complete%29 | `SOURCE_URL_RECORDED_ACCESS_RESTRICTED` | Warm-up context only; not a safety guarantee. |
| `SRC-PMID-39835194` | https://pubmed.ncbi.nlm.nih.gov/39835194/ | `NCBI_METADATA_CONFIRMED` | Trained middle-distance protocol; transfer review required. |
| `SRC-PMID-36314990` | https://pubmed.ncbi.nlm.nih.gov/36314990/ | `NCBI_METADATA_CONFIRMED` | Well-trained adult men; no individual automation. |
| `SRC-PMID-37075554` | https://pubmed.ncbi.nlm.nih.gov/37075554/ | `NCBI_METADATA_CONFIRMED` | Systematic review of acute kinematics; not a fixed-rest rule. |
| `SRC-PMID-37776346` | https://pubmed.ncbi.nlm.nih.gov/37776346/ | `NCBI_METADATA_CONFIRMED` | Sprint recovery study; no youth or long-distance transfer. |
| `SRC-PMID-38188222` | https://pubmed.ncbi.nlm.nih.gov/38188222/ | `NCBI_METADATA_CONFIRMED` | Repeated-sprint work:rest study; not universal 30m timing. |
| `SRC-PRODUCT-RECOVERY-SUPPORT-001` | `this catalog, section 9` | `PRODUCT_PROVENANCE_RECORDED` | Product support state only, never a scientific or medical source. |

## 3. Common field semantics

Each record below contains the same required fields. `derivedTotals` is a structural
formula or `UNAVAILABLE`; it is not a completed-session result. `minorAllowed: false`
means a minor is not eligible merely by having guardian consent. A later approved
minor policy would still require guardian and designated human review.

The records are **not** `SessionTemplateRecord` objects from
`TEMPLATE_LIBRARY_SPEC.md`. Until a later accepted mapping exists, every catalog
entry deliberately has empty `allowedEventGroups` and `allowedExperienceBands`.
Those empty arrays are a zero-eligibility fence, not a claim that every group or
experience level is allowed. `draftCandidateEventGroups` is research context only;
it cannot be consumed by the Template Library or Plan Generator.

```yaml
catalog_to_template_library_boundary:
  catalog_entry_is_registered_template_record: false
  allowedEventGroups_empty_means: NOT_ELIGIBLE_FOR_ANY_EVENT_GROUP
  allowedExperienceBands_empty_means: NOT_ELIGIBLE_FOR_ANY_EXPERIENCE_BAND
  draftCandidateEventGroups_runtime_consumption: forbidden
  required_before_any_mapping:
    - exact_TemplateLibrary_EventGroup_mapping
    - exact_TemplateLibrary_AthleteLevelBand_mapping
    - source_and_transfer_review
    - separate_lifecycle_activation_record
```

```yaml
required_review_state:
  coach: PENDING
  sportsScience: PENDING
  youthTransfer: PENDING_OR_NOT_APPLICABLE
  activation: FORBIDDEN
common_stop_condition_codes:
  - STOP_IF_D9_BLOCKED_OR_UNKNOWN
  - STOP_IF_REQUIRED_WARMUP_OR_ANCHOR_IS_MISSING
  - STOP_IF_TECHNIQUE_OR_STRUCTURED_EFFORT_CANNOT_BE_MAINTAINED
```

## 4. BASE_INTENT seeds

```yaml
- templateId: BA-SEED-01
  version: "0.1"
  lifecycleStatus: DRAFT
  eligibilityStatus: REVIEW_REQUIRED
  sourceVerificationStatus: DIRECT_SOURCE_EXAMPLE
  planningIntent: BASE_INTENT
  plainKoreanName: "30~45분 편안한 달리기"
  coachingTerm: "Easy run"
  notationPattern: "30~45′ @E"
  plainKoreanReading: "편안히 대화할 수 있는 느낌으로 30분에서 45분 달립니다."
  sourceRefs: [SRC-VDOT-PACES]
  sourcePopulation: "VDOT coach-facing running example; individual ability not specified."
  transferLimitations: "No automatic duration, pace, youth, or volume assignment."
  allowedEventGroups: []
  draftCandidateEventGroups: [MIDDLE_DISTANCE, LONG_DISTANCE, ROAD_RUNNING]
  allowedExperienceBands: []
  draftExperienceEvidence: SOURCE_AND_HUMAN_MAPPING_REQUIRED
  minorAllowed: false
  guardianOrCoachReview: "COACH_AND_GUARDIAN_POLICY_REVIEW_REQUIRED"
  paceAnchorKinds: [RPE_ONLY, RECENT_RESULT, COACH_REFERENCE]
  warmup: "OPTIONAL_EASY_START_REVIEW_REQUIRED"
  mainSet: "continuous_duration_30_to_45_min"
  repetitionRecovery: NOT_APPLICABLE
  setRecovery: NOT_APPLICABLE
  cooldown: "OPTIONAL_EASY_FINISH_REVIEW_REQUIRED"
  downshiftOptions: [SHORTEN_DURATION, RPE_ONLY_EASIER]
  stopConditionCodes: [STOP_IF_D9_BLOCKED_OR_UNKNOWN, STOP_IF_REQUIRED_WARMUP_OR_ANCHOR_IS_MISSING]
  derivedTotals: "qualityDurationSeconds=UNAVAILABLE_UNTIL_EXACT_DURATION_SELECTED"

- templateId: BA-SEED-02
  version: "0.1"
  lifecycleStatus: DRAFT
  eligibilityStatus: REVIEW_REQUIRED
  sourceVerificationStatus: SOURCE_ADAPTED
  planningIntent: BASE_INTENT
  plainKoreanName: "20~30분 짧은 회복 달리기"
  coachingTerm: "Recovery easy run"
  notationPattern: "20~30′ @E"
  plainKoreanReading: "가볍고 편안한 느낌으로 20분에서 30분 달립니다."
  sourceRefs: [SRC-VDOT-PACES]
  sourcePopulation: "VDOT easy/recovery category, product duration adaptation."
  transferLimitations: "Duration is not a direct source prescription; no recovery-complete claim."
  allowedEventGroups: []
  draftCandidateEventGroups: [MIDDLE_DISTANCE, LONG_DISTANCE, ROAD_RUNNING]
  allowedExperienceBands: []
  draftExperienceEvidence: SOURCE_AND_HUMAN_MAPPING_REQUIRED
  minorAllowed: false
  guardianOrCoachReview: "COACH_AND_GUARDIAN_POLICY_REVIEW_REQUIRED"
  paceAnchorKinds: [RPE_ONLY, COACH_REFERENCE]
  warmup: "OPTIONAL"
  mainSet: "continuous_duration_20_to_30_min"
  repetitionRecovery: NOT_APPLICABLE
  setRecovery: NOT_APPLICABLE
  cooldown: "OPTIONAL"
  downshiftOptions: [WALK_BREAK, SHORTEN_DURATION]
  stopConditionCodes: [STOP_IF_D9_BLOCKED_OR_UNKNOWN, STOP_IF_STRUCTURED_EFFORT_NOT_EASY]
  derivedTotals: "qualityDurationSeconds=UNAVAILABLE_UNTIL_EXACT_DURATION_SELECTED"

- templateId: BA-SEED-03
  version: "0.1"
  lifecycleStatus: DRAFT
  eligibilityStatus: REVIEW_REQUIRED
  sourceVerificationStatus: SOURCE_ADAPTED
  planningIntent: BASE_INTENT
  plainKoreanName: "45~60분 편안한 지속주"
  coachingTerm: "Extended easy run"
  notationPattern: "45~60′ @E"
  plainKoreanReading: "편안한 느낌을 유지하며 45분에서 60분 달립니다."
  sourceRefs: [SRC-VDOT-PACES]
  sourcePopulation: "VDOT easy category, product duration adaptation."
  transferLimitations: "Longer duration is not a universal baseline and needs current context."
  allowedEventGroups: []
  draftCandidateEventGroups: [MIDDLE_DISTANCE, LONG_DISTANCE, ROAD_RUNNING]
  allowedExperienceBands: []
  draftExperienceEvidence: SOURCE_AND_HUMAN_MAPPING_REQUIRED
  minorAllowed: false
  guardianOrCoachReview: "COACH_AND_GUARDIAN_POLICY_REVIEW_REQUIRED"
  paceAnchorKinds: [RPE_ONLY, COACH_REFERENCE]
  warmup: "OPTIONAL"
  mainSet: "continuous_duration_45_to_60_min"
  repetitionRecovery: NOT_APPLICABLE
  setRecovery: NOT_APPLICABLE
  cooldown: "OPTIONAL"
  downshiftOptions: [SHORTEN_DURATION, WALK_BREAK]
  stopConditionCodes: [STOP_IF_D9_BLOCKED_OR_UNKNOWN, STOP_IF_STRUCTURED_EFFORT_NOT_EASY]
  derivedTotals: "qualityDurationSeconds=UNAVAILABLE_UNTIL_EXACT_DURATION_SELECTED"

- templateId: BA-SEED-04
  version: "0.1"
  lifecycleStatus: DRAFT
  eligibilityStatus: REVIEW_REQUIRED
  sourceVerificationStatus: REJECTED_OR_UNUSABLE
  planningIntent: BASE_INTENT
  plainKoreanName: "장거리 지속주 후보"
  coachingTerm: "Long easy run"
  notationPattern: "long easy @E · duration unresolved"
  plainKoreanReading: "시간이 승인된 개인 기준선으로 정해지기 전에는 이 항목을 배정하지 않습니다."
  sourceRefs: [SRC-VDOT-PACES, SRC-VDOT-GUIDE]
  sourcePopulation: "General VDOT guidance."
  transferLimitations: "Exact duration and eligibility unresolved; unavailable for use."
  allowedEventGroups: []
  draftCandidateEventGroups: [MIDDLE_DISTANCE, LONG_DISTANCE, ROAD_RUNNING]
  allowedExperienceBands: []
  draftExperienceEvidence: SOURCE_AND_HUMAN_MAPPING_REQUIRED
  minorAllowed: false
  guardianOrCoachReview: "HUMAN_REVIEW_REQUIRED_BEFORE_RECLASSIFICATION"
  paceAnchorKinds: [RPE_ONLY]
  warmup: "UNRESOLVED"
  mainSet: "UNRESOLVED"
  repetitionRecovery: NOT_APPLICABLE
  setRecovery: NOT_APPLICABLE
  cooldown: "UNRESOLVED"
  downshiftOptions: [DO_NOT_USE]
  stopConditionCodes: [STOP_UNRESOLVED_DOSE]
  derivedTotals: UNAVAILABLE_DOSE_UNRESOLVED

- templateId: BA-SEED-05
  version: "0.1"
  lifecycleStatus: DRAFT
  eligibilityStatus: REVIEW_REQUIRED
  sourceVerificationStatus: PRODUCT_VARIANT
  planningIntent: BASE_INTENT
  plainKoreanName: "10분씩 나누어 편안하게 달리기"
  coachingTerm: "Broken easy run"
  notationPattern: "3×10′ @E · r1′ walk/jog"
  plainKoreanReading: "편안하게 10분 달린 뒤 1분 걷거나 조깅하며, 이를 세 번 반복합니다."
  sourceRefs: [SRC-VDOT-PACES]
  sourcePopulation: "Product representation of an easy-run category."
  transferLimitations: "The broken structure is not a direct source example."
  allowedEventGroups: []
  draftCandidateEventGroups: [MIDDLE_DISTANCE, LONG_DISTANCE, ROAD_RUNNING]
  allowedExperienceBands: []
  draftExperienceEvidence: SOURCE_AND_HUMAN_MAPPING_REQUIRED
  minorAllowed: false
  guardianOrCoachReview: "COACH_AND_GUARDIAN_POLICY_REVIEW_REQUIRED"
  paceAnchorKinds: [RPE_ONLY, COACH_REFERENCE]
  warmup: "OPTIONAL"
  mainSet: "3 sets x 10 min"
  repetitionRecovery: "1 min WALK_OR_JOG"
  setRecovery: NOT_APPLICABLE
  cooldown: "OPTIONAL"
  downshiftOptions: [REDUCE_SET_COUNT, WALK_BREAK]
  stopConditionCodes: [STOP_IF_D9_BLOCKED_OR_UNKNOWN, STOP_IF_STRUCTURED_EFFORT_NOT_EASY]
  derivedTotals: "qualityDurationSeconds=1800; recoveryTotalSeconds=120"
```

## 5. LT_INTENT seeds

```yaml
- templateId: LT-SEED-01
  version: "0.1"
  lifecycleStatus: DRAFT
  eligibilityStatus: REVIEW_REQUIRED
  sourceVerificationStatus: DIRECT_SOURCE_EXAMPLE
  planningIntent: LT_INTENT
  plainKoreanName: "20분 역치 지속주"
  coachingTerm: "Threshold tempo"
  notationPattern: "20′ @T"
  plainKoreanReading: "역치 느낌으로 20분을 지속합니다."
  sourceRefs: [SRC-VDOT-T]
  sourcePopulation: "VDOT threshold guidance; not athlete-specific."
  transferLimitations: "No automatic threshold pace or youth dose."
  allowedEventGroups: []
  draftCandidateEventGroups: [MIDDLE_DISTANCE, LONG_DISTANCE, ROAD_RUNNING]
  allowedExperienceBands: []
  draftExperienceEvidence: SOURCE_AND_HUMAN_MAPPING_REQUIRED
  minorAllowed: false
  guardianOrCoachReview: "COACH_AND_GUARDIAN_POLICY_REVIEW_REQUIRED"
  paceAnchorKinds: [RPE_ONLY, COACH_REFERENCE]
  warmup: "WU-QUALITY-REVIEW-REQUIRED"
  mainSet: "continuous_duration_20_min"
  repetitionRecovery: NOT_APPLICABLE
  setRecovery: NOT_APPLICABLE
  cooldown: "CD-QUALITY-REVIEW-REQUIRED"
  downshiftOptions: [SHORTEN_DURATION, RPE_ONLY_CONTROLLED]
  stopConditionCodes: [STOP_IF_D9_BLOCKED_OR_UNKNOWN, STOP_IF_REQUIRED_WARMUP_OR_ANCHOR_IS_MISSING, STOP_IF_TECHNIQUE_OR_STRUCTURED_EFFORT_CANNOT_BE_MAINTAINED]
  derivedTotals: "qualityDurationSeconds=1200"

- templateId: LT-SEED-02
  version: "0.1"
  lifecycleStatus: DRAFT
  eligibilityStatus: REVIEW_REQUIRED
  sourceVerificationStatus: SOURCE_ADAPTED
  planningIntent: LT_INTENT
  plainKoreanName: "1600미터 역치 반복 3회"
  coachingTerm: "Threshold cruise intervals"
  notationPattern: "3×1600m @T · r1~2′"
  plainKoreanReading: "1600미터를 역치 느낌으로 세 번 달리고, 사이에 1분에서 2분 쉽니다."
  sourceRefs: [SRC-VDOT-T]
  sourcePopulation: "VDOT threshold guidance for 5-15 minute cruise intervals."
  transferLimitations: "The exact 3×1600m format was not re-opened in the linked source; it remains an adapted seed."
  allowedEventGroups: []
  draftCandidateEventGroups: [MIDDLE_DISTANCE, LONG_DISTANCE, ROAD_RUNNING]
  allowedExperienceBands: []
  draftExperienceEvidence: SOURCE_AND_HUMAN_MAPPING_REQUIRED
  minorAllowed: false
  guardianOrCoachReview: "COACH_AND_GUARDIAN_POLICY_REVIEW_REQUIRED"
  paceAnchorKinds: [RPE_ONLY, COACH_REFERENCE]
  warmup: "WU-QUALITY-REVIEW-REQUIRED"
  mainSet: "1 set x 3 reps x 1600m"
  repetitionRecovery: "60_to_120_sec COACH_DEFINED"
  setRecovery: NOT_APPLICABLE
  cooldown: "CD-QUALITY-REVIEW-REQUIRED"
  downshiftOptions: [REDUCE_REPETITIONS, RPE_ONLY_CONTROLLED]
  stopConditionCodes: [STOP_IF_D9_BLOCKED_OR_UNKNOWN, STOP_IF_REQUIRED_WARMUP_OR_ANCHOR_IS_MISSING, STOP_IF_TECHNIQUE_OR_STRUCTURED_EFFORT_CANNOT_BE_MAINTAINED]
  derivedTotals: "totalRepetitions=3; qualityDistanceM=4800; recoveryTotalSeconds=UNAVAILABLE_RANGE"

- templateId: LT-SEED-03
  version: "0.1"
  lifecycleStatus: DRAFT
  eligibilityStatus: REVIEW_REQUIRED
  sourceVerificationStatus: DIRECT_SOURCE_EXAMPLE
  planningIntent: LT_INTENT
  plainKoreanName: "1600미터 크루즈 반복 4회"
  coachingTerm: "Cruise intervals"
  notationPattern: "4×1600m @T · r1′"
  plainKoreanReading: "1600미터를 같은 역치 느낌으로 네 번 달리고, 사이마다 1분 쉽니다."
  sourceRefs: [SRC-VDOT-CRUISE]
  sourcePopulation: "VDOT coaching article example."
  transferLimitations: "Source cautions against faster pace; no universal volume claim."
  allowedEventGroups: []
  draftCandidateEventGroups: [MIDDLE_DISTANCE, LONG_DISTANCE, ROAD_RUNNING]
  allowedExperienceBands: []
  draftExperienceEvidence: SOURCE_AND_HUMAN_MAPPING_REQUIRED
  minorAllowed: false
  guardianOrCoachReview: "COACH_AND_GUARDIAN_POLICY_REVIEW_REQUIRED"
  paceAnchorKinds: [RPE_ONLY, COACH_REFERENCE]
  warmup: "WU-QUALITY-REVIEW-REQUIRED"
  mainSet: "1 set x 4 reps x 1600m"
  repetitionRecovery: "60 sec COACH_DEFINED"
  setRecovery: NOT_APPLICABLE
  cooldown: "CD-QUALITY-REVIEW-REQUIRED"
  downshiftOptions: [REDUCE_REPETITIONS, RPE_ONLY_CONTROLLED]
  stopConditionCodes: [STOP_IF_D9_BLOCKED_OR_UNKNOWN, STOP_IF_REQUIRED_WARMUP_OR_ANCHOR_IS_MISSING, STOP_IF_TECHNIQUE_OR_STRUCTURED_EFFORT_CANNOT_BE_MAINTAINED]
  derivedTotals: "totalRepetitions=4; qualityDistanceM=6400; recoveryTotalSeconds=180"

- templateId: LT-SEED-04
  version: "0.1"
  lifecycleStatus: DRAFT
  eligibilityStatus: REVIEW_REQUIRED
  sourceVerificationStatus: SOURCE_ADAPTED
  planningIntent: LT_INTENT
  plainKoreanName: "7분 역치 반복 3회"
  coachingTerm: "Time-based cruise intervals"
  notationPattern: "3×7′ @T · r1~2′"
  plainKoreanReading: "역치 느낌으로 7분 달린 뒤 1분에서 2분 쉬며 세 번 반복합니다."
  sourceRefs: [SRC-VDOT-T, SRC-VDOT-GUIDE]
  sourcePopulation: "VDOT duration preference and threshold guidance."
  transferLimitations: "Exact 7-minute format is adapted, not a direct protocol."
  allowedEventGroups: []
  draftCandidateEventGroups: [MIDDLE_DISTANCE, LONG_DISTANCE, ROAD_RUNNING]
  allowedExperienceBands: []
  draftExperienceEvidence: SOURCE_AND_HUMAN_MAPPING_REQUIRED
  minorAllowed: false
  guardianOrCoachReview: "COACH_AND_GUARDIAN_POLICY_REVIEW_REQUIRED"
  paceAnchorKinds: [RPE_ONLY, COACH_REFERENCE]
  warmup: "WU-QUALITY-REVIEW-REQUIRED"
  mainSet: "1 set x 3 reps x 7 min"
  repetitionRecovery: "60_to_120_sec COACH_DEFINED"
  setRecovery: NOT_APPLICABLE
  cooldown: "CD-QUALITY-REVIEW-REQUIRED"
  downshiftOptions: [REDUCE_REPETITIONS, SHORTEN_REPETITION_DURATION]
  stopConditionCodes: [STOP_IF_D9_BLOCKED_OR_UNKNOWN, STOP_IF_REQUIRED_WARMUP_OR_ANCHOR_IS_MISSING, STOP_IF_TECHNIQUE_OR_STRUCTURED_EFFORT_CANNOT_BE_MAINTAINED]
  derivedTotals: "totalRepetitions=3; qualityDurationSeconds=1260; recoveryTotalSeconds=UNAVAILABLE_RANGE"

- templateId: LT-SEED-05
  version: "0.1"
  lifecycleStatus: DRAFT
  eligibilityStatus: REVIEW_REQUIRED
  sourceVerificationStatus: REJECTED_OR_UNUSABLE
  planningIntent: LT_INTENT
  plainKoreanName: "6분 역치 반복 6회 후보"
  coachingTerm: "High-volume threshold intervals"
  notationPattern: "6×6′ @T · r2′"
  plainKoreanReading: "상급 코치 검토 전에는 이 고용량 후보를 배정하지 않습니다."
  sourceRefs: [SRC-VDOT-T]
  sourcePopulation: "Exact coach-case source for this notation was not re-opened."
  transferLimitations: "High-volume protocol is retained only as an audit seed; it must not be implemented or promoted from this catalog."
  allowedEventGroups: []
  draftCandidateEventGroups: [MIDDLE_DISTANCE, LONG_DISTANCE, ROAD_RUNNING]
  allowedExperienceBands: []
  draftExperienceEvidence: SOURCE_AND_HUMAN_MAPPING_REQUIRED
  minorAllowed: false
  guardianOrCoachReview: "COACH_AND_SPORTS_SCIENCE_REVIEW_REQUIRED"
  paceAnchorKinds: [RPE_ONLY, COACH_REFERENCE]
  warmup: "WU-QUALITY-REVIEW-REQUIRED"
  mainSet: "SOURCE_PROTOCOL_NOT_RECONFIRMED_DO_NOT_USE"
  repetitionRecovery: "UNRESOLVED"
  setRecovery: NOT_APPLICABLE
  cooldown: "CD-QUALITY-REVIEW-REQUIRED"
  downshiftOptions: [DO_NOT_USE]
  stopConditionCodes: [STOP_UNVERIFIED_SOURCE_PROTOCOL]
  derivedTotals: UNAVAILABLE_SOURCE_PROTOCOL_NOT_RECONFIRMED
```

## 6. VO2_INTENT seeds

```yaml
- templateId: V2-SEED-01
  version: "0.1"
  lifecycleStatus: DRAFT
  eligibilityStatus: REVIEW_REQUIRED
  sourceVerificationStatus: DIRECT_SOURCE_EXAMPLE
  planningIntent: VO2_INTENT
  plainKoreanName: "2분 인터벌 6회"
  coachingTerm: "Interval pace"
  notationPattern: "6×2′ @I · r1′ jog"
  plainKoreanReading: "2분간 인터벌 느낌으로 달리고 1분 조깅하며 여섯 번 반복합니다."
  sourceRefs: [SRC-VDOT-PACES]
  sourcePopulation: "VDOT interval example."
  transferLimitations: "No automatic I-pace conversion or individual dose."
  allowedEventGroups: []
  draftCandidateEventGroups: [MIDDLE_DISTANCE, LONG_DISTANCE, ROAD_RUNNING]
  allowedExperienceBands: []
  draftExperienceEvidence: SOURCE_AND_HUMAN_MAPPING_REQUIRED
  minorAllowed: false
  guardianOrCoachReview: "COACH_AND_GUARDIAN_POLICY_REVIEW_REQUIRED"
  paceAnchorKinds: [RPE_ONLY, COACH_REFERENCE]
  warmup: "WU-QUALITY-REVIEW-REQUIRED"
  mainSet: "1 set x 6 reps x 2 min"
  repetitionRecovery: "60 sec JOG"
  setRecovery: NOT_APPLICABLE
  cooldown: "CD-QUALITY-REVIEW-REQUIRED"
  downshiftOptions: [REDUCE_REPETITIONS, RPE_ONLY_CONTROLLED]
  stopConditionCodes: [STOP_IF_D9_BLOCKED_OR_UNKNOWN, STOP_IF_REQUIRED_WARMUP_OR_ANCHOR_IS_MISSING, STOP_IF_TECHNIQUE_OR_STRUCTURED_EFFORT_CANNOT_BE_MAINTAINED]
  derivedTotals: "totalRepetitions=6; qualityDurationSeconds=720; recoveryTotalSeconds=300"

- templateId: V2-SEED-02
  version: "0.1"
  lifecycleStatus: DRAFT
  eligibilityStatus: REVIEW_REQUIRED
  sourceVerificationStatus: DIRECT_SOURCE_EXAMPLE
  planningIntent: VO2_INTENT
  plainKoreanName: "3분 인터벌 5회"
  coachingTerm: "Interval pace"
  notationPattern: "5×3′ @I · r2′ jog"
  plainKoreanReading: "3분간 인터벌 느낌으로 달리고 2분 조깅하며 다섯 번 반복합니다."
  sourceRefs: [SRC-VDOT-PACES]
  sourcePopulation: "VDOT interval example."
  transferLimitations: "No automatic I-pace conversion or individual dose."
  allowedEventGroups: []
  draftCandidateEventGroups: [MIDDLE_DISTANCE, LONG_DISTANCE, ROAD_RUNNING]
  allowedExperienceBands: []
  draftExperienceEvidence: SOURCE_AND_HUMAN_MAPPING_REQUIRED
  minorAllowed: false
  guardianOrCoachReview: "COACH_AND_GUARDIAN_POLICY_REVIEW_REQUIRED"
  paceAnchorKinds: [RPE_ONLY, COACH_REFERENCE]
  warmup: "WU-QUALITY-REVIEW-REQUIRED"
  mainSet: "1 set x 5 reps x 3 min"
  repetitionRecovery: "120 sec JOG"
  setRecovery: NOT_APPLICABLE
  cooldown: "CD-QUALITY-REVIEW-REQUIRED"
  downshiftOptions: [REDUCE_REPETITIONS, RPE_ONLY_CONTROLLED]
  stopConditionCodes: [STOP_IF_D9_BLOCKED_OR_UNKNOWN, STOP_IF_REQUIRED_WARMUP_OR_ANCHOR_IS_MISSING, STOP_IF_TECHNIQUE_OR_STRUCTURED_EFFORT_CANNOT_BE_MAINTAINED]
  derivedTotals: "totalRepetitions=5; qualityDurationSeconds=900; recoveryTotalSeconds=480"

- templateId: V2-SEED-03
  version: "0.1"
  lifecycleStatus: DRAFT
  eligibilityStatus: REVIEW_REQUIRED
  sourceVerificationStatus: DIRECT_SOURCE_EXAMPLE
  planningIntent: VO2_INTENT
  plainKoreanName: "4분 인터벌 4회"
  coachingTerm: "Long interval"
  notationPattern: "4×4′ @I · r3′ jog"
  plainKoreanReading: "4분간 인터벌 느낌으로 달리고 3분 조깅하며 네 번 반복합니다."
  sourceRefs: [SRC-VDOT-PACES, SRC-PMID-36314990]
  sourcePopulation: "VDOT example plus well-trained adult-men study context."
  transferLimitations: "Study population is not youth or individual prescription evidence."
  allowedEventGroups: []
  draftCandidateEventGroups: [MIDDLE_DISTANCE, LONG_DISTANCE, ROAD_RUNNING]
  allowedExperienceBands: []
  draftExperienceEvidence: SOURCE_AND_HUMAN_MAPPING_REQUIRED
  minorAllowed: false
  guardianOrCoachReview: "COACH_AND_SPORTS_SCIENCE_REVIEW_REQUIRED"
  paceAnchorKinds: [RPE_ONLY, COACH_REFERENCE]
  warmup: "WU-QUALITY-REVIEW-REQUIRED"
  mainSet: "1 set x 4 reps x 4 min"
  repetitionRecovery: "180 sec JOG"
  setRecovery: NOT_APPLICABLE
  cooldown: "CD-QUALITY-REVIEW-REQUIRED"
  downshiftOptions: [REDUCE_REPETITIONS, SHORTEN_REPETITION_DURATION]
  stopConditionCodes: [STOP_IF_D9_BLOCKED_OR_UNKNOWN, STOP_IF_REQUIRED_WARMUP_OR_ANCHOR_IS_MISSING, STOP_IF_TECHNIQUE_OR_STRUCTURED_EFFORT_CANNOT_BE_MAINTAINED]
  derivedTotals: "totalRepetitions=4; qualityDurationSeconds=960; recoveryTotalSeconds=540"

- templateId: V2-SEED-04
  version: "0.1"
  lifecycleStatus: DRAFT
  eligibilityStatus: REVIEW_REQUIRED
  sourceVerificationStatus: REJECTED_OR_UNUSABLE
  planningIntent: VO2_INTENT
  plainKoreanName: "3분 고강도 반복 4회 후보"
  coachingTerm: "Long VO2 interval"
  notationPattern: "4×3′ @95% vVO2max · r3′ easy"
  plainKoreanReading: "연구 프로토콜 후보이며 개인 기준과 전이 검토 전에는 배정하지 않습니다."
  sourceRefs: [SRC-PMID-39835194]
  sourcePopulation: "PubMed metadata was confirmed; the exact full protocol was not re-opened."
  transferLimitations: "The 4×3-minute 95% vVO2max notation must not be implemented until original full-text protocol and transfer review are complete."
  allowedEventGroups: []
  draftCandidateEventGroups: [MIDDLE_DISTANCE]
  allowedExperienceBands: []
  draftExperienceEvidence: SOURCE_AND_HUMAN_MAPPING_REQUIRED
  minorAllowed: false
  guardianOrCoachReview: "COACH_AND_SPORTS_SCIENCE_REVIEW_REQUIRED"
  paceAnchorKinds: [COACH_REFERENCE]
  warmup: "WU-QUALITY-REVIEW-REQUIRED"
  mainSet: "SOURCE_PROTOCOL_NOT_RECONFIRMED_DO_NOT_USE"
  repetitionRecovery: "UNRESOLVED"
  setRecovery: NOT_APPLICABLE
  cooldown: "CD-QUALITY-REVIEW-REQUIRED"
  downshiftOptions: [DO_NOT_USE]
  stopConditionCodes: [STOP_UNVERIFIED_SOURCE_PROTOCOL]
  derivedTotals: UNAVAILABLE_SOURCE_PROTOCOL_NOT_RECONFIRMED

- templateId: V2-SEED-05
  version: "0.1"
  lifecycleStatus: DRAFT
  eligibilityStatus: REVIEW_REQUIRED
  sourceVerificationStatus: SOURCE_ADAPTED
  planningIntent: VO2_INTENT
  plainKoreanName: "1000미터 5회 5K 페이스 후보"
  coachingTerm: "5K-pace intervals"
  notationPattern: "5×1000m @5K RP · r2′30″"
  plainKoreanReading: "1000미터를 5K 레이스 페이스 기준으로 다섯 번 달리는 후보입니다."
  sourceRefs: [SRC-VDOT-PACES]
  sourcePopulation: "VDOT 3-5 minute interval range, adapted to 1000m."
  transferLimitations: "Requires same-event explicit anchor or RPE-only; no cross-event conversion."
  allowedEventGroups: []
  draftCandidateEventGroups: [MIDDLE_DISTANCE, LONG_DISTANCE, ROAD_RUNNING]
  allowedExperienceBands: []
  draftExperienceEvidence: SOURCE_AND_HUMAN_MAPPING_REQUIRED
  minorAllowed: false
  guardianOrCoachReview: "COACH_AND_SPORTS_SCIENCE_REVIEW_REQUIRED"
  paceAnchorKinds: [RECENT_RESULT, PB, SB, GOAL, RPE_ONLY, COACH_REFERENCE]
  warmup: "WU-QUALITY-REVIEW-REQUIRED"
  mainSet: "1 set x 5 reps x 1000m"
  repetitionRecovery: "150 sec JOG"
  setRecovery: NOT_APPLICABLE
  cooldown: "CD-QUALITY-REVIEW-REQUIRED"
  downshiftOptions: [REDUCE_REPETITIONS, RPE_ONLY_CONTROLLED]
  stopConditionCodes: [STOP_IF_D9_BLOCKED_OR_UNKNOWN, STOP_IF_ANCHOR_EVENT_MISMATCH, STOP_IF_REQUIRED_WARMUP_OR_ANCHOR_IS_MISSING]
  derivedTotals: "totalRepetitions=5; qualityDistanceM=5000; recoveryTotalSeconds=600"
```

## 7. GLY_INTENT seeds

```yaml
- templateId: GL-SEED-01
  version: "0.1"
  lifecycleStatus: DRAFT
  eligibilityStatus: REVIEW_REQUIRED
  sourceVerificationStatus: SOURCE_ADAPTED
  planningIntent: GLY_INTENT
  plainKoreanName: "500미터 3~4회 1500m 목표 페이스 후보"
  coachingTerm: "1500m race-pace repeats"
  notationPattern: "3~4×500m @GOAL 1500m RP · r2~3′"
  plainKoreanReading: "1500미터 목표 페이스라는 점을 분명히 보이는 500미터 반복 후보입니다."
  sourceRefs: [SRC-WA-1500]
  sourcePopulation: "Endurance-runner speed-training coaching example."
  transferLimitations: "Goal pace is aspirational, not current capacity; source access and population require review."
  allowedEventGroups: []
  draftCandidateEventGroups: [MIDDLE_DISTANCE]
  allowedExperienceBands: []
  draftExperienceEvidence: SOURCE_AND_HUMAN_MAPPING_REQUIRED
  minorAllowed: false
  guardianOrCoachReview: "COACH_AND_SPORTS_SCIENCE_REVIEW_REQUIRED"
  paceAnchorKinds: [GOAL, RPE_ONLY, COACH_REFERENCE]
  warmup: "WU-QUALITY-REVIEW-REQUIRED"
  mainSet: "1 set x 3_to_4 reps x 500m"
  repetitionRecovery: "120_to_180_sec COACH_DEFINED"
  setRecovery: NOT_APPLICABLE
  cooldown: "CD-QUALITY-REVIEW-REQUIRED"
  downshiftOptions: [REDUCE_REPETITIONS, RPE_ONLY_CONTROLLED]
  stopConditionCodes: [STOP_IF_D9_BLOCKED_OR_UNKNOWN, STOP_IF_REQUIRED_WARMUP_OR_ANCHOR_IS_MISSING, STOP_IF_GOAL_MISREPRESENTED_AS_CURRENT_CAPABILITY]
  derivedTotals: "totalRepetitions=UNAVAILABLE_RANGE; qualityDistanceM=UNAVAILABLE_RANGE"

- templateId: GL-SEED-02
  version: "0.1"
  lifecycleStatus: DRAFT
  eligibilityStatus: REVIEW_REQUIRED
  sourceVerificationStatus: SOURCE_ADAPTED
  planningIntent: GLY_INTENT
  plainKoreanName: "800-200-200 복합 반복 후보"
  coachingTerm: "Broken middle-distance set"
  notationPattern: "3×(800m+200m+200m) · r90″ · R3′"
  plainKoreanReading: "800미터와 200미터 두 번을 묶어 세 번 반복하는 복합 후보입니다."
  sourceRefs: [SRC-WA-1500]
  sourcePopulation: "Endurance-runner speed-training coaching example."
  transferLimitations: "Pace detail, athlete eligibility, and source access require human review."
  allowedEventGroups: []
  draftCandidateEventGroups: [MIDDLE_DISTANCE]
  allowedExperienceBands: []
  draftExperienceEvidence: SOURCE_AND_HUMAN_MAPPING_REQUIRED
  minorAllowed: false
  guardianOrCoachReview: "COACH_AND_SPORTS_SCIENCE_REVIEW_REQUIRED"
  paceAnchorKinds: [RPE_ONLY, COACH_REFERENCE]
  warmup: "WU-QUALITY-REVIEW-REQUIRED"
  mainSet: "3 sets x (800m + 200m + 200m)"
  repetitionRecovery: "90 sec COACH_DEFINED"
  setRecovery: "180 sec COACH_DEFINED"
  cooldown: "CD-QUALITY-REVIEW-REQUIRED"
  downshiftOptions: [REDUCE_SET_COUNT, REMOVE_FINAL_200M]
  stopConditionCodes: [STOP_IF_D9_BLOCKED_OR_UNKNOWN, STOP_REQUIRES_PACE_DETAIL_AND_HUMAN_REVIEW]
  derivedTotals: "qualityDistanceM=3600; intraSetRecoveryOccurrences=6; setRecoveryOccurrences=2; recoveryTotalSeconds=900"

- templateId: GL-SEED-03
  version: "0.1"
  lifecycleStatus: DRAFT
  eligibilityStatus: REVIEW_REQUIRED
  sourceVerificationStatus: POPULATION_INDIRECT
  planningIntent: GLY_INTENT
  plainKoreanName: "250-100 복합 반복 후보"
  coachingTerm: "Speed-endurance combination"
  notationPattern: "2~3×(250m+100m) · r30″ · R4~8′"
  plainKoreanReading: "250미터와 100미터를 묶는 후보이며, 대상 전이 검토 전에는 배정하지 않습니다."
  sourceRefs: [SRC-WA-DECATHLON]
  sourcePopulation: "Decathlon coaching example, indirect for middle-distance and youth."
  transferLimitations: "Population, exact rest range, and event transfer are unresolved."
  allowedEventGroups: []
  draftCandidateEventGroups: [SPRINT, MIDDLE_DISTANCE]
  allowedExperienceBands: []
  draftExperienceEvidence: SOURCE_AND_HUMAN_MAPPING_REQUIRED
  minorAllowed: false
  guardianOrCoachReview: "COACH_AND_SPORTS_SCIENCE_REVIEW_REQUIRED"
  paceAnchorKinds: [RPE_ONLY, COACH_REFERENCE, SPRINT_BENCHMARK]
  warmup: "WU-QUALITY-REVIEW-REQUIRED"
  mainSet: "2_to_3 sets x (250m + 100m)"
  repetitionRecovery: "30 sec COACH_DEFINED"
  setRecovery: "240_to_480_sec FULL_RECOVERY"
  cooldown: "CD-QUALITY-REVIEW-REQUIRED"
  downshiftOptions: [REDUCE_SET_COUNT, REMOVE_100M_COMPONENT]
  stopConditionCodes: [STOP_IF_D9_BLOCKED_OR_UNKNOWN, STOP_REQUIRES_POPULATION_TRANSFER_REVIEW]
  derivedTotals: "totalRepetitions=UNAVAILABLE_RANGE; qualityDistanceM=UNAVAILABLE_RANGE"

- templateId: GL-SEED-04
  version: "0.1"
  lifecycleStatus: DRAFT
  eligibilityStatus: REVIEW_REQUIRED
  sourceVerificationStatus: POPULATION_INDIRECT
  planningIntent: GLY_INTENT
  plainKoreanName: "150-200-300 스피드 지구력 후보"
  coachingTerm: "Speed endurance ladder"
  notationPattern: "150m-200m-300m @90~100% · full recovery"
  plainKoreanReading: "150미터, 200미터, 300미터를 긴 회복과 함께 하는 후보입니다."
  sourceRefs: [SRC-WA-DECATHLON]
  sourcePopulation: "Decathlon coaching example."
  transferLimitations: "Adult combined-events context; percentage and recovery need human review."
  allowedEventGroups: []
  draftCandidateEventGroups: [SPRINT, MIDDLE_DISTANCE]
  allowedExperienceBands: []
  draftExperienceEvidence: SOURCE_AND_HUMAN_MAPPING_REQUIRED
  minorAllowed: false
  guardianOrCoachReview: "COACH_AND_SPORTS_SCIENCE_REVIEW_REQUIRED"
  paceAnchorKinds: [RPE_ONLY, COACH_REFERENCE, SPRINT_BENCHMARK]
  warmup: "WU-QUALITY-REVIEW-REQUIRED"
  mainSet: "1 ladder x (150m + 200m + 300m)"
  repetitionRecovery: "FULL_RECOVERY_DURATION_UNRESOLVED"
  setRecovery: NOT_APPLICABLE
  cooldown: "CD-QUALITY-REVIEW-REQUIRED"
  downshiftOptions: [REMOVE_LONGEST_REPETITION, RPE_ONLY_CONTROLLED]
  stopConditionCodes: [STOP_IF_D9_BLOCKED_OR_UNKNOWN, STOP_REQUIRES_FULL_RECOVERY_DEFINITION]
  derivedTotals: "totalRepetitions=3; qualityDistanceM=650; plannedRecoverySeconds=UNAVAILABLE"

- templateId: GL-SEED-05
  version: "0.1"
  lifecycleStatus: DRAFT
  eligibilityStatus: REVIEW_REQUIRED
  sourceVerificationStatus: REJECTED_OR_UNUSABLE
  planningIntent: GLY_INTENT
  plainKoreanName: "300~600미터 젖산 내성 후보"
  coachingTerm: "Long speed-endurance candidate"
  notationPattern: "1~2×300~600m · long full recovery"
  plainKoreanReading: "거리와 회복이 넓게 열려 있어 사람 검토 전에는 배정하지 않습니다."
  sourceRefs: [SRC-WA-SPRINT-RT]
  sourcePopulation: "Sprint-category coaching context."
  transferLimitations: "Dose and population unresolved; inaccessible source content in this environment."
  allowedEventGroups: []
  draftCandidateEventGroups: []
  allowedExperienceBands: []
  draftExperienceEvidence: SOURCE_AND_HUMAN_MAPPING_REQUIRED
  minorAllowed: false
  guardianOrCoachReview: "HUMAN_REVIEW_REQUIRED_BEFORE_RECLASSIFICATION"
  paceAnchorKinds: [RPE_ONLY, COACH_REFERENCE]
  warmup: "UNRESOLVED"
  mainSet: "UNRESOLVED_RANGE"
  repetitionRecovery: "UNRESOLVED_LONG_FULL_RECOVERY"
  setRecovery: NOT_APPLICABLE
  cooldown: "UNRESOLVED"
  downshiftOptions: [DO_NOT_USE]
  stopConditionCodes: [STOP_UNRESOLVED_DOSE_AND_POPULATION]
  derivedTotals: UNAVAILABLE_DOSE_UNRESOLVED
```

## 8. ATP_PC_INTENT seeds

```yaml
- templateId: AP-SEED-01
  version: "0.1"
  lifecycleStatus: DRAFT
  eligibilityStatus: REVIEW_REQUIRED
  sourceVerificationStatus: POPULATION_INDIRECT
  planningIntent: ATP_PC_INTENT
  plainKoreanName: "가속과 최고속 구간 후보"
  coachingTerm: "Acceleration plus max velocity"
  notationPattern: "3×(15~25m acceleration + 30m max velocity) · r2~5′"
  plainKoreanReading: "짧은 가속과 30미터 최고속 구간을 묶는 스프린트 후보입니다."
  sourceRefs: [SRC-WA-SPRINT-INTRO, SRC-WA-MEDICAL]
  sourcePopulation: "Sprint coaching material; general athlete transfer not established."
  transferLimitations: "Requires sprint-specific human review and structured warm-up; no race-pace conversion."
  allowedEventGroups: []
  draftCandidateEventGroups: [SPRINT]
  allowedExperienceBands: []
  draftExperienceEvidence: SOURCE_AND_HUMAN_MAPPING_REQUIRED
  minorAllowed: false
  guardianOrCoachReview: "COACH_SPRINT_REVIEW_AND_GUARDIAN_POLICY_REQUIRED"
  paceAnchorKinds: [SPRINT_BENCHMARK, COACH_REFERENCE, RPE_ONLY]
  warmup: "WU-SPRINT-15_TO_30_MIN_HUMAN_REVIEW_REQUIRED"
  mainSet: "3 sets x (15_to_25m + 30m)"
  repetitionRecovery: "120_to_300_sec FULL_RECOVERY"
  setRecovery: NOT_APPLICABLE
  cooldown: "CD-SPRINT-REVIEW-REQUIRED"
  downshiftOptions: [REMOVE_MAX_VELOCITY_SEGMENT, REDUCE_SET_COUNT]
  stopConditionCodes: [STOP_IF_D9_BLOCKED_OR_UNKNOWN, STOP_IF_WARMUP_INCOMPLETE, STOP_IF_SPRINT_TECHNIQUE_DEGRADES]
  derivedTotals: "totalRepetitions=6; qualityDistanceM=UNAVAILABLE_DISTANCE_RANGE; recoveryTotalSeconds=UNAVAILABLE_RANGE"

- templateId: AP-SEED-02
  version: "0.1"
  lifecycleStatus: DRAFT
  eligibilityStatus: REVIEW_REQUIRED
  sourceVerificationStatus: POPULATION_INDIRECT
  planningIntent: ATP_PC_INTENT
  plainKoreanName: "20미터 3회씩 두 세트 후보"
  coachingTerm: "Short sprint recovery protocol"
  notationPattern: "2×(3×20m) · r2′"
  plainKoreanReading: "20미터를 세 번 달리고 쉬는 세트를 두 번 하는 연구 프로토콜 후보입니다."
  sourceRefs: [SRC-PMID-37776346]
  sourcePopulation: "Published sprint recovery study; exact participant transfer requires review."
  transferLimitations: "Research protocol is not a youth or public automatic template."
  allowedEventGroups: []
  draftCandidateEventGroups: [SPRINT]
  allowedExperienceBands: []
  draftExperienceEvidence: SOURCE_AND_HUMAN_MAPPING_REQUIRED
  minorAllowed: false
  guardianOrCoachReview: "COACH_SPRINT_AND_SPORTS_SCIENCE_REVIEW_REQUIRED"
  paceAnchorKinds: [SPRINT_BENCHMARK, COACH_REFERENCE]
  warmup: "WU-SPRINT-15_TO_30_MIN_HUMAN_REVIEW_REQUIRED"
  mainSet: "2 sets x 3 reps x 20m"
  repetitionRecovery: "120 sec FULL_RECOVERY"
  setRecovery: "UNRESOLVED"
  cooldown: "CD-SPRINT-REVIEW-REQUIRED"
  downshiftOptions: [REDUCE_REPETITIONS, REMOVE_SECOND_SET]
  stopConditionCodes: [STOP_IF_D9_BLOCKED_OR_UNKNOWN, STOP_IF_WARMUP_INCOMPLETE, STOP_IF_SPRINT_TECHNIQUE_DEGRADES]
  derivedTotals: "totalRepetitions=6; qualityDistanceM=120; repetitionRecoveryOccurrences=4; recoveryTotalSeconds=UNAVAILABLE_SET_RECOVERY"

- templateId: AP-SEED-03
  version: "0.1"
  lifecycleStatus: DRAFT
  eligibilityStatus: REVIEW_REQUIRED
  sourceVerificationStatus: POPULATION_INDIRECT
  planningIntent: ATP_PC_INTENT
  plainKoreanName: "30미터 3회 후보"
  coachingTerm: "Short sprint protocol"
  notationPattern: "3×30m · r3′"
  plainKoreanReading: "30미터를 세 번 달리고 사이마다 3분 회복하는 연구 프로토콜 후보입니다."
  sourceRefs: [SRC-PMID-37776346]
  sourcePopulation: "Published sprint recovery study; exact participant transfer requires review."
  transferLimitations: "No 5K/T/I/RP conversion; not a youth or public automatic template."
  allowedEventGroups: []
  draftCandidateEventGroups: [SPRINT]
  allowedExperienceBands: []
  draftExperienceEvidence: SOURCE_AND_HUMAN_MAPPING_REQUIRED
  minorAllowed: false
  guardianOrCoachReview: "COACH_SPRINT_AND_SPORTS_SCIENCE_REVIEW_REQUIRED"
  paceAnchorKinds: [SPRINT_BENCHMARK, COACH_REFERENCE]
  warmup: "WU-SPRINT-15_TO_30_MIN_HUMAN_REVIEW_REQUIRED"
  mainSet: "1 set x 3 reps x 30m"
  repetitionRecovery: "180 sec FULL_RECOVERY"
  setRecovery: NOT_APPLICABLE
  cooldown: "CD-SPRINT-REVIEW-REQUIRED"
  downshiftOptions: [REDUCE_REPETITIONS, TECHNICAL_RELAXED_FAST]
  stopConditionCodes: [STOP_IF_D9_BLOCKED_OR_UNKNOWN, STOP_IF_WARMUP_INCOMPLETE, STOP_IF_SPRINT_TECHNIQUE_DEGRADES]
  derivedTotals: "totalRepetitions=3; qualityDistanceM=90; recoveryTotalSeconds=360"

- templateId: AP-SEED-04
  version: "0.1"
  lifecycleStatus: DRAFT
  eligibilityStatus: REVIEW_REQUIRED
  sourceVerificationStatus: SOURCE_ADAPTED
  planningIntent: ATP_PC_INTENT
  plainKoreanName: "30미터와 50미터 스프린트 후보"
  coachingTerm: "Mixed short sprint set"
  notationPattern: "4×30m + 4×50m · r2~3′ full recovery"
  plainKoreanReading: "30미터와 50미터 스프린트를 긴 회복과 함께 하는 후보입니다."
  sourceRefs: [SRC-WA-SPRINT-RT]
  sourcePopulation: "Sprint category guidance, adapted product structure."
  transferLimitations: "Exact mixed set is adapted; sprint review required."
  allowedEventGroups: []
  draftCandidateEventGroups: [SPRINT]
  allowedExperienceBands: []
  draftExperienceEvidence: SOURCE_AND_HUMAN_MAPPING_REQUIRED
  minorAllowed: false
  guardianOrCoachReview: "COACH_SPRINT_AND_SPORTS_SCIENCE_REVIEW_REQUIRED"
  paceAnchorKinds: [SPRINT_BENCHMARK, COACH_REFERENCE]
  warmup: "WU-SPRINT-15_TO_30_MIN_HUMAN_REVIEW_REQUIRED"
  mainSet: "1 set x (4 reps x 30m + 4 reps x 50m)"
  repetitionRecovery: "120_to_180_sec FULL_RECOVERY"
  setRecovery: NOT_APPLICABLE
  cooldown: "CD-SPRINT-REVIEW-REQUIRED"
  downshiftOptions: [REMOVE_50M_COMPONENT, REDUCE_REPETITIONS]
  stopConditionCodes: [STOP_IF_D9_BLOCKED_OR_UNKNOWN, STOP_IF_WARMUP_INCOMPLETE, STOP_IF_SPRINT_TECHNIQUE_DEGRADES]
  derivedTotals: "totalRepetitions=8; qualityDistanceM=320; recoveryTotalSeconds=UNAVAILABLE_RANGE"

- templateId: AP-SEED-05
  version: "0.1"
  lifecycleStatus: DRAFT
  eligibilityStatus: REVIEW_REQUIRED
  sourceVerificationStatus: POPULATION_INDIRECT
  planningIntent: ATP_PC_INTENT
  plainKoreanName: "바운드와 30미터 가속 복합 후보"
  coachingTerm: "Plyometric-sprint complex"
  notationPattern: "5×(4 bounds + 30m acceleration)"
  plainKoreanReading: "바운드와 30미터 가속을 묶는 플라이오메트릭 복합 후보입니다."
  sourceRefs: [SRC-WA-SPRINTS]
  sourcePopulation: "Sprint coaching example."
  transferLimitations: "Plyometric complex requires explicit classification and human review; no automatic use."
  allowedEventGroups: []
  draftCandidateEventGroups: [SPRINT]
  allowedExperienceBands: []
  draftExperienceEvidence: SOURCE_AND_HUMAN_MAPPING_REQUIRED
  minorAllowed: false
  guardianOrCoachReview: "MANDATORY_COACH_SPRINT_AND_PLYOMETRIC_REVIEW"
  paceAnchorKinds: [SPRINT_BENCHMARK, COACH_REFERENCE, RPE_ONLY]
  warmup: "WU-SPRINT-15_TO_30_MIN_HUMAN_REVIEW_REQUIRED"
  mainSet: "1 set x 5 reps x (4 bounds + 30m acceleration)"
  repetitionRecovery: "UNRESOLVED_FULL_RECOVERY"
  setRecovery: NOT_APPLICABLE
  cooldown: "CD-SPRINT-REVIEW-REQUIRED"
  downshiftOptions: [REMOVE_BOUNDS, TECHNICAL_RELAXED_FAST, REDUCE_REPETITIONS]
  stopConditionCodes: [STOP_IF_D9_BLOCKED_OR_UNKNOWN, STOP_IF_WARMUP_INCOMPLETE, STOP_IF_PLYOMETRIC_CLASSIFICATION_OR_TECHNIQUE_UNCLEAR]
  derivedTotals: "totalRepetitions=5; qualityDistanceM=150_PLUS_BOUNDS_UNAVAILABLE; recoveryTotalSeconds=UNAVAILABLE"
```

## 9. RECOVERY_INTENT support axis

```yaml
- templateId: RE-SUPPORT-01
  version: "0.1"
  lifecycleStatus: DRAFT
  eligibilityStatus: REVIEW_REQUIRED
  sourceVerificationStatus: PRODUCT_VARIANT
  planningIntent: RECOVERY_INTENT
  plainKoreanName: "완전 휴식 지원 항목"
  coachingTerm: "Rest support"
  notationPattern: "REST"
  plainKoreanReading: "훈련을 배정하지 않는 지원 항목입니다. 회복 완료를 선언하지 않습니다."
  sourceRefs: [SRC-VDOT-GUIDE]
  sourcePopulation: "Product support representation."
  transferLimitations: "Not medical advice or a readiness decision."
  allowedEventGroups: []
  draftCandidateEventGroups: []
  allowedExperienceBands: []
  draftExperienceEvidence: SOURCE_AND_HUMAN_MAPPING_REQUIRED
  minorAllowed: false
  guardianOrCoachReview: "POLICY_REVIEW_REQUIRED"
  paceAnchorKinds: [RPE_ONLY]
  warmup: NOT_APPLICABLE
  mainSet: "no_training_block"
  repetitionRecovery: NOT_APPLICABLE
  setRecovery: NOT_APPLICABLE
  cooldown: NOT_APPLICABLE
  downshiftOptions: [KEEP_CURRENT_COACH_AUTHORED_PLAN]
  stopConditionCodes: [STOP_IF_USED_AS_MEDICAL_CLEARANCE]
  derivedTotals: "qualityDistanceM=0; qualityDurationSeconds=0; no_recovery_score"

- templateId: RE-SUPPORT-02
  version: "0.1"
  lifecycleStatus: DRAFT
  eligibilityStatus: REVIEW_REQUIRED
  sourceVerificationStatus: SOURCE_ADAPTED
  planningIntent: RECOVERY_INTENT
  plainKoreanName: "짧은 매우 편안한 움직임 후보"
  coachingTerm: "Easy movement support"
  notationPattern: "20~30′ very easy"
  plainKoreanReading: "매우 편안한 움직임 후보이며 회복 완료를 뜻하지 않습니다."
  sourceRefs: [SRC-VDOT-PACES]
  sourcePopulation: "Easy/recovery category adapted as support."
  transferLimitations: "No automatic recommendation; no recovery claim."
  allowedEventGroups: []
  draftCandidateEventGroups: []
  allowedExperienceBands: []
  draftExperienceEvidence: SOURCE_AND_HUMAN_MAPPING_REQUIRED
  minorAllowed: false
  guardianOrCoachReview: "POLICY_REVIEW_REQUIRED"
  paceAnchorKinds: [RPE_ONLY]
  warmup: OPTIONAL
  mainSet: "continuous_duration_20_to_30_min"
  repetitionRecovery: NOT_APPLICABLE
  setRecovery: NOT_APPLICABLE
  cooldown: OPTIONAL
  downshiftOptions: [WALK_ONLY, SHORTEN_DURATION]
  stopConditionCodes: [STOP_IF_D9_BLOCKED_OR_UNKNOWN, STOP_IF_EFFORT_NOT_VERY_EASY]
  derivedTotals: "qualityDurationSeconds=UNAVAILABLE_UNTIL_EXACT_DURATION_SELECTED"

- templateId: RE-SUPPORT-03
  version: "0.1"
  lifecycleStatus: DRAFT
  eligibilityStatus: REVIEW_REQUIRED
  sourceVerificationStatus: PRODUCT_VARIANT
  planningIntent: RECOVERY_INTENT
  plainKoreanName: "가벼운 가동성 지원 항목"
  coachingTerm: "Mobility support"
  notationPattern: "mobility-only"
  plainKoreanReading: "가벼운 가동성 활동의 지원 항목이며 치료나 복귀 허가가 아닙니다."
  sourceRefs: [SRC-PRODUCT-RECOVERY-SUPPORT-001]
  sourcePopulation: "No direct session source claimed."
  transferLimitations: "No exercise selection, medical, or rehabilitation instructions."
  allowedEventGroups: []
  draftCandidateEventGroups: []
  allowedExperienceBands: []
  draftExperienceEvidence: SOURCE_AND_HUMAN_MAPPING_REQUIRED
  minorAllowed: false
  guardianOrCoachReview: "POLICY_AND_QUALIFIED_REVIEW_REQUIRED"
  paceAnchorKinds: [RPE_ONLY]
  warmup: NOT_APPLICABLE
  mainSet: "activity_details_unresolved"
  repetitionRecovery: NOT_APPLICABLE
  setRecovery: NOT_APPLICABLE
  cooldown: NOT_APPLICABLE
  downshiftOptions: [STOP_AND_KEEP_CURRENT_PLAN]
  stopConditionCodes: [STOP_IF_TREATED_AS_REHABILITATION_OR_MEDICAL_ADVICE]
  derivedTotals: UNAVAILABLE_ACTIVITY_UNRESOLVED

- templateId: RE-SUPPORT-04
  version: "0.1"
  lifecycleStatus: DRAFT
  eligibilityStatus: REVIEW_REQUIRED
  sourceVerificationStatus: PRODUCT_VARIANT
  planningIntent: RECOVERY_INTENT
  plainKoreanName: "걷기 전환 지원 항목"
  coachingTerm: "Walk support"
  notationPattern: "walk only"
  plainKoreanReading: "달리기 대신 걷기로 바꾸는 지원 항목이며 회복을 판정하지 않습니다."
  sourceRefs: [SRC-PRODUCT-RECOVERY-SUPPORT-001]
  sourcePopulation: "Product support representation."
  transferLimitations: "No duration or medical purpose is set."
  allowedEventGroups: []
  draftCandidateEventGroups: []
  allowedExperienceBands: []
  draftExperienceEvidence: SOURCE_AND_HUMAN_MAPPING_REQUIRED
  minorAllowed: false
  guardianOrCoachReview: "POLICY_REVIEW_REQUIRED"
  paceAnchorKinds: [RPE_ONLY]
  warmup: NOT_APPLICABLE
  mainSet: "walk_duration_unresolved"
  repetitionRecovery: NOT_APPLICABLE
  setRecovery: NOT_APPLICABLE
  cooldown: NOT_APPLICABLE
  downshiftOptions: [STOP_EARLY, KEEP_CURRENT_COACH_AUTHORED_PLAN]
  stopConditionCodes: [STOP_IF_D9_BLOCKED_OR_UNKNOWN, STOP_IF_TREATED_AS_CLEARANCE]
  derivedTotals: UNAVAILABLE_DURATION_UNRESOLVED

- templateId: RE-SUPPORT-05
  version: "0.1"
  lifecycleStatus: DRAFT
  eligibilityStatus: REVIEW_REQUIRED
  sourceVerificationStatus: REJECTED_OR_UNUSABLE
  planningIntent: RECOVERY_INTENT
  plainKoreanName: "코치 확인 대기 지원 상태"
  coachingTerm: "Hold for review"
  notationPattern: "REVIEW_REQUIRED"
  plainKoreanReading: "회복 훈련을 대신 배정하지 않고 현재 계획을 유지하며 확인을 기다립니다."
  sourceRefs: [SRC-PRODUCT-RECOVERY-SUPPORT-001]
  sourcePopulation: "Product safety-support state, not a training protocol."
  transferLimitations: "Not a workout and not a safety clearance."
  allowedEventGroups: []
  draftCandidateEventGroups: []
  allowedExperienceBands: []
  draftExperienceEvidence: SOURCE_AND_HUMAN_MAPPING_REQUIRED
  minorAllowed: false
  guardianOrCoachReview: "MANDATORY_HUMAN_REVIEW"
  paceAnchorKinds: [RPE_ONLY]
  warmup: NOT_APPLICABLE
  mainSet: "no_training_block"
  repetitionRecovery: NOT_APPLICABLE
  setRecovery: NOT_APPLICABLE
  cooldown: NOT_APPLICABLE
  downshiftOptions: [KEEP_CURRENT_COACH_AUTHORED_PLAN]
  stopConditionCodes: [STOP_IF_AUTOMATIC_SUBSTITUTE_PLAN_IS_CREATED]
  derivedTotals: "no_training_totals; no_recovery_score"
```

## 10. Required human review before any later activation

```yaml
activation_requirements:
  all_numeric_templates:
    - coach_review_of_event_experience_and_current_context
    - sports_science_review_of_source_and_transfer_limitations
    - explicit_lifecycle_change_from_DRAFT
    - separate_active_template_approval_record
  minor_related_use:
    - accepted_minor_policy
    - guardian_consent_when_policy_requires
    - named_human_reviewer
  runtime:
    - accepted_template_library_binding
    - safety_gate_runtime_evidence
    - parser_and_calculation_contract_tests
    - no_D9_ACTIVE_or_UNKNOWN_bypass
```

[DRAFT_COMPLETE]
