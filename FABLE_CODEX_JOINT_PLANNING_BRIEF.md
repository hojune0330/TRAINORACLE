# FABLE_CODEX_JOINT_PLANNING_BRIEF.md

doc_id: FABLE_CODEX_JOINT_PLANNING_BRIEF
title: "TrainOracle 서비스화 및 훈련계획 코어 공동 기획 사전 브리프"
version: 0.2
status: JOINT_REVIEW_WORKING_BRIEF
owner: COACH_HOJUNE
contributors:
  - FABLE_PROJECT_LEAD_AI
  - CODEX
baseline_commit: 4f859467dc1d1b8d90cd48a02c8d8e523f1c9084
fable_response_commit: 4f859467dc1d1b8d90cd48a02c8d8e523f1c9084
updated: 2026-07-13 Asia/Seoul
canonical_promotion_allowed: false
runtime_evidence_claimed: false

---

## 0. 이 문서의 역할

이 문서는 Fable과 Codex가 TrainOracle의 다음 제품화 단계를 함께 결정하기 위한 공동 회의 자료다. Codex 사전안과 2026-07-13 Fable 1차 수용 답변을 함께 반영한다.

다음을 한곳에 모은다.

- 현재 웹 앱과 구현 코드의 실제 서비스화 수준
- 라이브 앱의 일지 작성·저장·재방문 UX 관찰
- 선수·코치·학부모·부상 선수·일지 전용 사용자 관점의 부족한 점
- `PLAN_GENERATOR_SPEC.md`가 실제 훈련계획 기능으로 사용되기 위해 필요한 연결부
- 소유자가 최종 결정해야 할 회의 안건과 Fable·Codex의 현재 합의점
- 결정 이후의 권장 실행 순서

이 문서는 SPEC 정본, 구현 완료 주장, runtime evidence, issue closure가 아니다. 수치는 진행률 관리값이 아니라 현재 코드와 문서를 대조한 기획용 범위 추정이다.

---

## 1. 확인 기준

작성 시점에 다음을 직접 확인했다.

- GitHub `origin/main`: `4f85946`
- 열린 PR: 0건
- 열린 작업 이슈: `#42`, `#21`
- 최신 Fable 지시: `CODEX_WORK_ORDER_008.md` amendment v3, `CODEX_WORK_ORDER_009.md` amendment v2
- 최신 Fable 기획: `SPEC_TAP_FIRST_LOGGING.md` v2, `PLAN_F0F_TASKR_HARDENING.md`
- 앱 코드: `app/`
- 안전 체인 구현: `impl/`
- Plan Generator 계약: `specs/active/PLAN_GENERATOR_SPEC.md`
- 일지·분석·계정·동기화 관련 reconstruct 문서
- 공개 앱: `https://hojune0330.github.io/TRAINORACLE/`

Fable은 PR #56에서 Codex의 데이터 신뢰성 발견을 코드로 독립 대조한 뒤 다음을 main에 반영했다.

- ORDER_008 Task A에 `data_provenance_contract` 추가
- 기존 스키마 필드는 유지하되 하위호환 선택 metadata 허용
- ORDER_009 Task A를 ORDER_008 Task A 병합 뒤 수행하도록 순서 고정
- F0-f-9 `무언의 기본값 제거` 추가
- 계정·코치 연결 후 계획 제공과 좁은 결정론적 계획 MVP에 동의 권고

브라우저 관찰은 2026-07-13에 375x667 모바일 viewport와 새 로컬 저장 상태로 수행했다. 이 관찰은 제품 기획용 수동 QA이며 D9 evaluator나 Plan Generator runtime evidence가 아니다.

---

## 2. 현재 서비스화 수준

### 2.1 한 줄 판정

TrainOracle은 현재 **사용 가능한 로컬 우선 훈련 일지 초기 베타**다. 핵심 가치인 근거 기반 분석·코칭·훈련계획 서비스는 아직 제품 흐름으로 연결되지 않았다.

### 2.2 영역별 기획 추정

| 영역 | 현재 준비도 범위 | 확인된 상태 |
|---|---:|---|
| 일지·PWA | 60~70% | 작성, 로컬 저장, 조회, 삭제, 내보내기, 기초 추이 제공 |
| 안전 체인 | 35~45% | D9 evaluator, RVE signal, Safety Gate 골격 존재. 일지 저장 흐름과 미연결 |
| 훈련 분석 | 15~25% | 주간 거리·RPE, 기분, 통증의 단순 집계 중심 |
| 훈련계획 | 5~10% | 계약 문서는 상세하지만 실행기는 `PLAN_GENERATOR_STUB` |
| 계정·동기화 | 5~10% | 계약과 기획만 존재. backend/account runtime 없음 |
| 전체 코칭 서비스 | 약 25~30% | 일지 베타이며 아직 훈련설계 서비스로 부를 단계는 아님 |

이 범위는 문서 개수보다 사용자에게 실제로 전달되는 기능을 기준으로 잡았다.

---

## 3. 라이브 일지 UX 관찰

### 3.1 잘 된 부분

- 첫 방문 화면은 차분하고 시작 목적이 명확하다.
- 로컬 저장임을 사용자에게 비교적 정직하게 알린다.
- 훈련 후, 하루 마무리, 경기 일지를 분리한 구조는 이해하기 쉽다.
- 최근 일지와 간단한 주간 요약은 재방문 이유를 만든다.
- Fable의 tap-first v2 방향인 한 화면 한 맥락, 잉크 스택, 전환 예산은 현재 긴 폼보다 적합하다.

### 3.2 직접 재현된 데이터 신뢰성 문제

아무 항목도 의도적으로 선택하지 않고 저장했을 때 다음 값이 저장됐다.

| 일지 종류 | 사용자가 명시하지 않았지만 저장된 값 | 사용자 화면 영향 |
|---|---|---|
| 훈련 후 | `system=base`, `rpe=5` | 빈 훈련이 세션 1건과 RPE 평균 5로 집계됨 |
| 하루 마무리 | `sleepH=7`, `sleepQuality=3`, `mood=3` | 수면 7시간·기분 3/5가 실제 응답처럼 표시됨 |

콘솔 오류나 저장 실패는 없었다. 따라서 사용자는 이 값을 시스템 기본값이 아니라 자신의 기록으로 받아들일 가능성이 높다.

이 문제는 단순 폼 UX가 아니다. 훈련계획이 일지를 근거로 삼을 때 **응답하지 않은 기본값이 선수 상태와 부하 결정에 들어갈 수 있는 입력 오염**이다.

Fable은 이 사실을 `LogEntry.tsx`와 `aggregates.ts`에서 독립 확인하고 PR #56으로 ORDER_008 v3와 F0-f-9에 반영했다. 문서 수용은 완료됐지만 앱 수정과 라이브 재검증은 아직 별도 실행·증거가 필요하다.

### 3.3 UX 원칙 제안

모든 코칭 입력은 다음 provenance를 가져야 한다.

| 상태 | 의미 | 분석·계획 사용 |
|---|---|---|
| `EXPLICIT` | 사용자가 직접 탭하거나 입력함 | 조건 충족 시 사용 가능 |
| `DERIVED` | 명시 입력으로 계산됨 | 계산 근거와 함께 사용 가능 |
| `IMPORTED` | 신뢰 가능한 외부 소스에서 들어옴 | source trust 통과 후 사용 가능 |
| `MISSING` | 답하지 않음 | 기본값으로 대체 금지 |
| `DEMO` | 예시·시드 데이터 | 실제 분석·계획에서 항상 제외 |

부분 일지는 계속 저장할 수 있어야 한다. 대신 `analysisEligibility` 또는 동등한 판정을 통해 불완전 기록을 개인 일지에는 보여주되 훈련 분석·계획 근거에서는 제외해야 한다.

---

## 4. 사용자 관점

### 4.1 학생 선수

- 빠른 기록과 시각적 축적은 재방문에 도움이 된다.
- 현재 상세 폼은 실제 1분 기록 약속보다 길다.
- 입력하지 않은 값이 기록되면 앱 전체의 신뢰를 잃는다.
- 저장 직후 다음 행동은 짧고 구체적이어야 한다. 예: 기록 완료, 추가 확인 필요, 코치 검토 대기.

### 4.2 부상·통증이 있는 선수

- 통증 부위와 강도 기록은 좋은 시작점이다.
- 현재 안내는 실제 Safety Gate 연결보다 앞서 있어 계획이 정말 차단된 것처럼 오해시킬 수 있다.
- 앱 연결 전에는 `검토가 필요해요` 수준으로 말하고, 실제 gate가 연결된 뒤에만 차단·보류 상태를 단정해야 한다.

### 4.3 코치

코치에게 필요한 것은 일지 원문 목록보다 다음이다.

- 입력 완성도와 신뢰 상태
- 계획 대비 실제 수행 차이
- 통증·회복·훈련 누락의 검토 대기 목록
- 2~3개 계획 후보와 후보별 근거·제약·불확실성
- 선택한 계획과 이후 수정 이력

현재 앱에는 전용 코치 검토 흐름과 계획 선택 화면이 없다.

### 4.4 학부모·미성년자

- 민감정보 사용 동의와 공유 범위를 알아야 한다.
- 개인 메모가 JSON 내보내기나 동기화에 포함되는지 명확해야 한다.
- 보호자 권한이 코칭 권한이나 의료 판단 권한으로 확대되어서는 안 된다.

### 4.5 일지만 쓰는 사용자

- 계정·코치·훈련계획 연결 없이도 일지를 계속 사용할 수 있어야 한다.
- 스트릭은 훈련량이 아니라 기록 습관을 보상해야 한다.
- 휴식일·부상일·훈련하지 않은 날의 기록도 동일하게 인정해야 한다.

### 4.6 복귀 사용자

단순 추이는 `무엇이 있었나`를 보여준다. TrainOracle의 차별점은 여기에 다음을 더하는 것이다.

- 지금 확실히 아는 것
- 아직 부족하거나 오래된 정보
- 안전 검토가 필요한 이유
- 오늘 기록 후 사용자가 할 다음 행동

---

## 5. 훈련계획 스펙 사용 가능성

### 5.1 강한 부분

`PLAN_GENERATOR_SPEC.md`는 다음 거버넌스와 안전 경계를 비교적 잘 정의한다.

- `D9_ACTIVE`와 `D9_UNKNOWN`의 계획 생성 차단
- 좋은 physio 데이터나 템플릿 선택을 안전 clearance로 사용하지 않음
- tenant/group/athlete 격리
- capability, consent, 미성년자·보호자 guard
- 2~3개의 계획 옵션 생성과 자동 선택 금지
- scoped coach의 명시적 선택
- source ref, audit ref, privacy 경계

### 5.2 실제 사용을 막는 빈 연결부

다음은 아직 계약 또는 구현이 충분하지 않다.

1. 어떤 일지·프로필·세션 데이터를 계획 근거로 인정하는가
2. 최소한 어느 정도의 evidence가 있어야 계획을 생성하는가
3. 목표·훈련 이력·회복·통증을 세션 처방으로 변환하는 정책은 무엇인가
4. 강도, 빈도, 부하, 회복, taper를 어떤 규칙으로 조절하는가
5. 9.5일 방법론을 7일 달력과 개별 선수 일정에 어떻게 적용하는가
6. 계획과 실제 수행이 달랐을 때 언제 수정하는가
7. 계획 버전, 수정 이유, 승인, rollback을 어떻게 기록하는가
8. 앱의 익명·로컬 사용자와 coach-selection 필수 계약을 어떻게 연결하는가

현재 `impl/src/plan-generator/generator.ts`는 `PLAN_GENERATOR_STUB`만 반환한다. 앱에도 계획, coach selection, rationale, planned-versus-completed 화면이 없다.

### 5.3 제품 모델의 중요한 충돌

현재 공개 앱은 익명·로컬·선수 중심이다. 반면 Plan Generator 계약은 scoped coach 선택을 필수로 한다.

권장 v1 경계는 다음과 같다.

- 익명 또는 미연결 사용자: 일지와 비처방적 관찰만 사용
- 계정은 있으나 코치 미연결: 개인 분석과 `정보 부족/검토 필요` 안내만 사용
- 코치가 연결되고 동의·권한·안전 gate가 충족됨: 계획 후보 생성과 코치 선택 허용
- 선수 직접 자동 처방이 필요하다면 기존 Plan Generator를 우회하지 말고 별도 advisory 정책을 설계

---

## 6. 권장 핵심 제품 루프

1. 사용자가 빠른 일지 또는 상세 일지를 작성한다.
2. 입력을 `EXPLICIT`, `DERIVED`, `IMPORTED`, `MISSING`, `DEMO`로 구분한다.
3. 개인 메모와 구조화 코칭 데이터를 분리한다.
4. 구조화 신호와 transient free text를 D9 안전 평가 경로에 보낸다.
5. 앱은 `아는 것 / 부족한 것 / 검토가 필요한 것`을 설명한다.
6. minimum evidence와 Safety Gate를 통과한 경우에만 7~10일 계획 후보 2~3개를 만든다.
7. 권한 있는 코치가 후보를 선택하고 RULE_SPEC 검증을 요청한다.
8. 선택된 계획을 달력에 표시한다.
9. 이후 일지에서 planned-versus-completed를 비교한다.
10. 차이가 임계값을 넘으면 기존 계획을 덮어쓰지 않고 새 버전의 조정안을 만든다.

---

## 7. 문서화 전략

문서 수 자체를 늘리는 것이 목적이 아니다. 기존 소유권이 명확한 문서는 패치하고, 정말 별도 책임이 필요한 계약만 만든다.

### 7.1 기존 문서에 합쳐야 할 내용

- `DAILY_LOG_AND_CHECKIN_SPEC.md`
  - tap-first quick log
  - memo transient D9 assessment
  - provenance와 completeness
  - analysis/plan eligibility
- `PLAN_GENERATOR_SPEC.md`
  - minimum evidence set
  - 입력 자격 실패 상태
  - coach-connected product boundary
  - 첫 수직 슬라이스 범위
- `APP_IMPLEMENTATION_BRIDGE.md`
  - 개인 일지 저장소와 코칭 분석 저장소의 물리적·타입 경계
  - plan version과 planned-versus-completed 참조

### 7.2 별도 계약 후보

필요성이 확인될 경우에만 다음 두 문서를 만든다.

1. `TRAINING_DATA_PROVENANCE_AND_ELIGIBILITY_SPEC.md`
   - 입력 출처, completeness, freshness, conflict, 분석·계획 사용 가능 여부
2. `TRAINING_PLAN_FORMATION_AND_ADAPTATION_SPEC.md`
   - 실제 처방 정책, 후보 차이, progression, recovery, taper, 계획 버전·조정·rollback

Fable 답변에서 기존 문서 안에 충분히 수용 가능하다고 판단되면 새 문서 대신 target patch로 축소한다.

---

## 8. 공동 회의 결정 안건

### D1. 계획 기능 사용자 (Fable PLAN의 D5와 대응)

권장안: v1 계획은 **코치 연결 사용자만**, 미연결 사용자는 일지와 비처방적 분석만 제공한다.

Fable 1차 의견: 동의 권고. 익명 사용자는 일지 전용으로 두고 `PLAN_GENERATOR_SPEC.md`의 coach selection 원칙을 유지한다.

결정할 것:

- 코치 연결 전 허용할 분석 범위
- 선수 단독 advisory가 필요한지
- coach selection 필수 계약을 유지할지

### D2. 데이터 진실성

권장안: explicit/derived/imported/missing/demo provenance와 analysis eligibility를 필수 계약으로 둔다.

Fable 1차 의견: 핵심 제안을 수용해 ORDER_008 Task A에 `EXPLICIT / DERIVED / MISSING`과 하위호환 metadata 계약을 추가했다. `IMPORTED / DEMO`의 최종 범위와 실제 필드명은 후속 결정 대상이다.

결정할 것:

- backward-compatible metadata를 현재 `JournalEntry`에 붙일지
- 별도 ingestion envelope을 만들지
- 부분 일지의 분석 제외 기준

### D3. 개인 메모 정책

권장안:

- 원문 개인 메모는 로컬 전용 개인 일지 영역에 저장
- 분석·감사·계획에는 원문을 저장하지 않음
- D9는 transient 처리하고 disposition과 비민감 reason code만 보존
- JSON export는 메모 제외가 기본이며 명시적 opt-in 제공
- 서버 동기화는 별도 동의·암호화·보존 정책 전까지 금지

Fable 1차 의견: export는 메모 제외 기본, 메모는 당분간 기기 전용 유지 권고. 종단암호화 백업은 backend 착수 때 다시 논의한다.

### D4. 첫 훈련계획 MVP (Fable PLAN의 D6과 대응)

권장안:

- 한 종목 또는 한 선수 유형
- 7~10일 planning window
- 보수적·균형·회복 중심의 2~3개 후보
- deterministic rule engine
- 코치 선택
- privacy-safe rationale
- 계획 대비 실제 수행과 계획 버전 1회 조정까지

미승인 metric 수식과 자유형 외부 LLM은 사용하지 않는다.

Fable 1차 의견: 범위에 동의 권고. 단 F0-f-9와 provenance 계약으로 데이터 신뢰성을 먼저 확보한 뒤 착수한다.

### D5. 작업 순서와 소유권

권장안:

- Fable: 앱 UX, tap-first, F0-f hardening, 시각·상호작용 구현
- Codex: SPEC target patch, 입력 자격 계약, plan formation/adaptation 계약, contract test와 impl 수직 슬라이스
- 공동: acceptance criteria, 실제 모바일 QA, 안전·프라이버시 gate, 계획 결과의 코칭 타당성 검토
- Coach Hojune: D1~D5 최종 결정과 훈련 처방 정책 승인

Fable 1차 의견: `app/` 구현은 Fable/총책임자 영역으로 유지하고 Codex는 계약·테스트·구현 골격을 담당하는 현재 경계를 유지한다.

---

## 9. 권장 실행 순서

### Phase 0. 현재 앱 신뢰성 고정

- F0-f hardening 완료
- 앱 CI에 typecheck와 build 추가
- 빈 저장과 implicit default가 분석값이 되지 않도록 수정
- export·memo·load validation·a11y·race state 정리

### Phase 1. Daily Log 입력 계약 통합

- ORDER_008 Task A와 ORDER_009 Task A의 같은 파일 패치를 엄격한 순서로 적용하거나 하나의 vNext patch로 통합
- tap-first, transient D9, provenance, completeness, eligibility를 함께 검증
- ORDER_008의 `schema additions forbidden` 규칙은 데이터 진실성용 호환 metadata까지 막지 않도록 재검토

### Phase 2. 훈련설계 코어 계약

- minimum evidence set 확정
- 첫 종목·선수 범위 확정
- deterministic formation/adaptation 정책 작성
- coach review, plan version, rollback, rationale 경계 확정

### Phase 3. 첫 end-to-end 수직 슬라이스

- 일지 입력
- 데이터 자격 판정
- D9 -> RVE -> Safety Gate
- 계획 후보 2~3개
- 코치 선택
- RULE_SPEC 재검증
- 달력 표시
- planned-versus-completed
- plan adjustment v2

### Phase 4. 계정·동기화 연결

- v1 수직 슬라이스의 데이터 경계가 안정된 뒤 backend와 SSO를 연결
- 로컬 개인 메모와 서버 코칭 데이터의 승격 정책을 분리
- 계정 연결은 identity를 제공할 뿐 코칭·안전 권한을 자동 부여하지 않음

---

## 10. Fable·Codex 1차 합의표

PR #56의 Fable 1차 답변을 Codex 사전안과 대조한 결과다.

| 항목 | Codex 사전안 | Fable 의견 | 공통점 | 충돌 | Coach Hojune 결정 |
|---|---|---|---|---|---|
| D1 계획 사용자 | 코치 연결 후 계획 | 동의 권고 | 익명은 일지 전용 | 코치 없는 advisory 범위 | PENDING |
| D2 데이터 진실성 | provenance·eligibility 필수 | ORDER_008 v3로 수용 | implicit default 분석 제외 | metadata 이름·legacy·IMPORTED/DEMO 범위 | PENDING |
| D3 메모 정책 | 로컬 원문 분리, export 제외 기본 | 같은 방향 권고 | 분석·감사에 원문 금지 | 암호화 백업 재론 시점 | PENDING |
| D4 계획 MVP | 한 종목·7~10일·결정론적 후보 2~3개 | 동의 권고 | 데이터 신뢰성 확보 후 착수 | 첫 종목·선수 유형·처방 규칙 | PENDING |
| D5 순서·소유권 | Fable 앱, Codex 계약·수직 슬라이스 | 현재 경계 유지 | ORDER_008 A -> ORDER_009 A 순서 | 수직 슬라이스의 `app/` 연결 담당 | PENDING |

합의되지 않은 항목을 구현 지시로 바꾸지 않는다. 합의 후에는 이 브리프를 결정 로그로 바꾸기보다 별도의 decision-complete 실행 계획과 Work Order를 만든다.

---

## 11. 유지할 가드레일

- 로컬과 GitHub에 실제 존재하는 파일만 파일 존재 근거로 사용한다.
- markdown self-check를 runtime evidence로 취급하지 않는다.
- `D9_ACTIVE`와 `D9_UNKNOWN`은 계획 생성을 차단한다.
- `D9_CLEARED`는 의료적 clearance가 아니다.
- ADVISORY는 네 번째 disposition이 아니다.
- 좋은 physio 데이터와 템플릿은 D9 risk를 해제할 수 없다.
- raw memo, symptom clause, private note는 audit·plan rationale에 저장하지 않는다.
- 훈련량 보상형 gamification을 만들지 않는다.
- 미승인 metric 수식을 실제 계획 부하 계산에 사용하지 않는다.
- 코치의 final selection 계약을 제품 결정 없이 우회하지 않는다.
- 현재 open issue를 이 기획 문서만으로 닫지 않는다.

---

## 12. 다음 실행점

1. PR #56에 반영된 Fable 1차 답변을 공동 기준선으로 사용한다.
2. Coach Hojune이 D1~D5의 남은 PENDING 항목을 결정한다.
3. ORDER_008 v3와 ORDER_009 v2 산출물을 먼저 완성한다.
4. 결정된 훈련계획 MVP 범위만 대상으로 실행 가능한 단일 계획과 다음 Work Order를 만든다.

[DRAFT_COMPLETE]
