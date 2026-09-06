# PLAN_SELECTION_REPLAY_REVIEW_2026-09-06.md

```yaml
doc_id: trainoracle-plan-selection-replay-review-2026-09-06
status: IMPLEMENTATION_SELF_REVIEW_NOT_INDEPENDENT_SIGNOFF
base_head: 21b95d23d596cf755cd7101be8f27ba7145b518f
scope: INITIAL_PLAN_SAVE_EXACT_RETRY
new_storage_schema: false
new_template_activation: false
whole_workflow_complete: false
```

## 1. 고친 문제

`saveSelectedPlanCandidate`는 저장된 계획이 있다는 이유만으로 동일한 재시도도
`STALE_BASE`로 거부했다. 저장은 성공했지만 화면 응답을 놓친 사용자에게
저장 실패처럼 보일 수 있었다. 같은 계획의 중복 쓰기를 막는 목적은 유지하면서,
아직 진행하지 않은 정확한 원본의 재시도는 읽기 결과로 반환하도록 고쳤다.

## 2. 공격 관점과 방어

| 반례 | 판정과 보존 대상 |
|---|---|
| 800/1500/3000/5000m 동일 선택을 1분 뒤 재시도 | 원래 snapshot 반환. 저장 시각, 주기 계보, 페이스, 설명 receipt 불변 |
| 마라톤 RPE-only 재시도 | 원래 snapshot 반환. 없는 adaptation context를 만들지 않음 |
| 날짜/후보/사용한 근거가 변경됨 | `STALE_BASE`; 저장된 원본 불변 |
| 이미 완료 등 진행을 기록함 | 재시도로 초기화하지 않고 `STALE_BASE` |
| 원본 계획은 있지만 context가 누락/손상/다른 후보임 | `PLAN_STORAGE_STATE_UNCERTAIN`; 성공·자동 복구 금지 |
| 기준 경기 기록이 사라짐 | 현재 anchor 재확인 실패. 과거 저장 성공으로 우회하지 못함 |
| 초안 취소 또는 lock 대기 중 계정 전환 | 기존 초안/계정 guard가 재시도도 차단 |
| 템플릿 권한 만료 | 현재 시점의 권한 검사를 먼저 수행하여 거부 |
| 미래 시각으로 자기일관되게 재작성한 snapshot | 미래의 선택을 이전 성공으로 인정하지 않음 |
| 동일한 두 저장 요청이 lock에서 차례로 실행됨 | 두 번째는 원래 결과 반환. 원본을 다시 쓰지 않음 |

현재 스키마로 읽은 전체 상태를 비교한다. ID나 처방 숫자 일부만 비교하지 않는다.
기존 journal storage의 임시 `__to_probe__` 점검을 제외하고 재시도에는 저장 쓰기가
없음을 시험했다. 이는 모든 브라우저 저장 API 호출이 0이라는 주장이 아니다.

## 3. 실행 증거

- 신규 `plan-selection-replay.contract.test.ts`: 18 PASS.
- 성공 반환을 의도적으로 `STALE_BASE`로 바꾼 결함 주입: 양성 5 FAIL,
  나머지 13건은 필터 제외. 변조를 원복한 뒤 최종 검증을 수행한다.
- 기존 동시 저장 반례 1건은 옛 거부 기대값을 같은 결과 반환으로 갱신했다.
  storage 원본 불변 단언은 유지했다.
- 타입 검사 및 production build PASS. 기존 font 경로/chunk 경고는 남아 있다.
- 실제 브라우저: desktop-chromium/320px touch-narrow, 공통/A/B 독립 위치
  선택 세 경로, 합계 6 PASS. 숫자 222.2초·선택 슬롯·저장·재조회 보존,
  가로 넘침 없음, pageerror 없음.
- 전체 앱 첫 실행: 2453 PASS / 1 FAIL. 실패는 위 옛 동시 저장 기대값이었다.
  수정 후 전체 앱 282파일 / 2454 PASS, exit 0. e2e 타입 검사도 PASS.
- 별도 두 탭 브라우저 4 PASS: desktop/320px의 동일 선택 및 다른 날짜 선택.
  실제 Web Locks와 공유 localStorage에서 원본 계획/context 불변을 확인했다.
  첫 시험은 새로고침 후 홈이 열린 상태에서 계획 heading을 찾는 잘못된 단언으로
  1 FAIL/1 PASS였다. 실제 탭 이동을 포함하도록 시험을 수정하고 4건 통과했다.

## 4. 남은 경계

이 검수에서 새 출시 차단 결함을 확인하지 않았으나, 독립 리뷰나 전체 계획의
완료 판정은 아니다. 실제 두 탭의 저장 순서는 검증했지만 저장 중 강제 종료나
응답 유실 자체는 재현하지 않았다. 조정 workspace의 public 연결, 새로운 finite 구성 채택과 전환,
다중 MAIN 상세 배치, 전체 이력 보존 및 최종 배포는 별도 미완이다.

또한 원본 계획과 adaptation context의 두 키 저장은 물리적으로 원자적이지 않다.
이번 변경은 정확한 재시도와 불확실한 저장의 구분만 보완하며, 저장 도중 종료를
완전 복구하거나 잠금을 쓰지 않는 다른 탭의 쓰기를 통제한다고 주장하지 않는다.

[DRAFT_COMPLETE]
