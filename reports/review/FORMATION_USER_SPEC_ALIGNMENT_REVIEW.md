# Formation User And Spec Alignment Review

```yaml
status: UPDATED_SUMMARY
exact_conflict_authority: reports/review/FORMATION_SPEC_CONFLICT_REGISTER.csv
exact_conflict_count: 12
detailed_latest_audit: reports/review/FORMATION_LATEST_DECISION_AND_USER_GAP_AUDIT_V2.md
runtime_authority: false
```

## 한 줄 판정

9.5일 구조·대회 앵커·놓친 MAIN 비몰아넣기·복합 세션·개인 메모 무신호는 잘 맞는다.
최신 책임자 결정은 이 충돌의 기준을 이미 정했다. **9.5일 기본 자동 처방**과
**사용자 선택형 메모 백업·공유**가 제품 방향이며, 반대되는 예전 문서는 정본 패치 대상이다.
사람/보조기술 접근성 검증은 여전히 구현 전 차단 상태다.

## 핵심 차단 3개 묶음

아래 세 항목은 이해하기 쉽게 묶은 상위 주제다. 정확한 현재 충돌은 3건이 아니라
`FRV2-CONF-001..012` **12건**이며, 상세 상태와 패치 문구는 conflict register와 최신 gap
audit가 기준이다.

### 1. 자동 처방과 코치 전용 선택 충돌

최신 결정은 `9_5_DAY_FORMATION + DEFAULT_AUTOMATED_PRESCRIPTION`이며 이것이 기준이다. 반면
`TRAINING_PLAN_FORMATION_AND_ADAPTATION_SPEC.md`와 `PLAN_GENERATOR_SPEC.md`는 자동 선택을
금지하고 코치 선택 기록을 필수로 한다.

정본 조치는 **계획 선택과 실행 권한을 분리**하는 것이다.

```yaml
system_default_selection: ONE_DETERMINISTIC_9_5_PLAN
alternatives: COLLAPSED_UNDER_COMPARE_OR_COACH_EDIT
scientific_superiority: UNKNOWN
runtime_authority: false_until_named_gates_pass
youth_initial_execution: LINKED_COACH_CONFIRMATION_REQUIRED_UNTIL_SEPARATELY_ACCEPTED
ineligible_result: NO_AUTOMATED_PLAN_KEEP_CURRENT_COACH_AUTHORED_PLAN
```

시스템은 적격 입력에서 기본안 하나를 고른다. 실제 청소년 실행은 승인된 코치·안전·동의
게이트 전에는 시작하지 않는다. 적격하지 않으면 다른 주기를 추천하지 않고 현재 코치
계획을 유지한다.

### 2. 메모 전체 백업 허용과 절대 export 금지 충돌

최신 결정과 Record Governance·Privacy Decision은 확인된 `OWNER_FULL_LOCAL_BACKUP`을 허용하지만
`DAILY_LOG_AND_CHECKIN_SPEC.md`는 두 메모 유형 export를 절대 금지한다.

정본 조치는 기본 제외를 유지하고, 기기 안에서 preview와 두 번의 명시 행동 뒤에만 메모를
포함하는 것이다. 이 동작은 분석·공유 동의·보상·Formation 이벤트를 만들지 않는다.

### 3. 접근성은 원칙만 통과

WCAG 2.2 AA·44px·320/375px·200% reflow·reduced motion 규칙은 있다. 실제 선수·코치,
NVDA 등 보조기술, 실패 색 토큰 금지 등록은 아직 없다. 제품 UI acceptance 전
차단 상태로 유지한다.

## 최신 세부 경계

- `FRV2-CONF-008`: 수신자 공유는 책임자 방향이지만 현재 앱 기능과 정본 계약이 없다.
  승인·구현 전에는 사용할 수 없고, 나중에도 분석 동의·코치 상시 접근·계획·안전·보상·
  telemetry 권한으로 바뀌지 않는다.
- `FRV2-CONF-010`: 경기 자기점검은 현재 수집·표시 전용이다. 향후 별도 계약 뒤 선수
  본인의 분석에 쓸 방향만 유지하며, 현재 계획·안전·보상·telemetry·코치/제3자 사용은
  금지한다.
- `FRV2-CONF-012`: 완료 `COMPETITION` 기록 하나는 노출 한 번이라는 최신 원칙을
  유지한다. 대회 앵커 1개 아래 예선·결승 bout N개를 둘지는 CA-02/03 책임자 결정 전
  미승인 후보다.

## 개선 목록

| ID | 심각도 | 사용자 문제 | 정본 대상 | 권고와 검증 |
|---|---|---|---|---|
| UX-01 | BLOCKER | 기본 자동 처방인지 코치 선택 도구인지 모호 | Formation; Plan Generator | 기본안 1개와 실행 게이트 분리; 동일 입력/버전 결정성 테스트 |
| UX-02 | HIGH | 옛 문서가 최신 결정을 다시 뒤집음 | Acceptance; Read Now; Deferred Goals | identity/target/runtime/superseded header; 오래된 절대문구 lint |
| UX-03 | HIGH | 처음부터 2-3안을 골라야 함 | Formation candidate projection | `PRIMARY_DEFAULT + OPTIONAL_ALTERNATIVES`; 320px 첫 화면 대안 숨김 |
| UX-04 | HIGH | 쉬운 설명에도 enum·hash·RPE가 노출 | Projection/Explanation | 청소년 기본 `EASY`; L1-L3 내부 용어 금지; teach-back |
| UX-05 | HIGH | 9.5일이 10개의 같은 날처럼 보임 | Calendar Mapping | 실제 start/end와 partial day; 모바일 upcoming 요약; DST/zoom 테스트 |
| UX-06 | HIGH | 수행 운동과 추정 피로가 같은 칸에 있음 | Projection Load | performed/measured/data-state 구분; provenance 없는 fatigue 표시 실패 |
| UX-07 | BLOCKER | 자기 메모 백업이 문서마다 허용/금지 | Daily Log; Governance | 기본 제외 + local explicit include; network/analytics 0 테스트 |
| UX-08 | HIGH | 코치·친구·보호자 선택 공유 흐름이 없음 | 새 Recipient Share 계약 | 수신자·필드·기간·preview·철회; 메모 기본 off |
| UX-09 | HIGH | 보호자가 무엇을 보는지 선수 통제 화면 없음 | Projection; App Bridge | athlete access center와 dispute/expiry/age transition |
| UX-10 | MEDIUM | 병렬 비교 진행표가 성과처럼 보임 | Shadow Protocol | 다음 확인·사용자 행동·실행 아님 표시; streak와 분리 |
| UX-11 | HIGH | 자동 계획이 멈추면 막다른 화면 | Safety/Shadow/Projection | 무슨 일/유지되는 것/지금 행동/해결자 네 줄 의무화 |
| UX-12 | HIGH | 대회 충돌·MAIN 누락의 쉬운 복구 문구 없음 | Coach Ruleset; Projection | race preserved/no debt/new version templates와 fixtures |
| UX-13 | MEDIUM | 여러 동의와 4/4 시험의 인지 부담 | Participation; Governance | 한 번에 한 목적; 실패 라벨 금지; base journal 유지 |
| UX-14 | BLOCKER | 색·모바일·AT 실제 사람 검증 부재 | Accessibility Review | 금지 색 registry; NVDA/keyboard/grayscale/400%/한글 stress |
| UX-15 | HIGH | 잘못된 기록을 누가 고치는지 모호 | Projection; Load | `correctableBy`; 새 source/plan version; accepted plan 불변 |

## 권장 적용 순서

1. `FORMATION_LATEST_OWNER_DECISION_BASELINE.md`를 기준으로 `UX-01/02` 권한과 과거 문서 상태를 정렬한다.
2. `UX-07/08/09`로 백업·공유·보호자 권한을 정렬한다.
3. `UX-03..06`으로 기본안 1개·설명·모바일 9.5일·복합 세션을 묶어 패치한다.
4. `UX-10..13/15`를 사용자 시나리오 fixture로 고정한다.
5. `UX-14`의 실제 사람/AT 검토 전 제품 UI를 accepted로 올리지 않는다.

상세 근거·정확한 패치 문구·테스트는
`.omo/evidence/formation-research-v2/user-spec-alignment-audit.md`에 있다. 이 검토는
정본이나 제품 코드를 변경하지 않았으며 `runtime_authority=false`다.
