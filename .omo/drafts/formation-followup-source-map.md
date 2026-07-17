# Formation Follow-up Research Source Map

```yaml
status: PRE_RESEARCH_SOURCE_MAP
purpose: PLAN_INPUT_NOT_FINAL_CONCLUSION
runtime_authority: false
prescription_authority: false
medical_or_safety_authority: false
searched_through: 2026-07-16
```

## 1. Research Thesis

이번 연구는 9.5일 Formation의 채택 여부를 결정하지 않는다. 9.5일은 확정된
제품 정체성이며 자동 처방에 준하는 계획 생성이 목표다. 연구는 고정 7일의
문제를 줄이면서 9.5일 자동 생성이 일관되고 설명 가능하게 작동할 조건과 멈출
조건을 검증한다. 다음 네 가지를 확인한다.
검증해야 한다.

1. 세션의 이름이 아니라 **실제 구성요소와 선수 반응**에 따라 다음 MAIN까지의
   간격을 설명할 수 있는가.
2. 복합 세션을 한 개의 피로 점수로 뭉개지 않고도 계획과 실제의 차이를
   유용하게 보여줄 수 있는가.
3. 선수 한 명의 반복자료에서 **관찰**, **의미 있는 변화**, **가설에 맞는 경향**,
   **인과적 효과**를 어디까지 구분할 수 있는가.
4. 9.5일 정본 프레임으로 선택지를 줄이되, 어떤 입력·충돌·안전 상태에서는 자동
   처방을 중단하고 코치의 별도 예외 계획으로 넘겨야 하는가.

현재 가장 타당한 제품 가설은 다음과 같다.

> TRAINORACLE은 고정 7일 달력 대신 9일 12시간 Formation을 정본으로 사용해
> 훈련계획을 자동 구성한다. 선수 데이터·세션 구성·대회 앵커에 따라 틀 안을
> 조정하고, 충돌·불충분 근거·안전 상태에서는 자동 처방을 멈추고 사람에게 넘긴다.

## 2. Seven Research Questions

### RQ-A: Frame And Exposure Density

**질문:** 고정 7일 주기가 세션 간격과 대회 배치에 만드는 문제는 무엇이며,
9.5일당 MAIN 2-3회 자동 구성은 어떤 입력·제약·우선순위로 일관되게 작동해야
하는가? 어떤 조건에서는 후보를 내지 않고 코치 판단으로 전환해야 하는가?

**직접 비교:** 7일 대 비주간 또는 9·10일 프레임 연구가 있으면 최우선으로
포함한다. 검증 가능한 코칭 교재·엘리트 사례에서 9·10일 마이크로사이클의 실제
사용 빈도와 목적을 별도 근거 등급으로 조사한다. 결과는 제품 채택을 취소하는
투표가 아니라 설명 문구, 자동 규칙, 예외·중단 조건을 정하는 입력이다.

**간접 근거 사슬:** 중·장거리 러너의 강한 날/쉬운 날 구성 → 훈련강도 분포 →
세션별 급성 회복 → 장기 적응 → 선수·시기별 예외.

**Seed sources**

- [Training Periodization, Methods, Intensity Distribution, and Volume in Highly Trained and Elite Distance Runners](https://pubmed.ncbi.nlm.nih.gov/35418513/) — systematic review; 전통적인 hard-day/easy-day 구성과 종목별 TID를 설명하지만 청소년 9·10일 비교는 아니다.
- [Training-intensity Distribution on Middle- and Long-distance Runners](https://pubmed.ncbi.nlm.nih.gov/34749417/) — systematic review; 측정법에 따라 같은 훈련도 강도 분포가 달라질 수 있음을 보여준다.
- [Which Training Intensity Distribution Intervention...](https://pubmed.ncbi.nlm.nih.gov/39888556/) — 2025 individual-participant network meta-analysis; 평균적인 TID 효과를 갱신하는 자료지만 정확한 세션 간격을 정하지 않는다.
- [Block periodization of endurance training](https://pubmed.ncbi.nlm.nih.gov/31802956/) — systematic review/meta-analysis; 일부 평균 효과는 유리하지만 작은 연구와 낮은 방법론 품질 때문에 직접성은 낮다.

**예상 판정:** `9.5일 과학적 우월성 evidence_status = UNKNOWN`;
`owner_target_authority = 9_5_DAY_AUTOMATED_PRESCRIPTION`은 확정이다. 현재
`runtime_authority = false`이며 연구와 정식 안전·제품 게이트가 자동 규칙의 범위,
설명, 중단 조건을 결정한다.

### RQ-B: Recovery Interval By Session Type

**질문:** 약 72시간은 어떤 세션·측정 결과에서는 보수적이고, 어떤 경우에는
부족하며, 어떤 경우에는 불필요하게 긴가?

**분리할 결과:** 달리기 수행, 최대힘, 파워, 점프, 신경근 기능, 자율신경,
근육통, 주관적 회복, 생화학 표지. 한 결과의 회복을 전체 회복으로 부르지 않는다.

**Seed sources**

- [Neuromuscular and autonomic function is fully recovered within 24 h following SIT](https://pubmed.ncbi.nlm.nih.gov/37285051/) — primary acute study; 건강한 성인의 사이클 SIT에서 선택한 지표가 24시간 내 회복했다.
- [Gait and Neuromuscular Changes... 24-h After Interval Training Run](https://pubmed.ncbi.nlm.nih.gov/35721873/) — primary acute runner study; 다수는 24시간 내 회복 범위였지만 일부는 그렇지 않았다.
- [Plyometric recovery time course](https://pubmed.ncbi.nlm.nih.gov/20386477/) — primary acute study; 플라이오 뒤 지표별 24-72시간 영향을 검토할 직접 자료다.
- [Combined plyometric/resistance acute study](https://pubmed.ncbi.nlm.nih.gov/34296839/) — primary acute study; 복합 충격 세션의 48시간 잔류 가능성을 검토할 자료다.
- [Monitoring post-match residual fatigue](https://pubmed.ncbi.nlm.nih.gov/31820260/) — systematic review/meta-analysis; 축구 경기 자료로 러닝 훈련에 간접적이며 외적 부하만으로 잔류 피로를 충분히 예측하기 어렵다는 점을 검토한다.

**예상 판정:** 72시간 목표 간격의 `evidence_status = UNKNOWN`,
`product_authority = DESCRIPTION_ONLY`. `COACH_SELECTED_TARGET_INTERVAL`이라는
코치 선택값으로 경과·차이만 표시할 수 있다. 회복, 준비도, 안전, 통증·질환,
다음 MAIN 허가로 사용하는 것은 `evidence_status = NOT_SUPPORTED` 및
`product_authority = PROHIBITED`다.

### RQ-C: Composite And Concurrent Training

**질문:** 근력·플라이오·힐·HIIT·대체 유산소가 같은 세션 또는 인접한 날에
배치될 때 장기 적응과 단기 수행에 어떤 상호작용이 있는가?

**Seed sources**

- [Concurrent strength and endurance training in youth](https://pubmed.ncbi.nlm.nih.gov/30131714/) — youth systematic review/meta-analysis; 동시훈련 자체를 보편적으로 해로운 것으로 볼 수 없음을 시사한다.
- [Development of Maximal Dynamic Strength During Concurrent Training](https://pubmed.ncbi.nlm.nih.gov/33751469/) — systematic review/meta-analysis; 훈련된 성인에서는 같은 세션 배치의 하체 최대근력 간섭 가능성을 보여준다.
- [Order of same-day concurrent training](https://pubmed.ncbi.nlm.nih.gov/32407361/) — primary intervention; 약 3시간 분리와 순서가 일부 파워 적응에 영향을 줄 수 있음을 보여준다.
- [Heavy resistance versus plyometric training in runners](https://pubmed.ncbi.nlm.nih.gov/36370207/) — runner systematic review/meta-analysis; 러닝 이코노미 효과와 두 방식의 차이를 검토하지만 9.5일 배치 근거는 아니다.
- [IOC youth athletic development consensus](https://pubmed.ncbi.nlm.nih.gov/26084524/) — consensus; 성장과 장기적인 건강·참여를 고려하는 상위 경계다.

**예상 판정:** 복합일을 금지하는 대신 구성요소·순서·목표·기계적 충격을
보존한다. 같은 세션과 다른 세션은 서로 다른 노출로 기술한다.

### RQ-D: Descriptive Load Without A False Fatigue Score

**질문:** 외적 작업, 내적 반응, 파생 부하, 맥락을 어떤 단위와 프로토콜로
분리하면 유용성을 유지하면서 준비도·부상위험으로 월권하지 않는가?

**Seed sources**

- [Monitoring Athlete Training Loads: Consensus Statement](https://pubmed.ncbi.nlm.nih.gov/28463642/) — consensus; 내부·외부 부하의 다학제적 관찰 틀.
- [Session-RPE validity review](https://pubmed.ncbi.nlm.nih.gov/29163016/) — systematic review; sRPE의 유용성과 프로토콜 차이를 검토한다.
- [ACWR: Conceptual Issues and Fundamental Pitfalls](https://pubmed.ncbi.nlm.nih.gov/32502973/) — methodological critique; ACWR을 인과적 부상예방 규칙으로 사용하는 과장을 막는 핵심 반대 근거다.
- [Single-item athlete wellbeing review](https://pubmed.ncbi.nlm.nih.gov/32991706/) — systematic review; 주관 척도와 부하 관계가 일관되지 않으며 측정 속성 검증이 필요하다.

**예상 판정:** 하나의 색이나 점수는 화면 요약용일 수 있으나 정본 데이터는
구성요소와 단위를 유지한다. `total_fatigue`, `recovery_complete`, `safe_load`는
등록하지 않는다.

### RQ-E: Minimum Evidence For One Athlete

**질문:** 반복자료가 몇 개일 때 단순 표시, 개인 기준선 설명, 의미 있는 변화
탐지, 가설 비교를 각각 허용할 수 있는가?

**핵심 원칙:** 모든 결과에 같은 `n`을 강제하지 않는다. 최소 관찰수는 측정
신뢰도, 빈도, 자기상관, 계절성, 결측, 프로토콜 변경, 기대 효과의 크기에 따라
달라져야 한다.

**Seed sources**

- [Statistical Tests for Sports Science Practitioners](https://pubmed.ncbi.nlm.nih.gov/38662890/) — practitioner methods; CV, SEM, SWC와 개인 선수 변화 판정을 구분한다.
- [Consensus on measurement properties of performance tests](https://pmc.ncbi.nlm.nih.gov/articles/PMC5215201/) — Delphi consensus; 신뢰도·타당도·반응성과 의미 있는 변화를 함께 본다.
- [Wearable sensor reliability and validity recommendations](https://pmc.ncbi.nlm.nih.gov/articles/PMC5952119/) — measurement guidance; 기기 오차와 개인내 변동을 변화 해석 전에 확인한다.
- [CENT 2015 N-of-1 statement](https://www.bmj.com/content/350/bmj.h1738) — reporting guideline; 반복 교차 설계의 투명성을 제공하지만 훈련의 누적·잔류·비가역 적응에는 그대로 적용하기 어렵다.

**예상 판정:**

| 사용 | 초기 허용 원칙 |
|---|---|
| 단일 사실 표시 | 유효한 관찰 1개, provenance와 단위 표시 |
| 평균·분포 | 호환 관찰수와 coverage를 항상 표시 |
| 개인 기준선 | 지표별 신뢰도·프로토콜·기간을 먼저 결정; 보편 n 없음 |
| 의미 있는 변화 | 측정오차와 개인내 변동을 넘는지 검토 |
| 효과·인과 | 단순 누적일지로 불가; 사전 설계와 비교 구조 필요 |

### RQ-F: Youth Transfer And Pilot Evaluation

**질문:** 중학생 선수에게 적용할 때 어떤 보호 장치와 평가 설계가 있어야
코치 경험을 관찰 가능한 가설로 바꿀 수 있는가?

**Seed sources**

- [IOC youth athletic development consensus](https://pubmed.ncbi.nlm.nih.gov/26084524/) — 성장, 건강, 즐거움, 지속 가능한 참여를 함께 보는 원칙.
- [IOC elite youth athlete consensus](https://pubmed.ncbi.nlm.nih.gov/39197945/) — 2024 consensus; 청소년 발달이 비선형·비동시적이라는 최신 상위 경계.
- [CENT 2015 explanation](https://www.bmj.com/content/350/bmj.h1793) — 기간, 순서, 중재 변경, 중단 이유의 사전 기록 틀.
- [PRISMA 2020](https://www.prisma-statement.org/prisma-2020-statement) — 문헌수집과 제외 이유를 추적하는 보고 기준.

**예상 판정:** 첫 파일럿에서 허용되는 결과는 실행 가능성·관찰 가능성의
`evidence_status`를 별도로 평가하는 것이며, Formation 효능은 `UNKNOWN`이다.
제품 권한은 검토가 끝나기 전 `PROHIBITED`, 이후에도 승인 범위 안에서만
`SHADOW_PILOT_CANDIDATE`다. 실제 계획은 코치가 만들고 시스템은 차이와 근거만
보여준다.

### RQ-G: Youth Safety Boundaries And Athlete Stratification

**질문:** 성장 급등기, 성숙도, 성별, 월경·에너지 가용성, 수면·질환, 통증,
골스트레스·건병증 의심 상황에서 Formation이 무엇을 관찰할 수 있고 언제
계획 해석을 중단해 사람에게 돌려야 하는가?

**층화:** `800m 중심 | 800/1500m 혼합 | 1500m 중심`, 생물학적 성숙도,
훈련연령, 성별을 최소 효과수정자 후보로 둔다. 연령만으로 성숙을 추정하지 않는다.

**Seed sources**

- [IOC consensus on elite youth athletes](https://bjsm.bmj.com/content/58/17/946) — 2024 consensus; 비선형·비동시적 발달과 선수 중심 보호 원칙.
- [IOC REDs consensus 2023](https://bjsm.bmj.com/content/57/17/1073) — consensus; 에너지 가용성과 건강·수행 위험의 별도 전문가 경계를 정한다.
- [Youth running consensus statement](https://bjsm.bmj.com/content/55/6/305) — consensus; 청소년 러너의 영양, 부하, 성장 관련 지식 공백과 보호 원칙.
- [Injuries and Training Practices in Competitive Adolescent Distance Runners](https://pubmed.ncbi.nlm.nih.gov/34250468/) — retrospective cross-sectional study; 손상 빈도는 기술하지만 인과적 안전 임계값을 제공하지 않는다.
- [Bridging the Gap Between Science and Practice for 800/1500 m](https://pubmed.ncbi.nlm.nih.gov/34021488/) — review/position; 800m와 1500m 요구를 하나로 뭉개지 않는 출발점.
- [Reactive-strength SCED application](https://pubmed.ncbi.nlm.nih.gov/40566441/) — 2025 single-case application; 다중 기준선 설계의 스포츠 적용 가능성과 표본·일반화 한계를 함께 검토한다.

**예상 판정:** 제품은 의학적 안전 판정이나 REDs 탐지를 하지 않는다. 사전 등록된
중단·의뢰 조건은 시스템의 판단이 아니라 코치·보호자·의료 경로로 넘기는
`HUMAN_REVIEW_REQUIRED` 경계로만 사용한다.

## 3. Evidence Appraisal

Seed source의 요약은 원문 검증 전까지 탐색 가설이다. 초록만 확인한 출처는
`ABSTRACT_ONLY`로 표시하며 효과 크기, 세부 프로토콜, 안전성 판단에 사용하지
않는다. 결론에 들어가는 출처는 원문에서 population, protocol, outcome,
effect/interval, limitations, review overlap, correction/retraction을 확인한다.

각 주장별로 다음 항목을 기록한다.

| 필드 | 값 |
|---|---|
| Source type | primary / systematic review / meta-analysis / consensus / methodology / case |
| Population directness | adolescent middle-distance / youth athlete / adult runner / adult endurance / other sport |
| Intervention directness | exact component / adjacent component / whole architecture |
| Outcome | performance / acute recovery / adaptation / health / adherence / measurement |
| Time horizon | acute / weeks / season / multi-year |
| Risk of bias | tool-specific judgment plus reason |
| Consistency | consistent / mixed / single-study / unknown |
| Precision | sample and interval-based judgment |
| Transfer limit | age, sex, maturity, sport, training status, device, protocol |
| Evidence status | SUPPORTED / CONDITIONALLY_SUPPORTED / UNKNOWN / NOT_SUPPORTED |
| Permitted claim | DESCRIPTION_ONLY / PRESCRIPTION_MECHANICS_ONLY / PROHIBITED |

근거 확실성은 [Cochrane GRADE domains](https://www.cochrane.org/authors/handbooks-and-manuals/handbook/current/chapter-14)의
위험편향, 비일관성, 비정밀성, 간접성, 출판편향을 참고하되, TRAINORACLE에는
`청소년 중거리 직접성`과 `전체 구조 직접성`을 별도 열로 둔다.

## 4. Competing Interpretations

### View 1: Strict Evidence Conservatism

직접 연구가 없으면 9.5일의 과학적 우월성은 주장하지 않으며, 검증되지 않은
세부 규칙은 자동 실행하지 않는다. 다만 9.5일 기본 처방이라는 제품 정체성은
유지하고, 필요한 사실이나 안전 조건이 충족되지 않으면 코치 작성 계획으로 넘긴다.

- 장점: 과학적 과장을 가장 강하게 막는다.
- 한계: 코치가 이미 사용하는 유용한 작업 구조와 쌓이는 실제 자료를 제품 밖에
  남긴다.

### View 2: Coach-First Pragmatism

9.5일과 MAIN 2-3회를 구조화된 자동 생성 규칙으로 사용하고 경험적으로 수정한다.

- 장점: 실제 업무와 가장 빨리 맞는다.
- 한계: 설명과 데이터 경계가 약하면 관례가 과학적 처방처럼 보일 수 있다.

### View 3: Metric-First Optimization

RPE, HR, 수면, 점프, 웨어러블 지표를 합쳐 동적 간격을 자동 산출한다.

- 장점: 개인화된 것처럼 보인다.
- 한계: 서로 다른 측정과 불확실성을 하나의 준비도 점수로 축약하며, 현재
  근거와 데이터로는 정확성·안전성을 입증할 수 없다.

### Owner-Selected View: Transparent 9.5-Day Prescription

9.5일을 TRAINORACLE의 기본 자동 처방 프레임으로 확정하되 View 1의 과학적 주장
경계를 강제한다. 현재 런타임 권한은 꺼져 있고, 명시된 연구·안전·개인정보·책임자
게이트를 통과한 뒤 이 기본 처방이 활성화된다.

- 정본은 `LOCAL_CIVIL_9_DAYS_12_HOURS`와 versioned `formationPrescriptionPolicy`다.
- 5일 또는 12~13일 등은 기본 선택 목록에 노출하지 않고, 자동 후보가 차단된 뒤
  코치가 별도 계획을 작성하는 예외 경로로만 남긴다.
- 72시간은 목표 배치선이지 허가선이 아니다.
- 구성요소와 단위를 보존하고, 화면 색은 요약일 뿐 데이터 의미를 대체하지 않는다.
- 계획과 실제, 노출 간격, 누락, 복합 구성, 선수 자기보고를 기술한다.
- 시스템은 자동 변경하지 않고 코치가 결정한 새 버전을 기록한다.
- 파일럿 결과는 먼저 실행 가능성·이해 가능성·기록 완성도만 평가한다.

## 5. Search Protocol For Full Research

완전한 데이터베이스 접근과 독립 이중 선별이 실제로 충족되기 전까지 산출물은
`PRISMA-informed structured review`라고 부른다. 조건이 충족되지 않은 상태에서
`systematic review` 완성으로 표기하지 않는다.

### Databases

PubMed/MEDLINE, SPORTDiscus, Scopus, Web of Science, Cochrane Library를 기본으로
한다. 접근할 수 없는 데이터베이스는 누락을 명시하고 PubMed·출판사·DOI 원문,
인용추적을 사용한다.

### Core Queries

1. `(middle distance OR distance runner*) AND (microcycle OR periodization OR training intensity distribution OR 9-day OR 9.5-day OR 10-day OR non-weekly)`
2. `(running OR sprint OR plyometric OR resistance) AND (recovery time course OR 24 h OR 48 h OR 72 h)`
3. `(concurrent training) AND (sequence OR separation OR interference) AND (runner* OR youth OR athlete*)`
4. `(training load OR session RPE OR internal load OR external load) AND (reliability OR validity OR individual monitoring)`
5. `(single athlete OR n-of-1 OR single-case OR time series) AND (training OR sport performance)`
6. `(adolescent OR youth) AND (middle distance OR endurance training) AND (maturation OR growth OR sex)`
7. `(youth runner OR adolescent distance runner) AND (injury OR illness OR RED-S OR energy availability OR growth)`

### Include

- 청소년 중거리 러너 직접 연구.
- 청소년 또는 성인 러너의 해당 구성요소·회복 연구.
- 훈련된 endurance athlete의 배치·블록·동시훈련 연구.
- 측정 신뢰도, 개인내 변화, 단일사례 연구 방법론.
- 권위 합의문과 체계적 문헌고찰.

### Exclude Or Downgrade

- 구성과 측정이 불명확한 프로그램.
- 한 시점 상관관계를 회복·부상·효과의 인과로 해석한 연구.
- 성인 팀스포츠 결과를 청소년 중거리 러너에게 직접 적용한 주장.
- vendor 비공개 알고리즘을 독립 검증 없이 사용한 연구.
- raw note나 private memo를 분석 입력으로 요구하는 연구.

## 6. Full-Research Deliverables

1. 검색 프로토콜과 검색일·검색식.
2. 포함·제외 ledger와 PRISMA 흐름.
3. 논문별 evidence extraction table.
4. RQ-A~G별 지지·반대·조건부 근거 표.
5. GRADE-adapted certainty, 두 축 판정, 청소년/전체구조 직접성 표.
6. 코치용 쉬운 설명과 전문가용 정밀 설명.
7. 제품에서 허용할 문장, 금지할 문장, `UNKNOWN` 목록.
8. `Load Components` 결정 패킷과 `Minimum Evidence` 결정 패킷을 분리한 두 문서.
9. 외부 스포츠과학·통계 검토자가 확인할 질문 목록.

## 7. N-of-1 Claim Ladder

| Level | Allowed meaning | Required boundary |
|---|---|---|
| `OBSERVATION` | 유효한 한 번의 사실 | provenance, unit, timestamp |
| `DESCRIPTIVE_BASELINE` | 호환 프로토콜의 개인내 분포 | coverage, time span, missingness, protocol continuity |
| `MEASUREMENT_ERROR_EXCEEDING_CHANGE` | 알려진 측정오차·개인내 변동을 넘는 변화 | source-specific reliability and uncertainty |
| `PROSPECTIVE_HYPOTHESIS_COMPARISON` | 사전 정의한 비교에서 관찰된 조건부 차이 | preregistered comparator, stable protocol, time-series/confound and carryover plan |

어떤 수준도 자동으로 효능, 안전, 회복 완료, 부상위험, 인과 결론을 만들지 않는다.
출처별 최소 요구를 정할 수 없으면 보편 `n`을 발명하지 않고 `UNKNOWN`으로 둔다.

## 8. Stop Rules

- 직접 근거가 없으면 간접 근거를 직접 근거처럼 승격하지 않고 `UNKNOWN`으로 닫는다.
- 같은 결론의 리뷰가 여러 개여도 원연구가 겹치면 독립 근거 수로 중복 계산하지 않는다.
- 평균 효과가 있어도 청소년·중거리·복합 세션 직접성이 낮으면 제품 처방으로 옮기지 않는다.
- 전문가 검토가 필요한 안전·청소년·통계 임계값은 AI 합의로 승인하지 않는다.
- 연구 결과가 현재 가설과 반대여도 숨기지 않고 같은 표에 둔다.

[PRE_RESEARCH_MAP_COMPLETE]
