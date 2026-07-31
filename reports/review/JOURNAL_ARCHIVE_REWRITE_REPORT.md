# 일지 아카이브 재작성 보고

## 1. 실행 경계

- 기준 main: `6c054a1b0637aed4777cfe56b9b34c49e41a91c7`
- 작업 head: `RECORDED_IN_GITHUB_RECEIPT`
- 실행 모델: `gpt-5.6-sol`
- 추론 강도: `ultra`
- 오래된 PR #126은 병합, 리베이스, 체리픽하지 않았다.
- 이 작업은 배포된 P5 privacy-safe projection 위에 로컬 일지 탐색 화면만
  추가한다. 훈련 계획, 처방, 준비도, D9, Safety Gate를 변경할 권한은 없다.

## 2. 사용자가 얻는 기능

홈의 최근 일지에서 `전체 보기`를 누르면 다음 순서로 기록을 살펴볼 수 있다.

1. 월별 기록
2. 선택한 달의 주별 기록
3. 선택한 주의 일별 기록
4. 기존 일일 상세

일일 상세를 열었다가 돌아와도 선택했던 달과 주가 유지된다. 기존 일지 작성,
수정, 휴지통, 복원, 계정, 참여 현황 흐름은 그대로 둔다. 새 하단 탭은 추가하지
않았고, 빈 아카이브는 `아직 지난 일지가 없어요.`라고 표시한다.

## 3. 변경 범위

### 투영과 타입

- `app/src/domain/journal-archive-types.ts`
- `app/src/domain/journal-archive.ts`

### 화면과 기존 연결부

- `app/src/screens/JournalArchive.tsx`
- `app/src/screens/JournalArchiveSummary.tsx`
- `app/src/AppShell.tsx`
- `app/src/screens/Home.tsx`
- `app/src/screens/home/DeviceJournal.tsx`

### 계약과 브라우저 검증

- `app/src/domain/journal-archive.contract.test.ts`
- `app/src/screens/JournalArchive.contract.test.tsx`
- `app/src/AppShell.archive.contract.test.tsx`
- `app/e2e/journal-archive.spec.ts`

`App.tsx`, 계정, 백업, 휴지통, engagement, plan, `impl/`, D9, 스펙 파일은
이 작업의 변경 범위가 아니다.

## 4. 집계 계약

아카이브는 전체 `JournalEntry`를 카드에 전달하지 않는다. 기존 P5의
`selectStructuredJournalInput`, `projectStructuredJournalObservation`,
`eligibleMetricValue`를 거쳐 허용된 값만 새 요약 객체에 넣는다.

| 화면 값 | 허용 조건 | 누락 또는 부적격 처리 |
|---|---|---|
| 기록 수와 세션 종류 | 메모 외 구조화 신호가 있는 기록 | 메모만 있는 기록은 행과 개수 모두 만들지 않음 |
| 거리 | P5에서 적격한 구조화 거리 | 합계 제외, 0으로 채우지 않음 |
| 시간 | 직접 입력된 신뢰 가능한 세션 시간 | 합계 제외, 0으로 채우지 않음 |
| 기분 | P5에서 적격한 구조화 기분 | 평균 제외, 0으로 채우지 않음 |
| 통증 | P5에서 적격한 구조화 통증 최대값 | 최대값 제외, 0으로 채우지 않음 |

`EXPLICIT` 또는 P5가 정확히 검증할 수 있는 값만 수치에 들어간다. 가져온
`DERIVED` 10 km/50분, `LEGACY_MISSING_PROVENANCE`, `MISSING`, 검증 불가능한
값은 합계에 넣지 않는다. 후보 수치가 있었지만 하나도 적격하지 않으면 색상에
의존하지 않는 다음 문장을 함께 표시한다.

> 출처를 확인할 수 없어 제외된 기록 N건

날짜가 잘못된 기록은 월/주/일 키를 만들지 않는다. 빈 값은 0으로 바꾸지 않는다.

## 5. 메모 무신호 경계

개인 메모의 원문, 제목, 존재, 길이, 개수, 목적은 다음 어느 곳에도 쓰지 않는다.

- 월/주/일 카드
- 기록 수와 종류 수
- 거리, 시간, 기분, 통증 요약
- DOM 텍스트와 접근성 이름
- 로그와 화면 증거

개발 중 첫 구현에서는 메모만 있는 기록이 `entryCount`와 종류 수를 늘리는 결함을
적대 테스트가 발견했다. 메모만 있는 훈련 후, 하루 마무리, 경기 일지를 추가한
결과가 기준 결과와 byte-identical이어야 한다는 RED 계약을 먼저 고정한 뒤,
메모 외 구조화 신호가 없는 기록은 projection 입구에서 제외하도록 수정했다.

`ANALYZABLE_TRAINING_NOTE`도 이 아카이브에는 신호가 아니다. 이 화면은 메모 분석
기능이 아니라 구조화 기록 탐색 기능이기 때문이다.

## 6. 화면과 접근성

- 1440x900, 393x852, 320x568에서 가로 넘침 0을 확인했다.
- 월/주/일 이동은 모두 의미 있는 `button`과 접근성 이름을 사용한다.
- 뒤로 가기는 아이콘 버튼이지만 `aria-label`과 `title`을 가진다.
- 선택한 주에서 일일 상세를 열고 돌아오면 같은 주가 다시 보인다.
- 제외된 기록은 텍스트로 표시한다.
- reduced motion 환경에서도 같은 탐색 결과를 유지한다.

화면 증거:

- `.omo/evidence/task-9-journal-archive-1440x900.png`
- `.omo/evidence/task-9-journal-archive-393x852.png`
- `.omo/evidence/task-9-journal-archive-320x568.png`
- `.omo/evidence/task-9-journal-archive-error.png`

세 화면에서 콘솔 오류 0, 개인 메모 문자열 0, 가로 넘침 0이었다.

## 7. PIN -> RED -> GREEN -> SURFACE

### PIN

기존 Home 접근성, 지난 일지 상세 복귀, 휴지통, 복원, 모션, 수정, 삭제 계약을
변경 전에 고정했다: 8 files, 91 tests 통과.

### RED

1. 아카이브 모듈과 화면이 없는 상태에서 월/주/일, 출처 제외, 선택 유지 계약이
   실패했다.
2. 첫 구현에서 메모만 있는 기록 세 개를 추가하면 기준 `entryCount` 2가 5로
   바뀌었다. 메모 무신호 byte-identity 계약이 실패했다.

### GREEN

- 아카이브 집중 계약: 3 files, 7 tests 통과
- 보호 회귀 계약: 11 files, 98 tests 통과
- 앱 전체 단위 테스트: 56 files, 449 tests 통과
- 처방 엔진 타입 검사와 10 files, 107 tests 통과
- D9 평가기 1 file, 11 tests 통과
- 앱 타입 검사, E2E 타입 검사, 프로덕션 빌드 통과
- 전체 계약 검증기 통과
- `git diff --check` 통과
- `as any`, `@ts-ignore`, `@ts-expect-error` 추가 0건

### SURFACE

- 집중 Playwright: desktop, mobile, 320px, reduced motion 4/4 통과
- 실제 Chrome: 1440x900, 393x852, 320x568 통과
- PR-equivalent clean snapshot 전체 Playwright: 216개 발견,
  181 passed, 35 viewport 조건부 skipped, 실패 0

현재 로컬 worktree에는 이 작업과 무관하게 사용자가 남긴 `App.tsx` 한글 손상이
있다. 그 dirty 파일을 포함한 전체 Playwright는 기존 launch 문구 1건에서만
실패했고, 아카이브 4개 프로젝트는 모두 통과했다. 성공 증거는 이 오염된 실행이
아니라, 의도한 파일만 적용한 깨끗한 스냅숏 재실행으로 확정한다.

## 8. 적대 검증

- 잘못된 날짜는 아카이브에서 제외된다.
- 가져온 10 km/50분은 합계에서 빠지고 제외 1건으로 표시된다.
- provenance 없는 과거 수치는 0으로 바뀌지 않는다.
- 메모 명령문, 원문, 목적, 길이, 개수는 projection bytes와 화면을 바꾸지 않는다.
- 메모만 있는 일지는 날짜 행과 기록 수를 만들지 않는다.
- 화면을 벗어나 상세을 열고 돌아와도 선택 상태를 유지한다.
- 320px와 reduced motion에서도 접근과 레이아웃이 유지된다.
- 기본 병렬 단위 테스트가 멈춘 과거 실행은 성공으로 세지 않고, 종료되는 단일
  worker 전체 실행만 증거로 사용했다.
- dirty worktree 전체 브라우저의 오해 가능한 부분 성공은 승인 증거로 쓰지 않는다.

## 9. 닫혀 있는 범위

이번 작업은 다음을 추가하지 않았다.

- 날씨와 외부 환경 데이터
- Garmin 상세 데이터
- 9.5일 live cycle 표시
- 다이어리 꾸미기 저장소
- 계정 또는 기기 간 동기화
- 훈련 추천, 처방, 강도 조정
- D9 또는 Safety Gate 해제

아카이브 요약은 사용자가 과거 구조화 기록을 훑어보기 위한 표시일 뿐이다.
자동 계획이나 안전 판정의 입력으로 사용할 수 없다.
