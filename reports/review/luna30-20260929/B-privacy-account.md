# 담당 B 독립 검수: 프라이버시·계정·중복 자료

## 범위와 판정 기준

- 검수 범위: P06 비밀 메모만 수정, P07 메모 목적 전환, P08 워치 자료 대기, P09 동일 운동 일지 중복, P10 같은 기기 로그아웃·계정 전환.
- 현재 dirty 작업도 읽기 검수 범위에 포함했다. 제품 코드, 기존 테스트, 스펙, 설정은 수정하지 않았다.
- `CONFIRMED_RUNTIME`: 없음. 지정된 로컬 미리보기의 브라우저 실행 및 실제 계정 인증 흐름은 수행하지 않았다.
- `CONFIRMED_CODE`: 제한된 합성 자료 단위검사에서 확인한 동작과 소스 제어 흐름에만 사용한다.
- `SUSPICION`: 없음. 재현되지 않은 우려를 결함으로 올리지 않았다.
- `NO_FINDING`: 이 범위에서 확인한 코드와 실행 검사로 결함을 확인하지 못했다는 뜻이며, 전체 보증은 아니다.
- `NOT_TESTED`: 실제 브라우저, 실제 인증 제공자/RLS, 기기 간 동기화 등 이 검수에서 실행하지 않은 경로.

## 검사 방법

독립 원문으로 `AGENTS.md`, `PRODUCT_NORTH_STAR.md` 및 담당 범위의 일지 프라이버시, 계정 식별·저장, 계획-일지 연결, 실행 검토 계약을 확인했다. 계약 문서 중 검토 중/초안 상태인 항목을 승인된 정책이나 런타임 증거로 간주하지 않았다.

실행한 범위 한정 검사:

```powershell
npm --prefix '.\TRAINORACLE-oracle-exploration-20260921\app' run test:unit -- src/domain/plan-execution-review.test.ts src/screens/home/HomeCoachingSummary.test.tsx src/domain/account/local-journal-isolation.contract.test.ts src/domain/journal-private-read-scope.test.ts src/domain/journal-store.contract.test.ts
```

결과: Vitest 5개 파일, 60개 테스트 통과(3.99초). 합성 입력을 사용하는 JSDOM/단위 검사다. 지정된 `http://127.0.0.1:4194/?app=1` 미리보기는 열지 않았으며 실제 브라우저 동작을 확인한 결과가 아니다. 전체 테스트 스위트는 실행하지 않았다.

## 요약

| 페르소나 | 판정 | 요약 |
|---|---|---|
| P06 | `NO_FINDING` / `CONFIRMED_CODE` | 비밀 메모 단독 변경은 사실 투영 결과에 들어가지 않는 경로와 합성 회귀 검사를 확인했다. |
| P07 | `NO_FINDING` / `CONFIRMED_CODE`; 목적 전환 자체는 `NOT_TESTED` | 사실 투영은 목적/메모 필드를 읽지 않는다. PRIVATE↔ANALYZABLE 전환 UI의 실제 흐름은 실행하지 않았다. |
| P08 | `CONFIRMED_CODE` 결함 P2; 브라우저 재현 `NOT_TESTED` | 워치 자료 대기 상태가 기본 요약에서 숨고, 축약 이유 영역 안에서만 드러난다. |
| P09 | `NO_FINDING` / `CONFIRMED_CODE` | 동일 계획 세션 연결의 중복을 두 일지 모두 충돌로 표시하는 합성 검사를 실행했다. |
| P10 | `NO_FINDING` / `CONFIRMED_CODE`; 실제 인증 경계는 `NOT_TESTED` | 합성 계정 전환/로그아웃 범위 분리와 불완전 읽기 처리를 확인했다. 실제 인증·서버 RLS는 검증하지 않았다. |

## 발견 사항

### P2 — 워치 자료 대기가 기본 요약에서 보이지 않음

**상태:** `CONFIRMED_CODE` — 소스 경로로 확인. UI 동작을 실제 브라우저에서 실행하지 않았으므로 `CONFIRMED_RUNTIME` 아님.

**전제:** 정확히 연결된 계획 세션의 완료 일지가 있고, 일지의 구조화된 운동 정보는 유효하나 `objectiveDataState`가 `WAITING`인 경우다.

**정상 경로:** `reviewPlanExecution`은 [`plan-execution-review.ts:100`](../../../../app/src/domain/plan-execution-review.ts)에서 워치 등 추가 운동 자료 대기 문구를 `unknowns`에 추가한다. 요약 본문은 [`ExecutionReview.tsx:33`](../../../../app/src/screens/plan-review/ExecutionReview.tsx)부터 요약·일부 지표·다음 안내를 렌더링한다. 일반 완료 일지의 다음 안내는 [`plan-execution-review.ts:123`](../../../../app/src/domain/plan-execution-review.ts)의 “더 남길 내용이 없다면 여기서 마쳐도 돼요.”다.

**공격/실패 경로:** 사용자가 기본 `요약` 화면만 읽으면 대기 상태는 표시되지 않는다. 해당 문구는 `이유` 보기의 [`ExecutionReview.tsx:55`](../../../../app/src/screens/plan-review/ExecutionReview.tsx) 이하 `details` 안에만 렌더링되며, `<details>`는 기본 접힘이다. 화면의 요약만 보면 자료가 아직 도착하지 않았다는 사실을 놓친 채 검토를 마칠 수 있다.

**결과:** 대기 정보가 사실 투영 모델에는 있지만 첫 읽기 요약에는 노출되지 않는 표시 누락이다. 계획 변경 또는 안전 판단 실행으로 확대 해석하지 않았다.

**정적 재현 절차(브라우저 미실행):**

1. 합성 계획과 오늘 날짜의 정확히 연결된 `PostSessionEntry`를 준비한다. `activityOutcome: "COMPLETED"`, `objectiveDataState: "WAITING"`으로 둔다.
2. 저장소 읽기 상태를 완료로 두고 `collectExecutionReviews`에 해당 일지를 전달한다. 결과 `unknowns`에 워치 대기 문구가 포함되는지 확인한다.
3. `ExecutionReviewReader`의 기본 요약 렌더 경로를 따라가면 요약/다음 안내에 그 문구가 전달되지 않고, `이유` 보기의 접힌 `details` 영역에서만 렌더링됨을 확인한다.
4. 이 검수에서는 실제 UI를 열어 3단계를 브라우저로 재현하지 않았다(`NOT_TESTED`).

**구체적인 수정 방향(수정하지 않음):** 자료 대기를 요약 보기에서 축약을 열지 않아도 인지 가능한 상태로 전달하고, 대기 중일 때는 완료를 암시하는 다음 안내와 구별되게 한다. 재계획 엔진이나 새 수치 기준을 추가할 근거는 이번 검수에서 확인되지 않았다.

## 페르소나별 기록

### P06 — 비밀 메모만 수정하는 사용자

- **전제:** 계획·구조화된 운동값·일지 연결은 그대로이고 개인 메모 텍스트만 바뀐다.
- **정상 경로:** 사실 투영 함수는 메모/제목/운동명/가져온 원문을 읽지 않는다는 주석과 구현이 [`plan-execution-review.ts:36`](../../../../app/src/domain/plan-execution-review.ts)에 있다.
- **공격 경로:** 비밀 메모를 새 민감 문구로 바꾸고 계획 검토 출력에 차이가 생기는지 검사한다. 테스트 [`plan-execution-review.test.ts:95`](../../../../app/src/domain/plan-execution-review.test.ts)의 메모 단독 수정 회귀 사례가 합성 PRIVATE 메모 변경 전후 결과를 비교한다.
- **결과:** `NO_FINDING` / `CONFIRMED_CODE`. 해당 합성 검사는 위 제한 실행에서 수행됐다. 이는 실제 저장·암호화·계정 경계의 런타임 검증은 아니다.
- **재현:** 위 Vitest 명령을 실행한 뒤 `plan-execution-review.test.ts`의 “private memo-only edits” 사례를 실행한다. 결과 비교는 테스트가 수행하며 실제 개인 텍스트를 사용하지 않는다.

### P07 — 분석용/비밀 메모 목적을 전환하는 사용자

- **전제:** PRIVATE_SELF_ONLY와 ANALYZABLE 목적을 사용자가 선택한다.
- **정상 경로:** 일지 규격은 PRIVATE 메모의 분석 신호 제외 및 로컬 저장 후 처리 종료를 [`DAILY_LOG_AND_CHECKIN_SPEC.md:692`](../../../../specs/reconstruct/DAILY_LOG_AND_CHECKIN_SPEC.md), [`:703`](../../../../specs/reconstruct/DAILY_LOG_AND_CHECKIN_SPEC.md), [`:705`](../../../../specs/reconstruct/DAILY_LOG_AND_CHECKIN_SPEC.md)에 둔다. ANALYZABLE은 명시적인 현재 일지 목적이어야 하며([`:707`](../../../../specs/reconstruct/DAILY_LOG_AND_CHECKIN_SPEC.md), [`:709`](../../../../specs/reconstruct/DAILY_LOG_AND_CHECKIN_SPEC.md)), 원문 서버 동기화 및 현재 정제 결과의 후속 사용도 제한한다([`:716`](../../../../specs/reconstruct/DAILY_LOG_AND_CHECKIN_SPEC.md), [`:720`](../../../../specs/reconstruct/DAILY_LOG_AND_CHECKIN_SPEC.md)). 사실 투영 소스는 목적/메모 필드를 읽지 않는다([`plan-execution-review.ts:36`](../../../../app/src/domain/plan-execution-review.ts)).
- **공격 경로:** 목적을 PRIVATE에서 ANALYZABLE로, 다시 PRIVATE로 전환하면서 이전 목적이나 메모가 다음 계획 검토에 잔류하는지 본다.
- **결과:** 검토 투영 경계에서는 `NO_FINDING` / `CONFIRMED_CODE`. 단, 기존 합성 테스트는 PRIVATE 메모 단독 변경을 다룰 뿐 명시적 목적 전환 전체 UI·저장 시퀀스를 실행하지 않았다. 그 전환 시나리오는 `NOT_TESTED`다.
- **재현:** 정적 확인은 위 `plan-execution-review.ts:36`과 일지 규격의 목적별 조항을 대조한다. 실제 전환 재현에는 브라우저에서 목적 변경 후 저장/재열기가 필요하지만 수행하지 않았다.

### P08 — 워치 자료 도착을 기다리는 사용자

- **전제:** 계획 연결이 유효한 완료 일지의 객관 자료 상태가 WAITING이다.
- **정상 경로:** WAITING은 `unknowns`에 포함된다([`plan-execution-review.ts:100`](../../../../app/src/domain/plan-execution-review.ts)).
- **공격 경로:** 사용자가 기본 요약에서만 읽고 이유 영역을 열지 않는다. 기본 요약은 `review.unknowns`를 렌더링하지 않으며([`ExecutionReview.tsx:33`](../../../../app/src/screens/plan-review/ExecutionReview.tsx)), 그 값은 접힌 세부 이유 영역에서만 표시된다([`ExecutionReview.tsx:55`](../../../../app/src/screens/plan-review/ExecutionReview.tsx)).
- **결과:** `CONFIRMED_CODE`, P2 한 건. WAITING 전용 단위 사례 및 브라우저 재현은 이번에 실행하지 않아 각각 `NOT_TESTED`다. 이미 존재하는 미완료 읽기/기타 검토 검사 결과를 WAITING 렌더링 증거로 대체하지 않았다.
- **재현:** “발견 사항”의 정적 재현 1~4단계를 따른다. 실제 UI 실행은 하지 않았다.

### P09 — 같은 운동 일지가 둘인 사용자

- **전제:** 같은 `plannedSessionId`를 가진 두 일지가 읽힌다.
- **정상 경로:** `collectExecutionReviews`는 읽기 불완전 상태를 검토 결과로 확정하지 않고, 동일 연결이 둘 이상이면 충돌로 표시한다([`plan-execution-review.ts:132`](../../../../app/src/domain/plan-execution-review.ts), [`:144`](../../../../app/src/domain/plan-execution-review.ts)). 저장 경로에도 중복 연결 차단 검사가 있다([`journal-store.ts:142`](../../../../app/src/domain/journal-store.ts), [`:163`](../../../../app/src/domain/journal-store.ts), [`:185`](../../../../app/src/domain/journal-store.ts)).
- **공격 경로:** 서로 다른 일지 ID에 같은 계획 세션 ID를 넣어 자동으로 하나를 선택하거나 이중 반영하는지 검사한다.
- **결과:** `NO_FINDING` / `CONFIRMED_CODE`. 합성 테스트 [`plan-execution-review.test.ts:78`](../../../../app/src/domain/plan-execution-review.test.ts)가 불완전 읽기/미래 일지 및 중복 일지 충돌을 검사했고 제한 실행에서 수행됐다. 외부 가져오기·실동기화의 실제 도착 경로는 런타임 검증하지 않았다.
- **재현:** 지정된 Vitest 명령을 실행하고 해당 “duplicate occurrence across journal IDs” 사례를 수행한다. 두 일지가 충돌로 표시되는 합성 결과를 확인한다.

### P10 — 같은 기기에서 로그아웃/계정 전환하는 사용자

- **전제:** 합성 로컬 일지의 소유자가 없거나 계정 A/B 중 하나이며, 읽기 도중 소유자 범위가 바뀔 수 있다.
- **정상 경로:** 활성 계정 범위 변경을 알리고([`local-journal-ownership.ts:80`](../../../../app/src/domain/account/local-journal-ownership.ts)), 로컬 일지 가시성을 현재 소유자와 비교한다([`:104`](../../../../app/src/domain/account/local-journal-ownership.ts), [`:108`](../../../../app/src/domain/account/local-journal-ownership.ts)). 저장소는 읽기 불확실성을 빈 결과로 가장하지 않고([`journal-store.ts:103`](../../../../app/src/domain/journal-store.ts), [`:107`](../../../../app/src/domain/journal-store.ts)), 비밀 메모 읽기 도중 계정 범위가 바뀌면 결과를 폐기하고 완전 읽기 후에만 캐시를 반영한다([`:237`](../../../../app/src/domain/journal-store.ts), [`:253`](../../../../app/src/domain/journal-store.ts), [`:257`](../../../../app/src/domain/journal-store.ts), [`:263`](../../../../app/src/domain/journal-store.ts), [`:265`](../../../../app/src/domain/journal-store.ts)).
- **공격 경로:** 합성 계정 A → 로그아웃 → 계정 B 전환, 비밀 메모 비동기 읽기 중 범위 변경, 이전 ID 재사용을 검사한다.
- **결과:** `NO_FINDING` / `CONFIRMED_CODE`. 계정 격리 계약 테스트([`local-journal-isolation.contract.test.ts:57`](../../../../app/src/domain/account/local-journal-isolation.contract.test.ts), [`:132`](../../../../app/src/domain/account/local-journal-isolation.contract.test.ts))와 비밀 읽기 범위 테스트([`journal-private-read-scope.test.ts:32`](../../../../app/src/domain/journal-private-read-scope.test.ts), [`:60`](../../../../app/src/domain/journal-private-read-scope.test.ts))를 제한 실행에서 수행했다. JSDOM 합성 결과일 뿐이다.
- **재현:** 지정된 Vitest 명령을 실행한다. 해당 테스트는 합성 소유자 ID와 모의 저장/복호화 경계를 사용한다. 실제 Supabase 로그인·RLS, 서버 왕복, 다중 기기, 실제 브라우저 세션은 `NOT_TESTED`다.

## 장점과 남은 불확실성

- 장점: 메모·제목·자유 텍스트와 운동 사실 투영 경계를 분리하고, 중복 계획 세션을 자동 선택하지 않으며, 계정 범위 변경 중 비밀 읽기 결과가 오래된 범위에 커밋되지 않도록 하는 코드/합성 회귀 검사가 있다.
- 남은 불확실성: P08의 화면 노출은 소스 경로에서만 확인했으며 로컬 미리보기는 실행하지 않았다. P07의 실제 목적 전환, P10의 인증 제공자/RLS 및 실서버의 계정 교차 격리도 실행 증거가 없다. 검토된 계정/계획 계약 일부는 초안 또는 구현 범위 문서이므로 제품 전체의 운영 보증으로 해석하지 않는다.
- 재계획 엔진 부재는 이 검수의 결함으로 세지 않았다. 담당 계약은 설명적 검토와 재계획 적용을 구별하고, 재계획 적용 런타임을 미구현으로 명시한다.
- 제품 파일 및 기존 테스트 변경: 없음.
