# Within-Athlete Minimum Evidence: Primary Methods Research

```yaml
artifact_status: RESEARCH_EVIDENCE_ONLY
searched_at: 2026-07-17
timezone: Asia/Seoul
scope: RQ-E_N_OF_1_SCED_MINIMUM_EVIDENCE_AND_USER_EXPLANATION
canonical_ledger_edit: false
canonical_spec_edit: false
owner_product_identity: 9_5_DAY_FORMATION
owner_target_authority: DEFAULT_AUTOMATED_PRESCRIPTION
fail_closed_action_for_unjustified_personal_value: KEEP_CURRENT_COACH_AUTHORED_PLAN
private_self_only_policy: CONTENT_AND_METADATA_ZERO_SIGNAL
```

## 1. 결론부터

1. **모든 선수, 모든 지표에 통하는 최소 기록 수 `n`은 만들 수 없다.** 기록 한 건으로
   관찰 사실은 말할 수 있지만, 개인 기준선, 오차보다 큰 변화, 훈련 효과 비교에는 서로 다른
   근거가 필요하다. N-of-1/SCED 문헌의 `3~5개 점` 같은 수는 특정 연구 설계의 심사 관행 또는
   분석 조건이지, 선수 앱의 보편 기준이 아니다.
2. **모든 데이터에 통하는 신선도 시간도 만들 수 없다.** 경기 기록, 아침 HRV, 세션 RPE,
   장기 적응 지표는 변하는 속도와 사용 목적이 다르다. 출처 시각과 측정 시각은 저장하되,
   근거 없는 `24시간`, `7일`, `9.5일` 같은 숫자를 신선도 규칙으로 만들지 않는다.
3. **측정오차를 넘었다는 것과 선수에게 중요한 변화라는 것은 별개다.** `MDC95`는 정해진
   오차모형 아래에서 단순 오차로 보기 어려운 변화를 뜻할 뿐, 훈련 효과, 회복, 안전, 최적
   처방을 뜻하지 않는다.
4. **훈련 적응은 이월이 사라져야 하는 약물 교차시험과 다르다.** 이전 훈련의 효과가 다음
   블록에 남는 것이 오히려 목적일 수 있다. 따라서 단순 `A-B-A-B` 전환으로 웨이트, 플라이오,
   MAIN의 독립 효과를 자동 판정하면 안 된다. 전향적 다중기준선, 중단 시계열, 사전 정의된
   블록 비교가 더 현실적일 수 있으나 이 역시 추세, 성장, 동시 훈련과 대회를 처리해야 한다.
5. **TRAINORACLE의 9.5일 기본 자동 처방 정체성과 이 결론은 충돌하지 않는다.** 9.5일은
   제품의 고정 기본 틀이다. 다만 어떤 개인화 수치가 근거 게이트를 통과하지 못했으면 그 수치를
   만들거나 보간하지 않고 현재 코치 계획을 유지한다. `PRIVATE_SELF_ONLY`의 내용, 존재 여부,
   길이, 작성 시각, 빈도 등 메타데이터는 어느 게이트에도 들어오지 않는다.

제품 문장으로 줄이면 다음과 같다.

> 9.5일 기본 계획은 유지합니다. 이번 개인화 값은 아직 같은 조건의 근거와 오차 기준을
> 충족하지 않아 추천에 쓰지 않았습니다. 없는 숫자를 추측하지 않고 현재 코치 계획을
> 그대로 둡니다. 나만의 메모는 분석하지 않습니다.

## 2. 조사 범위와 직접성 판정

### 2.1 무엇을 찾았는가

- 공식 N-of-1 설계·분석 지침과 보고 지침
- SCED 설계 표준과 방법론 연구
- 측정오차, 신뢰도, 최소검출변화, 최소중요변화 방법
- 자기상관, 추세, 이월, 결측을 다룬 시계열/SCED 연구
- 스포츠에서 개인 선수를 분석한 직접 적용 사례
- 청소년 중장거리·거리주자에게 직접 적용된 훈련 부하와 개인화 사례

### 2.2 이번 조사의 한계

- PubMed/PMC, 공식 기관, 출판사 원문과 저장소의 RQ-E 검색 결과를 중심으로 한 구조화된
  심층 조사다. SPORTDiscus, Scopus, Web of Science의 인증된 전수 검색은 수행하지 못했다.
- **청소년 800/1500m 선수를 대상으로 무작위 N-of-1 또는 엄격한 SCED로 9.5일 Formation을
  검증한 직접 연구는 이번 검색에서 찾지 못했다.** 이는 `NOT_FOUND_IN_SEARCH`이지,
  세상에 존재하지 않는다는 선언이 아니다.
- 방법론 문헌 대부분은 의료, 심리, 교육 또는 성인 스포츠에서 나왔다. 따라서 설계 원리는
  이전할 수 있어도 선수별 수치, 기간, 최소 관찰 수는 이전할 수 없다.

### 2.3 직접성 등급

| 등급 | 의미 | 제품 사용 |
|---|---|---|
| `DIRECT_METHOD` | N-of-1/SCED 또는 측정 방법을 직접 다룸 | 구조와 금지 규칙에 사용 가능 |
| `DIRECT_SPORT` | 실제 스포츠 개인/소수 선수에게 적용 | 가능성·부담·측정 사례로 사용 가능 |
| `DIRECT_YOUTH_DISTANCE` | 청소년 중장거리/거리주자에게 직접 적용 | 입력 프로토콜과 청소년 UX 근거로 사용 가능 |
| `INDIRECT_TRANSFER` | 다른 집단·종목·임상에서 나온 근거 | 숫자 이전 금지, 원리만 참고 |
| `NOT_DIRECT_FOR_9_5` | 9.5일 자동 처방을 직접 비교하지 않음 | 9.5일 우월성 근거로 사용 금지 |

## 3. 어떤 주장까지 가능한가: 네 단계 사다리

| 단계 | 최소 근거의 종류 | 허용 문장 | 추천 입력 권한 |
|---|---|---|---|
| `OBSERVATION` | 출처·시각·단위·프로토콜이 있는 유효 기록 1건 | “오늘 RPE 7을 기록했어요.” | 없음 |
| `DESCRIPTIVE_BASELINE` | 같은 방법의 반복 기록, 기간·누락·맥락 범위 표시 | “최근 같은 조건 기록의 중앙값과 범위예요.” | 없음 |
| `MEASUREMENT_ERROR_EXCEEDING_CHANGE` | 호환되는 지표별 오차모형과 불확실성 | “알려진 측정오차보다 큰 변화예요.” | 그 자체로 없음 |
| `PROSPECTIVE_HYPOTHESIS_COMPARISON` | 사전 계획, 비교 설계, 추세·자기상관·이월·결측 처리 | “미리 정한 비교와 같은 방향이었어요.” | 별도 승인 규칙이 있을 때만 후보 |

어느 단계도 그 자체로 다음을 말할 수 없다.

- “이 훈련이 원인이다.”
- “선수가 회복됐다/안전하다.”
- “부상 위험을 예측했다.”
- “이 선수는 영구적인 반응자/비반응자다.”
- “9.5일이 모든 선수에게 과학적으로 최적이다.”

개인반응 연구는 관찰된 전후 차이가 측정오차, 자연 변동, 시점별 효과 변동과 실제 개인별
효과 차이를 섞을 수 있다고 지적한다. 반복되지 않은 한 번의 전후 비교로 반응자 꼬리표를
붙이면 안 된다. 이 경계는 [Hecksteden et al. 2015](https://pubmed.ncbi.nlm.nih.gov/25663672/),
[Senn 2016](https://pmc.ncbi.nlm.nih.gov/articles/PMC5054923/),
[Swinton et al. 2018](https://pmc.ncbi.nlm.nih.gov/articles/PMC5985399/)의 핵심 논점과 맞는다.

## 4. N-of-1/SCED 설계: 무엇을 언제 쓸 수 있는가

### 4.1 무작위·균형 N-of-1 교차설계

한 선수가 두 조건을 여러 기간에 걸쳐 번갈아 수행하고, 조건 순서를 실제로 무작위화하거나
균형화한다. 다음을 사전에 고정해야 한다.

- 비교할 조건과 허용되는 조건 순서
- 1차 결과, 측정 시각, 분석 방향
- 각 기간 길이와 전환 구간
- 효과가 나타나는 지연시간과 이전 효과의 지속시간
- 필요한 교차 횟수와 중단 규칙
- 자기상관, 추세, 결측, 다중 결과 처리

무작위화 검정은 **실제로 사용한 할당 절차**에서 가능한 순열만 사용해야 한다. 사후에
무작위였다고 가정하거나 임의로 모든 순서를 섞을 수 없다.
[Tanious & Onghena 2019](https://pmc.ncbi.nlm.nih.gov/articles/PMC6955662/)는 무작위 요소를
여러 SCED에 넣는 방법과 그 할당에 기반한 검정을 설명한다.

**TRAINORACLE 적용 한계:** 회복이 빠르고 되돌릴 수 있는 표시 방식이나 짧은 행동 개입에는
쓸 수 있지만, 누적 적응이 목적인 훈련 블록을 완전히 씻어내는 교차설계는 대개 부적합하다.

### 4.2 다중기준선 설계

효과를 되돌릴 수 없거나 되돌리는 것이 바람직하지 않을 때, 선수·결과·행동마다 개입 시작을
서로 다르게 배치해 변화가 반복되는지 본다.

- 동시 다중기준선은 같은 외부 사건을 공유하므로 역사효과를 더 잘 견제한다.
- 비동시 다중기준선은 운영은 쉽지만 서로 다른 시기의 외부 사건에 더 취약하다.
- 시작 시점의 실제 무작위화가 가능하면 내부 타당도를 높일 수 있다.
- 선수 한 명 안에서도 서로 독립적이지 않은 결과를 여러 번 재현했다고 과장하면 안 된다.

스포츠 직접 사례인 [Southey et al. 2025](https://pmc.ncbi.nlm.nih.gov/articles/PMC12194246/)는
성인 남성 4명에게 5~7주 비동시 기준선과 6주 근력·플라이오 훈련을 적용해 개인별 반응 차이를
보였다. 이는 스포츠에서 SCED가 실행 가능하다는 근거지만, 참여자는 레크리에이션 성인이고
청소년 중장거리나 9.5일 처방의 직접 근거가 아니다.

### 4.3 중단 시계열과 수준·기울기 모형

코치가 미리 정한 변경 시점 전후의 수준과 기울기를 비교할 때 다음처럼 표현할 수 있다.

```text
Y_t = beta0
    + beta1 * time_t
    + beta2 * phase_t
    + beta3 * time_after_change_t
    + epsilon_t
```

- `beta1`: 변경 전 추세
- `beta2`: 변경 시점의 즉시 수준 변화
- `beta3`: 변경 뒤 기울기 변화
- `time_after_change_t`: 변경 전에는 0, 변경 뒤에는 0부터 증가

`time * phase`만 기계적으로 넣으면 즉시 수준 변화의 의미가 잘못 매개변수화될 수 있다.
모형 선택은 계획 전에 확정하고, 계절성, 대회, 성장, 질병, 기기 변경, 동시 훈련을 기록해야
한다. 단순한 전후 평균 비교는 기존 상승/하락 추세를 훈련 효과로 오인할 수 있다.

### 4.4 관찰 일지는 실험이 아니다

일지를 오래 썼다는 사실만으로 조건이 무작위화되거나 교란이 사라지지 않는다. 일상 기록은
개인 기준선과 가설 생성에 매우 유용하지만, 자동으로 `PROSPECTIVE_HYPOTHESIS_COMPARISON`이
되지 않는다. 실험 수준의 표현을 쓰려면 비교가 시작되기 전에 결과, 구간, 조건, 분석과
중단 규칙을 고정해야 한다.

## 5. 측정오차: 변화가 ‘진짜처럼 보이는지’ 먼저 묻는다

### 5.1 저장해야 하는 기본 값

```text
metric_id
unit_and_scale
device_or_method
firmware_or_software
protocol_version
calibration_state
observed_at
received_at
quality_state
context_tags
missing_reason
```

같은 이름의 지표라도 기기, 펌웨어, 측정 자세, 시각, 워밍업, 계산식이 바뀌면 같은 기준선에
바로 합치지 않는다. 청소년 거리주자의 sRPE 연구에서 세션 직후와 30분 뒤 응답이 달라졌다는
결과는 입력 시각 자체가 프로토콜의 일부임을 잘 보여준다
([Mann et al. 2019](https://pubmed.ncbi.nlm.nih.gov/30160557/)).

### 5.2 대표 오차 표현과 공식

두 시점의 단순 변화량은 다음과 같다.

```text
Delta = Y_after - Y_before
```

반복 측정 차이의 표준편차가 있을 때 자주 쓰는 전형오차는 다음과 같다.

```text
TE = SD(differences) / sqrt(2)
```

ICC에서 유도하는 흔한 SEM 표현은 다음과 같다.

```text
SEM = SD * sqrt(1 - ICC)
```

개인 수준 95% 최소검출변화의 흔한 표현은 다음과 같다.

```text
MDC95 = 1.96 * sqrt(2) * SEM
```

비율척도에서 평균에 비례해 오차가 커지는 경우 자주 쓰는 CV는 다음과 같다.

```text
CV_percent = 100 * SD / mean
```

하지만 각 식은 자동 기본값이 아니다.

- ICC 종류와 분산 성분에 따라 SEM이 달라진다.
- ICC는 표본의 이질성에 민감하므로 다른 집단의 ICC를 그대로 가져오면 안 된다.
- 평균이 0에 가깝거나 음수가 가능한 척도에는 CV가 불안정하거나 부적절하다.
- 비례오차가 있으면 로그 변환 또는 비율형 오차모형이 필요할 수 있다.
- `MDC95`는 선택한 오차모형과 신뢰수준에만 유효하다.
- 평균 차이와 95% 일치한계는 체계적 편향과 개인 차이 범위를 함께 보여 줄 수 있다.

스포츠 측정오차의 체계적 편향, 무작위 오차, SEM/CV/일치한계 구분은
[Atkinson & Nevill 1998](https://pubmed.ncbi.nlm.nih.gov/9820922/)이 직접 다루고,
ICC 모형과 SEM 해석은 [Weir 2005](https://pubmed.ncbi.nlm.nih.gov/15705040/)가 설명한다.
COSMIN 2024 설명 문서는 SEM/SDC/일치한계의 **사용 공식과 선택 이유를 모두 보고**하라고
요구한다. 다만 COSMIN은 주로 임상 PROM 방법이므로 청소년 러너의 처방 수치로 직접 이전할
수 없다
([COSMIN Reporting Guideline 2.0 explanation](https://www.cosmin.nl/wp-content/uploads/EE-document_final-version-website.pdf)).

### 5.3 제품 판정

```text
if compatible_error_model is unavailable:
    error_exceedance = UNKNOWN
elif abs(Delta) > prespecified_error_bound:
    error_exceedance = EXCEEDED
else:
    error_exceedance = NOT_EXCEEDED
```

`EXCEEDED`여도 다음은 여전히 `UNKNOWN`이다.

- 선수에게 중요한가
- 훈련 때문에 생겼는가
- 앞으로 반복되는가
- 계획을 바꿔도 안전한가

## 6. 최소효과: ‘오차보다 큼’과 ‘행동할 가치가 있음’을 분리한다

### 6.1 두 문턱

| 문턱 | 질문 | 근거 |
|---|---|---|
| 오차 문턱 | 이 차이가 측정오차 범위를 넘는가? | SEM, TE, MDC/SDC, LoA, CV |
| 중요 문턱 | 이 차이가 선수·코치·경기 목표에 실제로 중요한가? | 사전 합의된 anchor, 경기 맥락, 타당한 중요변화 연구 |

최소중요변화는 선수나 코치가 중요하다고 판단하는 변화, 경기 결과에 의미 있는 변화, 또는
타당한 외부 기준으로 정당화해야 한다. `0.2 * 집단 SD`나 `0.3 * 개인 경기 변동` 같은 관행을
모든 지표의 진리로 하드코딩하지 않는다. 분포 기반 값은 유용한 참고가 될 수 있지만 선수의
가치판단을 대신하지 않는다. 측정오차와 중요변화를 함께 해석해야 한다는 구조는
[Swinton et al. 2018](https://pmc.ncbi.nlm.nih.gov/articles/PMC5985399/) 및
[COSMIN manual 2.0](https://www.cosmin.nl/wp-content/uploads/COSMIN-manual-V2_final.pdf)과
일치한다.

### 6.2 가능한 네 상태

| 오차 초과 | 중요 변화 | 해석 |
|---|---|---|
| 아니오 | 아니오 | 작은 관찰 차이, 행동 근거 아님 |
| 예 | 아니오 | 잘 측정되었지만 실무적으로 작을 수 있음 |
| 아니오 | 예 | 중요할 가능성은 있으나 현재 도구로 구분 불가 |
| 예 | 예 | 변화 후보, 그래도 원인·안전·처방 권한은 별도 |

## 7. 자기상관과 추세: 기록은 서로 독립이 아니다

### 7.1 AR(1) 잔차 모형 예

```text
epsilon_t = delta * epsilon_(t-1) + u_t
```

### 7.2 동적 결과 모형 예

```text
Y_t = delta * Y_(t-1) + gamma * X_t + epsilon_t
```

두 모형에서 `gamma`의 의미는 같지 않다. 동적 모형의 효과는 직전 결과를 조건으로 한 값이다.
N-of-1에서 반복 관찰을 독립 표본처럼 다루면 1종·2종 오류가 달라질 수 있다.
[AHRQ N-of-1 Chapter 4](https://effectivehealthcare.ahrq.gov/products/n-1-trials/research-2014-1)는
추세, AR/동적 모형, 반복 측정과 이월 처리를 공식적으로 설명하고,
[CENT 2015 explanation](https://www.bmj.com/content/350/bmj.h1793)는 기간효과, 이월,
개인내 상관을 어떻게 처리했는지 보고하도록 요구한다.

[Tang & Landes 2020](https://journals.plos.org/plosone/article?id=10.1371%2Fjournal.pone.0228077)은
단일 개인의 직렬상관을 고려한 t 검정을 시뮬레이션으로 평가했고 일반 t 검정보다 나은 성능을
보였지만, 관찰이 적을 때는 주의가 필요하다고 명시한다. 특정 논문의 필요 관찰 수를 다른
지표에 복사하지 않는다.

### 7.3 추세·계절·성장 체크

다음 중 하나라도 해결되지 않으면 인과 비교로 올리지 않는다.

- 개입 전부터 같은 방향의 추세가 있었음
- 대회 시즌, 방학, 고도, 온도, 학업 스트레스가 구간과 겹침
- 청소년 성장·성숙 변화가 관찰 구간과 겹침
- 기기·앱·펌웨어·측정 프로토콜 변경이 구간과 겹침
- 웨이트, 플라이오, MAIN, 힐, 대체 유산소가 동시에 달라짐
- 질병, 통증, 수면, 여행, 약물 등의 맥락이 누락됨

[Lanovaz & Primiani 2023](https://pubmed.ncbi.nlm.nih.gov/35469087/)의 Monte Carlo 연구는
“기준선이 안정될 때까지 기다리기”의 가치가 분석 방법에 따라 달라짐을 보였다. 따라서
`안정성 달성 = 고정 n 충족` 같은 간단한 규칙은 정당화되지 않는다.

## 8. 이월과 지연: 훈련에서는 가장 큰 함정

### 8.1 공식 방법론의 선택지

AHRQ N-of-1 지침은 이월을 다음과 같이 처리한다.

1. 충분한 washout을 설계한다.
2. 전환 직후 관찰을 버리거나 가중치를 낮춘다.
3. 효과가 서서히 사라지는 전이함수를 모형화한다.
4. 전체 관찰과 전환 구간 제외 분석을 비교하는 민감도 분석을 한다.

기간은 새 효과가 나타날 시간, 이전 효과가 사라질 시간, 충분한 교차 횟수, 사용자 부담을
균형 있게 고려해야 한다
([AHRQ Chapter 4](https://effectivehealthcare.ahrq.gov/products/n-1-trials/research-2014-1)).
[SPENT 2019](https://www.bmj.com/content/368/bmj.m122)은 프로토콜 단계에서 기간 수, 교차 수,
기간 길이, run-in과 washout을 명시하도록 한다.

### 8.2 훈련에 그대로 적용할 수 없는 이유

근력, 플라이오, 유산소 적응은 다음 세션에도 남는 것이 정상이다. 완전 washout을 요구하면
훈련 목적을 훼손하고, 선수에게 불필요한 중단을 요구하며, 실제 시즌과 멀어진다.

따라서:

- MAIN 다음 72시간의 상태만 보고 MAIN의 독립 효과라고 말하지 않는다.
- 복합 세션을 한 종류로 뭉개지 않되, 각 구성요소의 독립 효과를 자동 분해하지 않는다.
- cumulative adaptation이 예상되면 withdrawal ABAB보다 사전 블록 비교나 다중기준선을
  검토한다.
- 이월 지속시간을 모르면 숫자를 추정하지 않고 `CARRYOVER_UNKNOWN`으로 둔다.
- 9.5일 프레임 길이가 이월이 모두 사라졌다는 뜻은 아니다.

## 9. 결측: 안 쓴 날을 0이나 정상으로 만들지 않는다

### 9.1 최소 저장 규칙

```text
expected_at
observed_at
missing_state
missing_reason
phase_or_context
device_or_method
```

### 9.2 금지

- 누락을 `0`, `회복`, `문제 없음`으로 채우기
- 조용히 직선 보간하고 실제 입력처럼 저장하기
- 기준선과 개입 구간의 결측률 차이를 숨기기
- 아픈 날에 기록하지 않은 가능성을 무시하고 MCAR로 가정하기
- `PRIVATE_SELF_ONLY` 메모의 존재·빈도·시각으로 결측 이유를 추론하기

### 9.3 추론 단계의 처리

1. 결측 원인과 구간별 분포를 보여 준다.
2. 분석 전에 처리법을 고정한다.
3. 보간값은 관찰값과 별도 provenance로 둔다.
4. 인과 비교를 시도하면 완전사례, 가정 가능한 대치, 결측 민감도 분석 결과를 비교한다.
5. MNAR 가능성 또는 구간 불균형이 크고 해결할 수 없으면 level 4를 막는다.

[Somer et al. 2022](https://pubmed.ncbi.nlm.nih.gov/35225017/)는 SCED의 자기상관 모형과 다중대치를
시뮬레이션으로 평가했다. 결과는 특정 결측 기제와 모형에 대한 것이며, 제품의 보편 결측률
허용치가 아니다.

## 10. 보편 최소 `n`을 만들 수 있는가

### 10.1 판정: `NO_UNIVERSAL_N`

| 주장 | 최소 관찰 수 판정 | 이유 |
|---|---|---|
| 한 기록의 존재 | 유효 1건 | 비교나 정상성 주장이 아님 |
| 개인 설명 기준선 | 고정 수 없음 | 지표 시간척도·맥락·누락·프로토콜에 의존 |
| 오차 초과 변화 | 고정 수 없음 | 외부 오차 연구의 적합성 또는 개인 반복 측정 설계에 의존 |
| 전향 비교 | 고정 수 없음 | 효과 크기, 오차, 직렬상관, 설계, 교차, 추세, 이월에 의존 |

WWC의 SCED 심사 도구는 연구 설계를 표준에 맞춰 검토하는 도구다. 현재 공식 페이지는
버전 4.1/5.0 단일사례 설계 가이드를 제공한다고 명시한다
([WWC Study Review Guide](https://ies.ed.gov/ncee/WWC/StudyReviewGuide)). 그 안의 특정 phase
관찰 수 또는 효과 재현 횟수를 선수 앱의 범용 readiness 기준으로 가져올 수 없다.

스포츠 SCED 사례에서 `3~5회`, `5~7주`를 썼더라도 이는 해당 연구의 설계 선택이다.
Southey 연구의 주 1회, 5~7주 기준선은 점프 지표와 그 참여자에게 해당하며, 매일 입력되는
청소년 러너의 RPE나 9.5일 계획에 필요한 최소 기록 수가 아니다.

### 10.2 대신 무엇을 저장하는가

```yaml
evidence_coverage:
  eligible_n: integer
  expected_n: integer_or_unknown
  span_start: timestamp
  span_end: timestamp
  cadence_observed: description
  context_coverage: list
  protocol_versions: list
  missing_count: integer
  missing_by_phase: map
  comparability: PASS | PARTIAL | FAIL | UNKNOWN
```

판정은 숫자 하나가 아니라 **이 주장을 대표하는 범위가 있는가**를 검토한다. 필요한 범위가
사전 정의되지 않았으면 `UNKNOWN`으로 남긴다.

## 11. 보편 신선도 기준을 만들 수 있는가

### 11.1 판정: `NO_UNIVERSAL_FRESHNESS_THRESHOLD`

신선도는 단순히 “몇 시간 지났는가”가 아니라 다음의 함수다.

```text
freshness_sufficiency = f(
  construct_time_scale,
  intended_decision,
  observed_at,
  source_generated_at,
  received_at,
  protocol_version,
  known_change_events,
  validity_horizon_evidence
)
```

예를 들어 세션 RPE는 입력 시각에 따라 값이 달라질 수 있지만, 경기 PB는 몇 시간 지났다고
무효가 되지 않는다. 반대로 아침 HRV를 며칠 뒤 오늘의 상태처럼 사용할 수는 없다. 그래서
다음 숫자를 전역 상수로 두지 않는다.

- `FRESH_IF_WITHIN_24_HOURS`
- `BASELINE_READY_AFTER_7_DAYS`
- `VALID_FOR_ONE_9_5_DAY_FRAME`

### 11.2 fail-closed 규칙

```text
if validity_horizon_evidence is absent:
    freshness = UNKNOWN
    personalized_value_eligible = false
    plan_action = KEEP_CURRENT_COACH_AUTHORED_PLAN
```

`UNKNOWN`은 데이터가 쓸모없다는 뜻이 아니다. 원자료와 설명 기준선에는 남길 수 있지만,
시간 민감한 추천 입력으로 승격하지 않는다는 뜻이다.

## 12. 스포츠·중장거리·청소년 직접 적용

| 자료 | 대상·설계 | 직접성 | 무엇을 지지하는가 | 무엇을 지지하지 않는가 |
|---|---|---|---|---|
| [Mann et al. 2019](https://pubmed.ncbi.nlm.nih.gov/30160557/), DOI `10.1123/ijspp.2018-0120` | 청소년 거리주자 15명, 2주, sRPE 시각 비교 | `DIRECT_YOUTH_DISTANCE` | 응답 시각과 프로토콜 표준화가 중요함. 30분 값은 직후보다 낮았음 | 개인 최소 n, readiness, 자동 처방, 9.5일 효과 |
| [Garcia et al. 2022](https://pubmed.ncbi.nlm.nih.gov/34902855/), DOI `10.4085/1062-6050-523-21` | 고교 크로스컨트리 24명, 시즌 일일 설문 case series | `DIRECT_YOUTH_DISTANCE` | 시간·거리와 RPE 결합 부하는 다른 주간 변화를 보일 수 있음 | 인과, 부상 예측, 개인 처방 기준, 신선도 |
| [Bahenský & Grosicki 2021](https://pmc.ncbi.nlm.nih.gov/articles/PMC8001752/), DOI `10.3390/bios11030077` | 청소년 중·장거리 16명, 2주 고지 캠프, matched groups | `DIRECT_YOUTH_DISTANCE` | 아침 HRV로 계획을 조정하는 운영 가능성과 단기 성과 신호 | N-of-1 인과, 보편 HRV 문턱, 9.5일, 다양한 집단 일반화 |
| [Nuuttila et al. 2022](https://pubmed.ncbi.nlm.nih.gov/35975912/), DOI `10.1249/MSS.0000000000002968` | 성인 레크리에이션 러너 30명, 15주, 회복·훈련상태 기반 조정 | `DIRECT_SPORT` | 복수 신호로 주 2회 계획을 조정하는 알고리즘 사례 | 청소년, 개인 인과, 고정 신선도/n, 9.5일 우월성 |
| [Southey et al. 2025](https://pmc.ncbi.nlm.nih.gov/articles/PMC12194246/), DOI `10.3390/jfmk10020191` | 성인 남성 4명, 비동시 다중기준선, 근력·플라이오 | `DIRECT_SPORT` | 스포츠 훈련 SCED 가능성, 개인별 상반된 변화 | 엘리트·청소년·러닝 직접성, 보편 3~5점 규칙 |
| [Harry et al. 2024](https://pubmed.ncbi.nlm.nih.gov/38662890/), DOI `10.1519/JSC.0000000000004727` | 선수 4명, 격주 CMJ 5회 예시 | `DIRECT_SPORT` | 개인 선수 변화 판정 방법을 실무 데이터에 적용 | 5회면 충분하다는 보편 규칙, 훈련 원인, 9.5일 |
| [Kinugasa et al. 2004](https://pubmed.ncbi.nlm.nih.gov/15575794/), DOI `10.2165/00007256-200434150-00003` | 엘리트 선수 단일대상 설계 방법 논의 | `DIRECT_SPORT_METHOD` | 엘리트 환경에서 집단설계 대안의 필요와 방법 | 청소년 9.5일 직접 효능, 제품 문턱 숫자 |

### 12.1 스포츠 자료에서 실제로 배울 점

1. **한 신호로 충분하지 않다.** 시간·거리와 sRPE는 서로 다른 부하 그림을 줄 수 있다.
2. **측정 시각이 데이터 정의의 일부다.** “RPE”라는 필드 이름만 같아도 즉시와 30분 값은
   같은 프로토콜이 아니다.
3. **집단 평균은 개인의 안정된 반응자 특성을 증명하지 않는다.** 작은 그룹의 좋은 결과도
   개인별 자동 문턱을 제공하지 않는다.
4. **청소년에게 성인 수치를 바로 이전하지 않는다.** 성장, 학교 일정, 보호자, 부담과 장기
   안전 맥락이 추가된다.
5. **직접 9.5일 비교근거가 없다는 사실은 제품 정체성을 취소하지 않는다.** 다만 과학적으로
   보편 최적이라는 표현과 근거 없는 개인화 숫자를 막는다.

## 13. 근거 출처 감사표

| ID | 출처 | 유형 | DOI/공식 URL | 직접성 | 핵심 사용 | 한계 |
|---|---|---|---|---|---|---|
| M01 | AHRQ N-of-1 Chapter 4 | 미국 정부 공식 방법 지침 | [official](https://effectivehealthcare.ahrq.gov/products/n-1-trials/research-2014-1) | `DIRECT_METHOD` | 균형·무작위, 추세, 자기상관, 이월, washout, 반복 측정 | 임상 중심; 훈련 수치 직접 이전 금지 |
| M02 | CENT 2015 explanation | 공식 보고 지침 | [DOI 10.1136/bmj.h1793](https://www.bmj.com/content/350/bmj.h1793) | `DIRECT_METHOD` | 기간효과·이월·개인내 상관 보고 | 보고 품질 지침이지 자동 분석 알고리즘 아님 |
| M03 | SPENT 2019 | 공식 프로토콜 지침 | [DOI 10.1136/bmj.m122](https://www.bmj.com/content/368/bmj.m122) | `DIRECT_METHOD` | 기간·교차·run-in·washout 사전 명시 | 임상 N-of-1 중심 |
| M04 | SCRIBE 2016 | 공식 SCED 보고 지침 | [EQUATOR registry](https://www.equator-network.org/reporting-guidelines/scribe-statement/) | `DIRECT_METHOD` | 단일사례 연구의 투명한 보고 | 충분성 수치 또는 처방 권한을 주지 않음 |
| M05 | WWC SCD Guide | 미국 IES 공식 설계 심사 도구 | [official](https://ies.ed.gov/ncee/WWC/StudyReviewGuide) | `DIRECT_METHOD` | SCED 설계 특성·표준 심사 | 교육 연구 심사 숫자를 선수 게이트로 이전 금지 |
| M06 | Atkinson & Nevill 1998 | 스포츠 측정 방법 리뷰 | [DOI 10.2165/00007256-199826040-00002](https://pubmed.ncbi.nlm.nih.gov/9820922/) | `DIRECT_SPORT_METHOD` | 편향, 무작위오차, SEM/CV/LoA | 지표별 값을 제공하지 않음 |
| M07 | Weir 2005 | ICC/SEM 방법 논문 | [DOI 10.1519/15184.1](https://pubmed.ncbi.nlm.nih.gov/15705040/) | `DIRECT_METHOD` | ICC 모형, SEM, 개인 변화 | 공식 선택에 따라 결과가 달라짐 |
| M08 | Swinton et al. 2018 | 개인반응 통계 프레임워크 | [DOI 10.3389/fnut.2018.00041](https://pmc.ncbi.nlm.nih.gov/articles/PMC5985399/) | `DIRECT_SPORT_METHOD` | 오차, 불확실성, SWC 분리 | 반응자 안정성·인과를 자동 증명하지 않음 |
| M09 | Senn 2016 | 개인화 분산 방법 논문 | [DOI 10.1002/sim.6739](https://pmc.ncbi.nlm.nih.gov/articles/PMC5054923/) | `DIRECT_METHOD` | 반복 대비 없이 개인효과 과장 금지 | 임상 예시 중심 |
| M10 | Tang & Landes 2020 | Monte Carlo 방법 연구 | [DOI 10.1371/journal.pone.0228077](https://journals.plos.org/plosone/article?id=10.1371%2Fjournal.pone.0228077) | `DIRECT_METHOD` | 직렬상관을 고려한 단일 개인 검정 | 적은 관찰 주의; 보편 n 아님 |
| M11 | Lanovaz & Primiani 2023 | Monte Carlo 방법 연구 | [DOI 10.3758/s13428-022-01858-9](https://pubmed.ncbi.nlm.nih.gov/35469087/) | `DIRECT_METHOD` | 기준선 안정성 규칙의 분석 의존성 | 시뮬레이션 조건과 분석법에 의존 |
| M12 | Somer et al. 2022 | SCED 결측·자기상관 시뮬레이션 | [DOI 10.1177/01632787211071136](https://pubmed.ncbi.nlm.nih.gov/35225017/) | `DIRECT_METHOD` | AR(1), NW/FGLS, 다중대치 비교 | 매개분석·가정별 결과; 보편 결측률 아님 |
| M13 | Tanious & Onghena 2019 | 무작위 SCED 방법/적용 | [DOI 10.3390/healthcare7040143](https://pmc.ncbi.nlm.nih.gov/articles/PMC6955662/) | `DIRECT_METHOD` | 실제 무작위 할당과 무작위화 검정 | 훈련 이월·청소년 특수성 미해결 |
| S01 | Mann et al. 2019 | 청소년 거리주자 관찰 연구 | [DOI 10.1123/ijspp.2018-0120](https://pubmed.ncbi.nlm.nih.gov/30160557/) | `DIRECT_YOUTH_DISTANCE` | sRPE 시각·표준화 | 15명·2주, 처방 연구 아님 |
| S02 | Garcia et al. 2022 | 고교 러너 시즌 case series | [DOI 10.4085/1062-6050-523-21](https://pubmed.ncbi.nlm.nih.gov/34902855/) | `DIRECT_YOUTH_DISTANCE` | 부하 표현의 불일치 | 관찰적, 개인 인과 없음 |
| S03 | Bahenský & Grosicki 2021 | 청소년 러너 matched groups | [DOI 10.3390/bios11030077](https://pmc.ncbi.nlm.nih.gov/articles/PMC8001752/) | `DIRECT_YOUTH_DISTANCE` | HRV-guided 운영 사례 | 16명·2주 고지 캠프, 일반화 제한 |
| S04 | Nuuttila et al. 2022 | 성인 러너 집단 비교 | [DOI 10.1249/MSS.0000000000002968](https://pubmed.ncbi.nlm.nih.gov/35975912/) | `DIRECT_SPORT` | 복합 상태기반 조정 사례 | 성인·15주·집단설계, 개인 N-of-1 아님 |
| S05 | Southey et al. 2025 | 스포츠 SCED 1차 적용 | [DOI 10.3390/jfmk10020191](https://pmc.ncbi.nlm.nih.gov/articles/PMC12194246/) | `DIRECT_SPORT` | 비동시 다중기준선 실행 가능성 | 성인 레크리에이션 남성 4명 |

## 14. TRAINORACLE용 연구 제안 객체

이 절은 정본 스키마 변경이 아니라 후속 사양 검토용 제안이다.

```yaml
within_athlete_evidence:
  claim_tier: OBSERVATION | DESCRIPTIVE_BASELINE | MEASUREMENT_ERROR_EXCEEDING_CHANGE | PROSPECTIVE_HYPOTHESIS_COMPARISON
  metric_id: string
  intended_use: string
  protocol_compatibility: PASS | PARTIAL | FAIL | UNKNOWN
  eligible_n: integer
  span: {start: timestamp, end: timestamp}
  context_coverage: [string]
  missingness: {count: integer, by_phase: map, mechanism: MCAR | MAR | MNAR | UNKNOWN}
  error_model:
    status: AVAILABLE | UNAVAILABLE | INCOMPATIBLE
    method: SEM | TE | MDC | LOA | CV | OTHER | UNKNOWN
    formula_version: string_or_null
    population_directness: DIRECT | PARTIAL | INDIRECT | UNKNOWN
    uncertainty: object_or_null
  important_effect:
    status: DEFINED | UNDEFINED
    owner: ATHLETE_COACH | RESEARCH | UNKNOWN
    rationale: string_or_null
  serial_structure:
    autocorrelation: ADDRESSED | NOT_ADDRESSED | NOT_ESTIMABLE | UNKNOWN
    trend: ADDRESSED | NOT_ADDRESSED | UNKNOWN
    carryover: ADDRESSED | NOT_ADDRESSED | UNKNOWN
  freshness:
    evidence_status: DEFINED | UNDEFINED
    status: SUFFICIENT | INSUFFICIENT | UNKNOWN
  decision:
    personalized_value_eligible: boolean
    plan_action: USE_APPROVED_VALUE | KEEP_CURRENT_COACH_AUTHORED_PLAN
    reason_codes: [string]
```

### 14.1 fail-closed 의사결정

```text
PERSONALIZED_VALUE_ELIGIBLE only if all required gates for that exact value pass.

Otherwise:
  do not estimate
  do not interpolate
  do not borrow a private-note signal
  do not convert UNKNOWN to zero
  do not change the accepted plan
  KEEP_CURRENT_COACH_AUTHORED_PLAN
```

### 14.2 권장 이유 코드

```text
PROTOCOL_INCOMPATIBLE
CONTEXT_COVERAGE_UNDEFINED
MEASUREMENT_ERROR_MODEL_UNAVAILABLE
IMPORTANT_EFFECT_UNDEFINED
AUTOCORRELATION_NOT_ADDRESSED
TREND_NOT_ADDRESSED
CARRYOVER_UNKNOWN
MISSINGNESS_UNRESOLVED
FRESHNESS_HORIZON_UNDEFINED
PROSPECTIVE_COMPARISON_NOT_REGISTERED
```

이유 코드에는 `PRIVATE_NOTE_EXISTS`, `PRIVATE_NOTE_MISSING`, `PRIVATE_NOTE_RECENT` 같은 값이
절대 들어가면 안 된다. `PRIVATE_SELF_ONLY`는 존재 여부까지 무신호이므로, 분석 파이프라인은
그런 상태 자체를 알 수 없어야 한다.

## 15. 사용자 관점: “왜 아직 추천에 안 썼나요?” 5단계 설명

설명 단계는 같은 결정을 난이도만 바꿔 보여 준다. 쉬운 단계가 더 많은 생활어를 쓸 수 있고,
정확한 단계는 구조화된 세부정보를 제공한다. 어느 단계도 선수를 탓하거나 기록 연속 보상을
근거 충분성과 혼동하지 않는다.

### 단계 1: 아주 쉽게

> **이번에는 이 기록으로 계획을 바꾸지 않았어요.**
>
> 같은 조건에서 확인할 근거와 측정 기준이 아직 맞지 않아요. 없는 숫자는 짐작하지 않고,
> 지금 코치가 정한 계획을 그대로 보여줘요. 나만의 메모는 분석하지 않아요.

사용자 행동:

- `현재 계획 보기`
- `비교 가능한 기록 보기`
- 기록이 더 필요한 경우에만 `다음 기록 방법 보기`

### 단계 2: 짧게

> **개인화 값 사용 안 함**
>
> 같은 측정 조건·오차 기준·사용 가능 기간 중 필요한 항목이 확인되지 않았습니다.
> 9.5일 기본 틀과 현재 코치 계획은 유지됩니다.

### 단계 3: 균형 있게

> 최근 기록은 저장되어 있지만, 이번 추천에 필요한 조건을 모두 만족하지는 않았습니다.
> 비교에 맞는 기록의 범위, 측정오차 기준, 추세·이월 또는 사용 가능 기간 중 하나 이상이
> 아직 확인되지 않았습니다. 그래서 개인화 숫자를 새로 만들지 않았고 현재 코치 계획을
> 유지했습니다. 원자료와 사용 여부는 직접 확인할 수 있습니다.

화면에 함께 표시:

- 사용한 공개/훈련 데이터 종류
- 비교 가능 기록 수와 기간
- 통과/미확인 이유
- 계획이 바뀌지 않았다는 결과
- 다음에 선수가 할 수 있는 한 가지 행동

### 단계 4: 자세히

> **추천 보류 이유**
>
> - 지표: `session_rpe`
> - 비교 가능 기록: `n = 6`, `2026-07-01 ~ 2026-07-16`
> - 측정 프로토콜: `직후 입력 4건`, `30분 후 입력 2건`으로 혼합
> - 측정오차 모형: 이 혼합 프로토콜에 맞는 값 없음
> - 추세/자기상관: 현재 자료로 판정하지 않음
> - 신선도 근거: 지표별 사용 가능 기간 미정
> - 결과: 개인화 값 미생성, 현재 코치 계획 유지

중요: 위 숫자는 형식 예시다. 실제 판정 수치로 채택한 것이 아니다.

### 단계 5: 정확하게

```yaml
claim_tier: OBSERVATION
metric_id: session_rpe
intended_use: PERSONALIZED_FORMATION_INPUT
protocol_compatibility: PARTIAL
eligible_n: 6
coverage_span: 2026-07-01/2026-07-16
error_model: UNAVAILABLE
important_effect: UNDEFINED
autocorrelation: NOT_ESTIMABLE
trend: UNKNOWN
carryover: UNKNOWN
freshness_horizon: UNDEFINED
personalized_value_eligible: false
plan_action: KEEP_CURRENT_COACH_AUTHORED_PLAN
reason_codes:
  - PROTOCOL_INCOMPATIBLE
  - MEASUREMENT_ERROR_MODEL_UNAVAILABLE
  - FRESHNESS_HORIZON_UNDEFINED
private_self_only_policy: ZERO_SIGNAL_BY_CONTRACT
```

`private_self_only_policy`는 계약 설명이지, 선수가 실제로 비공개 메모를 썼는지 알려 주는
필드가 아니다.

## 16. 사용자 경험 개선 제안

### 16.1 첫 화면은 통계가 아니라 결과부터

표시 순서:

1. `현재 계획 유지`
2. `이번에 개인화에 쓰지 않은 이유`
3. `다음 기록에서 맞출 수 있는 한 가지`
4. `세부 근거 보기`

“데이터 부족”만 쓰면 선수는 자신이 게으르다는 평가로 받아들일 수 있다. 실제 실패가
기기·프로토콜·오차연구·신선도 정의 문제라면 정확히 그 이유를 쓴다.

### 16.2 기록 연속성과 근거 승격을 분리

- 체크, 스티커, 연속 기록 보상은 참여를 격려할 수 있다.
- 하지만 연속 7일, 스티커 10개가 분석 근거 통과를 뜻해서는 안 된다.
- `꾸준히 기록했어요`와 `이번 추천에 사용할 수 있어요`를 별도 상태로 보여 준다.
- 누락이 있어도 벌점·경고보다 “이 비교에서는 제외했어요”라고 설명한다.

### 16.3 선수 통제권

- 추천에 사용된 원자료와 제외된 이유를 볼 수 있다.
- 잘못된 기록은 정정할 수 있고 정정 이력은 남는다.
- 분석용 훈련 메모와 `PRIVATE_SELF_ONLY`를 명확히 구분한다.
- 비공개 메모는 분석 여부 설명 화면에도 존재 흔적을 남기지 않는다.
- 코치에게 보이는 정보와 선수만 보는 정보의 경계를 저장 전에 알려 준다.

### 16.4 청소년 사용자

- 첫 설명은 중학생이 읽을 수 있는 생활어로 쓴다.
- `자기상관`, `MDC`, `이월`은 4~5단계에서만 노출한다.
- 부모/보호자와 코치에게 공개되는 범위를 별도 문장으로 보여 준다.
- 성장·시험·수면·통증 같은 맥락 입력을 강제해 기록 부담을 키우지 말고, 추천에 꼭 필요한
  최소 항목만 요청한다.

## 17. 후속 검증 과제

이 문서는 보편 수치를 만들지 않는다. 다음은 높은 수준의 통계·도메인 검토가 필요한 목표다.

1. 각 후보 지표의 정확한 intended use와 시간척도 정의
2. 청소년 중장거리 집단에 호환되는 측정오차 자료 확보 또는 자체 반복측정 연구
3. 선수·코치가 정하는 지표별 최소중요변화 anchor 절차
4. 성장·성숙, 대회, 복합훈련을 포함한 전향적 비교 프로토콜
5. 작은 시계열에서 AR/상태공간/무작위화 검정의 사전 시뮬레이션과 power 분석
6. 이월이 긴 훈련 요소의 다중기준선 또는 staggered block 설계
7. 결측 기제와 입력 부담을 함께 평가하는 청소년 파일럿
8. 지표별 신선도 horizon을 정당화할 근거와 버전 관리
9. 5단계 설명의 중학생 이해도, 불안 유발, 코치 신뢰, 행동 가능성 사용자 테스트
10. 9.5일 기본 자동 처방이 현재 코치 계획을 언제 새 version으로 만들 수 있는지 별도 권한 계약

## 18. 최종 제품 경계

```yaml
universal_minimum_n: FORBIDDEN_WITH_CURRENT_EVIDENCE
universal_freshness_threshold: FORBIDDEN_WITH_CURRENT_EVIDENCE
measurement_error_equals_importance: false
error_exceedance_equals_causality: false
observational_log_equals_experiment: false
training_washout_assumed: false
private_self_only_signal_use: forbidden
unjustified_personalized_number: forbidden
default_9_5_identity: retained
fallback_for_failed_personalization_gate: KEEP_CURRENT_COACH_AUTHORED_PLAN
```

가장 중요한 사용자 약속은 하나다.

> TRAINORACLE은 기록이 많아 보인다는 이유만으로 개인화 숫자를 만들지 않는다. 무엇이
> 부족하거나 맞지 않는지 설명하고, 근거가 준비될 때까지 현재 코치 계획을 지킨다.
