# SPEC_SOURCE_ACCEPTANCE_DECISION_ROUND4.md

```yaml
document_metadata:
  doc_id: trainoracle-decision-round4-source-acceptance
  title: TrainOracle Round 4 Spec Source Acceptance Decision
  decision_date: "2026-07-10"
  decision_authority: TOTAL_RESPONSIBILITY_HOLDER
  decision_scope: downstream_target_patch_source_only
  canonical_promotion: false
  issue_closure: false
  inputs:
    - CODEX_WORK_ORDER_003.md (지시서)
    - GitHub PR #22, #23, #24, #25 (산출물, 순차 스쿼시 병합 완료)
    - SPEC_SCREEN_TRACEABILITY_MATRIX.md (GAP_SPEC_MISSING 5행)
    - 총책임자 독립 재검증 (2026-07-10, Issue #19 판정 댓글 기록)
```

---

## 1. 결정 요약

Work Order 003 산출물 3개 초안 스펙과 1개 바인딩 패치를 심사하여 아래와 같이 결정한다.

| # | 문서 | 판정 | 수용 범위 |
|---|---|---|---|
| 1 | `specs/reconstruct/MEDIA_AND_TRANSIENT_CAPTURE_SPEC.md` | **ACCEPTED_AS_WORKING_SOURCE** | 하류 타깃 패치 소스 한정 |
| 2 | `specs/reconstruct/RACE_RECORD_AND_HISTORICAL_RECALL_SPEC.md` | **ACCEPTED_AS_WORKING_SOURCE** | 하류 타깃 패치 소스 한정 |
| 3 | `specs/reconstruct/METRIC_ALGORITHM_CONTRACT.md` | **ACCEPTED_AS_WORKING_SOURCE** (단, §6 Draft Formula Set은 N3 유보) | 하류 타깃 패치 소스 한정 |
| 4 | PR #25 바인딩 패치 (DAILY_BRIEF flat 정규화, PLAN_GENERATOR patched_from 주석, 인덱스/현황) | **ACCEPTED** (패치 반영 확정) | — |

- **canonical 승격 아님.** 세 문서 전부 `canonical_promotion_allowed: false` 유지.
- **이슈 종결 없음.** 신규 open-issue 21건(각 7건×3) 전부 OPEN 유지. 런타임 증거 없이는 종결 불가.
- 이 결정으로 매트릭스 `GAP_SPEC_MISSING` 5행은 전부 **소스 계약 존재** 상태로 전환된다 (행 자체의 CLOSED 전환은 매트릭스 재계수 작업에서 수행 — ORDER_004 Task 4).

## 2. 독립 재검증 기록 (결정 근거)

코덱스 선언 수치를 그대로 믿지 않고 병합 전(브랜치)·병합 후(main) 2회 재계수했다.

| 문서 | 선언 open/blocking | 실측 (병합 전) | 실측 (main) | 일치 |
|---|---|---|---|---|
| MEDIA_AND_TRANSIENT_CAPTURE | 7 / 4 | 7 / 4 | 7 / 4 | ✅ |
| RACE_RECORD_AND_HISTORICAL_RECALL | 7 / 4 | 7 / 4 | 7 / 4 | ✅ |
| METRIC_ALGORITHM_CONTRACT | 7 / 4 | 7 / 4 | 7 / 4 | ✅ |
| DAILY_BRIEF (패치 후) | 6 / 3 | 6 / 3 | 6 / 3 | ✅ |

추가 확인: first line/`[DRAFT_COMPLETE]` final line, OPEN→CLOSED 전환 0건, `patched_from` 주석 2건,
`app/`·디자인 파일 무수정, 안전 불변식(`can_clear_D9: false` 계열) 3문서 전부 명시.

## 3. 결정 노트 (N1–N5)

| # | 노트 | 처리 |
|---|---|---|
| N1 | **전사 텍스트 → D9 평가기 경로 미명시**: MEDIA 스펙은 전사 텍스트 비영속을 계약했으나, 전사 텍스트가 구조화 필드 추출 전에 D9 구어체 계층 평가를 통과해야 하는지 여부는 미기재. 안전 방향상 "통과해야 한다"가 자명하나 계약 문면에 없음. | ORDER_004 Task 1로 패치 지시 |
| N2 | **METRIC §6 공식은 초안 유보**: Session Load/CTL/ATL/TSB/HR Drift/Monotony 수식은 `OI-MAC-FORMULA-ACCEPTANCE-001`이 OPEN인 동안 구현 금지. 수용 범위는 "봉투(envelope)·경계 계약"에 한정하며 수식 자체는 수용하지 않는다. | 본 결정문이 범위 한정 |
| N3 | **CI 성공 직접 검증 불가 기록**: 자동화 토큰의 Actions API 403으로 PR #22–25의 CI 성공을 직접 열람하지 못함. `mergeable_state=clean` 간접 증거 + 병합 후 main CI로 대체 확인. | 기록만 |
| N4 | **RACE 스펙의 recall 티어 계약**은 Home historical memory row 구현(Phase 2+)의 유일 소스로 지정. 구현 전 `OI-RHR-HISTORICAL-RECALL-PRIVACY-001` 해소 필요. | Phase 2 게이트 |
| N5 | **미디어 sourceRef 스킴(`media://`)** 은 app/ 구현 시 총책임자가 채택 여부를 재판단. 초안 수용이 스킴 확정을 의미하지 않음. | Phase 2 게이트 |

## 4. 트리거 (T1–T5)

| # | 트리거 | 담당 |
|---|---|---|
| T1 | MEDIA 스펙에 전사→D9 평가 경로 명문화 패치 (N1) | 코덱스 (ORDER_004 Task 1) |
| T2 | DAILY_LOG_AND_CHECKIN_SPEC에 race 서브타입 바인딩 주석 (`patched_from: RACE_RECORD_...`) | 코덱스 (ORDER_004 Task 2) |
| T3 | ANALYSIS_AND_VISUALIZATION_DATA_CONTRACT에 METRIC envelope 소비 바인딩 주석 | 코덱스 (ORDER_004 Task 2) |
| T4 | 매트릭스 GAP_SPEC_MISSING 5행 상태 재계수 (RESOLVED_BY_SOURCE 표기, CLOSED 아님) | 코덱스 (ORDER_004 Task 4) |
| T5 | LogDetail 사진 표시를 MEDIA 표시 계약(레이블만, 파일명 금지)에 맞춰 app/ 반영 — 이미 Phase 1에서 선반영(레이블만 표시), 계약 인용 주석 추가 | 총책임자 (Phase 2) |

## 5. 진행 현황

- 재구성 스펙 수용: **11/11** (Round 2: 4, Round 3: 4, Round 4: 3)
- 매트릭스 GAP_SPEC_MISSING: 5/5 소스 계약 확보 (행 재계수는 ORDER_004)
- 잔여 CONFLICT C1–C5: 구현 측 결함 확정(Round 3 T6) — v3 대상 C5는 Phase 1 app/에서 수정 완료, 구(舊) `trainoracle-app/*` 대상 C1–C4는 해당 킷의 유지 여부 결정 후 처리 (ORDER_004 Task 3에서 처분 제안 수령)

---

**서명**: 총책임자 (TOTAL_RESPONSIBILITY_HOLDER), 2026-07-10

[DECISION_COMPLETE]
