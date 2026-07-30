# WORK_ORDER_P1 Implementation Report

```yaml
work_order: WORK_ORDER_P1
implementation_model: gpt-5.6-sol
reasoning_effort: ultra
base_main_sha: f9d012e8d2a45f5305a74fc3d1b23ff61f10fd73
head_sha: RECORDED_IN_GITHUB_PR_METADATA
pull_request: PENDING_PUBLICATION
runtime_authority_added: false
pace_anchor_selected: false
freshness_state_created: false
legacy_journal_migrated: false
```

`head_sha`는 이 보고서 자신을 포함하는 커밋을 문서 안에서 재귀적으로 고정할 수
없으므로 PR 본문과 현재-head 독립 검수 댓글을 정본 영수증으로 사용한다.

## 1. 구현 결과

- 별도 저장소 `trainoracle.athlete-records.v1`을 추가했다.
- PB, SB, 최근 경기, 경기 목표를 서로 다른 구조로 저장한다.
- 셀프서비스 입력은 `ATHLETE + SELF_REPORTED`로만 생성한다.
- 모든 저장값은 `sourceRef: athlete-record:<id>`를 보존한다.
- 실제 기록은 달성일을 요구하고, 경기 목표는 `achievedOn: null`만 허용한다.
- 오래된 기록은 숨기거나 지우지 않고 경과와 SB 18개월 표시 분류만 제공한다.
- 계획 첫 화면에서 기록 관리 화면을 열 수 있지만 기록 저장만 수행한다.
- 기준 기록 선택, 숫자 페이스, CURRENT 판정, 처방 연결은 만들지 않았다.
- 기기 내 전체 데이터 삭제에 새 기록 저장소를 포함했다.

## 2. 변경 파일

### 저장 계약과 테스트

- `app/src/domain/athlete-records.ts`
- `app/src/domain/athlete-record-display.ts`
- `app/src/domain/athlete-records.contract.test.ts`
- `app/src/domain/erase-local-data.ts`
- `app/src/domain/erase-local-data.contract.test.ts`

### 화면과 통합

- `app/src/screens/AthleteRecords.tsx`
- `app/src/screens/AthleteRecords.contract.test.tsx`
- `app/src/screens/athlete-records/AthleteRecordRow.tsx`
- `app/src/screens/PlanBeta.tsx`
- `app/src/screens/PlanBeta.p1-boundary.contract.test.tsx`
- `app/src/screens/plan-beta/PlanIntake.tsx`
- `app/src/screens/plan-beta/PlanChoice.tsx`
- `app/src/AppShell.tsx`
- `app/src/main.tsx`
- `app/src/styles/athlete-records.css`
- `app/e2e/athlete-records.spec.ts`

### 보고

- `reports/review/WORK_ORDER_P1_REPORT.md`

## 3. PIN, RED, GREEN, SURFACE

| 단계 | 실제 결과 |
|---|---|
| PIN | 기존 계획 화면 경계 테스트 `1/1` 통과 |
| RED 1 | 초기 저장 계약 `30`개 중 `27`개 실패 |
| RED 2 | 초기 화면 계약 `4/4` 실패 |
| RED 3 | 새 기록 저장소가 전체 삭제에 빠진 상태 `1`개 실패 |
| RED 4 | 위조 provenance 변조 `2`개가 통과하는 결함 재현 |
| GREEN 저장 | 저장·날짜·provenance 계약 `34/34` 통과 |
| GREEN 화면 | 화면 계약 `4/4` 통과 |
| GREEN 삭제 | 전체 삭제 계약 `12/12` 통과 |
| GREEN 경계 | 계획 화면 경계 `1/1` 통과 |
| SURFACE | P1 Playwright `8/8` 통과 |

## 4. 전체 회귀

| 검증 | 변경 전 | 변경 후 |
|---|---:|---:|
| 앱 단위 테스트 | 358/358 | 398/398 |
| 처방 구현 테스트 | 99/99 | 99/99 |
| D9 평가기 | 11/11 | 11/11 |
| P1 브라우저 | 해당 없음 | 8/8 |

앱 전체 테스트를 다른 검증과 동시에 처음 실행했을 때 4개 테스트가 5초 제한에
걸렸다. 같은 세 파일을 단일 worker로 재실행해 `20/20`을 확인한 뒤, 다른
검증을 멈추고 전체 앱 테스트만 다시 실행하여 `398/398` 통과를 확인했다.
따라서 초기 4건은 assertion 실패가 아니라 로컬 자원 경합으로 판정했다.

추가 통과:

- 앱 TypeScript 검사
- Playwright TypeScript 검사
- production build
- `impl` TypeScript 검사
- 저장소 contract validator 전체
- 상세 처방 catalog 적대 테스트 `30/30`
- advisory recommender 적대 테스트 `42/42`
- dependency audit validator `7/7`
- `git diff --check`

전체 Playwright 묶음은 로컬 도구의 5분 제한을 넘겨 결과가 잘렸으므로 성공
증거로 사용하지 않았다. P1 전용 네 환경 검증과 GitHub `app-browser`의 완전한
종료 결과를 최종 브라우저 증거로 사용한다.

## 5. provenance 변조 검증

다음 값은 저장 단계에서 거부된다.

- `enteredBy`, `verificationState`, `sourceRef` 누락
- 빈 값, 자유 문장, 선수 이름 또는 증상 문장 형태의 `sourceRef`
- `sourceRef`와 기록 `id` 불일치
- 선수가 직접 입력하면서 `VERIFIED`를 주장하는 값
- `VERIFIED_IMPORT`가 `VERIFIED`가 아닌 값
- 중복 ID, 배열이 아닌 저장값, 일부만 손상된 배열
- localStorage 읽기·쓰기 예외

셀프서비스 생성 함수와 화면은 provenance 선택 UI를 노출하지 않으며 항상
`ATHLETE + SELF_REPORTED`만 저장한다.

## 6. 날짜 손계산과 코드 출력

기준일은 `2026-07-27`이다.

| 달성일 | 손계산 | 코드 출력 |
|---|---:|---|
| 2026-07-03 | 0개월 | 이번 달 |
| 2026-03-27 | 4개월 | 4개월 전 |
| 2025-01-27 SB | 18개월 | 시즌 범위 안 (1년 6개월 전) |
| 2024-12-27 SB | 19개월 | 시즌 범위 밖 (1년 7개월 전) |
| 2023-05-10 PB | 38개월 | 3년 2개월 전 |
| RACE_GOAL | 해당 없음 | 경과 라벨 없음 |

18개월은 화면 분류만 바꾸며 저장, 삭제, 선택, 안전성, 현재성에는 영향을 주지
않는다.

## 7. 화면 증거

- `.omo/evidence/task-5-p1-records-393x852.png`
  - `5000m · 18분 30초 · 개인 최고`
  - `2024-03-10 · 2년 4개월 전 · 직접 입력한 기록`
  - `5000m · 17분 30초 · 경기 목표`
  - `직접 입력한 목표 · 현재 경기력 기록이 아님`
- `.omo/evidence/task-5-p1-records-error.png`
  - 60m 미만 거리와 미래 달성일의 명시 오류
  - 입력값 보존

동일 시나리오는 desktop, mobile `393x852`, touch-narrow `320x568`,
reduced-motion에서 각각 통과했다. 저장 후 계획 화면으로 돌아갔다가 기록
화면을 다시 열어 두 기록이 유지되는 것도 확인했다.

## 8. 변경하지 않은 경계

다음 경로의 diff는 0건이다.

- `impl/`
- `specs/`
- `app/src/domain/journal-schema.ts`
- `app/src/domain/journal-store.ts`

또한 다음 기능은 추가하지 않았다.

- 기존 `RaceEntry.record`, `goalPace`, 메모의 자동 이관
- 기록 날짜 기반 `freshnessState`
- 자동 CURRENT 또는 기준 기록 선택
- 종목 간 환산 또는 숫자 페이스
- D9, Safety Gate, Plan Generator 변경
- COACH/검증 가져오기 화면

## 9. 판단하지 않고 남긴 사항

- 어떤 기록을 CURRENT로 자기확인하거나 코치 확인할지
- 같은 종목 기록을 어떤 우선순위로 선택할지
- 선택한 CURRENT 기록을 반복 거리 페이스로 환산할지
- 코치 입력과 검증된 가져오기 경로를 언제 열지

앞의 세 항목은 `WORK_ORDER_P3`에서 별도 동의·검증·안전 경계를 거친다. P1
저장만으로는 어느 기록도 훈련 계획이나 처방을 바꾸지 않는다.
