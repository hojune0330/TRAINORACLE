# TRAINING_PLAN_PARALLEL_DEVELOPMENT_ORDER_2026-09-20.md

## 0. 실행 승인과 배포 경계

```yaml
doc_id: TO-PLAN-PARALLEL-20260920
version: "1.0"
status: OWNER_APPROVED_DEVELOPMENT_IN_PROGRESS
base_main: f0d055810d92e71f5219aaef915120da6eba3f7a
integrator_thread: 019ef850-bb65-7082-ad74-7dc718b3f8e8
product_thread: 01a0ba67-0611-7232-bbf2-78aebdfa52cc
merge_authorized: false
deployment_authorized: false
canonical_promotion: false
```

오너의 최신 지시: 권장 순서대로 양쪽 병렬 개발을 실행한다. 개발 완료를 오너가 확인한 후에만 병합한다. 과거 main 직접 작업 지침이나 기존 계획의 자동 병합·배포 단계보다 이 지시가 우선한다. PR 생성·검수는 허용하되 main 병합, auto-merge, 운영 DB 변경, 배포는 하지 않는다.

## 1. 보존 원본과 적용 순서

- [제품 원문 A](./TRAINORACLE_INSTANT_PLAN_AND_CREATOR_PROGRAM_PLAN_2026-09-20.md)
- [UX 수정 검토 B](./TRAINORACLE_INSTANT_PLAN_UX_UI_CRITICAL_REVIEW_2026-09-20.md)
- [기존 흐름 개선 C](./TRAINING_PLAN_CREATION_UX_AND_PRESCRIPTION_REBUILD_PLAN_2026-09-20.md)
- [통합·중복 해소 D](./TRAINING_PLAN_CROSS_SESSION_INTEGRATION_REVIEW_2026-09-20.md)

A/B는 상위 폴더에서 원문 그대로 가져왔다. 각 SHA-256은 D의 보존 해시와 일치한다. 원문의 과거 파일 위치·개발 미착수 표현은 당시 기록이다. 현재 실행 상태는 이 지시서와 후속 보고서가 관리한다. 원문을 축약하거나 과거 실행 증거로 덮어쓰지 않는다. 저장소 내 탐색은 위 링크를 사용한다.

B가 수정한 UX와 D의 파일 담당을 적용한다. 기본 흐름은 최소 구조화 입력, 누락 사실만 확인, 추천 하나와 일정 확인, 명시적 시작, 오늘 수행이다. Q1~Q13은 조건부 질문 모음이며 13단계 강제 설문이 아니다. A/B 비교는 선택 기능이다.

## 2. 공통 최소 계약

`app/src/domain/instant-plan-contract.ts`가 C1/C2/C5의 표시 경계다. 기존 생성·안전·계정 저장 계약을 대체하지 않는다.

- `CURRENT_RECORD`는 달성일을 직접 받는다. `GOAL_ONLY`는 달성일과 현재 능력을 발명하지 않는다. `NO_RECORD`도 명시적으로 지원한다.
- 초는 유한한 양수, 종목은 기존 지원 종목, 실제 기록일은 유효하고 미래가 아니어야 한다. UI와 통합 어댑터 양쪽 경계에서 검증한다.
- 추천의 날짜·세션·시간은 실제 후보에서 투영한다. 배열 첫 항목이란 이유로 추천하지 않는다.
- `SAVING/PENDING/FAILED/BLOCKED`는 시작 완료가 아니다. 성공은 기존 계정 저장 결과만 결정한다.
- 제작자 원본은 P가 별도 계약을 정의하고 I가 개인 계획에 연결한다. 원본 ID와 개인 계획 ID는 같지 않다.
- 컴포넌트는 props와 콜백만 사용한다. 자체 엔진, 직접 localStorage 쓰기, 별도 오늘 상태, 외부 AI 호출을 만들지 않는다.

## 3. I: 통합·코어 담당

전용 브랜치 `codex/plan-integration-20260920`. 기존 앱·엔진·계정·스키마·SQL·공통 CSS·라우트·패키지는 I 단일 작성이다.

1. 실제 배치와 원장의 MAIN 의미를 재현하고 감사한다. 확인된 오류만 수정하고 품질훈련 3회 같은 새 정책을 자동 채택하지 않는다.
2. 가능일 질문의 주간/계획기간 혼동을 고치고 기존 저장 계획 의미는 유지한다.
3. 후보를 접어도 실제 날짜와 MAIN/BASE/REC/OFF 미리보기는 남긴다. 추상 제목 대신 실제 차이를 표시한다.
4. 기존 보관과 삭제를 구분한다. 계정 원본·revision·지연 쓰기 방어·일지 보존·복구 경로를 확인한 후 삭제를 구현한다. 서버 확인 없는 삭제 완료 문구는 금지한다.
5. P의 화면을 기존 intake/generator/pace/account/today/journal 흐름에 연결한다. 공유 파일을 P에게 다시 맡기지 않는다.
6. 통합 테스트와 완료/미완료 표를 유지하고 PR을 오너 확인 대기로 둔다.

## 4. P: 간편 제품·제작자 담당

전용 브랜치 `codex/instant-plan-product-20260920`. 공통 준비 커밋에서 시작한다.

배타적 작성 경로:

- `app/src/components/instant-plan/`: `InstantPlanEntryForm.tsx`, `InstantPlanRecommendationView.tsx`, `InstantPlanTodayView.tsx`, `CreatorProgramPicker.tsx`, 전용 CSS와 단위 테스트.
- `app/src/domain/creator-program/`: 원본 타입·검증·정적 레지스트리·권한/철회 판정 및 테스트.
- `specs/reconstruct/CREATOR_PROGRAM_REUSE_CONTRACT.md`.
- `reports/implementation/INSTANT_PLAN_PRODUCT_IMPLEMENTATION_2026-09-20.md`.

그 외 파일은 읽기만 한다. 필요한 기존 연결·공통 타입 변경은 I에게 요청한다. 전역 스타일, AppShell, PlanBeta, plan-beta 기존 화면, 엔진, 계정 저장, SQL, package.json을 수정하지 않는다.

실제 개발 항목:

1. 현재 기록/목표만/기록 없이를 구분하는 작은 구조화 입력. 종목·분·초·달성일, 잘못된 초와 미래 날짜 처리. 허용 기록/목표 값만 콜백에 전달하고 저장하지 않는다.
2. 추천 하나의 기간·횟수·부담·첫 훈련·미니 일정을 기본 표시. 다른 계획은 선택 기능. 시작 버튼은 저장 상태와 연결한다.
3. 오늘 수행은 오전/오후와 준비/본운동/회복/정리를 읽기만 해도 알 수 있게 한다. 미기록을 미수행으로 단정하지 않는다.
4. 공개 프로그램은 버전·원본·권한·허용 변환·대상·목표-only 변형·철회/리콜을 구조화한다. 권한 없는 유명 선수 프로그램을 발명하지 않는다. 실제 승인 원본을 찾지 못하면 레지스트리는 비워 두고 정확한 공급 차단 사유를 보고한다. 테스트 fixture는 상품으로 노출하지 않는다.
5. 해당 계약을 통한 4경로 검수: 일반/제작자 각각 현재 기록/목표-only. 승인 원본 부족은 미완료로 남기며 전체 완성을 주장하지 않는다.
6. 기존 토큰·44px 조작·320/375px·200% 글자·키보드·줄인 모션을 준수. 그림자·왼쪽 색띠·중첩 카드·새 디자인 시스템 금지.

## 5. 검수와 병합 대기

각 담당은 변경 경로에 맞는 단위/계약 검사를 수행한다. I는 연결 후 통합·브라우저 검사를 맡는다. 동일 전체 브라우저 검사 중복 실행은 피한다. 결함 주입은 실제 실패 확인을 남긴다.

공통 준비 커밋 이후 두 브랜치는 파일 경계로 분리한다. P의 커밋을 I의 통합 작업 브랜치에 반영하는 것은 미출시 통합 검수이며 main 병합이 아니다. 이 경우 원본 커밋·통합 커밋·PR 관계를 보고한다. main을 변경하거나 배포하지 않는다.

각 PR에는 제품 원문, 소유 파일, 실제 실행 증거, 남은 공급/서버 적용/UX 검수, `OWNER_REVIEW_REQUIRED_BEFORE_MERGE`를 명시한다. 미실행 CI나 로컬 테스트 성공을 공개 서비스 검증으로 표시하지 않는다.

## 6. 완료를 세는 단위

| 단위 | 시작 상태 | 완료 증거 |
|---|---|---|
| U0 원문/계약/분업 | IN_PROGRESS | 보존 해시·공통 커밋·양쪽 수신 |
| U1 프로그램 공급 | NOT_STARTED | 허용 원본·버전·목표-only 근거. 없으면 BLOCKED_SOURCE |
| U2 간편 입력/추천 | NOT_STARTED | 실제 연결된 최소 입력→일정→선택 |
| U3 저장/삭제/배치 | NOT_STARTED | 계정 경합·삭제/복구·原 기록 보존 검사 |
| U4 오늘/일지/복귀 | NOT_STARTED | 오전/오후·휴식·종료·실패 통합 검사 |
| U5 검수/배포 | NOT_STARTED | 개발 검수까지 실행. 병합·배포는 오너 확인까지 WAITING_OWNER |

[DRAFT_COMPLETE]
