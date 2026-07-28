# 오너 결정 — 기준 기록 선택제, PB·SB 부하 비교, 일지 불러오기

```yaml
decision_record:
  id: DECISION-ANCHOR-CHOICE-001
  decided_by: OWNER
  decided_at: "2026-07-27"
  supersedes_question: PERSONAL_PACE_DECISION_2026-07-27.md §9
  status: 4건 전부 확정 (D는 2026-07-27 오너 확답으로 확정)
```

## 0. 오너가 말한 것 (원문)

> "Pb와 시즌기록(최소 3개월 최대 1.6년)을 고려하자. 그리고 본인이나 코치가
> 어떤 훈련을 할지 선택하게 하는 거지. 번거롭거나 손이 한번 더 눌러야 하는
> 상황이 있더라도 그게 필요할 듯. pb기준 훈련을 누르면 그냥 그것에 맞춰
> 훈련을 주고, 다만 sb와 차이점을 알려주는 거지. sb를 선택해도 pb훈련과
> 얼마나 차이나는지 공식 대입해서 훈련의 부하를 비교해주는 것. 다만 일지를
> 완전 분리하는 것보단 훈련 계획에 참고하기 위해 결과 분포도나 통계, 비교나
> 구성 가능하도록 불러오기 기능을 넣자. 끝까지 막아내기 보다는, 필요시와
> 요구시에는 열어도 돼. 이건 단순 선택일 뿐이잖아."

> **확답 (같은 날):** "시즌길이는 보통 1년이지만 보수적으로 오늘로부터
> 1년 6개월 전으로 잡을게. 현재 경기력 평가 지표로 표현하기도 해줘.
> pb기간무관. 시즌밖기록으로. 기록이나 자료가 많은 사람들은 아까말한
> 분포도나 그래프 통계적으로 보면서 파악할수있도록."

---

## 1. 결정 요약

| # | 결정 | 상태 |
|---|---|---|
| A | **기준 기록을 사람이 고른다** (PB 기준 / SB 기준 버튼) | ✅ **확정. 스펙과 일치** |
| B | **고르지 않은 쪽과의 차이를 항상 보여준다** | ✅ **확정. 스펙과 일치** |
| C | **일지 불러오기** — 계획 참고용 분포·통계·비교 | ✅ **확정. 단 경로 제한 있음 (§4)** |
| D | **시즌 창 = 오늘로부터 18개월** (SB 전용, PB 무관) | ✅ **확정 (§3)** |
| E | **시즌 밖 기록은 거부하지 않고 "시즌 밖"으로 표시** | ✅ **확정 (§3-3)** |
| F | **기록 많은 사용자에게 분포·그래프·통계 제공** | ✅ **확정 (§6)** |

---

## 2. 결정 A·B — 이것은 스펙이 원래 요구한 설계다

**오너 결정이 스펙과 정확히 맞는다.** 우연이 아니라, 스펙이 이미
"코드가 고르지 말고 사람이 고르게 하라"고 요구하고 있었다.

### 2-1. "손이 한 번 더 눌러야 해도 필요하다"가 정답인 이유

`anchor.ts:23`이 `freshnessState`를 **읽기만 한다.** 즉 무엇을 현재
실력으로 인정할지는 **엔진 외부에서 사람이 결정해 넣어주는 값**이다.
스펙 §4도 같은 말을 한다.

> `PB` — "**A PB can be old**; it is never assumed to be current
> without its state."
> `RECENT_RESULT` — "**stale is not silently current**."

**자동 선택은 애초에 허용되지 않았다.** 오너가 말한 "한 번 더 누르는
번거로움"이 바로 **스펙이 요구한 확인 절차**다. 손이 한 번 더 가는 대신,
오래된 기록이 조용히 현재 실력으로 쓰이는 일이 없어진다.
결정 정본 §1의 결정 4(*"오너·코치가 정함 — 코드 자동 선택 금지"*)와도
같은 방향이다.

### 2-2. PB 기준과 SB 기준은 서로 다른 `purpose`를 갖는다

| 버튼 | `kind` | `purpose` | 추가 필수 |
|---|---|---|---|
| **PB 기준 훈련** | `PB` | `CURRENT_CAPABILITY` | `achievedAt` |
| **SB 기준 훈련** | `SB` | `SEASON_CONTEXT` | `achievedAt` + **`seasonId`** |

`anchor.ts`가 이미 이 조합을 검증한다. `SB`에 `seasonId`가 없으면
`ANCHOR_PROVENANCE_INCOMPLETE`로 거부된다. **따라서 SB 기준 훈련을
넣으려면 "시즌 이름"이 반드시 있어야 한다.** 스펙 문구: *"A season
must be named."*

### 2-3. 결정 B의 "차이 비교"는 무엇을 비교하는가 — 정밀하게

오너: *"공식 대입해서 훈련의 부하를 비교해주는 것"*

여기서 **비교 가능한 것과 금지된 것이 갈린다.** 부하 계약이
명확하게 선을 그어 놓았다.

| 비교 대상 | 가능 여부 | 근거 |
|---|---|---|
| PB 기준 페이스 vs SB 기준 페이스 (초/km) | ✅ **가능** | 같은 단위(`seconds_per_kilometre`), 같은 공식 |
| 두 페이스의 차이 (예: "3초/km 빠름") | ✅ **가능** | 같은 차원끼리의 뺄셈 |
| 같은 세션을 두 기준으로 계산한 목표 시간 | ✅ **가능** | 같은 공식·같은 입력종류 |
| **"PB 훈련이 부하 12% 높다"** 같은 생물학적 부하 비교 | ❌ **금지** | 아래 참조 |
| "이 부하는 위험/준비됨" 판정 | ❌ **금지** | `readiness_threshold: PROHIBITED` |

부하 계약 §3이 막으려고 적어 둔 항목이 바로 이것이다.

| Family | Canonical representation | **Forbidden interpretation** |
|---|---|---|
| external | typed physical units | **total biological load** |
| derived | formula/version plus inputs | **interchangeable universal load** |

> "Values with different dimensions or different arbitrary-unit methods
> are **never added**."

**즉 "부하"라는 단어를 하나의 숫자로 합쳐 비교하면 안 된다.**
대신 **페이스 차이와 목표 시간 차이를 그대로 보여주면** 오너 의도는
달성된다. 이건 실제로 더 유용하다 — 선수는 "부하 12%"보다
`"PB 기준 3:42/km, SB 기준 3:45/km (3초 느림)"`을 이해한다.

### 2-4. 확정된 표시 형태

```
[● PB 기준]  [○ SB 기준]        ← 사람이 고른다. 미리 선택된 기본값 없음

선택: PB 5000m 15:30 (2024-03-10, 2년 4개월 전)
  → 1000m 반복 목표 3:06

참고: SB 5000m 15:45 (2026 시즌, 4개월 전)
  → 같은 세션이면 1000m 3:09  (3초 느림)
```

**두 가지를 반드시 지킨다.**

1. **선택하지 않은 쪽도 함께 보여준다** (오너 결정 B)
2. **양쪽 모두 달성일과 경과 기간을 표시한다** (앞선 결정, 만료는 없음)

---

## 3. 결정 D·E — 시즌 창 18개월, 밖은 거부하지 않고 표시 (확정)

### 3-1. 오너 확답

> "시즌길이는 보통 1년이지만 보수적으로 오늘로부터 1년 6개월 전으로 잡을게.
> 현재 경기력 평가 지표로 표현하기도 해줘. pb기간무관.
> 시즌밖기록으로."

**확정된 규칙:**

```yaml
시즌_창:
  기준점: 오늘
  범위: 오늘로부터 18개월 이내
  적용_대상: SEASON_BEST 만
  PB_적용: 없음                     # "pb기간무관"
  범위_밖_기록:
    삭제: 없음
    계산_거부: 없음                  # 오너: "시즌밖기록으로"
    처리: "시즌 밖" 으로 표시
  판정_주체: 사람이 최종 확인
```

**보수적 18개월의 근거는 오너 권한입니다.** 부하 계약 §9가
*"A future cutoff is **product policy**, not a scientific threshold"*
라고 하여 이 선택을 **오너 정책 권한**으로 명시해 두었습니다.
실제 트랙 시즌이 실내/실외로 갈리고 학년 경계와 어긋나므로
1년보다 넓게 잡는 것이 실무에 맞습니다.

### 3-2. 🔴 이 18개월은 "만료"가 아니다 — 경계를 정확히 그어야 한다

**이것이 이 절에서 가장 중요합니다.** 18개월은 날짜로 계산되는
숫자라서, 조금만 잘못 쓰면 바로 직전에 정정한 만료 오판이 됩니다.

| 용도 | 허용 | 근거 |
|---|---|---|
| SB에 "시즌 안/밖" **라벨**을 붙인다 | ✅ | 오너 결정 |
| 기본 그래프 범위를 18개월로 잡는다 | ✅ | 표시 편의 |
| "현재 경기력 지표"에 넣을 후보를 **추린다** | ✅ | 오너 결정 |
| 18개월 넘은 SB로 **계산을 거부**한다 | ❌ | 오너: "시즌밖기록으로" |
| 18개월 넘은 기록을 **숨기거나 삭제**한다 | ❌ | "지우거나 하라는 게 아니야" |
| **PB**에 18개월을 적용한다 | ❌ | 오너: "pb기간무관" |
| `freshnessState`를 날짜로 **자동 결정**한다 | ❌ | `anchor.ts:23`은 입력값으로 읽는다 |

**핵심: 18개월은 라벨을 만들 뿐, 문을 닫지 않는다.**
`CURRENT`/`STALE`은 여전히 **사람이 고릅니다**. 코드는
`"시즌 밖 (2년 3개월 전)"`이라고 알려주고, 그걸 기준으로 쓸지는
사람이 결정합니다.

```ts
/**
 * SB 가 오늘 기준 시즌 창 안에 있는지 라벨을 만든다.
 * 이 함수는 계산 가능/불가를 정하지 않는다. 거부하지 않는다.
 * PB·RECENT_RESULT 에는 호출하지 않는다.
 */
export function seasonWindowLabel(
  record: AthleteRecord,
  today: Date,                    // 테스트 가능하게 반드시 인자로 받는다
): { readonly withinWindow: boolean; readonly label: string }
// 예: { withinWindow: false, label: "시즌 밖 (2년 3개월 전)" }
```

### 3-3. "현재 경기력 평가 지표"로도 표현 — 표시 규칙

오너: *"현재 경기력 평가 지표로 표현하기도 해줘."*

**시즌 창 안의 기록을 "현재 경기력"으로 묶어 보여줍니다.**
스펙의 `purpose` 값과 정확히 대응됩니다.

| 상태 | 화면 표현 | 스펙 `purpose` |
|---|---|---|
| SB, 시즌 창 안 | **현재 경기력 지표** | `SEASON_CONTEXT` |
| SB, 시즌 창 밖 | **시즌 밖 기록** (참고) | `SEASON_CONTEXT` (유지) |
| PB (기간 무관) | **개인 최고기록** | `CURRENT_CAPABILITY` |
| 최근 경기 결과 | **최근 결과** | `CURRENT_CAPABILITY` |

> ⚠️ **주의: "현재 경기력"은 표시 라벨이고 `purpose`를 바꾸지 않는다.**
> 시즌 창 안이라고 해서 SB의 `purpose`를 `CURRENT_CAPABILITY`로
> 바꾸면 안 됩니다. 스펙 §4가 `SB`에 `SEASON_CONTEXT`를 **필수**로
> 못 박았고(`anchor.ts`가 다른 값이면 `ANCHOR_PROVENANCE_INCOMPLETE`로
> 거부), `GOAL`은 *"may never become `CURRENT_CAPABILITY`"* 입니다.
> **라벨과 `purpose`는 별개 층이다.**

표시 예:

```
현재 경기력 지표  (오늘로부터 18개월)
  5000m   15:45   2026 실외   4개월 전      ← SB, 창 안
  1500m    4:12   2026 실내   9개월 전      ← SB, 창 안

개인 최고기록  (기간 무관)
  5000m   15:30   2024-03-10  2년 4개월 전  ← PB

시즌 밖 기록  (참고용)
  3000m    8:55   2023 시즌   3년 1개월 전  ← SB, 창 밖. 지우지 않는다
```

**세 묶음 모두 화면에 남습니다.** 창 밖 기록도 접거나 흐리게 하지
않습니다(오너 지침: 지우지 말고 구분하라).

## 4. 결정 C — 일지 불러오기, 열 수 있습니다 (단 경로가 정해져 있습니다)

오너: *"끝까지 막아내기 보다는, 필요시와 요구시에는 열어도 돼.
이건 단순 선택일 뿐이잖아."*

**결론부터: 오너가 여시는 것이 맞고, 스펙도 이것을 예상하고
설계되어 있었습니다.** 다만 "무엇을" 여는지가 중요합니다.

### 4-1. 제가 앞 답변에서 과하게 말했습니다 — 정정합니다

제가 *"영구 금지"*라고 썼습니다. **틀렸습니다.** 스펙 문구를 다시
읽으면 금지가 조건부입니다.

```yaml
future_plan_evidence_allowed_before_separate_adoption: false
                                ^^^^^^^^^^^^^^^^^^^^^ "별도 승인 전에는"
may_feed_future_plan_before_separate_adoption: false
analyzable_note_structured_derivative_before_separate_plan_adoption: reject
```

그리고 승인 권한자가 명시되어 있습니다.

```yaml
adoption_authority: COACH_HOJUNE     # ← 오너
```

스펙은 심지어 **열릴 때 무엇이 필요한지 목록까지 준비해 두었습니다.**

```yaml
future_persistence_allowlist_after_separate_adoption:
  - structured_fields
  - nonSensitiveReasonCodes
  - D9_disposition
  - analysisSignalCodes
  - sourceSnapshotId
  - auditLogId
  - extractionVersion
```

> "A future plan-eligible note derivative requires a **separate owner
> decision**, schema, consent purpose, retention rule, test package, and
> Plan Generator adoption."

**즉 "영구 금지"가 아니라 "오너 결정 + 5가지 준비물이 있으면 열림"이
스펙의 실제 내용입니다.** 제 이전 설명을 정정합니다.

### 4-2. 그래도 딱 하나는 여전히 닫혀 있습니다 — 그리고 그건 오너도 원하지 않을 것입니다

**자유 서술 원문 자체**를 계획 숫자에 넣는 것은 별개 문제입니다.

```yaml
storage_location_matrix:
  plan_generator_raw_text: forbidden      # 조건부 아님
raw_text_quote_summary_token_or_embedding: reject
```

`FA-TC-031`은 원문을 두 단계 파생물로 세탁한 것까지 조상 추적으로
거부합니다. 이건 `before_separate_adoption` 같은 조건이 붙어 있지
않습니다.

**그런데 오너가 요구하신 건 원문이 아닙니다.** 요구를 그대로 읽으면
*"결과 분포도나 통계, 비교나 구성"* 입니다. 이건 전부 **구조화된
수치**이고, 원문 문장이 아닙니다.

| 오너가 말한 것 | 실제 필요한 것 | 상태 |
|---|---|---|
| 결과 **분포도** | 세션 거리·시간·페이스 수치 | ✅ 구조화 필드 |
| **통계** | 개수·평균·범위 | ✅ 구조화 필드 |
| **비교** | 기록 대 기록 | ✅ 구조화 필드 |
| **구성** | 세션 종류별 분포 | ✅ 구조화 필드 |

**즉 오너가 원하시는 기능은 원문 없이 100% 구현됩니다.**
"어제 다리가 좀 무거웠다" 같은 문장을 강도 숫자로 번역하는 것만
막히는데, 그건 오너도 원하신 게 아닐 것입니다.

### 4-3. 확정 — 일지 불러오기 설계

```yaml
일지_불러오기:
  방식: 사람이 명시적으로 불러온다      # 자동 흡수 아님 (오너: "단순 선택")
  불러오는_것:
    - 세션 거리·시간·페이스 (구조화 수치)
    - 세션 종류·날짜
    - 결과 분포·개수·평균·범위
  불러오지_않는_것:
    - 자유 서술 원문
    - 원문 요약·인용
  용도: 훈련 계획 참고 표시
  통계_표시_규칙:
    표본수_항상_표시: true              # aggregate_requires_visible_n
    관측_1건도_표시_가능: true          # descriptive_single_observation: allowed
  금지:
    - 준비도·부상위험 판정              # readiness/injury_risk: PROHIBITED
    - 개수 임계값으로 정밀도 구분        # baseline_threshold: UNKNOWN
```

부하 계약 §10이 통계 표시 규칙을 이미 정해 두었습니다.

```yaml
minimum_evidence_policy:
  descriptive_single_observation: allowed     # 1건도 사실로 표시 가능
  aggregate_requires_visible_n: true         # 합계·평균엔 n을 보여줘야 함
  readiness_threshold: PROHIBITED
  injury_risk_threshold: PROHIBITED
```

**"일지 3개 기준 평균"처럼 n을 함께 보여주면 됩니다.**
숨기고 평균만 내놓는 것이 금지입니다.

---

## 5. 작업지시서에 미치는 영향

| 지시서 | 영향 | 조치 |
|---|---|---|
| `WORK_ORDER_P1` | **경미** | SB에 `seasonId` 필수 + `seasonWindowLabel()` 표시 함수 |
| `WORK_ORDER_P2` | **없음** | 그대로 |
| `WORK_ORDER_P3` | **증가** | 기준 선택 UI + 반대쪽 차이 표시가 추가됨 |
| (P4) 환산 모델 | 없음 | 그대로 오너 재승인 대기 |
| [`WORK_ORDER_P5`](./WORK_ORDER_P5_JOURNAL_IMPORT_AND_CHARTS.md) 일지 불러오기 + 분포·그래프 | **새 작업, 작성 완료** | P1 병합 후 착수 (§6) |

**P1에 추가할 것 하나:** `SEASON_BEST`를 고르면 `seasonId`(시즌 이름)를
필수로 받아야 합니다. `anchor.ts`가 없으면 거부하기 때문입니다.
이건 결정 D의 답과 무관하게 필요합니다.

---

## 6. 결정 F — 기록 많은 사용자를 위한 분포·그래프·통계

오너: *"기록이나 자료가 많은 사람들은 아까말한 분포도나 그래프
통계적으로 보면서 파악할수있도록."*

**이것은 §4의 일지 불러오기와 같은 갈래이고, 전용 스펙이 이미 있습니다** —
`specs/reconstruct/ANALYSIS_AND_VISUALIZATION_DATA_CONTRACT.md`.

### 6-1. 이 스펙이 정해 둔 것

```yaml
analysis_visualization_invariants:
  raw_free_text_storage_forbidden: true      # 원문 저장 금지 (§4와 동일)
  source_refs_required: true                 # 모든 점은 출처가 있어야 함
  confidence_or_uncertainty_required: true
  missing_data_must_be_visible: true         # 없는 건 없다고 보여준다
  stale_data_must_be_visible: true           # 오래된 건 오래됐다고 보여준다
  conflicting_data_must_be_visible: true
  analysis_can_raise_attention: true         # 주의를 끌 수 있다
  analysis_can_clear_D9: false               # 안전 위험을 지울 수 없다
  analysis_can_clear_safety_gate: false
  analysis_can_create_plan_options: false    # ← 가장 중요
```

**`analysis_can_create_plan_options: false`가 핵심 경계입니다.**
그래프는 **보고 파악하는 층**이고, **계획을 만들지 않습니다.**
오너 표현(*"보면서 파악할수있도록"*)과 정확히 일치합니다.

집계 정책도 정해져 있습니다.

```yaml
aggregation_policy:
  raw_text_input_allowed: false
  hidden_interpolation_allowed: false          # 빈 구간을 몰래 이어 붙이지 않는다
  missing_point_behavior: show_missing_or_insufficient
  stale_point_behavior: show_stale
  aggregate_can_raise_attention: true
  aggregate_can_clear_attention: false
```

**`hidden_interpolation_allowed: false`** — 데이터가 없는 구간을
선으로 이어 그리면 안 됩니다. **끊어서 보여줍니다.**

### 6-2. 확정 설계

```yaml
분포_그래프_통계:
  입력: 구조화 수치만 (경기 기록 + 일지의 구조화 필드)
  기본_범위: 오늘로부터 18개월 (사용자가 바꿀 수 있음)
  보여주는_것:
    - 종목별 기록 추이 (시간축)
    - 기록 분포 (히스토그램)
    - 종목 간 비교
    - 세션 구성 분포
  필수_동반_표시:
    - 표본 수 n                  # aggregate_requires_visible_n
    - 출처                       # source_refs_required
    - 빈 구간은 끊어서            # hidden_interpolation_allowed: false
    - 오래된 점은 오래됐다고       # stale_data_must_be_visible
  금지:
    - 계획 후보 생성              # analysis_can_create_plan_options: false
    - 준비도·부상위험 판정         # readiness/injury_risk: PROHIBITED
    - 안전 차단 해제              # analysis_can_clear_D9: false
    - 빈 구간 보간                # hidden_interpolation_allowed: false
    - 일지 원문 표시·저장          # raw_free_text_storage_forbidden
```

### 6-3. "기록 많은 사람" 을 개수로 정의하지 않는다

오너가 *"기록이나 자료가 많은 사람들은"* 이라고 하셨지만,
**"N개 이상이면 그래프 개방" 같은 임계값을 만들지 않습니다.**
`minimum_evidence_policy`가 `baseline_classification_threshold: UNKNOWN`
으로 판정한 영역입니다(점진적 코칭 문서 §4와 같은 함정).

**대신 자연스럽게 처리됩니다.**

| 데이터 양 | 결과 | 이유 |
|---|---|---|
| 기록 1개 | 점 하나 + n=1 표시 | `descriptive_single_observation: allowed` |
| 기록 3개 | 추이선 + n=3 표시 | 같은 규칙 |
| 기록 30개 | 분포·히스토그램이 실제로 유용해짐 | 데이터가 많아서, 문이 열려서가 아님 |

**그래프는 처음부터 켜져 있습니다. 기록이 쌓이면 그래프가 저절로
읽을 만해집니다.** 오너가 원한 것은 되고, 임계값은 만들지 않습니다.

이 결정을 실제 작업으로 옮긴 지시서:
[`WORK_ORDER_P5_JOURNAL_IMPORT_AND_CHARTS.md`](./WORK_ORDER_P5_JOURNAL_IMPORT_AND_CHARTS.md)
— 파트 A가 분포·그래프·통계, 파트 B가 일지 불러오기입니다.

---

## 7. 절대 지킬 것

1. **기준 기록은 사람이 고른다.** 미리 선택된 기본값을 두지 않는다.
2. **고르지 않은 쪽도 함께 보여준다.** 차이는 **페이스와 목표 시간**으로
   보여주고, **하나의 "부하 점수"로 합치지 않는다**(§2-3).
3. **양쪽 모두 달성일과 경과 기간을 표시한다.** 만료는 없다.
4. **일지에서 불러오는 것은 구조화 수치다.** 자유 서술 원문은 아니다.
5. **통계에는 표본 수(n)를 함께 보여준다.** 숨기고 평균만 내지 않는다.
6. **개수로 정밀도 등급을 나누지 않는다.** 스펙이 `UNKNOWN`으로 판정한
   영역이다.

> 상위 지침은 [`PRODUCT_NORTH_STAR.md`](./PRODUCT_NORTH_STAR.md)다.
> 관련 문서: [`PERSONAL_PACE_DECISION_2026-07-27.md`](./PERSONAL_PACE_DECISION_2026-07-27.md),
> [`PROGRESSIVE_COACHING_DESIGN_2026-07-27.md`](./PROGRESSIVE_COACHING_DESIGN_2026-07-27.md)
