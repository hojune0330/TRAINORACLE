# Batch 4 부가 화면 탐색 개선 인수 보고

2026-10-07. 승인된 선수 피로 감사의 네 번째 묶음 중 더보기, 파일 준비, 지난 일지 읽기 상태, 저장 기록 재사용 발견성을 수정했다. 기존 미커밋 변경 위에 좁게 추가했다. 이 작업자는 커밋, 원격 병합, 푸시, 배포를 하지 않았다.

## 변경 결과

- 더보기 첫 화면에 페이스, 경기 기록, 파일 가져오기와 오라클 도구를 유지한다. 배우기와 꾸미기, 계정과 보관, 백업과 복원과 휴지통, 앱 정보와 개인정보와 문의는 각각 이름 있는 하위 화면으로 이동한다. 화면 내 뒤로가기는 더보기로 돌아간다. 계정 기능이 주입된 경우 계정 상태 확인을 직접 열 수 있다.
- 실제 파일 진입은 `ImportActivities.tsx`의 `PickStage`, 구현 위치는 `screens/import-activities/ImportStages.tsx`다. 첫 버튼이 기존 네이티브 파일 선택을 직접 연다. 파일이 없는 사람은 Garmin, COROS, 건강앱 중 기록 위치를 고르고 해당 준비 과정만 본다. FIT와 전체 ZIP/XML 건강 백업의 미지원, 파일 미리보기와 명시적 저장, 자동 연결 미제공을 구별한다. 원본 업로드, OAuth, 새 파서나 저장 경로는 추가하지 않았다.
- `JournalArchive`는 확인된 자료가 없고 읽기가 LOADING, ERROR, STALE일 때 실제 빈 달력과 기록 묶음과 자동 빈 예시를 표시하지 않는다. 기존 자료가 있으면 달력을 유지하고 갱신 상태를 알린다. 이미 사용자가 직접 연 예시는 명시적 예시 표시와 함께 유지하지만 실제 달력이나 기록 묶음으로 돌아가면 미확인 빈 기록을 표시하지 않는다.
- 경기 기록 재사용은 이미 존재했다. `AthleteRecords`의 저장 후 정확한 기록을 계산기로 전달하는 경로를 재구현하지 않았다. `PaceCalculator`의 첫 화면에서 기존 저장 기록을 직접 선택하고 결과로 이동할 수 있게 했다. 저장된 경기 기록, 미달성 목표, 이번 계산에만 입력한 값의 출처가 다르게 표시되며 직접 수정하면 일회성 입력으로 전환된다. 기존 저장값, 중복 검사, 선택 적격성, 계산식은 그대로다.

## 정확한 변경 파일

운영 코드 5개:

- `app/src/screens/More.tsx`
- `app/src/screens/JournalArchive.tsx`
- `app/src/screens/PaceCalculator.tsx`
- `app/src/screens/import-activities/ImportStages.tsx`
- `app/src/screens/import-activities/file-analysis.css`

집중 테스트 7개:

- `app/src/screens/More.discovery.contract.test.tsx`
- `app/src/screens/More.feedback.contract.test.tsx`
- `app/src/screens/More.legal.contract.test.tsx`
- `app/src/screens/JournalArchive.contract.test.tsx`
- `app/src/screens/ImportActivities.contract.test.tsx`
- `app/src/screens/PaceCalculator.test.tsx`
- `app/src/screens/PaceCalculator.journeys.test.tsx`

브라우저 검사 신규 파일 3개:

- `app/e2e/fixtures/batch4-ancillary.html`
- `app/e2e/batch4-ancillary.browser.ts`
- `app/playwright.batch4.config.ts`

이 보고서와 `reports/review/evidence/batch4-ancillary-20261007/`의 검사 결과와 화면도 생성했다. `.browser.ts` 이름은 기본 production-preview 검사에 소스 전용 fixture가 끼어들지 않도록 사용한다. 전용 설정으로만 실행한다. 위 파일 중 기존 변경이 있던 파일의 전체 diff를 이번 작업만의 변경량으로 세지 않는다.

## 검증

- 단위와 화면 계약 7개 파일, 76개 통과. More 발견성 4, 문의 4, 공개문서 1, 지난 일지 13, 가져오기 20, 계산기 10, 계산기 여정 24개다. 결과는 `evidence/batch4-ancillary-20261007/unit-final.json`이다.
- 브라우저 12개 통과. 320px, 375px, 1440px, 모션 감소 환경에서 목적별 메뉴와 복귀, 백업과 개인정보 도달, 실제 파일 선택 후 합성 JSON 미리보기, 읽기 상태와 확인된 빈 달력을 검사했다. 외부 요청은 차단했다. 가로 넘침 검사를 통과했고 More, COROS 준비, 일지 오류 화면을 직접 시각 확인했다.
- 결함 주입 6개가 예상한 이름으로 실패했다. 파일 선택 호출 제거 1개, 읽기 상태 보호 제거 3개, 더보기 복귀 제거 1개, 첫 화면 기록 재사용의 잘못된 목적지 1개다. 모두 복구한 뒤 최종 76개가 통과했다. 근거는 `evidence/batch4-ancillary-20261007/mutation.json`이다.
- 대상 파일 `git diff --check` 통과. CRLF 변환 안내만 있었고 공백 오류는 없었다.
- 첫 샌드박스 실행은 setup 파일 realpath EPERM으로 테스트 자체가 실행되지 않았다. 실제 테스트 결과는 허용된 로컬 재실행에서 얻었다.
- 전체 앱 타입 검사 최종 재실행은 통과했다. 최초 실행의 소유 범위 밖 `QuickSessionForm.contract.test.tsx` 31, 38행과 `PersonalOraclePanel.contract.test.tsx` 32행의 Testing Library `exact` 오류는 최종 공유 checkout에서 더 이상 발생하지 않았다. 이 작업자는 해당 파일을 수정하지 않았다.
- 별도 e2e 타입 검사는 기존 `feature-discovery-journey.spec.ts` 6행과 `write-first-journey.spec.ts` 5행의 `reducedMotion` 옵션 타입 오류로 실패했다. 해당 파일은 수정하지 않았다. 전용 batch4 브라우저 12개 실행은 모두 통과했지만 전체 e2e 타입 검사 통과를 뜻하지는 않는다.

실행 명령은 `app`에서 다음과 같다.

```powershell
node node_modules/vitest/vitest.mjs run src/screens/More.discovery.contract.test.tsx src/screens/More.feedback.contract.test.tsx src/screens/More.legal.contract.test.tsx src/screens/JournalArchive.contract.test.tsx src/screens/ImportActivities.contract.test.tsx src/screens/PaceCalculator.test.tsx src/screens/PaceCalculator.journeys.test.tsx --maxWorkers=2
node node_modules/@playwright/test/cli.js test --config playwright.batch4.config.ts
```

## 부모 통합 요청

`AppShell.tsx`는 수정하지 않았다. 부모가 담당하는 `MoreView` 제어와 돌아갈 화면 및 브라우저 이력을 연결한다.

- `MoreView`는 `tools | learning | account | backup | about`다. `More`에 `view={moreView}`와 `onViewChange`를 전달한다. 콜백이 없으면 화면 내 로컬 상태로도 동작한다.
- `ShellReturnPoint`와 화면 식별자에 `moreView`를 포함한다. 파일 가져오기, 백업 복원, 학습 화면, overlay에서 돌아왔을 때 원래 하위 화면을 복구한다.
- 전용 history marker는 부모에서 관리한다. 하위 화면 진입은 한 이력, 화면 내 뒤로와 브라우저 뒤로는 동일 이력 해제로 처리한다. `tools`로 돌아가는 행동을 다시 push하지 않는다. 소유자 범위가 다른 marker는 복구하지 않고 계정 전환 시 `tools`로 초기화한다. `More`는 자체 history나 계정 자료 저장을 하지 않는다.
- `JournalArchive.onRetry`는 선택적이다. 실제 계정 재조회와 로컬 재읽기 경로가 연결될 때만 전달한다. 현재 `useCalendarSnapshot()`의 반환값에는 retry 함수가 없다. 임의 상태 변경만으로 성공을 표시하지 않는다.

## 원격 변경 병합 주의

요청받은 `HEAD..origin/main` 3개 커밋을 읽기 전용으로 확인했다. 직접 병합하거나 복사 적용하지 않았다.

- `9bcd031e`의 `journal-store.ts` 스냅샷 투영 수정은 이번 화면 보호와 다르다. 그대로 보존하며 도메인 수정은 중복 구현하지 않는다.
- `AthleteRecords.tsx`의 `preserveMountedDraftsOnBack`은 부모의 원격 병합으로 보존한다. 이 작업자는 그 파일을 수정하지 않았다.
- `247eec1d`의 `ImportActivities`와 `JournalArchive`의 `AppHeading`, `PickStage`의 `ContextualIllustration`과 `contextual-entry-intro`, `file-analysis.css`의 AppHeading 예외 선택자는 그대로 유지한다. 안내 그림과 첫 직접 파일 행동이 함께 존재해야 한다.
- `JournalArchive`의 `CalendarEmptyExample` 호출에는 원격의 `illustrationAllowed={readiness === "READY"}`를 유지한다. 사용자가 직접 연 예시는 계속 보존한다. 원격 테스트의 자료 없는 STALE 문구 기대값만 새 문구 `최신 일지를 아직 확인하지 못했어요. 기록이 없는 상태로 표시하지 않아요.`와 맞춰야 한다. 제목 강조와 예시 그림 노출 검사 자체는 제거하지 않는다.

## 남은 범위

부모의 More 브라우저 이력과 복귀 통합, 최신 원격 병합 및 통합 검사, 선택적 실제 일지 재조회 연결이 남는다. 읽을거리와 프로필, Home과 Trends, 계획과 기록 입력, domain은 이번 작업자의 수정 범위가 아니다. 실계정 저장과 COROS/Garmin 원본 파일, 실제 기기 자동 연결, 배포 후 확인은 검증하지 않았다. 새 계산과 지속 저장, 자동 PB 생성은 없다.
