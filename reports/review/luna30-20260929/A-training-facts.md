# 독립 검수 A: 훈련 사실과 수치 해석

- 저장소: `D:/admin/Documents/ChatGPT/트레인 오라클/TRAINORACLE-oracle-exploration-20260921`
- 검수일: 2026-09-29
- 범위: dirty 상태 포함. 계획-실제 수행 읽기 UI, 사실 투영, `exerciseLog`/일지 스키마
- 제외: 코드·기존 테스트·스펙·설정 수정, 커밋·푸시·배포, 개인/운영 데이터, 인증정보, 외부 네트워크, 실제 사용자 브라우저

## 판정 요약

**확정 결함 0건. `SUSPICION` 1건(P2 후보):** 정확한 계획 연결이 있고 실제 슬롯만 AM/PM 반대인 기록을 원본 조회 실패로 처리한다. 저장 경로가 이 입력을 `MODIFIED`로 기록하는 것과 리뷰 상태가 충돌하는 동작은 합성 Vitest 경로에서 재현됐다. direct metric 억제는 코드 경로에서 확인했으며 그 값까지 채운 통합 사례는 실행하지 않았다. 기대 계약이 검토 초안이므로 결함 확정은 보류한다. 브라우저 E2E는 실행하지 않았다.

그 외 실행한 범위에서는 완료 표시를 구간별 준수로 승격하지 않고, 기록된 정확한 RPE만 투영하며, 미확인/유래 RPE는 제외한다. 운동 구성은 거리·시간·반복·세트·부하·접지·회복 단위로 남고 분석 수치로 환산되지 않는다.

계획-실행 비교 계약 v0.4와 계획-일지 연결 계약 v1.0은 각각 `DRAFT_FOR_REVIEW`, `runtime_authority: false`다. 아래 후보는 새 재설계·수치 정책의 결함을 주장하지 않는다. 현재 저장 경로와 현재 읽기 경로의 슬롯 처리 불일치만 보고한다. 실행 비교 계약의 지위/범위는 `specs/reconstruct/PLAN_EXECUTION_DEVIATION_AND_REPLAN_CONTRACT.md:9, 13, 14, 16, 17, 18, 311, 313, 314, 319, 320`, 연결 계약 지위는 `specs/reconstruct/PLAN_JOURNAL_LINKAGE_CONTRACT.md:10, 15`에서 확인했다.

## 결과 태그와 검사

- `CONFIRMED_RUNTIME`: 합성 자료를 사용한 좁은 자동 테스트에서 관찰한 런타임 동작. 브라우저 실사용 증거와 구분한다.
- `CONFIRMED_CODE`: 현재 소스에서 직접 확인한 경로/조건.
- `SUSPICION`: 동작은 확인했으나 기대 의미가 초안 계약에만 있어 결함 승격이 미확정.
- `NO_FINDING`: 이 검수 범위에서 결함을 확인하지 못함. 제품 전반 무결성 선언이 아님.
- `NOT_TESTED`: 이번 검사에서 실행하지 않음.

실행한 대상 검사(모두 `app/`에서 실행):

1. `npm run test:unit -- src/domain/plan-execution-review.test.ts src/domain/plan-execution-relation.test.ts src/screens/plan-review/ExecutionReview.test.tsx src/screens/home/HomeCoachingSummary.test.tsx` — 4개 파일, 35개 테스트 통과.
2. `npm run test:unit -- src/domain/exercise-log.test.ts src/domain/journal-schema.test.ts src/screens/log-entry/QuickSessionForm.contract.test.tsx` — 3개 파일, 44개 테스트 통과.

전체 스위트, Playwright/브라우저 E2E, 실제 사용자 브라우저는 실행하지 않았다. `http://127.0.0.1:4194/?app=1`에는 로컬 HTTP GET만 보내 200을 확인했으며, 페이지를 조작하거나 사용자 자료를 읽지 않았다. E2E의 DOM·시각 상태는 따라서 `NOT_TESTED`다.

## A-01: 반대 AM/PM 슬롯의 정확한 연결이 원본 불가로 숨겨짐

- **우선도:** P2 후보
- **태그:** `CONFIRMED_RUNTIME` (원본 불가 상태), `CONFIRMED_CODE` (early-return이 사실 투영을 건너뜀), `SUSPICION` (기대 의미의 최종 계약 지위)
- **영향 페르소나:** P03

**전제:** 합성 활성 계획의 정확한 AM 세션 링크와 날짜는 유효하고 원본 세션을 읽을 수 있다. 실제 완료 기록만 PM으로 입력하며 RPE/거리/시간은 직접 입력한다.

**정상 경로:** `derivePlanExecutionRelation`은 완료 세션의 실제 AM/PM 슬롯이 연결 세션 슬롯과 다르면 `MODIFIED`를 반환한다 (`app/src/domain/plan-execution-relation.ts:7, 8, 13, 14, 15, 16`). Quick journal은 선택한 결과/슬롯과 링크로 관계를 만들고 기록에 저장한다 (`app/src/screens/log-entry/QuickSessionForm.tsx:179, 182, 194, 202, 204`). 입력 테스트는 계획과 반대 슬롯의 완료 기록을 저장해 `MODIFIED`인지 검사한다 (`app/src/screens/log-entry/QuickSessionForm.contract.test.tsx:263, 269, 271, 276, 278`).

**공격 경로:** 위와 동일한 정확한 링크에서 실제 `activitySlot`만 반대로 바꾼다. 리뷰는 링크 schema/date 검사 직후 `activitySlot !== link.sessionSlot`이면 `unavailable()`로 빠진다 (`app/src/domain/plan-execution-review.ts:44, 45, 46`). 합성 테스트는 이 입력의 상태가 `SOURCE_UNAVAILABLE`임을 실행 확인했다. 그 함수는 무조건 빈 `facts`/`metrics`/`actualExercises`를 반환한다 (`app/src/domain/plan-execution-review.ts:40, 41, 42, 43`). 따라서 direct metric이 존재하는 경우도 투영 전에 숨겨지는 것은 코드 근거이며, 같은 테스트 입력으로 값 숨김까지 실행 검증한 것은 아니다. 화면은 빈 metric을 추가 정보로 대체하지 않는다 (`app/src/screens/plan-review/ExecutionReview.tsx:24, 26, 27, 28, 29, 30, 46, 47, 50, 51`).

**결과:** 반대 슬롯은 저장 모델에서 `MODIFIED`로 기록되지만 읽기 모델에서는 잘못된 링크/원본 부재처럼 취급된다. 화면이 동일 원본을 다시 열라는 안내를 내는 동작은 테스트로 확인됐다. early-return이 RPE·거리·시간·운동 구성 투영을 건너뛰는 것은 코드에서 확인했으며, 이들 값을 채운 반대 슬롯 엔트리 전체의 반환을 테스트한 것은 아니다. 생리학적 효과나 안전 판정을 거짓으로 만들지는 않지만 알려진 수행 사실을 감출 수 있다. 계획-일지 초안은 슬롯 반전을 `MODIFIED`로 분리한다 (`specs/reconstruct/PLAN_JOURNAL_LINKAGE_CONTRACT.md:50, 51, 52, 53, 54, 55`).

**재현 절차:**

1. `QuickSessionForm.contract.test.tsx`의 `records a completed linked session in the other AM/PM slot as modified` 합성 절차를 사용한다. 활성 계획 세션에서 링크를 만들고 `계획대로 마쳤어요` → 반대 오전/오후 → RPE 선택 → `없어요` → `이대로 저장`을 선택한다. 이 테스트는 반대 슬롯 선택과 저장 관계 `MODIFIED`를 실행 확인한다 (`app/src/screens/log-entry/QuickSessionForm.contract.test.tsx:263, 267, 269, 271, 272, 273, 274, 275, 276, 278`).
2. 원본 조회 성공 결과 및 유효한 계획-AM 링크에 실제-PM을 붙인 합성 엔트리를 `reviewPlanExecution`에 넣는다. 계획-AM/실제-PM 형태는 `app/src/domain/plan-execution-review.test.ts:62, 63, 64, 65`의 slot 공격 입력으로 이미 실행되며 `SOURCE_UNAVAILABLE`을 기대한다. 이 리뷰 fixture에는 direct 수치가 없어 값 suppression은 테스트가 아닌 앞 단락의 early-return 코드에서 확인한다.
3. 홈 코칭 카드/상세 페이지에서 예상되는 실제 숫자 노출은 브라우저 E2E로 확인하지 않았다. 해당 UI 동작은 반환 객체와 컴포넌트 경로로만 확인했다.

**구체적인 수정 방향(수정하지 않음):** 출처 무결성 검사는 링크의 유효성, 날짜, 원본 세션 일치에 한정하고 실제 슬롯과 계획 슬롯을 같아야 할 조건으로 쓰지 않는다. 실제 슬롯은 별도 사실로 보존해 표시하고, `activityOutcome + activitySlot + exact link`에서 관계를 재계산해 슬롯 차이를 `MODIFIED`로 읽는다. 계획 자극 준수 여부·새 수치 임계치·자동 재설계 권한은 추가하지 않는다. 회귀 검사는 유효한 AM 링크+PM 수행이 원본 불가로 바뀌지 않고 RPE/거리/시간과 exercise rows를 보존하는지 한 입력으로 확인해야 한다. 기존 slot 공격 테스트의 기대값도 계약 지위 확인 후 갱신한다.

## 페르소나 검수

### P01 처음 계획을 쓰는 5km 러너

- **전제:** RPE 계획 범위가 있는 합성 세션에 완료 표시, 명시적 RPE가 연결됨.
- **정상 경로:** 직접 입력한 RPE와 계획 범위를 `기록`/`계획`으로 나란히 표시하되 동일 세션 수행이나 준수로 단정하지 않는다. `app/src/domain/plan-execution-review.test.ts:18, 19, 20, 26, 27, 28, 30, 31`에서 RPE 사례를 실행했고, `app/src/screens/plan-review/ExecutionReview.tsx:27, 28, 29`의 표시는 각각의 라벨을 유지한다.
- **공격 경로:** 숫자 `9`가 있어도 provenance가 없거나 `MISSING`/`DERIVED`이면 실제 RPE처럼 표시·비교하지 않는다. 테스트 `app/src/domain/plan-execution-review.test.ts:33, 34, 35`에서 세 경우를 실행했다. 저장값 `0`도 결측으로 다루며 범위 비교를 만들지 않는다.
- **결과:** `NO_FINDING` — tested paths에서 초보자에게 성공률/준수 점수를 만들지 않는다. 5km 초보자별 처방 적격성은 이 reader의 범위가 아니며 `NOT_TESTED`.
- **근거:** `app/src/domain/plan-execution-review.ts:84, 85, 86, 87, 88, 89, 90, 93, 94, 95`; `specs/active/SESSION_INTENSITY_ASSESSMENT_SPEC.md:29, 31, 32, 33, 34, 35, 36, 38, 39, 97, 98, 102, 108, 109`.

### P02 혼자 훈련하는 중학생 800m 선수

- **전제:** 합성 기록에서 일부 수행(`PARTIAL`)과 선택적 구조화 구간/RPE를 남김. 연령이나 800m 전용 정책은 새로 가정하지 않는다.
- **정상 경로:** 일부 수행을 본인 기록 사실로 표시하고, 어느 반복을 했는지 계획 구간과 대응되지 않으면 그 불확실성을 남긴다. 남은 반복을 추정해 더하지 않는다. 상태 및 RPE 비준수 추정 방지는 `app/src/domain/plan-execution-review.test.ts:36, 37, 39, 40, 41, 42, 43`에서 실행했다.
- **공격 경로:** 높은 RPE 또는 일부 수행을 완료된 전체 세션, 계획 자극 일치, 다음 날 보충 훈련으로 승격시키려 한다. 코드에는 그 결론/자동 보충이 없고 `PARTIAL` 설명은 구간을 따로 확인하도록 한다 (`app/src/domain/plan-execution-review.ts:57, 58, 61, 62, 63, 64, 107, 108, 109, 110, 112, 118, 119, 120, 122, 123`).
- **결과:** `NO_FINDING` — 일부 수행과 미확정 구간의 경계는 유지된다. 미성년자·800m 정확한 설정의 브라우저 흐름과 안전 적격성은 `NOT_TESTED`.
- **근거:** `app/src/domain/plan-execution-review.ts:57, 58, 61, 62, 63, 64, 96, 99, 107, 108, 109, 110, 112, 118, 119, 120, 122, 123`; `specs/reconstruct/PLAN_EXECUTION_DEVIATION_AND_REPLAN_CONTRACT.md:53, 54, 55, 56, 57, 86, 88, 89, 90, 253, 254, 255`.

### P03 AM/PM을 따로 수행하는 엘리트

- **전제:** 정확히 연결된 AM 계획 세션과 같은 날 실제 PM 완료 세션.
- **정상 경로:** 계획·실제 슬롯이 같으면 완료만으로 구간별 페이스·반복·회복의 일치를 주장하지 않는 기본 경로가 테스트됐다 (`app/src/domain/plan-execution-review.test.ts:18, 19, 20, 21, 22, 24`).
- **공격 경로:** 계획과 다른 AM/PM 슬롯에서 실제 훈련을 마친다. 관계 생성기는 `MODIFIED`로 처리하지만 리뷰는 A-01처럼 `SOURCE_UNAVAILABLE`을 돌려준다. 이 리뷰 fixture에는 direct 수치가 없다. 직접 수치 투영을 건너뛰는 것은 A-01의 코드 경로에서 확인했다. QuickSession 저장과 reader 공격 입력 테스트를 각각 실행했으나, 두 화면을 잇는 Playwright 브라우저 시나리오는 실행하지 않았다.
- **결과:** `CONFIRMED_RUNTIME` (두 합성 도메인 경로의 분리 실행), `SUSPICION` (reader의 기준이 초안 계약이라는 점). P2 후보 A-01. UI에서 실제 카드 제목/행동 버튼이 어떻게 보이는지는 `NOT_TESTED`.
- **근거:** `app/src/domain/plan-execution-relation.ts:7, 8, 13, 14, 15, 16`; `app/src/domain/plan-execution-review.ts:40, 41, 42, 43, 44, 45, 46`; `app/src/screens/log-entry/QuickSessionForm.contract.test.tsx:263, 267, 269, 271, 272, 273, 274, 275, 276, 278`; `app/src/domain/plan-execution-review.test.ts:62, 63, 64, 65`; `specs/reconstruct/PLAN_JOURNAL_LINKAGE_CONTRACT.md:50, 51, 52, 53, 54, 55`.

### P04 달리기와 인터벌을 함께 한 마라토너

- **전제:** 한 일지에 직접 입력한 전체 세션 거리/시간과 반복 달리기 구성 기록이 공존함.
- **정상 경로:** 전체 기록 필드와 운동별 구조를 각각 표시한다. 반복 거리·횟수·세트·반복/세트 회복을 보여 주되 계획의 어느 구간에 해당하는지 자동 대응하거나 총량으로 합산하지 않는다. 합성 인터벌+근력 구성 테스트에서 구간 단위와 대응 unknown을 검사했다 (`app/src/domain/plan-execution-review.test.ts:68, 70, 71, 72, 73, 74, 75, 76`).
- **공격 경로:** 전체 달리기 거리 또는 자유 운동명/메모를 이용해 인터벌을 완수했다고 추정하거나 반복 구조와 거리 필드를 더한다. 코드 투영은 explicit 전체 필드와 `exerciseLog` 구조를 분리하고 이름·메모는 결과에 넣지 않는다 (`app/src/domain/plan-execution-review.ts:65, 67, 69, 70, 71, 72, 73, 74, 75, 76, 77, 78, 79, 80, 81, 82, 96, 97, 98, 99`).
- **결과:** `NO_FINDING` — 검사한 입력에서 계획 구간 준수/총거리 추가 계산 없음. 마라톤 이벤트가 포함된 실제 브라우저 케이스는 `NOT_TESTED`.
- **근거:** `app/src/domain/plan-execution-review.ts:65, 67, 69, 70, 75, 79, 83, 96, 97, 98, 99`; `app/src/domain/exercise-log.ts:34, 35, 36, 39, 43, 44, 45`; `app/src/domain/plan-execution-review.test.ts:68, 70, 71, 72, 73, 74, 75, 76`; `specs/active/SESSION_RECORDING_COMPOSER_CONTRACT.md:25, 27, 29, 30, 31, 33, 34, 35, 44, 45, 46, 47, 48`.

### P05 근력·플라이오·대체운동을 한 선수

- **전제:** 달리기 외 근력 세트/중량, 플라이오 접지, 크로스 트레이닝 등 자기보고 구조를 한 세션에 함께 남김.
- **정상 경로:** 저장 구조는 운동 종류와 row를 분리하고 kg·반복/세트·접지·좌우·반복 회복·세트 회복을 원래 단위로 보존한다. reader는 사전 정의된 운동 종류명과 이 row 설명만 보인다. 분석 투영에서는 `exerciseLog`를 빼며 RPE/에너지 시스템/달리기 km로 변환하지 않는다. 합성 근력·플라이오 및 분석 제외 검사를 실행했다 (`app/src/domain/exercise-log.test.ts:14, 18, 19, 22, 26, 35, 38, 50, 52, 53, 54, 55`; mixed 구성은 `app/src/domain/plan-execution-review.test.ts:68, 70, 71, 72, 73, 74, 75, 76`).
- **공격 경로:** 근력 kg를 `%1RM`/러닝 거리로, 점프 거리를 접지 수로, 여러 양식을 범용 피로·계획 자극으로 바꾸려 한다. 저장 reader의 해당 연산은 없고, 세션 강도 계약은 교차 양식 점수와 자동 계획변경을 금한다.
- **결과:** `NO_FINDING` — 검사된 strength/plyometric 케이스에서 단위 합산·환산 없음. `CROSS_TRAINING`/`OTHER`를 포함한 모든 종류의 브라우저 렌더, 최대 수치 경계의 도메인 타당성은 `NOT_TESTED`; 현재 상한을 새 정책으로 승인하거나 결함으로 단정하지 않는다.
- **근거:** `app/src/domain/exercise-log.ts:3, 4, 5, 6, 7, 8, 9, 14, 18, 20, 22, 26, 29, 34, 35, 36, 39, 41, 43, 44, 45`; `app/src/domain/plan-execution-review.ts:96, 97, 98, 99`; `specs/active/SESSION_RECORDING_COMPOSER_CONTRACT.md:25, 27, 29, 30, 31, 33, 34, 35, 44, 45, 46, 47, 48`; `specs/active/SESSION_INTENSITY_ASSESSMENT_SPEC.md:33, 34, 35, 36, 37, 38, 39, 62, 68, 69, 80, 81, 82, 83, 124, 125, 126, 127, 128, 130`.

## 강점과 남은 불확실성

- 강점: planned/actual/unknown을 분리하고, 직접 입력 provenance 없이 수치를 쓰지 않으며, `exerciseLog`를 기존 분석 구조에 밀어 넣지 않는다. 일부·가벼움 기록이 자동 보충이나 효과 주장으로 이어지지 않는다.
- 남은 불확실성: 계획-실행/연결 세부 계약은 검토 초안이다. AM/PM A-01의 의미는 오너가 채택한 현재 scope와 정합화가 필요하다. 실행은 좁은 Vitest 합성 사례뿐이고, preview browser, 실제 모바일 크기·접근성, 청소년/종목별 사용자 흐름, 계정·워치 동기화, 통합 저장/조회 왕복은 검증하지 않았다.
- 작업 경계: 이 보고서 외 제품 코드·테스트·스펙·설정은 변경하지 않았다. 커밋·푸시·배포는 하지 않았다.
