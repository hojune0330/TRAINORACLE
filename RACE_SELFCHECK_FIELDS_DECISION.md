# RACE_SELFCHECK_FIELDS_DECISION.md

```yaml
decision_metadata:
  decision_id: TO-DECISION-RACE-SELFCHECK-FIELDS-2026-07-14-001
  status: OWNER_APPROVED_APP_LOCAL_PILOT
  decided_by: COACH_HOJUNE
  approved_at: 2026-07-14
  recorded_by: CODEX
  triggered_by: PR60_review_CHANGES_REQUESTED
  owner_decision_refs:
    - OWNER_CHAT_2026-07-14_RACE_SELFCHECK_FIELDS_APPROVED_AS_RECOMMENDED
    - OWNER_CHAT_2026-07-14_GOAL_PACE_MUST_BE_STRUCTURED
    - OWNER_CHAT_2026-07-14_PRIVATE_VS_ANALYZABLE_NOTE_BOUNDARY
    - OWNER_CHAT_2026-07-14_CODEX_APP_HANDOFF_AUTHORIZED
  related: [PR60, PR61, PR62, PR63, Issue42]
  scope: app_local_JournalEntry_UI_storage_transient_assessment_pilot
  implementation_handoff: owner_authorized_Codex_continuation_of_Fable_PR60
  delivery_intent: supersede_PR60_without_merging_it
  server_contract_change: none
  canonical_race_subtype_change: none
  formation_or_plan_runtime_authority: none
```

## 1. 승인된 앱 로컬 필드

앱의 로컬 `RaceEntry` 파일럿에 다음 선택 필드를 추가한다. 입력하지 않은
필드는 UI에서 `미기록`으로 표시하고, 값을 추론하거나 소급해서 채우지 않는다.
현재 앱은 `fieldProvenance`를 저장하지 않으므로 외부 계약 판독에서는
`LEGACY_MISSING_PROVENANCE`다. provenance가 실제로 함께 저장되는 새 기록부터
출처가 확인된 `MISSING`으로 구분할 수 있다.

| 필드 | 타입 | 계약 범위 | 의미 |
|---|---|---|---|
| `tension?` | number | 정수 1-10 | 경기 직전 긴장도 |
| `condition?` | number | 정수 1-5 | 경기 직전 컨디션 자기 평가 |
| `goalPace?` | object | 아래 `TargetPaceV1` | 경기 목표 페이스 |
| `mood?` | number | 정수 1-5 | 경기 직후 감정 |

```ts
interface TargetPaceV1 {
  schemaVersion: 1;
  unit: "seconds_per_kilometer";
  secondsPerKm: number; // positive integer
}
```

`secondsPerKm`는 0보다 큰 정수여야 한다. `goalPace`는 페이스만 담고, 경기
전략이나 그 밖의 자유 텍스트를 담지 않는다. 전략을 적으려면 현재 기록에서
`PRIVATE_SELF_ONLY` 또는 `ANALYZABLE_TRAINING_NOTE` 목적을 명시적으로 고른
메모를 사용해야 한다.

## 2. 메모 목적과 프라이버시

새 자유 텍스트는 저장 전에 다음 목적 중 하나를 명시적으로 선택한다.

| 목적 | 사용자 표기 | 처리 계약 |
|---|---|---|
| `PRIVATE_SELF_ONLY` | 나만의 메모 | 로컬 저장 뒤 처리 종료. 분석, 신호 생성, 동기화, 코치 접근, 내보내기 금지 |
| `ANALYZABLE_TRAINING_NOTE` | 훈련 메모 / 오늘의 메모 | 원문은 이 기기에만 저장. 명시적 선택이 있을 때만 로컬 일시 분석 허용 |

- 기존 메모, 목적이 없는 메모, 알 수 없는 목적의 메모는 모두
  `PRIVATE_SELF_ONLY`로 읽는다.
- `PRIVATE_SELF_ONLY`의 내용뿐 아니라 존재 여부, 길이, 작성 빈도도 분석이나
  보상 신호로 사용하지 않는다. 안전 입력으로도 평가하지 않는다.
- `ANALYZABLE_TRAINING_NOTE` 원문은 서버, 분석 저장소, 감사 로그, 코치 화면,
  외부 LLM, 내보내기 데이터에 포함하지 않는다.
- `ANALYZABLE_TRAINING_NOTE`를 현재 기록에서 명시적으로 선택한 경우에만 원문을
  로컬 일시 D9 평가기에 전달할 수 있다. 평가는 검토 필요성을 높이는 비식별
  허용목록 메타데이터를 현재 화면에 반환할 수 있지만, 위험을 낮추거나
  `D9_ACTIVE`, `D9_UNKNOWN`, Safety Gate 차단 상태를 해제할 수 없다.
- 일시 평가 결과는 저장하지 않고 Formation, Plan Generator, Trends 또는 코치
  화면의 근거로 전달하지 않는다. 현재 계획·Safety Gate 다운스트림 소비자는
  없으며, 실행 중이라고 주장하지 않는다.

현재 앱 저장소는 브라우저 `localStorage`이며 저장 시 암호화 증거가 없다.
따라서 UI는 "이 기기에만 저장"이라고만 설명할 수 있고 "보안 메모" 또는
"암호화된 일기"라고 주장할 수 없다.

## 3. 판독과 검증

- `tension`, `condition`, `mood`는 저장과 읽기 양쪽에서 정수 및 범위를
  검증한다.
- `goalPace`는 객체 형태, `schemaVersion`, `unit`, `secondsPerKm`를 저장과
  읽기 양쪽에서 검증한다. 문자열 목표 페이스나 전략 문장은 이 필드의 유효한
  값이 아니다.
- 필드가 없고 provenance도 없는 과거·현재 기록은 UI에서는 `미기록`, 외부 계약
  판독에서는 `LEGACY_MISSING_PROVENANCE`다. provenance를 실제 저장한 새 기록만
  출처가 확인된 `MISSING`으로 읽을 수 있다. 어떤 경우에도 결측값에서 선수를
  추론하거나 임의 기본값을 채우지 않는다.
- 범위 밖 또는 구조가 잘못된 값을 분석·통계·계획 데이터로 복구하거나
  추론하지 않는다.

## 4. 분석과 계획 사용 제한

네 필드는 현재 **수집 및 표시 전용**이다. 주간 통계, Trends, Formation,
훈련계획 생성, 추천, 안전 판정에 사용하지 않는다. 이후 사용하려면 최소한
다음 별도 승인이 필요하다.

1. 필드별 출처와 결측을 구분하는 provenance 계약
2. 분석 어휘, 계산 방식, 불확실성 표시에 대한 검수
3. 실제 입력·내보내기·레거시 판독 증거
4. COACH_HOJUNE의 분석 및 계획 소비 승인

## 5. 권한 경계

이 결정은 PR #60 후속 작업을 위한 **앱 로컬 파일럿 스키마**다.
`RACE_RECORD_AND_HISTORICAL_RECALL_SPEC.md`의 정본 `RaceDayCheckInRecord`를
변경하거나 새 정본 서브타입을 만들지 않는다. 서버 계약, 동기화 계약,
Formation/Adaptation 정본 승격, Plan Generator 실행, 그림자 모드 실행을
승인하지 않는다. 그 연결은 각각의 소유 문서와 별도 런타임 증거 및 소유자
승인이 필요하다.

[DECISION_RECORDED — COACH_HOJUNE APPROVED 2026-07-14]
