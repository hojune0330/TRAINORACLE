# 오라클 3·6개월 통합 리포트 인수 — 2026-10-25

## 구현 범위

- 작업실: `.scratch/domain-navigation-release-20261024`.
- 시작 기준: `0f02cbcd1e37a45d03776ec0f24fe7ff519e3fb5`.
- 검사 런타임: Node.js `24.19.0`.
- 이 인수의 작업은 로컬 구현·검사이다. 커밋·푸시·병합·배포는 실행하지 않았다.

`OracleReport`가 개인·예시의 같은 화면을 사용한다. 기본 기간은 현재 달을 포함한 달력상 3개월이며 6개월로 바꿀 수 있다. 실제 자료는 해당 첫날부터 오늘까지, 예시는 동일한 가상 러너의 2026년 4–9월 이력을 사용한다. 예시의 3개월은 7–9월이다.

기존 `요약 / 훈련량 / 구성 / 월별`과 오라클 하단 탐색을 유지했다. 월 누적 거리와 운동 1회 거리의 월별 중앙값은 이름·기준을 분리했다. 페이스·기분·통증·힘든 정도는 기존 집계 정의를 재사용하며 새 체력 점수·예측·건강 판정은 추가하지 않았다.

자료·기간·지표·선택 월·전체 근거 펼침 상태를 복귀 문맥에 보관한다. 실제 자료 전환은 개별 선택을 해제하지만 활성 자료 재선택은 no-op이다. 6→3개월에서 범위 밖 월을 해제한다. 기존 상세·계획·경기·비교·도구 경로는 유지했다.

기존 주제별 `OracleExplore`도 `buildOracleDemoTopicResult()`를 통해 같은 가상 이력을 읽는다. 현재 계획 비교는 실제 연결된 9월 22–30일의 일지 4건을 사용하며, 그 범위를 3·6개월 결과라고 바꾸어 부르지 않는다. 최근 두 경기 비교 등 기존 집계의 좁은 기간은 출처 문구에 그대로 남긴다.

예시에는 저장소 주입·일지 저장·보상·포인트·계획 변경 경로가 없다. 예시 모드에서 북마크 조작을 표시하지 않는다. 개인 읽기가 미완료·실패이면 결과 수치·빈 기록 안내를 대신 표시하지 않으며, 상위 조회와 로컬 재읽기의 기존 재시도를 유지한다. 확인된 빈 기록, 해당 지표 없음, 일부 제외와 실제 결과를 구별한다. 제외 안내는 리포트 기간의 자료로 계산하며 가져온 값과 출처 미기록의 이유를 분리한다.

## 주요 파일

- `app/src/domain/oracle-report.ts`: 순수 공통 리포트 모델, 달력 기간, 월별 집계·근거·출처·제외.
- `app/src/domain/oracle-demo-scenario.ts`: 고정 가상 이력과 기존 주제 결과 연결.
- `app/src/screens/trends/OracleReport.tsx`, `oracle-report.css`: 공통 표현·선택·근거·다음 행동.
- `app/src/screens/Trends.tsx`: 기존 자료 읽기 및 네 보기와 통합.
- `app/src/domain/analysis-navigation.ts`, `app/src/AppShell.tsx`: 진입·복귀 문맥, 홈 미리보기 연결.
- `app/src/screens/OracleExplore.tsx`: 주제 상세의 공통 가상 이력 연결.
- `docs/UX_UI_VISUAL_STANDARD.md` §8.25: 이번 승인 범위와 기존 기준의 적용 관계.

월 선택은 모바일에서 3열을 사용한다. 6개월은 균등한 두 줄, 3개월은 한 줄이며 넓은 화면의 6개 월만 6열로 표시한다. 짧은 월 이름만 줄바꿈을 막고, 각 버튼의 44px 이상 터치 영역은 유지한다.

## 로컬 검사 증거

검사 수는 서로 겹치므로 합산하지 않는다.

| 검사 범위 | 결과 | 경계 |
| --- | --- | --- |
| 영향 있는 UI·탐색 18개 파일 | 149/149 통과 | 최종 자료 재선택·구성 근거 문구 보강 이전의 넓은 검사 |
| 마지막 `OracleReport` 집중 검사 | 11/11 통과 | 위 149건과 겹치며 자료 재선택·구성 근거의 새 2건 포함 |
| KST 리포트·복귀·공통 시각 기준 3개 파일 | 24/24 통과 | 넓은 검사와 겹치는 부분집합 |
| 도메인 담당의 리포트·가상 이력·기존 집계 회귀 4개 파일 | 62/62 통과 | 별도 도메인 범위이며 다른 검사와 중복 집계하지 않음 |
| 통합 담당의 타입 검사·Vite 프로덕션 빌드 | 통과 | 타입 검사·빌드 뒤 CSS만 보강했고 최종 Vite 재빌드도 exit 0 |

마지막 월 선택 CSS 보강 뒤 통합 담당이 Vite만 다시 빌드해 exit 0을 확인했다(실행 세션 `81088`). 기존 폰트 관련 경고와 큰 청크 경고는 비차단으로 분류했다. 경고를 없앴다고 주장하지 않으며 빌드 통과와 공개 배포를 구별한다.

처음 Vitest 실행은 sandbox의 임시 폴더 rename `EPERM`으로 테스트 시작 전에 실패했다. 작업실 내부 TEMP를 사용한 다음 실행부터 정상 실행됐다. 그 시작 실패는 제품 테스트 실패나 통과에 합치지 않았다.

18개 파일·149건 실행 명령 (`app`에서 실행):

```powershell
$env:TEMP = (Resolve-Path .tmp/oracle-ui-tests).Path
$env:TMP = $env:TEMP
$affectedTests = @(rg --files src/screens/trends | rg 'Trends.*test.tsx$')
./node_modules/.bin/vitest.cmd run @affectedTests `
  src/screens/trends/OracleReport.contract.test.tsx `
  src/screens/OracleExplore.contract.test.tsx `
  src/AppShell.home-oracle-status.contract.test.tsx `
  src/AppShell.trends-read-retry.contract.test.tsx `
  src/AppShell.oracle-plan-return.contract.test.tsx `
  src/AppShell.oracle-exploration.contract.test.tsx `
  src/AppShell.oracle-read-status.contract.test.tsx `
  src/AppShell.domain-navigation.contract.test.tsx `
  --reporter=json --outputFile=.tmp/oracle-ui-tests/affected-results.json
```

마지막 11건 실행 명령은 같은 TEMP 설정으로 다음을 실행했다.

```powershell
./node_modules/.bin/vitest.cmd run src/screens/trends/OracleReport.contract.test.tsx `
  --reporter=json --outputFile=.tmp/oracle-ui-tests/final-report-results.json
```

임시 로컬 영수증은 `app/.tmp/oracle-ui-tests/affected-results.json`, `final-report-results.json`에 있다. 이 폴더는 Git 인수 자산에 포함하지 않는 로컬 검사 자료이다.

## 통합 담당 브라우저 관측

- 320px·375px·1280px에서 기본 리포트와 기간·자료·지표 전환을 확인했다.
- 마지막 CSS 보강 후 320px·375px의 6개월 월 선택이 균등한 3×2 배치이고 버튼 높이가 44px이며 문서 폭이 뷰포트 폭과 같은 것을 재확인했다.
- 로컬 게스트로 기분 3/5를 저장한 뒤 6개월·10월 선택에서 해당 일지 상세로 들어가고 돌아왔을 때 기간·월·지표·정확한 진입점 포커스 복귀를 확인했다.
- 기존 주제의 계획·실제 강도 예시는 같은 가상 이력의 연결 일지 4건을 사용하는 것을 확인했다.
- 200% 확인은 콘텐츠의 CSS zoom 검사였다. 브라우저 자체 확대, iOS 및 실물 기기 검사로 확대하지 않는다.
- 확인한 계정은 로컬 게스트이다. 실제 계정의 서버 저장·기기 간 복구·인증 왕복 증거는 아니다.

최종 375px의 6개월 검토 캡처: `app/.tmp/oracle-ui-tests/oracle-six-month-375.jpg`. 최초 관측의 월 선택 5+1 배치와 월 이름 줄바꿈을 마지막 CSS 보강으로 수정한 뒤, 통합 담당이 같은 경로의 캡처를 최종 화면으로 갱신했다. 임시 zoom·미디어·뷰포트 설정을 복구했고 이 작업이 실행한 개발 서버도 종료했다(서버 세션 `38929`).

표와 집계 기준의 펼침 상태까지 복귀 정보에 추가하는 작업은 이번 마지막 보강에 포함하지 않았다. 전체 근거 펼침 상태는 복원하며, 실제 상세 왕복에서 요구한 핵심 선택과 포커스 경로는 위 범위에서 확인했다.

## 공개 전 엄격 디자인 검수 후속 — 2026-10-25

375px 최종 화면과 실제 코드를 다시 검토해, 승인된 다음 세 범위만 보강했다.

- `7월` 관찰 바로 아래의 `568 km`를 해당 달 값으로 오해하지 않도록 큰 합계 직전에 `6개월 누적 거리`를 붙였다. 가장 많은 달의 관찰은 그 달의 실제 값(`7월이 110 km로 가장 많아요`)을 함께 표시한다. 현재 부분 월을 비교에서 제외했을 때는 제목에도 `완료된 달 중` 범위를 명시한다.
- 월 버튼 위에 `근거를 볼 월`을 표시해 기간 전환과 근거 필터를 구분했다. 기존 월 선택·해제·복귀와 44px·3열/6열 배치는 유지했다.
- 요약 아래에서 가장 많은 달을 다시 말하던 문장을 기존 거리·훈련 종류의 반영 건수로 교체했다. 훈련량의 월별 비교 해석은 유지했다. 자료/기간 두 조작 묶음 사이의 간격은 기존 `space-5`(20px)로 늘렸다.

숫자·기간·집계·적격성 계산과 도메인 자료는 변경하지 않았다. 새로 추가한 사례는 대표 합계와 관찰의 서로 다른 범위 및 현재 부분 월이 더 커도 완료 월 비교라고 명시하는지를 검사한다.

후속 집중 검사: `OracleReport.contract.test.tsx` 13건과 `visual-system.contract.test.ts` 13건, 총 2개 파일 26/26건이 통과했다. 이전 149·24·11·62건과 겹치므로 합산하지 않는다. 실행 명령과 로컬 영수증은 다음과 같다.

```powershell
$env:TEMP = (Resolve-Path .tmp/oracle-ui-tests).Path
$env:TMP = $env:TEMP
./node_modules/.bin/vitest.cmd run src/screens/trends/OracleReport.contract.test.tsx `
  src/styles/visual-system.contract.test.ts `
  --reporter=json --outputFile=.tmp/oracle-ui-tests/design-review-results.json
```

이 후속 보강의 최종 브라우저 검수·통합 빌드·병합·수동 공개는 통합 담당의 별도 증거를 따른다. UI 담당은 이 단계에서 커밋·푸시·빌드·배포를 실행하지 않았다.

### 통합 담당 최종 확인

소스 변경을 동결한 뒤 Node.js 24.19.0을 고정해 `tsc --noEmit`과 Vite 프로덕션 빌드가 exit 0으로 완료됐다(세션 `41282`). 위 후속 집중 검사 26/26건과 함께 확인한 결과이며 전체 CI 통과로 확대하지 않는다.

브라우저에서는 375px·6개월 요약의 `7월 110km` 관찰과 `6개월 누적 거리 568km`의 구분을 확인했다. 320px 실제 자료의 기분 보기에서는 현재 부분 월 안내, 6개월·선택 지표 유지, 미기록을 0으로 채우지 않는 상태를 확인했다. 월 선택의 44px 이상 터치 영역과 가로 넘침 없음도 확인했다.

병합과 수동 공개는 아직 대기 중이다. 시작 기준 `0f02cbcd`의 CI 실행 `40189514863`은 오래된 UI 선택자·문구를 기대하는 검사에서 실패한 사실을 읽기 전용으로 확인했다. 이 기록은 전체 CI 통과나 검사 면제를 뜻하지 않는다.
