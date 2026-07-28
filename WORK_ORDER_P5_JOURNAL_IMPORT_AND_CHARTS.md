# 작업지시서 P5 — 일지 불러오기 + 분포·그래프·통계

**작성일:** 2026-07-27
**받는 사람:** 하위 에이전트 (P1 병합 후 착수)
**선행조건:** `WORK_ORDER_P1_ATHLETE_RECORDS.md` 병합 완료
**근거:** [`OWNER_DECISION_ANCHOR_CHOICE_2026-07-27.md`](./OWNER_DECISION_ANCHOR_CHOICE_2026-07-27.md) §4, §6

---

## §0-Z 공격 리뷰 결과 — 🔴 치명 3 · 중대 3 · 보통 2 (D1~D8)

**리뷰:** [`reports/review/WORK_ORDER_AGGRESSIVE_REVIEW_2026-07-28.md`](./reports/review/WORK_ORDER_AGGRESSIVE_REVIEW_2026-07-28.md) · 2026-07-28

**착수 금지.** §1 의 개방 근거(`adoption_authority`, `before_separate_adoption`)가
무효다 — 실제 스펙 값은 `false` 이고, 인용한 키는 다른 YAML 블록(필드 제안) 소속이다.
§2-2 타입으로는 §2-3 화면을 만들 수 없고, §3-2(평균)와 §4-1(중앙값)이 충돌한다.
§2-1 파일 목록이 완료 기준의 절반을 빠뜨렸다. §5-3 grep 경로는 존재하지 않는다.

**착수 전 반드시 위 리뷰의 §0-A(결함표)·§0-B(고칠 것)를 읽고 지시서를 먼저 고친다.**

---

## 0. 오너가 요구한 것

> "다만 일지를 완전 분리하는 것보단 훈련 계획에 참고하기 위해 결과 분포도나
> 통계, 비교나 구성 가능하도록 불러오기 기능을 넣자. 끝까지 막아내기 보다는,
> 필요시와 요구시에는 열어도 돼. 이건 단순 선택일 뿐이잖아."

> "기록이나 자료가 많은 사람들은 아까말한 분포도나 그래프 통계적으로 보면서
> 파악할수있도록."

두 가지를 만듭니다.

1. **일지 불러오기** — 이미 쓴 일지의 **구조화된 수치**를 훈련 계획 화면에서
   참고용으로 불러온다
2. **분포·그래프·통계** — 기록이 쌓인 사용자가 자기 데이터를 눈으로 본다

---

## 1. 먼저 알아야 할 것 — 왜 이 작업이 P1 다음인가

이 작업은 **스펙이 조건부로 막아 둔 영역**을 건드립니다.
그래서 시작 전에 두 문서를 반드시 읽습니다.

| 읽을 것 | 왜 |
|---|---|
| `specs/reconstruct/ANALYSIS_AND_VISUALIZATION_DATA_CONTRACT.md` | 그래프·통계의 지배 계약 |
| `specs/reconstruct/DAILY_LOG_AND_CHECKIN_SPEC.md` L600-700 | 일지 활용의 조건부 허용 조항 |

### 이 작업이 열려 있는 이유

스펙의 금지 조항은 **무조건 금지가 아닙니다.** 조항 이름 자체가
`before_separate_adoption` 입니다. 그리고:

```yaml
adoption_authority: COACH_HOJUNE
future_persistence_allowlist_after_separate_adoption:
  # 스펙이 "나중에 열 때 필요한 것"을 미리 적어 뒀다
```

오너가 결정하셨으므로 `adoption` 조건은 충족됐습니다.

### 그래도 하나는 무조건 금지입니다

```yaml
plan_generator_raw_text: forbidden      # 조건 없음
```

**일지에 사람이 손으로 쓴 문장이 훈련 계획의 숫자로 흘러가는 경로는
어떤 경우에도 만들지 않습니다.** 이건 오너 결정으로도 열리지 않습니다.

오너가 요구한 4가지는 **전부 구조화된 숫자**입니다. 원문 문장은
한 군데도 필요하지 않습니다.

| 오너 요구 | 필요한 데이터 | 원문 필요? |
|---|---|---|
| 분포도 | 거리·시간·페이스·RPE 숫자 | 아니오 |
| 통계 | 위 숫자의 평균·중앙값·개수 | 아니오 |
| 비교 | 두 구간의 같은 숫자 | 아니오 |
| 구성 | 강도 시스템별 세션 수 | 아니오 |

---

## 2. 만들 것 — 파트 A: 분포·그래프·통계 화면

### 2-1. 새 파일

```
app/src/domain/record-analysis.ts              계산 (순수 함수만)
app/src/domain/record-analysis.contract.test.ts
app/src/screens/records/RecordDistribution.tsx  화면
```

`impl/` 은 건드리지 않습니다.

### 2-2. 계산 함수 — 계약이 강제하는 형태

지배 계약 §12 `aggregation_policy` 를 그대로 옮깁니다.

```yaml
hidden_interpolation_allowed: false
missing_point_behavior: show_missing_or_insufficient
```

그래서 집계 결과 타입에 **빈 구간을 표현하는 자리가 반드시 있어야** 합니다.

```ts
/** 한 구간의 집계 결과. 데이터가 없으면 없다고 말한다. */
export type Bucket =
  | {
      readonly kind: "DATA"
      readonly label: string        // "2026-05" 같은 구간 이름
      readonly n: number            // 표본 수. 항상 화면에 나온다
      readonly medianSeconds: number
      readonly minSeconds: number
      readonly maxSeconds: number
      readonly sourceRefs: readonly string[]   // 원본 기록 id
    }
  | {
      readonly kind: "MISSING"     // 이 구간에 기록이 없다
      readonly label: string
    }

/**
 * 기록을 월 단위 구간으로 묶는다.
 * 빈 달은 MISSING 으로 남긴다. 앞뒤 값으로 채우지 않는다.
 */
export function bucketByMonth(
  records: readonly AthleteRecord[],
  today: Date,                    // 테스트 가능하게 반드시 인자로 받는다
  monthsBack: number,             // 기본 18 — 오너 정책 값
): readonly Bucket[]
```

🔴 **`kind: "MISSING"` 을 그래프에서 0으로 그리지 마십시오.**
0은 "기록이 0초"라는 뜻이 되어 버립니다. **선을 끊습니다.**

### 2-3. 화면에 반드시 함께 나오는 것

계약 §4 `analysis_visualization_invariants` 가 요구하는 항목입니다.

| 함께 표시 | 계약 조항 |
|---|---|
| 표본 수 `n` | `aggregate_requires_visible_n: true` |
| 데이터 없는 구간을 "없음"으로 | `missing_data_must_be_visible: true` |
| 오래된 데이터 표시 | `stale_data_must_be_visible: true` |
| 출처 (어느 기록에서 나왔는지) | `source_refs_required: true` |

화면 예:

```
5000m 기록 분포 · 최근 18개월           [범위 바꾸기]

  19:20 ┤        ●
  19:00 ┤   ●         ╌╌   ●
  18:40 ┤                       ●
        └──┬────┬────┬────┬────┬──
          2월  3월  4월  5월  6월

  4월: 기록 없음
  표본 6개 · 출처 기록 6건 보기
```

`╌╌` 는 끊긴 선입니다. 4월을 3월과 5월 사이 값으로 채우지 않습니다.

### 2-4. 이 화면이 못 하는 것

| 금지 | 계약 조항 |
|---|---|
| 이 화면에서 훈련 계획·후보를 만들기 | `analysis_can_create_plan_options: false` |
| 안전 게이트(D9)를 통과시키기 | `analysis_can_clear_D9: false` |
| 일지 원문을 저장하기 | `raw_free_text_storage_forbidden: true` |
| 빈 구간을 이어 붙이기 | `hidden_interpolation_allowed: false` |
| "컨디션 좋음/나쁨" 판정 | `readiness_threshold: PROHIBITED` |
| "부상 위험 N%" | `injury_risk_threshold: PROHIBITED` |

그래프에서 계획으로 가는 버튼을 두고 싶어지면, **그 버튼은 기존 훈련계획
화면으로 이동만** 시킵니다. 그래프가 계획 내용을 정하지 않습니다.

### 2-5. 개수 임계값을 만들지 않습니다

오너가 "기록이 많은 사람들은" 이라고 하셨지만,
**"N개 이상이면 그래프 개방" 같은 조건을 만들지 않습니다.**

```yaml
# FORMATION_LOAD_AND_STATISTICAL_RULES_CONTRACT.md §10
baseline_classification_threshold: UNKNOWN
descriptive_single_observation: allowed
```

기록 1개일 때도 그래프는 켜져 있고, 점 1개와 `표본 1개`가 보입니다.
데이터가 쌓이면 그래프가 저절로 읽을 만해집니다.
**기능을 잠갔다 여는 장치가 필요 없습니다.**

---

## 3. 만들 것 — 파트 B: 일지 불러오기

### 3-1. 무엇을 불러오는가

일지에서 **이미 구조화되어 저장된 숫자만** 불러옵니다.

```ts
/** 일지에서 참고용으로 꺼내오는 값. 원문 문장은 들어오지 않는다. */
export type JournalReference = {
  readonly journalId: string
  readonly loggedOn: string          // "YYYY-MM-DD"
  readonly distanceKm: number | null
  readonly durationMin: number | null
  readonly secondsPerKm: number | null
  readonly rpe: number | null
  readonly energySystemId: string | null
  // record: string (자유 문장) 은 여기에 없다. 넣지 말 것.
}
```

`app/src/domain/journal-schema.ts` 를 **읽기만** 합니다. 수정 금지.

### 3-2. 어디에 쓰는가 — 참고 표시 전용

훈련계획 화면에 **참고 패널**로 붙습니다.

```
훈련계획 후보

  [기존 후보 표시 ...]

  ─────────────────────────
  참고 · 최근 일지에서              [닫기]

  지난 4주 기록 12건
    평균 페이스   4:32 /km   (표본 12개)
    강도 구성     BASE 8 · LT 3 · VO2 1

  이 숫자는 참고용이고 위 후보를 만들 때 쓰이지 않았어요.
```

🔴 **마지막 문장을 빼지 마십시오.** 계약이 요구하는 표시입니다.
이 패널의 숫자는 후보 생성에 **들어가지 않습니다.**

### 3-3. 계획 생성기에 연결하지 않는 이유

```yaml
# TRAINING_PLAN_FORMATION_AND_ADAPTATION_SPEC.md L398-422
formation_source_invariants:
  raw_text_quote_summary_token_or_embedding: reject
  analyzable_note_structured_derivative_before_separate_plan_adoption: reject
```

두 번째 조항이 중요합니다. **구조화된 파생값이라 해도, 계획 생성기에
넣으려면 "별도의 계획 채택" 이 필요합니다.** 오너 결정으로 열린 것은
"불러와서 **보여주기**" 까지입니다.

같은 스펙 L437 이 필요한 것을 열거해 뒀습니다.

> "A future plan-eligible note derivative requires a separate owner decision,
> schema, consent purpose, retention rule, test package, and Plan Generator
> adoption"

**6가지가 다 필요합니다.** P5는 그중 아무것도 하지 않습니다.
그래서 P5의 결과물은 **화면 표시로 끝납니다.**

계획 생성기에 연결하고 싶으면 **오너에게 다시 물어봅니다.** 그게 P6입니다.

### 3-4. 동의 처리

일지에는 **용도가 붙어 있습니다** (`journal-schema.ts` L13-14).

| 일지 용도 | 불러오기 |
|---|---|
| `analyzableTrainingNote` | ✅ 숫자만 |
| `privateSelfOnly` | ❌ 아예 목록에 넣지 않음 |

`privateSelfOnly` 는 사용자가 "나만 볼 것" 으로 표시한 일지입니다.
**개수 집계에도 넣지 않습니다.** 몇 개가 있는지도 알려주지 않습니다.

---

## 4. 함수 검증 절차 — 다음 작업자가 리뷰할 수 있게 남긴다

서명만 보면 왜 이 모양인지 알 수 없다. 리뷰하는 사람이 계약 문서를
처음부터 다시 읽지 않아도 되게, **근거 → 손으로 검산 → 리뷰 체크**
순서로 남긴다. 이 절의 표를 **보고서에 실제 값으로 채워서** 낸다.
빈칸이 있으면 리뷰가 반려된다.

### 4-1. `bucketByMonth` 근거 추적표

| 서명 요소 | 이렇게 만든 근거 | 다르게 만들면 생기는 일 |
|---|---|---|
| 반환 타입이 `DATA \| MISSING` 유니온 | 시각화 계약 §12 `missing_point_behavior: show_missing_or_insufficient` | 하나의 타입으로 만들면 빈 달에 `0`이나 `null`이 들어가고, 화면이 0초로 그린다 |
| `MISSING` 쪽에 `medianSeconds` 자리가 **없음** | 같은 조항 `hidden_interpolation_allowed: false` | 자리가 있으면 나중에 누가 채운다. 타입이 못 채우게 막아야 한다 |
| `DATA` 에 `n` 이 필수 | 부하 계약 §10 `aggregate_requires_visible_n: true` | 평균만 보이면 표본 1개짜리 평균을 12개짜리로 착각한다 |
| `DATA` 에 `sourceRefs` 가 필수 | 시각화 계약 §4 `source_refs_required: true` | 숫자가 어디서 나왔는지 되짚을 수 없다 |
| `today: Date` 를 인자로 받음 | 이 저장소에서 `new Date()` 직접 호출로 CI가 깨진 적 있음 | 테스트가 실행 시각에 따라 붙었다 떨어졌다 한다 |
| `monthsBack` 을 인자로 받음 | 18은 오너 정책 값 (P1 §3-3-2). 화면이 범위를 바꿀 수 있어야 함 | 함수 안에 `18`이 박히면 "범위 바꾸기" 버튼을 만들 수 없다 |
| 평균이 아니라 **중앙값** | 기록 하나가 크게 튀면 평균이 끌려간다. 표본이 적을 때 더 심하다 | 부상 복귀 직후 한 번 느린 기록이 그 달 전체를 느리게 만든다 |
| 반환값에 판정 문자열이 없음 | 부하 계약 §10 `readiness_threshold: PROHIBITED` | "좋아지는 중" 같은 말이 붙으면 금지된 판정이 된다 |

### 4-2. 손으로 검산하는 표 — 코드 없이 먼저 채운다

**코드를 쓰기 전에** 이 표를 손으로 채우고, 그 다음 테스트를 이 표대로
쓴다. 순서를 바꾸면 코드가 낸 답을 정답으로 믿게 된다.

`today = 2026-07-27`, `monthsBack = 4` 로 고정한다.
입력 기록 (전부 5000m):

```
r1  2026-07-05  19:20  (= 1160초)
r2  2026-06-11  19:02  (= 1142초)
r3  2026-06-25  18:44  (= 1124초)
r4  2026-04-02  19:30  (= 1170초)
```

`2026-05` 에는 기록이 없다.

| 구간 | 기대 `kind` | 기대 `n` | 손으로 계산한 `medianSeconds` | 기대 `min` / `max` | 기대 `sourceRefs` |
|---|---|---|---|---|---|
| 2026-04 | `DATA` | 1 | 1170 | 1170 / 1170 | `["r4"]` |
| 2026-05 | `MISSING` | — | **키 자체가 없음** | — | — |
| 2026-06 | `DATA` | 2 | 1133 | 1124 / 1142 | `["r3","r2"]` 또는 `["r2","r3"]` |
| 2026-07 | `DATA` | 1 | 1160 | 1160 / 1160 | `["r1"]` |

2026-06 의 중앙값이 왜 `1133` 인지 보고서에 적는다.
표본이 2개라 짝수이므로 두 값의 가운데를 쓴다: `(1124 + 1142) / 2 = 1133`.
**짝수일 때 어떻게 할지도 한 번 정하고 못 박는다** (아래 4-3).

🔴 **2026-05 줄이 이 함수의 핵심 테스트다.** 여기에 값이 생기면
계약 위반이다. 다음 세 가지를 각각 다른 테스트로 확인한다.

| 확인 | 잘못된 결과 예 |
|---|---|
| `kind` 가 `"MISSING"` 인가 | `"DATA"` 에 `n: 0` |
| `medianSeconds` 키가 **없는가** | `medianSeconds: 0` |
| 앞뒤 평균이 아닌가 | `medianSeconds: 1151` (1170과 1133의 중간) |

### 4-3. 먼저 정해서 적어 둘 것 두 가지

스펙에 없어서 작업자가 정해야 하는 것이다. **정하고, 이유를 코드 주석과
보고서에 적고, 계약 테스트로 잠근다.**

```ts
// (가) 표본이 짝수일 때 중앙값: 두 값의 산술 평균을 쓴다.
//      근거: 통상적인 중앙값 정의. 표시용이고 판정에 쓰이지 않는다.
//
// (나) 구간 경계: 달의 1일 00:00 부터 말일 23:59 까지를 그 달로 본다.
//      근거: 사용자가 "6월 기록" 이라고 말할 때의 뜻과 같다.
//      시간대는 로컬 시간을 쓴다. 기록에 시각이 없으므로 날짜만 본다.
```

**"합리적으로 보이는 쪽"으로 조용히 정하고 넘어가지 않는다.** 정한 걸
적어 두면 다음 사람이 바꿀 때 무엇이 깨지는지 안다.

### 4-4. `JournalReference` 근거 추적표

| 서명 요소 | 이렇게 만든 근거 | 다르게 만들면 생기는 일 |
|---|---|---|
| `record: string` 이 **없음** | 계획 형성 스펙 `plan_generator_raw_text: forbidden` (조건 없는 금지) | 사람이 쓴 문장이 훈련 계획 숫자로 흘러간다. 오너 결정으로도 열리지 않는 금지다 |
| 모든 수치 필드가 `\| null` | 일지는 부분 입력이 가능하다. 안 쓴 칸이 있다 | `0` 으로 채우면 "0km 뛰었다" 가 된다 |
| `journalId` 가 필수 | 시각화 계약 §4 `source_refs_required: true` | 참고 패널 숫자가 어느 일지에서 왔는지 못 되짚는다 |
| 반환에 요약 문장이 없음 | 같은 스펙 `raw_text_quote_summary_token_or_embedding: reject` | 요약·토큰·임베딩도 원문 취급이다. 요약이면 괜찮다고 착각하기 쉽다 |
| 계획 생성기 입력이 아님 | 같은 스펙 L437 — 별도 오너 결정·스키마·동의 목적·보관 규칙·테스트 패키지·채택 6가지 필요 | P5 범위를 넘는다. §3-3 참조 |

### 4-5. `JournalReference` 손으로 검산하는 표

입력 일지 3건:

| 일지 | 용도 | `distanceKm` | `durationMin` | `record` (원문) |
|---|---|---|---|---|
| j1 | `analyzableTrainingNote` | 10 | 45 | `"다리가 무거웠다"` |
| j2 | `privateSelfOnly` | 8 | 40 | `"코치한테 화났다"` |
| j3 | `analyzableTrainingNote` | (미입력) | 30 | `""` |

기대 결과:

| 확인 | 기대값 | 왜 |
|---|---|---|
| 결과 개수 | **2건** (j1, j3) | j2 는 `privateSelfOnly` |
| j2 의 존재 흔적 | **어디에도 없음** | 개수·통계·"1건 제외됨" 문구도 금지 (§3-4) |
| j1 의 `record` | **키 자체가 없음** | 원문은 나오지 않는다 |
| j3 의 `distanceKm` | `null` | 미입력을 `0` 으로 만들지 않는다 |
| j3 의 `secondsPerKm` | `null` | 거리가 없으면 페이스를 만들 수 없다. 추정 금지 |
| `Object.keys()` 전체 | 7개 (§3-1 그대로) | 필드를 늘렸으면 왜 늘렸는지 보고서에 |

🔴 **j2 줄이 이 함수의 핵심 테스트다.** `"나만의 메모 1건은 제외했어요"`
같은 친절한 문구도 만들지 않는다. **몇 개가 있는지도 알려주지 않는다.**

### 4-6. 리뷰하는 사람이 확인할 것 (체크리스트)

리뷰어는 코드 전체를 읽는 대신 이 8개만 본다.

- [ ] 4-1 · 4-4 근거 추적표의 각 줄이 실제 파일·줄번호를 가리키는가
- [ ] 4-2 검산표 4줄이 **테스트 파일에 그대로** 들어가 있는가
- [ ] 4-2 의 `2026-05` 확인 3개가 **각각 별도 테스트**로 있는가
- [ ] 4-3 (가)(나)가 코드 주석과 테스트 양쪽에 같은 값으로 적혀 있는가
- [ ] 4-5 검산표 6줄이 테스트에 들어가 있는가
- [ ] `MISSING` 타입에 수치 키가 하나도 없는가 (타입 정의를 눈으로 확인)
- [ ] `grep -rn "\.record\b" app/src/domain/record-analysis.ts app/src/domain/journal-reference.ts` → 0건
- [ ] `privateSelfOnly` 개수를 세는 코드가 없는가
      (`grep -rn "privateSelfOnly" app/src/domain/journal-reference.ts` 결과를 보고서에)

### 4-7. 막히면 이렇게 남긴다

```ts
// 판단보류: 표본이 짝수일 때 중앙값을 어떻게 낼지 계약에 없다.
// 임시로 두 값의 평균을 쓰고 테스트로 잠갔다.
// 오너 확인 필요. 바꿀 때 고칠 곳: bucketByMonth + 계약 테스트 1건.
```

**혼자 정하고 넘어가지 않는다.** 그게 만료 기준을 만들어 넣은
오판(`PRODUCT_NORTH_STAR.md` §5 사례 6)이 생긴 방식이다.

---

## 5. 테스트 (필수)

### 5-1. `record-analysis.contract.test.ts`

| 테스트 | 확인 내용 |
|---|---|
| 빈 구간이 MISSING 으로 남는다 | 2월·4월 기록, 3월 없음 → 3월이 `kind: "MISSING"` |
| 빈 구간을 0으로 만들지 않는다 | MISSING 구간에 `medianSeconds` 자리가 아예 없는지 |
| 보간하지 않는다 | 3월 값이 2월·4월의 평균이 **아닌지** |
| n 이 항상 있다 | 모든 `kind: "DATA"` 에 `n >= 1` |
| 출처가 항상 있다 | 모든 `kind: "DATA"` 에 `sourceRefs.length === n` |
| 기록 1개도 집계된다 | 1건 → `n: 1` 구간 1개 + 나머지 MISSING |
| 개수 임계값 없음 | 기록 1·2·5·50개 전부 같은 함수 경로를 타는지 |
| 범위는 인자로 받는다 | `monthsBack: 6` 과 `18` 이 서로 다른 결과를 주는지 |
| 시계 고정 | `vi.useFakeTimers()` — `today` 를 인자로 받으므로 검증 가능 |

### 5-2. `journal-reference.contract.test.ts`

| 테스트 | 확인 내용 |
|---|---|
| 원문이 안 실려 나온다 | `JournalReference` 에 `record` 키가 없는지 |
| privateSelfOnly 제외 | 나만의 메모 일지가 결과에 없는지 |
| privateSelfOnly 개수도 노출 안 함 | 반환값 어디에도 그 개수가 없는지 |
| 계획 입력에 안 들어간다 | 후보 생성 결과가 참고 패널 유무와 **똑같은지** |
| 참고 문구가 항상 붙는다 | "후보를 만들 때 쓰이지 않았어요" 가 렌더되는지 |

### 5-3. grep 검사

```bash
# 원문이 분석·계획 경로에 새어 들어갔는지
grep -rn "\.record\b" app/src/domain/record-analysis.ts app/src/domain/journal-reference.ts
#   → 0건

# 금지된 판정어가 화면에 있는지
grep -rniE "컨디션 (좋|나쁨|양호)|부상 위험|준비도|readiness|injuryRisk" app/src/screens/records
#   → 0건

# 그래프가 계획을 만드는지
grep -rn "createPlan\|planCandidate\|generatePlan" app/src/screens/records
#   → 0건
```

---

## 6. 하지 말 것

- `journal-schema.ts` · `journal-store.ts` 수정 — **금지** (읽기만)
- `impl/` 수정 — **금지**
- `specs/` 수정 — **금지**
- 일지 원문을 어디든 새로 저장 — **절대 금지**
- 일지 파생값을 계획 생성기 입력에 연결 — **금지** (§3-3, P6 대상)
- 빈 구간을 0·앞값·뒷값·평균으로 채우기 — **금지**
- 표본 수 `n` 없이 평균만 표시 — **금지**
- "기록 N개 이상" 개방 조건 — **금지** (§2-5)
- 컨디션·준비도·부상위험 판정 — **절대 금지**
- 그래프 화면에서 계획 후보 생성 — **금지**
- `privateSelfOnly` 일지를 집계·개수에 포함 — **금지**
- D9 안전 게이트 우회 — **절대 금지**
- 미성년에게 개방 — **금지**

---

## 7. 완료 기준

```bash
cd app && npm test && npx tsc --noEmit -p tsconfig.json && npm run build
cd impl && npm test          # 98개 그대로 (안 건드렸으므로)
cd app && CI=1 npx playwright test
```

- [ ] `record-analysis.ts` + 계약 테스트
- [ ] `journal-reference.ts` + 계약 테스트
- [ ] 분포 화면에 `n` · 출처 · 빈 구간이 **항상** 표시됨
- [ ] 빈 구간에서 선이 끊김 (0으로 내려가지 않음)
- [ ] 기록 1개에서도 그래프가 열림
- [ ] 참고 패널에 "후보를 만들 때 쓰이지 않았어요" 문구가 있음
- [ ] 참고 패널을 켜고 껐을 때 후보 결과가 **완전히 동일**함
- [ ] `privateSelfOnly` 일지가 어디에도 나타나지 않음
- [ ] §5-3 grep 3건 전부 0건
- [ ] **§4 검증 절차를 보고서에 실제 값으로 채워 냈음** (빈칸 0개)
- [ ] §4-3 (가)(나)가 코드 주석과 테스트에 **같은 값**으로 적혀 있음
- [ ] `journal-*`, `impl/`, `specs/` 변경 0건

---

## 8. 보고

`reports/review/WORK_ORDER_P5_REPORT.md`

- 만든 파일 목록
- **§4-1 · §4-4 근거 추적표** — 각 줄에 실제 파일·줄번호를 적어서
- **§4-2 검산표 4줄** — 손으로 계산한 값과 코드가 낸 값을 나란히
- **§4-3 (가)(나)** — 어떻게 정했고 왜 그렇게 정했는지
- **§4-5 검산표 6줄** — 특히 j2(`privateSelfOnly`) 흔적이 0인지
- **§4-6 체크리스트 8개** — grep 결과 붙여넣기
- `bucketByMonth` 실측 입력→출력 (빈 구간 포함 예시 1건)
- 참고 패널 on/off 후보 결과가 동일함을 보인 실측
- grep 3건 결과 붙여넣기
- 막힌 곳과 그 이유
