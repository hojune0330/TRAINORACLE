# QUICK_JOURNAL_CI_FOLLOWUP_2026-09-02.md

## 상태

- status: TEST_FIX_VERIFIED_LOCALLY_CI_PENDING
- predecessor_pr: https://github.com/hojune0330/TRAINORACLE/pull/314
- dependent_pr: https://github.com/hojune0330/TRAINORACLE/pull/315
- failed_head: b3620c3ba14713882e9126eb6212a9bb69369461
- runtime_change: false

## 실제 관측

[CI 실행 33614320377](https://github.com/hojune0330/TRAINORACLE/actions/runs/33614320377)의
contract-tests와 app-quality는 통과했지만 app-browser는 실패했다.
데스크톱에서 111개 통과, 28개 건너뜀, 1개 실패 후 나머지 프로젝트를 실행하지 않았다.
로컬에서도 같은 테스트의 같은 단언이 실패했다. 환경 차이로 치부하지 않았다.

`beta-diary-experience.spec.ts`는 과거 일지 8건만 주입한 뒤 32P를 기대했다.
하지만 `DAILY_LOG_AND_CHECKIN_SPEC.md`의
`historical_backfill_may_create_spendable_daily_reward: false`와 현재 보상 코드는
과거 기록만 불러와 새로 쓸 수 있는 포인트를 지급하지 않는다.
이미 저장된 적립 이력은 보존한다. 화면의 0P가 이 조건에서는 맞았다.

## 수정과 재검증

동일한 일지·꾸미기·보관함·도움말 흐름을 두 조건으로 분리했다.

1. 과거 일지만 있는 경우: 0P. 꾸미기를 열고 돌아와도 소급 적립하지 않는다.
2. 과거 적립 이력도 저장된 경우: 32P. 화면 전환 후에도 기존 포인트를 보존한다.

과거 일지 열람·꾸미기 자체는 두 조건 모두 가능하다.
앱의 지급 규칙을 바꾸거나 기존 단언을 느슨한 정규식으로 교체하지 않았다.

- 선행 PR 실제 코드의 프로덕션 빌드: PASS.
- 브라우저 테스트 타입 검사: PASS.
- 해당 2조건 x 4프로젝트: 8/8 PASS.
- 포인트 도메인 단위 테스트: 12/12 PASS.
- 공개 배포·전체 CI 통과는 별도 확인 대상이다.

이 수정은 #314에 먼저 반영하고 #315에서 선행 브랜치를 병합해 받는다.
강제 푸시나 PR 순서 생략은 하지 않는다.

[DRAFT_COMPLETE]
