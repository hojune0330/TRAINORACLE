# SPEC_DOCUMENTATION_REPORT.md

```yaml
doc_id: TRAINORACLE_SPEC_DOCUMENTATION_REPORT
spec_id: TRAINORACLE.SPEC_DOCUMENTATION_REPORT
title: "TrainOracle SPEC Documentation Report"
version: "0.1"
round: RT1
status: DRAFT_HANDOFF_REPORT
owner: COACH_HOJUNE
open_issues_total: 0
canonical_blocking_count: 0
executed_tests_total: 0
canonical_promotion_allowed: false
```

---

## 1. 목적

이 문서는 TrainOracle의 현재 서류 상태를 사람이 보기 쉽게 정리한 리포트다.

중요한 원칙:

- 실제 로컬 파일만 “존재하는 문서”로 본다.
- `RECONSTRUCTED_DRAFT_FOR_REVIEW`는 원본 복원, 정본 승인, 런타임 검증이 아니다.
- Markdown self-check나 후보 test package는 D9 evaluator runtime evidence가 아니다.
- downstream issue count는 대상 파일을 열어 재계산하기 전까지 이 리포트에서 확정하지 않는다.
- raw athlete free-text, raw symptom clause, evidence clause, injury narrative, medical note, guardian private note는 audit/storage 계약에 저장하지 않는다.

---

## 2. 지금 있는 핵심 SPEC

| 문서 | 종류 | 현재 위치 | 현재 상태 | 간단한 맥락 | 다음 액션 |
|---|---|---|---|---|---|
| `RULE_SPEC_D1_D9.md` | Active SPEC | `specs/active/RULE_SPEC_D1_D9.md` | READY_FOR_UPLOAD / canonical blocked | D1-D9 rule 의미와 D9 safety hard-stop 기준선 | 규칙 의미는 여기서만 바꾼다. |
| `SESSION_CLASSIFIER_SPEC.md` | Active SPEC | `specs/active/SESSION_CLASSIFIER_SPEC.md` | READY_FOR_UPLOAD / canonical blocked | 세션 분류 기준선 | Daily Log 입력이 세션 기록으로 연결될 때 재정의하지 말고 소비한다. |
| `ATHLETE_PROFILE_SPEC.md` | Active SPEC | `specs/active/ATHLETE_PROFILE_SPEC.md` | DRAFT_FOR_REVIEW | 선수별 프로필, 선호, 제약, 동의, 스냅샷 | Physio source Wave 1 patch exists; Daily Log consent/profile binding remains target work. |
| `APP_IMPLEMENTATION_BRIDGE.md` | Active SPEC | `specs/active/APP_IMPLEMENTATION_BRIDGE.md` | DRAFT_FOR_REVIEW | 저장, consent, capability, audit, API bridge | DailyCheckInRecord와 raw-note redaction 저장 경계 패치 필요. |
| `PLAN_GENERATOR_SPEC.md` | Active SPEC | `specs/active/PLAN_GENERATOR_SPEC.md` | DRAFT_FOR_REVIEW | 훈련 계획 후보 생성 계약 | Safety Gate binding은 여전히 열려 있고, Physio consumption은 Wave 1 target patch 적용 후 source acceptance/recount approval 대기. |
| `TEMPLATE_LIBRARY_SPEC.md` | Active SPEC | `specs/active/TEMPLATE_LIBRARY_SPEC.md` | DRAFT_FOR_REVIEW | 템플릿 소유권, lifecycle, eligibility | 템플릿은 D9 risk를 clear하지 못한다는 경계 유지. |
| `PHYSIO_SOURCE_TRUST_SPEC.md` | Active SPEC | `specs/active/PHYSIO_SOURCE_TRUST_SPEC.md` | DRAFT_FOR_REVIEW | 생리 데이터 신뢰도, freshness, conflict, consent | PG/AIB/AP Wave 1 target patches exist; source acceptance and target recount approval remain. |
| `RVE_RULE_EVALUATOR_BINDING_SPEC.md` | Active SPEC | `specs/active/RVE_RULE_EVALUATOR_BINDING_SPEC.md` | DRAFT_FOR_REVIEW | D9 evaluator 결과를 RVE, Safety Gate, PG가 소비하는 방식 | 실제 runtime evidence 전에는 target issues를 닫지 않는다. |

---

## 3. 테스트/후보 패키지

| 문서 | 종류 | 현재 위치 | 현재 상태 | 간단한 맥락 | 다음 액션 |
|---|---|---|---|---|---|
| `D9_SAFETY_EVALUATOR_V2_1_1_TEST_PACKAGE.md` | Test package | `specs/test-packages/D9_SAFETY_EVALUATOR_V2_1_1_TEST_PACKAGE.md` | READY_FOR_LOCAL_TEST 후보 | D9 evaluator 실행 후보 패키지 | 실제 터미널/CI 실행 로그가 생기기 전까지 runtime evidence가 아니다. |

---

## 4. 재구성된 핵심 계약

| 문서 | 종류 | 현재 위치 | 현재 상태 | 간단한 맥락 | 다음 액션 |
|---|---|---|---|---|---|
| `RULE_VALIDATION_ENGINE_CONTRACT.md` | Reconstructed SPEC | `specs/reconstruct/RULE_VALIDATION_ENGINE_CONTRACT.md` | RECONSTRUCTED_DRAFT_FOR_REVIEW | RVE signal, storage, failure handling, D9 상태 저장 계약 | 원본/정본 아님. Runtime evidence와 target patch 전 이슈 종료 금지. |
| `PLAN_SAFETY_GATE_SPEC.md` | Reconstructed SPEC | `specs/reconstruct/PLAN_SAFETY_GATE_SPEC.md` | RECONSTRUCTED_DRAFT_FOR_REVIEW | RVE signal을 Plan Generator 실행 전 차단/통과로 라우팅 | ACTIVE/UNKNOWN block. Advisory는 CLEARED subtype. |
| `DAILY_LOG_AND_CHECKIN_SPEC.md` | Reconstructed SPEC | `specs/reconstruct/DAILY_LOG_AND_CHECKIN_SPEC.md` | RECONSTRUCTED_DRAFT_FOR_REVIEW | 일지/체크인 입력을 구조화 저장하고 RVE/Safety Gate로 안전하게 연결 | App Bridge, Profile, Physio, RVE/Safety Gate target patch 필요. |

---

## 5. 레거시/참조 문서

| 문서 | 종류 | 현재 위치 | 간단한 맥락 | 주의점 |
|---|---|---|---|---|
| `SOURCE_MAP.md` | Legacy reference | `specs/legacy-reference/SOURCE_MAP.md` | 출처와 문서 관계 참고 | 현재 SPEC 의미를 대체하지 않는다. |
| `_SOURCE_TO_DOC_MAP_v3.0.md` | Legacy reference | `specs/legacy-reference/_SOURCE_TO_DOC_MAP_v3.0.md` | source-to-doc mapping | exact `SOURCE_TO_DOC_MAP.md`와 혼동하지 않는다. |
| `GLOSSARY.md` | Legacy reference | `specs/legacy-reference/GLOSSARY.md` | 용어와 초기 개념 | `CYCLE_DAY.D-*`와 rule namespace를 구분한다. |
| `02_AI_STRATEGY.md` | Legacy reference | `specs/legacy-reference/02_AI_STRATEGY.md` | 옛 Phase A-F AI workflow | `LEGACY_PHASE_D`와 `RULE_SPEC_D1_D9`를 동일시하지 않는다. |
| `06_VALIDATION_AND_SAFEGUARDS.md` | Legacy reference | `specs/legacy-reference/06_VALIDATION_AND_SAFEGUARDS.md` | 옛 validation/safeguard reference | 현 rule semantics를 재정의하지 않는다. |
| `11_API_AND_ENGINE_CONTRACTS.md` | Legacy reference | `specs/legacy-reference/11_API_AND_ENGINE_CONTRACTS.md` | 옛 Phase output/API contract | `RULE_VALIDATION_ENGINE_CONTRACT.md`가 아니다. |
| `12_SCREEN_GUIDE.md` | Legacy reference | `specs/legacy-reference/12_SCREEN_GUIDE.md` | 구글시트/옛 화면 참고 | 현재 app/spec 계약을 직접 대체하지 않는다. |

---

## 6. 디자인/제품 문서

| 문서/폴더 | 종류 | 위치 | 간단한 맥락 | SPEC 연결 |
|---|---|---|---|---|
| `HANDOFF.md` | Design handoff | `HANDOFF.md` | 개발 에이전트용 디자인/구현 첫 안내 | `CheckIn` draft shape는 Daily Log SPEC에서 구조화/비식별 경계로 정리한다. |
| `PHILOSOPHY.md` | Product philosophy | `PHILOSOPHY.md` | 선수 일지처럼 매일 들어오되 핵심은 근거 기반 코칭 | SPEC의 안전/근거/불확실성 원칙과 연결한다. |
| `DESIGN_DECISIONS.md` | Design rationale | `DESIGN_DECISIONS.md` | Dashboard, Session Detail, AI Inbox, Daily Check-in 방향 | UI intent는 reference이며 저장/안전 계약을 대체하지 않는다. |
| `design-system/` | Design system | `design-system/` | tokens, components, screens, safeguards, visualization | Daily Check-in 화면은 `DAILY_LOG_AND_CHECKIN_SPEC.md`의 저장 경계를 따라야 한다. |
| `designs/` | HTML design artifacts | `designs/` | 실제 화면 HTML 디자인 산출물 | 구현 전 SPEC 계약과 충돌 여부를 확인한다. |

---

## 7. 이번에 추가된 문서

| 문서 | 왜 만들었나 | 사용 방법 |
|---|---|---|
| `SPEC_FILE_TRUTH_GUARD.md` | 챕터 제목/상태표를 실제 파일로 착각하는 오류를 막기 위해 | 새 문서를 만들거나 존재 판단하기 전에 exact filename search 기준으로 확인한다. |
| `SPEC_LEGACY_ALIGNMENT_AND_DAILY_LOG_PLAN.md` | 레거시, 현재 SPEC, Daily Log 서비스 흐름을 이어주기 위해 | Daily Log, Daily Brief, AI Inbox, Analysis 계약을 만들 때 순서와 원칙을 확인한다. |
| `SPEC_DOCUMENTATION_REPORT.md` | 현재/재구성/예정 문서를 사람이 한눈에 보게 하기 위해 | 사용자와 다음 작업자가 전체 서류 지도를 빠르게 읽는 시작점으로 쓴다. |
| `DAILY_BRIEF_AND_INBOX_SIGNAL_SPEC.md` | 매일 요약과 AI Inbox를 구조화 데이터에서 만들기 위해 | Raw text 없이 source refs, confidence/uncertainty, reason codes를 보존한다. |
| `ANALYSIS_AND_VISUALIZATION_DATA_CONTRACT.md` | 분석 화면과 시각화 데이터 계약을 만들기 위해 | 그래프/패널은 구조화 source refs와 uncertainty를 보존하고 안전 상태를 절대 clear하지 않는다. |

---

## 8. 앞으로 만들 문서와 이미 만든 제품화 초안

| 문서 | 종류 | 왜 필요한가 | 현재 상태 |
|---|---|---|---|
| `DAILY_BRIEF_AND_INBOX_SIGNAL_SPEC.md` | Productization SPEC draft | Daily Check-in, 세션, 분석 결과를 daily brief / AI Inbox item으로 바꾸는 계약 | Draft created; implementation/runtime evidence는 아직 없음 |
| `ANALYSIS_AND_VISUALIZATION_DATA_CONTRACT.md` | Productization SPEC draft | Analysis, Session Detail, Dashboard, Calendar 시각화가 어떤 구조 데이터에서 나오는지 정의 | Draft created; App Bridge binding, metric formula authority, runtime evidence는 아직 없음 |
| `PLAN_OUTPUT_RATIONALE_PRIVACY_SPEC.md` | Future SPEC | Plan option rationale과 코치-visible 설명이 민감정보를 누출하지 않게 함 | Not created yet; Plan Generator, Daily Log, Safety Gate 경계 확인 필요 |
| `MICROCYCLE_AND_CALENDAR_MAPPING_SPEC.md` | Future SPEC | 9.5-day cycle, calendar, `CYCLE_DAY` 라벨을 화면/계획과 연결 | Not created yet; namespace policy 유지 필요 |
| App implementation DB/API schemas | Implementation contract | SPEC를 실제 앱 저장소와 API로 내리는 단계 | Core SPEC acceptance와 privacy review |
| D9 runtime evidence report | Runtime evidence | D9 evaluator 실제 실행 결과와 RVE/Safety Gate mapping 증거 | test package 실행 및 로그 확보 |

---

## 9. 현재 가장 중요한 작업 순서

1. `RULE_VALIDATION_ENGINE_CONTRACT.md`, `PLAN_SAFETY_GATE_SPEC.md`, `DAILY_LOG_AND_CHECKIN_SPEC.md`를 reconstructed draft로 review한다.
2. `DAILY_LOG_AND_CHECKIN_SPEC.md`를 기준으로 App Bridge / Athlete Profile / Physio Source Trust / RVE / Safety Gate target patch 계획을 세운다.
3. Wave 1 Physio Source Trust target patches in `PLAN_GENERATOR_SPEC.md`, `APP_IMPLEMENTATION_BRIDGE.md`, and `ATHLETE_PROFILE_SPEC.md` are present; review source acceptance and target-file recount approval before any issue closure.
4. 실제 D9 evaluator runtime output을 확보하기 전까지 RVE/PG/Safety Gate binding issue를 닫지 않는다.
5. Plan rationale privacy와 microcycle/calendar 문서를 만들고, 그 뒤 구현 스키마와 runtime evidence로 넘어간다.

---

## 10. 한 줄 요약

TrainOracle의 문서 계층은 이제 `Rule semantics -> RVE -> Safety Gate -> Plan Generator` 안전 체인과 `Daily Log -> structured source context -> RVE/Safety Gate/Analysis` 일지 체인을 분리해서 볼 수 있다. 아직 정본 승인이나 runtime evidence 단계는 아니며, 다음 핵심은 target patch와 실제 D9 실행 증거다.

---

## Patch Matrix Addendum

`SPEC_TARGET_PATCH_MATRIX.md` is the current count-safe source-to-target patch matrix.

Use it before patching Plan Generator, App Bridge, Athlete Profile, Safety Gate, RVE, or Daily Log target issues. It is not runtime evidence, not issue closure, and not canonical promotion.

`SPEC_WAVE1_PHYSIO_PATCH_REPORT.md` records the Wave 1 Physio Source Trust target patches into Plan Generator, App Bridge, and Athlete Profile. It confirms the target issues remain open pending source acceptance and target recount approval.

Wave 1 update: PG/AIB/AP physio consumption patches are no longer future work. They are present as target-local patches, while the related issues remain open pending source acceptance, review, and target-file recount approval.

## Productization Draft Addendum - 2026-06-27

`DAILY_BRIEF_AND_INBOX_SIGNAL_SPEC.md` now exists at `specs/reconstruct/DAILY_BRIEF_AND_INBOX_SIGNAL_SPEC.md`.

Treatment:

- It is a new `DRAFT_FOR_REVIEW` productization SPEC.
- It is not an original restored file.
- It is not canonical promotion.
- It is not runtime evidence.
- It does not close `OI-DLC-DAILY-BRIEF-INBOX-001` or any downstream issue.

Purpose:

- Convert structured Daily Log, session, safety, profile, and physio facts into Daily Brief and AI Inbox signal records.
- Require source refs, confidence/uncertainty, and non-sensitive reason codes.
- Keep raw memo/free-text/symptom clauses, injury narratives, medical notes, rehab notes, guardian private notes, and private external LLM prompts out of storage and audit.
- Prevent Daily Brief / AI Inbox from creating plan options or clearing D9/Safety Gate blocks.

Remaining future productization documents:

- `PLAN_OUTPUT_RATIONALE_PRIVACY_SPEC.md`
- `MICROCYCLE_AND_CALENDAR_MAPPING_SPEC.md`

## Productization Draft Addendum - 2026-07-07

`ANALYSIS_AND_VISUALIZATION_DATA_CONTRACT.md` now exists at `specs/reconstruct/ANALYSIS_AND_VISUALIZATION_DATA_CONTRACT.md`.

Treatment:

- It is a new `DRAFT_FOR_REVIEW` productization SPEC.
- It is not an original restored file.
- It is not canonical promotion.
- It is not runtime evidence.
- It does not close `OI-DLC-ANALYSIS-VISUALIZATION-001`, `OI-DBI-ANALYSIS-CONTRACT-BINDING-001`, or any downstream issue.

Purpose:

- Convert accepted structured Daily Log, session, classifier, physio, safety, plan, Daily Brief, and AI Inbox facts into visualization data shapes.
- Require source refs, confidence/uncertainty, non-sensitive reason codes, and visible missing/stale/conflicting source states.
- Keep raw memo/free-text/symptom clauses, injury narratives, medical notes, rehab notes, guardian private notes, and private external LLM prompts out of storage and audit.
- Prevent Analysis, Dashboard, Session Detail, Calendar, coach review, Daily Brief, or AI Inbox visualizations from creating plan options or clearing D9/Safety Gate blocks.
- Avoid claiming final CTL/ATL/TSB or other metric formula authority until a separate accepted metric algorithm contract exists.

Remaining future productization documents:

- `PLAN_OUTPUT_RATIONALE_PRIVACY_SPEC.md`
- `MICROCYCLE_AND_CALENDAR_MAPPING_SPEC.md`

[DRAFT_COMPLETE]
