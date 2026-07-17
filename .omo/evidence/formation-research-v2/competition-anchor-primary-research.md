# Competition Anchor Primary Research

~~~yaml
status: CANDIDATE_RESEARCH_REPORT_FOR_SPEC_REVIEW
search_date: 2026-07-17
scope:
  - middle_distance_taper
  - youth_and_adult_post_competition_recovery
  - multi_round_and_congested_competition
  - next_high_intensity_session_placement
source_policy: PRIMARY_STUDIES_AND_OFFICIAL_CONSENSUS_ONLY
owner_product_identity: 9_5_DAY_FORMATION
owner_target_authority: DEFAULT_AUTOMATED_PRESCRIPTION
scientific_superiority_claim_for_9_5_days: false
competition_is_plan_anchor: true
canonical_ledger_edited: false
canonical_spec_edited: false
runtime_authority: false
human_expert_approval: NOT_CLAIMED
search_saturation: DECISION_FOCUSED_NOT_BIBLIOGRAPHICALLY_EXHAUSTIVE
~~~

## 1. 두괄식 결론

대회는 계획에서 먼저 고정하는 **하나의 일정 앵커**로 유지해도 된다. 그러나 근거가 지지하는 범위는 여기까지다.

1. 출발이 한 번인 단일 경기는 운영상 MAIN 노출 1회로 계산할 수 있다. 이것은 TRAINORACLE의 일관된 계산을 위한 제품 규칙이지, 경기가 특정 훈련 세션과 생리학적으로 완전히 같다는 과학적 사실은 아니다.
2. 예선, 준결승, 결승, 복수 종목, 릴레이처럼 실제 출발이 여러 번인 대회 전체를 생리학적 MAIN 노출 1회로 뭉개면 안 된다. 일정 앵커는 하나로 두되, 실제 경기 시작은 각각 별도 하위 노출로 기록해야 한다.
3. 중장거리 선수에게 마지막 고강도 훈련을 정확히 대회 며칠 전에 배치해야 하는지, 또는 대회 뒤 정확히 몇 시간 후 다음 MAIN을 허용해야 하는지를 정한 보편적 1차 근거는 찾지 못했다. 청소년 800/1500 m에 직접 적용할 수 있는 임계값 연구는 특히 없었다.
4. 테이퍼 1차 연구는 대체로 훈련량을 줄이면서 일부 강도와 빈도를 유지하는 전략을 시험했다. 그러나 표본이 매우 작고 성인 남성 중심이며, 6일 또는 7일 프로토콜이 대부분이다. 이것으로 고정 6일, 7일, 72시간 또는 9.5일 규칙을 과학적으로 확정할 수 없다.
5. 따라서 9.5일은 최신 책임자 결정대로 TRAINORACLE의 고정 기본 자동 처방 정체성으로 유지한다. 연구는 그 정체성을 바꾸는 것이 아니라, 대회 전후 안전 게이트, 다중 경기 표현, 설명 문구와 사람 확인 조건을 제한하는 역할만 해야 한다.

### 이번 조사에서 가장 중요한 규격 보완 후보

~~~text
COMPETITION_ANCHOR                      # 달력에서 먼저 고정하는 대회 일정 1개
  -> COMPETITIVE_BOUT[]                 # 실제 출발마다 1개
       - planned_start_at
       - actual_start_at
       - event_and_distance
       - round_or_role
       - warmup_and_cooldown
       - actual_response_and_provenance
~~~

- 단일 경기: 앵커 1개 + 경기 시작 1개 + 실제 MAIN 노출 1회
- 예선/결승 또는 복수 종목: 앵커 1개 + 경기 시작 N개 + 실제 MAIN 노출 N회
- 계획 화면에서는 대회가 하나로 보일 수 있지만, 회복 판단과 다음 고강도 배치에서는 각 출발의 종료 시점과 실제 반응을 읽어야 한다.

이 자료구조는 **정본 수정안이 아니라 검토 후보**다. 현재 문구인 “대회를 MAIN 1회로 계산”은 “출발이 한 번인 단일 경기를 MAIN 1회로 계산”으로 범위를 좁힐 필요가 있다.

## 2. 조사 질문과 판정 기준

### 2.1 질문

1. 중장거리 경기 전 테이퍼 연구가 마지막 고강도 세션의 보편적 위치를 정할 수 있는가?
2. 대회 뒤 회복 연구가 다음 MAIN을 허용할 고정 시간을 정할 수 있는가?
3. 예선과 결승, 복수 종목처럼 경기 시작이 여러 번인 대회를 하나의 부하로 계산해도 되는가?
4. 청소년 선수에게 성인 중장거리 또는 다른 종목의 결과를 어느 정도까지 옮길 수 있는가?
5. TRAINORACLE이 사용자에게 무엇을 단정해도 되고 무엇을 단정하면 안 되는가?

### 2.2 직접성 등급

| 등급 | 의미 | 자동 규칙에 쓸 수 있는 범위 |
|---|---|---|
| D1 | 중장거리 경기 또는 테이퍼를 직접 측정했으나 주로 성인 | 구성요소와 경고 근거. 청소년 임계값으로 사용 금지 |
| D2 | 청소년 육상 자료이나 개인 회복 간격을 직접 시험하지 않음 | 청소년 보호와 사람 확인의 필요성만 지지 |
| D3 | 청소년이지만 축구 등 다른 종목 | 회복의 개인차와 복수 지표 필요성만 지지 |
| D4 | 다른 지구성 종목 또는 훈련 세션 연구 | 기전·측정 후보만 지지. 달리기 시간 규칙으로 전환 금지 |
| C | IOC 등 공식 합의문 | 원칙과 거버넌스 근거. 수치 임계값 생성 금지 |

## 3. 검색과 접근성 확인

### 3.1 검색 방법

PubMed, PubMed Central, 출판사 DOI 페이지, 대학 공식 저장소, IOC/BJSM 공식 페이지와 World Athletics 공식 문서 목록을 확인했다. 리뷰 논문은 후보 탐색에만 사용했고 최종 근거 표에는 1차 연구와 공식 합의문만 넣었다.

대표 검색식:

~~~text
site:pubmed.ncbi.nlm.nih.gov middle distance runners taper 1500 m primary study
site:pubmed.ncbi.nlm.nih.gov 800 m 1500 m runners successive days competition recovery
site:pubmed.ncbi.nlm.nih.gov middle distance qualifying rounds final recovery performance championship 800 1500
site:pubmed.ncbi.nlm.nih.gov adolescent runners competition recovery track meet
site:pubmed.ncbi.nlm.nih.gov 800m 1500m heats semifinals final championship performance fatigue
site:pubmed.ncbi.nlm.nih.gov track championship rounds middle distance performance successive days
site:pubmed.ncbi.nlm.nih.gov middle-distance runners post competition recovery biomarkers
site:pubmed.ncbi.nlm.nih.gov (adolescent OR youth OR junior) runners taper 800 1500
site:bjsm.bmj.com IOC consensus youth athlete recovery competition load
site:worldathletics.org health science nutrition recovery consensus athletics
~~~

검색일은 **2026-07-17**이다. Scopus와 Web of Science의 기관 인증 검색은 수행하지 못했으므로 문헌 목록이 완전하다고 주장하지 않는다.

### 3.2 URL·DOI 접근 자체 점검

- 모든 포함 연구는 DOI와 PubMed 또는 출판사 공식 기록 중 하나 이상에서 제목·저자·연도·초록을 대조했다.
- DOI resolver가 출판사 주소로 이동하는지 2026-07-17에 다시 확인했다.
- 일부 출판사 페이지는 자동 접근에 HTTP 403을 반환했다. DOI가 잘못된 것이 아니라 DOI 이동 대상은 확인되었고, 이 경우 공식 PubMed 메타데이터로 서지사항과 초록을 교차 확인했다.
- 공식 전문을 확인한 핵심 자료: Birdsey 2026 PMC, Franceschi 2025 PMC, Constantine 2019 PMC, Yang 2026 PMC, Spilsbury 2021 대학 공식 accepted manuscript.
- 구형 테이퍼 연구 일부는 공식 초록과 서지사항까지만 확인했다. 전문을 확인하지 못한 논문에 초록 밖의 세부 주장을 추가하지 않았다.

## 4. 대회 전 테이퍼 1차 연구

| ID | 1차 연구와 공식 링크 | 대상·설계 | 직접 확인되는 결과 | 한계와 직접성 | 접근 상태 |
|---|---|---|---|---|---|
| T1 | Shepley et al. 1992, “Physiological effects of tapering in highly trained athletes.” DOI [10.1152/jappl.1992.72.2.706](https://doi.org/10.1152/jappl.1992.72.2.706), [PubMed PMID 1559951](https://pubmed.ncbi.nlm.nih.gov/1559951/) | 고도로 훈련된 남자 중거리 선수 9명. 8주 훈련 뒤 7일 동안 저용량 고강도, 중간 용량 저강도, 완전 휴식을 교차 비교 | 개인 최고 1500 m 속도에서의 트레드밀 탈진 시간이 저용량 고강도 조건에서만 약 22% 향상 | 실제 1500 m 경기 기록이 아니라 탈진 검사. n=9, 성인 남성, 청소년 아님. 7일이 최적이라는 비교가 아님. D1 | 공식 초록 확인. 출판사 자동 접근 403, DOI 이동 확인 |
| T2 | Mujika et al. 2000, “Physiological responses to a 6-d taper in middle-distance runners: influence of training intensity and volume.” DOI [10.1097/00005768-200002000-00038](https://doi.org/10.1097/00005768-200002000-00038), [PubMed PMID 10694140](https://pubmed.ncbi.nlm.nih.gov/10694140/) | 잘 훈련된 남자 중거리 선수 8명. 15주 훈련 뒤 6일 동안 훈련량 50% 또는 75% 점진 감소, 800 m 전후 비교 | 두 조건 모두 800 m 기록이 유의하게 좋아지지 않았다. 큰 훈련량 감소를 견딜 수 있다는 단서는 있으나 우월 조건은 확정되지 않음 | 각 군 n=4. 초록에 정확한 연령 하위군 없음. 6일 또는 감소율을 자동 규칙으로 확정할 수 없음. D1에 가까운 PARTIAL | 공식 초록 확인. 출판사 자동 접근 403, DOI 이동 확인 |
| T3 | Mujika et al. 2002, “Physiological and performance responses to a 6-day taper in middle-distance runners: influence of training frequency.” DOI [10.1055/s-2002-33146](https://doi.org/10.1055/s-2002-33146), [PubMed PMID 12165889](https://pubmed.ncbi.nlm.nih.gov/12165889/) | 남자 중거리 선수 9명. 18주 뒤 6일 테이퍼. 매일 훈련 n=5와 사흘마다 하루 휴식 n=4, 고강도 인터벌량 약 80% 비선형 감소 | 고빈도군 800 m가 유의하게 개선됐고 중간 빈도군은 유의한 개선이 없었음 | 극소수 평행군, 남성, 청소년 결과 아님. 훈련 빈도와 테이퍼 기간을 분리해 확정하기 어려움. D1 | 공식 초록과 출판사 초록 페이지 접근 확인 |
| T4 | Spilsbury et al. 2015, “Tapering strategies in elite British endurance runners.” DOI [10.1080/17461391.2014.955128](https://doi.org/10.1080/17461391.2014.955128), [PubMed PMID 25189116](https://pubmed.ncbi.nlm.nih.gov/25189116/), [Birmingham 공식 기록](https://research.birmingham.ac.uk/en/publications/tapering-strategies-in-elite-british-endurance-runners/) | 영국 엘리트 선수 37명의 설문·훈련일지. 중거리 18명, 장거리 9명, 마라톤 10명 | 중거리 선수의 테이퍼 중앙값은 6일. 연속주와 인터벌 훈련량을 낮추면서 인터벌 강도는 경기 속도 부근으로 유지하는 관행이 관찰됨 | 관찰 연구이며 결과가 더 좋아졌는지 비교하지 않음. 자기보고와 선택 편향. “많이 쓰는 관행”을 “효과가 검증된 처방”으로 바꾸면 안 됨. D1-PRACTICE | PubMed·대학 공식 기록 확인. 출판사 자동 접근 403 |
| T5 | Spilsbury et al. 2019, “Effects of an increase in intensity during tapering on 1500-m running performance.” DOI [10.1139/apnm-2018-0551](https://doi.org/10.1139/apnm-2018-0551), [PubMed PMID 30608885](https://pubmed.ncbi.nlm.nih.gov/30608885/) | 훈련된 성인 러너 10명, 평균 21.7세. 7일 테이퍼 두 조건에서 마지막 인터벌을 1500 m 경기 속도 또는 그보다 높은 강도로 수행, 트레드밀 1500 m 비교 | 경기 속도 조건의 개선이 더 일관됐고 더 높은 강도 조건의 반응은 크게 변동함 | n=10, 성인·준엘리트, 트레드밀. “마지막 세션은 더 세게”가 보편적으로 낫지 않다는 경고이지 정확한 배치일 규칙은 아님. D1 | 공식 초록 확인. 출판사 자동 접근 403 |
| T6 | Spilsbury et al. 2021, “Lower volume throughout the taper and higher intensity in the last interval session prior to a 1500 m time trial improves performance.” DOI [10.1139/apnm-2021-0103](https://doi.org/10.1139/apnm-2021-0103), [PubMed PMID 34062089](https://pubmed.ncbi.nlm.nih.gov/34062089/), [Nottingham Trent 공식 accepted manuscript](https://irep.ntu.ac.uk/id/eprint/43489/7/1443059_a1997_Faulkner.pdf) | 고도로 훈련된 남자 중거리 선수 8명, 평균 21.4세. 7일 테이퍼 두 조건의 counterbalanced crossover. 마지막 5×300 m 세션은 최종 1500 m 트랙 검사 3일 전 | 두 조건 모두 평균 기록이 개선됐고, 더 낮은 전체 훈련량과 더 높은 마지막 인터벌 강도를 묶은 조건의 평균 개선이 더 컸음 | n=8, 성인 남성. 훈련량과 마지막 강도를 함께 바꿔 각 요소의 효과를 분리할 수 없음. 한 선수는 악화. “정확히 3일 전”의 우월성을 검정한 연구가 아님. D1 | 공식 전문과 PubMed 확인. DOI 출판사 자동 접근 403 |

### 4.1 테이퍼 연구에서 허용되는 해석

- 중거리 테이퍼는 완전 휴식 하나만을 뜻하지 않는다.
- 작은 성인 표본에서는 총량을 줄이고 일부 경기 관련 강도와 빈도를 보존하는 전략이 반복해서 시험됐다.
- 마지막 세션의 강도를 무조건 높이는 것이 더 낫다고 말할 수 없다.
- 대회 특성, 선수 반응과 기존 훈련 습관을 함께 보아야 한다.

### 4.2 테이퍼 연구에서 금지되는 해석

- “6일 또는 7일 테이퍼가 과학적으로 최적이다.”
- “마지막 고강도는 모든 선수에게 정확히 72시간 전에 해야 한다.”
- “이 연구들이 9.5일 주기의 과학적 우월성을 입증했다.”
- “성인 남자 8~10명의 평균이 청소년 개인의 자동 처방 기준이다.”

## 5. 다중 경기와 혼잡 대회 1차 연구

| ID | 1차 연구와 공식 링크 | 대상·설계 | 직접 확인되는 결과 | 한계와 직접성 | 접근 상태 |
|---|---|---|---|---|---|
| C1 | Hanley & Hettinga 2018, “Champions are racers, not pacers: an analysis of qualification patterns of Olympic and IAAF World Championship middle distance runners.” DOI [10.1080/02640414.2018.1472200](https://doi.org/10.1080/02640414.2018.1472200), [PubMed PMID 29722599](https://pubmed.ncbi.nlm.nih.gov/29722599/) | 1999~2017 세계선수권·올림픽 800/1500 m 결승 진출 남자 295명, 여자 258명의 예선·준결승·결승 공식 결과 관찰 | 결승 성과는 앞 라운드의 단순 기록보다 순위·통과 방식과 관련됐다. 많은 우승자가 예선과 준결승에서도 높은 순위를 기록 | 실제 회복 시간, 생리 부하 또는 다음 훈련 안전을 측정하지 않음. 각 라운드가 동일 부하라는 뜻도 아님. D1-COMPETITION_STRUCTURE | 공식 초록 확인. 출판사 자동 접근 403 |
| C2 | Hanley, Stellingwerff & Hettinga 2019, “Successful Pacing Profiles of Olympic and IAAF World Championship Middle-Distance Runners Across Qualifying Rounds and Finals.” DOI [10.1123/ijspp.2018-0742](https://doi.org/10.1123/ijspp.2018-0742), [PubMed PMID 30569794](https://pubmed.ncbi.nlm.nih.gov/30569794/) | 세계선수권·올림픽 800/1500 m 남자 265명, 여자 218명의 여러 라운드 100 m 구간 기록 관찰 | 연속 라운드에서 이벤트별 페이싱 변화와 높은 변동성이 관찰됐다. 챔피언십은 한 번의 균일한 달리기가 아니라 여러 전술적 경기 시작으로 구성됨 | 피로의 원인을 직접 측정하지 않았고 라운드별 부하 등가성을 제시하지 않음. D1-COMPETITION_STRUCTURE | 공식 초록 확인. 출판사 자동 접근 403 |
| C3 | Birdsey et al. 2026, “National-Standard Middle-Distance Runners Maintain 1500 m Time Trial Running Performance on Successive Days.” DOI [10.1002/ejsc.70142](https://doi.org/10.1002/ejsc.70142), [PubMed PMID 41667403](https://pubmed.ncbi.nlm.nih.gov/41667403/), [PMC full text](https://pmc.ncbi.nlm.nih.gov/articles/PMC12890468/) | 국가급 성인 중거리 선수 12명, 남자 10·여자 2, 평균 27세. 트레드밀 1500 m time trial을 24시간 간격으로 두 번 | 대부분의 기록·보행·생리 차이는 기존 측정오차 범위였으나 두 번째 검사에서 인지 노력 상승 가능성이 나타남 | n=12, 성인, 전술 경기 아님. 통증·부상·다음 고강도 훈련의 안전을 판정하지 않음. 24시간 뒤 기록 유지가 청소년 준비 완료를 뜻하지 않음. D1 | 공식 전문 확인. 출판사 자동 접근 403 |
| C4 | Fujii et al. 2024, “Menthol alleviates post-race elevations in muscle soreness and metabolic and respiratory stress during running.” DOI [10.1007/s00421-024-05463-w](https://doi.org/10.1007/s00421-024-05463-w), [PubMed PMID 38565706](https://pubmed.ncbi.nlm.nih.gov/38565706/) | 성인 장거리 선수 11명. 1일차 1500 m, 2일차 3000 m 경기 뒤 3일차 평가에서 placebo와 4% menthol 조건 비교 | 대회 뒤 placebo 조건에서 근육통이 높았고 달리기 중 대사·호흡 부담 일부가 증가했다. 복수 경기 뒤 경기력 외 지표가 남을 수 있음을 보여줌 | menthol 중재가 중심이고 n=11. 성인 장거리, 청소년 800/1500 아님. 다음 MAIN 허용 시간을 시험하지 않음. D1/PARTIAL | PubMed 초록과 출판사 DOI 페이지 접근 확인 |
| C5 | Govus et al. 2018, “Commercially available compression garments or electrical stimulation do not enhance recovery following a sprint competition in elite cross-country skiers.” DOI [10.1080/17461391.2018.1484521](https://doi.org/10.1080/17461391.2018.1484521), [PubMed PMID 29924696](https://pubmed.ncbi.nlm.nih.gov/29924696/) | 스웨덴 국가대표 크로스컨트리 스키 선수 32명, 성인 21·주니어 11. 3~4분 스프린트 4회 뒤 무작위 회복 중재, 8·20·44·68시간 측정 | 중재는 대조군보다 회복을 향상시키지 못했고, 통증·요소·점프 등 지표의 시간 경과가 서로 달랐음 | 달리기가 아니라 스키이며 복합 회복 중재 연구. 44~68시간 결과를 러너 임계값으로 옮길 수 없음. D4 | 공식 초록 확인. 출판사 자동 접근 403 |
| C6 | Rhim et al. 2026, “Epidemiology of Injuries in United States High School Track and Field Running Events From 2008 to 2019.” DOI [10.4085/1062-6050-0203.25](https://doi.org/10.4085/1062-6050-0203.25), [PubMed PMID 42181777](https://pubmed.ncbi.nlm.nih.gov/42181777/) | 미국 고교 육상 국가 손상 감시. 5,486,279 athletic exposures와 2,629건 손상, 허들·단거리·중장거리 포함 | 전체적으로 대회 손상률이 훈련보다 높았고 비율비 RR 2.13, 95% CI 1.96~2.31. 중장거리 손상도 별도 집계됨 | 개인 훈련 이력·회복 간격을 알 수 없는 집단 감시 자료. 개인 위험 예측이나 대회 뒤 금지 시간을 만들 수 없음. D2 | PubMed 및 출판사 페이지 접근 확인 |

### 5.1 다중 경기의 제품 해석

Hanley 연구들은 챔피언십을 여러 라운드로 관찰했고, Birdsey와 Fujii 연구는 짧은 간격의 반복 경기에서 기록 하나만으로 회복 전체를 설명할 수 없음을 보여준다. 따라서 다음처럼 분리하는 것이 가장 정직하다.

| 층위 | 계산 | 이유 |
|---|---|---|
| 달력·사용자 화면 | 대회 일정 1개를 COMPETITION_ANCHOR로 고정 | 사용자가 하나의 대회로 이해하며 계획의 중심점도 하나이기 때문 |
| 실제 부하 | 실제 출발마다 COMPETITIVE_BOUT 1개 | 예선, 결승, 복수 종목은 시작·종료·거리·반응이 다르기 때문 |
| MAIN 카운트 | 단일 출발은 1회. 다중 출발은 실제 N회를 보존 | 한 대회를 생리적 노출 1회로 뭉개면 다음 고강도 판단의 입력이 손실됨 |
| 다음 MAIN 게이트 | 마지막 실제 경기 종료 시점과 선수 반응을 읽음 | 첫 라운드나 대회 명목 날짜만 읽으면 회복 창이 잘못 시작될 수 있음 |

## 6. 대회 뒤 다음 고강도 배치에 관한 1차 연구

| ID | 1차 연구와 공식 링크 | 대상·설계 | 직접 확인되는 결과 | 한계와 직접성 | 접근 상태 |
|---|---|---|---|---|---|
| N1 | Franceschi et al. 2025, “Post-Match Recovery Responses in Italian Serie A Youth Soccer Players: Effects of Manipulating Training Load 48 h After Match Play.” DOI [10.1002/ejsc.12297](https://doi.org/10.1002/ejsc.12297), [PubMed PMID 40254901](https://pubmed.ncbi.nlm.nih.gov/40254901/), [PMC full text](https://pmc.ncbi.nlm.nih.gov/articles/PMC12010046/) | 이탈리아 아카데미 축구 선수 48명, 평균 15.4세. 80분 경기 48시간 뒤 100분 완전 훈련 n=26 또는 70분 감소 훈련 n=22에 무작위 배정 | 48시간에 햄스트링 힘과 근육통 일부가 아직 변해 있었고, 높은 훈련량·강도 조건은 72시간 시점의 일부 신체 지표를 감소 조건보다 악화시킴 | 청소년 직접 연구지만 축구의 충돌·방향 전환·경기 특성이 달리기와 다름. 한 클럽과 친선 경기. 러너 48시간 금지선이나 72시간 허가선을 만들 수 없음. D3 | 공식 전문 확인. 출판사 자동 접근 403 |
| N2 | Constantine et al. 2019, “Isometric Posterior Chain Peak Force Recovery Response Following Match-Play in Elite Youth Soccer Players.” DOI [10.3390/sports7100218](https://doi.org/10.3390/sports7100218), [PubMed PMID 31581584](https://pubmed.ncbi.nlm.nih.gov/31581584/), [PMC full text](https://pmc.ncbi.nlm.nih.gov/articles/PMC6835616/) | 엘리트 청소년 축구 선수 14명, 평균 16세. 90분 경기 전후와 24·48·72시간 후 등척성 후면사슬 힘 측정. 후속 훈련 없음 | 힘은 경기 직후와 24시간에 감소했고 집단 평균은 48시간에 사전 값과 유의한 차이가 없었으나 개인·관절각 반응의 변동이 큼 | 단일 신체 지표, 작은 표본, 축구. 집단 평균의 비유의성이 개인의 고강도 준비 완료를 뜻하지 않음. D3 | 공식 전문 확인. DOI 출판사 자동 접근 403 |
| N3 | Yang et al. 2026, “Repeated sprint training induces prolonged residual fatigue compared to other high-intensity interval training modalities in middle-distance runners.” DOI [10.5114/biolsport.2026.156227](https://doi.org/10.5114/biolsport.2026.156227), [PubMed PMID 41994354](https://pubmed.ncbi.nlm.nih.gov/41994354/), [PMC full text](https://pmc.ncbi.nlm.nih.gov/articles/PMC13081156/) | 남자 중거리 선수 33명, 평균 19.6세. short HIIT, long HIIT, repeated sprint의 무작위 crossover, 직후·24·48시간 측정 | repeated sprint가 가장 큰 급성 저하와 24·48시간의 더 큰 잔여 피로를 보였고, 객관·주관 지표의 회복 속도가 달랐음 | 경기 아닌 훈련. 800~5000 m가 섞였고 남성 젊은 성인. 48시간 이후 자료가 없어 48~72시간 고정 규칙을 검증하지 않음. D1-TRAINING | 공식 전문과 출판사 페이지 확인 |

### 6.1 다음 MAIN 자동화에서 허용할 수 있는 것

- 시간 경과는 하나의 입력으로 사용한다.
- 마지막 실제 경기 종료 시점, 경기 시작 횟수, 통증·질병·수면·주관 피로·훈련 반응과 데이터 출처를 함께 본다.
- 단일 성능 지표가 회복되어도 다른 지표가 남을 수 있으므로 “기록 유지 = 완전 회복”으로 바꾸지 않는다.
- 자료가 없거나 서로 충돌하면 자동으로 고강도를 밀어 넣지 않고 HUMAN_REVIEW_REQUIRED로 전환한다.

### 6.2 다음 MAIN 자동화에서 금지할 것

- “24시간 뒤 기록이 유지됐으니 다음 MAIN이 안전하다.”
- “48시간이면 회복 완료다.”
- “72시간 규칙을 지켰으니 통증·질병·강한 피로를 무시해도 된다.”
- “집단 평균이 회복됐으니 이 선수도 회복됐다.”

## 7. 공식 합의문

| ID | 공식 합의문과 링크 | 직접 지지하는 원칙 | 지지하지 않는 것 | 직접성 |
|---|---|---|---|---|
| O1 | Kellmann et al. 2018, “Recovery and Performance in Sport: Consensus Statement.” DOI [10.1123/ijspp.2017-0759](https://doi.org/10.1123/ijspp.2017-0759), [PubMed PMID 29345524](https://pubmed.ncbi.nlm.nih.gov/29345524/) | 스트레스는 훈련·대회·생활 요구를 포함하며 회복은 개인 안에서도, 개인 사이에서도 달라진다. 체계적 모니터링이 필요하다. | 중거리 또는 청소년의 고정 시간 임계값 | C |
| O2 | Soligard et al. 2016, “How much is too much? (Part 1) IOC consensus statement on load in sport and risk of injury.” DOI [10.1136/bjsports-2016-096581](https://doi.org/10.1136/bjsports-2016-096581), [PubMed PMID 27535989](https://pubmed.ncbi.nlm.nih.gov/27535989/) | 훈련·대회 혼잡, 이동, 심리사회 부하를 함께 관리해야 하며 급격한 부하 변화에 주의해야 한다. | ACWR의 보편적 안전구간, 중거리 대회 뒤 자동 허가 시간. 이 합의문만으로 수치 규칙을 확정할 수 없음 | C |
| O3 | Schwellnus et al. 2016, “How much is too much? (Part 2) IOC consensus statement on load in sport and risk of illness.” DOI [10.1136/bjsports-2016-096572](https://doi.org/10.1136/bjsports-2016-096572), [PubMed PMID 27535991](https://pubmed.ncbi.nlm.nih.gov/27535991/), [BJSM official](https://bjsm.bmj.com/content/50/17/1043) | 대회 일정, 여행, 수면, 심리 스트레스와 회복을 포함한 넓은 부하 관리가 필요하다. | 개별 러너의 다음 MAIN 간격 | C |
| O4 | Mountjoy et al. 2024, “IOC consensus statement on elite youth athletes competing at the Olympic Games: essentials to a healthy, safe and sustainable paradigm.” DOI [10.1136/bjsports-2024-108186](https://doi.org/10.1136/bjsports-2024-108186), [PubMed PMID 39197945](https://pubmed.ncbi.nlm.nih.gov/39197945/), [BJSM official](https://bjsm.bmj.com/content/58/17/946) | 청소년 발달은 비선형·비동시적이며, 대회는 연령에 맞고 모니터링되며 선수 중심으로 지원되어야 한다. | 일반 청소년 800/1500 m의 시간 임계값. 올림픽 엘리트 맥락을 그대로 일반화할 수 없음 | C |
| O5 | Bergeron et al. 2015, “International Olympic Committee consensus statement on youth athletic development.” DOI [10.1136/bjsports-2015-094962](https://doi.org/10.1136/bjsports-2015-094962), [PubMed PMID 26084524](https://pubmed.ncbi.nlm.nih.gov/26084524/), [BJSM official](https://bjsm.bmj.com/content/49/13/843) | 성장·성숙·행동 발달의 개인차, 충분하고 규칙적인 회복, 개인 준비도와 맥락에 맞춘 코칭이 필요하다. | 고정 연령별 처방, 고정 48·72시간 규칙 | C |

합의문은 “개별화·모니터링·충분한 회복·대회 혼잡 고려”를 강하게 지지하지만, 정확한 시간 숫자를 제공하지 않는다. 그러므로 합의문의 원칙을 9.5일 제품 정체성의 안전 게이트에 사용하되, 새로운 과학 임계값을 발명하면 안 된다.

## 8. TRAINORACLE에서 허용·금지할 문구

### 8.1 허용 문구

| 사용 위치 | 허용 문구 |
|---|---|
| 제품 정체성 | “TRAINORACLE은 9.5일 기본 포메이션으로 하나의 주 계획을 자동 생성합니다.” |
| 근거 범위 | “9.5일은 제품의 기본 처방 틀이며, 모든 선수에게 과학적으로 우월한 주기라는 뜻은 아닙니다.” |
| 대회 앵커 | “대회 날짜를 먼저 고정했어요.” |
| 단일 출발 | “이 경기를 MAIN 노출 1회로 기록했어요.” |
| 다중 출발 | “이 대회에는 경기 시작이 여러 번 있어요. 각 경기를 따로 계산해 다음 고강도 훈련을 보류했어요.” |
| 시간 규칙 | “72시간은 일정 목표일 뿐 회복 판정이 아니에요.” |
| 정보 부족 | “기록이 부족하거나 통증·질병·강한 피로가 있으면 다음 고강도 훈련은 코치 확인이 필요해요.” |
| 테이퍼 | “훈련량을 낮추되 선수 반응과 대회 특성에 따라 일부 경기 관련 강도를 남기는 안을 제시했어요.” |
| 불확실성 | “이 배치는 작은 성인 연구와 코칭 관행을 참고한 기본안입니다. 청소년 개인에게 맞는지는 기록을 보며 조정해야 합니다.” |

### 8.2 금지 문구

| 금지 문구 | 이유 |
|---|---|
| “9.5일은 과학적으로 가장 우수한 주기입니다.” | 직접 비교 근거 없음 |
| “경기는 훈련 MAIN과 생리학적으로 동일합니다.” | 운영상 카운트와 생리적 등가성을 혼동 |
| “대회는 예선·결승이 있어도 MAIN 1회입니다.” | 실제 출발과 누적 부하를 삭제 |
| “72시간이 지나면 회복 완료입니다.” | 보편 임계값 근거 없음 |
| “마지막 고강도는 정확히 대회 3일 전에 해야 합니다.” | n=8 성인 프로토콜 한 건의 과잉 일반화 |
| “기록이 유지됐으니 몸도 안전합니다.” | 성능과 통증·피로·손상 위험은 동일 지표가 아님 |
| “고교 대회 손상률이 높으니 이 선수도 위험합니다.” | 집단 감시자료를 개인 예측으로 전환 |
| “AI가 회복을 확인했습니다.” | 현재 근거와 데이터로 임상적·생리적 확인 권한 없음 |

## 9. 별도 주기 규칙으로 일반화할 수 없는 부분

| 관찰 또는 근거 | 만들면 안 되는 별도 규칙 | 왜 안 되는가 | 대신 허용되는 처리 |
|---|---|---|---|
| 6일·7일 테이퍼 연구 | “모든 대회는 6일/7일 테이퍼” | 표본이 작고 프로토콜·대상·결과가 다름 | 9.5일 기본 계획 안의 테이퍼 후보 요소로만 사용 |
| T6의 마지막 인터벌이 1500 m 검사 3일 전 | “모든 마지막 고강도는 정확히 72시간 전” | 배치 시점을 비교한 연구가 아니고 n=8 성인 남성 | 마지막 세션 위치는 기본 제안 + 반응 확인 |
| Birdsey의 성인 1500 m 24시간 반복 기록 유지 | “24시간 뒤 청소년도 준비 완료” | 성인 소표본, time trial, 안전·손상·통증 판정 아님 | 다중 경기 가능성의 관찰 근거로만 사용 |
| Hanley의 다중 라운드 경기 분석 | “모든 라운드 부하는 같다” 또는 “대회 전체는 생리 노출 1회” | 라운드별 전술·속도·역할이 다르고 회복을 직접 측정하지 않음 | 앵커 1개, 경기 시작 N개로 보존 |
| Fujii의 1500 m+3000 m 연속 경기 뒤 잔여 반응 | “모든 복수 경기는 최소 72시간 금지” | n=11 성인 장거리, 중재 연구, 다음 세션 안전 미측정 | 복수 출발을 자동 허가하지 않는 경고 근거 |
| 청소년 축구 경기 48시간 뒤 완전 훈련의 불리한 반응 | “청소년 러너는 48시간 전면 금지” 또는 “72시간이면 허가” | 종목·기계적 요구·훈련 내용이 다름 | 청소년·고부하·강한 증상 시 사람 확인 강화 |
| 스키 스프린트 뒤 44~68시간 일부 지표 저하 | “러너 44/68시간 임계값” | 종목과 부하 형태가 다름 | 지표마다 회복 속도가 다르다는 경고 |
| 고교 육상 대회 손상률 RR 2.13 | “개인 위험도 2.13배” 또는 자동 출전 금지 | 집단 노출률이며 개인 예측모형이 아님 | 대회 자체를 높은 주의가 필요한 노출로 표시 |
| 9.5일 제품 정체성 | “9.5일이 가장 안전하거나 최적” | 직접 비교 연구 없음 | 고정 기본 자동 처방이라고만 설명 |

## 10. 제품·사용자 관점의 제안

### 10.1 사용자가 보아야 하는 정보

대회 카드는 복잡한 연구 문구 대신 다음 세 층만 보여주는 편이 이해하기 쉽다.

1. **고정됨**: “대회 날짜를 먼저 고정했어요.”
2. **실제 경기 수**: “예선과 결승, 총 2경기로 기록했어요.”
3. **다음 행동**: “마지막 경기 뒤 회복 기록을 확인한 후 다음 MAIN을 확정해요.”

필요할 때만 펼치는 상세 정보에 근거 수준과 사람이 확인해야 하는 이유를 둔다. 사용자가 “대회 하나를 왜 두 번 세느냐”고 느끼지 않도록 **일정은 하나, 실제로 뛴 횟수는 둘**이라고 설명해야 한다.

### 10.2 자동 생성 허용 조건

다음 조건을 모두 만족할 때만 대회 전후 기본 계획을 자동 생성 후보로 둘 수 있다.

- 대회 날짜와 시간대가 알려져 있다.
- 단일 출발인지 다중 출발인지 알려져 있다.
- 마지막 실제 경기 종료 시점을 계산할 수 있다.
- 최근 통증·질병·강한 피로 신호가 없다.
- 입력값의 출처가 EXPLICIT 또는 허용된 DERIVED로 표시되어 있다.
- 계획이 9.5일 기본 프레임 안에서 설명 가능하다.

### 10.3 HUMAN_REVIEW_REQUIRED 조건

- 예선·준결승·결승, 복수 종목 또는 릴레이가 있으나 시간표가 불명확함
- 마지막 실제 출발·종료 시점을 모름
- 경기 뒤 통증, 질병, 비정상적으로 강한 피로 또는 수면 악화
- 기록 간 충돌 또는 MISSING/LEGACY_MISSING_PROVENANCE가 핵심 판정에 포함됨
- 청소년 선수에게 대회 뒤 빠른 고강도나 복합 고부하 세션을 배치하려 함
- 사용자가 기본 계획을 넘어 별도 경기 전략이나 복수 피크를 요구함

HUMAN_REVIEW_REQUIRED는 “계획 없음”이 아니다. 화면에는 **고정된 대회, 확인된 정보, 아직 확정하지 않은 세션, 다음에 필요한 한 가지 입력**을 남겨야 한다.

## 11. 스펙 검토용 결정 후보

아래는 이 보고서가 제안하는 결정 후보이며 아직 정본이 아니다.

| 후보 | 제안 | 근거 수준 | 결정 필요 |
|---|---|---|---|
| CA-1 | COMPETITION_ANCHOR는 달력상 하나의 고정 대회 객체다 | 제품 원칙 + 다중 라운드 관찰과 일치 | 최신 결정과 일치, 문구 확인 |
| CA-2 | 단일 출발 경기는 운영상 실제 MAIN 노출 1회다 | 제품 계산 규칙. 생리학적 등가 근거는 아님 | “운영상” 한정 승인 |
| CA-3 | 다중 출발 대회는 앵커 1개 아래 COMPETITIVE_BOUT N개를 둔다 | C1~C5가 한 대회 안의 반복·상이한 노출을 지지 | 정본 자료모형 검토 필요 |
| CA-4 | 다음 MAIN 시간창은 마지막 실제 bout 종료 시점에서 시작한다 | 논리적 안전 보완. 정확한 임계시간 근거는 없음 | 규격 설계 결정 필요 |
| CA-5 | 72시간은 목표 일정이며 회복 완료 판정이 아니다 | N1~N3, O1~O5와 일치 | 사용자 문구 승인 |
| CA-6 | 9.5일 고정 기본 자동 처방은 유지하되 과학적 우월성을 주장하지 않는다 | 최신 책임자 결정 | 확정 기준으로 취급 |
| CA-7 | 다중 경기·청소년 빠른 재배치는 HUMAN_REVIEW_REQUIRED | 직접 청소년 중거리 임계값 부재 + 공식 합의문의 개별화 원칙 | 게이트 범위 승인 |

## 12. 자체 검증

| 검증 항목 | 결과 |
|---|---|
| 검색일 2026-07-17 명시 | PASS |
| 1차 연구와 공식 합의문만 근거 표에 포함 | PASS |
| 각 출처 DOI·공식 URL 포함 | PASS |
| 대상·설계·결과·한계 기록 | PASS |
| 직접성 등급 기록 | PASS |
| 자동 접근 403과 전문 미확인 상태를 숨기지 않음 | PASS |
| 청소년 800/1500의 고정 대회 전후 간격을 발명하지 않음 | PASS |
| 9.5일을 제품 기본 자동 처방 정체성으로 유지 | PASS |
| 9.5일의 과학적 우월성을 주장하지 않음 | PASS |
| 대회 앵커 1개와 실제 경기 시작 N개를 구분 | PASS |
| 정본 ledger/spec 수정 없음 | PASS |
| 런타임 권한 부여 없음 | PASS |
| 사람 전문가 최종 승인 주장 없음 | PASS |

## 13. 최종 판정

**KEEP_WITH_NARROWING_AND_LOAD_SUBEVENTS**

- 유지: 대회는 계획의 앵커다.
- 유지: 출발 한 번인 단일 경기는 운영상 MAIN 노출 1회다.
- 좁힘: “대회는 MAIN 1회”를 모든 대회에 적용하지 않는다.
- 추가 후보: 하나의 대회 앵커 아래 실제 경기 시작을 별도 COMPETITIVE_BOUT로 보존한다.
- 금지: 대회 전후 고정 시간만으로 회복 완료 또는 안전을 선언한다.
- 유지: 9.5일은 TRAINORACLE의 고정 기본 자동 처방 정체성이다.
- 금지: 이 보고서를 9.5일의 과학적 우월성 증명으로 사용한다.
