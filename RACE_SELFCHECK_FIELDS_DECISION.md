# RACE_SELFCHECK_FIELDS_DECISION.md

```yaml
decision_metadata:
  decision_id: TO-DECISION-RACE-SELFCHECK-FIELDS-2026-07-14-001
  decided_by: FABLE_총책임자
  approval_pending: COACH_HOJUNE
  triggered_by: PR60_review_CHANGES_REQUESTED (2026-07-13, 지적 ①·②)
  related: [PR60, PR61, Issue42, PLAN_F0F_TASKR_HARDENING.md#F0-f-6]
  scope: app_local_JournalEntry_schema_only
  server_contract_change: none
```

## 1. 결정 내용

`RaceEntry`(app/src/domain/journal-store.ts)에 선택(optional) 도메인 필드 4개를 추가한다.

| 필드 | 타입 | 계약 범위 | 의미 |
|---|---|---|---|
| `tension?` | number | 정수 1–10 | 경기 직전 긴장도 (탭 선택) |
| `condition?` | number | 정수 1–5 | 경기 직전 컨디션 자기 평가 (탭 선택) |
| `goalPace?` | string | ≤120자 | 경기 직전 목표 페이스·전략 (직접 입력) |
| `mood?` | number | 정수 1–5 | 경기 직후 감정 (탭 선택) |

## 2. 근거 정정 (PR #60 리뷰 지적 ① 수용)

- 최초 PR #60은 이 필드들의 근거로 ORDER_008 amendment_v3의 "하위호환 선택
  메타데이터" 조항을 인용했다. **이 인용은 오류였다.** 해당 조항이 허용하는 것은
  `fieldProvenance` 같은 메타데이터이지 새 도메인 필드가 아니다.
- 정정된 근거: 이 필드 추가는 **총책임자의 앱 로컬 스키마 채택 결정**이다.
  `app/` 및 앱 로컬 데이터 형태는 총책임자 전담 영역(Codex rule 9)이며,
  본 문서가 그 결정 기록이다. 최종 채택 승인권은 사장님(COACH_HOJUNE)에게 있다.

## 3. 판독 규칙 (legacy / 부재 / 범위 밖)

- **부재(absent)**: 선수가 해당 항목을 탭/입력하지 않음 = 미기록.
  data_provenance_contract(PR #61) 채택 시 MISSING으로 판독한다.
  부재를 이유로 저장을 차단하지 않는다 (partial_save_allowed).
- **legacy**: 이 결정 이전에 저장된 race entry에는 이 필드가 없다.
  부재와 동일하게 미기록으로 판독하며, 소급 기입·추론을 금지한다.
- **범위 밖 값**: 읽기 시점(`isValidEntry`)과 저장 시점(`saveEntry`) 모두에서
  계약 범위를 검증한다 (지적 ② 수용). 범위 밖 값이 포함된 entry는
  읽기 시 목록에서 제외되고(`[JSTORE] dropped=N`), 저장 시 거부된다
  (`[JSTORE] saveRejected`). 정상 UI 경로에서는 범위 밖 값이 생성될 수 없다
  (탭 그리드 1–10/1–5 고정, goalPace maxLength=120).

## 4. 분석·계획 사용 제한

- 이 필드들은 현재 **표시 전용**이다. 주간 통계·추이·미래 훈련계획 근거에
  사용하지 않는다.
- 사용하려면 data_provenance_contract의 `fieldProvenance` 메타데이터 채택과
  EXPLICIT 판정 경로가 선행되어야 한다 (별도 결정).
- D9·RVE·Safety Gate 판정에 사용하지 않는다. `goalPace`는 자유 텍스트이므로
  §8 memo_policy 경계를 따른다: 서버 영속 금지, 내보내기 기본 제외 대상 검토.

## 5. SPEC 반영 요청 (Codex)

DAILY_LOG_AND_CHECKIN_SPEC의 race entry 정의에 위 4개 필드를
optional + 계약 범위 + legacy 판독 규칙과 함께 반영해 주기 바란다.
(Issue #42 코멘트로 기 요청, 본 문서가 정본 근거)

[DECISION_RECORDED — 사장님 승인 대기]
