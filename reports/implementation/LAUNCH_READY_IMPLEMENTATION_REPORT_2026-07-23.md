# LAUNCH_READY_IMPLEMENTATION_REPORT_2026-07-23.md

```yaml
report_id: TO-LAUNCH-READY-2026-07-23
status: LOCAL_VERIFIED_PENDING_GITHUB_CI_AND_LIVE_VERIFICATION
scope: LOCAL_JOURNAL_PUBLIC_WEB
implementation_owner_activation: CONFIRMED_IN_CODEX_THREAD_2026-07-23
canonical_promotion: false
backend_activation: false
training_plan_runtime_activation: false
```

## 1. 목적

Terra와 Fable이 검토한 첫 방문 UX를 실제 사용자가 바로 쓸 수 있는 로컬 일지 흐름으로 구현한다. 아직 런타임 권위가 없는 계정, 코치 연결, 훈련계획 생성은 만들지 않으며 `서비스 준비 중`으로 정직하게 표시한다.

## 2. 입력 근거

- Fable UX proposal: GitHub PR #102, branch `fable/wo017-ux-flow`, head `f900793`
- Terra binding review: GitHub PR #104, branch `codex/wo017-terra-binding`, head `d8ed6e3`
- Owner implementation activation: 2026-07-23 Codex thread
- Existing local journal, provenance, D9 memo evaluation, safe export contracts on `main`

PR #102와 #104는 구현 전 검토 자료다. 이 보고서는 두 PR을 canonical 또는 accepted source로 승격하지 않는다.

## 3. 구현 범위

### 첫 방문

- 데스크톱과 모바일에서 실제 앱을 기본 화면으로 제공한다.
- 첫 화면에서 한 번 눌러 일지 선택 화면으로 간다.
- 방문 이유를 선택하면 훈련 후 또는 하루 마무리 일지로 바로 이동한다.
- 방문 이유 선택은 저장하지 않는다.
- 훈련계획은 개인정보나 신청을 받지 않는 준비 중 화면으로 연결한다.
- 디자인 워크스페이스는 `?workspace=1`로만 연다.
- 온보딩을 건너뛴 사실은 이 브라우저에만 저장하여, 기록을 쓰지 않았다는 이유로 매 방문마다 다시 묻지 않는다.

### 저장 후 피드백

- 저장된 구조화 사실에 따라 거리, 기분, 통증 영수증을 표시한다.
- 입력 출처가 `EXPLICIT`이고 분석에 사용할 수 있는 값만 구체적 영수증에 사용한다.
- 영수증은 저장소에서 최신 기록을 다시 추정하지 않고, 방금 저장에 성공한 정확한 기록으로 만든다.
- 통증이 있으면 통증을 최우선으로 알리고 관련 추이로 이동할 수 있다.
- 구체적 사실이 없으면 로컬 저장 사실만 알린다.
- D9 검토 주의는 자동으로 닫지 않고 사용자가 직접 닫는다.

### 배포 보호

- 앱 단위 테스트, 타입 검사, 프로덕션 빌드, 브라우저 시나리오를 GitHub Actions 필수 작업으로 분리한다.
- 세 작업이 모두 성공한 `main` 빌드만 `gh-pages`에 게시한다.
- 배포 작업에만 저장소 쓰기 권한을 부여한다.
- 서비스 워커 캐시 버전을 올려 기존 사용자가 새 화면을 받도록 한다.

## 4. 명시적 비범위

- 서버 저장 또는 계정 동기화
- AthleteTime SSO
- 코치 연결 또는 코치 강제 선택
- 훈련계획 후보 생성, 결제, 유료 기능
- PR #103의 backend draft 배포
- D9 또는 Formation 의미 변경

## 5. 로컬 검증

| 검증 | 결과 |
|---|---|
| Vitest 전체 | 94 PASS |
| TypeScript app | PASS |
| TypeScript e2e | PASS |
| Vite production build | PASS |
| Playwright 전체 | 87 PASS / 환경별 의도된 21 SKIP |
| 첫 방문·저장 영수증·추이 브라우저 계약 | desktop/mobile/320px/reduced-motion PASS |
| 기존 모바일 touch surface 계약 | 393px/320px PASS |
| React Doctor changed scope | 새 진단 0건 |
| reasoning-tier·formal foundation·formation plan·WO016 gate | PASS |
| D9 evaluator runtime | 11 PASS |
| D9 → RVE → Safety Gate impl | 7 PASS |

### 화면 증거

- [375×667 첫 화면](../../.omo/evidence/launch-ready-2026-07-23/01-mobile-welcome.jpg)
- [375×667 방문 이유 선택](../../.omo/evidence/launch-ready-2026-07-23/02-mobile-context.jpg)
- [375×667 훈련계획 준비 중](../../.omo/evidence/launch-ready-2026-07-23/03-mobile-plan-pending.jpg)
- [1330×900 실제 일지 앱](../../.omo/evidence/launch-ready-2026-07-23/04-desktop-welcome.jpg)
- [320×568 첫 핵심 행동](../../.omo/evidence/launch-ready-2026-07-23/05-narrow-welcome.jpg)

### 검증 기록

- [초기 선수 UX·안전 코드 리뷰](../../.omo/evidence/launch-ready-athlete-ux-safety-code-review.md)
- [수정 후 전체 코드 재검증](../../.omo/evidence/launch-ready-athlete-ux-safety-followup-code-review.md)
- [개인정보 범위 최종 재검증](../../.omo/evidence/launch-ready-privacy-scope-recheck-code-review.md)
- [시각·디자인 시스템 검증](../../.omo/evidence/launch-ready-clone-fidelity.md)
- [수정 후 시각·디자인 시스템 승인](../../.omo/evidence/launch-ready-clone-fidelity-followup.md)

로컬 표의 수치는 위 독립 재검증에서도 다시 실행해 확인했다. 병합 전후의 전체 원시 실행 로그와 성공 여부는 GitHub Actions 실행 기록을 최종 증거로 사용한다.

### 독립 리뷰 반영

| 발견 | 반영 |
|---|---|
| 테스트 환경의 `scrollIntoView` 오류 | 메서드 존재 여부를 확인하고 호출하도록 수정 |
| 공용 브라우저와 삭제 위험을 설명하지 않음 | 첫 화면과 가이드에 공용 기기 열람·브라우저 삭제·백업 경계를 명시 |
| 저장 영수증이 다른 최신 기록을 고를 수 있음 | 성공한 저장 함수가 정확한 기록을 전달하도록 계약 변경 및 미래시각 회귀 테스트 추가 |
| 건너뛰기가 새로고침 후 유지되지 않음 | 브라우저 로컬 온보딩 상태 계약 추가 |
| 한글 단어가 중간에서 갈라짐 | Korean `keep-all` 규칙과 좁은 화면 검증 추가 |
| 하단 메뉴가 첫 화면 행동을 가림 | 메뉴를 앱 흐름에 포함하고 첫 방문 간격을 토큰 단위로 조정 |
| 증거 확장자와 실제 형식이 다름 | 새 JPEG 화면 증거를 `.jpg`로 다시 생성 |

GitHub CI와 공개 URL 검증 결과는 PR 및 배포 실행 기록을 최종 증거로 사용한다.

## 6. 다음 경계

이번 배포는 8월 1일 전 실제 사용 가능한 로컬 일지 한 걸음이다. 다음 제품 단계는 계정·동기화보다 먼저 실제 사용자 일지 작성 성공률, 저장 실패, 첫 기록 후 재방문을 관찰할 최소 측정 계약을 결정하는 것이다. 민감한 메모 원문을 원격 분석 또는 측정 이벤트로 보내면 안 된다.

[DRAFT_COMPLETE]
