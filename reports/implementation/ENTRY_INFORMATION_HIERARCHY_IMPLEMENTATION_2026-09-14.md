# ENTRY_INFORMATION_HIERARCHY_IMPLEMENTATION_2026-09-14.md

```yaml
doc_id: trainoracle-entry-information-hierarchy-20260914
title: 목적 중심 첫 화면과 설명 분리 구현·검수 기록
version: "1.1"
status: OWNER_APPROVED_FOR_RELEASE
baseline_commit: d781011ba087e100e11ab90d4bf701eea15ec956
branch_at_review: main
new_commit: CONTAINING_COMMIT
pull_request: DIRECT_MAIN_PER_REPOSITORY_POLICY
production_deployment: VERIFY_ACTIONS_AND_DEPLOY_RECEIPT
canonical_promotion: false
evidence_scope: LOCAL_BROWSER_WITH_SYNTHETIC_DATA
```

## 1. 사용자에게 달라지는 점

첫 화면은 사용 설명을 읽는 곳이 아니라 원하는 일을 시작하는 곳으로 정리했다.
기록을 가장 큰 행동으로 두고 분석·계획·예시·학습으로 바로 들어간다.
긴 설명은 삭제해 기능을 축소하는 대신, 필요한 사람이 눌러서 읽도록 옮겼다.

| 영역 | 반영 내용 | 유지한 정보와 행동 |
|---|---|---|
| 첫 방문 홈 | `오늘 운동을 기록해요`와 기록 버튼, 네 가지 목적 버튼 | 예시는 실제 사용자 피드가 아닌 `예시 훈련 보기`로 명시 |
| 다시 방문한 홈 | 오늘 남긴 기록과 다음 훈련을 먼저 표시 | `기록 더 남기기`, 오전·오후 훈련, 지난 일지 접근 |
| 기록 진입 | `경기기록` 탭을 실제 역할인 `기록하기`로 변경, QUICK/POST/EVENING 코드 제거 | 빠르게/훈련 후/하루 마무리/경기 기록 경로 |
| 빠른 기록 | 첫 질문 앞의 빈 일지 종이를 제거, 입력 중 요약은 접어서 제공 | 저장 완료 종이·저장 위치·전송 대기·충돌·오류는 계속 표시 |
| 계획 선택 | 7개 종목을 두 열로 배치, 이전 선택은 `선택한 조건 N개 · 수정하기` | 선택값 수정, 안전 확인, 적은 훈련일·하루 두 번 선택의 영향 |
| 계획 후보·일정 | 입력 출처와 긴 배경 설명을 접음 | 실제 수치·방법·적용 불가·기준 기록 상태·비교 정보 |
| 계획 저장 | 기존에 접힌 유의사항 안에 있던 계정 저장 실패와 재시도 버튼을 밖으로 이동 | 실패·저장 중·확인 중을 현재 상태로 표시, 저장 로직 무수정 |
| 빈 분석 | 첫 기록 행동을 맨 위로 이동 | 기존 일지가 있지만 분석 수치가 없으면 `기록 더 남기기`로 구분 |
| 분석·오라클 | `내 훈련 요약` 아래에 짧은 결과, 근거·집계법은 펼쳐서 읽기 | 거리·에너지 원장·미기록 구분, 사용·제외 건수, MIX 표시 |
| 훈련 공부 | `어떤 훈련이 궁금한가요?`, 자료 등급을 한글로 표시 | `따라 하기 전에`의 적용 한계와 출처 링크 |
| 보관·포인트·파일 가져오기 | 일반 원리와 정책 설명을 주제별 도움말로 이동 | 현재 저장 오류·동의·획득 수치·자동 연동 준비 상태 |
| 공개 프로필 문구 | `구조화 일지`를 경기 기록·거리·시간을 남긴 일지로 풀어 씀 | 공개 범위와 비교 로직은 변경하지 않음 |

## 2. 정보 표시 규칙

1. 바로 해야 할 행동과 실제 상태는 기본 화면에서 보인다.
2. 짧은 전문 용어는 기존 `TermHelp` 물음표로 설명한다.
3. 긴 설명은 새 공통 `InfoDisclosure`의 기본 닫힌 상세로 제공한다.
4. `더보기`만 반복하지 않고 `어떤 기록을 분석하나요?`, `포인트는 어떻게 쌓이나요?`처럼 제목만으로 내용을 알린다.
5. 저장 실패·전송 대기·수정 충돌·통증 확인·처방 적용 불가·동의·파괴적 작업 확인은 설명 뒤에 숨기지 않는다.
6. 설명을 접는 것으로 실제 데이터 누락을 감추지 않는다. 분석에서 빠진 기록의 건수는 접힌 상태에서도 보인다.
7. 글자를 작게 만들어 정보를 억지로 넣지 않는다. 200% 글자 크기에서는 세로 스크롤을 허용한다.

`InfoDisclosure`는 네이티브 `details/summary`이며 키보드 조작과 열린 상태를 브라우저가 제공한다.
실제 터치 영역은 최소 44px, 긴 제목은 줄바꿈하며 모션 감소 설정에서는 화살표 전환을 제거한다.

## 3. 스펙과 코드 범위

- [마스터 플랜](../../TRAINORACLE_MASTER_PLAN.md) §16에 이번 오너 승인과 기존 결정을 함께 보존했다.
- [UX·UI 시각 기준](../../docs/UX_UI_VISUAL_STANDARD.md) §0에 설명 분리 규칙과 예외를 추가했다.
- 기존 디자인의 폰트·색·테두리·아이콘·모션 기준을 사용했다. 새 프레임워크·외부 UI 의존성은 추가하지 않았다.
- `impl/`, `app/src/domain/`, 계정 API·DB·권한, `AppShell.tsx`, GitHub Actions는 변경하지 않았다.
- 훈련 강도·양·반복·회복·후보 추천·개인화·안전 판정·포인트 산식은 변경하지 않았다.
- 메모 원문을 분석하거나 외부로 보내는 경로를 추가하지 않았다.
- 용어집 복귀 등 별도 내비게이션 작업의 코드와 작업트리는 수정하지 않았다. 병합 전에는 그 트랙의 최신 상태를 다시 확인해야 한다.
- 이번 문서는 로컬 구현 보고다. 개별 스펙의 정본 승격이나 실제 계정·운영 서비스 검증 증거로 사용하지 않는다.

## 4. 실제 검증 결과

| 검사 | 결과 | 정확한 범위 |
|---|---|---|
| 변경 영역 단위·계약 검사 | 189/189 PASS | 홈, 기록, 계획 표시, 분석, 설명 컴포넌트, 파일 가져오기, 시각 규칙 |
| 주요 브라우저 흐름 | 45/45 PASS | 첫 방문·재방문, 빠른 기록, 상세 기록 확장, 일지 출처, 계획 미리보기·선택·재시도, 상세 이유, 메모 암호화, 훈련 공부 |
| 모바일 터치 검사 | 8/8 PASS | mobile-chromium 및 320px touch-narrow, 버튼·탭·도움말 접근, 추가 기록, 통증 안내 닫기 |
| 일지 복귀 단독 재검사 | 10/10 PASS | 기존 아카이브 이동·편집 복귀·예시 복귀 등 |
| 앱 타입 검사·프로덕션 빌드 | PASS | `npm run build`의 tsc와 Vite |
| E2E 타입 검사 | PASS | `tsc --noEmit -p tsconfig.e2e.json` |
| Git diff 공백 검사 | PASS | 코드·문서 변경의 공백 오류 확인 |
| 폰트 실물 확인 | PASS | 로컬 빌드 `/fonts/PretendardVariable.woff2` HTTP 200, FontFace `loaded` |

브라우저 검사는 격리한 가상 데이터만 사용했다. 320×568·375×667의 홈·빠른 기록·계획 종목 선택과
1440×900 화면을 확인했다. 글자 확대 검사는 CSS 글꼴 크기를 두 배로 만든 시뮬레이션이며,
실제 iOS Safari나 운영체제 글자 확대를 검증했다고 주장하지 않는다.

### 결함을 실제로 잡은 검사

- 초기 확대 시험에서 포인트 설명의 기존 `nowrap` 때문에 375px 화면이 옆으로 넘쳤다. 문장을 접힌 도움말로 옮기고 강제 한 줄 표시를 제거했다.
- 변경 전 코드에 신규 검사를 적용하면 목적별 직접 진입과 계획 저장 실패의 재시도 노출 검사가 각각 실패한다. 새 검사 두 개가 이전 문제를 잡는 것을 확인했다.
- 나만의 메모 저장 시험은 메모가 평문 저장소에 남지 않고 암호화 준비 후 저장되는지 확인한다. 실제 사용자 복구 코드나 메모는 사용하지 않았다.
- 기록을 한 번 남긴 뒤 다시 기록해도 별개의 기록이 저장되고, 빠른 기록을 자세히 이어 쓰면 같은 기록을 갱신하는 흐름을 확인했다.

### 통과로 덮지 않은 항목

1. **기존 탭 모션 계약 실패 1건**: `Motion.contract.test.tsx`의 첫 탭 이동이 `tab-forward` 대신 `initial`인 검사는 현재 변경 전 `d781011` 소스를 읽기 전용으로 불러와도 동일하게 실패했다. 이 테스트를 삭제·완화하거나 라우팅을 함께 수정하지 않았다. 내비게이션 통합 전에 별도 확인이 필요하다.
2. **통합 실행의 일지 복귀 시간 초과 1건**: 208건 확장 실행에서 첫 상세 화면 대기가 실패했다. 같은 파일 단독 실행은 10/10 통과했다. 간헐 실패 위험을 없앴다고 주장하지 않는다.
3. **개발 서버 검사 간섭**: 개발용 react-grab 오버레이가 메모 저장 후 클릭을 막은 실행이 있었다. 배포용 빌드의 프리뷰에서는 동일 시나리오가 통과했다. 오버레이를 우회하는 강제 클릭은 추가하지 않았다.
4. **과거 라벨을 참조한 검사**: `경기기록`, 이전 환영 문구, 펼쳐진 설명을 전제로 한 단언을 새 접근 가능한 이름과 실제 펼치기 행동으로 고쳤다. 저장·안전·데이터 검증 단언은 유지했다.
5. Vite의 큰 청크·혼합 import 경고는 남아 있다. 폰트 경로 경고는 실제 프리뷰에서 폰트가 로드되는 것까지 확인했다.

전체 테스트·전체 CI·모든 운영 계정·실기기·공개 배포가 통과한 것으로 이 표를 확대 해석하지 않는다.

## 5. 재현과 증거 위치

작업 체크아웃:
`D:/admin/Documents/ChatGPT/트레인 오라클/TRAINORACLE-private-memo-save-hotfix-20260913`

로컬 증거 폴더:
`D:/admin/Documents/ChatGPT/트레인 오라클/runtime/progressive-information-20260914`

- `final-scoped-unit-review.json`: 189건 최종 결과
- `current-archive-isolated.json`: 아카이브 단독 재검사
- `current-unit-review.json`: 기존 실패를 포함한 208건 확장 검사
- `baseline-motion-review.json`: 변경 전 코드의 모션 실패 재현
- `baseline-regression-proof.json`: 변경 전 코드에서 신규 검사 2건이 실패한 증거
- `final-touch-review.json`: 모바일 8건 결과와 터치 영역 수치
- `home-320.png`, `home-375.png`, `quick-320.png`, `quick-375.png`
- `plan-320.png`, `plan-375.png`, `analysis-empty.png`, `home-double-text.png`
- `quick-saved.png`, `learning.png`, `returning-home-record-first-320x568.png`

원래부터 있던 `.omo/evidence` 캡처를 새 실행으로 덮지 않도록 터치 검사의 새 이미지 경로를
Playwright `testInfo.outputPath`로 바꿨다. 이 보고서의 증거 폴더는 로컬 파일이며 GitHub에서
자동으로 열리는 경로가 아니다. PR을 만들 때 필요한 증거를 별도 첨부해야 한다.

재실행은 `app/`에서 빌드한 후 `npm run preview -- --host 127.0.0.1 --port 4178 --strictPort`로 시작한다.
브라우저 검사에는 다음 환경 변수를 사용했다.

```powershell
$env:PLAYWRIGHT_EXTERNAL_SERVER='1'
$env:PLAYWRIGHT_BASE_URL='http://127.0.0.1:4178'
node node_modules/@playwright/test/cli.js test e2e/progressive-information.spec.ts e2e/quick-progressive-journal.spec.ts e2e/plan-goal-progressive-disclosure.spec.ts e2e/empty-state-guidance.spec.ts e2e/training-content.spec.ts e2e/private-memo-save.spec.ts e2e/home-next-training.spec.ts e2e/device-import.spec.ts e2e/journal-provenance.spec.ts e2e/plan-save-retry.spec.ts e2e/plan-fast-preview-comparison.spec.ts e2e/plan-candidate-purpose.spec.ts e2e/session-explanation.spec.ts e2e/first-screen-feedback.spec.ts --project=desktop-chromium --workers=2
node node_modules/@playwright/test/cli.js test e2e/touch-surfaces.spec.ts --project=mobile-chromium --project=touch-narrow --workers=2
```

## 6. 배포 승인 전 인수 기록

완료: 위 UI·문구 개선, 관련 기준 문서 보정, 범위별 로컬 검사와 시각 확인.

미수행: 새 커밋·푸시·PR·병합·CI·운영 배포·공개 화면 확인. 이 요청에서는 배포하지 않았다.
작업 종료 뒤 에이전트가 자동으로 계속 실행되는 상태도 아니다.

다음 실행 순서:
1. 현재 작업트리와 원격 main을 다시 대조하고, 이 변경을 포함해 다른 작업자의 변경을 보존한다.
2. 별도 내비게이션 수정과 결합할 때 모션 실패 및 일지 복귀 간헐 실패를 확인한다. 기존 실패를 이번 통과 검사에 숨기지 않는다.
3. 공개 반영 지시를 받으면 변경 전용 PR과 필요한 로컬 증거를 준비하고 정해진 CI·검수·병합·배포 절차를 수행한다.
4. 공개 사이트에서 첫 방문·오늘 기록이 있는 사용자·계획이 있는 사용자, 계정 저장 실패·재시도를 다시 확인한다. 로컬 결과로 대체하지 않는다.

후속 제품 범위: 실제 타인 훈련을 탐색하는 피드와 `둘러보기` 탭의 통합은 이번 구현이 아니다.
지금은 정직하게 표시한 예시와 기존 훈련 자료로 연결한다. 장기 목표 기능을 삭제하거나
기본 보기에서 상세 처방·근거·누적 지표를 빼는 근거로 이 개선을 사용하지 않는다.

## 7. 2026-09-14 배포 승인 후속

오너가 `배포해. 간소화된 검증작업으로`라고 승인했다. §6은 승인 전 기록이며 현재의 배포 금지 지시가 아니다.
원격 `main`을 다시 확인했으며 기준은 `d781011`로 일치했다. 열려 있는 #338 내비게이션,
#337 COROS, #320 처방 PR은 이번 변경에 포함하지 않는다.

- 분류: 일반 UI·문구·정보 배치 변경. 훈련·안전·저장 알고리즘·권한·DB·서비스 워커는 변경하지 않았다.
- 기존 189건 단위·계약, 45건 주요 흐름, 8건 모바일 검사와 빌드 결과를 사용한다. 같은 전체 검사를 로컬에서 반복하지 않는다.
- 배포 직전에는 `git diff --check`와 새 정보 배치 브라우저 검사만 재확인한다.
- 저장소 `AGENTS.md` §6을 따라 `main` 직접 커밋·푸시로 배포 검사를 한 번 실행한다. 필수 CI의 검사 항목이나 배포 선행 조건은 완화하지 않는다.
- 운영 설정·비밀값은 기존 Actions 빌드 경로를 사용한다. 로컬 미리보기 빌드를 운영에 직접 복사하지 않는다.
- 배포 완료 판정은 해당 커밋의 Actions 결과, 공개 `trainoracle-deploy-receipt.json`의 `sourceSha`, 새 브라우저 세션의 홈·기록·계획 진입을 함께 확인한다.

이 문서의 승인 상태 자체가 배포 성공 증거는 아니다. 정확한 배포 커밋·시간은
[GitHub Actions](https://github.com/hojune0330/TRAINORACLE/actions/workflows/ci.yml)와
[공개 배포 확인 파일](https://hojune0330.github.io/TRAINORACLE/trainoracle-deploy-receipt.json)에서 확인한다.

[DRAFT_COMPLETE]
