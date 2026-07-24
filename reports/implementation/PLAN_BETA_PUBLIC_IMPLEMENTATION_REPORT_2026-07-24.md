# PLAN_BETA_PUBLIC_IMPLEMENTATION_REPORT_2026-07-24.md

```yaml
report_id: TO-PLAN-BETA-PUBLIC-2026-07-24
status: LIVE_BETA_DEPLOYED_AND_VERIFIED
scope: PUBLIC_LOCAL_FIRST_TRAINING_PLAN_BETA
product: TrainOracle
service_provider: aaclub
canonical_spec_promotion: false
open_issue_closure: false
payment_activation: false
remote_coach_activation: false
```

## 1. 한 줄 상태

TrainOracle은 회원가입이나 기존 일지가 없는 사람도 최소 정보와 안전 확인을 거쳐 7일·9일·10일 훈련계획 후보 2개를 비교하고, 하나를 선택해 진행을 기록할 수 있는 로컬 우선 베타를 구현했다.

## 2. 사용자가 실제로 하는 일

1. 첫 화면에서 `훈련계획 후보 만들기`를 누른다.
2. 종목군, 경험, 가능한 훈련일, 계획 길이, 현재 안전 상태를 선택한다.
3. 안전 게이트가 허용한 경우 `균형형`과 `보수형` 후보를 비교한다.
4. 원하는 후보를 선택하고 각 세션의 완료·휴식·건너뜀·통증 상태를 기록한다.
5. 현재 계획이 끝나면 선택한 후보와 구조화된 진행 집계를 다음 계획의 연속성 입력으로 넘긴다.

일지가 없거나 적으면 `PROFILE_ONLY / LIMITED` 계획을 제공한다. 최근 14일에 유효한 훈련 후 일지가 2개 이상 있으면 `JOURNAL_CONTEXT_ONLY`로 표시한다. 이 표시는 일지의 존재만 알리며, 이번 베타 처방에는 일지 수치나 메모를 반영하지 않는다.

## 3. 구현된 계약

| 영역 | 구현 |
|---|---|
| 생성 입력 | 종목군, 경험대, 가용 훈련일, 7·9·10일 프레임, 구조화된 안전 확인 |
| 후보 | 결정론적 `BALANCED`, `CONSERVATIVE` 최대 2개 |
| 희소 데이터 | 정확한 페이스를 발명하지 않고 시간·RPE 범위만 사용 |
| 초보·저빈도 보호 | 첫날 품질훈련 금지, 품질 세션 최대 1회 |
| 안전 | 현재 확인 또는 최근 14일의 구조화 통증·분석 허용 메모가 `D9_ACTIVE`/`D9_UNKNOWN`이면 후보 및 숨은 세션을 생성하지 않음 |
| 선택 | 선택 순간 브라우저에 불변 계획 스냅샷 저장 |
| 진행 | 훈련일과 휴식일에 맞는 구조화 상태만 기록 |
| 연속성 | 이전 후보 종류와 완료·휴식·건너뜀·통증 집계만 다음 프레임에 전달 |
| 포인트 | 하루 첫 방문 +1P, 서로 다른 날짜의 적격 일지 +4P |
| 저장 | 계획, 진행, 포인트 모두 현재 브라우저와 기기에만 저장 |

## 4. 포인트 안전 경계

오라클 포인트는 사용자가 다시 들어와 자신을 기록하는 습관을 돕는 비경제적 로컬 표시다.

- 거리, 페이스, 훈련량, 고강도 세션, 계획 준수에는 포인트를 주지 않는다.
- 휴식일과 통증·부상 체크인도 일지 날짜로 인정한다.
- 쉬거나 계획을 중단하거나 통증을 기록해도 포인트를 빼지 않는다.
- 결제 가치, 순위표, 유료 우위, 서버 동기화는 없다.
- 계획 진행 상태를 누르는 행위 자체에는 포인트를 주지 않는다.

## 5. 안전·개인정보 경계

- `D9_CLEARED`는 의료적 허가가 아니라 현재 평가기에서 D9 위험 신호가 확인되지 않았다는 뜻뿐이다.
- 통증, 부상, 몸 이상이 있거나 답을 확정할 수 없으면 계획 생성을 차단하고 사람의 확인을 안내한다.
- 최근 일지의 통증 4~5 또는 분석 허용 메모의 차단 신호는 이후의 긍정 응답으로 해제되지 않는다.
- 좋은 일지, 템플릿, 보상, 사용자 선호로 기존 안전 차단을 해제하지 않는다.
- 메모 원문, 증상 문장, evidence clause는 계획·포인트·진행 이력에 저장하거나 전달하지 않는다.
- 프로필 전용 베타는 과거 훈련량, 페이스, 컨디션을 추정하지 않는다.

## 6. 로컬 검증

| 검증 | 결과 |
|---|---|
| Plan engine Vitest | 4 files, 36 PASS |
| App Vitest 전체 | 19 files, 114 PASS |
| App TypeScript | PASS |
| Plan engine TypeScript | PASS |
| Vite production build | PASS |
| 모바일 핵심 터치 시나리오 | 8 PASS |
| 전체 Playwright | 91 PASS / 환경별 의도된 21 SKIP |
| 공개 진입·안전 회귀 Playwright 재검증 | 17 PASS / 데스크톱 전용 3 SKIP |
| D9 evaluator runtime | 11 PASS |
| Work harness·formal foundation·Formation gate | 47 PASS + 4 validators PASS |
| 독립 코드·안전 리뷰 | APPROVE / blocker 0 |
| 독립 화면 QA | PASS |
| 독립 디자인 충실도 리뷰 | APPROVE / blocker 0 |
| 최종 통합 게이트 | PASS / MERGE_ELIGIBLE / blocker 0 |
| GitHub CI·공개 URL 검증 | PASS |

### 화면 증거

`.omo/evidence/plan-beta-2026-07-24/`에는 아래 14개 상태를 데스크톱 1330×900, 모바일 393×852, 좁은 모바일 320×568로 각각 캡처한 총 42개 PNG가 있다.

- 첫 방문
- 종목군 선택
- 경험 선택
- 가용 훈련일 선택
- 계획 길이 선택
- 안전 확인
- 안전 차단
- 후보 상단·중단·하단
- 활성 계획 상단·중단·하단
- 첫 방문 보조 선택

## 7. 정직한 베타 한계

- 서버 계정, 기기 간 동기화, 결제, 원격 코치 승인은 아직 없다.
- 종목군은 계획의 문맥과 표시에는 반영되지만, 이번 공통 베타 라이브러리는 종목별 정밀 처방 공식까지 제공하지 않는다.
- 최근 일지의 존재만 문맥으로 표시하며, 일지 수치와 메모는 이번 베타 처방 근거로 쓰지 않는다.
- 장기 부하 공식, 9.5일 정식 적응형 Formation, 코치 강제 선택 정책은 별도 수용·구현 증거가 필요하다.
- 이번 공개는 draft SPEC의 canonical 승격이나 기존 open issue 종결을 의미하지 않는다.

## 8. 배포 기록

```yaml
feature_branch: codex/plan-beta-mvp
pull_request: https://github.com/hojune0330/TRAINORACLE/pull/112
main_commit: 4b2f1098d3799f83874bd5ff4dc0420c7d23ebd4
github_actions: https://github.com/hojune0330/TRAINORACLE/actions/runs/30057331208
live_url: https://hojune0330.github.io/TRAINORACLE/
live_verification: "HTTP 200; 후보 2개 표시; 9일 계획 선택·진행 로컬 저장; 최근 통증 5 기록 차단; console error 0"
```

PR #112를 `main`에 병합한 뒤 GitHub Actions의 계약·앱 품질·브라우저·Pages 배포 작업이 모두 통과했다. 새 브라우저 상태에서 공개 URL을 열어 프로필 전용 후보 생성, 균형형 9일 계획 선택, 진행 1건 로컬 저장을 확인했다. 별도 브라우저에서는 최근 통증 5 일지를 넣은 뒤 긍정적인 현재 상태를 선택해도 계획이 차단되고 후보가 생성되지 않는 것을 확인했다.

[DRAFT_COMPLETE]
