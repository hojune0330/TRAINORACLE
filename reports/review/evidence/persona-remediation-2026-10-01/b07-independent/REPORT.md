# B07 독립 읽기 전용 검수 결과

## 검증 경계

- 대상: `codex/workout-choice-runtime-completion`, HEAD `38300ae988b97a9968968a2dd3eb3517b4e62781`.
- 일반 V3 기기 로컬 다음 주기 경로만 검수했다. B06 조정 지원 여부, 불가 안내, 늦은 응답 처리와 전체 100페르소나는 검수하지 않았다.
- `AGENTS.md`, `PRODUCT_NORTH_STAR.md`, `PERIODIZATION_LINEAGE_CONTRACT.md`의 실제 파일을 먼저 읽었다.
- 현재 HEAD에는 `GeneralPlanActiveState`라는 선언이 없다. 해당 일반 경로의 실제 컴포넌트는 `app/src/screens/plan-beta/PlanActiveState.tsx`이다. 버튼의 실제 이름은 `현재 기준으로 다음 계획안 만들기`이다.
- 제품 코드/스펙/기존 검사기 수정, 커밋, 푸시, 배포는 하지 않았다. 작업 산출물은 이 폴더에만 작성했다. `.env`, 실제 일지, 인증정보는 읽지 않았다.
- 합성 jsdom 저장소, 비로그인 범위, 고정 시각 `2026-10-01T03:00:00.000Z`를 사용했다. 기존 합성 fixture를 실제 V3 스키마로 파싱하고 계보/진행을 추가했다. 개인 기록/일지 입력은 없다.
- 환경파일 디렉터리를 이 폴더의 빈 `no-env`로 지정하고 기존 Vite 설정 자동 로딩을 끄고, 클라우드 함수 및 Supabase 경계를 비활성화하고 `fetch`를 실패하도록 대체했다. 생성/선택/로컬 보관/계보 함수는 실제 코드다.
- 작업 중 부모의 B06 변경이 나타났다. 이를 수정하거나 되돌리지 않았으며, 검수 핵심 8개 파일의 HEAD 대비 변경은 최종 확인 시 없었다.

## 실행 결과

| 실행 | 결과 | 의미 |
|---|---|---|
| KST `TZ=Asia/Seoul` | 8/8 통과, 실패/미실행 0, 종료 코드 0 | 정상 대조 및 결함/한도 재현 단언 충족 |
| UTC `TZ=UTC` | 8/8 통과, 실패/미실행 0, 종료 코드 0 | 동일 관찰 결과 |

두 실행의 evidence 본문은 동일하다. 테스트 통과는 제품의 세 불변식이 모두 충족됐다는 의미가 아니라, 아래 문제가 실제 발생한다는 재현 단언까지 충족됐다는 의미다.

초기 실행은 앱 루트 밖 테스트 해석 실패로 0개 실행이었다. 독립 실행 루트를 수정했다. 다음 실행은 6/8 통과했고, 두 실패는 포화 fixture에서 현재 원본과 탈락 대상 원본의 지문이 같았던 시험 설계 오류였다. 과거 원본을 `RESTED`, 현재 원본을 `COMPLETED`로 구별하고 재실행했다. 제품 실패로 집계하지 않는다. 중간 실패 보고는 `attempt-2-kst-fixture-collision.json`에 보존했다.

## 경계 1: 일반 다음 주기 계보

판정: **P2, 계속되는 같은 프로그램의 다음 주기라는 의미에서 계보 단절을 재현.** 초안 전체의 정본 위반으로 확대하지 않는다.

조건 및 함수 경로:

1. 계보가 있는 V3 계획, frame 6 또는 18, 표시 세션 DAY 1 AM에 `COMPLETED`, 현재 시점은 계획 시작 이후, pending successor 없음.
2. 실제 `PlanBeta` 화면의 일반 다음 계획 버튼을 누른다. `ActivePlan.tsx:141`의 완료 적격성 및 `:495`의 일반 버튼 경로를 통과한다.
3. `PlanActiveState.tsx:93-123`의 `startNextFrame`이 `archiveAndClearActivePlanWithLock`을 호출하고, 성공하면 intake만 `onArchived`로 넘긴다.
4. `plan-beta-store.ts:406-445`가 현재 원본을 확인하고 `archiveAndClearActivePlan`을 실행한다. 후자는 MANUAL V5 원본을 보관한 뒤 활성 키를 제거한다.
5. `PlanBeta.tsx:701-718`에서 `stored=null`, 기존 intake 초안, safety 질문으로 전환한다.
6. 실제 `generatePlanFromDraft` 및 실제 `saveSelectedPlanCandidate`로 새 후보를 저장한다. `plan-selection.ts:118`의 선택 재검사도 이전 계보를 받지 않는다.
7. `plan-beta-flow.ts:455-459`는 무조건 `createInitialPeriodizationContext`를 호출한다. `periodization-lineage.ts:57-69`가 새 ID와 macrocycle/frame/mesocycle 1, BASE, NEW_PLAN을 만든다.

| 원래 위치 | 같은 계보 계속 시 기대 | 실제 저장 |
|---|---|---|
| macro 1 / frame 6 | 같은 ID, macro 1 / frame 7, group 3, DEVELOPMENT, ROLLED_FORWARD | 다른 ID, macro 1 / frame 1, group 1, BASE, NEW_PLAN |
| macro 1 / frame 18 | 같은 ID, macro 2 / frame 1, ROLLED_FORWARD | 다른 ID, macro 1 / frame 1, NEW_PLAN |

두 경우 모두 실제 결과는 `saved`, 저장 후 다시 읽기는 `loaded`였다. 이전 원본/진행/계보는 V5 아카이브에 정확히 남았다. 새 프로그램 정상 대조는 초기 1번이 맞았으며, 실제 `advancePeriodizationContext` 함수는 6→7과 18→다음 macro 1을 정상 처리했다. 따라서 초기 생성 함수의 오류가 아니라 일반 경로가 계속 계보 문맥을 전달하지 않는 문제다.

근거 지위: `PERIODIZATION_LINEAGE_CONTRACT.md:10,15-16`은 DRAFT_FOR_REVIEW, 운영/정본 승격 불가다. 같은 문서 `:97-102`는 실제 후속 활성화 때만 진행하고 동일 계보를 보존하도록 제안한다. `TRAINING_PLAN_CURRENT_SCOPE.md:53`은 장기 계보 표시를 현재 범위로 설명한다. 일반 버튼이 새 프로그램 시작인지 계속 주기인지 명시적으로 결정하면 좋다. 새 프로그램이 의도라면 1번 자체가 오류는 아니지만 계속 주기 기능과 분리해 표시해야 한다.

최소 구현 위치: 일반 `startNextFrame` 및 `PlanBeta.onArchived`가 후속 초안의 정확한 predecessor 문맥을 유지하고, 일반 `saveSelectedPlanCandidate`의 잠금 안 저장 시 해당 문맥을 재확인하도록 한다. 신규 프로그램은 기존 initial 함수를 유지하고, 계속 주기는 실제 활성화 시에만 `advancePeriodizationContext`를 적용한다. 최신 이력 한 건을 무조건 연결하면 다른 프로그램/종목을 오연결할 수 있으므로 피한다. B06의 지원 여부/비동기 응답 처리는 수정 대상이 아니다.

## 경계 2: archive18 포화

판정: **최신 18개 제한 자체는 문서상 의도된 보존 정책. 전체 원본의 영구 보존이라고 주장할 수 없다.**

조건: V5 원본과 지문이 포함된 스키마 유효 과거 이력 17개/18개를 합성 저장하고, 구별 가능한 현재 V3 원본을 저장한다. `archiveAndClearActivePlanWithLock`의 실제 로컬 분기를 호출한다.

- 정상 대조 17→18: 성공 `archived`, 이전 17개 전부 그대로 보존.
- 포화 18→새 보관: 성공 `archived`, 길이는 18 유지. 새 원본 1개와 이전 최신 17개만 남고, 이전 마지막 원본의 지문/계보/진행이 저장 배열에서 제거됨.
- 탈락 대상 지문: `sha256:2e1cab1caf826f86d9c8d8eb82c2124e82702e212eeea5ba6dc7da97180482ae`.
- `readArchivedOriginalPlans()`는 `loaded`, `retainedPlans=18`, `missingOriginals=0`. 이는 남아 있는 행의 원본 유무만 센다. 이미 탈락한 원본 수를 의미하지 않는다.

정확한 위치: `plan-beta-store.ts:379-390`에서 V5 원본을 만든 뒤 `[history, ...previous].slice(0, 18)`을 직렬화하여 같은 history 키를 덮어쓴다. `:506-514`의 읽기도 그 배열만 반환한다. `plan-history-snapshot-content.ts:10-30`에서 원본/지문/계보가 같은 행에 들어가므로 화면 목록만 숨기는 것이 아니다.

정책 근거: 계보 계약 `:154-156`의 최대 18개, 현재 범위 `:53`의 최근 18개/영구 원장 아님 및 §8의 V5에도 동일 한도 적용. 정책을 바꾸는 한도 확대는 권고하지 않는다.

최소 구현 위치: `archiveAndClearActivePlan`에서 영구 탈락을 일으키는 쓰기를 후속 활성화 커밋까지 지연한다. 실제 수락된 보관 시 최신 18개 의미를 유지한다. 더 오래된 원본 보존이 필요하다면 이는 별도 오너 보존 정책 결정이다.

## 경계 3: 취소/중단 시 원본 보존

판정: **P2, 일반 다음 계획을 수락하기 전에 활성 원본 포인터가 사라지고 포화 이력이 탈락할 수 있음. 현재 원본 자체의 전부 삭제로 표현하면 부정확함.**

정상 대조: 다음 버튼을 누르지 않고 화면을 닫으면 활성 원본은 byte-for-byte 동일하고 보관 이력은 늘지 않았다.

재현 A: 일반 다음 버튼 → 안전 질문 → 새 후보 표시 → 실제 `runDraftSafeNavigation`으로 이동 취소/확인.

- `window.confirm=false`: 이동이 차단되고 후보 화면 및 보관 배열이 유지됐다. 그러나 현재 활성 키는 버튼을 누른 때 이미 없어진 상태다.
- `window.confirm=true`: 초안 버리기/이동을 허용하고 화면을 닫았다. 다시 `PlanBeta`를 열어도 활성 상태는 `missing`이다.
- 보관 한도 미만에서는 현재 원본의 전체 내용/진행/계보가 V5 이력에 정확히 보존됐다. 자동 활성 복귀는 없었다.

재현 B: 과거 이력 18개 → 일반 다음 버튼 → 안전 질문에서 새 계획을 만들지 않고 화면 닫기.

- 새 후속 활성화 0건, 활성 상태 `missing`, 이력 18개.
- 현재 원본은 보관돼 있지만 더 오래된 한 원본은 이미 탈락했다. 취소/중단만으로 그 탈락을 되돌리는 저장 경로는 실행되지 않았다.

정확한 위치: `ActivePlan.tsx:495`는 직접 `onNextFrame`을 호출한다. `PlanActiveState.tsx:95,123`은 미리 보관 후 intake로 이동한다. `plan-beta-store.ts:380,390`에서 과거 행 탈락 및 활성 키 제거가 이미 끝난다. `PlanBeta.tsx:710-717`은 활성 상태를 비운다. `usePlanDraftNavigationGuard.ts:16-20` 및 `unsaved-draft-navigation.ts:14-30`은 초안 이동 경계이며 보관 트랜잭션을 되돌리지 않는다.

최소 구현 위치: 1번과 같은 일반 경로에서 기존 원본을 활성 상태로 둔 채 후속 초안을 만들고, 사용자가 새 계획을 선택해 저장하는 잠금 트랜잭션에서만 보관/18개 자르기/후속 쓰기를 함께 수행한다. 취소는 임시 초안만 버린다. `onArchived` 이후 별도 역복원만 추가하는 방식은 포화 시 이미 탈락한 행 복원과 동시 변경까지 고려해야 하므로 최소 변경으로 보기 어렵다.

## 불확실성 및 종료

- 이번 결과는 실제 제품 함수와 React/jsdom 일반 화면 경로를 사용한 합성 로컬 실행이다. 실제 브라우저 클릭 E2E, 운영 서버, 계정별 새 저장 서비스, 배포 상태를 검증한 결과가 아니다.
- 다음 버튼과 safety 진입은 실제 화면으로 실행했다. 계보 사례의 후속 저장은 일반 화면이 사용하는 실제 `saveSelectedPlanCandidate`를 직접 호출했다. 사용자 전체 입력 여정을 자동으로 다시 돌리지는 않았다.
- 취소는 실제 초안 이동 가드의 확인/취소와 화면 닫기로 시험했다. 존재하지 않는 전용 '원래 계획으로 취소' 버튼을 가정하지 않았다.
- 오래된 18개 행은 스키마 유효한 합성 이력이다. 18개 실제 훈련 주기를 수행한 관측 증거 또는 연속 macrocycle 관측창 증거가 아니다.
- 초안 계약 전체 승인 여부나 일반 경로를 새 프로그램으로 정의하는 최종 제품 의미는 이번 시험으로 확정되지 않는다. 그러나 실제 저장 결과/탈락/활성 원본 미복구는 재현됐다.
- 기존 검사기의 결함 주입/수정은 수행하지 않았다. 정상 대조 3개와 재현 사례 5개만 실행했다.
- 장기 실행/서버/워치 프로세스는 시작하지 않았다. 각 실행은 `context.close()`를 거쳐 종료 코드 0으로 끝났고, 진행 중 실행 세션은 없다. 부모 프로세스는 종료하지 않았다.
- 추가 탐색/검수/수정 없이 이 보고로 종료한다.

산출물: `audit-fixture.test.tsx`, `run.mjs`, `evidence-kst.json`, `evidence-utc.json`, `vitest-kst.json`, `vitest-utc.json`, 중간 실패 보고. 캐시도 이 폴더 안에만 있다.
