# Nonweekly Cycle Primary Research

```yaml
research_date: 2026-07-17
artifact_status: CANDIDATE_RESEARCH_NOT_CANONICAL
review_type: TARGETED_PRIMARY_SOURCE_AND_DIRECT_COMPARISON_AUDIT
owner_product_identity: 9_5_DAY_FORMATION
owner_target_authority: DEFAULT_AUTOMATED_PRESCRIPTION
runtime_authority: false
canonical_frame: LOCAL_CIVIL_9_DAYS_12_HOURS
exact_9_5_day_scientific_comparison: NOT_FOUND
exact_9_5_day_primary_practice_precedent: NOT_FOUND
verified_9_day_primary_practice: FOUND_CASE_LEVEL
verified_10_day_primary_practice: FOUND_CASE_LEVEL
running_prevalence_denominator: NOT_FOUND
```

## 결론부터

| 질문 | 답 | 근거 수준 |
|---|---|---|
| 고정 7일 러닝 프로그램과 9·9.5·10일 비주간 프로그램을 직접 비교한 연구가 있는가? | 이번 검색에서는 찾지 못했다. | `NOT_FOUND_WITH_ACCESS_LIMITS` |
| 미리 정한 주간 계획과 선수 상태에 따라 조정한 계획을 비교한 연구는 있는가? | 있다. 다만 양쪽 모두 주간 구조 안에서 운영됐고, 주기 길이를 비교하지 않았다. | `FOUND_ADJACENT_NOT_FRAME_COMPARISON` |
| 실제로 9일 또는 10일을 쓴 선수·코치의 1차 진술이 있는가? | 있다. 9일과 10일 모두 여러 직접 인터뷰·선수 소유 영상·코치 문서에서 확인된다. | `FOUND_CASE_LEVEL` |
| 정확히 9.5일을 쓴 선수·코치 사례가 있는가? | 찾지 못했다. | `NOT_FOUND` |
| 9일·10일이 얼마나 흔한지 말할 분모 자료가 있는가? | 러닝에서는 찾지 못했다. | `PREVALENCE_UNKNOWN` |
| 제품이 9.5일을 기본 자동 처방으로 쓸 수 있는가? | 제품 결정으로는 가능하다. 과학적 최적값·안전 보장·보편적 표준이라고 표현하면 안 된다. | `OWNER_DECISION_WITH_EVIDENCE_BOUNDARY` |

가장 중요한 해석은 다음과 같다.

> 개인별 반응에 맞춰 훈련을 조정할 수 있다는 직접 연구와 9일·10일을 실제로 운용한
> 사례는 존재한다. 그러나 이 둘을 연결해 "9.5일이 7일보다 우월하다"고 검증한 연구는
> 없다. 따라서 9.5일은 TRAINORACLE의 일관된 제품 규칙으로 설명하고, 그 길이가 과학적
> 최적값이라는 주장은 분리해야 한다.

## 1. 검색과 검증 방법

### 1.1 검색일과 범위

- 검색일: **2026-07-17**
- 대상: 러닝, 중장거리, endurance periodization, microcycle length, 7/9/9.5/10-day,
  nonweekly, individualized/flexible prescription.
- 1차 연구 확인: PubMed/MEDLINE, DOI·PMC·출판사 원문.
- 실제 사용 확인: 선수 본인이 답한 인터뷰, 선수 소유 영상, 코치 또는 프로그램이 직접
  작성한 문서, 공식 클럽·코칭 도메인.
- 제외: 검색 결과의 제목만으로 주기라고 추정한 자료, 판매용 샘플만 있는 계획,
  익명 게시판, 다른 기사의 재인용만 있는 사례, 단지 연구 기간이 9일이나 10일인 실험.

### 1.2 직접 비교 검색

동결된 RQ-A 검색 외에 다음 직접 연결 검색을 다시 수행했다.

```text
((runner*[Title/Abstract] OR running[Title/Abstract]) AND
 (("7-day"[Title/Abstract] OR "seven-day"[Title/Abstract] OR weekly[Title/Abstract]) AND
  ("9-day"[Title/Abstract] OR "9.5-day"[Title/Abstract] OR "10-day"[Title/Abstract] OR
   nonweekly[Title/Abstract] OR "non-weekly"[Title/Abstract])) AND
 (microcycle*[Title/Abstract] OR periodization[Title/Abstract] OR periodisation[Title/Abstract]
  OR "training cycle"[Title/Abstract]))
```

- PubMed 결과: 1건.
- 그 1건은 프로 축구에서 경기 간격 때문에 생긴 5-9일 microcycle을 비교한 연구였다
  (PMID `35309541`). 러너의 고정 7일 대 선택된 비주간 처방 비교가 아니었다.

```text
((runner*[Title/Abstract] OR "middle-distance"[Title/Abstract] OR
  "distance runner"[Title/Abstract]) AND
 ("microcycle length"[Title/Abstract] OR "extended microcycle"[Title/Abstract] OR
  "training cycle length"[Title/Abstract]) AND
 (compar*[Title/Abstract] OR random*[Title/Abstract] OR individualized[Title/Abstract] OR
  individualised[Title/Abstract]))
```

- PubMed 결과: 0건.

일반 웹에서도 `running 7 day versus 9 day`, `distance runner non-weekly microcycle study`,
`9.5-day running training cycle`, 선수·코치 이름과 `9-day`·`10-day` 조합을 교차 검색했다.

### 1.3 접근 한계

- 인증된 SPORTDiscus, Scopus, Web of Science 검색은 이 실행 환경에서 사용할 수 없었다.
- Cochrane의 인증형 고급 검색도 사용할 수 없었다.
- 따라서 판정은 `없다`가 아니라 **`이번 범위에서 직접 연구를 찾지 못했다`**이다.
- 다만 PubMed의 정확 검색, 기존 구조화 검색, DOI·공식 페이지 추적에서 동일한 공백이
  반복됐고, 발견된 인접 연구들은 모두 주기 길이 비교와 개인맞춤 비교 중 한쪽만 다뤘다.

## 2. 고정 주간 대 개인맞춤·비주간 직접 연구

### 2.1 정확한 직접 비교는 발견되지 않음

필요한 직접 연구는 다음 세 조건을 동시에 충족해야 한다.

1. 러너 또는 중장거리 선수를 대상으로 한다.
2. 고정 7일 구조와 개인맞춤 또는 9·9.5·10일 구조를 비교한다.
3. 성과, 수행 가능성, 부작용, 계획 이행 등 사전 정의된 결과를 비교한다.

이 세 조건을 모두 만족하는 연구는 찾지 못했다.

### 2.2 가장 가까운 개인맞춤 비교 연구

**Nuuttila et al. (2022), Individualized Endurance Training Based on Recovery and Training
Status in Recreational Runners**

- DOI: [`10.1249/MSS.0000000000002968`](https://doi.org/10.1249/MSS.0000000000002968)
- PMID: [`35975912`](https://pubmed.ncbi.nlm.nih.gov/35975912/)
- PMCID: [`PMC9473708`](https://pmc.ncbi.nlm.nih.gov/articles/PMC9473708/)
- 설계: 레크리에이션 러너 30명, predefined `n=14`, individualized `n=16`.
- 기간: 3주 준비 + 6주 volume + 6주 interval.
- 개인맞춤군: 야간 HRV, 주관적 회복, 심박-달리기 속도 지표를 이용해 월요일과 목요일,
  즉 주 2회 다음 3-4일 블록의 부하를 증가·유지·감소.
- 결과: 10 km 변화는 individualized `-6.2% +/- 2.8%`, predefined
  `-2.9% +/- 2.4%`, `p=0.002`. 두 군 모두 향상됐다.
- 직접성: 개인 상태에 따른 결정론적 조정을 비교했다는 점은 직접적이다.
- 핵심 한계: **두 군 모두 주 단위 구조와 월·목 평가일을 유지했다.** 7일 대 비주간 길이,
  9.5일, 청소년, 800/1500 m, TRAINORACLE 규칙을 시험하지 않았다.

허용되는 결론:

> 미리 정한 계획과 비교해 선수별 상태에 따라 부하를 조정하는 접근은 전향적으로 시험할
> 수 있으며, 한 소규모 성인 레크리에이션 러너 연구에서 더 큰 10 km 향상이 관찰됐다.

금지되는 결론:

> 이 연구가 9.5일의 우월성, HRV 기반 자동 처방의 일반적 안전성, 또는 청소년
> 중거리 선수용 임계값을 입증했다.

### 2.3 가장 가까운 주기 길이 비교 연구

| 연구 | 직접 관찰 | 왜 TRAINORACLE 비교가 아닌가 |
|---|---|---|
| McLaren et al., 프로 럭비리그 4시즌 연구. DOI [`10.1371/journal.pone.0263093`](https://doi.org/10.1371/journal.pone.0263093), PMID [`35100267`](https://pubmed.ncbi.nlm.nih.gov/35100267/), PMCID [`PMC8803197`](https://pmc.ncbi.nlm.nih.gov/articles/PMC8803197/) | 성인 남자 54명, 한 팀, 91개 경기 간 microcycle: 5일 14개, 6일 15개, 7일 33개, 8일 18개, 9일 7개, 10일 4개. 긴 간격에서 외적 훈련량 차이가 관찰됨. | 경기 일정이 길이를 정한 반복 관찰이다. 러닝 처방 선택, 개인맞춤 무작위 비교, 회복 완료, 성과·안전 비교가 아니다. |
| Oliva-Lozano et al., 프로 축구 한 시즌 연구. DOI [`10.5114/biolsport.2022.106148`](https://doi.org/10.5114/biolsport.2022.106148), PMID [`35309541`](https://pubmed.ncbi.nlm.nih.gov/35309541/), PMCID [`PMC8919886`](https://pmc.ncbi.nlm.nih.gov/articles/PMC8919886/) | 5-6일, 7일, 8-9일 경기 간 microcycle의 훈련·경기 외적 부하를 비교. 길이에 따라 일부 volume/intensity 차이가 있었음. | 한 프로 축구팀의 경기 달력에 따른 관찰이며, 7일 대 9.5일 러너 처방 시험이 아니다. |

이 연구들은 **달력 길이가 바뀌면 코치가 실제 부하 구성을 바꾼다**는 운영상 사실을
보여준다. 그러나 더 긴 주기가 더 좋거나 더 안전하다는 결론은 주지 않는다.

### 2.4 고정 7일의 한계를 어디까지 말할 수 있는가

근거에 맞는 표현:

- 7일은 생활·학교·대회 달력과 잘 맞아 운영이 쉽다.
- 같은 세션 수와 회복 간격을 한 주에 모두 넣으려 하면 특정 선수에게 일정 충돌이나
  훈련 밀도 문제가 생길 수 있다.
- 개인 반응에 따른 부하 조정은 연구 가능한 개입이며, 한 성인 러너 연구에서 유리한
  결과가 관찰됐다.
- 선수·코치의 1차 사례에서는 비주간 구조를 선택한 이유로 세션 간 여유, 핵심 세션의
  질, 장거리 훈련 강조, 생활 일정 적합성이 반복해서 언급된다.

근거를 넘는 표현:

- `7일 주기는 생리학적으로 잘못됐다.`
- `7일 주기는 부상이나 과훈련을 일으킨다.`
- `모든 선수는 7일보다 긴 주기가 필요하다.`
- `9·10일을 쓰면 회복이 완료된다.`

## 3. 9일·10일 실제 사용 1차 자료

### 3.1 판정 기준

- `PRIMARY_SELF_REPORT`: 선수 본인의 영상·글.
- `PRIMARY_INTERVIEW_TESTIMONY`: 인터뷰어가 선수·코치에게 직접 질문하고 답을 기록.
- `PRIMARY_COACH_PROGRAM_DOCUMENT`: 프로그램 또는 코치가 자기 운영을 직접 설명.
- `SECONDARY_REPORT`: 제3자가 사용을 서술했지만 당사자의 직접 답이나 원자료가 없음.
- 직접 사례는 **사용 여부만** 입증한다. 효과, 원인, 안전, 보편성은 입증하지 않는다.

### 3.2 검증된 9일 사례

#### `NW-PRIMARY-9D-001` Meb Keflezighi

- 출처: [Runner's World 대면 인터뷰, 2014-05-02](https://www.runnersworld.com/races-places/a20852813/how-meb-keflezighi-trained-to-win-the-boston-marathon/)
- 자료 수준: `PRIMARY_INTERVIEW_TESTIMONY`; 인터뷰는 2014 Boston 우승 9일 후 대면 수행.
- 실제 의미 검증: 연구 기간이 9일이라는 뜻이 아니라 반복되는 **9-day cycle**이다.
- 직접 내용: 각 9일에 tempo 1회, interval 1회, long run 1회. 나머지는 몸 상태에 따라
  조정. 전형적 9일 총량을 140-150 miles로 추정.
- 직접성: 성인 남자 엘리트 마라톤, 후기 선수 경력과 부상 이력이 있는 개인 사례.
- 허용: `한 엘리트 마라토너가 실제로 반복 9일 주기를 사용했다.`
- 금지: Boston 우승의 원인이 9일이었다, 청소년에게 동일 용량이 맞다, 9일이 안전하다.

보조 확인: [Meb가 직접 게시한 2026년 회고](https://www.linkedin.com/posts/meb-keflezighi-a234012b_i-can-hardly-believe-it-has-been-10-years-activity-7430641814807674880-esgk)에서도
2016 Olympic Trials 준비 때 7일에서 9일로 바꿨고 저서 *26 Marathons*에서 이를 다뤘다고
밝혔다. 책 전문은 이번 실행에서 페이지 단위로 재검증하지 않았으므로 인터뷰와 별개의
독립 사례로 중복 계산하지 않는다.

#### `NW-PRIMARY-9D-002` Michael Ko / kofuzi

- 원자료: [선수 소유 YouTube 영상, *Why I Choose a 9 Day Training Cycle*](https://www.youtube.com/watch?v=niNOZt_3fuE)
- 직접 인용 확인 컨테이너: [Runner's World의 영상 전사·일정표](https://www.runnersworld.com/news/a43877401/9-day-training-cycle-michael-ko/)
- 자료 수준: 영상은 `PRIMARY_SELF_REPORT`; Runner's World는 `SECONDARY_TRANSCRIPTION`.
- 원본 확인: YouTube oEmbed에서 제목, 채널 `kofuzi`, video ID `niNOZt_3fuE`를 확인.
- 실제 의미 검증: quality/easy/easy를 세 번 반복하는 명시적 9일 일정이며 세 번째
  quality가 long run이다.
- 직접성: 성인 레크리에이션 마라토너의 자기 설계 단일 사례.
- 허용: 단순한 `MAIN + 쉬운 날 2일` 설명 패턴과 실제 운영 가능성.
- 금지: 2:56 개인 기록이 주기 때문에 발생했다, 모든 선수에게 효과가 있다.
- 한계: 영상 자막 전체를 별도 파일로 추출하지 못했으므로 문장 단위 인용은 Runner's
  World 전사와 교차 확인한 부분만 사용한다.

#### `NW-PRIMARY-9D-003` Sara Hall

- 출처: [Marathon Training Academy 직접 인터뷰, 2026-05-15](https://www.marathontrainingacademy.com/sara-hall-on-longevity-faith-and-the-love-of-the-grind)
- 자료 수준: `PRIMARY_INTERVIEW_TESTIMONY`.
- 실제 의미 검증: masters runner로 전환한 반복 **9-day training cycle**을 직접 설명.
- 직접 내용: 어려운 세션 사이에 쉬운 날을 1일이 아니라 2일 두기 위해 바꿨으며,
  현재까지 잘 맞는다고 느낀다고 답함.
- 직접성: 성인 여자 엘리트 마라톤, 43세 masters 맥락.
- 허용: 최근 엘리트 선수의 실제 9일 운영 및 개인적 이유.
- 금지: 신경학적 회복이 객관적으로 완료됐다, 9일이 부상을 예방했다.

### 3.3 검증된 10일 사례

#### `NW-PRIMARY-10D-001` Emma Bates

- 출처: [Runner's World 직접 인터뷰, 2023-04-18](https://www.runnersworld.com/training/a43613388/emma-bates-training-and-recovery-tips/)
- 자료 수준: `PRIMARY_INTERVIEW_TESTIMONY`.
- 실제 의미 검증: Boston buildup의 반복 **10-day training cycle**이며, 두 workout과
  한 long run, long run 이후 3일 recovery를 명시.
- 중요한 용어 한계: 여기서 recovery는 완전 휴식이 아니다. 인터뷰상 쉬운 날에도
  12 miles 또는 오전 12 miles + 오후 5 miles를 달렸다.
- 직접성: 성인 여자 엘리트 마라톤 단일 사례.
- 허용: 10일 실제 운영과 장거리 세션 강조 목적.
- 금지: 10일이 9일보다 우월하다, 높은 쉬운 날 용량을 청소년에게 이전한다.

#### `NW-PRIMARY-10D-002` Sarah Jamieson

- 출처: [Runner's Tribe 직접 인터뷰; 2008 원인터뷰의 2016 복원본](https://runnerstribe.com/elite-features/hits-from-the-archives-sarah-jamieson-interview/)
- 자료 수준: `PRIMARY_INTERVIEW_TESTIMONY`.
- 실제 의미 검증: 호주 여자 1500 m 선수 본인이 `I work off a 10 day cycle`이라고 답하고
  Day 1-10 전체를 열거했다.
- 직접 내용: 10일 안에 주요 세션 3회, medium run 1회, long run 1회, weights 3회;
  인터뷰 당시 주간 환산 120-130 km.
- 직접성: 성인 여자 세계수준 1500 m로, 이번 자료 중 종목 직접성이 가장 높다.
- 한계: 단일 엘리트 성인, 2008 당시 운영, 비교군·성과 귀속·안전 자료 없음.
- 허용: 중거리 선수도 실제로 10일 구조를 사용한 1차 사례가 있다.
- 금지: 동일 세션 수·용량이 청소년 800/1500 m의 자동 규칙이다.

#### `NW-PRIMARY-10D-003` Hansons-Brooks Distance Project

- 출처: [Hanson's Coaching Services 공식 PDF, *Understanding Basic Training Periodization Terminology*](https://lukehumphreyrunning.com/wp-content/uploads/2011/12/Training-Periodization-article.pdf)
- 자료 수준: `PRIMARY_COACH_PROGRAM_DOCUMENT`; 공식 코칭 도메인 PDF.
- 실제 의미 검증: 문서가 `the Hanson's Brooks DP works on a 10 day microcycle`이라고
  프로그램의 반복 운영을 명시.
- 직접 내용: 10일 안에 speed 또는 strength, tempo 형태 workout, 10일째 long run.
- 직접성: 성인 post-collegiate distance program의 코치/프로그램 수준 진술.
- 한계: 선수별 로그, 기간, 적용 비율, 성과, 예외, 9.5일은 제공하지 않는다.
- 허용: 엘리트 개발 프로그램이 10일 microcycle을 운영한다고 직접 기록했다.
- 금지: 프로그램 전체 선수에게 항상 적용됐다, 효과가 검증됐다, 흔한 표준이다.

### 3.4 정확히 9.5일은 확인되지 않음

다음 exact 검색을 수행했다.

```text
"9.5-day" running training cycle
"9.5 day" training cycle runner
"nine and a half day" training cycle running
"9 days 12 hours" training cycle
```

선수·코치의 실제 9.5일 반복 주기는 발견되지 않았다. 가장 가까운 논문은 DOI
[`10.1152/japplphysiol.00971.2003`](https://doi.org/10.1152/japplphysiol.00971.2003)으로,
성인 러너 13명이 9-9.5일 동안 하루 두 번 interval을 수행한 glutamine/placebo 실험이다.
이는 **반복 microcycle이 아니라 짧은 overload 실험 기간**이며 9.5일 제품 근거로 사용할
수 없다.

### 3.5 확인했지만 채택하지 않은 1차 후보

- Meb의 *Meb for Mortals* 및 *26 Marathons*: 선수 저서라는 1차성은 있으나 이번 실행에서
  해당 페이지 전문을 열어 문장을 검증하지 못했다. 인터뷰 사례의 보조 서지로만 둔다.
- Kenny Moore의 *Bowerman and the Men of Oregon*: 9일 주기를 썼다는 반복된 제3자 언급은
  발견했지만 공식 미리보기에서 해당 구절을 확인하지 못했다. 1차 사례로 세지 않는다.
- 9일 개요 기사가 Emma Bates를 9일 사례로 재사용한 부분: Bates 직접 인터뷰는 10일이라고
  명시하므로 `SOURCE_CONTRADICTION/OVERSTATED`로 제외한다.
- 기사·코치가 만든 9일·10일 샘플 계획: 실제 사용자를 특정하지 못하면
  `PLAN_EXISTS`만 뜻하며 `ACTUAL_USE`로 승격하지 않는다.

## 4. 얼마나 흔한가: 분모 자료 검토

### 4.1 러닝 prevalence는 말할 수 없음

확인된 9일·10일 사례는 의도적으로 눈에 띄는 선수·코치 사례를 찾은 결과다. 표본추출된
모집단이 아니므로 다음 계산을 할 수 없다.

```text
9일 또는 10일 사용자 수 / 전체 조사 대상 러너 또는 코치 수
```

### 4.2 발견된 분모처럼 보이는 자료와 한계

| 자료 | 분모가 있는가 | prevalence에 못 쓰는 이유 |
|---|---|---|
| 국제 코치 설문, `n=106`, DOI [`10.1186/s40798-023-00657-6`](https://doi.org/10.1186/s40798-023-00657-6) | 코치 분모는 있음 | periodization 인식은 물었지만 7/9/10일 주기 길이 사용 여부를 묻지 않았다. 종목별 러닝 분모도 없다. |
| 엘리트 거리러닝 systematic review, PMID [`35418513`](https://pubmed.ncbi.nlm.nih.gov/35418513/) | 포함 논문 10편 | 훈련 특성을 정리했을 뿐 선수·코치의 주기 길이 prevalence를 조사하지 않았다. |
| 프로 럭비리그 한 팀 91 microcycles | 9일 7개, 10일 4개 | 경기 일정이 만든 간격의 빈도이며 코치가 비주간 철학을 채택한 비율이 아니다. 러닝 모집단도 아니다. |
| 프로 축구 한 팀의 짧음/보통/긴 microcycle 관찰 | 관찰 수는 있음 | 경기 간격 분포이고 선수·코치 선택의 prevalence가 아니다. |
| 직접 인터뷰·영상·공식 코치 문서 | 사례 수만 있음 | 사례 검색으로 모았고 전체 모집단을 정의하지 않았다. |

### 4.3 허용·금지 prevalence 문구

허용:

- `9일과 10일 비주간 훈련은 여러 선수·코치의 실제 운영 사례에서 확인된다.`
- `성인 마라톤뿐 아니라 성인 엘리트 1500 m의 10일 사례도 확인된다.`
- `정확한 사용 비율은 알려져 있지 않다.`

금지:

- `9일·10일은 널리 사용된다.`
- `대부분의 엘리트가 비주간 주기를 쓴다.`
- `9.5일은 업계 표준이다.`
- `프로 선수들은 보통 9일 또는 10일을 쓴다.`

`popular`, `common`, `standard`, `most`, `widely used`는 분모 연구가 생기기 전까지 제품,
보도자료, 스펙 근거 문구에서 사용하지 않는다.

## 5. 9.5일 제품 규칙의 정당한 표현

### 5.1 기술·스펙용 권고 문구

> TRAINORACLE Formation은 소유자 결정에 따라 `LOCAL_CIVIL_9_DAYS_12_HOURS`를 기본 자동
> 처방 프레임으로 사용한다. 9일과 10일의 실제 훈련 운영 사례 및 개인별 부하 조정의
> 필요성은 이 구조의 실무적 배경을 제공하지만, 정확한 9.5일이 과학적으로 최적이거나
> 안전하다는 직접 근거는 아니다. 등록된 입력, 대회·일정 제약, 구성요소 규칙, 데이터
> 완전성, 안전·프라이버시·권한 조건을 모두 통과할 때만 하나의 결정론적 9.5일 기본계획을
> 제시한다. 조건이 부족하거나 충돌하면 다른 길이를 자동 선택하지 않고 현재 코치 계획을
> 유지한다.

### 5.2 사용자 화면용 권고 문구

**기본 설명**

> TRAINORACLE은 중요한 훈련과 쉬운 날을 한 주에 억지로 맞추지 않도록 9일 12시간을
> 하나의 훈련 묶음으로 사용해요.

**계획이 생성됐을 때**

> 입력한 훈련 기록과 대회 일정을 바탕으로 이번 9일 12시간 계획 하나를 만들었어요.
> 이 주기는 훈련을 일정하게 정리하는 TRAINORACLE의 기본 규칙이며, 회복이나 안전을
> 자동으로 판정했다는 뜻은 아니에요.

**계획이 생성되지 않았을 때**

> 지금은 자동 계획을 만들 조건이 충분하지 않아 현재 코치 계획을 그대로 유지해요.
> 확인이 필요한 내용은 코치와 함께 볼 수 있어요.

이 문구는 사용자가 다음 세 가지를 즉시 알게 한다.

1. 9.5일이 앱의 일관된 기본 구조라는 점.
2. 하나의 명확한 계획을 받거나, 못 받는 이유가 있다는 점.
3. 자동 실패가 곧 위험 판정이나 선수 잘못을 뜻하지 않는다는 점.

### 5.3 실행 의미

```yaml
eligible:
  frame: LOCAL_CIVIL_9_DAYS_12_HOURS
  output: EXACTLY_ONE_DETERMINISTIC_DEFAULT_PLAN
ineligible_or_unresolved:
  output: NO_NEW_AUTOMATED_PLAN
  retained_plan: KEEP_CURRENT_COACH_AUTHORED_PLAN
  alternate_cycle_fallback: FORBIDDEN
never_infer:
  - RECOVERED_FROM_FRAME_LENGTH
  - SAFE_FROM_FRAME_LENGTH
  - SCIENTIFICALLY_OPTIMAL_9_5_DAYS
  - INJURY_PREVENTION
```

### 5.4 금지 문구

- `과학적으로 증명된 최적의 9.5일 주기`
- `7일보다 안전한 주기`
- `72시간마다 완전히 회복되므로 다음 고강도 훈련을 할 수 있습니다`
- `부상 위험을 줄이는 9.5일 처방`
- `엘리트가 가장 많이 쓰는 방식`
- `Meb/Emma/Sara가 성공했으므로 효과가 입증된 방식`
- `AI가 선수의 회복을 확인했습니다`
- `9.5일이 맞지 않으면 자동으로 7일·9일·10일·12일 중 최적 주기를 선택합니다`

### 5.5 제품 정체성과 근거 상태를 함께 보여주는 짧은 내부 표기

```text
PRODUCT_IDENTITY: FIXED_9_5_DAY_DEFAULT_AUTOMATED_PRESCRIPTION
PRACTICE_PRECEDENT: VERIFIED_FOR_9_AND_10_DAY_CASES
EXACT_9_5_PRECEDENT: NOT_FOUND
DIRECT_SUPERIORITY_EVIDENCE: NOT_FOUND
PREVALENCE: UNKNOWN
RUNTIME: FAIL_CLOSED_TO_KEEP_CURRENT_COACH_AUTHORED_PLAN
```

## 6. 후속 검증 제안

1. 정본 반영 전 독립 검토자가 Sarah Jamieson, Sara Hall, Hansons 공식 문서의 1차성·문맥을
   다시 확인한다.
2. 인증 SPORTDiscus·Scopus·Web of Science에서 동일한 direct-comparison 검색식을 실행해
   `NOT_FOUND_WITH_ACCESS_LIMITS`를 갱신한다.
3. 선수·코치 대상 주기 길이 prevalence를 말하려면 사전에 표본과 분모를 정의한 설문을
   별도로 설계한다. 앱 사용자 선택 로그는 자동 처방 정체성 때문에 prevalence 분모로
   사용할 수 없다.
4. 제품 연구는 9.5일 채택 여부를 다시 투표하지 않고, 생성 성공률, 부적격 사유,
   코치 동의·수정, 사용자 이해도, 일정 충돌, 현재 코치 계획 유지가 정확히 동작하는지를
   검증한다.
5. 성과·안전 비교를 주장하려면 이후 별도 전향 연구가 필요하다. 초기 participant-visible
   parallel comparison은 feasibility만 평가하고 효능·안전을 주장하지 않는다.

## 최종 판정

9일과 10일 비주간 훈련은 허구가 아니며, 선수와 코치가 직접 설명한 실제 운영 사례가
있다. 특히 Meb Keflezighi의 9일, Sarah Jamieson과 Emma Bates의 10일은 주기 길이와 세션
구성이 직접 확인된다. 개인 상태에 따른 조정 역시 전향 연구가 가능한 개념이다.

그러나 정확한 9.5일 비교 연구, 실제 9.5일 사용 사례, 러닝 prevalence 분모는 찾지 못했다.
따라서 TRAINORACLE은 9.5일을 **기본 자동 처방이라는 제품 정체성**으로 자신 있게 사용할
수 있지만, 이를 과학적 최적값·안전 보장·업계 표준으로 포장해서는 안 된다. 조건을 통과한
경우 하나의 9.5일 계획을 제시하고, 통과하지 못하면 다른 주기로 우회하지 말고 현재 코치
계획을 유지하는 것이 현재 근거와 제품 결정에 가장 충실하다.
