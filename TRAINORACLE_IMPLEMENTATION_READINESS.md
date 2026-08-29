# TrainOracle Implementation Readiness

```yaml
document_metadata:
  doc_id: trainoracle-implementation-readiness
  title: TrainOracle Implementation Readiness
  version: "1.3"
  recorded_at: 2026-08-29
  owner: COACH_HOJUNE
  status: DEVELOPMENT_IN_PROGRESS
  source_plan: TRAINORACLE_MASTER_PLAN.md
  development_started: true
  work_order_issued: OWNER_DIRECT_INSTRUCTION
  agent_dispatched: false
  runtime_modified: true
  deployment_requested: false
  final_marker_required: "[DRAFT_COMPLETE]"
```

> 이 문서는 개발 준비에서 실제 구현으로 넘어간 상태와 순서를 기록한다. 개별
> 기능의 구현 권한, 정본 승격, 배포 승인 또는 과학적 타당성을 대신하지 않는다.

---

## 1. 현재 상태

```yaml
readiness_state:
  master_plan_recorded: true
  implementation: IN_PROGRESS
  first_task: TARGETED_SPEC_ALIGNMENT_STARTED
  active_development_branch: codex/post-audit-hardening-271
  active_work_order: OWNER_DIRECT_DEVELOPMENT_INSTRUCTION
  assigned_agent: CODEX
  code_change: PR_263_270_MERGED_POST_AUDIT_HARDENING_READY_FOR_PRE_MERGE_REVIEW
  spec_patch: TRENDING_TRAINING_CONTENT_OPERATIONS_PIPELINE_DRAFT_IN_PROGRESS
  design_change: EXISTING_SURFACE_HARDENING_ONLY
  deployment: NONE
```

`TRAINORACLE_MASTER_PLAN.md`는 제품 방향을 보존한다. 이 파일이 존재한다는
이유만으로 어떤 SPEC도 정본이 되지 않고, 어떤 기능도 구현되거나 배포된 것으로
간주하지 않는다.

---

## 2. 개발 시작 조건

다음 조건을 모두 충족한 뒤 오너가 별도로 개발 시작을 지시해야 한다.

1. 현재 로컬 `main`과 GitHub `main`의 커밋을 다시 확인한다.
2. 작업트리의 기존 수정·미추적 파일을 확인하고 다른 작업자의 변경을 보존한다.
3. 대상 기능과 연결된 활성 SPEC, 초안 SPEC, 오너 결정, 현재 구현을 각각 연다.
4. 문서 제목·장 제목·챕터 이름을 실제 파일로 오인하지 않도록 파일 존재를
   로컬에서 확인한다.
5. 초안 상태를 구현 권한으로 오인하지 않고 필요한 오너 결정을 분리한다.
6. 대상 코드의 현재 테스트와 공개 동작을 기준선으로 동결한다.
7. 구현 범위, 금지 범위, 독립 리뷰어, 완료 증거를 포함한 별도 작업 지시서를
   작성하고 오너 승인을 받는다.

---

## 3. 첫 개발 작업

첫 개발 작업의 이름은 **스펙 정합성·충돌 감사**다. 오너의 별도 개발 지시로
대상 기능 단위 감사를 시작했다. 전체 21개 장 감사 완료는 주장하지 않는다.
누적 거리 대상 감사와 구현은 PR #261로 병합됐고, 에너지 시스템 누적 원장은
그 검수 후속 지적을 반영해 별도 브랜치에서 진행 중이다.

감사 범위는 다음과 같다.

- 마스터 플랜의 21개 필수 장과 현재 SPEC·오너 결정·런타임 구현의 연결표 작성
- 한 계획 대 2~3개 후보, 자기 선택 대 코치 확정, 기본 대 선수용 추가 기능의
  계약 충돌 확인
- 일반 다이어리 분석 가능 범위, 비밀 기록 제로 신호, 일지 원문 금지 경계 확인
- 7일·9일·10일 표시와 9.5일 계보, 하루 1회·2회, 매일 훈련 계약 확인
- 주간·월간 거리와 에너지 시스템 원장에 필요한 승인 공식·출처·누락값 정책 확인
- 훈련법 카탈로그의 `DRAFT`, `ELIGIBLE`, `ACTIVE` 상태와 실제 런타임 소비 범위 확인
- 개인 오라클, 친구 비교, 함께 달리기 오라클이 안전·처방 권한을 넘지 않는지 확인
- 미성년자, 팔로워 공개, 외부 검색 색인, 계정 동의에 필요한 별도 관문 확인

감사 산출물은 발견·충돌·결정 필요 사항만 기록한다. 오너 승인 전에는 SPEC이나
코드를 고치지 않는다.

---

## 4. 단계별 준비 상태

| 단계 | 목적 | 선행 조건 | 현재 상태 |
|---|---|---|---|
| 0 | 마스터 플랜과 준비 문서 보존 | 문서 PR 병합 | DOCUMENTATION_ONLY |
| 1 | 스펙 정합성·충돌 감사 | 별도 오너 시작 지시 | TARGETED_AUDIT_IN_PROGRESS |
| 2 | 용어·누적 거리·에너지 시스템·선수용·오라클 오너 결정 | 단계 1 보고서 검수 | DISTANCE_ACCEPTED_ENERGY_IN_PROGRESS |
| 3 | 주간·월간·연간 거리와 에너지 시스템 누적 분석 | 승인 SPEC과 테스트 기준선 | ENERGY_LEDGER_V1_MERGED |
| 4 | 800m~마라톤 상세 후보와 9.5일·중주기·24주 계보 | 활성 템플릿·주기 계약 | LINEAGE_AND_EVENT_BREADTH_V1_MERGED_DETAILED_LONG_DISTANCE_TEMPLATES_PENDING |
| 5 | 일지 수행 연결과 적응 근거 원장 | `plannedSessionId`·개인정보 계약 | PLAN_JOURNAL_V1_MERGED_ADAPTATION_PARTIAL_ACCOUNT_STATUS_V1_MERGED |
| 6 | 개인 오라클과 훈련법 궁합 | 결정적 규칙·근거·안전 독립 계약 | PERSONAL_ORACLE_V1_MERGED_TIE_WORDING_HARDENED_METHOD_COMPATIBILITY_NOT_STARTED |
| 7 | 친구 비교와 함께 달리기 오라클 | 계정·동의·공유 항목 계약 | NOT_STARTED |
| 8 | 다이어리 공개·비밀 기록·팔로워 | RLS·차단·신고·삭제 검증 | NOT_STARTED |
| 9 | 콘텐츠·포인트·꾸미기·공유 | 보상 금지선·콘텐츠 검토 상태 | EXISTING_LOCAL_REWARDS_AND_DECORATION_MERGED_CONTENT_READER_V1_MERGED_PIPELINE_CONTRACT_DRAFTED |
| 10 | 유행 훈련법 콘텐츠와 SEO 검토 | 별도 연구·법률·오너 승인 | READ_ONLY_CONTENT_V1_MERGED_OPERATIONS_CONTRACT_DRAFTED_SEO_NOT_STARTED |
| 11 | 실제 사용자 베타와 배포 | 모든 필수 검증과 배포 승인 | NOT_STARTED |

---

## 5. 역할 준비

역할은 준비만 하며 누구에게도 작업을 발주하지 않는다.

| 역할 | 후속 책임 | 현재 배정 |
|---|---|---|
| 오너 | 제품·훈련 도메인 결정, 활성화·배포 승인 | 결정권만 유지 |
| 고정밀 기획·검수 | 스펙 충돌, 처방 권한, 안전 경계, 증거 평가 | 미배정 |
| 범위가 고정된 구현 | 승인된 SPEC에 따른 코드·테스트 작성 | 미배정 |
| UX·UI 독립 검수 | 문구, 흐름, 모바일, 접근성, 사람 친화성 검수 | 미배정 |
| 스포츠과학·코치 검토 | 훈련법의 대상·전이·용량·적용 한계 검토 | 미배정 |
| 개인정보·법률 검토 | 계정, 팔로워, 미성년자, 비교, SEO 공개 관문 검토 | 미배정 |

---

## 6. 구현 전 검증 관문

```yaml
required_gates:
  local_file_truth_verified: REQUIRED
  latest_main_verified: REQUIRED
  target_spec_status_opened_and_read: REQUIRED
  owner_decisions_recorded: REQUIRED_WHEN_DOMAIN_DECISION_EXISTS
  no_absolute_counts_from_memory: REQUIRED
  baseline_tests_frozen: REQUIRED
  failure_injection_for_new_guard_tests: REQUIRED
  raw_private_text_not_transmitted_or_logged: REQUIRED
  D9_and_safety_authority_unchanged: REQUIRED
  independent_review_defined: REQUIRED
  deployment_requires_separate_owner_approval: REQUIRED
```

- CI 통과만으로 과학적·코칭적 타당성을 주장하지 않는다.
- 자체 점검을 런타임 증거라고 부르지 않는다.
- 실제 대상 파일을 열고 재계수하기 전에는 이슈 수나 테스트 수의 절대 변화량을
  쓰지 않는다.
- 공개 앱, 계정, 데이터베이스, 배포 환경을 이 준비 단계에서 변경하지 않는다.

---

## 7. 이전 준비 단계의 종료 조건

다음 항목이 충족되면 준비 단계는 완료되지만 개발은 시작되지 않은 상태다.

- `TRAINORACLE_MASTER_PLAN.md`가 전체 승인 계획을 보존한다.
- README 상단에서 마스터 플랜과 이 준비 문서를 찾을 수 있다.
- 두 문서의 상태가 구현 미착수임을 명시한다.
- 앱·SPEC·디자인·런타임·배포 파일이 변경되지 않는다.
- 문서 전용 PR이 `main`에 병합되고 로컬 작업트리가 깨끗하다.
- 별도 개발 브랜치·작업 지시·에이전트 발주는 존재하지 않는다.

이 조건은 2026-08-28 개발 시작 지시 전의 준비 단계 종료 기준이다. 현재는
개발이 시작됐으므로 역사 기록으로만 유지한다. 다음 작업자는 최신 `main`, 열린
PR, 이 문서의 §1 상태를 다시 확인한 뒤 중복 구현을 피해야 한다.

[DRAFT_COMPLETE]
