# AGENTS.md — AI 작업자 필수 규칙

> **이 파일은 이 저장소에서 일하는 모든 AI 작업자가 작업 시작 전에 읽는다.**
> 사람 작업자에게도 그대로 적용된다.

```yaml
문서지위: AI_작업자_진입점
상위문서: PRODUCT_NORTH_STAR.md   # 충돌 시 North Star가 이긴다
```

---

## 0. 30초 요약 — 이것만은 반드시

1. **[`PRODUCT_NORTH_STAR.md`](./PRODUCT_NORTH_STAR.md)를 먼저 읽는다.** 예외 없다.
2. **훈련·페이스·강도·기록·계획·안전에 손대면, 코드를 열기 전에 §2 표에서
   해당 스펙 문서를 찾아 읽는다.** 이건 권고가 아니라 차단 조건이다.
3. **모르면 멈추고 오너에게 묻는다.** 훈련 도메인 숫자를 작업자가 정하지 않는다.

---

## 1. 왜 이 파일이 존재하는가

이 저장소는 문서가 코드의 두 배가 넘는다(277 : 128). 그 문서들은 참고
자료가 아니라 **하드코딩된 규칙**이다. README와 North Star가 그렇게 못
박아 뒀다.

> "이 문서들은 하드코딩이다. 코드가 아직 안 쓰였을 뿐, 규칙 자체는 이미
> 정해진 것이다." — `PRODUCT_NORTH_STAR.md` §2

그런데 실제로는 **스펙 문서를 읽지 않고 훈련 관련 코드에 손대는 일이
반복됐다.** North Star §6에 "작업 전에 관련 스펙 문서를 연다"가 이미 적혀
있었지만, 6단계 중 3번째 줄에 묻혀 있어서 놓치기 쉬웠다.

그래서 이 파일을 만들었다. **어느 모듈이 어느 스펙 문서에 묶여 있는지
찾아보는 표**(§2)가 핵심이다. "관련 스펙 문서를 읽어라"는 말만으로는
부족하다. **어느 문서인지 알려줘야 실제로 읽는다.**

---

## 2. 🔴 모듈 → 스펙 문서 라우팅 표 (훈련 영역)

**아래 파일 중 하나라도 열거나 수정하거나 테스트를 쓴다면, 오른쪽 문서를
먼저 읽는다.**

| 코드 | 반드시 먼저 읽을 스펙 | 상태 |
|---|---|---|
| `intensity-summary.ts`, `intensity-assessment.ts` | [`specs/active/SESSION_INTENSITY_ASSESSMENT_SPEC.md`](./specs/active/SESSION_INTENSITY_ASSESSMENT_SPEC.md) | ✅ 활성 |
| `athlete-record-display.ts`, `athlete-records.ts` | [`WORK_ORDER_P1_ATHLETE_RECORDS.md`](./WORK_ORDER_P1_ATHLETE_RECORDS.md) (작업지시·구속력 있음), [`specs/active/ATHLETE_PROFILE_SPEC.md`](./specs/active/ATHLETE_PROFILE_SPEC.md) | ⚠️ 초안 |
| `pace-target-evidence.ts`, `pace-target-plan.ts` | [`WORK_ORDER_P3_PACE_WIRING.md`](./WORK_ORDER_P3_PACE_WIRING.md), [`DECISION_BRIEFING_PERSONAL_PACE.md`](./DECISION_BRIEFING_PERSONAL_PACE.md) | ⛔ 오너 결정 대기 |
| `plan-beta-*.ts`, `plan-proposals.ts`, `plan-session-schema.ts` | [`specs/active/PLAN_GENERATOR_SPEC.md`](./specs/active/PLAN_GENERATOR_SPEC.md), [`TRAINING_PLAN_METHOD_DECISION.md`](./TRAINING_PLAN_METHOD_DECISION.md) | ⚠️ 초안 |
| `objective-fatigue-evidence.ts`, `fatigue-vector.ts` | [`specs/reconstruct/OBJECTIVE_FATIGUE_EVIDENCE_CONTRACT.md`](./specs/reconstruct/OBJECTIVE_FATIGUE_EVIDENCE_CONTRACT.md) | ⚠️ 비런타임 초안 |
| 위험신호·안전 게이트 관련 무엇이든 | [`specs/active/RULE_SPEC_D1_D9.md`](./specs/active/RULE_SPEC_D1_D9.md) | 🟡 업로드 준비 |
| `private-memo-vault.ts`, `journal-observation.ts` 등 일지 원문 | [`specs/reconstruct/NOTE_SAFETY_SIGNAL_AND_REVIEW_STATE_CONTRACT.md`](./specs/reconstruct/NOTE_SAFETY_SIGNAL_AND_REVIEW_STATE_CONTRACT.md), [`FORMATION_PRIVACY_GOVERNANCE_DECISION.md`](./FORMATION_PRIVACY_GOVERNANCE_DECISION.md) | ⚠️ 검토 대기 |
| `field-provenance.ts`, `safe-export.ts` | [`DATA_PROVENANCE_RUNTIME_ADOPTION_DECISION.md`](./DATA_PROVENANCE_RUNTIME_ADOPTION_DECISION.md) | ✅ 결정 완료 |
| `aggregates.ts`, `weekly-distance.ts`, `trend-analysis.ts` | [`specs/reconstruct/METRIC_ALGORITHM_CONTRACT.md`](./specs/reconstruct/METRIC_ALGORITHM_CONTRACT.md), [`specs/reconstruct/ANALYSIS_AND_VISUALIZATION_DATA_CONTRACT.md`](./specs/reconstruct/ANALYSIS_AND_VISUALIZATION_DATA_CONTRACT.md) | ⚠️ 초안 |
| 세션 분류 | [`specs/active/SESSION_CLASSIFIER_SPEC.md`](./specs/active/SESSION_CLASSIFIER_SPEC.md) | 🟡 업로드 준비 |
| 템플릿 | [`specs/active/TEMPLATE_LIBRARY_SPEC.md`](./specs/active/TEMPLATE_LIBRARY_SPEC.md) | ⚠️ 상태 표기 없음 |

### 🔴 `specs/active/` 폴더에 있다고 활성 계약이 아니다

**폴더 이름을 믿지 말고 문서 첫머리 YAML의 `status`를 직접 확인한다.**
실측(2026-08-05): `specs/active/` 9개 중 `ACTIVE_IMPLEMENTATION_CONTRACT`는
**단 1개**(`SESSION_INTENSITY_ASSESSMENT_SPEC.md`)뿐이다. 나머지는
`DRAFT_FOR_REVIEW`, `READY_FOR_UPLOAD`이거나 상태 표기가 아예 없다.

```bash
grep -m1 "^status:" specs/active/<파일>.md
```

| status 값 | 이 문서를 근거로 코드를 바꿔도 되는가 |
|---|---|
| `ACTIVE_IMPLEMENTATION_CONTRACT` | **가능.** 구현이 이 계약을 지켜야 한다 |
| `READY_FOR_UPLOAD` / 표기 없음 | **현재 동작 파악용으로만.** 바꾸려면 오너 확인 |
| `DRAFT_FOR_REVIEW`, `DRAFT_NON_RUNTIME_CONTRACT`, `QUALIFIED_REVIEW_PENDING` | **불가.** 초안이다. 특히 `canonical_promotion_allowed: false`면 확정 규칙이 아니다 |

**초안을 근거로 런타임 동작을 바꾸지 않는다.** 초안과 현재 구현이 다르면
그건 버그가 아니라 **미결정 사항**이다. 고치지 말고 차이를 보고한다.
초안에 적힌 값을 확정 규칙으로 착각하는 것은 North Star §5 사례 5와
같은 종류의 실수다.

표에 없는 훈련 관련 파일을 만졌다면:

```bash
# 1) 색인에서 찾는다
grep -rn "<개념어>" TRAINORACLE_SPEC_INDEX.md DOCUMENT_MAP.md
# 2) 스펙 본문에서 찾는다
grep -rln "<함수명|상수명>" specs/ *.md
```

**찾지 못했으면 "스펙이 없다"고 결론 내리지 말고 그 사실을 보고한다.**
North Star §5 사례 3이 정확히 그 실수다 — 이미 있는 걸 없다고 판단한 것.

---

## 3. 스펙 문서를 읽을 때의 규칙

- **이름만 보고 추측하지 않는다.** 금지 규칙은 본문을 열어 *정확히 무엇을*
  막는지 확인한다. (North Star §5 사례 2: `GOAL_ANCHOR_FORBIDDEN`을 넓게
  오해한 실제 사고)
- **"문서에 값이 있다" ≠ "코드가 그 값을 읽을 수 있다."** 연결 작업 전에
  실제로 넣어서 돌려 본다. (사례 5: 카탈로그 30개 중 0개 통과)
- **스펙이 테스트 표를 이미 적어 놨으면 그 표를 그대로 테스트로 옮긴다.**
  예: `WORK_ORDER_P1_ATHLETE_RECORDS.md` §7.2는 `today = 2026-07-27` 기준
  기대값 표를 갖고 있다. 새로 지어내지 않는다.
- **스펙과 코드가 다르면 임의로 어느 쪽에 맞추지 않는다.** 차이를 보고한다.

---

## 4. 절대 넘지 않는 선 (North Star §3 요약 — 원문이 우선)

```yaml
몸상태_이상시: 계획_생성_차단
일지_원문_서버전송: 금지
일지_원문_모델컨텍스트: 금지
60m미만_스프린트_페이스환산: 금지
종목간_환산: 오너승인_없이_금지
오래된기록: 침묵하고_계산하지_말_것_반드시_명시
미검토_템플릿: 활성화_금지
실패시_동작: 항상_안전한_쪽으로_폴백
  범용_피로점수: 금지               # SESSION_INTENSITY_ASSESSMENT_SPEC
```

**폴백 원칙: 실패하면 덜 보여준다.** 못 보여주는 건 불편이지만, 잘못
보여주면 부상이다.

---

## 5. 테스트를 쓸 때 — 공허한 테스트 금지

이 저장소는 **결함 주입으로 증명되지 않은 테스트를 신뢰하지 않는다.**

```bash
# 1) 테스트를 쓴다
# 2) 대상 코드에 일부러 결함을 넣는다
# 3) 그 테스트가 "이름으로" 실패하는지 확인한다  ← 개수 비교로는 부족
# 4) 코드를 되돌린다
git diff --stat        # 반드시 비어 있어야 한다
```

**결함을 넣어도 통과하는 테스트는 공허하다. 고치는 게 아니라 지운다.**

실패 개수는 증거가 아니다. 실패 *이름*을 비교한다:

```bash
npx vitest run 2>&1 | sed 's/\x1b\[[0-9;]*m//g' \
  | grep -E "^ FAIL" | sed 's/^ FAIL  //' | sort -u > /tmp/mine.txt
comm -13 /tmp/base-names.txt /tmp/mine.txt   # 비어 있어야 내 탓이 아니다
```

### 도구 자체가 거짓말하는 경우 — `npx tsc` 금지

`impl/`에 `node_modules`가 없는 상태에서 `npx tsc --noEmit`을 돌리면 npm이
레지스트리에서 **TypeScript와 무관한 `tsc@2.0.4` 패키지**를 받아 실행하고
**exit 0을 준다.** 이걸 "타입체크 통과"로 읽으면 타입 방어가 전부 사라진 것을
못 본다. 2026-08-05에 실제로 이 함정에 빠져 "impl 테스트 9건이 헛돈다"는
잘못된 판정을 냈다.

```bash
# ✗ 하지 않는다
cd impl && npx tsc --noEmit

# ✓ 둘 중 하나로 한다
cd impl && npm ci && npm run typecheck
cd impl && ./node_modules/.bin/tsc --noEmit
```

**검증 도구가 통과를 줬을 때, 그 도구가 진짜인지 먼저 의심한다.**
너무 빨리 끝났거나 오류가 하나도 없으면 도구가 실행되지 않은 쪽을 먼저 본다.

또한 `npm test`는 **UTC와 KST 두 번** 돈다(`vitest.config.kst.ts`).
`new Date(iso)`는 UTC로, `new Date(y, m-1, d)`는 로컬로 파싱된다 — 이
차이는 UTC와 KST 양쪽에서 값 비교로는 안 잡힌다. 날짜 함수 테스트는
`getHours() === 0`처럼 **로컬 자정에 있는지를 직접 단언한다.**

---

## 6. 커밋·공개 규칙

- **브랜치를 새로 파지 않는다. `main`에서 작업하고 바로 커밋·푸시한다.**
  샌드박스는 리셋되면 휘발된다. 푸시 안 한 것은 잃은 것이다.
- 보고는 **한국어**로 한다.
- `.github/workflows/` 는 에이전트 토큰에 `workflows` 권한이 없어 **쓸 수
  없다.** CI 동작을 바꿔야 하면 `app/package.json`의 스크립트를 고친다
  (CI가 `npm test`를 호출한다).

---

## 7. 판단이 서지 않을 때

**멈추고 오너에게 묻는다.** 훈련 도메인 판단(종목, 환산 모델, 미성년 정책,
기록 유효기간)은 작업자가 정하지 않는다. 임의로 정한 숫자는 근거 없는 훈련
처방이 되고, 그건 선수에게 위험하다.

모르면 `판단보류`로 남기고 올린다. 그게 정답이다.

**변호하면서 "괜찮은 것 같다"고 스스로 승인하지 않는다.**

### 슬롯별 강도 배치는 이미 정해져 있다

고강도(QUALITY) 세션의 오전·오후 배치는 오너가 2026-08-06에 결정했다.
**오전 고정은 금지다.** 훈련 코드를 만지기 전에 반드시 읽는다:

- [`OWNER_DECISION_SESSION_SLOT_INTENSITY_2026_08_06.md`](OWNER_DECISION_SESSION_SLOT_INTENSITY_2026_08_06.md)

`specs/reconstruct/DOUBLE_SESSION_BETA_SAFETY_CONTRACT.md`의 `DSB-INV-002`
(PM은 회복 전용)와 `DSB-INV-003`(같은 날 quality 짝 금지)은 이 결정에 밀린다.
**그 초안을 근거로 오후 고강도를 다시 막지 않는다.**

---

**이 제품은 사람의 훈련과 몸을 다룬다. 깊고 진중하게 작업한다.**
