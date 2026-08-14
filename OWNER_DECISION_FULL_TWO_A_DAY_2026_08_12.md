# OWNER_DECISION_FULL_TWO_A_DAY_2026_08_12.md

```yaml
decision_metadata:
  decision_id: TO-OWNER-FULL-TWO-A-DAY-2026-08-12-01
  title: "직접 고른 하루 두 번 일정 - 고른 훈련일마다 두 슬롯"
  status: OWNER_CONFIRMED_IN_CONVERSATION
  recorded_at: 2026-08-12
  recorder: Codex
  decision_precedence: LATEST_EXPLICIT_OWNER_DECISION_GOVERNS
  runtime_authority: true
  runtime_applied: PENDING_PR_216
  implementation_scope: "local RPE-and-duration beta only"
  numeric_prescription_authority: false
```

## 1. 결정 원문

> 만약 일 2회 훈련을 선택했다면 진짜로 2회 훈련을 기준으로 주자. 그냥 지정해버리고, 하루에 칸을 나눠서 두개를 각각 보여줘.

이 결정은 기존 대화에서 확정한 "하루 두 번을 매일 하는 것도 그 자체로 문제 삼지 않는다"는 범위를, 사용자가 **직접** 두 번 훈련을 고른 일정에 적용한다.

## 2. 지금 적용할 범위

`RECOVERY_PM_ALLOWED`는 저장된 이름을 유지한다. 사용자 화면에서는 `하루 두 번 운동할게요`로 보이며, 이 선택을 한 경우:

1. 고른 모든 훈련일에 서로 다른 오전·오후 슬롯을 만든다.
2. 각 슬롯은 별도 진행 기록으로 남고, 한 슬롯의 완료·건너뜀이 다른 슬롯을 덮어쓰지 않는다.
3. 사용자가 고르지 않으면 두 번째 슬롯을 만들지 않는다.
4. 하루에 고강도 세션 두 개를 자동으로 만들지 않는다.
5. 빠진 세션을 다음 날에 보충하지 않는다.

이 결정은 `DOUBLE_SESSION_BETA_SAFETY_CONTRACT.md`의 이전 `DSB-INV-005` 회복 세션 건수 상한을, 사용자가 직접 선택한 **전체 두 번 일정**에는 적용하지 않도록 대체한다. 예전 상한은 이전의 "일부 날에 회복 지원을 더하는" 동작을 위한 것이며, 이제 사용자가 고른 전체 두 번 일정과 같은 동작을 설명하지 못한다.

## 3. 이 결정이 열지 않는 것

- 개인 기록으로 만든 페이스·거리·반복·회복 시간
- 하루 고강도 두 번을 자동으로 만드는 기능
- 상세 템플릿의 활성화
- D9 안전 중단 우회 또는 의료적 허가
- 원문 메모·통증 서술을 계획 수치에 넣는 기능

현재 출력은 기존의 시간 범위·RPE·훈련 목적만 사용한다. 어떤 세션이 개인에게 적절한지 수치로 단정하지 않는다.

## 4. 남은 작업

두 번째 세션의 개별 훈련 내용, 총 훈련량 상한, 상세 숫자 처방은 이 결정으로 정하지 않았다. 이들은 별도의 선수 조건·종목·근거를 갖춘 뒤 사용자가 결정한다.

[DRAFT_COMPLETE]
