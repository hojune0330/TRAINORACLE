# 간편 계획·제작자 프로그램 P 구현 및 UX 검수

```yaml
doc_id: TO-INSTANT-PLAN-PRODUCT-IMPLEMENTATION-20260920
status: COMPONENT_READY_INTEGRATION_PENDING
branch: codex/instant-plan-product-20260920
common_preparation_commit: d529b9a
owner_review_required_before_merge: true
merge_authorized: false
deployment_authorized: false
source_supply: BLOCKED_SOURCE
```

## 결과와 범위

[병렬 개발 지시](../plans/TRAINING_PLAN_PARALLEL_DEVELOPMENT_ORDER_2026-09-20.md)의 P 소유 경로만 구현했다. [제품 원문 A](../plans/TRAINORACLE_INSTANT_PLAN_AND_CREATOR_PROGRAM_PLAN_2026-09-20.md), [UX 리뷰 B](../plans/TRAINORACLE_INSTANT_PLAN_UX_UI_CRITICAL_REVIEW_2026-09-20.md), [통합 D](../plans/TRAINING_PLAN_CROSS_SESSION_INTEGRATION_REVIEW_2026-09-20.md)를 보존했다.

작은 구조화 입력 → 추천 하나와 실제 일정 → 명시적 시작 → 오늘 수행의 표시 컴포넌트를 제공한다. 데이터는 통합 담당자의 기존 엔진·계정 상태로부터 받는다. 별도 처방, 저장소, 오늘 상태, 외부 AI/API는 추가하지 않았다. 기존 화면·공통 타입·전역 CSS·패키지·SQL은 변경하지 않았다.

구현 경로:

- `app/src/components/instant-plan/`: 입력, 추천, 오늘, 제작자 선택, 전용 CSS, 관련 UI 테스트.
- `app/src/domain/creator-program/`: strict 공개 원본 스키마, 권한·버전·검토·철회/리콜 판정, 빈 레지스트리, 테스트 전용 fixture와 계약 테스트.
- [제작자 재사용 계약](../../specs/reconstruct/CREATOR_PROGRAM_REUSE_CONTRACT.md).

## 공격적 UX 리뷰에서 반영한 변경

1. **목표가 현재 기록으로 바뀌는 실제 결함을 수정했다.** 현재 기록→목표 수정→현재 기록 왕복 시 공유 입력 상태가 목표값을 실제 기록으로 보낼 수 있었다. 모드별 입력 초안을 분리하고 양방향 회귀 테스트를 추가했다. 현재 기록 제출이 내 기록에도 남는다는 짧은 안내를 추가했지만, 서버 동기화 완료를 주장하지 않는다.
2. **작은 화면의 긴 일정 목록을 축약했다.** 기본 달력은 실제 날짜·요일·오전/오후·핵심 훈련/기초 지구력/회복/휴식만 표시한다. 320px 기본 3열, 600px 이상 5열, 900px 이상 7열이다. 기간·횟수·부담·첫 훈련과 달력을 본 뒤 시작할 수 있고, 전체 훈련명과 긴 추천 이유는 뒤의 native details에서 확인한다. CSS 의도이며 실제 패널 폭·글자 확대 검수 완료를 뜻하지 않는다.
3. **오늘 수행은 내용 자체를 바로 보여준다.** 준비·본운동·회복·정리 등 전달된 단계와 수치 단위를 그대로 표시한다. 불필요한 '훈련 보기' 경유를 만들지 않는다. 오전 기록이 오후 기록까지 완료시키지 않는다. `recorded`는 휴식·건너뛰기·통증 체크인도 포함할 수 있으므로 '남긴 기록 있음'으로 표시한다.
4. **목표와 프로그램의 약속을 분리했다.** 기준 기록·내 목표·이번 프로그램 목적을 별도 라벨로 표시한다. 목표값만으로 현재 능력이나 기간 내 달성을 보장하지 않는다.
5. **제작자 선택의 먹통과 오노출을 방지했다.** 게시 권한이 없는 원본은 제목도 표시하지 않는다. 선택 시 원본 버전·권한을 재검증하고 변경된 경우 안내한다. 종목·대상·부담·기간을 먼저 보여주며 개인본 활성화는 수행하지 않는다.

미니멀 UI가 핵심 실행 정보를 생략하는 핑계가 되면 안 된다. 결과 화면은 생활 부담을 이해하게 하고, 오늘 화면은 운동을 수행할 수 있게 해야 한다. 정돈된 메뉴나 버튼 수가 그 이해를 입증하지 않는다.

## 통합 API

공통 타입은 기존 `app/src/domain/instant-plan-contract.ts`를 그대로 사용한다. 아래 컴포넌트는 개별 파일에서 named export한다.

| 컴포넌트 | 필수 props | 선택 props / 주의 |
|---|---|---|
| `InstantPlanEntryForm` | `today`, `onSubmit(entry)` | `initialEntry`, `disabled`, `sourceLabel`. initialEntry는 최초 초기값이므로 계정·프로그램 전환 시 identity key로 remount |
| `InstantPlanRecommendationView` | `recommendation`, `actionState`, `onStart(personalCandidateId)` | `onShowAlternatives`, `onEditSchedule`, `onRetry`, `anchorLabel`, `goalLabel`, `programPurposeLabel`. READY만 시작 가능 |
| `InstantPlanTodayView` | `today` | `onRecordSession(id)`, `onChangeSchedule`, `onContinue`. 복귀·사용 불가에는 작동하는 복구 callback 필요 |
| `CreatorProgramPicker` | `onChoose({kind:'CREATOR',programId,version})` | `programs?: readonly unknown[]`, `entry`, `disabled`. 기본 registry는 empty. 선택은 처방·저장 승인이 아님 |

도메인 export는 `app/src/domain/creator-program/index.ts`에 있다. `evaluateCreatorProgram(input, entry?, expectedIdentity?)`, `evaluateExistingCreatorCopy(input, provenance)`, 스키마/타입, 정확한 버전 조회와 공급 상태를 제공한다.

`NEEDS_INPUT`/`ELIGIBLE`은 원본 선택의 조건일 뿐이다. 통합 담당자는 신뢰 가능한 원본에서 정확한 버전과 권한을 저장 직전에 재조회하고, 실제 adoption/prescription 참조를 기존 채택 목록에 대조해야 한다. 상업 노출 권한의 별도 enforcement, 개인본 provenance 저장, 철회/리콜의 실제 적용은 현재 이 순수 모듈만으로 보장되지 않는다.

## 실제 검사 결과

작업 디렉터리: 이 브랜치의 `app/`. 기존 설치 의존성을 ignored node_modules junction으로 재사용했다. package/lock 변경은 없다.

| 검사 | 결과 |
|---|---|
| `node ./node_modules/typescript/bin/tsc --noEmit` | PASS. 중간에 테스트 union narrowing 오류를 발견해 수정한 후 최종 재검사 exit 0 |
| `node ./node_modules/vitest/vitest.mjs run src/components/instant-plan src/domain/creator-program src/styles/visual-system.contract.test.ts --no-cache` | 6 files / 114 tests PASS |
| `node ./node_modules/vitest/vitest.mjs run -c vitest.config.kst.ts src/components/instant-plan/InstantPlanEntryForm.test.tsx src/components/instant-plan/InstantPlanRecommendationView.test.tsx src/domain/creator-program/creator-program.contract.test.ts --no-cache` | 3 files / 81 tests PASS |
| 초 범위 결함 주입 | `secondValue >= 60` 차단 제거 시 `rejects invalid time 1 min / 60 sec and focuses 초`가 실제 실패. 120초 CURRENT_RECORD가 잘못 전달되는 것을 검출. finally에서 원본 SHA-256 완전 복원 후 같은 테스트 재통과 |
| 재사용 권한 결함 주입 | 담당 에이전트가 `personalUse` 차단 제거 시 `denies new use without personalUse permission` 실패 확인. 원본 SHA-256 복원 및 재통과. 최종 전체 묶음에서도 계약 26개 포함 통과 |

검사 범위는 입력 의미·달력 날짜·표시 및 콜백·상태·권한 경계다. 별도 보안/권한 성격이 있으므로 단순 스타일 변경보다 넓은 계약 회귀를 실행했다. 전체 앱 빌드·전체 브라우저·운영 검증은 P가 중복 실행하지 않았다. 기존 CI는 codex branch/PR에서 실행되고 배포는 main 전용인 것을 확인했으며 워크플로를 수정하지 않았다. 로컬 PASS는 CI나 출시 승인 증거가 아니다.

## 완료와 미완료

| 경로/단위 | P 결과 | 남은 완료 조건 |
|---|---|---|
| 일반 × 현재 기록 | COMPONENT_READY | 실제 입력 저장→기존 안전/처방→추천→계정 저장→오늘 연결 및 브라우저 증거 |
| 일반 × 목표만 | COMPONENT_READY | 목표를 기록 앵커로 만들지 않고, 승인된 목표-only 경로에 연결한 실제 증거 |
| 제작자 × 현재 기록 | BLOCKED_SOURCE | 실제 허용된 원본·검토·변환·기존 엔진 연결 |
| 제작자 × 목표만 | BLOCKED_SOURCE | 목표-only에 채택된 실제 원본과 동일한 적용·저장 증거 |
| 오늘/복귀/실패 UI | COMPONENT_READY | 실제 상태 projection 및 복구 callback 연결, 일지/계정 경합 통합 검수 |
| main 병합·배포 | OWNER_REVIEW_REQUIRED_BEFORE_MERGE | 이번 작업에서 수행하지 않음 |

실제 승인 원본이 없으므로 레지스트리는 비어 있다. synthetic fixture는 테스트 파일에서만 사용하고 운영 목록에는 넣지 않았다. 유명인 협업·코치 승인·앱 내부 제작자 권한을 만들어내지 않았다. 첫 화면에 빈 제작자 상품 영역을 반드시 노출하라는 의미도 아니며, 공급이 없을 때의 홈 위계는 통합 UX에서 정한다.

## 통합 브라우저/사용성 수용 조건

- 320×568, 375px, 200% 글자 확대에서 수치·단위·오류·날짜가 잘리지 않아야 한다. 달력 열 수 때문에 의미를 읽기 어렵다면 실제 컨테이너 폭에 맞춰 조정한다.
- 추천 결과의 기간·횟수·부담·첫 일정·시작 행동을 찾을 수 있어야 한다. mini grid가 실제로 스크롤을 줄였는지는 렌더링에서 확인한다.
- 모바일 키보드, 44px 터치, 포커스·Enter 제출·details 조작을 실제 화면에서 확인한다. jsdom은 픽셀·터치 검증이 아니다.
- `BEFORE_START`의 DTO에는 실제 첫 훈련 날짜가 있어야 한다. `RETURN_AFTER_GAP`/`UNAVAILABLE`의 onContinue가 의미 있는 복구로 이어져야 한다.
- 로그인 취소/완료, 뒤로 가기, 저장 실패/대기 후 같은 입력과 추천이 유지되어야 한다. 저장 실패를 완료로 표시하지 않아야 한다.
- 사용자가 프로그램 부담, 오늘 수행 순서, 목표와 현재 능력의 차이, 원본과 개인화의 차이를 설명하는지 관찰한다. 코드 테스트로 이해도나 대부분의 선호를 증명하지 않는다.

P 커밋은 I의 미출시 통합 브랜치에 반영할 수 있다. 원본 P commit과 통합 commit/PR 관계를 별도로 남긴다. 커밋 전달 후 P 경로를 freeze한다.

[DRAFT_COMPLETE]
