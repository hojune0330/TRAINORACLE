# 담당 F 독립 적대 검수 결과

검수 대상은 `TRAINORACLE-oracle-exploration-20260921`의 현재 dirty 작업이며, 담당 페르소나는 P26–P30이다. 제품 코드·테스트·스펙은 수정하지 않았고, 커밋·푸시·배포 및 실제 사용자 브라우저 조작도 하지 않았다. 다른 검수자 보고서는 열지 않았다.

## 판정 경계

- `PLAN_EXECUTION_DEVIATION_AND_REPLAN_CONTRACT.md`는 `DRAFT_FOR_REVIEW`, `runtime_authority: false`다. 재설계 엔진 부재는 이번 현 구현 결함으로 세지 않았다.
- 좁은 실행: `cd app; .\node_modules\.bin\vitest run src/domain/plan-execution-review.test.ts src/screens/home/HomeCoachingSummary.test.tsx src/screens/journal/JournalOriginalPlan.contract.test.tsx` 결과 3개 파일, 35개 테스트 통과. 이는 현재 소스의 함수/React 테스트 실행이며 전체 수용·브라우저 검증은 아니다.
- `http://127.0.0.1:4194/?app=1`은 HTTP GET 200만 확인했다. 실제 UI 브라우저 실행은 하지 않았으므로 해당 UI 시나리오 증거로 보지 않는다.
- `CONFIRMED_RUNTIME`은 이 보고서에서 명시한 Vitest 함수 실행에만 해당한다. 실행하지 않은 행동열은 통과로 부르지 않는다.

## P26 과거 보관 계획과 현재 계획이 다른 사용자

- 전제: 합성 일지가 과거 계획 revision의 정확한 링크를 갖고 있고, 같은 날짜·일차·슬롯에 현재 계획은 다른 revision으로 존재한다.
- 정상 경로: 현재/활성 계획에서 ID가 일치하지 않으면 과거 보관본을 찾아 정확한 링크로 원래 세션을 읽는다.
- 공격 경로: 현재 계획의 비슷한 날짜·AM/PM 세션을 과거 원본으로 대체하거나, 과거 링크에 현재 처방을 투영한다.
- 결과: `CONFIRMED_CODE`. 활성 계획은 먼저 정확히 해석하고, 불일치하면 보관본을 순회한다. ID가 계획 revision·후보·세션 내용·날짜·일차·슬롯을 묶으므로 날짜 유사성만으로 현재 계획에 매칭되지 않는다. 다만 “옛 보관본 + 다른 현재 계획 동시 존재” 조합은 이번에 직접 실행하지 않았다 (`NOT_TESTED`).
- 근거: `app/src/domain/journal-original-plan.ts:29-54,56-108`; `app/src/domain/planned-session-link.ts:46-65,147-160,162-172`.
- 재현 절차(미실행): 합성 과거 계획을 archive에 보존하고 fingerprint가 다른 새 active plan을 같은 날짜/일차/슬롯으로 넣는다. 과거 planVersionId의 일지를 `readJournalOriginalPlan`에 전달해 `source: ARCHIVED`와 과거 세션 내용이 선택되는지 확인한다. 현재 계획으로 반환되거나 동일 날짜만으로 연결되면 결함이다.

## P27 잘못된 날짜·AM/PM 연결 사용자

- 전제: 합성 링크 또는 일지의 날짜/슬롯 중 하나가 실제 계획 occurrence와 어긋난다.
- 정상 경로: 날짜와 슬롯이 원본 링크와 일치할 때만 비교한다. 누락 시간대는 시간대 미기록으로 표시한다.
- 공격 경로: 일지 날짜를 하루 바꾸거나 AM을 PM으로 바꾸고, 링크의 일차만 바꾸되 ID는 그대로 둔다.
- 결과: `CONFIRMED_RUNTIME` (Vitest 함수 실행). 세 공격 입력 모두 `SOURCE_UNAVAILABLE`을 반환하도록 현재 좁은 검수에서 실행됐다. 일지 값을 추정해 다른 세션에 연결하지 않는다. 잘못된 달력 날짜 자체의 개별 fixture 및 브라우저 조작은 `NOT_TESTED`다.
- 근거: `app/src/domain/plan-execution-review.ts:44-51`; 링크 schema와 occurrence 검증 `app/src/domain/planned-session-link.ts:23-65,147-160`; 실행 테스트 `app/src/domain/plan-execution-review.test.ts:62-66`.
- 재현 절차(실행됨): 해당 테스트 케이스의 합성 entry에서 `date`, `activitySlot`, `plannedSessionLink.sessionDay`를 각각 바꾸어 호출하고 결과가 `SOURCE_UNAVAILABLE`인지 확인했다. 전체 실행 명령/범위는 위 판정 경계와 같다.

## P28 일부만 불러온 계정 사용자

- 전제: 원본 계획 조회는 성공했지만 계정 일지 projection은 아직 `uncertain`이거나 일부만 읽혔다.
- 정상 경로: 홈 코칭은 불완전 읽기를 빈 목록으로 표현하지 않고 비교를 보류한다고 알린다.
- 공격 경로: 같은 불완전 읽기 상태에서 일지의 `계획한 훈련과 비교하기`를 펼친다.
- 결과: `SUSPICION` · P3. 코드상 `collectExecutionReviews`는 `status !== complete`이면 빈 배열을 반환한다. `JournalOriginalPlan`은 review가 있을 때만 비교 내용을 렌더하지만, lookup에서 원본 세션을 찾은 경우 불완전 일지 읽기 상태를 알리는 별도 문구가 없다. 부분 수치를 완전 자료처럼 계산하는 증거는 없으나, 그 화면에서 비교가 보류된 이유가 숨겨질 가능성이 있다. 사용자 혼동 여부는 `NOT_TESTED`다.
- 근거: `app/src/domain/plan-execution-review.ts:127-130`; `app/src/screens/journal/JournalOriginalPlan.tsx:40-42,63-86`; 대조적으로 홈의 읽기 실패 안내는 `app/src/screens/home/HomeCoachingSummary.tsx:18-24,35-38`. 기존 홈 테스트도 홈 실패 안내만 확인한다: `app/src/screens/home/HomeCoachingSummary.test.tsx:24-29`.
- 재현 절차(미실행): 합성 링크 일지와 유효 원본 계획을 준비하고 `loadEntriesForPlanSafety()`를 `{ status: "uncertain" }`로 응답시킨 뒤 일지의 비교 disclosure를 연다. 현재 코드 경로상 review는 만들어지지 않지만 lookup이 matched면 계획 방법은 렌더된다. 확인할 기대 동작은 “자료를 모두 읽지 못해 실제 비교를 보류했다”는 가시적 상태이며, 누락 값을 0/없음으로 표현하지 않아야 한다.
- 수정 방향(수정하지 않음): `complete`/`uncertain` 읽기 상태를 UI까지 보존하고, 원본 계획 표시와 실제 비교 보류를 분리해 짧은 비접힘 상태로 알린다.

## P29 계획 종료 후 코칭에서 현재 일정 여는 사용자

- 전제: 오래된 일지의 당시 계획은 archive에 있고 별도의 current schedule이 있다.
- 정상 경로: 당시 원본은 기록 비교의 증거 화면에서 읽고, `현재 일정` 행동은 current schedule로 이동한다.
- 공격 경로: 날짜가 같은 current schedule을 오래된 일지의 원본처럼 섞거나, 버튼을 교정안 적용/원본 복원처럼 표시한다.
- 결과: `NO_FINDING` (정적 확인), 실제 클릭 경로는 `NOT_TESTED`. 요약과 reader 행동은 명시적으로 `현재 일정`이라고 부르며, 원본 계획 표시는 비교 근거 쪽에 분리돼 있다. 버튼 자체는 계획 쓰기나 적용을 호출하지 않는다.
- 근거: `app/src/screens/home/HomeCoachingSummary.tsx:39-45`; `app/src/screens/plan-review/ExecutionReview.tsx:123-134`; 당시 방법 분리 `app/src/screens/journal/JournalOriginalPlan.tsx:67-82`.
- 재현 절차(미실행): 합성 과거 일지를 홈 코칭에서 열고 `현재 일정`을 선택한다. 도착 화면이 활성 일정을 보여주고, 과거 비교의 당시 계획은 일지 evidence에서만 유지되는지 확인한다. 이 행동은 실제 실행하지 않았으므로 PASS가 아니다.

## P30 나중에 구조화 값을 수정한 사용자

- 전제: 같은 합성 일지 ID의 구조화 거리/RPE를 나중에 수정한다. 링크된 계획 원본은 변하지 않는다.
- 정상 경로: 저장 완료 이벤트 후 홈이 일지를 다시 읽고 동일 ID의 새 사실로 코칭을 다시 투영한다.
- 공격 경로: memo-only 변경 시 사실 순서를 흔들거나, 구조화 값 수정 후 이전 사실/요약을 계속 보여준다.
- 결과: `NO_FINDING` (정적 확인), 실제 저장-복귀 UI 흐름은 `NOT_TESTED`. 로컬 저장은 확인된 write 뒤 변경 이벤트를 보내고, 홈은 로컬·계정 변경 이벤트로 revision을 올린 뒤 source와 리뷰를 다시 계산한다. 원본 계획 lookup은 읽기 전용이다.
- 근거: `app/src/domain/journal-local-storage.ts:22-37`; `app/src/screens/Home.tsx:46-60`; 새 projection 재계산 `app/src/screens/home/HomeCoachingSummary.tsx:18-24`; memo-only 정렬 안정화 테스트 `app/src/domain/plan-execution-review.test.ts:95-102`.
- 재현 절차(미실행): 합성 구조화 일지를 홈에서 열고 거리 또는 명시 RPE를 저장 수정한다. 같은 일지의 코칭 수치가 새 값으로 갱신되는지, planned 값/원본 링크는 그대로인지 확인한다. memo만 바꾸는 케이스는 실행된 좁은 테스트에서 결과 안정성을 확인했지만 구조화 값 수정 흐름은 실행하지 않았다.

## 종합

- P1/P2 확정 결함: 0건. P3 의심: 1건(P28, 불완전 읽기 보류 사유의 일지 화면 누락).
- P26 코드 경로와 P27 실행된 합성 함수 검증은 현재 정확한 링크/출처 경계와 일치한다. P29·P30은 정적 경로에서 결함을 찾지 못했으며 UI 상호작용은 미실행이다.
- 확인 불가로 남긴 항목: archive와 새 active 동시 보존의 직접 실행, 계정 부분 읽기의 실제 화면 상태, 계획 종료 후 이동 클릭, 구조화 사실 수정 후 저장-복귀. 전체 테스트/전역 회귀/실제 사용자 데이터·계정·외부 네트워크는 사용하지 않았다.
