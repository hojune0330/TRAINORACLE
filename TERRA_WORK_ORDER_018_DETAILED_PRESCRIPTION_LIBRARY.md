# TERRA_WORK_ORDER_018_DETAILED_PRESCRIPTION_LIBRARY.md

```yaml
work_order:
  id: TERRA-WO-018
  title: TrainOracle 상세 훈련 처방 계약·라이브러리·계산기 연결
  status: READY_FOR_TERRA_AFTER_PR120_BASELINE
  requested_model: gpt-5.6-terra
  requested_reasoning_effort: xhigh
  owner: COACH_HOJUNE
  repository: hojune0330/TRAINORACLE
  base_branch: main
  implementation_branch: terra/detailed-prescription-library
  next_actor: TERRA
  human_review_required: true

authority:
  may_create_draft_contracts: true
  may_create_draft_template_catalog: true
  may_implement_parser_formatter_and_same_event_pace_math: true
  may_add_non_active_review_required_seed_data: true
  may_add_tests: true
  may_change_safety_semantics: false
  may_activate_numeric_system_templates: false
  may_merge_own_pr: false
  may_deploy: false
  may_close_open_issues: false
```

## 0. 시작 전 필수 확인

1. `origin/main`을 fetch하고 깨끗한 새 worktree를 만든다.
2. PR #120의 병합 여부를 확인한다.
   - 병합됐으면 그 main을 기준으로 시작한다.
   - 병합되지 않았으면 문서/도메인 작업만 진행하고 Plan Beta UI 수정은 중단한다.
3. 다음 자료를 실제 파일 또는 GitHub PR에서 연다.
   - PR #115: 상세 처방 12종과 3층 카드 기획
   - PR #120: 현재 베타의 정직한 표시와 상세 처방 갭
   - PR #121: 수행값 대 코치 범위의 그림자 비교
   - `reports/review/DETAILED_PRESCRIPTION_RECONCILIATION_2026-07-26.md`
   - `reports/review/FORMATION_LATEST_OWNER_DECISION_BASELINE.md`
   - `specs/active/PLAN_GENERATOR_SPEC.md`
   - `specs/active/TEMPLATE_LIBRARY_SPEC.md`
   - `specs/reconstruct/TRAINING_PLAN_FORMATION_AND_ADAPTATION_SPEC.md`
   - `specs/reconstruct/PLAN_SAFETY_GATE_SPEC.md`
4. 경로가 없으면 없는 것으로 보고한다. 파일명 또는 장 제목을 실제 파일로 추정하지
   않는다.

## 1. 이번 작업의 제품 결과

TrainOracle은 적격 사용자에게 9.5일 기본 Formation을 만들 때 다음 수준의
세션을 설명할 수 있어야 한다.

```text
2×(10×400m) @5000m RP · r60″ · R3′
```

선수에게는 다음과 같이 풀어 읽어준다.

> 400m를 5000m 경기 페이스로 10번 달립니다. 반복 사이에는 60초 쉽니다.
> 10번을 마치면 3분 쉬고 같은 세트를 한 번 더 합니다. 총 20번입니다.

그러나 이 정확한 용량을 일반 기본안으로 자동 배정해서는 안 된다. 우선 표기,
파싱, 합계 계산의 책임자 기준 사례로 구현하고, 템플릿 활성화는 사람 검토가
끝난 데이터만 허용한다.

## 2. 고정 결정

다음은 다시 묻지 않는다.

```yaml
fixed_owner_decisions:
  product_name: TrainOracle
  provider_name: aaclub
  formation_default: 9_5_DAY_FORMATION
  main_exposure_default: 2_TO_3
  seven_day_view: USER_REQUESTED_PROJECTION_WITH_ADJACENT_FORMATION_CONTEXT
  self_service_plan_allowed: true
  coach_connected_plan_allowed: true
  coach_forced_review_when_configured: true
  scientific_superiority_of_9_5_days: NOT_CLAIMED
  whole_architecture_safety: NOT_CLAIMED
```

PR #121의 "9.5일/2~3 MAIN을 다시 채택할지" 질문은 제거하거나 최신 결정으로
대체한다. 다만 코치 범위 단위, 등록 권한, 그림자 기간은 계속 사람 결정으로 둔다.

## 3. 작업 A: PR #115/#120/#121 정합성 기록

새 파일을 만든다.

```text
reports/review/DETAILED_PRESCRIPTION_PR_RECONCILIATION_RESULT.md
```

필수 표:

| PR | 수용할 내용 | 수정할 내용 | 대체하지 않는 계층 | 후속 대상 |
|---|---|---|---|---|
| #115 | 처방 표기, 3층 UX, 스프린트/해당계 시드 | 출처, 최신 r/R, 용량·청소년 경계 | #120의 현재 런타임 진실 | 계약·카탈로그 |
| #120 | 현재 제공값/미제공값의 정직한 표시 | 상세 처방이 생긴 뒤 상태 전환 | #115의 라이브러리 | Plan Beta UI |
| #121 | 수행값 대 코치 범위 비교 | 9.5일 재결정 질문, 자기 주도 계획 오해 | 처방 생성 | calibration |

금지:

- 세 문서를 한 파일로 합치기
- #115 또는 #121을 검토 없이 그대로 병합하기
- #121의 비교 결과로 다음 훈련을 자동 변경하기
- #120의 "미지정" 문구를 상세 처방 계산 전에 삭제하기

## 4. 작업 B: 상세 처방 계약 생성

새 문서:

```text
specs/reconstruct/TRAINING_SESSION_PRESCRIPTION_CONTRACT.md
```

문서 규칙:

- 첫 줄 `# TRAINING_SESSION_PRESCRIPTION_CONTRACT.md`
- 상태 `RECONSTRUCTED_DRAFT_FOR_REVIEW`
- `[DRAFT_COMPLETE]` 뒤 텍스트 금지
- 실제 실행 로그가 없으면 `executed_tests_total: 0`
- 원문 파일을 찾지 못했으므로 "복원" 또는 "승인 버전 회복"이라고 쓰지 않기

최소 타입:

```typescript
type PlanningIntent =
  | "BASE_INTENT"
  | "LT_INTENT"
  | "VO2_INTENT"
  | "GLY_INTENT"
  | "ATP_PC_INTENT"
  | "RECOVERY_INTENT"
  | "MIXED_INTENT";

type PaceAnchorKind =
  | "RECENT_RESULT"
  | "PB"
  | "SB"
  | "GOAL"
  | "COACH_REFERENCE"
  | "RPE_ONLY"
  | "SPRINT_BENCHMARK";

type PaceAnchorEnteredBy = "ATHLETE" | "COACH" | "VERIFIED_IMPORT";
type PaceAnchorVerification = "VERIFIED" | "SELF_REPORTED" | "UNVERIFIED";
type PaceAnchorFreshness = "CURRENT" | "STALE" | "UNKNOWN";
type PaceAnchorPurpose =
  | "CURRENT_CAPABILITY"
  | "SEASON_CONTEXT"
  | "ASPIRATIONAL_TARGET"
  | "SPRINT_REFERENCE"
  | "EFFORT_ONLY";

interface PaceAnchorRecord {
  anchorId: string;
  kind: PaceAnchorKind;
  eventDistanceM: number | null;
  performanceSeconds: number | null;
  achievedAt: string | null;
  seasonId: string | null;
  enteredBy: PaceAnchorEnteredBy;
  sourceRef: string;
  verificationState: PaceAnchorVerification;
  freshnessState: PaceAnchorFreshness;
  purpose: PaceAnchorPurpose;
}

type RecoveryMode =
  | "WALK"
  | "JOG"
  | "STAND"
  | "FULL_RECOVERY"
  | "COACH_DEFINED"
  | "NOT_APPLICABLE";

interface StructuredPrescription {
  setCount: number | null;
  repetitionsPerSet: number | null;
  repetitionDistanceM: number | null;
  repetitionDurationSeconds: number | null;
  paceAnchorRef: string | null;
  repetitionRecoverySeconds: number | null;
  repetitionRecoveryMode: RecoveryMode;
  setRecoverySeconds: number | null;
  setRecoveryMode: RecoveryMode;
  warmupComponentRef: string | null;
  cooldownComponentRef: string | null;
  downshiftOptionRefs: string[];
  stopConditionCodes: string[];
}
```

조건부 필드 불변식:

```yaml
pace_anchor_invariants:
  RECENT_RESULT:
    requires: [eventDistanceM, performanceSeconds, achievedAt, sourceRef]
    purpose: CURRENT_CAPABILITY
  PB:
    requires: [eventDistanceM, performanceSeconds, achievedAt, sourceRef]
    purpose: CURRENT_CAPABILITY
  SB:
    requires: [eventDistanceM, performanceSeconds, achievedAt, seasonId, sourceRef]
    purpose: SEASON_CONTEXT
  GOAL:
    requires: [eventDistanceM, performanceSeconds, sourceRef]
    purpose: ASPIRATIONAL_TARGET
    may_become_current_capability: false
  COACH_REFERENCE:
    requires: [eventDistanceM, performanceSeconds, sourceRef]
  RPE_ONLY:
    eventDistanceM: null
    performanceSeconds: null
    purpose: EFFORT_ONLY
  SPRINT_BENCHMARK:
    requires: [eventDistanceM, performanceSeconds, achievedAt, sourceRef]
    purpose: SPRINT_REFERENCE
```

반드시 정의할 파생값:

- 총 반복 수
- 질적 반복 총거리
- 질적 반복 총시간
- 반복 사이 회복 횟수와 총시간
- 세트 사이 회복 횟수와 총시간
- 워밍업/쿨다운을 제외한 본훈련 총 소요
- 계산 불가능 사유 코드

복합 세션은 PR #121의 parent/component/dedupe 규칙을 참조하되 처방 레코드와
수행 비교 레코드를 하나로 합치지 않는다.

## 5. 작업 C: 연구 출처가 연결된 템플릿 카탈로그

새 문서:

```text
specs/reconstruct/ENERGY_SYSTEM_SESSION_TEMPLATE_CATALOG.md
```

최소 25개:

- `BASE_INTENT`: 5개
- `LT_INTENT`: 5개
- `VO2_INTENT`: 5개
- `GLY_INTENT`: 5개
- `ATP_PC_INTENT`: 5개

회복/휴식 템플릿 5개는 별도 지원 축으로 추가한다. 회복을 생리학적 안전 승인
또는 여섯 번째 측정 에너지 시스템으로 부르지 않는다.

각 템플릿 필수 필드:

```yaml
templateId:
version:
lifecycleStatus: DRAFT
planningIntent:
plainKoreanName:
coachingTerm:
notationPattern:
plainKoreanReading:
sourceRefs:
sourcePopulation:
transferLimitations:
allowedEventGroups:
allowedExperienceBands:
minorAllowed:
guardianOrCoachReview:
paceAnchorKinds:
warmup:
mainSet:
repetitionRecovery:
setRecovery:
cooldown:
downshiftOptions:
stopConditionCodes:
derivedTotals:
```

`DETAILED_PRESCRIPTION_RECONCILIATION_2026-07-26.md` Section 6의 25개 시드를
출발점으로 사용한다. 각 항목을 원문에서 다시 확인하고 다음 상태 중 하나를 붙인다.

```text
DIRECT_SOURCE_EXAMPLE
SOURCE_ADAPTED
POPULATION_INDIRECT
PRODUCT_VARIANT
REJECTED_OR_UNUSABLE
```

직접 출처가 없거나 대상 전이가 부적절한 항목을 숫자만 그럴듯하게 채우지 않는다.
거부된 시드도 이유와 함께 남긴다.

## 6. 작업 D: 페이스 앵커 계산기와 표기 파서

PR #120이 main에 병합된 뒤 코드 작업을 시작한다.

권장 경로:

```text
impl/src/plan-generator/prescription/
app/src/domain/plan-prescription/
```

기존 구조에 더 적합한 경로가 있으면 변경할 수 있지만 보고서에 이유를 쓴다.

### 6.1 같은 종목 RP 계산

```text
targetRepSeconds =
  anchorPerformanceSeconds × repetitionDistanceMeters / anchorEventDistanceMeters
```

규칙:

- 계산 내부값을 먼저 반올림하지 않는다.
- 화면 반올림 정책에 버전을 붙인다.
- 기록 종목과 `@RP` 종목이 다르면 `CROSS_EVENT_MODEL_REQUIRED`.
- `GOAL`은 `GOAL RP`, `PB`는 `PB RP`, `SB`는 `SB RP`라고 표시한다.
- 목표 기록을 현재 능력으로 저장하거나 설명하지 않는다.
- PB/SB/최근기록이 오래되었는지는 사실 상태로 표시하고 조용히 폐기하거나 최신으로
  가정하지 않는다.
- 앵커가 없으면 RPE/감각 기준 후보만 만들며 페이스를 추정하지 않는다.

### 6.2 표기 파서/포매터

최소 지원:

```text
2×(10×400m) @5000m RP · r60″ · R3′
10×400m @5K RP · r60″
4×1600m @T · r60″
3×30m · r3′ 완전 회복
20~30′ @E
```

화면 포매터는 축약 표기와 쉬운 한국어 풀이를 함께 반환한다. 스크린리더는 기호
문자열 대신 완문 풀이를 읽는다.

30m/50m 스프린트에는 5000m RP 또는 T/I 변환을 적용하지 않는다.

### 6.3 필수 회귀 테스트

`2×(10×400m) @5000m RP · r60″ · R3′`에 대해:

```yaml
expected:
  totalRepetitions: 20
  qualityDistanceM: 8000
  repetitionRecoveryOccurrences: 18
  setRecoveryOccurrences: 1
  plannedRecoverySeconds: 1260
  plainKoreanReadingContains:
    - 400미터
    - 10번
    - 60초
    - 3분
    - 한 세트 더
    - 총 20번
```

추가 실패 테스트:

- 0세트, 0반복, 음수 거리
- `r`와 `R` 혼동
- 거리와 시간 반복을 동시에 넣은 모순
- 기록 종목과 RP 종목 불일치
- 목표 기록을 PB로 표시
- PB/최근기록에 `achievedAt` 또는 `sourceRef`가 없음
- SB에 `achievedAt`, `seasonId` 또는 `sourceRef`가 없음
- GOAL의 `purpose`가 `CURRENT_CAPABILITY`로 변환됨
- 30m 스프린트에 5K RP 적용
- 워밍업/쿨다운을 질적 반복 총거리에 이중 계산
- 복합 세션 parent/component 중복
- D9 `ACTIVE` 또는 `UNKNOWN`인데 상세 처방 생성
- 원문 메모에서 페이스나 통증 상태 추정

## 7. 작업 E: Plan Generator와 Template Library 바인딩

대상 문서를 실제로 열고 현재 open issue 표를 재계수한 뒤에만 수정한다.

```text
specs/active/PLAN_GENERATOR_SPEC.md
specs/active/TEMPLATE_LIBRARY_SPEC.md
specs/reconstruct/TRAINING_PLAN_FORMATION_AND_ADAPTATION_SPEC.md
```

기본 방향:

1. Template Library가 구조화 처방 템플릿과 버전을 소유한다.
2. Safety Gate가 통과한 뒤에만 Generator가 적격 템플릿을 조회한다.
3. Generator는 선수의 명시적 기록 앵커와 선택된 템플릿을 결합한다.
4. Formation은 9.5일 안의 MAIN/SUPPORT/RECOVERY 배치와 중복을 관리한다.
5. PR #121 calibration은 수행 후 비교 주석만 만든다.
6. 코치 강제 검토 설정이 없으면 적격 자기 주도 사용자는 기본안을 받을 수 있다.
7. 코치 강제 검토 설정이 있거나 청소년 숫자 템플릿 정책이 요구하면 실행 전 사람
   확인을 요구한다.

템플릿 상태 회귀 테스트:

- `lifecycleStatus=DRAFT`는 Template Library 적격 조회 결과에서 제외한다.
- `eligibilityStatus=REVIEW_REQUIRED`는 Generator가 직접 바인딩하거나 자동 선택할 수 없다.
- ACTIVE가 아닌 `templateRef` 직접 주입은 `TEMPLATE_NOT_ACTIVE`로 거부한다.
- 독립 승인된 ACTIVE 숫자 템플릿이 없으면 공개 Plan Beta는 반복·거리·페이스·회복을
  계속 `미지정`으로 표시한다.

절대 이슈 종결 금지:

- 런타임 증거 없이 RVE/Safety Gate binding 종결
- DRAFT lifecycle 또는 REVIEW_REQUIRED eligibility 템플릿을 ACTIVE로 승격
- 문서 self-check를 실제 처방 실행 증거로 주장

## 8. 작업 F: UI 연결

PR #115가 제안한 3층 정보 구조를 PR #120의 현재 런타임 진실 경계와 결합해
유지한다.

1. 쉬운 이름과 에너지 의도 배지
2. `2×(10×400m) @5000m RP · r60″ · R3′`
3. 접힌 한국어 풀이, 목적, 준비, 줄이는 방법, 중단 조건

도움말 필수 토큰:

- `@5000m RP`
- `PB RP`, `SB RP`, `GOAL RP`
- 소문자 `r`
- 대문자 `R`
- 세트와 반복
- 완전 회복
- BASE/LT/VO2/GLY/ATP-PC는 계획 의도이며 생리 측정 결과가 아니라는 설명

화면은 "이 훈련이 가장 과학적", "안전이 확인됨", "회복 완료"라고 말하지 않는다.

## 9. 안전·개인정보 불변식

```yaml
invariants:
  D9_ACTIVE_blocks_generation: true
  D9_UNKNOWN_blocks_or_requires_human_review: true
  D9_CLEARED_is_not_medical_clearance: true
  good_log_or_physio_data_cannot_clear_D9: true
  coach_range_cannot_clear_D9: true
  template_cannot_clear_D9: true
  raw_free_text_not_used_for_dose: true
  raw_symptom_clause_not_stored_in_audit: true
  no_silent_goal_to_current_capability_conversion: true
  no_automatic_upward_adjustment_from_calibration: true
  no_reward_for_training_volume_or_unsafe_streak: true
```

품질 세션과 스프린트에는 구조화된 워밍업, 하향 조정, 중단 조건을 요구한다.
이 조건은 의료 조언이나 부상 예방 보장을 뜻하지 않는다.

## 10. 산출물

필수:

```text
reports/review/DETAILED_PRESCRIPTION_PR_RECONCILIATION_RESULT.md
specs/reconstruct/TRAINING_SESSION_PRESCRIPTION_CONTRACT.md
specs/reconstruct/ENERGY_SYSTEM_SESSION_TEMPLATE_CATALOG.md
impl/src/plan-generator/prescription/*
app/src/domain/plan-prescription/*
관련 단위/계약/브라우저 테스트
reports/implementation/DETAILED_PRESCRIPTION_TERRA_IMPLEMENTATION_REPORT.md
```

조건부:

- PR #120 미병합 시 UI 파일 변경은 제외
- 사람 검토 전 템플릿은 코드에서도 `DRAFT` 또는 `REVIEW_REQUIRED`
- 상세 수치가 아직 활성화되지 않았다면 공개 앱에서는 계속 "미지정"이라고 표시

## 11. 검증 명령

실제 `package.json`과 CI에서 명령을 다시 확인한다. 존재하지 않는 명령을 추정하지
않는다. 최소한 다음 계열을 실행한다.

```text
app typecheck
app unit/contract tests
impl plan-generator tests
spec contract tests
Playwright Plan Beta mobile 320/375 and desktop
git diff --check
```

브라우저 시나리오:

1. 5000m PB 입력 → 400m RP 계산과 출처 표시
2. 5000m GOAL 입력 → 같은 숫자여도 `GOAL RP`로 표시
3. 기록 없음 → 숫자 페이스 없음, RPE 기준
4. 30m 스프린트 → 5K RP 변환 없음
5. D9 차단 → 템플릿/후보/숨은 대안 모두 없음
6. 상세 카드 → 축약 표기와 한국어 풀이 일치
7. 320px → 가로 넘침, 도움말 고아 배치, 버튼 겹침 없음

## 12. Git과 PR

커밋은 최소 두 개로 나눈다.

1. 계약·카탈로그·정합성 문서
2. 파서·계산기·UI·테스트

PR 본문에 다음을 링크한다.

- PR #115
- PR #120
- PR #121
- 이 작업지시서가 들어간 PR
- 실행한 테스트와 실제 결과
- 템플릿 활성화가 아직 금지인지 여부
- 사람 검토 대기 항목

다른 작업자의 변경을 되돌리지 않는다. `main`을 직접 수정하지 않는다. 강제 푸시,
자동 병합, 자동 배포를 하지 않는다.

## 13. 완료 조건

```yaml
stop_when:
  - 25개 이상 에너지 의도 템플릿이 출처와 전이 한계를 가진 DRAFT 카탈로그로 존재
  - 5개 이상 회복/휴식 지원 템플릿이 별도 축으로 존재
  - 상세 처방 구조화 계약이 Template Library와 Generator 경계를 보존
  - 책임자 표기 fixture가 정확히 20회/8000m/1260초 회복으로 테스트 통과
  - PB/SB/GOAL/최근기록/RPE가 구분되고 같은 종목 RP 공식이 테스트됨
  - 30m 스프린트가 거리 RP 공식에서 분리됨
  - D9 fail-safe 테스트 통과
  - 템플릿은 사람 승인 전 ACTIVE가 아님
  - PR이 열리고 CI 결과와 남은 사람 결정이 기록됨
```

Route: OWNER -> Terra xhigh -> Sol high safety/scientific diff review -> OWNER/HUMAN_REVIEWER -> Terra

[DRAFT_COMPLETE]
