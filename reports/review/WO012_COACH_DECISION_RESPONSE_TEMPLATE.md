# WO012 코치 책임자 응답 기록

```yaml
order_id: CODEX_WORK_ORDER_012
decision_record_id: TO-WO012-OWNER-RESPONSES-2026-07-20
status: OWNER_RESPONSES_RECORDED_PENDING_INDEPENDENT_REVIEW
decision_record_scope: OWNER_DIRECTION_RECORD_ONLY
competition_direction_ref: reports/review/FORMATION_COMPETITION_RECORD_IDENTITY_OWNER_DECISION.md
ca_02_formal_decision: NOT_REVIEWED
ca_03_formal_decision: NOT_REVIEWED
owner_answers_recorded: true
owner_source_transcribed: true
independent_review_status: PENDING
ruleset_accepted: false
runtime_authority: false
canonical_spec_patch_authorized: false
marker_text_or_visual_semantics: PENDING_OWNER_RECONCILIATION
```

## 권한 경계

아래는 책임자 답변을 독립 검수용으로 기록한 것입니다. 이 기록만으로는 규칙을
채택하거나 정본 스펙을 고치거나, 런타임 동작·자동 실행·전문가 검수 결과를 만들지
않습니다. 별도의 독립 검수가 이 기록을 확인한 뒤에만 다음 채택 결정을 논의할 수
있습니다.

9.5일 프레임과 약 72시간 간격은 파일럿 관례입니다. 안전·의학·생리학 보장이
아니며, MAIN 2회 또는 3회여도 배치와 회복 검토가 필요합니다.

CR-07은 최종 승인 행이 아닙니다. 병합된 대회 방향은 완료 경기 기록을 분리하고,
달력 앵커 기여를 0으로 두며, 같은 현지 대회 날짜의 계획 MAIN을 0 또는 1회로
제한합니다. 책임자의 "메인 1회" 수정 요청이 이 0 또는 1회 기준을 정확히 1회로
좁히는지, 별표 같은 표식의 시각·텍스트 의미를 어떻게 정할지는 별도 확인 전까지
정본·런타임에 반영하지 않습니다.

## 후속 확인으로 확정한 세부 경계

```yaml
exception_window: CURRENT_PLUS_IMMEDIATE_PRIOR_AND_NEXT_MAX_THREE
exception_default: TWO_OR_THREE_MAIN_PER_NAMED_FRAME
exception_output: NEEDS_REVIEW_WITH_REASON
exception_automatic_execution: false
strong_plyometric_trigger: EXPLICIT_CLASSIFICATION_STRONG_OR_HIGH_ONLY
strong_plyometric_prompt: MANDATORY_ADDED_CHECK_PROMPT
strong_plyometric_inference: NO_RPE_OR_FREE_TEXT_INFERENCE
confirmation_step_one: SHOW_RATIONALE_AND_CONSERVATIVE_ALTERNATIVE
confirmation_step_two: SEPARATE_SURFACE_CREATES_REVIEW_REQUEST_OR_ADJUSTMENT_DRAFT_ONLY
confirmation_automatic_execution: false
```

MAIN이 1회 또는 4회인 예외 프레임은 현재 프레임과 바로 앞·뒤 프레임을 보되, 최대
3개 프레임만 봅니다. 그 창을 만들 수 없으면 기존의 "이름 붙은 프레임당 MAIN 2-3회"
기본값을 유지하고 `NEEDS_REVIEW_WITH_REASON`을 남깁니다. 예외만으로 자동 실행할 수
없습니다.

플라이오는 명시적으로 `strong` 또는 `high`로 분류된 구성요소만 추가 확인을
강제합니다. RPE나 자유 서술에서 강도를 추정해 임계값을 만들면 안 됩니다.

첫 확인 화면은 이유와 보수적 대안을 보여줍니다. 둘째, 별도의 화면에서만 검토 요청
또는 사용자가 고른 자기확인 조정 초안을 만들 수 있습니다. 안전을 우회하거나 실제
계획을 자동 실행·변경할 수 없습니다.

## 수취 원문

아래는 대화에서 받은 답을 의미를 다듬지 않고 옮긴 것입니다. `ㅇㅋ`와 `승인`도
그대로 기록했으며, 다음 표의 해석은 이 원문을 넘어서지 않아야 합니다.

| 사례 | 수취 원문 |
|---|---|
| 01 | 승인 |
| 02 | 승인 |
| 03 | 승인 |
| 04 | 승인. 다만 그럴 때가 있다면 그건 전 후로 이유가 있는지 확인. 예를 들어 전에 1회 했고, 다음에 4회를 배치하는 일이 벌어지는 일이 있을 수 있음. |
| 05 | 승인 |
| 06 | 승인. 5와 비슷해. |
| 07 | 승인은 아니고, 메인 1회로 놓되, 별표 같은 걸로 표시하자. 나중에 표식이 남게. |
| 08 | 승인 |
| 09 | 승인 다만 확인을 권장하도록 |
| 10 | 승인. 확인 권장 |
| 11 | 승인 |
| 12 | ㅇㅋ |
| 13 | ㅇㅋ |
| 14 | ㅇㅋ |
| 15 | ㅇㅋ |
| 16 | 중요하기때문에 플라이오는 절대 추가확인권장지시 |
| 17 | ㅇㅋ |
| 18 | ㅇㅋ 다만 판단할지 ux상 가벼운 원 터치나 원클릭으로 확인을 권고함. |
| 19 | ㅇㅋ 다만 강력하게 사용자가 승인할 수도 있다면 두번 물어보도록 함. 원클릭 금지 |
| 20 | 두번 물어보도록 함 권고사항을 남겨둠. 단 보수적으로 휴식을 권장 |
| 21 | 자동으로 맞출지 코치 승인할지 2회이상 클릭 유도 검토. 왜냐면 코치 없는 사람 또는 코치 승인 안 받을 사람이 매우매우 대다수. |
| 22 | 이것도 21처럼 자동 검토할지 검토를 권장. 2회 이상 클릭유도 |
| 23 | ㅇㅋ |
| 24 | ㅇㅋ 다만 클릭이나 선택이 쉽도록 원클릭 유도 |
| 25 | ㅇㅋ |
| 26 | ㅇㅋ |
| 27 | ㅇㅋ |
| 28 | ㅇㅋ |
| 29 | 승인 좋다. |
| 30 | 승인! |

세부 경계(최대 3개 프레임, 명시 분류만 플라이오 추가 확인, 두 단계 확인)의 제안에
대해서도 각각 `승인`을 받았습니다.

## 제안과 답변의 연결

CR-29의 책임자 원문은 "승인 좋다."입니다. 이 답변이 가리킨 제안은 아래의 충돌
우선순위입니다. 책임자 발화와 제안 문구를 구분해 남기며, 새로운 정책 문구로
만들지 않습니다.

```text
safety > fixed competition > recovery/high-plyo > coach > macro 2-3-frame > user convenience
```

## 원문에 대한 해석 기록

| ID | Owner decision | Rule sentence |
|---|---|---|
| CR-01 | APPROVE_RECORDED_PENDING_INDEPENDENT_REVIEW | Approve the version, owner, and frame gate; a missing gate field is not eligible. |
| CR-02 | APPROVE_RECORDED_PENDING_INDEPENDENT_REVIEW | Approve the 9.5-day frame as a pilot heuristic only, never as a proven optimum. |
| CR-03 | APPROVE_RECORDED_PENDING_INDEPENDENT_REVIEW | Approve roughly 72 hours as a placement heuristic, never as recovery clearance. |
| CR-04 | APPROVE_WITH_EXCEPTION_REVIEW_RECORDED_PENDING_INDEPENDENT_REVIEW | Default to 2-3 MAIN per frame; a one- or four-MAIN frame requires adjacent-frame review and `NEEDS_REVIEW_WITH_REASON`. |
| CR-05 | APPROVE_RECORDED_PENDING_INDEPENDENT_REVIEW | Approve a count of two MAIN only with placement and recovery review. |
| CR-06 | APPROVE_RECORDED_PENDING_INDEPENDENT_REVIEW | Approve a count of three MAIN only with placement and recovery review. |
| CR-07 | REVISE_RECORDED_PENDING_INDEPENDENT_REVIEW | Record the requested one-MAIN and star-like marker change, while keeping the merged local-date 0-or-1 direction until the owner reconciles the difference. |
| CR-08 | APPROVE_RECORDED_PENDING_INDEPENDENT_REVIEW | Count a competition parent and its components once only; never double count. |
| CR-09 | APPROVE_WITH_CLASSIFICATION_CHECK_RECORDED_PENDING_INDEPENDENT_REVIEW | Count auxiliary SUB, LD, and TEST sessions as zero and keep a classification check recommended. |
| CR-10 | APPROVE_WITH_DEDUPLICATION_REVIEW_RECORDED_PENDING_INDEPENDENT_REVIEW | De-dupe repeated records with distinct same-day sessions protected; review is recommended. |
| CR-11 | APPROVE_RECORDED_PENDING_INDEPENDENT_REVIEW | Keep planned and completed records separate and do not sum them. |
| CR-12 | APPROVE_RECORDED_PENDING_INDEPENDENT_REVIEW | Do not automatically catch up a missed MAIN. |
| CR-13 | APPROVE_RECORDED_PENDING_INDEPENDENT_REVIEW | Do not double count or compress MAIN sessions after a miss. |
| CR-14 | APPROVE_RECORDED_PENDING_INDEPENDENT_REVIEW | Preserve composite parent and component identity without double counting. |
| CR-15 | APPROVE_RECORDED_PENDING_INDEPENDENT_REVIEW | Do not split whole-session RPE across components. |
| CR-16 | APPROVE_WITH_MANDATORY_ADDED_CHECK_RECORDED_PENDING_INDEPENDENT_REVIEW | An explicitly classified strong or high plyometric component needs a mandatory added-check prompt; no threshold inferred. |
| CR-17 | APPROVE_RECORDED_PENDING_INDEPENDENT_REVIEW | Stale or missing facts require current provenance rather than inference. |
| CR-18 | APPROVE_WITH_EXCLUSION_ACKNOWLEDGEMENT_RECORDED_PENDING_INDEPENDENT_REVIEW | A private memo remains excluded; a one-tap acknowledgement creates no signal and cannot change exclusion. |
| CR-19 | APPROVE_WITH_TWO_STEP_REVIEW_REQUEST_RECORDED_PENDING_INDEPENDENT_REVIEW | A two-step safety interaction may create a review request only and cannot bypass safety. |
| CR-20 | APPROVE_WITH_CONSERVATIVE_REST_RECORDED_PENDING_INDEPENDENT_REVIEW | Show conservative rest for taper and allow a two-step taper request only. |
| CR-21 | APPROVE_WITH_TWO_STEP_USER_CHOICE_RECORDED_PENDING_INDEPENDENT_REVIEW | After two steps, the user may choose coach review or a self-confirmed adjustment draft; neither may automatically execute or change the actual plan. |
| CR-22 | APPROVE_WITH_TWO_STEP_USER_CHOICE_RECORDED_PENDING_INDEPENDENT_REVIEW | After two steps, the user may choose coach review or a self-confirmed adjustment draft for an increase; neither may automatically execute or change the actual plan. |
| CR-23 | APPROVE_RECORDED_PENDING_INDEPENDENT_REVIEW | Preserve a fixed competition when it conflicts with a flexible MAIN. |
| CR-24 | APPROVE_WITH_GUIDED_REANCHOR_RECORDED_PENDING_INDEPENDENT_REVIEW | Offer an easy guided re-anchor selector, but never an accidental one-click schedule mutation. |
| CR-25 | APPROVE_RECORDED_PENDING_INDEPENDENT_REVIEW | Do not carry a missed predecessor MAIN into a successor frame. |
| CR-26 | APPROVE_RECORDED_PENDING_INDEPENDENT_REVIEW | Treat an exposure at frame start as start-inclusive in the current frame. |
| CR-27 | APPROVE_RECORDED_PENDING_INDEPENDENT_REVIEW | Treat an exposure at frame end as end-exclusive in the contiguous successor frame. |
| CR-28 | APPROVE_RECORDED_PENDING_INDEPENDENT_REVIEW | Do not guess a DST fold or gap instant without explicit resolution. |
| CR-29 | APPROVE_RECORDED_PENDING_INDEPENDENT_REVIEW | Apply priority safety > fixed competition > recovery/high-plyo > coach > macro 2-3-frame > user convenience. |
| CR-30 | APPROVE_RECORDED_PENDING_INDEPENDENT_REVIEW | Deny unauthorized view or edit; allow explicit sharing and auditable correction only. |

## 독립 검수 인계

독립 검수자는 30개 행, 예외 창, 명시 `strong/high` 플라이오 경계, 두 단계 비실행
경계를 모두 확인해야 합니다. 특히 CR-07의 0-or-1/1회 정렬과 표식 표현은 책임자의
추가 확인 전까지 정본으로 정의하지 않습니다. 그때까지 `ruleset_accepted`와
`runtime_authority`는 false입니다.

[OWNER_RESPONSES_RECORDED_PENDING_INDEPENDENT_REVIEW]
