# Formation User And Spec Alignment Audit

```yaml
audit_id: TO-FRV2-USER-SPEC-ALIGNMENT-2026-07-17
scope: ATHLETE_COACH_GUARDIAN_PERMITTED_FLOWS
mode: READ_ONLY_SPEC_AUDIT
canonical_specs_changed: false
runtime_code_changed: false
owner_product_identity: 9_5_DAY_FORMATION
owner_target_authority: DEFAULT_AUTOMATED_PRESCRIPTION
current_runtime_authority: false
```

## 결론

현재 문서에는 좋은 안전 장치가 많이 있다. 9.5일 로컬 시간 프레임, MAIN 2-3회,
대회 1회 계산, 놓친 MAIN 몰아넣기 금지, 복합 세션 보존, 개인 메모 무신호,
선수에게 보이는 shadow, 5단계 설명, 색 외의 상태 표현은 서로 잘 맞는다.

그러나 지금 그대로는 구현을 시작하면 안 된다. 가장 큰 이유는 두 가지다.

1. 최신 책임자 결정은 **9.5일 Formation을 제품의 기본 자동 처방 정체성**으로
   고정했지만, 핵심 Formation/Plan Generator 정본 후보는 아직도 **자동 선택 금지,
   코치 최종 선택 필수**로 고정돼 있다.
2. 책임자는 메모를 포함한 전체 백업과 사용자가 직접 고른 공유를 허용했지만,
   Daily Log는 개인 메모와 훈련 메모의 export를 절대 금지한다.

따라서 먼저 권한 모델과 메모 이동권을 정본 문서에 일치시키고, 그 다음 모바일
9.5일 표현, 중학생용 설명, 중단/이관, 보호자 허용 범위를 사용자 행동 단위로
묶어야 한다.

## 잘 맞는 부분

| 항목 | 현재 정합성 | 근거 |
|---|---|---|
| 9.5일 프레임 | 맞음 | `TRAINING_PLAN_FORMATION_AND_ADAPTATION_SPEC.md` 6장, `FORMATION_RESEARCH_PROTOCOL_V2.md` |
| MAIN 2-3회와 약 3일 배치 | 맞음. 단, 72시간은 허가 신호가 아님 | Formation 6/8장, Research Protocol RQ-B |
| 대회 | 맞음. 고정 앵커이며 MAIN 노출 1회 | `FORMATION_COACH_RULESET_AND_EXPOSURE_CONTRACT.md` 5/7장 |
| 놓친 MAIN | 맞음. 빚, 몰아넣기, 자동 이월 없음 | Coach Ruleset 5장, `CR-12/13/25`, `FA-TC-064` |
| 복합 세션 | 맞음. 한 세션 안의 구성요소를 보존하고 부모+자식을 중복 합산하지 않음 | Load Contract 7장, Projection Contract `Load And Composite Sessions` |
| 나만의 메모 | 맞음. 분석/계획/보상/감사에서 존재 여부까지 무신호 | Daily Log 8장, Note Safety 2장, Projection Contract `Note-Origin Privacy Boundary` |
| shadow 알림 | 맞음. 몰래 실행하지 않고 선수에게 시뮬레이션임을 알림 | `ATHLETE_VISIBLE_SHADOW_PILOT_PROTOCOL.md` |
| 접근성 원칙 | 문서 원칙은 맞음. 실제 사람 검증은 아직 없음 | Projection Contract `Accessibility`, `FORMATION_ACCESSIBILITY_AND_DESIGN_REVIEW.md` |

## 우선 수정 항목

### A1. 자동 처방 정체성과 코치 선택 전용 구조가 정면 충돌한다

- **현재 스펙 참조:**
  - `.omo/plans/trainoracle-formation-followup-deep-research.md`는
    `owner_target_authority: DEFAULT_AUTOMATED_PRESCRIPTION`을 고정한다.
  - `reports/research/FORMATION_RESEARCH_PROTOCOL_V2.md`는 9.5일을 제품 결정으로
    고정하고 runtime만 아직 끈다.
  - 반면 `specs/reconstruct/TRAINING_PLAN_FORMATION_AND_ADAPTATION_SPEC.md` 2/3.2장은
    `auto-select or auto-finalize` 금지와 `coach_final_selection_required: true`를 둔다.
  - `specs/active/PLAN_GENERATOR_SPEC.md` 0/8장은 모든 선택지의 자동 선택을 금지하고
    `CoachPlanSelectionRecord` 없이는 다음 단계로 가지 못하게 한다.
- **연구 시사점:** 9.5일의 보편적 우월성은 `UNKNOWN`이지만, 이는 제품 기본값을
  막는 근거가 아니다. 연구는 자동 처방의 입력, 예외, 중단, 설명을 제한한다.
- **사용자에게 보여야 할 행동:**
  - 선수: `TRAINORACLE이 만든 다음 9.5일 기본 계획이에요.`
  - 코치: `기본 계획 1개`를 먼저 보고, 필요할 때 비교안/수정 근거를 펼친다.
  - 안전 또는 자료 조건을 못 맞추면: `자동 계획을 만들지 않았어요. 현재 코치
    계획을 그대로 따르세요.`
- **충돌/공백:** 한 문서는 자동 처방이 제품 정체성이라고 하고 다른 문서는
  자동 선택 자체를 금지한다. 구현자는 어느 쪽을 따라야 할지 결정할 수 없다.
- **심각도:** `BLOCKER`
- **정확한 스펙 변경 제안:** Formation 3.2와 Plan Generator 0/8장에 아래 권한을
  정본으로 추가하고 기존 절대 금지 문구를 교체한다.

  ```yaml
  formation_product_authority:
    identity: 9_5_DAY_FORMATION
    target: DEFAULT_AUTOMATED_PRESCRIPTION
    scientific_superiority: UNKNOWN
    runtime_authority: false_until_named_gates_pass
    system_default_selection: ONE_DETERMINISTIC_9_5_PLAN
    alternatives: COLLAPSED_UNDER_COMPARE_OR_COACH_EDIT
    youth_initial_execution: LINKED_COACH_CONFIRMATION_REQUIRED_UNTIL_SEPARATELY_ACCEPTED
    ineligible_result: NO_AUTOMATED_PLAN_KEEP_CURRENT_COACH_AUTHORED_PLAN
  ```

  `system_default_selection`과 `execution activation`을 분리한다. 즉, 시스템은 한
  기본안을 자동으로 고르되, 첫 청소년 범위의 실제 실행에는 승인된 안전/보호자/
  코치 확인 게이트를 그대로 둔다.
- **필수 테스트:**
  - 같은 적격 입력/버전은 같은 기본 계획 1개를 선택한다.
  - 대안은 첫 화면에서 선택 부담을 만들지 않고 `비교하기` 아래에만 있다.
  - 안전/동의/출처/규칙 조건 하나라도 실패하면 선택 계획 0개이고 현재 코치 계획은
    바뀌지 않는다.
  - 어떤 설명 수준에서도 `9.5일이 과학적으로 최적`이라는 문구가 나오지 않는다.

### A2. 오래된 승인·안내 문서가 최신 제품 결정을 다시 뒤집는다

- **현재 스펙 참조:** `FORMATION_RESEARCH_ACCEPTANCE_DECISION.md`는 자동 계획 변경을
  채택하지 않았다고 쓰고, `FORMATION_READ_NOW_DECIDE_LATER.md`는 `코치가 최종 선택`,
  `no automatic plan`이라고 쓴다. `FORMATION_DEFERRED_GOALS.md`도 자동 확정 후보를
  금지한다.
- **연구 시사점:** 이전 결정은 당시 runtime 금지를 기록한 역사 자료로는 유효하지만,
  최신 owner identity와 제품 목표를 정의하는 정본으로 쓰면 안 된다.
- **사용자에게 보여야 할 행동:** 지금 기능이 꺼진 이유는 `9.5일이 취소됨`이 아니라
  `안전·개인정보·규칙 검증이 아직 끝나지 않음`으로 일관되게 설명한다.
- **충돌/공백:** `제품 목표`, `현재 실행 상태`, `과거 파일럿 상태`가 한 문장에 섞여
  있어 선수와 코치가 무엇이 확정이고 무엇이 아직 꺼져 있는지 알기 어렵다.
- **심각도:** `HIGH`
- **정확한 스펙 변경 제안:** 모든 상태 문서 공통 헤더에
  `product_identity`, `target_authority`, `current_runtime_authority`,
  `superseded_by`를 추가한다. 위 세 문서의 `no automatic plan`은
  `no active automated prescription before gates`로 바꾸고 최신 owner decision ID를
  연결한다. `quietly makes a draft`는 hidden shadow로 오해되므로
  `선수에게 보이는 비교 초안을 만든다`로 바꾼다.
- **필수 테스트:** 저장소 lint가 활성 문서에서 `coach-only final selection`,
  `no automatic plan`, `quietly/hidden shadow`를 찾으면 최신 decision ref 또는 명시적
  역사 상태가 없는 경우 실패한다.

### A3. 2-3개 선택지는 자동 처방의 사용자 경험과 맞지 않는다

- **현재 스펙 참조:** Formation 8.2장은 `BALANCED`, `CONSERVATIVE`, 최대 한 개의
  contextual candidate를 만들고, Plan Generator 8장은 기본 3개/최소 2개를 요구한다.
- **연구 시사점:** 직접 9.5일 비교 근거가 없으므로 여러 안을 보여 주는 것이 과학적
  정직성을 보장하지 않는다. 오히려 선택 부담만 늘 수 있다. 결정성, 실패 조건,
  설명 가능성이 더 중요하다.
- **사용자에게 보여야 할 행동:** 선수는 `기본 계획` 하나와 `왜 이렇게 됐는지`를
  먼저 본다. 코치는 `보수적으로`, `대회 중심` 같은 대안을 필요할 때만 펼친다.
- **충돌/공백:** 제품은 선택지를 줄이려는 정체성인데 첫 흐름이 2-3안 비교와 코치
  선택으로 설계돼 있다.
- **심각도:** `HIGH`
- **정확한 스펙 변경 제안:** 후보 생성은 내부적으로 유지하되 projection 계약을
  `PRIMARY_DEFAULT + OPTIONAL_ALTERNATIVES`로 바꾼다. 기본안 자동 선택 규칙과 대안
  노출 조건을 버전 등록하고, 선수 화면에서는 대안 선택을 요구하지 않는다.
- **필수 테스트:** 320/375px 첫 화면에 기본 계획, 다음 행동, 중단 이유만 보이고
  대안 카드가 세로로 연속 노출되지 않는다. 코치가 `비교하기`를 열면 변경된 세션,
  trade-off, 동일한 안전 제약을 나란히 확인할 수 있다.

### A4. 5단계 설명은 좋은 구조지만, 쉬운 단계에도 내부 용어가 새어 나온다

- **현재 스펙 참조:** `FORMATION_PRODUCT_PROJECTION_AND_EXPLANATION_CONTRACT.md`는
  `쉽게/짧게/균형/자세히/정확히`를 정의한다. 시제품은 `MAIN`, `RPE`,
  `PRIVATE_SELF_ONLY`, `fact hash`, `plan hash`, `신경계 부담`을 화면에 노출한다.
- **연구 시사점:** 청소년 대상 근거의 직접성이 낮고, 입력 부담/이해도가 파일럿의
  핵심 결과다. 용어를 어렵게 만드는 것은 정확성을 높이는 일이 아니다.
- **사용자에게 보여야 할 행동:**
  - 쉽게: `중요한 훈련 3번을 한꺼번에 몰지 않았어요.`
  - 짧게: 핵심 날짜, 대회, 바뀐 점, 확인할 점만 표시한다.
  - 정확히: 출처, 단위, 규칙 버전, 누락 상태를 펼친다.
  설명 수준은 언제든 사용자가 바꾸고 다음 화면에서도 유지된다.
- **충돌/공백:** 단계별 불변 사실은 잘 정의됐지만, 단계별 금지 용어, 기본값,
  기억 방식, 중학생 이해 기준이 없다. 현재 `균형` 화면도 내부 enum을 보여 준다.
- **심각도:** `HIGH`
- **정확한 스펙 변경 제안:** Projection Contract에
  `level_preference_is_user_owned`, `default_for_unconfirmed_youth: EASY`,
  `L1_L3_internal_enum_and_hash_forbidden`, `action_first_copy_required`를 추가한다.
  9.5일은 `가설`이라고만 부르지 말고 `TRAINORACLE의 기본 설계이며 모두에게 최적임이
  증명된 값은 아님`으로 제품 결정과 과학 상태를 한 문장에 분리한다.
- **필수 테스트:** 중학생 참여자가 L1만 읽고 `오늘 무엇을 해야 하는가`, `누가
  바꿀 수 있는가`, `멈추면 어떻게 되는가`를 각각 설명한다. L1-L3 DOM과 접근성
  이름에서 raw enum/hash가 0건이어야 한다. 수준 전환 전후 fact/result/plan hash와
  권한은 동일해야 한다.

### A5. 모바일의 9.5일 캘린더가 10개 같은 날처럼 보이거나 뒤가 잘릴 수 있다

- **현재 스펙 참조:** `MICROCYCLE_AND_CALENDAR_MAPPING_SPEC.md` 7.3/10장은
  `cycleSlotCount: 10`과 10-slot rail을 정의한다. 시제품은 320px에서 가로 rail로
  1-5일만 첫 화면에 보이고, 실제 마크업은 1-8일 다음에 바로 `9.5일`을 둔다.
- **연구 시사점:** 9.5일은 로컬 civil-time 경계다. 10개의 동일한 칸으로 표현하면
  마지막 반나절과 날짜 경계를 잘못 이해하게 할 수 있다.
- **사용자에게 보여야 할 행동:** `7월 18일 아침부터 7월 27일 저녁까지`처럼 실제
  경계를 먼저 보여 주고, 마지막 반나절은 크기와 글자로 구분한다. 모바일 첫 화면은
  `오늘/다음 MAIN/대회`를 우선하고 전체 9.5일은 펼쳐 본다.
- **충돌/공백:** 데이터 모델의 `10 slots`가 9.5일 물리 길이와 연결되지 않고,
  mobile horizontal overflow의 다음 내용 힌트와 키보드/스크린리더 순서가 없다.
- **심각도:** `HIGH`
- **정확한 스펙 변경 제안:** `cycleSlotCount: 10`을 표시 사실로 사용하지 말고
  각 segment에 `startLocal`, `endLocal`, `durationCivilHours`,
  `displayWeight`, `isPartialDay`를 둔다. 모바일 projection은
  `UPCOMING_SUMMARY + EXPAND_FULL_FRAME`을 정본 동작으로 추가하고 대회 앵커는 접힌
  상태에서도 항상 보이게 한다.
- **필수 테스트:** DST 전환, 자정이 아닌 시작, 마지막 반나절, 대회가 frame 끝에
  걸친 경우를 검증한다. 320/375px, 200% 확대, 키보드, 스크린리더에서 모든 날짜와
  세션에 도달하며 숨은 항목 수/펼치기 상태가 안내돼야 한다.

### A6. 복합 세션 데이터는 잘 보존하지만 사용자 화면의 핵심과 세부가 섞여 있다

- **현재 스펙 참조:** Load Contract 7장과 Projection Contract `Load And Composite
  Sessions`는 부모/자식 중복 금지와 whole-session RPE 비분할을 정확히 정의한다.
  시제품은 `플라이오 + 웨이트 + 신경계 부담`을 같은 component grid에 둔다.
- **연구 시사점:** 동시훈련 연구는 결과/순서/분리 시간에 따라 달라 보편 피로
  숫자를 만들 수 없다. `신경계 피로`는 관찰값이 아니라면 구성요소로 표시하면 안 된다.
- **사용자에게 보여야 할 행동:** 첫 줄은 `MAIN · 달리기 + 플라이오 + 웨이트`,
  펼치면 순서/시간/세트/출처를 보여 준다. 측정하지 않은 값은 `확인할 수 없음`이며
  색 면적이나 막대 비율로 추정하지 않는다.
- **충돌/공백:** 정본 계약은 구성요소와 반응을 분리하지만 시제품은 관찰된 운동과
  계산하지 않은 `신경계 부담`을 같은 수준에 둔다. 이것은 선수에게 숨은 피로 판정처럼
  보일 수 있다.
- **심각도:** `HIGH`
- **정확한 스펙 변경 제안:** component projection에
  `kind: PERFORMED_WORK | ATHLETE_RESPONSE | MEASURED_RESPONSE | DATA_STATE`를 필수화하고,
  관찰되지 않은 fatigue construct는 component list에서 금지한다. 세션의 주표시는
  역할/대회 상태이며 component 색은 보조 단서로만 쓴다.
- **필수 테스트:** 러닝+플라이오+웨이트 세션이 MAIN 1회로 계산되고 세 구성요소는
  모두 남는다. whole RPE가 분할되지 않고, unknown share는 비율 시각화가 없으며,
  `fatigue/neural/readiness`가 측정 provenance 없이 표시되면 실패한다.

### A7. 메모 전체 백업에 대한 정본 충돌을 바로 닫아야 한다

- **현재 스펙 참조:**
  - `FORMATION_RECORD_GOVERNANCE_CONTRACT.md` 6장과
    `NOTE_SAFETY_SIGNAL_AND_REVIEW_STATE_CONTRACT.md` 9장은 기본 메모 제외, 확인한
    `OWNER_FULL_LOCAL_BACKUP` 포함을 허용한다.
  - `FORMATION_PRIVACY_GOVERNANCE_DECISION.md`도 이 owner 결정을 유지한다.
  - 반면 `DAILY_LOG_AND_CHECKIN_SPEC.md` 8장은 `PRIVATE_SELF_ONLY.export_allowed:false`,
    `ANALYZABLE_TRAINING_NOTE.raw_text_export_allowed:false`로 절대 금지한다.
- **연구 시사점:** 개인 메모의 zero-signal은 분석/계획/보상/telemetry 경계다.
  사용자가 자기 파일을 만드는 명시적 작업까지 금지해야 한다는 뜻은 아니다.
- **사용자에게 보여야 할 행동:** 기본 백업은 메모 제외다. `메모도 포함`을 직접
  켜면 어떤 민감한 내용이 들어가는지 미리 보고, 기기 안에서 파일을 만든 뒤
  다시 확인한다.
- **충돌/공백:** 동일한 데이터에 대해 허용과 절대 금지가 동시에 존재한다.
- **심각도:** `BLOCKER`
- **정확한 스펙 변경 제안:** Daily Log 두 항목을 아래처럼 교체한다.

  ```yaml
  default_export: MEMOS_EXCLUDED
  owner_full_local_backup:
    private_memo_allowed: EXPLICIT_INCLUDE_AFTER_PREVIEW_AND_CONFIRMATION
    training_memo_allowed: EXPLICIT_INCLUDE_AFTER_PREVIEW_AND_CONFIRMATION
    network_request: forbidden
    changes_analysis_or_sharing_consent: false
    service_control_after_file_leaves_device: none
  ```

  export 경로는 private-note zero-signal 검증에서 명시적인 `USER_DIRECTED_FILE_OPERATION`
  예외로만 분리하고 Formation consumer로 등록하지 않는다.
- **필수 테스트:** 기본 export에 메모/purpose가 없고, 전체 백업은 두 번의 명시 행동
  뒤에만 메모를 포함한다. 전체 백업 생성 시 network 요청/analytics/reward/Formation
  이벤트는 0건이다. 취소하면 파일이 생기지 않는다.

### A8. 선택형 공유 결정은 보존됐지만 실제 사용자 흐름이 아직 없다

- **현재 스펙 참조:** Record Governance 4/6장과 Human Review `Sharing`은 수신자,
  필드, 목적, 만료, preview, confirmation을 요구한다. 현재 앱 안 코치/친구/보호자
  전송은 `blocked`이고 로컬 파일 직접 전달만 허용한다.
- **연구 시사점:** 공유는 분석 동의나 코치 권한으로 변환되면 안 된다. 특히 청소년은
  수신자별 범위와 철회가 필요하다.
- **사용자에게 보여야 할 행동:** `코치에게 보여주기`, `친구에게 보여주기`,
  `보호자에게 보여주기`는 각각 별도 흐름이며, 실제 이름/보낼 메모/기간을 고른 뒤
  최종 preview를 본다. 아무 것도 기본 선택되지 않는다.
- **충돌/공백:** 책임자의 선택형 공유 결정은 deferred register에만 있고, 어떤
  제품 화면/상태/API가 이를 소유할지 정본 target이 없다. `친구`는 현재 account role도
  아니다.
- **심각도:** `HIGH`
- **정확한 스펙 변경 제안:** 별도 `USER_DIRECTED_RECIPIENT_SHARE_CONTRACT`를 열어
  `recipient identity`, `exact fields`, `memo inclusion default off`, `one-time/expiry`,
  `download/re-share warning`, `future access revocation`, `youth state`, `delivery
  receipt`, `deletion propagation limit`을 소유하게 한다. 로컬 파일 직접 보내기는 계속
  별도 경로로 둔다.
- **필수 테스트:** coach/friend/guardian 간 grant 상속 0건, 수신자 변경 시 확인 무효,
  메모 기본 off, 만료/철회 후 새 접근 차단, 자동 알림 0건, 파일을 밖으로 보낸 뒤
  회수 불가능하다는 경고가 보인다.

### A9. 보호자 동의는 정의됐지만 선수에게 보이는 통제 화면이 부족하다

- **현재 스펙 참조:** Record Governance 4/7장, Projection Contract `Audiences`,
  App Bridge 5장은 보호자 권한을 별도 grant로 제한한다. Projection prototype은
  허용된 보호자에게 기록 완료 여부만 보여 준다.
- **연구 시사점:** 보호자 동의와 선수의 이해/assent는 분리돼야 한다. 성숙도를 나이로
  추정해서도 안 된다.
- **사용자에게 보여야 할 행동:** 선수는 `누가, 무엇을, 언제까지 볼 수 있는지`를
  한 화면에서 보고 optional 공유를 거절/철회할 수 있다. 보호자는 허용 범위 밖의
  필드가 있다는 사실만 알고 내용이나 메모 존재 여부는 알지 못한다.
- **충돌/공백:** 권한 데이터 구조는 있으나 athlete-facing grant center, 분쟁 상태,
  age-transition 재확인, 철회 후 화면 상태가 제품 계약에 없다.
- **심각도:** `HIGH`
- **정확한 스펙 변경 제안:** Projection/App Bridge에
  `ATHLETE_DATA_ACCESS_CENTER`와 상태 `ACTIVE | EXPIRES_SOON | REVOKED | DISPUTED |
  AGE_TRANSITION_REVIEW`를 추가한다. optional processing은 선수 거절이 우선하고,
  법적으로 필요한 별도 처리와 제품 선택을 같은 toggle로 합치지 않는다.
- **필수 테스트:** 보호자 동의만 있고 선수 optional assent가 없으면 shadow/share가
  시작되지 않는다. private memo는 모든 보호자 상태에서 byte-identical zero-signal이다.
  철회/분쟁은 다음 읽기에서 바로 차단되고 base journal은 유지된다.

### A10. shadow는 보이게 설계됐지만 진행 표시만으로는 다음 행동을 알기 어렵다

- **현재 스펙 참조:** Athlete-Visible Shadow Protocol 87장과 Formation 11A는
  `1/3 비교 완료`, 날짜, `실행 안 됨`, pause/withdraw를 요구한다. 세 frame은 28.5
  local-civil days인 제안이며 아직 duration 승인 전이다.
- **연구 시사점:** 첫 pilot은 효과가 아니라 이해, 부담, 완결성, withdrawal,
  coach handoff를 평가한다. 진행률을 성과처럼 보이면 평가 자체가 왜곡된다.
- **사용자에게 보여야 할 행동:** `첫 번째 비교가 끝났어요 · 실제 계획에는 반영되지
  않았어요 · 다음 확인 예정일`, 멈춤이면 `잘못한 것이 아니며 무엇을 기다리는지`,
  그리고 `잠시 멈추기/그만두기`가 같은 화면에 보인다.
- **충돌/공백:** 허용/금지 문구는 좋지만 진행 상태별 `다음 행동`, 예상되는 다음
  checkpoint, 자료 부족 시 사용자가 고칠 수 있는 것과 없는 것이 구분되지 않는다.
- **심각도:** `MEDIUM`
- **정확한 스펙 변경 제안:** progress projection에
  `completedCount`, `totalCount`, `lastCompletedBoundary`, `nextCheckpointBoundary`,
  `plainStateReason`, `athleteCanAct`, `availableActions`, `notExecutionLabel`을 추가한다.
  frame mark와 journal sticker는 화면에서도 다른 영역/접근성 이름을 쓴다.
- **필수 테스트:** missed checkpoint, pause, withdrawal, no-candidate가 성공률/연속
  기록으로 표현되지 않는다. 모든 상태에서 중단 버튼은 44x44 이상이고, 상태 변경이
  focus를 빼앗지 않으면서 screen reader에 알려진다.

### A11. 중단/사람 이관은 안전하지만, 선수에게 막다른 화면이 될 수 있다

- **현재 스펙 참조:** Shadow Protocol 96장, Note Safety 6/8장, Plan Safety Gate
  9A/11장은 자동 재개와 자동 recipient notification을 금지한다. 시제품은
  `검토 요청` 버튼을 비활성화하고 `정식 검토자와 연결되기 전에는 요청할 수 없음`만
  보여 준다.
- **연구 시사점:** 72시간, 좋은 점수, 메모 silence는 clearance가 아니다. 반대로
  fail-closed가 사용자를 방치한다는 뜻도 아니다.
- **사용자에게 보여야 할 행동:** `자동 계획은 멈췄어요. 현재 코치 계획은 그대로예요.`
  아래에 `내 기록 확인`, `코치에게 직접 보여주기`, `나중에 다시 확인`을 제공한다.
  불편함/긴급 도움은 국가·연령에 맞게 승인된 사람 도움 안내로 분리한다.
- **충돌/공백:** 시스템이 멈추는 조건은 상세하지만, 코치가 연결되지 않았거나 review가
  지연될 때 선수의 안전한 다음 행동과 offline fallback이 없다.
- **심각도:** `HIGH`
- **정확한 스펙 변경 제안:** 모든 block/pause reason에 다음 네 줄을 의무화한다:
  `what_happened`, `what_remains_unchanged`, `what_the_athlete_can_do_now`,
  `who_can_resolve`. 자동 전송은 계속 금지하되 사용자가 exact recipient/scope를
  고르는 share/export 경로를 연결한다. 지원 안내는 진단이 아닌 별도 지역화 계약으로
  소유한다.
- **필수 테스트:** reviewer 없음, coach 미연결, offline, stale source, guardian dispute,
  urgent-support 상태마다 dead-end가 없고, base journal과 last accepted plan은 유지된다.
  명시 확인 전 network notification은 0건이다.

### A12. 대회/놓친 MAIN의 엔진 규칙은 좋지만 사용자용 복구 문구가 없다

- **현재 스펙 참조:** Coach Ruleset 5장은 race first, missed MAIN no debt/catch-up,
  collision `NEEDS_COACH_CLARIFICATION`을 정의한다. Formation fixtures `FA-TC-005/064`
  와 Coach fixtures `CR-12/13/23/25`가 이를 추적한다.
- **연구 시사점:** competition anchoring은 9.5일 자동 계획의 핵심이지만 taper와
  충돌 해결의 직접 근거는 부족하다. 자동 추측보다 명시적 중단이 맞다.
- **사용자에게 보여야 할 행동:**
  - 대회 충돌: `대회는 그대로 두었어요. 겹친 훈련은 아직 확정하지 않았어요.`
  - MAIN 누락: `놓친 훈련을 다음 날에 몰아넣지 않아요. 다음 계획은 빚처럼 늘지
    않아요.`
  - 재배치: 이전/새 날짜, 바뀐 이유, 승인자를 비교해서 본다.
- **충돌/공백:** machine state는 있으나 athlete/coach projection reason code와
  correction/reschedule UX가 없다. `NEEDS_COACH_CLARIFICATION`은 사용자 문구가 아니다.
- **심각도:** `HIGH`
- **정확한 스펙 변경 제안:** Projection Contract에
  `RACE_PRESERVED_SESSION_UNRESOLVED`, `MISSED_MAIN_NO_DEBT`,
  `RESCHEDULE_REQUIRES_NEW_PLAN_VERSION`의 한국어 L1-L5 template과 action mapping을
  추가한다. 불확실 상태에서는 기존 accepted plan을 덮어쓰지 않는다.
- **필수 테스트:** race collision 후 race는 고정, flexible MAIN은 미확정, 기존 계획
  hash는 유지된다. missed MAIN 뒤 successor frame count에 debt가 없고, UI/notification/
  calendar 어디에도 catch-up 제안이 생기지 않는다.

### A13. 동의 분리는 옳지만 4/4 시험과 여러 목적이 인지 부담이 될 수 있다

- **현재 스펙 참조:** Shadow Protocol 70장은 별도 opt-in과 4/4 comprehension을,
  Record Governance 5장은 journal/sync/analysis/share/research/reward 등을 분리한다.
- **연구 시사점:** 이해와 withdrawal은 pilot의 핵심 결과다. 동의를 많이 받는 것이
  이해가 높다는 뜻은 아니다.
- **사용자에게 보여야 할 행동:** 필요한 순간에 한 목적만, `무엇을 쓰는지/무엇을
  하지 않는지/끄면 무엇이 유지되는지` 세 줄로 본다. 틀렸을 때 `실패`가 아니라
  다른 설명으로 돌아간다. privacy center에서 나중에 모두 확인/철회한다.
- **충돌/공백:** 분리 원칙은 강하지만 prompt 빈도, 재질문 조건, 중학생의 수치심 없는
  이해 확인, 작은 화면 완료 시간이 없다.
- **심각도:** `MEDIUM`
- **정확한 스펙 변경 제안:** `JUST_IN_TIME_SINGLE_PURPOSE_NOTICE`,
  `NO_PRESELECT`, `NO_FAILURE_LABEL`, `BASE_JOURNAL_ALWAYS_AVAILABLE`,
  `CONSENT_CENTER_SUMMARY`를 participation contract에 추가한다. 4/4 결과는 reward,
  coach 평가, athlete ranking에 들어가지 않는다.
- **필수 테스트:** 거절/오답/철회로 journal 기능, sticker, coach 관계가 변하지 않는다.
  320px에서 한 번에 한 목적만 보이고 뒤로가기/중단 후 상태가 보존된다. 이해 응답이
  analytics 또는 plan input으로 흐르지 않는다.

### A14. 접근성 원칙은 좋지만 현재 색·모바일·사람 검증은 아직 통과가 아니다

- **현재 스펙 참조:** Projection Contract `Accessibility`는 WCAG 2.2 AA, 44x44,
  320/375px, 200% reflow, reduced motion을 요구한다. Accessibility Review는
  `--ink-4`, `--e-lt`, `--e-rest`, `--line` 계열의 대비 부족과 human/AT review 부재를
  기록한다.
- **연구 시사점:** 청소년의 이해도와 사용 가능성은 합성 screenshot이나 자동 검사로
  확정할 수 없다.
- **사용자에게 보여야 할 행동:** 색을 못 보거나 확대해도 MAIN/대회/회복/중단과
  실제 계획 여부를 동일하게 이해한다. 긴 한글, 큰 글자, 가로 모드, screen reader에서도
  다음 행동이 잘리지 않는다.
- **충돌/공백:** 테스트 패키지는 잘 정의됐지만 named athlete/coach/AT 검토가 없고,
  시제품의 가로 rail은 다음 항목이 있다는 신호가 약하다. 실패한 token도 아직 금지
  목록으로 승격되지 않았다.
- **심각도:** `BLOCKER_BEFORE_PRODUCT_UI_ACCEPTANCE`
- **정확한 스펙 변경 제안:** 실패한 색 조합을 `PROHIBITED_FOR_TEXT_OR_SOLE_STATE`
  registry로 올리고, mobile rail affordance, 400%/320 CSS px equivalent reflow,
  dynamic text, Korean long-label stress case를 acceptance에 추가한다. 자동검사와
  named human/AT 결과를 별도 필드로 유지한다.
- **필수 테스트:** NVDA+Chrome 또는 승인된 동등 조합, keyboard-only, grayscale,
  high contrast, reduced motion, 320/375px, 200%와 400% equivalent에서 통과해야 한다.
  상태/날짜/대회/중단/공유 범위가 색 또는 hover만으로 전달되면 실패한다.

### A15. 기록이 부족하거나 틀렸을 때 사용자가 고칠 수 있는 경로를 더 선명하게 해야 한다

- **현재 스펙 참조:** Projection Contract는 source/freshness/missingness/correction
  path를 요구하고, Formation은 invalid input을 `NEEDS_COACH_CLARIFICATION`으로 닫는다.
  Load Contract는 missing을 0으로 채우지 않는다.
- **연구 시사점:** 개인내 최소 근거에 보편 n/freshness 기준은 없다. 기록이 적다는
  이유만으로 선수의 계획 준수나 성실성을 평가하면 안 된다.
- **사용자에게 보여야 할 행동:** `수면 시간이 빠져 있어 이 부분은 계산하지 않았어요`
  와 함께 `내 기록 수정` 또는 `코치 확인 필요`를 구분한다. 무엇을 고쳐도 과거 계획이
  조용히 바뀌지 않는다.
- **충돌/공백:** 데이터 상태는 자세하지만 누가 고칠 수 있는지, 수정 후 새 version이
  어떻게 보이는지, 사용자가 고칠 수 없는 경우 어떤 계획을 따를지가 projection에
  완전히 연결되지 않았다.
- **심각도:** `HIGH`
- **정확한 스펙 변경 제안:** 모든 absence/conflict에
  `correctableBy: ATHLETE | COACH | SOURCE_OWNER | NONE`, `correctionAction`,
  `planEffect: NONE_UNTIL_NEW_VERSION_ACCEPTED`, `fallbackPlanRef`를 추가한다.
- **필수 테스트:** athlete fact 수정은 source revision만 만들고 shadow/default/accepted
  plan을 직접 mutate하지 않는다. stale/conflicting source 상태에서 fallbackPlanRef가
  없으면 명시적 `훈련 계획 없음-코치 확인`이 보이며 favorable fallback은 없다.

## 사용자 흐름별 권고안

### 선수

첫 화면은 `다음 9.5일 기본 계획`, `오늘 할 일`, `대회`, `확인이 필요한 것`만
보여 준다. 복합 구성요소, 데이터 출처, 비교안은 펼쳐 본다. 자동 계획이 멈추면
현재 코치 계획 유지 여부와 다음 행동을 즉시 보여 준다. 개인 메모는 분석에서 완전
무신호지만, 전체 백업/직접 공유는 본인이 명시적으로 선택할 수 있다.

### 코치

자동으로 선택된 기본안 1개를 우선 보고, 변경된 세션과 이유, 대회 앵커, 놓친 MAIN,
복합 구성요소, 누락/충돌을 한 화면에서 검토한다. 코치 확인은 안전/청소년 첫 범위의
실행 게이트이지, 제품이 계획 하나도 고르지 못하게 만드는 선택 마법사가 아니다.
수정은 새 plan version이며 과거 계획을 덮어쓰지 않는다.

### 보호자 허용 범위

보호자 권한은 `보호자`라는 역할 하나로 열리지 않는다. 선수에게 누가 어떤 항목을
언제까지 보는지 보이고, optional share/shadow는 선수 거절을 존중한다. 개인 메모의
존재는 보호자에게도 나타나지 않는다. 법적 동의, 제품 기능 선택, 응급/안전 지원을
한 toggle로 합치지 않는다.

## 권장 적용 순서

1. `A1` 자동 처방 권한 모델과 `A2` 오래된 문서 상태를 먼저 정렬한다.
2. `A7` 메모 export 충돌을 닫고 `A8/A9` 공유·보호자 계약의 owner target을 정한다.
3. `A3/A4/A5/A6` 기본 계획 하나, 설명 단계, 9.5일 모바일, 복합 세션 projection을
   하나의 제품 계약 패치로 묶는다.
4. `A10-A13/A15` shadow 진행, 중단/이관, 대회/누락 복구, 동의, 데이터 수정 흐름을
   scenario fixture로 고정한다.
5. `A14` named athlete/coach/accessibility/privacy 검토가 통과하기 전 product UI를
   accepted로 올리지 않는다.

## 최종 판정

```yaml
fixed_9_5_identity_alignment: PARTIAL_MAJOR_CONFLICT
automated_prescription_alignment: FAIL_UNTIL_A1_A2_PATCHED
composite_session_alignment: PASS_DATA_MODEL_PATCH_PROJECTION
private_note_zero_signal_alignment: PASS_ANALYSIS_BOUNDARY
owner_export_choice_alignment: FAIL_UNTIL_A7_PATCHED
recipient_share_alignment: OWNER_CHOICE_PRESERVED_PRODUCT_CONTRACT_MISSING
shadow_awareness_alignment: PASS_WITH_NEXT_ACTION_GAP
race_and_no_catchup_alignment: PASS_ENGINE_RULES_PRODUCT_COPY_MISSING
guardian_permitted_flow_alignment: PARTIAL
accessibility_alignment: SPEC_READY_HUMAN_ACCEPTANCE_BLOCKED
runtime_implementation_recommendation: DO_NOT_START_BEFORE_BLOCKERS
```

[READ_ONLY_AUDIT_COMPLETE]
