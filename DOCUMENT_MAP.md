# DOCUMENT_MAP.md - 문서 지도

이 지도는 git 경로, 파일명, 수정 이력으로 만든 기계적 색인입니다. 문서의 승인·정본·폐기 여부를 새로 판정하지 않습니다.

이 색인의 기준일은 2026-07-29입니다. **현재 공개 상태와 최신 배포 영수증은**
[`reports/operations/BETA_RELEASE_HANDOFF_2026-08-02.md`](./reports/operations/BETA_RELEASE_HANDOFF_2026-08-02.md)의
`현재 배포 상태 갱신` 절에서 확인합니다. 이 지도 안의 `현재-인계` 분류는
작성 당시의 색인 분류이며, 기능 공개 여부를 뜻하지 않습니다.

- 작성 기준 main SHA: 7d9958aad66859de2125ade4023436a09cb0da00
- 작성일: 2026-07-29
- 대상 문서 수: 252
- 제외한 .omo/ 문서 수: 186
- 분류 규칙: `WORK_ORDER_C_DOC_CLEANUP.md`의 PR #139 교정본

## 먼저 읽을 문서

| 순서 | 문서 | 용도 |
|---:|---|---|
| 1 | PRODUCT_NORTH_STAR.md | 제품 최고 지침 |
| 2 | README.md | 저장소 안내 |
| 3 | reports/operations/BETA_RELEASE_HANDOFF_2026-08-02.md | 현재 공개 상태와 최신 배포 영수증 |
| 4 | CURRENT_IMPLEMENTATION_HANDOFF_2026-07-27.md | 2026-07-27 상세 구현 기록 |
| 5 | TRAINORACLE_SPEC_INDEX.md | 스펙 색인 |

## 상태별 개수

| 상태 | 개수 |
|---|---:|
| 현재-길잡이 | 14 |
| 현재-인계 | 1 |
| 과거-인계 | 7 |
| 현재-스펙 | 9 |
| 재구성-초안 | 28 |
| 레거시-참고 | 7 |
| 테스트-패키지 | 9 |
| 작업지시 | 10 |
| 작업기록 | 96 |
| 구현-인접문서 | 0 |
| 검토필요 | 71 |
| **합계** | **252** |

## 문서군별 개수

| 문서군 | 개수 |
|---|---:|
| SPEC_ACTIVE | 9 |
| SPEC_RECONSTRUCT | 29 |
| SPEC_LEGACY | 7 |
| SPEC_TEST | 9 |
| REPORT | 103 |
| APP_DOC | 1 |
| IMPL_DOC | 1 |
| WORK_ORDER | 10 |
| ROOT_GUIDE_OR_RECORD | 65 |
| OTHER | 18 |
| **합계** | **252** |

## 주제별 개수

주제는 복수 집계이므로 합계가 대상 문서 수와 같지 않을 수 있습니다.

| 주제 | 개수 |
|---|---:|
| 안전규칙 | 12 |
| 일지·위험신호 | 12 |
| 분석·시각화 | 4 |
| 훈련계획 | 73 |
| 처방·템플릿 | 16 |
| 계정·프라이버시 | 18 |
| 연구근거 | 40 |
| 디자인·접근성 | 15 |
| 작업관리 | 60 |
| 기타 | 79 |

## 전체 목록

| 수정일 | 상태 | 문서군 | 주제(복수 가능) | 경로 |
|---|---|---|---|---|
| 2026-07-27 | 검토필요 | OTHER | 연구근거 | .ultra/docs/research/TRAINING_SCHEDULE_PUBLIC_SOURCES_2026-07.md |
| 2026-07-27 | 현재-인계 | ROOT_GUIDE_OR_RECORD | 작업관리 | CURRENT_IMPLEMENTATION_HANDOFF_2026-07-27.md |
| 2026-07-27 | 검토필요 | ROOT_GUIDE_OR_RECORD | 처방·템플릿, 작업관리 | DECISION_BRIEFING_PERSONAL_PACE.md |
| 2026-07-27 | 검토필요 | ROOT_GUIDE_OR_RECORD | 디자인·접근성 | DESIGN.md |
| 2026-07-27 | 검토필요 | ROOT_GUIDE_OR_RECORD | 훈련계획, 처방·템플릿 | PLAN_A_FIRST_TEMPLATE_ACTIVATION.md |
| 2026-07-27 | 현재-길잡이 | ROOT_GUIDE_OR_RECORD | 기타 | PRODUCT_NORTH_STAR.md |
| 2026-07-27 | 현재-길잡이 | ROOT_GUIDE_OR_RECORD | 기타 | README.md |
| 2026-07-27 | 작업기록 | REPORT | 처방·템플릿 | reports/implementation/DAILY_AVAILABILITY_AND_DOUBLE_SESSION_BETA_IMPLEMENTATION_REPORT_2026-07-27.md |
| 2026-07-27 | 작업기록 | REPORT | 연구근거 | reports/research/README_TRAINING_SCHEDULE_RESEARCH.md |
| 2026-07-27 | 작업기록 | REPORT | 연구근거, 작업관리 | reports/research/TRAINING_SCHEDULE_RESEARCH_ACCEPTANCE_DECISION.md |
| 2026-07-27 | 작업기록 | REPORT | 연구근거 | reports/research/TRAINING_SCHEDULE_SOURCE_INDEX_2026-07.md |
| 2026-07-27 | 작업기록 | REPORT | 작업관리 | reports/review/NEXT_TURN_READINESS_VERIFICATION_2026-07-27.md |
| 2026-07-27 | 작업기록 | REPORT | 기타 | reports/review/SPEC_TO_BETA_PERSONALIZATION_ALIGNMENT_AUDIT_2026-07-27.md |
| 2026-07-27 | 과거-인계 | REPORT | 작업관리 | reports/work-harness/NEXT_WORKER_HANDOFF.md |
| 2026-07-27 | 재구성-초안 | SPEC_RECONSTRUCT | 안전규칙, 처방·템플릿 | specs/reconstruct/DOUBLE_SESSION_BETA_SAFETY_CONTRACT.md |
| 2026-07-27 | 현재-길잡이 | ROOT_GUIDE_OR_RECORD | 기타 | TRAINORACLE_SPEC_INDEX.md |
| 2026-07-27 | 작업지시 | WORK_ORDER | 작업관리 | WORK_ORDER_C_DOC_CLEANUP.md |
| 2026-07-26 | 검토필요 | OTHER | 계정·프라이버시 | docs/ACCOUNT_PUBLIC_RELEASE_GATE.md |
| 2026-07-26 | 검토필요 | OTHER | 기타 | docs/SUPABASE_SETUP.md |
| 2026-07-26 | 검토필요 | ROOT_GUIDE_OR_RECORD | 작업관리 | LAUNCH_READINESS_2026-07-25.md |
| 2026-07-26 | 검토필요 | ROOT_GUIDE_OR_RECORD | 기타 | MIGRATION_0002_RUNBOOK.md |
| 2026-07-26 | 작업기록 | REPORT | 기타 | reports/implementation/ABANDONED_WORK_SWEEP_2026-07-25.md |
| 2026-07-26 | 작업기록 | REPORT | 처방·템플릿 | reports/implementation/DETAILED_PRESCRIPTION_RUNTIME_IMPLEMENTATION_REPORT_2026-07-26.md |
| 2026-07-26 | 작업기록 | REPORT | 처방·템플릿 | reports/implementation/DETAILED_PRESCRIPTION_TERRA_IMPLEMENTATION_REPORT.md |
| 2026-07-26 | 작업기록 | REPORT | 기타 | reports/implementation/DEVICE_DATA_IMPORT_PREP_2026-07-24.md |
| 2026-07-26 | 작업기록 | REPORT | 기타 | reports/implementation/DEVICE_IMPORT_FEASIBILITY_2026-07-25.md |
| 2026-07-26 | 작업기록 | REPORT | 기타 | reports/implementation/DEVICE_IMPORT_FILE_PATH_2026-07-25.md |
| 2026-07-26 | 작업기록 | REPORT | 기타 | reports/review/ADVERSARIAL_AUDIT_2026-07-25.md |
| 2026-07-26 | 작업기록 | REPORT | 처방·템플릿 | reports/review/DETAILED_PRESCRIPTION_PR_RECONCILIATION_RESULT.md |
| 2026-07-26 | 작업기록 | REPORT | 기타 | reports/review/DEVELOPMENT_STATUS_AND_NEXT_GATE_2026-07-26.md |
| 2026-07-26 | 작업기록 | REPORT | 기타 | reports/review/MERGED_WORK_AUDIT_AND_PROCESS_PROPOSAL_2026-07-26.md |
| 2026-07-26 | 작업기록 | REPORT | 기타 | reports/review/OPEN_PR_TRIAGE_2026-07-26.md |
| 2026-07-26 | 작업기록 | REPORT | 훈련계획, 처방·템플릿 | reports/review/PLAN_PRESCRIPTION_DETAIL_GAP_2026-07-26.md |
| 2026-07-26 | 작업기록 | REPORT | 기타 | reports/review/PR118_C_PUBLIC_RELEASE_AUDIT_2026-07-26.md |
| 2026-07-26 | 재구성-초안 | SPEC_RECONSTRUCT | 처방·템플릿 | specs/reconstruct/ENERGY_SYSTEM_SESSION_TEMPLATE_CATALOG.md |
| 2026-07-26 | 재구성-초안 | SPEC_RECONSTRUCT | 처방·템플릿 | specs/reconstruct/TRAINING_SESSION_PRESCRIPTION_CONTRACT.md |
| 2026-07-26 | 검토필요 | ROOT_GUIDE_OR_RECORD | 처방·템플릿, 작업관리 | TERRA_WORK_ORDER_019_DETAILED_PRESCRIPTION_RUNTIME.md |
| 2026-07-24 | 검토필요 | ROOT_GUIDE_OR_RECORD | 훈련계획, 작업관리 | PLAN_BETA_PRODUCT_DECISION_2026_07_24.md |
| 2026-07-24 | 작업기록 | REPORT | 훈련계획, 계정·프라이버시 | reports/implementation/ACCOUNT_SYNC_PLAN_2026-07-24.md |
| 2026-07-24 | 작업기록 | REPORT | 기타 | reports/implementation/LAUNCH_READY_IMPLEMENTATION_REPORT_2026-07-23.md |
| 2026-07-24 | 작업기록 | REPORT | 훈련계획 | reports/implementation/PLAN_BETA_ENGINE_TERRA_REPORT_2026-07-24.md |
| 2026-07-24 | 작업기록 | REPORT | 훈련계획 | reports/implementation/PLAN_BETA_PUBLIC_IMPLEMENTATION_REPORT_2026-07-24.md |
| 2026-07-24 | 현재-길잡이 | REPORT | 기타 | reports/work-harness/README.md |
| 2026-07-22 | 작업기록 | REPORT | 작업관리 | reports/review/WO012_SPEC_LINKAGE_MATRIX.md |
| 2026-07-21 | 작업기록 | REPORT | 처방·템플릿, 작업관리 | reports/review/WO012_COACH_DECISION_RESPONSE_TEMPLATE.md |
| 2026-07-21 | 작업기록 | REPORT | 작업관리 | reports/review/WO012_COACH_OWNER_WALKTHROUGH.md |
| 2026-07-21 | 테스트-패키지 | SPEC_TEST | 훈련계획 | specs/test-packages/FORMATION_COACH_RULESET_FIXTURES.md |
| 2026-07-20 | 작업기록 | REPORT | 훈련계획, 연구근거 | reports/research/evidence/FORMATION_SOURCE_AUDIT_EXECUTION_20260720.md |
| 2026-07-20 | 과거-인계 | REPORT | 훈련계획, 작업관리 | reports/review/FORMATION_LATEST_DECISION_RECONCILIATION_HANDOFF.md |
| 2026-07-20 | 작업기록 | REPORT | 기타 | reports/review/PR90_FABLE_INDEPENDENT_REVIEW.md |
| 2026-07-20 | 작업기록 | REPORT | 계정·프라이버시, 작업관리 | reports/review/SELECTIVE_EXPORT_SPEC_PATCH_DECISION_2026-07-19.md |
| 2026-07-20 | 재구성-초안 | SPEC_RECONSTRUCT | 일지·위험신호 | specs/reconstruct/DAILY_LOG_AND_CHECKIN_SPEC.md |
| 2026-07-20 | 재구성-초안 | SPEC_RECONSTRUCT | 안전규칙, 일지·위험신호 | specs/reconstruct/NOTE_SAFETY_SIGNAL_AND_REVIEW_STATE_CONTRACT.md |
| 2026-07-19 | 검토필요 | ROOT_GUIDE_OR_RECORD | 기타 | FABLE_CODEX_JOINT_PLANNING_BRIEF.md |
| 2026-07-19 | 검토필요 | ROOT_GUIDE_OR_RECORD | 훈련계획 | FORMATION_DEFERRED_GOALS.md |
| 2026-07-19 | 검토필요 | ROOT_GUIDE_OR_RECORD | 훈련계획 | FORMATION_READ_NOW_DECIDE_LATER.md |
| 2026-07-19 | 검토필요 | ROOT_GUIDE_OR_RECORD | 훈련계획, 연구근거, 작업관리 | FORMATION_RESEARCH_ACCEPTANCE_DECISION.md |
| 2026-07-19 | 검토필요 | ROOT_GUIDE_OR_RECORD | 작업관리 | RACE_SELFCHECK_FIELDS_DECISION.md |
| 2026-07-19 | 작업기록 | REPORT | 훈련계획, 연구근거 | reports/research/FORMATION_SPORTS_SCIENCE_EVIDENCE_REVIEW.md |
| 2026-07-19 | 작업기록 | REPORT | 훈련계획, 작업관리 | reports/review/FORMATION_COMPETITION_ANCHOR_DECISION_PACKET_V1.md |
| 2026-07-19 | 작업기록 | REPORT | 훈련계획, 작업관리 | reports/review/FORMATION_COMPETITION_RECORD_IDENTITY_OWNER_DECISION.md |
| 2026-07-19 | 작업기록 | REPORT | 훈련계획, 작업관리 | reports/review/FORMATION_LATEST_OWNER_DECISION_BASELINE.md |
| 2026-07-19 | 작업기록 | REPORT | 훈련계획, 작업관리 | reports/review/FORMATION_LOAD_COMPONENT_DECISION_PACKET_V2.md |
| 2026-07-19 | 작업기록 | REPORT | 훈련계획, 연구근거, 작업관리 | reports/review/FORMATION_MINIMUM_EVIDENCE_DECISION_PACKET_V2.md |
| 2026-07-19 | 작업기록 | REPORT | 훈련계획 | reports/review/FORMATION_OWNER_DIRECTION_BINDING_2026-07-18.md |
| 2026-07-19 | 작업기록 | REPORT | 작업관리 | reports/review/OWNER_DECISION_INTAKE_2026-07-18.md |
| 2026-07-19 | 작업기록 | REPORT | 기타 | reports/review/PR86_FABLE_INDEPENDENT_REVIEW.md |
| 2026-07-19 | 작업기록 | REPORT | 기타 | reports/target-patch-plans/01-coach-ruleset.md |
| 2026-07-19 | 작업기록 | REPORT | 기타 | reports/target-patch-plans/02-load-component.md |
| 2026-07-19 | 작업기록 | REPORT | 연구근거 | reports/target-patch-plans/03-minimum-evidence.md |
| 2026-07-19 | 작업기록 | REPORT | 훈련계획 | reports/target-patch-plans/04-plan-version-binding.md |
| 2026-07-19 | 작업기록 | REPORT | 기타 | reports/target-patch-plans/05-pilot-protocol.md |
| 2026-07-19 | 작업기록 | REPORT | 훈련계획 | reports/target-patch-plans/06-calendar-schema-binding.md |
| 2026-07-19 | 작업기록 | REPORT | 안전규칙, 계정·프라이버시 | reports/target-patch-plans/07-upstream-safety-privacy-binding.md |
| 2026-07-19 | 작업기록 | REPORT | 안전규칙 | reports/target-patch-plans/08-rule-classifier-exposure-binding.md |
| 2026-07-19 | 작업기록 | REPORT | 기타 | reports/target-patch-plans/09-product-projection.md |
| 2026-07-19 | 작업기록 | REPORT | 기타 | reports/target-patch-plans/10-record-governance.md |
| 2026-07-19 | 현재-길잡이 | REPORT | 기타 | reports/target-patch-plans/README.md |
| 2026-07-19 | 재구성-초안 | SPEC_RECONSTRUCT | 기타 | specs/reconstruct/HUMAN_REVIEW_AND_SHARING_WORKFLOW.md |
| 2026-07-19 | 검토필요 | ROOT_GUIDE_OR_RECORD | 훈련계획 | TRAINING_PLAN_BLUEPRINT_MULTIPERSPECTIVE_REVIEW.md |
| 2026-07-19 | 검토필요 | ROOT_GUIDE_OR_RECORD | 훈련계획, 작업관리 | TRAINING_PLAN_METHOD_DECISION.md |
| 2026-07-18 | 작업기록 | REPORT | 일지·위험신호, 훈련계획, 연구근거 | reports/research/evidence/FORMATION_SEARCH_LOG.md |
| 2026-07-18 | 작업기록 | REPORT | 일지·위험신호, 훈련계획, 연구근거 | reports/research/evidence/FORMATION_SUPPLEMENTAL_SEARCH_LOG_20260717.md |
| 2026-07-18 | 작업기록 | REPORT | 훈련계획, 연구근거 | reports/research/FORMATION_COMPETITION_ANCHOR_EVIDENCE_SUPPLEMENT.md |
| 2026-07-18 | 작업기록 | REPORT | 훈련계획, 연구근거 | reports/research/FORMATION_COMPOSITE_AND_LOAD_EVIDENCE_REVIEW.md |
| 2026-07-18 | 작업기록 | REPORT | 훈련계획, 연구근거 | reports/research/FORMATION_COUNTEREVIDENCE_AND_UNCERTAINTY_REVIEW.md |
| 2026-07-18 | 작업기록 | REPORT | 훈련계획, 연구근거 | reports/research/FORMATION_FRAME_RECOVERY_EVIDENCE_REVIEW_V2.md |
| 2026-07-18 | 작업기록 | REPORT | 훈련계획, 연구근거 | reports/research/FORMATION_MINIMUM_EVIDENCE_METHODS_REVIEW.md |
| 2026-07-18 | 작업기록 | REPORT | 일지·위험신호, 훈련계획, 연구근거 | reports/research/FORMATION_PROTOCOL_AMENDMENT_LOG.md |
| 2026-07-18 | 작업기록 | REPORT | 훈련계획, 연구근거 | reports/research/FORMATION_RESEARCH_PROTOCOL_V2.md |
| 2026-07-18 | 작업기록 | REPORT | 훈련계획, 연구근거 | reports/research/FORMATION_YOUTH_TRANSFER_AND_PILOT_REVIEW.md |
| 2026-07-18 | 작업기록 | REPORT | 훈련계획 | reports/review/FORMATION_HUMAN_REVIEW_ATTESTATION_CONTRACT.md |
| 2026-07-18 | 작업기록 | REPORT | 훈련계획, 작업관리 | reports/review/FORMATION_LATEST_DECISION_AND_USER_GAP_AUDIT_V2.md |
| 2026-07-18 | 작업기록 | REPORT | 훈련계획, 연구근거 | reports/review/FORMATION_RESEARCH_OWNER_BRIEF_KO.md |
| 2026-07-18 | 작업기록 | REPORT | 훈련계획, 연구근거 | reports/review/FORMATION_RESEARCH_TECHNICAL_ANNEX.md |
| 2026-07-18 | 작업기록 | REPORT | 훈련계획 | reports/review/FORMATION_USER_SCENARIOS_AND_TEACH_BACK_V1.md |
| 2026-07-18 | 작업기록 | REPORT | 훈련계획 | reports/review/FORMATION_USER_SPEC_ALIGNMENT_REVIEW.md |
| 2026-07-18 | 작업기록 | REPORT | 기타 | reports/review/PR81_FABLE_INDEPENDENT_REVIEW.md |
| 2026-07-18 | 작업기록 | REPORT | 기타 | reports/review/PR82_FABLE_INDEPENDENT_REVIEW.md |
| 2026-07-18 | 작업기록 | REPORT | 기타 | reports/review/PR84_FABLE_INDEPENDENT_REVIEW.md |
| 2026-07-18 | 검토필요 | ROOT_GUIDE_OR_RECORD | 기타 | SPEC_WORK_STATUS.md |
| 2026-07-18 | 현재-스펙 | SPEC_ACTIVE | 처방·템플릿 | specs/active/SESSION_INTENSITY_ASSESSMENT_SPEC.md |
| 2026-07-16 | 검토필요 | ROOT_GUIDE_OR_RECORD | 훈련계획, 계정·프라이버시, 작업관리 | FORMATION_CALENDAR_SYNC_ACCEPTANCE_DECISION.md |
| 2026-07-16 | 검토필요 | ROOT_GUIDE_OR_RECORD | 훈련계획, 작업관리 | FORMATION_COACH_RULESET_ACCEPTANCE_DECISION.md |
| 2026-07-16 | 검토필요 | ROOT_GUIDE_OR_RECORD | 훈련계획, 계정·프라이버시, 작업관리 | FORMATION_PRIVACY_GOVERNANCE_DECISION.md |
| 2026-07-16 | 검토필요 | ROOT_GUIDE_OR_RECORD | 훈련계획, 작업관리 | FORMATION_PRODUCT_PROJECTION_ACCEPTANCE_DECISION.md |
| 2026-07-16 | 검토필요 | ROOT_GUIDE_OR_RECORD | 훈련계획, 작업관리 | FORMATION_RUNTIME_READINESS_DECISION.md |
| 2026-07-16 | 검토필요 | ROOT_GUIDE_OR_RECORD | 훈련계획, 작업관리 | FORMATION_SHADOW_PROTOCOL_ACCEPTANCE_DECISION.md |
| 2026-07-16 | 작업기록 | REPORT | 분석·시각화, 연구근거 | reports/research/RACE_DESCRIPTIVE_ANALYSIS_REVIEW.md |
| 2026-07-16 | 작업기록 | REPORT | 훈련계획, 작업관리 | reports/review/COACH_TEAM_AND_MICROCYCLE_VIEW_DECISION.md |
| 2026-07-16 | 작업기록 | REPORT | 훈련계획, 디자인·접근성 | reports/review/FORMATION_ACCESSIBILITY_AND_DESIGN_REVIEW.md |
| 2026-07-16 | 작업기록 | REPORT | 훈련계획 | reports/review/FORMATION_FORMAL_APPROVAL_ROSTER.md |
| 2026-07-16 | 작업기록 | REPORT | 훈련계획 | reports/review/FORMATION_FORMAL_GATE_STATUS.md |
| 2026-07-16 | 작업기록 | REPORT | 훈련계획, 계정·프라이버시 | reports/review/FORMATION_RUNTIME_SECURITY_AND_PRIVACY_AUDIT.md |
| 2026-07-16 | 작업기록 | REPORT | 작업관리 | reports/review/MULTITAB_REFRESH_AND_REVISION_DECISION.md |
| 2026-07-16 | 작업기록 | REPORT | 계정·프라이버시 | reports/review/PRIVACY_YOUTH_QUALIFIED_REVIEW_PACKET.md |
| 2026-07-16 | 작업기록 | REPORT | 일지·위험신호, 연구근거 | reports/review/QUICK_LOG_PRESET_RESEARCH.md |
| 2026-07-16 | 과거-인계 | REPORT | 작업관리 | reports/review/WO010_STRICT_REACCEPTANCE_HANDOFF.md |
| 2026-07-16 | 작업기록 | REPORT | 작업관리 | reports/review/WO011_PRODUCT_FACT_QUESTIONNAIRE.md |
| 2026-07-16 | 과거-인계 | REPORT | 계정·프라이버시, 작업관리 | reports/review/WO011_QUALIFIED_PRIVACY_REVIEW_HANDOFF.md |
| 2026-07-16 | 작업기록 | REPORT | 훈련계획, 작업관리 | reports/review/WO013_REPOSITORY_TARGET_BINDING_PLAN.md |
| 2026-07-16 | 작업기록 | REPORT | 작업관리 | reports/review/WO014_ATHLETE_PARTICIPANT_MATERIALS.md |
| 2026-07-16 | 작업기록 | REPORT | 작업관리 | reports/review/WO014_INDEPENDENT_REVIEW_FORMS.md |
| 2026-07-16 | 과거-인계 | REPORT | 작업관리 | reports/review/WO015_PROJECTION_REVIEW_HANDOFF.md |
| 2026-07-16 | 현재-길잡이 | OTHER | 훈련계획, 연구근거 | runtime-evidence/formation-shadow/README.md |
| 2026-07-16 | 검토필요 | OTHER | 훈련계획, 연구근거 | runtime-evidence/formation-shadow/SYNTHETIC_GATE_VERIFIER_DRY_RUN.md |
| 2026-07-16 | 검토필요 | OTHER | 훈련계획, 연구근거, 작업관리 | runtime-evidence/formation-shadow/SYNTHETIC_READINESS_DRY_RUN.md |
| 2026-07-16 | 재구성-초안 | SPEC_RECONSTRUCT | 기타 | specs/reconstruct/ATHLETE_VISIBLE_SHADOW_PILOT_PROTOCOL.md |
| 2026-07-16 | 재구성-초안 | SPEC_RECONSTRUCT | 훈련계획, 계정·프라이버시 | specs/reconstruct/CALENDAR_VERSION_AND_SYNC_CONTRACT.md |
| 2026-07-16 | 재구성-초안 | SPEC_RECONSTRUCT | 연구근거 | specs/reconstruct/EVIDENCE_MANIFEST_AND_SIGNATURE_CONTRACT.md |
| 2026-07-16 | 재구성-초안 | SPEC_RECONSTRUCT | 훈련계획 | specs/reconstruct/FORMATION_COACH_RULESET_AND_EXPOSURE_CONTRACT.md |
| 2026-07-16 | 재구성-초안 | SPEC_RECONSTRUCT | 훈련계획 | specs/reconstruct/FORMATION_LOAD_AND_STATISTICAL_RULES_CONTRACT.md |
| 2026-07-16 | 재구성-초안 | SPEC_RECONSTRUCT | 훈련계획 | specs/reconstruct/FORMATION_PRODUCT_PROJECTION_AND_EXPLANATION_CONTRACT.md |
| 2026-07-16 | 재구성-초안 | SPEC_RECONSTRUCT | 훈련계획 | specs/reconstruct/FORMATION_RECORD_GOVERNANCE_CONTRACT.md |
| 2026-07-16 | 테스트-패키지 | SPEC_TEST | 훈련계획, 계정·프라이버시 | specs/test-packages/CALENDAR_SYNC_CONCURRENCY_FIXTURE_PLAN.md |
| 2026-07-16 | 테스트-패키지 | SPEC_TEST | 훈련계획, 계정·프라이버시 | specs/test-packages/FORMATION_PRIVACY_GOVERNANCE_FIXTURES.md |
| 2026-07-16 | 테스트-패키지 | SPEC_TEST | 훈련계획, 디자인·접근성 | specs/test-packages/FORMATION_PROJECTION_ACCESSIBILITY_TEST_PACKAGE.md |
| 2026-07-16 | 테스트-패키지 | SPEC_TEST | 훈련계획, 연구근거 | specs/test-packages/FORMATION_RESEARCH_CALCULATION_FIXTURES.md |
| 2026-07-16 | 테스트-패키지 | SPEC_TEST | 훈련계획 | specs/test-packages/FORMATION_RUNTIME_INTEGRATION_TEST_PACKAGE.md |
| 2026-07-16 | 테스트-패키지 | SPEC_TEST | 기타 | specs/test-packages/SHADOW_PROTOCOL_SCENARIO_PACKAGE.md |
| 2026-07-15 | 작업기록 | REPORT | 기타 | reports/review/ORDER_007_TASK_R_CLOSURE_AUDIT.md |
| 2026-07-15 | 검토필요 | ROOT_GUIDE_OR_RECORD | 기타 | SPEC_AUTHORITY_AND_RECOVERY_LEDGER.md |
| 2026-07-14 | 검토필요 | ROOT_GUIDE_OR_RECORD | 계정·프라이버시, 작업관리 | ACCOUNT_FEDERATION_DECISION.md |
| 2026-07-14 | 작업지시 | WORK_ORDER | 작업관리 | CODEX_WORK_ORDER_009.md |
| 2026-07-14 | 검토필요 | ROOT_GUIDE_OR_RECORD | 작업관리 | DATA_PROVENANCE_RUNTIME_ADOPTION_DECISION.md |
| 2026-07-14 | 검토필요 | ROOT_GUIDE_OR_RECORD | 훈련계획, 계정·프라이버시 | LAUNCH_BACKEND_AND_ACCOUNT_PLAN.md |
| 2026-07-14 | 작업기록 | REPORT | 기타 | reports/review/DRAFT_MARKER_AUDIT.md |
| 2026-07-14 | 작업기록 | REPORT | 기타 | reports/review/PR64_CODEX_PREMERGE_QUESTIONS.md |
| 2026-07-14 | 작업기록 | REPORT | 기타 | reports/review/PR64_FABLE_INDEPENDENT_REVIEW.md |
| 2026-07-14 | 검토필요 | ROOT_GUIDE_OR_RECORD | 기타 | SPEC_DOCUMENTATION_REPORT.md |
| 2026-07-14 | 검토필요 | ROOT_GUIDE_OR_RECORD | 일지·위험신호, 훈련계획 | SPEC_LEGACY_ALIGNMENT_AND_DAILY_LOG_PLAN.md |
| 2026-07-14 | 검토필요 | ROOT_GUIDE_OR_RECORD | 기타 | SPEC_OVERVIEW_FOR_HOJUNE.md |
| 2026-07-14 | 검토필요 | ROOT_GUIDE_OR_RECORD | 기타 | SPEC_REVIEW_PACKET.md |
| 2026-07-14 | 검토필요 | ROOT_GUIDE_OR_RECORD | 기타 | SPEC_TARGET_PATCH_MATRIX.md |
| 2026-07-14 | 검토필요 | ROOT_GUIDE_OR_RECORD | 작업관리 | SPEC_TARGET_PATCH_READINESS.md |
| 2026-07-14 | 검토필요 | ROOT_GUIDE_OR_RECORD | 안전규칙 | SPEC_WAVEB_SAFETY_GATE_PATCH_REPORT.md |
| 2026-07-14 | 재구성-초안 | SPEC_RECONSTRUCT | 일지·위험신호 | specs/reconstruct/DAILY_BRIEF_AND_INBOX_SIGNAL_SPEC.md |
| 2026-07-14 | 재구성-초안 | SPEC_RECONSTRUCT | 계정·프라이버시 | specs/reconstruct/FEDERATED_ACCOUNT_SSO_CONTRACT.md |
| 2026-07-14 | 재구성-초안 | SPEC_RECONSTRUCT | 일지·위험신호 | specs/reconstruct/JOURNAL_DELIGHT_AND_DECORATION_SPEC.md |
| 2026-07-14 | 현재-길잡이 | SPEC_RECONSTRUCT | 기타 | specs/reconstruct/README.md |
| 2026-07-14 | 재구성-초안 | SPEC_RECONSTRUCT | 훈련계획 | specs/reconstruct/TRAINING_PLAN_FORMATION_AND_ADAPTATION_SPEC.md |
| 2026-07-14 | 테스트-패키지 | SPEC_TEST | 일지·위험신호 | specs/test-packages/QUICK_LOG_TAP_BUDGET_TEST_PACKAGE.md |
| 2026-07-13 | 작업지시 | WORK_ORDER | 작업관리 | CODEX_WORK_ORDER_008.md |
| 2026-07-13 | 검토필요 | ROOT_GUIDE_OR_RECORD | 훈련계획 | PLAN_F0F_TASKR_HARDENING.md |
| 2026-07-13 | 작업기록 | REPORT | 기타 | reports/review/ORDER_007_R_a11y.md |
| 2026-07-13 | 작업기록 | REPORT | 기타 | reports/review/ORDER_007_R_coach.md |
| 2026-07-13 | 작업기록 | REPORT | 기타 | reports/review/ORDER_007_R_frontend.md |
| 2026-07-13 | 작업기록 | REPORT | 기타 | reports/review/ORDER_007_R_motivation.md |
| 2026-07-13 | 작업기록 | REPORT | 기타 | reports/review/ORDER_007_R_parent.md |
| 2026-07-13 | 작업기록 | REPORT | 계정·프라이버시 | reports/review/ORDER_007_R_privacy.md |
| 2026-07-13 | 작업기록 | REPORT | 안전규칙 | reports/review/ORDER_007_R_safety.md |
| 2026-07-13 | 작업기록 | REPORT | 기타 | reports/review/ORDER_007_R_student.md |
| 2026-07-13 | 작업기록 | REPORT | 기타 | reports/review/ORDER_007_R_SUMMARY.md |
| 2026-07-12 | 작업기록 | REPORT | 기타 | reports/review/CODEX_PARALLEL_IMPROVEMENT_DISCOVERY_20260711.md |
| 2026-07-12 | 작업기록 | REPORT | 기타 | reports/review/TAP_FIRST_V1_PERSONA_REVIEW.md |
| 2026-07-12 | 검토필요 | ROOT_GUIDE_OR_RECORD | 기타 | SPEC_GUIDE_MINJI_STORY.md |
| 2026-07-12 | 검토필요 | ROOT_GUIDE_OR_RECORD | 기타 | SPEC_TAP_FIRST_LOGGING.md |
| 2026-07-10 | 검토필요 | ROOT_GUIDE_OR_RECORD | 기타 | ATHLETETIME_INTEGRATION_REVIEW.md |
| 2026-07-10 | 작업지시 | WORK_ORDER | 작업관리 | CODEX_WORK_ORDER_004.md |
| 2026-07-10 | 작업지시 | WORK_ORDER | 작업관리 | CODEX_WORK_ORDER_005.md |
| 2026-07-10 | 작업지시 | WORK_ORDER | 작업관리 | CODEX_WORK_ORDER_006.md |
| 2026-07-10 | 작업지시 | WORK_ORDER | 작업관리 | CODEX_WORK_ORDER_007.md |
| 2026-07-10 | 작업기록 | REPORT | 기타 | reports/LEGACY_V1_KIT_DISPOSITION_PROPOSAL.md |
| 2026-07-10 | 검토필요 | ROOT_GUIDE_OR_RECORD | 디자인·접근성 | SPEC_SCREEN_TRACEABILITY_MATRIX.md |
| 2026-07-10 | 검토필요 | ROOT_GUIDE_OR_RECORD | 연구근거, 작업관리 | SPEC_SOURCE_ACCEPTANCE_DECISION_ROUND4.md |
| 2026-07-10 | 검토필요 | ROOT_GUIDE_OR_RECORD | 연구근거, 작업관리 | SPEC_SOURCE_ACCEPTANCE_DECISION_ROUND5.md |
| 2026-07-10 | 현재-스펙 | SPEC_ACTIVE | 훈련계획 | specs/active/PLAN_GENERATOR_SPEC.md |
| 2026-07-10 | 재구성-초안 | SPEC_RECONSTRUCT | 분석·시각화 | specs/reconstruct/ANALYSIS_AND_VISUALIZATION_DATA_CONTRACT.md |
| 2026-07-10 | 재구성-초안 | SPEC_RECONSTRUCT | 기타 | specs/reconstruct/COMPOSITION_BALANCE_BASELINE_CONTRACT.md |
| 2026-07-10 | 재구성-초안 | SPEC_RECONSTRUCT | 기타 | specs/reconstruct/EXTERNAL_RECORD_INTEGRATION_SPEC.md |
| 2026-07-10 | 재구성-초안 | SPEC_RECONSTRUCT | 계정·프라이버시 | specs/reconstruct/LOCAL_FIRST_SYNC_AND_PROMOTION_CONTRACT.md |
| 2026-07-10 | 재구성-초안 | SPEC_RECONSTRUCT | 기타 | specs/reconstruct/MEDIA_AND_TRANSIENT_CAPTURE_SPEC.md |
| 2026-07-10 | 재구성-초안 | SPEC_RECONSTRUCT | 분석·시각화 | specs/reconstruct/METRIC_ALGORITHM_CONTRACT.md |
| 2026-07-10 | 재구성-초안 | SPEC_RECONSTRUCT | 기타 | specs/reconstruct/RACE_RECORD_AND_HISTORICAL_RECALL_SPEC.md |
| 2026-07-09 | 현재-길잡이 | APP_DOC | 기타 | app/README.md |
| 2026-07-09 | 작업지시 | WORK_ORDER | 작업관리 | CODEX_WORK_ORDER_001.md |
| 2026-07-09 | 작업지시 | WORK_ORDER | 작업관리 | CODEX_WORK_ORDER_002.md |
| 2026-07-09 | 작업지시 | WORK_ORDER | 작업관리 | CODEX_WORK_ORDER_003.md |
| 2026-07-09 | 검토필요 | ROOT_GUIDE_OR_RECORD | 일지·위험신호, 작업관리 | DECISION_LOG.md |
| 2026-07-09 | 검토필요 | ROOT_GUIDE_OR_RECORD | 디자인·접근성 | DESIGN_DECISIONS.md |
| 2026-07-09 | 검토필요 | OTHER | 디자인·접근성 | design-system/DESIGN_TOKENS.md |
| 2026-07-09 | 검토필요 | OTHER | 디자인·접근성 | design-system/SCREENS.md |
| 2026-07-09 | 현재-길잡이 | OTHER | 디자인·접근성 | design-v3/README.md |
| 2026-07-09 | 과거-인계 | ROOT_GUIDE_OR_RECORD | 작업관리 | HANDOFF_NEXT_CHAT.md |
| 2026-07-09 | 현재-길잡이 | IMPL_DOC | 기타 | impl/README.md |
| 2026-07-09 | 검토필요 | ROOT_GUIDE_OR_RECORD | 기타 | NEGATIVE_SPACE.md |
| 2026-07-09 | 검토필요 | ROOT_GUIDE_OR_RECORD | 기타 | PHILOSOPHY.md |
| 2026-07-09 | 현재-길잡이 | OTHER | 안전규칙, 연구근거 | runtime-evidence/d9-evaluator/README.md |
| 2026-07-09 | 검토필요 | ROOT_GUIDE_OR_RECORD | 훈련계획 | SERVICE_DEVELOPMENT_MASTER_PLAN.md |
| 2026-07-09 | 검토필요 | ROOT_GUIDE_OR_RECORD | 처방·템플릿 | SESSION_TIMELINE.md |
| 2026-07-09 | 검토필요 | ROOT_GUIDE_OR_RECORD | 기타 | SKILL.md |
| 2026-07-09 | 검토필요 | ROOT_GUIDE_OR_RECORD | 기타 | SPEC_DOC_QUALITY_REPORT.md |
| 2026-07-09 | 검토필요 | ROOT_GUIDE_OR_RECORD | 연구근거, 작업관리 | SPEC_SOURCE_ACCEPTANCE_DECISION_ROUND1.md |
| 2026-07-09 | 검토필요 | ROOT_GUIDE_OR_RECORD | 연구근거, 작업관리 | SPEC_SOURCE_ACCEPTANCE_DECISION_ROUND2.md |
| 2026-07-09 | 검토필요 | ROOT_GUIDE_OR_RECORD | 연구근거, 작업관리 | SPEC_SOURCE_ACCEPTANCE_DECISION_ROUND3.md |
| 2026-07-09 | 검토필요 | ROOT_GUIDE_OR_RECORD | 연구근거 | SPEC_SOURCE_ACCEPTANCE_REVIEW_ROUND1.md |
| 2026-07-09 | 검토필요 | ROOT_GUIDE_OR_RECORD | 연구근거 | SPEC_SOURCE_ACCEPTANCE_REVIEW_ROUND3.md |
| 2026-07-09 | 검토필요 | ROOT_GUIDE_OR_RECORD | 기타 | SPEC_WAVED_BINDING_PATCH_REPORT.md |
| 2026-07-09 | 현재-스펙 | SPEC_ACTIVE | 기타 | specs/active/APP_IMPLEMENTATION_BRIDGE.md |
| 2026-07-09 | 현재-스펙 | SPEC_ACTIVE | 안전규칙 | specs/active/RVE_RULE_EVALUATOR_BINDING_SPEC.md |
| 2026-07-09 | 재구성-초안 | SPEC_RECONSTRUCT | 안전규칙, 훈련계획 | specs/reconstruct/PLAN_SAFETY_GATE_SPEC.md |
| 2026-07-09 | 현재-길잡이 | OTHER | 디자인·접근성 | ui_kits/trainoracle-app/README.md |
| 2026-07-09 | 검토필요 | ROOT_GUIDE_OR_RECORD | 기타 | VARIANTS.md |
| 2026-07-07 | 과거-인계 | ROOT_GUIDE_OR_RECORD | 작업관리 | HANDOFF.md |
| 2026-07-07 | 재구성-초안 | SPEC_RECONSTRUCT | 훈련계획 | specs/reconstruct/MICROCYCLE_AND_CALENDAR_MAPPING_SPEC.md |
| 2026-07-07 | 재구성-초안 | SPEC_RECONSTRUCT | 훈련계획, 계정·프라이버시 | specs/reconstruct/PLAN_OUTPUT_RATIONALE_PRIVACY_SPEC.md |
| 2026-06-26 | 검토필요 | ROOT_GUIDE_OR_RECORD | 기타 | SPEC_FILE_TRUTH_GUARD.md |
| 2026-06-26 | 검토필요 | ROOT_GUIDE_OR_RECORD | 연구근거 | SPEC_WAVE1_PHYSIO_PATCH_REPORT.md |
| 2026-06-26 | 현재-스펙 | SPEC_ACTIVE | 기타 | specs/active/ATHLETE_PROFILE_SPEC.md |
| 2026-06-26 | 현재-길잡이 | OTHER | 기타 | specs/README.md |
| 2026-06-26 | 재구성-초안 | SPEC_RECONSTRUCT | 안전규칙 | specs/reconstruct/RULE_VALIDATION_ENGINE_CONTRACT.md |
| 2026-06-24 | 현재-스펙 | SPEC_ACTIVE | 연구근거 | specs/active/PHYSIO_SOURCE_TRUST_SPEC.md |
| 2026-06-24 | 현재-스펙 | SPEC_ACTIVE | 안전규칙 | specs/active/RULE_SPEC_D1_D9.md |
| 2026-06-24 | 현재-스펙 | SPEC_ACTIVE | 처방·템플릿 | specs/active/SESSION_CLASSIFIER_SPEC.md |
| 2026-06-24 | 현재-스펙 | SPEC_ACTIVE | 처방·템플릿 | specs/active/TEMPLATE_LIBRARY_SPEC.md |
| 2026-06-24 | 레거시-참고 | SPEC_LEGACY | 연구근거 | specs/legacy-reference/_SOURCE_TO_DOC_MAP_v3.0.md |
| 2026-06-24 | 레거시-참고 | SPEC_LEGACY | 기타 | specs/legacy-reference/02_AI_STRATEGY.md |
| 2026-06-24 | 레거시-참고 | SPEC_LEGACY | 기타 | specs/legacy-reference/06_VALIDATION_AND_SAFEGUARDS.md |
| 2026-06-24 | 레거시-참고 | SPEC_LEGACY | 기타 | specs/legacy-reference/11_API_AND_ENGINE_CONTRACTS.md |
| 2026-06-24 | 레거시-참고 | SPEC_LEGACY | 디자인·접근성 | specs/legacy-reference/12_SCREEN_GUIDE.md |
| 2026-06-24 | 레거시-참고 | SPEC_LEGACY | 기타 | specs/legacy-reference/GLOSSARY.md |
| 2026-06-24 | 레거시-참고 | SPEC_LEGACY | 연구근거 | specs/legacy-reference/SOURCE_MAP.md |
| 2026-06-24 | 테스트-패키지 | SPEC_TEST | 안전규칙 | specs/test-packages/D9_SAFETY_EVALUATOR_V2_1_1_TEST_PACKAGE.md |
| 2026-04-29 | 현재-길잡이 | OTHER | 기타 | designs/README.md |
| 2026-04-29 | 검토필요 | OTHER | 분석·시각화, 디자인·접근성 | design-system/VISUALIZATION_SYSTEM.md |
| 2026-04-27 | 검토필요 | ROOT_GUIDE_OR_RECORD | 기타 | BRIEF_ORIGINAL.md |
| 2026-04-27 | 검토필요 | ROOT_GUIDE_OR_RECORD | 일지·위험신호 | CONVERSATION_LOG.md |
| 2026-04-27 | 검토필요 | OTHER | 디자인·접근성 | design-system/COMPONENT_INVENTORY.md |
| 2026-04-27 | 검토필요 | OTHER | 디자인·접근성 | design-system/FEATURE_TIERS.md |
| 2026-04-27 | 검토필요 | OTHER | 디자인·접근성 | design-system/SAFEGUARDS.md |
| 2026-04-27 | 검토필요 | OTHER | 디자인·접근성 | design-system/SYSTEM_FOUNDATIONS.md |
| 2026-04-27 | 검토필요 | ROOT_GUIDE_OR_RECORD | 기타 | PUSH_TO_GITHUB.md |
