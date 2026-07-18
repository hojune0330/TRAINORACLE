# Formation Latest Owner Decision Baseline

```yaml
decision_precedence: LATEST_EXPLICIT_OWNER_DECISION_GOVERNS
status: AUTHORITATIVE_PRODUCT_DIRECTION
owner: COACH_HOJUNE
decision_id: TO-OWNER-FORMATION-2026-07-17-01
recorded_at: 2026-07-17T20:56:07+09:00
source_ref: CURRENT_TASK_OWNER_DIRECTIVE_LATEST_CHOICES_ARE_BASELINE
latest_owner_direction_binding: reports/review/FORMATION_OWNER_DIRECTION_BINDING_2026-07-18.md
owner_product_identity: 9_5_DAY_FORMATION
owner_target_authority: DEFAULT_AUTOMATED_PRESCRIPTION
canonical_spec_patch_required: true
runtime_authority: false_until_named_gates_pass
```

## 기준 결정

1. TRAINORACLE의 제품 정체성은 `9_5_DAY_FORMATION`이다. 9.5일은 모든 선수에게 같은
   훈련을 복사하는 규칙이 아니라 기본 시간 틀이다. 그 안의 훈련 종류, 양, 순서, 회복,
   대회 대응은 선수 기록과 코치 규칙에 맞춰 달라진다.
2. 목표 권한은 `DEFAULT_AUTOMATED_PRESCRIPTION`이다.
3. 적격 입력에서는 시스템이 결정적으로 **기본 계획 1개**를 먼저 고른다.
4. 코치는 비교·수정·예외 계획·초기 청소년 실행 확인을 담당한다. 시스템이 기본안을
   고르는 행위 자체를 막는 필수 선택 마법사가 아니다.
5. 연구는 9.5일 채택 여부를 다시 결정하지 않는다. 입력·배치·예외·설명·중단·인계를
   제한하며 과학적 최적성·우월성·안전성은 주장하지 않는다.
6. 5일·10일·12-13일 등은 동급 자동 선택지가 아니다. 9.5일 적격 후보가 없으면
   `NO_AUTOMATED_PLAN -> KEEP_CURRENT_COACH_AUTHORED_PLAN`이다.
7. `PRIVATE_SELF_ONLY`는 분석·계획·보상·telemetry·안전 신호에서 존재 여부까지
   zero-signal이다.
   `ANALYZABLE_TRAINING_NOTE`는 사용자가 그 기록에서 분석 목적을 선택한 경우에만 승인된
   로컬 범위에서 분석할 수 있다. 이 분석 선택과 백업·공유 선택은 서로 다른 결정이다.
8. 메모 export 기본값은 제외다. 사용자는 preview와 명시 확인 뒤 자기 메모를 포함한
   로컬 전체 백업 `OWNER_FULL_LOCAL_BACKUP`을 만들 수 있다.
9. 사용자는 코치·친구·보호자 등 직접 선택한 사람에게 정확한 범위와 기간을 정해 공유할
   수 있다. 공유는 분석 동의나 코치 상시 접근 권한으로 변환되지 않는다.
10. 최신 결정이 이전 draft·acceptance·deferred 문서와 충돌하면 최신 결정이 제품 방향을
    정하고, 이전 문서는 `HISTORICAL_RUNTIME_STATE` 또는 `SUPERSEDED_PRODUCT_DIRECTION`으로
    표시한다.
11. 경기 자기점검의 `tension`, `condition`, `goalPace`, `mood`는 현재 로컬 파일럿에서는
    수집·표시 전용이지만, 제품 방향은 `CURRENT_DISPLAY_ONLY_FUTURE_ANALYSIS_INTENDED`다.
    provenance·결측·분석 방법·불확실성·사용자 설명·소유자 승인을 별도 계약으로 통과한
    뒤 선수 본인의 분석에 사용한다. 현재 제한을 영구 미사용 결정으로 읽지 않는다.
12. 부하 구성은 주관적·객관적·파생·맥락 값을 분리하고, 복합 세션을 순서 있는 구성요소로
    보존한다. 이 구조만으로 종합 피로·회복·안전 점수를 만들지 않는다.
13. 개인내 최소 근거는 관찰·설명 기준선·측정오차보다 큰 변화·사전 비교 가설의 단계로
    제한한다. 보편 최소 기록 수를 만들지 않고 근거가 부족하면 현재 코치 계획을 유지한다.
14. 대회 앵커와 실제 bout 기록은 분리한다. 같은 대회일의 완료 bout는 부하 기록으로 각각
    남기되 9.5일 계획의 MAIN 배치는 최대 한 번으로 묶는다.
15. 공유의 첫 구현은 메모 기본 제외, 미리보기와 확인을 거친 선택 내보내기·기기 공유다.
    앱 안 수신자 계정과 상시 접근은 별도 개인정보 계약 뒤로 미룬다.
16. 합성·책임자 통제·동의한 성인 내부 데이터로 비처방 그림자 QA를 할 수 있다. 실제 계획
    변경, 모집 선수 파일럿, 청소년 운영과 상용 처방은 이름 붙은 검토 전까지 금지한다.

## 개인정보와 중단 상태의 불변식

- `PRIVATE_SELF_ONLY`의 내용뿐 아니라 존재 여부, 길이, 작성 시각, 빈도, 누락, 키워드,
  요약, 감정, 임베딩, 검색색인은 분석·계획·보상·telemetry·안전 신호에서 모두 제외한다.
- 사용자가 직접 preview와 확인을 거쳐 만드는 `OWNER_FULL_LOCAL_BACKUP` 또는 수신자 공유는
  `USER_DIRECTED_FILE_OPERATION`이다. 메모를 분석 대상으로 바꾸거나 코치 상시 접근을 만들지
  않으며, analytics·보상·Formation 이벤트를 내보내지 않는다.
- `PREFER_NOT_TO_ANSWER`와 `NOT_ASKED`는 자동 후보만 로컬에서 멈춘다.
  `SUPPRESS_ONLY_NO_OUTBOUND_DISCLOSURE`이며 우려로 해석하거나 수신자 알림·network·audit·telemetry를
  만들지 않는다. 사람에게 보내기는 수신자·필드·목적·기간을 보여준 뒤 사용자가 따로 선택한다.
- 연결된 코치나 승인된 검토자가 없으면 `NO_CONFIGURED_REVIEWER_KEEP_CURRENT_PLAN`으로 현재 코치 작성
  계획과 기본 일지를 유지한다. 답변 거부·누락·우려·철회로 보상이나 기록 연속성을 잃게 하지 않는다.

## 정본 패치 대상

| 대상 | 최신 기준에 맞춘 변경 |
|---|---|
| `TRAINING_PLAN_FORMATION_AND_ADAPTATION_SPEC.md` | auto-select 절대 금지 제거; 기본안 선택과 실행 확인 분리 |
| `PLAN_GENERATOR_SPEC.md` | coach-only final selection 제거; deterministic primary default 추가 |
| `FORMATION_COACH_RULESET_AND_EXPOSURE_CONTRACT.md` | 후보 중단 이유와 `KEEP_CURRENT_COACH_AUTHORED_PLAN` 결과를 분리; 새 예외 계획을 암묵적으로 만들지 않음 |
| `FORMATION_RESEARCH_ACCEPTANCE_DECISION.md` | 과거 runtime 비활성 기록으로 격하; 최신 결정 링크 |
| `FORMATION_READ_NOW_DECIDE_LATER.md` | `no automatic plan`을 `no active runtime before gates`로 변경 |
| `FORMATION_DEFERRED_GOALS.md` | 자동 처방 정체성은 deferred에서 제거; 실제 활성화만 gate 유지 |
| `DAILY_LOG_AND_CHECKIN_SPEC.md` | 절대 export 금지를 기본 제외 + 명시 local full backup으로 변경 |
| 공유 관련 정본 | 수신자·필드·목적·기간·preview·확인·철회 계약 추가 |
| `RACE_SELFCHECK_FIELDS_DECISION.md` | 현재 표시 전용과 향후 검증된 분석 의도를 분리; 분석 계약과 사용자 설명을 후속 정의 |

## 과학 상태와 실행 상태

```yaml
product_identity: FIXED
target_authority: FIXED
scientific_superiority: UNKNOWN
scientific_safety_of_whole_architecture: UNKNOWN
exact_rule_registry: NOT_APPROVED
human_reviews: NOT_COMPLETE
runtime_authority: false
```

제품 방향이 확정됐다는 사실과 지금 실제 자동 처방을 켤 수 없다는 사실은 동시에 참이다.

## 최신 방향과 남은 정식 게이트

책임자 방향은 `FORMATION_OWNER_DIRECTION_BINDING_2026-07-18.md`에 기록됐다. CA-02는 대회
앵커와 bout 기록 분리, CA-03은 경기별 부하 기록과 같은 대회일 MAIN 배치를 분리하는
수정안이다. 정식 결정란, 스포츠과학·통계·개인정보 검토와 정본 패치 전까지 기존 계산은
바뀌지 않으며 `FRV2-CONF-012`와 10개 P1도 열린 상태다.
