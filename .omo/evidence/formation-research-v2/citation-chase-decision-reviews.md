# Formation V2 Decision-Critical Citation Chase

```yaml
status: PREPARED_TWO_ROUNDS_HUMAN_SCREENING_PENDING
searched_through: 2026-07-17
scope: RQ-A_THROUGH_RQ-G_DECISION_CRITICAL_REVIEWS_AND_METHODS
owner_product_identity: 9_5_DAY_FORMATION
owner_target_authority: DEFAULT_AUTOMATED_PRESCRIPTION
runtime_authority: false
canonical_ledger_edited: false
new_candidate_packet: citation-chase-decision-candidates.csv
human_screening_state: PENDING_HUMAN_SCREENING
saturation: DECISION_CRITICAL_NEIGHBORHOOD_STABLE_NOT_BIBLIOGRAPHICALLY_EXHAUSTIVE
```

## 1. 두괄식 결론

결정에 중요한 리뷰와 방법 문헌을 RQ-A부터 RQ-G까지 정한 뒤, 각 씨앗 문헌의
참고문헌을 거슬러 가는 **backward chase**와 그 문헌을 인용한 이후 자료를 찾는
**forward chase**를 두 차례 수행했다.

두 차례 추적 후에도 다음을 직접 검증한 자료는 발견하지 못했다.

- 청소년 800/1500 m 선수에서 7일과 정확한 9.5일을 비교한 연구
- 9.5일 Formation 전체 구조의 우월성 또는 안전성
- 세션 종류만으로 다음 MAIN을 허가하는 보편적인 72시간 규칙
- 복합훈련의 보편적인 순서·분리시간·단일 피로점수
- 모든 지표에 적용할 수 있는 개인 기준선 최소 관찰수
- 일지나 부하 변화만으로 부상·질환·RED-S·회복완료를 판정하는 규칙

이는 **9.5일 제품 정체성을 재검토하라는 뜻이 아니다.** 최신 책임자 결정대로
9.5일은 TRAINORACLE의 고정 기본 자동 처방 프레임이다. 이번 추적은 프레임 안의
구성요소, 설명, 불확실성, 중단 및 사람 인계 조건만 제한한다.

## 2. 최신 책임자 결정 고정

이번 추적에서 다음은 연구 질문이 아니라 상위 제품 계약으로 취급했다.

1. 사용자는 여러 동급 주기 중 하나를 고르지 않는다. 첫 화면에는 하나의 9.5일
   기본 계획을 제시한다.
2. 9.5일은 `LOCAL_CIVIL_9_DAYS_12_HOURS`이며, 자동 처방에 준하는 목표 권한을
   가진다. 다만 현재 런타임은 정식 게이트 전까지 꺼져 있다.
3. 규칙이 필요한 사실을 만들 수 없거나 안전·일정 입력이 충돌하면 다른 주기를
   자동 추천하지 않고 `HUMAN_REVIEW_REQUIRED`와 코치 작성 계획으로 넘긴다.
4. `나만의 메모`는 분석·점수·검색·안전 신호에서 완전한 zero-signal이다.
5. 메모 백업과 공유는 선수가 명시적으로 선택할 수 있다. 공유 가능성은 분석
   동의로 간주하지 않는다.

## 3. 씨앗 문헌

| RQ | 씨앗 | 선택 이유 | 허용 범위 |
|---|---|---|---|
| A | [`SRC-PMID-35418513`](https://pubmed.ncbi.nlm.nih.gov/35418513/) | 엘리트 중·장거리의 periodization, TID, hard/easy 관행을 함께 정리 | 관행·구성요소 설명만; 주기 길이 비교 아님 |
| B | [`FRV2-B-020`](https://pmc.ncbi.nlm.nih.gov/articles/PMC11167466/) | 저항·플라이오 뒤 24-72시간 수행과 손상표지를 합성 | 세션·지표별 시간경과; 회복완료 판정 아님 |
| C | [`SRC-PMID-30131714`](https://pmc.ncbi.nlm.nih.gov/articles/PMC6090054/) | 청소년 동시 근력·지구력 훈련의 직접 리뷰 | 복합훈련 가능성; 정확한 순서·분리 규칙 아님 |
| D | [`SRC-PMID-28463642`](https://pubmed.ncbi.nlm.nih.gov/28463642/) | 내부·외부 부하와 다차원 모니터링의 핵심 합의문 | 구성요소 분리; readiness·안전 권한 아님 |
| E | [`FRV2-E-018`](https://pmc.ncbi.nlm.nih.gov/articles/PMC3652808/) | 409개 SCED와 당시 기준을 검토한 방법 리뷰 | 설계·측정·분석 게이트; 보편 n 아님 |
| F | [`FRV2-F-011`](https://www.bmj.com/content/377/bmj-2022-070904) | 초기 의사결정지원 평가의 인간요인·오류·워크플로 보고 | 파일럿 보고 틀; 스포츠 효능·안전 근거 아님 |
| G | [`SRC-PMID-33122252`](https://pubmed.ncbi.nlm.nih.gov/33122252/) | 청소년 러너에게 가장 직접적인 상위 경계 | 우려·인계 경계; 위험예측·훈련허가 규칙 아님 |

## 4. 추적 방법과 정확한 검색

### 4.1 공통 방법

- 씨앗과 후보의 DOI/PMID/PMCID는 PubMed, PMC, BMJ, FDA, IES/WWC 등 원문 또는
  공식 기록에서 다시 확인했다.
- 인용 관계 발견에는 OpenAlex의 `referenced_works`와 `filter=cites:`를 사용했다.
  OpenAlex는 **발견 도구**일 뿐이며 적격성 판단 근거로 사용하지 않았다.
- backward chase는 공개 원문의 reference list를 우선 사용했다. 예:
  [RQ-B 씨앗 전문](https://pmc.ncbi.nlm.nih.gov/articles/PMC11167466/),
  [RQ-C 씨앗 전문](https://pmc.ncbi.nlm.nih.gov/articles/PMC6090054/),
  [RQ-E 씨앗 전문](https://pmc.ncbi.nlm.nih.gov/articles/PMC3652808/),
  [RQ-F 씨앗 전문](https://pmc.ncbi.nlm.nih.gov/articles/PMC9116198/).
- forward chase 후보는 제목 검색으로 다시 확인한 뒤 PubMed/공식 페이지에서
  인구, 설계, 결과, 직접성, 수정·정정 상태를 확인했다.

### 4.2 Round 1 검색식

각 씨앗 DOI에 대해 다음 API 형식을 실행했다.

```text
https://api.openalex.org/works/https%3A%2F%2Fdoi.org%2F{DOI}
https://api.openalex.org/works?filter=cites:{OPENALEX_WORK_ID}&sort=cited_by_count:desc&per-page=20
```

웹/공식 색인 확인에 사용한 정확한 핵심 검색은 다음과 같다.

```text
"Training Periodization, Methods, Intensity Distribution, and Volume" references
"Training Periodization, Methods, Intensity Distribution, and Volume" cited by
"Acute effects of exercise-induced muscle damage" references
"Concurrent Strength and Endurance Training" youth cited by
"Monitoring Athlete Training Loads: Consensus Statement" references
"Single-case experimental designs" 409 studies current standards cited by
DECIDE-AI early-stage decision support usability human factors prospective evaluation
"Youth running consensus statement" injury adolescent distance runners
```

대표 확인 링크:
[RQ-A PubMed 검색](https://pubmed.ncbi.nlm.nih.gov/?term=%22Training+Periodization%2C+Methods%2C+Intensity+Distribution%2C+and+Volume%22),
[RQ-B PubMed 검색](https://pubmed.ncbi.nlm.nih.gov/?term=%22exercise-induced+muscle+damage%22+recovery+72),
[RQ-C PubMed 검색](https://pubmed.ncbi.nlm.nih.gov/?term=%22concurrent+training%22+youth+sequence),
[RQ-D PubMed 검색](https://pubmed.ncbi.nlm.nih.gov/?term=%22Monitoring+Athlete+Training+Loads%22),
[RQ-E PubMed 검색](https://pubmed.ncbi.nlm.nih.gov/?term=%22single-case+experimental+designs%22+standards),
[RQ-F BMJ 원문](https://www.bmj.com/content/377/bmj-2022-070904),
[RQ-G PubMed 검색](https://pubmed.ncbi.nlm.nih.gov/?term=%22youth+running+consensus%22).

### 4.3 Round 2 검색식

Round 1에서 판정에 영향을 준 후보를 새 노드로 삼아 reference list와 forward
neighborhood를 다시 확인했다. 최근 문헌의 색인 지연을 줄이기 위해 출판연도
내림차순 검색도 병행했다.

```text
("9.5-day" OR "9.5 day") training cycle runner
("9-day" OR "10-day") microcycle distance runner
recovery kinetics sprint training 72 h sex athlete 2025 2026
concurrent training adolescent distance runner complex training 2025 2026
athlete monitoring minimum detectable change individualized baseline 2026
What Works Clearinghouse single-case design standards 2022
FUTURE-AI DECIDE-AI human factors end users oversight
week-to-week training injury high school cross-country runner
sleep stress fatigue injury high school cross-country runner
```

대표 확인 링크:
[정확한 주기 검색](https://pubmed.ncbi.nlm.nih.gov/?term=%28%229.5-day%22+OR+%229-day%22+OR+%2210-day%22%29+runner+microcycle),
[최신 회복 검색](https://pubmed.ncbi.nlm.nih.gov/?term=recovery+kinetics+athlete+72+hours+2025%3A2026),
[최신 청소년 복합훈련](https://pubmed.ncbi.nlm.nih.gov/?term=adolescent+concurrent+training+2025%3A2026),
[WWC 현재 핸드북](https://ies.ed.gov/ncee/wwc/handbooks),
[FDA 인간요인](https://www.fda.gov/medical-devices/device-advice-comprehensive-regulatory-assistance/human-factors-and-medical-devices),
[FUTURE-AI](https://www.bmj.com/content/388/bmj-2024-081554),
[청소년 러닝 전향 연구](https://pubmed.ncbi.nlm.nih.gov/39084699/).

## 5. RQ별 두 차례 결과

### RQ-A: 9.5일 처방 구조

**Round 1 backward.** 씨앗 리뷰가 포함한 직접 관찰 중
[`CCH-A-001`](https://pubmed.ncbi.nlm.nih.gov/15741850/)은 성인 지구력 러너의
훈련 구성과 수행 관계를 기술한다. hard/easy 구성의 맥락은 주지만 7일 대 비주간
프레임을 비교하지 않는다.

**Round 1 forward.** [`CCH-A-002`](https://pubmed.ncbi.nlm.nih.gov/39012575/)는
실전 endurance session model을 더 세밀하게 정리한다. 구성요소·목표·세션 형태를
보존해야 한다는 제품 설계에는 유용하지만 9.5일의 효능·안전 근거는 아니다.

**Round 2.** Round 1 후보의 참고문헌과 씨앗의 최신 forward neighborhood를 다시
추적해 [`CCH-A-003`](https://pubmed.ncbi.nlm.nih.gov/42389749/)을 찾았다. 서로 다른
엘리트 훈련 체계가 다른 session density를 사용한다는 개념 비교이며, 정확한
주기 길이를 실험하지 않는다. 정확한 `9.5-day` PubMed 검색에서는 직접 비교가
0건이었다. 9일 사용 사례는 정본 원장의 Meb/Ko 사례를 재확인했지만 사용 사실
이상의 주장은 늘지 않았다.

**영향.** 9.5일 정체성은 유지한다. UI와 규칙은 “9.5일이 과학적으로 최적”이
아니라 “TRAINORACLE의 기본 구조”라고 설명해야 한다. 과학은 MAIN 밀도, 대회
앵커, 구성요소, 충돌 시 인계만 제한한다.

### RQ-B: 세션별 회복과 간격

**Round 1 backward.** 씨앗 리뷰의 원 연구 중 정본에 이미 있는
[강한 플라이오 뒤 24-120시간 연구](https://pubmed.ncbi.nlm.nih.gov/20386477/)와
[복합 플라이오·저항 세션 연구](https://pubmed.ncbi.nlm.nih.gov/34296839/)를 다시
확인했다. 같은 72시간이라도 점프, 힘, DOMS, CK가 다르게 움직인다.

**Round 1 forward.** [`CCH-B-002`](https://pubmed.ncbi.nlm.nih.gov/40884423/)는
남녀 팀스포츠 선수의 48시간 측면 커팅 생체역학을 추가한다. 직접성은 낮지만
“선택한 수행 하나가 정상 = 전체 회복”이라는 해석을 허용하지 않는다.

**Round 2.** 관련 여성 경기 회복 리뷰
[`CCH-B-001`](https://pubmed.ncbi.nlm.nih.gov/35657571/)의 인용망과 최신 연구를
추적했다. [`CCH-B-003`](https://pubmed.ncbi.nlm.nih.gov/42351387/)에서는 경기 3일
뒤에도 여성 집단의 일부 신경근·근육통 지표가 남았고, 남성 집단과 달랐다.
반대로 정본의 [사이클 SIT 연구](https://pubmed.ncbi.nlm.nih.gov/37285051/)는 선택한
신경근·자율신경 지표가 24시간 내 돌아왔다. [`CCH-B-004`](https://pubmed.ncbi.nlm.nih.gov/40853524/)
역시 여성 회복 자료의 부족과 개인차를 명시한다.

**영향.** `72h`는 `COACH_SELECTED_TARGET_INTERVAL`의 경과 기준일 뿐이다.
`recovery_complete`, `ready`, `safe`, `next_MAIN_clearance`로 변환하지 않는다.
사용자에게는 “목표 간격까지 14시간 남음”처럼 사실만 보여주고, 몸 상태 판정을
대신하지 않는다는 짧은 설명을 붙인다.

### RQ-C: 복합·동시 훈련

**Round 1 backward.** 씨앗 리뷰가 포함한
[`CCH-C-001`](https://pubmed.ncbi.nlm.nih.gov/26332782/)은 13세대 남자 축구선수의
근력→지구력, 지구력→근력, 다른 날 배치를 비교했다. 한 프로토콜에서는 세션 내
순서 차이가 작았지만 종목, 성별, 세션 내용이 TRAINORACLE 대상과 다르다.

**Round 1 forward.** 2018 리뷰의 forward neighborhood에서 2026 업데이트
[`CCH-C-002`](https://pubmed.ncbi.nlm.nih.gov/42038220/)를 확인했다. 동시훈련이
청소년에게 보편적으로 해롭다는 주장을 약화하지만, 포함연령이 24세까지이고
이질성이 크며 정확한 세션 간격을 검증하지 않는다.

**Round 2.** 최신 리뷰가 포함·인용한 직접 연구를 다시 따라가 정본에 이미 있는
[청소년 남자 거리러너 복합훈련 연구](https://pubmed.ncbi.nlm.nih.gov/41312139/)를
재확인했다. 8주 결과는 heavy resistance+plyometric 구성의 가능성을 보여주지만
모두 남자, 소표본, 장기 pre/post이며 인접 MAIN의 급성 회복과 안전을 검증하지
않는다. 성인 3시간 분리 연구도 정본에 있으나 일부 power 결과만 순서 영향을
보였다.

**영향.** 복합일은 금지하거나 하나의 피로색으로 압축하지 않는다. 정본은
`component`, `order`, `dose/unit`, `separation`, `goal`, `mechanical_impact`를
보존한다. 화면의 대표색은 탐색용일 뿐 자동 처방 입력은 구성요소별 규칙을 쓴다.

### RQ-D: 거짓 피로점수 없는 부하 기술

**Round 1 backward.** 씨앗의 핵심 전제인 내부·외부 부하 분리는 정본의
[15년 후 개념 정리](https://pubmed.ncbi.nlm.nih.gov/30614348/)와 일치했다. 또한
[ACWR 비판](https://pubmed.ncbi.nlm.nih.gov/32502973/)은 연관 지표를 인과적
부상예방 규칙으로 바꾸는 것을 명시적으로 반박한다.

**Round 1 forward.** [`CCH-D-001`](https://pubmed.ncbi.nlm.nih.gov/37181251/)은
외적 부하와 bone monitoring에 대한 연구자·실무자 설문이다. 무엇을 실제로
측정했는지 장치·단위·방법을 보존할 이유는 강화하지만 bone-stress 임계값을
제공하지 않는다.

**Round 2.** 최신 forward 문헌
[`CCH-D-002`](https://pubmed.ncbi.nlm.nih.gov/41824225/)는 load, athlete state,
training response를 분리하고 개인내 변동과 측정오차를 보라고 한다. 그러나
체계적 검색이 없는 narrative review이며 “조건이 좋으면 두 번의 신뢰 가능한
세션으로 변동을 추정할 수도 있다”는 실무 예시는 보편 최소 n으로 채택할 수 없다.
[`CCH-D-003`](https://pubmed.ncbi.nlm.nih.gov/29332472/)은 지표별 absolute
reliability와 MDC를 먼저 확인해야 함을 보강한다.

**영향.** `total_fatigue`, `safe_load`, `recovery_score`를 만들지 않는다. 외적
작업, 내적 반응, 파생값, 맥락을 분리하고 각 값에 unit, method, device/version,
provenance를 붙인다. 사용자는 “왜 이 수치가 보이는지”를 한 단계 눌러 확인할 수
있어야 한다.

### RQ-E: 개인 한 명의 최소 근거

**Round 1 backward.** 2012 씨앗이 사용한 당시 WWC 기준을 현재 공식
[`CCH-E-001`](https://ies.ed.gov/ncee/wwc/handbooks) Version 5.0까지 확인했다.
SCED 품질은 관찰수 하나가 아니라 설계, 반복, phase, 독립변수 조작, 결과의
시계열 패턴을 함께 본다.

**Round 1 forward.** 비동시 multiple-baseline의 방법 논쟁을 따라가
[`CCH-E-002`](https://pubmed.ncbi.nlm.nih.gov/36249170/)을 확인했다. 비동시 설계는
가능하지만 replication과 randomization 보강이 필요하며, 단순 누적일지는 그
자체로 인과 설계가 아니다.

**Round 2.** 스포츠 적용인 정본의
[2025 reactive-strength SCED](https://pubmed.ncbi.nlm.nih.gov/40566441/)의
참고문헌을 거슬러 [`CCH-E-003`](https://pubmed.ncbi.nlm.nih.gov/29253607/)과
[`CCH-E-004`](https://pubmed.ncbi.nlm.nih.gov/21496513/)을 확인했다. 해당 스포츠
연구는 참가자 4명, 5-7주 baseline, 6주 intervention을 사용했지만 이것이 다른
지표의 최소 기준은 아니다. AHRQ N-of-1 가이드는 carryover와 washout이
중재별이라는 점을, CENT는 자기상관·period effect·carryover를 보고해야 함을
재확인했다.

**영향.** 주장 사다리를 유지한다.

```text
OBSERVATION
→ DESCRIPTIVE_BASELINE
→ MEASUREMENT_ERROR_EXCEEDING_CHANGE
→ PROSPECTIVE_HYPOTHESIS_COMPARISON
```

사용자 화면에는 “데이터 부족” 하나만 쓰지 말고 현재 허용 수준과 필요한 다음
행동을 보여준다. 예: “기록 6회: 평균은 볼 수 있음 / 변화 판정은 아직 안 함.”

### RQ-F: 청소년 사용자와 파일럿

**Round 1 backward.** DECIDE-AI의 방법 기반인
[`CCH-F-001`](https://pubmed.ncbi.nlm.nih.gov/34593508/)은 복합중재를 맥락,
이해관계자, 반복 개선과 함께 평가하도록 한다.
[`CCH-F-002`](https://www.fda.gov/medical-devices/device-advice-comprehensive-regulatory-assistance/human-factors-and-medical-devices)
는 use error와 대표 사용자의 안전한 사용 검증을 강조한다. 이는 TRAINORACLE을
의료기기로 규정하는 근거가 아니라 인간요인 평가 항목을 찾는 간접 방법 자료다.

**Round 1 forward.** [`CCH-F-004`](https://pubmed.ncbi.nlm.nih.gov/39909534/)는
end user 요구, human-AI interaction, oversight, traceability, usability를 전체
수명주기에 걸쳐 보라고 한다. 역시 healthcare consensus라 스포츠 직접성은 낮다.

**Round 2.** 비교시험 보고용
[`CCH-F-003`](https://pubmed.ncbi.nlm.nih.gov/32908283/)까지 따라가 버전, 사용자
상호작용, 오류·예외 기록 항목을 확인했다. 그러나 DECIDE-AI 자체도 reporting
guideline이지 연구 수행의 충분조건이 아니며, 이번 1차 파일럿은 효능·안전
검정력이 없다.

**영향.** 그림자 모드라도 선수는 자신을 대상으로 계획이 생성되고 있음을 안다.
화면에는 생성 여부, 코치 계획과의 차이, 왜 실행 계획이 아닌지, 중단·철회 방법,
문의 대상을 보여준다. 연속 기록 스티커나 보상은 참여 보상일 뿐, 준비도·안전·
훈련강도 점수와 연결하지 않는다.

### RQ-G: 청소년 안전 경계와 인계

**Round 1 backward.** 씨앗 합의문 자체가 연령별 적정 거리 근거가 의견 중심이며
사춘기 전 직접 자료가 부족하다고 밝힌다. 정본의
[청소년 거리러너 후향 연구](https://pubmed.ncbi.nlm.nih.gov/34250468/)는 부상
빈도를 기술하지만 인과 임계값을 주지 않는다.

**Round 1 forward.** 씨앗을 인용한 2024 risk-factor 리뷰는 정본에 이미 있고,
훈련·수면·전문화 근거의 확실성이 낮다고 판정했다. 사용자 관점의
[`CCH-G-004`](https://pubmed.ncbi.nlm.nih.gov/38599225/)는 선수와 코치가 원하는
예방 지원의 내용·시점이 다를 수 있어 공동설계가 필요함을 보여준다.

**Round 2.** 직접 청소년 자료를 더 추적했다.
[`CCH-G-003`](https://pubmed.ncbi.nlm.nih.gov/33504281/)은 선수들이 건강문제를
가진 채 훈련·경기할 수 있음을 보여준다. 반면
[`CCH-G-001`](https://pubmed.ncbi.nlm.nih.gov/39084699/)에서는 총 주간량·시간과
주간 변화가 다음 부상과 연관되지 않았고,
[`CCH-G-002`](https://pubmed.ncbi.nlm.nih.gov/38148661/)에서도 수면·스트레스·
피로 변화가 부상과 전향적으로 연관되지 않았다. “연관 없음”은 안전을 뜻하지
않으며, 이 결과는 단일 자동 위험점수의 근거를 약화한다.

**영향.** 구조화된 명시적 우려만 후보 억제와 사람 인계의 입력 후보가 된다.
시스템은 진단명이나 위험등급을 보여주지 않는다. 사용자가 보게 될 문구는
“부상 위험 높음”이 아니라 “통증 답변이 있어 자동 계획을 멈췄습니다. 코치와
확인해 주세요”처럼 사실, 조치, 다음 사람을 함께 담아야 한다.

## 6. 새 후보와 적격성

새 후보 전량은
[`citation-chase-decision-candidates.csv`](./citation-chase-decision-candidates.csv)에
기록했다. 정본 `FORMATION_SOURCE_LEDGER.csv`에는 합치지 않았다. 모든 행은
`PENDING_HUMAN_SCREENING`이며, 다음을 완료하기 전 주장 행렬이나 런타임 규칙의
근거로 승격할 수 없다.

1. 인간 검토자의 제목/초록 및 원문 적격성 확인
2. 정정·철회·중복 신원 확인
3. RQ별 독립 추출과 위험편향 평가
4. 정본과 overlap group 정리

## 7. 접근 실패와 한계

| 항목 | 상태 | 영향 |
|---|---|---|
| SPORTDiscus | `ACCESS_UNAVAILABLE` | 데이터베이스 고유 forward/backward 인용망을 완주하지 못함 |
| Scopus | `ACCESS_UNAVAILABLE` | Scopus `Cited by`와 reference export를 확인하지 못함 |
| Web of Science | `ACCESS_UNAVAILABLE` | WoS citation index 기반 포화 판정을 못함 |
| Cochrane authenticated advanced search | `ACCESS_RESTRICTED` | 정교한 필드 검색·저장 검색식 재현 제한 |
| Google Scholar | `NOT_USED_FOR_DECISION_EXTRACTION` | 불안정한 접근과 불투명한 정렬 때문에 후보 발견 보조에도 사용하지 않음 |
| 일부 출판사 전문 | `PAYWALL_OR_ANTIBOT` | PubMed/PMC/공식 저장소 기록으로 메타데이터 확인; 원문 미확인 후보는 인간 심사 대기 |
| 2025-2026 최신 문헌 | `INDEXING_LAG_POSSIBLE` | forward citation 수가 0이어도 문헌 부재로 해석할 수 없음 |
| OpenAlex | `DISCOVERY_ONLY` | 인용 edge 누락·오분류 가능; 적격성 판정에 단독 사용하지 않음 |

## 8. 포화 판정

이번 결과는 **정식 systematic-review saturation이 아니다.** 두 차례 추적에서
결정 핵심 이웃의 논점은 안정되었다.

- exact 9.5-day 비교는 계속 발견되지 않았다.
- 최신 근거도 72시간을 보편 허가선으로 만들지 못했다.
- 복합훈련 허용 가능성은 강해졌지만 정확한 순서·간격은 종목·프로토콜별이었다.
- load, state, response와 측정오차의 분리 필요성은 반복 확인됐다.
- 개인내 인과 주장은 설계·replication·carryover·자기상관을 요구했다.
- 청소년 직접 자료는 단일 부하·수면·피로 변화로 부상을 예측하는 규칙을
  지지하지 않았다.

따라서 판정은 다음과 같다.

```yaml
decision_critical_concept_saturation: STABLE_AFTER_TWO_ROUNDS
bibliographic_saturation: NOT_ACHIEVED
candidate_screening: PENDING_HUMAN_SCREENING
claim_upgrade_allowed: false
runtime_rule_upgrade_allowed: false
```

## 9. 사용자 관점 검증과 개선 제안

### P0: 자동 처방 화면

1. 첫 화면은 하나의 9.5일 계획을 보여준다. “다른 주기도 고르세요”를 기본
   경험으로 만들지 않는다.
2. 계획 머리말은 `TRAINORACLE 9.5일 Formation`으로 표시하고 “과학적으로 가장
   좋은 주기” 같은 문구는 사용하지 않는다.
3. 계획을 낼 수 없을 때 빈 화면을 주지 않는다. 멈춘 이유, 필요한 정보, 다음
   행동, 담당 사람을 한 화면에 보여준다.

### P0: 간격과 안전 설명

1. 72시간은 카운트다운 또는 코치 목표 간격으로만 표시한다.
2. 색 하나로 “회복됨/안 됨”을 만들지 않는다.
3. 통증·질환·에너지 가용성·의료 제한 답변은 진단하지 않고 자동 계획을 멈춘다.
4. private memo는 어떤 중단 신호에도 사용하지 않는다. 안전 우려는 별도의
   구조화된 질문과 명시적 동의로만 받는다.

### P1: 복합 세션 이해

1. 대표색은 사용자가 달력을 훑기 위한 시각 신호로만 쓴다.
2. 상세 보기에서는 `달리기 → 플라이오 → 웨이트` 순서, 각 양, 목적, 분리시간을
   보존한다.
3. 하나의 “피로 83점” 대신 `외적 작업`, `선수 반응`, `맥락`, `미입력`을 나눠
   보여준다.

### P1: 데이터가 적을 때

1. 설명 단계 1에서는 “아직 평균만 볼 수 있어요”처럼 짧게 쓴다.
2. 더 정확한 단계에서는 관찰수, coverage, 단위, 프로토콜, 측정오차 상태를
   펼쳐 보게 한다.
3. 숫자가 적다고 기능 전체를 막지 않는다. 사실 표시와 평균은 허용하되 변화·
   효과 주장은 각각의 게이트를 통과해야 한다.

### P1: 파일럿과 보상

1. 선수에게 그림자 모드를 숨기지 않는다. “코치 계획과 비교 중이며 자동 실행되지
   않음”을 명시한다.
2. 스티커·연속 기록·포인트는 입력 습관 보상으로만 쓴다. 고강도 수행, 통증
   무시, 더 높은 부하를 보상하지 않는다.
3. `나만의 메모` 백업/공유 선택은 유지하되, 내보내기·공유와 분석 동의를 서로
   다른 스위치로 둔다.

## 10. 다음 게이트

이번 파일은 Task 3의 인용 추적 준비를 끝낸 증거다. 다음 작업은 AI가 임의로
완료 처리할 수 없다.

1. `citation-chase-decision-candidates.csv` 인간 이중 스크리닝
2. 포함 후보의 원문 이중 추출 및 위험편향 평가
3. RQ-A-G claim matrix와 overlap group 갱신
4. 사용자 문구·화면 흐름을 선수/코치가 직접 이해하는지 테스트
5. 그 뒤에만 규칙별 runtime authority 검토
