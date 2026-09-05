# 세션 방법 프로토콜 근거 조사: 2026-09-06

```yaml
doc_id: trainoracle-session-method-protocol-evidence-2026-09-06
status: BOUNDED_RESEARCH_EVIDENCE_NOT_ADOPTION
access_date: 2026-09-06
extraction_date: 2026-09-06
timezone: Asia/Seoul
local_head_at_inspection: 985669328dbcc7738afc9f390c9c325769b8251c
catalog_rows_covered: 30
primary_experimental_fulltexts_examined: 4
new_scientific_approvals: 0
new_coaching_approvals: 0
new_runtime_activations: 0
real_athlete_prescriptions: 0
existing_files_edited: 0
external_writes_authorized: false
commit_push_performed: false
all_protocols_complete: false
```

## 1. 결론과 작업 경계

**전체 카탈로그 준비는 승인된 작업이다. 이번 조사로 새 훈련을 활성화하지는 않는다.**
30행 모두 실제 카탈로그와 대조했으며, 기존의 빈칸 이름을 반복하는 데서 그치지 않고
출판사 전문, 원저자 코칭 문서, 검색 색인 본문을 새로 확인했다. 아래 수치는 원문 전사와
검증용 예시이지 실제 사용자에게 수행하도록 배정한 처방이 아니다.

핵심 진전:

- 5000m 두 번째 동일 목적 후보는 `V2-SEED-02`의 시간 기반 I 인터벌을 먼저 검토한다.
  같은 VO2 훈련 의도를 설명하는 직접 코칭 예시이며 현행 거리 반복과 구조가 다르다.
  다만 I 강도와 현재 5000m 기록 페이스는 같은 입력 모델이 아니다. [D1](#d1)
- 보류된 `V2-SEED-04`의 실제 실험 전문을 확보했다. 회복은 막연한 easy가 아니라
  측정 vVO2max의 50%였고, 채혈을 위한 수동 회복도 있었다. 원문 접근 공백은 줄었지만
  대상 전이, 실험 절차의 현장 변경, 목표 속도 입력 문제는 남는다. [P1](#p1)
- `AP-SEED-02`와 `AP-SEED-03`은 한 연구에서 **연속 수행한 세션의 부분 블록**이다.
  세트 간 회복은 180초로 확인됐다. 각각을 독립적인 검증 훈련으로 소개하면 안 된다. [P3](#p3)
- `LT-SEED-03`의 출처는 1600m가 아니라 1 mile 반복이다. `LT-SEED-04`의 3x7분은
  실제 사용 가이드에도 있지만, 해당 문장에는 회복 처방이 없다. [D3](#d3), [D4](#d4)
- World Athletics 직접 접근은 실패했다. 일부 프로토콜은 공식 URL의 검색 색인에서
  확인했지만, 이를 새로 내려받아 검수한 전문으로 표시하지 않는다. [W3](#w3), [W4](#w4), [W5](#w5)

읽은 로컬 기준: [AGENTS](../../AGENTS.md), [PRODUCT_NORTH_STAR](../../PRODUCT_NORTH_STAR.md),
[2026-09-05 준비 보고서](../review/SESSION_METHOD_CATALOG_READINESS_2026-09-05.md),
[실제 카탈로그](../../specs/reconstruct/ENERGY_SYSTEM_SESSION_TEMPLATE_CATALOG.md),
[기존 두 번째 MAIN 패킷](../review/SECOND_MAIN_METHOD_SOURCE_REVIEW_PACKET_2026-09-02.md),
[중거리 원문 채택 패킷](../review/MIDDLE_DISTANCE_SOURCE_ADOPTION_PACKET_2026-08-17.md).
카탈로그 30행 중 현행 `V2-SEED-05@1.0.0`만 ACTIVE이며, 별도 MD 3개는 30행에 더해 세지 않는다.
현재 코드 동작, 전체 테스트, 배포 상태를 이번 문헌 조사로 재인증하지 않는다.

## 2. 근거 등급

| 표기 | 이번에 실제로 확인한 범위 | 허용되지 않는 해석 |
|---|---|---|
| FT-R | 원 실험 논문의 출판사 HTML 전문에서 Methods와 관련 결과를 직접 확인 | 논문 심사자의 심사를 TrainOracle 적용 승인으로 대체 |
| FT-C | 원저자 또는 제공 기관의 코칭/제품 안내 본문 직접 확인 | 대조 실험, 개인별 효과, 자동 용량 권한으로 승격 |
| IDX | 해당 원문 또는 원문 PDF 복제본의 검색 색인 본문 확인; 직접 열기는 실패 | 직접 전문 검수 완료, PDF 이미지 확인 완료 |
| MA | 제목/서지/초록만 확인 | 정확한 전문 프로토콜, 누락된 경계·강도 추론 |
| FAIL | 해당 URL을 열었으나 오류·빈 본문·접근 차단 | 원문 자체가 존재하지 않는다는 단정 |
| PRODUCT | 로컬 제품 상태/표현만 존재 | 과학적 운동법, 회복 판정 또는 의료 승인 |

**모든 아래 URL의 접근 시도일·본문 추출일은 2026-09-06(KST)**이다. 발행일은 별도 기재한다.
검색 서비스의 상대적인 게시 시각은 논문 발행일로 쓰지 않았다. DOI의 연도와 온라인 발행일도
구분했다. 실패 경로와 성공 대체 경로를 함께 남긴다. 로그인·쿠키·유료벽 우회는 하지 않았다.
긴 원문 복제 대신 필요한 프로토콜 사실과 로컬 대조 결과만 기록했다.

## 3. 원문별 추출 기록

### D1

`SRC-VDOT-PACES` / FT-C / V.O2 Running Calculator, 게시일 미표기.
URL: <https://vdoto2.com/calculator/>
위치: Easy Pace, Interval Pace, Rep Pace, Fast Reps Pace의 Sample Workout.

확인된 E 및 I 예시는 §4의 해당 행과 일치한다. I의 목적은 aerobic power이며,
all-out과 구분한다. 웹페이지의 VO2max 비율을 **속도 비율**로 바꾸지 않는다.
F는 최근 800m 능력보다 빠르지 않게, 반복 90초 이내, 충분한 easy jog 회복이라는 설명이다.
실험 표본은 없고 일반 코칭 안내다. 정확한 현행 `5x1000m/150초 JOG` 전체 구성은
이 페이지의 직접 예시가 아니라 기존 TrainOracle 운영상 채택이다.

### D2

`SRC-VDOT-T` / FT-C / What’s Your Threshold Pace?, 2017-12-05.
URL: <https://support.vdoto2.com/2017/12/whats-threshold-pace/>
위치: Training Type, Intensity.

지속 T 20분, 분할 T의 운동 5~15분/회복 1~2분을 확인했다. 회복 모드는 미표기다.
추가량은 주간 거리 맥락과 연결되며, 고정 반복 수나 청소년별 수치는 제공하지 않는다.
본문의 5K 대비 24~30초 표현에는 거리 단위가 빠져 있으므로 이 문장만으로 초/km 공식을
구현할 수 없다. 2025년 글 [D3](#d3)은 mile 단위를 명시하지만 두 문헌을 자동 합성한
개인 역치 측정값으로 만들지는 않는다.

### D3

`SRC-VDOT-CRUISE` / FT-C / Get The Most Out Of Your Threshold Training, 2025-06-24
(페이지에 수정 시각 2025-06-28도 표시).
URL: <https://news.vdoto2.com/2025/06/get-the-most-out-of-your-threshold-training/>
위치: Cruise Intervals, Tempo Runs, Training Suggestions.

원문은 `4 x 1 mi`와 1분 회복이다. 1600m로 옮기는 것은 정확한 단위 환산이 아니다.
긴 tempo 예시에는 40분일 때 T보다 6~12초/km, 60분일 때 12~20초/km 느리게 하는
조정이 제시된다. 같은 T를 오래 유지하라는 뜻이 아니다.
같은 글의 cruise 최소 30분 및 주간 거리 10% 이내라는 지침은 개인 맥락 없이 함께
만족한다고 단정할 수 없다. 단일 예시보다 우선하는 보편 공식으로도 채택하지 않는다.
코칭 설명이며 실험 표본/개인별 검증은 없다.

### D4

`SRC-VDOT-GUIDE` / FT-C / VDOT Adaptive Trainer Instructional Guide, 게시일 미확정.
URL: <https://support.vdoto2.com/vdot-adaptive-trainer-instructional-guide/>
위치: Training Preferences / WORKOUTS PREFERENCE, Quality Days.

시간·거리 표시 선호 예시에 `3 x 7 minutes`가 실제로 있다. 따라서 7분이 전혀
출처 없는 숫자라는 결론은 부정확하다. 그러나 반복 사이 1~2분은 이 문장에 없으며
[D2](#d2)와 합성한 구성임을 보존한다. 10mi/16km/120분도 표시 예시이지 누구에게나
같은 장거리 용량을 배정하는 지침이 아니다. 프로그램이 주간 거리·VDOT·목표를 고려한다고
설명하지만 그 결정 알고리즘은 이 페이지에서 확인할 수 없다.

### P1

`SRC-PMID-39835194` / FT-R / Fleckenstein, Braunstein, Walter, 2025-01-06.
논문: Faster intervals, faster recoveries, DOI `10.3389/fspor.2024.1507957`.
전문: <https://www.frontiersin.org/journals/sports-and-active-living/articles/10.3389/fspor.2024.1507957/full>
서지: <https://pubmed.ncbi.nlm.nih.gov/39835194/>
실패 경로: <https://pmc.ncbi.nlm.nih.gov/articles/PMC11743937/> 및
<https://pmc.ncbi.nlm.nih.gov/articles/pmid/39835194/>는 browser-check 화면.
위치: §2.1~2.3, §3.1, Figure 1 설명.

- 12명(남7/여5), 국가 훈련그룹의 400/800m 선수, 준비기 첫 4주. 남 평균24.3세,
  여19.5세. 전체를 5000m 선수나 검증된 청소년 표본으로 재명명하지 않는다.
- 원 실험: 긴 구성 `(4,180초,95% vVO2max; 회복180초,50%)` 대
  짧은 구성 `(24,30초,100%; 회복30초,55%)`. 무작위 교차, 0% 트레드밀, 검사 간48시간.
- vVO2max는 검사에서 VO2max를 유발하고 적어도1분 유지한 최저 속도다. 개인화된
  준비운동을 동일하게 반복했다. 준비운동의 보편적인 분량은 제시하지 않는다.
- 긴 구성에 채혈용30초 수동 회복, 짧은 구성에도 지정 반복 후 채혈이 있다.
  30초가 명목 회복에 포함되는지/추가되는지의 제품 시퀀스 해석과 종료 회복은 미확정이다.
- 짧은 구성은 >90% VO2max 시간이 더 적었고 HR 지표는 반대 방향이었다.
  급성 비교이지 5000m 향상이나 두 방법의 부하 동등성을 입증한 연구가 아니다.

### P2

`SRC-PMID-36314990` / FT-R / Hov et al., 온라인2022-11-18, 권호2023-02.
논문: Aerobic high-intensity intervals are superior to improve VO2max compared with
sprint intervals in well-trained men, DOI `10.1111/sms.14251`.
전문: <https://onlinelibrary.wiley.com/doi/10.1111/sms.14251>
서지: <https://pubmed.ncbi.nlm.nih.gov/36314990/>
실패 경로: PubMed 직접 열기 빈 본문; 검색으로 서지 확인.
<https://pmc.ncbi.nlm.nih.gov/articles/PMC10099854/>는 browser-check.
위치: §2.1, Table 1, §2.2, §2.3.2, §2.4.1.

남성48명 모집, Table1 분석군31명(10/12/9), 평균23~24세. 유산소 훈련자이지만
전문 달리기 선수는 아니었다. 8주간 주3회 중 HIIT군은 약95% MAS에서4x4분,
각 반복3분 내 HRmax90~95% 도달을 목표로 속도를 조정했다. 사이3분은 HRmax70%
활동 회복, 마지막3분은 같은 강도의 cooldown이다. 준비10분도 약70% HRmax.
트레드밀 경사는 **약3도**이며 3%가 아니다. MAS는 산소섭취-속도 회귀로 산출해
[P1](#p1)의 vVO2max 정의와도 다르다. `@I`와 동일 모델이라고 통합하지 않는다.
여성·미성년·전문 중거리/장거리 전이와 현장 경사 변경은 검토가 필요하다.
이 연구의 주3회 빈도를 일반 계획에 이식하지 않는다.

### P3

`SRC-PMID-37776346` / FT-R / Liakou et al., 온라인2023-09-30, 권호2024-03.
논문: Recovery kinetics following sprint training: resisted versus unresisted sprints.
DOI `10.1007/s00421-023-05317-x`.
전문: <https://link.springer.com/article/10.1007/s00421-023-05317-x>
서지: <https://pubmed.ncbi.nlm.nih.gov/37776346/>
실패 경로: PubMed 직접 열기 빈 본문; 검색으로 서지 확인.
<https://pmc.ncbi.nlm.nih.gov/articles/PMC10879260/>는 browser-check.
위치: Methods / Participants and ethics statement / Exercise trials and control trial.

18~26세 남녀10명, 단거리·멀리뛰기·축구 선수, sled 및 가속훈련에 익숙한 집단이다.
한 세션은20m 3회씩2세트 **뒤에**30m 3회1세트. 반복 회복은 각각120/180초,
세트 사이는180초다. 무저항/체중10% sled/20% sled/무훈련 조건을 비교했다.
실내 동일 표면·스파이크 조건의 최대 가속달리기다. 서 있는지 걷는지의 회복 자세,
종료 회복 및 본 세션 전용 준비·정리 분량은 확인되지 않았다.
별도의 VO2 검사 준비운동을 이 세션 준비운동으로 복사하지 않는다.
단독20m 또는30m 블록의 효과를 따로 실험한 것이 아니며, 추적된 회복 반응을
모든 사람의48/72시간 회복 완료 규칙으로 만들 수 없다.

### P4

`SRC-PMID-37075554` / MA, **체계적 문헌고찰로서 원 실험이 아님**.
Rodriguez-Barbero et al., 2023-06, DOI `10.1016/j.gaitpost.2023.04.009`.
URL: <https://pubmed.ncbi.nlm.nih.gov/37075554/>
직접 열기는 빈 본문, 검색 색인에서 제목·서지·초록(9편 포함)을 확인했다.
정확한 카탈로그 행의 반복 수나 모든 인터벌의 고정 회복을 정하는 1차 실험 근거로 사용하지 않았다.

### P5

`SRC-PMID-38188222` / MA. Rogers et al., 온라인2023-12-11, 권호2024-04.
DOI `10.1016/j.jesf.2023.12.004`.
URL: <https://pubmed.ncbi.nlm.nih.gov/38188222/>
전문 시도: <https://pmc.ncbi.nlm.nih.gov/articles/PMC10765250/> (browser-check).
검색된 원 논문 초록은 여성13명, rugby sevens/netball, **사이클 에르고미터**의
10x6초와 회복60/90/120초 조건이다. 육상30m가 아니다. 이 세 회복값을
AP-SEED-02/03의 허용 슬라이더 값으로 가져오지 않는다. 전문 회복 모드·경계는 미추출이다.

### W1

`SRC-WA-SPRINT-INTRO` / 공식 URL FAIL, 원문 복제본 IDX.
Loren Seagrave, Introduction to sprinting, NSA11(2/3), 1996, pp93~113.
공식: <https://worldathletics.org/download/downloadnsa?filename=a0cae133-1056-4b89-9f93-16d87fd3bbd4.pdf&urlslug=introduction-to-sprinting>
복제본: <https://centrostudilombardia.com/wp-content/uploads/IAAF-Corsa-Velocita/1996-Introduction-to-sprinting.pdf>
둘 다 직접 열기 실패. 복제본 색인의 인쇄102쪽 §5.2는 가속15~25m와 action20~40m,
발달 단계별20m 또는30m 시작을 설명한다. 전체 `3회/30m/2~5분` 결합은 검증되지 않았다.
4.5의 **측정 코스**와5.2의 **훈련 코스**를 섞지 않는다. 오래된 코칭 모형이며,
색인에 있는 생리·호흡 설명을 검증된 현대 과학이나 선수 지시로 채택하지 않는다.
그림과 본문 대조, 출처 복제 동일성 및 회복 원문 확인이 남는다.

### W2

`SRC-WA-SPRINT-RT` / 직접 FAIL, 색인 MA(제목·서두만 확보).
URL: <https://worldathletics.org/download/downloadnsa?filename=f5f00a69-bc4e-46c7-af53-e356d5b9630b.pdf&urlslug=nsa-round-table-no-3-sprints>
직접 접근 오류. 제목/서두 색인 외에 `1~2x300~600m` 또는 `4x30m+4x50m`의
해당 페이지·필자·정확한 회복을 확보하지 못했다. 발행연도도 미확정이다.
관련어300/600/50 및 정확한 URL slug로 추가 검색했으나 이번 한정 검색에서
두 행의 결합 처방을 찾지 못했다. 출처 부재의 증명은 아니다.

### W3

`SRC-WA-DECATHLON` / IDX, 직접403.
Hart & Huffins, The development and training of decathletes in the USA,
NSA18(4), 2003, pp31~36; 2002 코칭 세미나 발표를 바탕으로 한 코치 인터뷰.
URL: <https://worldathletics.org/download/downloadnsa?filename=ac054a49-c021-4864-a46b-5a33fb94b144.pdf&urlslug=the-development-and-training-of-decathletes-i>
인쇄35쪽 Ed Miller / Spring의 두 예시가 GL-SEED-03/04와 일치하는 색인 본문을 확인했다.
미국 대학 중심10종 코칭 맥락이며 중거리·일반 장거리 실험이 아니다.
GL03의 target 및 회복 자세, GL04의 % 기준과 full recovery 시간은 해당 추출에 없다.
원본 PDF의 페이지 이미지 확인은 미완이다.

### W4

`SRC-WA-SPRINTS` / IDX, 직접 접근 오류.
The Sprints, NSA1/2009, 인쇄16쪽 Sample training week.
URL: <https://worldathletics.org/download/downloadnsa?filename=f411d6b2-f0be-456f-b969-28abad2159ce.pdf&urlslug=the-sprints>
색인 본문은 Gambetta et al.(1989)을 인용한 고교 단거리 선수 특수준비기 예시다
(100m10.7~11.0초, 200m22.6~23.0초). 목요일 `5 x 4 bounds plus acceleration to 30m`를 확인.
5회/회당4바운드는 있으나30m가 바운드 이후 추가거리인지 전체 종점인지는 그림/원전 대조가
필요하다. `150m + 바운드 거리`를 확정 총량으로 계산하지 않는다.
코칭 편집자료의 재인용이며 원 실험 증거가 아니다. 회복량·기술·접촉 정의·실행 표면은 남는다.

### W5

`SRC-WA-1500` / IDX, 직접 접근 오류가 재시도에도 반복.
George Mallett, The benefits and limits of speed training for endurance runners,
2022-08-27.
URL: <https://worldathletics.org/personal-best/performance/speed-training-endurance-runners-benefits-limits>
위치: Two typical1500m sessions, Two typical10,000m sessions.

공식 URL 색인 본문에서 GL01의3~4회500m/목표1500m/2~3분,
GL02의3세트(800+200+200)/사이90초/세트3분을 확인했다. GL02의 구간별 pace와
회복 자세는 없다. 추가 장거리 예시는 §5의 LD-2/3에 보존한다.
수개월에 걸쳐 준비한 사람의 예시이며 입문 세션이 아니라는 제한이 명시되어 있다.
GOAL을 CURRENT로 바꾸는 것은 원문의 사실이 아니라 운영 변경이다.

### W6

`SRC-WA-MEDICAL` / FAIL.
URL: <https://worldathletics.org/download/download?filename=3f74b21a-2a83-4f92-9a30-759603533e5d.pdf&urlslug=Medical+Manual+%28complete%29>
직접 접근 오류. 판본·페이지·원문 준비운동 분량을 이번에 확인하지 못했다.
카탈로그의15~30분을 검증된 본문 값이라고 보고하지 않는다. Medical이라는 제목도
AP01 또는 어느 훈련의 안전 보증이 아니다.

### N1

신규 재확인 / FT-C. Peter J. L. Thompson, How do I use it?, 발행일 미표기.
URL: <https://www.newintervaltraining.com/how-do-i-use-it.php>
위치: Starting out / Step4 / less experienced athletes / Looking at Pace.

기존12x400m(5000리듬)/100m roll-on과 세트·세션 끝 roll-on 규칙을 재확인했다.
회복시간은 관찰 예시이지 고정 초 환산이 아니다. 젊거나 덜 숙련된 선수 설명의
3세트x2회x300m(3000리듬),100m roll-on,세트 사이2분 easy에서
2세트x3회로 옮기는 순서 예시도 있다. 운동 총량을 유지해도 회복 구조는 달라진다.
저자의 코칭 주장이지 독립 효과 비교시험이 아니다. 12회와 별도 IAAF15회 예시는 섞지 않는다.
이번에는 IAAF 대용량 PDF2종을 재검수하지 않았으므로 과거 PDF 접근 한계를 해소했다고
보고하지 않는다.

### N2

추가 원 실험 / FT-R. Crowther et al., 2017-12-28.
Influence of recovery strategies upon performance and perceptions following fatiguing
exercise: a randomized controlled trial, DOI `10.1186/s13102-017-0087-8`.
URL: <https://link.springer.com/article/10.1186/s13102-017-0087-8>
위치: Methods / recovery protocols, Results / Discussion.

비엘리트 남성34명(평균27세), 모의 팀스포츠 운동 뒤 회복 조건을 교차 비교했다.
모든 조건 전10분 휴식 및5분 peak sprint speed20% jog가 있었고, ACT는14분
grass jog35% peak speed, CONT는14분 앉은 휴식이었다. 이는20~30분 회복주,
walk-only 또는 mobility-only 실험이 아니다. 24/48시간에는 대조군보다 우수한
회복 방법을 확인하지 못했다. 모의 운동과 비엘리트 남성 표본의 한계를 보존한다.
이 논문을 근거로 단거리 테스트 속도에서 회복주 페이스를 생성하지 않는다.

### 제품 출처 및 제한 검색

`SRC-PRODUCT-RECOVERY-SUPPORT-001`은
[카탈로그 §9](../../specs/reconstruct/ENERGY_SYSTEM_SESSION_TEMPLATE_CATALOG.md#9-recovery_intent-support-axis)의
로컬 PRODUCT 상태다. 외부 URL 또는 실험 표본이 없다.

LT05 보완을 위해 `6 x 6`, `6 × 6`, threshold 및 원저자 사이트를 검색했다.
<https://www.mariusbakken.com/the-norwegian-model.html>은 초기 open에 본문이 반환됐으나
후속 찾기는 오류였다. 정확한6x6분/2분 회복의 위치·전체 맥락을 추출하지 못했으므로
**검증 원문 수나 LT05 수치 근거에 포함하지 않는다**. 숫자가 비슷한6x60% Tmax 연구를
6x6분 역치 훈련으로 잘못 연결하지 않았다.

REC03 보완 검색에서
<https://pmc.ncbi.nlm.nih.gov/articles/PMC8391672/>의 원 연구 초록 색인은 남성 러너8명의
**운동 전** stretching 비교였고, <https://pmc.ncbi.nlm.nih.gov/articles/PMC7247177/>는
여성 러너의 **ITBS 재활** 연구였다. 전문 전사를 진행하지 않고 목적 불일치로 제외했다.
따라서 generic mobility 지원에 동작·반복 수를 가져오지 않는다. 검색은 체계적 문헌고찰이
아니며 적합한 연구가 세상에 없다는 결론도 아니다.

## 4. 전체30행 대조표

표기법은 실제 카탈로그 `notationPattern`을 보존했다. `@0.1`은29개 초안의 버전이며
현행 한 행만`@1.0.0`이다. **확인된 사실**과 **추가 결정/추출 필드**는 서로 다른 열이다.

공통으로 모든 신규 실행 구성에는 다음이 필요하다: 정확한 event/intent/experience/cycle
적용범위, anchor 정의·유효성·단위, warmup/cooldown, fallback/stop, 반복·세트·전환·종료 회복의
명시적 구조, 실제 검토자 및 채택 기록. 원문에 없는 값은 `UNSPECIFIED`로 보존하며
`NONE` 또는0으로 바꾸지 않는다. 이 공통 사항 외에 행마다 해결할 구체적 필드는 아래와 같다.

| 실제 ID/버전 | 카탈로그 표기 | 이번 근거 및 정확히 진전된 내용 | 남은 행별 필드/판단 |
|---|---|---|---|
| BA-SEED-01@0.1 | `30~45′ @E` | [D1](#d1) FT-C, 직접 예시 일치 | `durationSeconds` 단일값·선택 조건; E 모델/effort 문구; 종료/준비 경계 |
| BA-SEED-02@0.1 | `20~30′ @E` | [D1](#d1) FT-C는 범주만; [P1](#p1)의 검사 사이 easy≤30분은 다른 맥락 | 20분 하한 근거, walk 전환 조건·분량; 검사 사이 활동을 회복주 근거로 전용 금지 |
| BA-SEED-03@0.1 | `45~60′ @E` | [D1](#d1) FT-C,45~60분 전체 직접 예시 없음 | 60분 선택 근거·현재 주간거리/최근 지속주 맥락·상한; 단순 시간 확대 승인 없음 |
| BA-SEED-04@0.1 | `long easy @E · duration unresolved` | [D4](#d4) FT-C의120분은 표시 선호 사례 | 정확한 지속시간, 장거리 경험·주간량 조건, 준비/정리. REJECTED 유지 |
| BA-SEED-05@0.1 | `3×10′ @E · r1′ walk/jog` | PRODUCT; [D1](#d1)에 이 분할 구성 없음 | WALK/JOG 중 모드, 마지막1분 유무, 세트 축소 근거. 표기 읽기와 기존 합계120초 경계 대조 필요 |
| LT-SEED-01@0.1 | `20′ @T` | [D2](#d2) FT-C, 지속 구성 일치 | 개인 T 입력/모델; 짧게 바꾸는 정확한 값;20분초과는 같은 T 연장이 아님 |
| LT-SEED-02@0.1 | `3×1600m @T · r1~2′` | [D2](#d2)는 시간범위, [D4](#d4)는3x1mi/2km 표시 예시 | 1600m 선택은 변형; T에서 반복5~15분 적합성; 회복 모드·정확한 초; 최종 경계 |
| LT-SEED-03@0.1 | `4×1600m @T · r1′` | [D3](#d3) FT-C 원문은4x1mi, 거리 불일치 발견 | 1600m 운영 변경을 명시; 반복 축소 승인·회복 모드; 원문30분/주간량 조언과 개인 사례 충돌 검토 |
| LT-SEED-04@0.1 | `3×7′ @T · r1~2′` | [D4](#d4)에3x7분 존재, [D2](#d2)에 회복 범위 | 서로 다른 안내의 합성 승인;60/120초 선택·모드; 더 짧은 반복의 출처·총량 |
| LT-SEED-05@0.1 | `6×6′ @T · r2′` | [D2](#d2)는 이 전체 고용량을 확인하지 않음; 추가검색에도 exact 미추출 |6회/6분/2분을 함께 지지하는 원문·대상·주간량; REJECTED 유지, 존재 부정은 아님 |
| V2-SEED-01@0.1 | `6×2′ @I · r1′ jog` | [D1](#d1) FT-C, 직접 예시 일치 | I target model/input;5000m 적용·주기 위치; 종료 회복 및 준비/정리;5회로 감소하는 근거 없음 |
| V2-SEED-02@0.1 | `5×3′ @I · r2′ jog` | [D1](#d1) FT-C, 직접 예시 일치;5000 우선 검토 | 현행 CURRENT5000m→I 연결은 미승인·미검증; 동일 목적 전이; 고정 bundle 채택/종료 경계 |
| V2-SEED-03@0.1 | `4×4′ @I · r3′ jog` | [D1](#d1) FT-C와 [P2](#p2) FT-R을 분리 | 논문 약95%MAS/HR 목표·경사와 @I 차이; 논문cooldown3분을 JOG 종료 회복으로 혼합 금지 |
| V2-SEED-04@0.1 | `4×3′ @95% vVO2max · r3′ easy` | [P1](#p1) FT-R, 운동·회복50% 및 모집단 확인 | 검사 정의/입력 유효성, 채혈30초 경계, 최종 회복, 현장·5000m 전이. 원문 확보만으로 REJECTED 자동해제 금지 |
| V2-SEED-05@1.0.0 | `5×1000m @5K RP · r2′30″` | 로컬 기존 채택, [D1](#d1)은 일반 지침 | 신규 scalar/회복 조정 근거 없음;5→4회 자동 허용 안 함. 현재 고정 채택 유지 |
| GL-SEED-01@0.1 | `3~4×500m @GOAL 1500m RP · r2~3′` | [W5](#w5) IDX, 수치와GOAL 확인 | 직접 본문 확보;3/4회·120/180초 결합 조건;회복 모드;GOAL/current 차이. MD1500 기존채택과 별개 |
| GL-SEED-02@0.1 | `3×(800m+200m+200m) · r90″ · R3′` | [W5](#w5) IDX, 순서와2단계 회복 확인 |800/200/200 각각 target, 회복 자세, 종료 회복;마지막200m 제거의 목적 보존·원문 근거 없음 |
| GL-SEED-03@0.1 | `2~3×(250m+100m) · r30″ · R4~8′` | [W3](#w3) IDX, Ed Miller 봄10종 예시 특정 | 두 운동target·회복 자세;2/3세트와240~480초 선택 조건;중거리 전이·PDF검수 |
| GL-SEED-04@0.1 | `150m-200m-300m @90~100% · full recovery` | [W3](#w3) IDX, 동일 봄 예시 특정 | `%reference`·속도/기록시간 구분, full recovery 양/판정, 최장반복 제거 근거·PDF검수 |
| GL-SEED-05@0.1 | `1~2×300~600m · long full recovery` | [W2](#w2) MA/FAIL, exact 미확보 | 출처페이지,반복·거리·target·회복 전부 정확화;REJECTED 유지 |
| AP-SEED-01@0.1 | `3×(15~25m acceleration + 30m max velocity) · r2~5′` | [W1](#w1) IDX, 측정/훈련 코스 구분 발견;[W6](#w6)FAIL |3회·2~5분 결합근거;연속 가속→최고속인지 분리반복인지;action30m의 경험조건·감속구간 |
| AP-SEED-02@0.1 | `2×(3×20m) · r2′` | [P3](#p3) FT-R, 원 세션 부분, 세트180초 확인 | 독립 훈련으로 분리한 전이;회복 자세·terminal·스프린트 준비;무저항 한정 여부 명시 |
| AP-SEED-03@0.1 | `3×30m · r3′` | [P3](#p3) FT-R, 원 세션의 마지막 블록 | 앞20m 블록 없이 시행하는 효과/맥락;회복 자세;완전회복 보장 표현 제거 검토 |
| AP-SEED-04@0.1 | `4×30m + 4×50m · r2~3′ full recovery` | [W2](#w2) MA/FAIL, 혼합구성 미확인 | 정확한 source·목표·30→50m전환 회복;4/4회 및2~3분 결합근거;50m삭제의 분류 변화 |
| AP-SEED-05@0.1 | `5×(4 bounds + 30m acceleration)` | [W4](#w4) IDX, 목요일 고교 단거리 예시 확인 |30m종점 의미, 바운드당 contact 정의,순서·회복·표면;1989원전/그림 대조;바운드삭제는 기술 변경 |
| RE-SUPPORT-01@0.1 | `REST` | PRODUCT;[N2](#n2)의14분앉기는 REST-day와 다름 |무훈련 상태의 계획 연결/사용자 선택·검토 정책;회복완료 수치 생성 금지 |
| RE-SUPPORT-02@0.1 | `20~30′ very easy` | [D1](#d1)은 범주;[N2](#n2)는14분의 다른 개입 |20~30분·very easy의 구체 입력/문구·전환정책;14분연구로 변경/정당화 금지 |
| RE-SUPPORT-03@0.1 | `mobility-only` | PRODUCT;보완검색의warmup/재활연구는 목적불일치 |정확한 비재활 동작명·순서·시간/횟수·범위·중단·담당자 검수;무수치 상태 유지 |
| RE-SUPPORT-04@0.1 | `walk only` | PRODUCT;[N2](#n2)의ACT는 걷기가 아닌jog |지속시간·걷기강도·전환조건·안전한 종료;walk 처방 원문 미확보 |
| RE-SUPPORT-05@0.1 | `REVIEW_REQUIRED` | PRODUCT인 대기상태, 운동이 아님 |담당 검토 경로·취소/유지 의미;차단된 기존 계획을 실행하라는 의미로 사용 금지;대체운동 생성 금지 |

표의 접근상태는 **이번 연구의 별도 관측**이다. 기존 카탈로그의 sourceVerificationStatus,
visibility, lifecycle, eligibility, parser state를 수정하지 않는다. 특히 LT03의 DIRECT 라벨과
실제1mi 차이는 후속 정정 후보로 보고할 뿐 이 파일에서 원본을 조용히 고치지 않는다.
기존 age-neutral 훈련 기준 및 보호자 개인정보 처리 경계를 그대로 유지한다.
연구 표본에 청소년이 없다고 기존 전체 청소년 사용을 차단하거나 성별 자동 용량을 만들지 않는다.

## 5. 구체적인 두 번째 방법 후보

아래 로컬 검토 별칭은 새 templateId가 아니다. 우선순위는 **근거 정리 순서**이며
선수에게 가장 좋다는 추천 순위가 아니다. 시간·거리·target·recovery 구조 변화로
방법을 구분하며 횟수만 다른 형제 항목으로 방법 수를 늘리지 않는다.

| 순서/범위 | 검토할 구성 | 실제 구조 차이와 근거 | 활성화 전 정확히 남는 것 |
|---|---|---|---|
| 5K-1,5000/VO2 | V2-SEED-02 고정 구성 | 현행1000m에서 시간 단위로 전환, 회복량 변경;[D1](#d1) | I입력/모델 및5000 적용 검토. 현재 기록 평균속도를 I로 이름만 바꾸면 실패 |
| 5K-2,5000/VO2 | V2-SEED-04의[P1](#p1) 긴 구성 | 시간 반복+측정속도 기반 운동/회복;원 실험 있음 |400/800→5000전이,검사법·채혈 경계·부품·후속 채택. 실험자료가 있어도 더 빠른 출시 후보라는 뜻 아님 |
| 5K-3,목적보류 |12x400m,5000리듬,100m roll-on | 거리·회복모드·종료회복 변화;[N1](#n1) | VO2동일 목적인지 별도 mixed/rhythm인지 사람판단;리듬→숫자 모델·주기/경험·12회용량 |
| MD-1,1500 | GL-SEED-02의 ordered800/200/200 | 현행3x500m과 운동순서·세트회복이 다름;[W5](#w5)IDX | 세 구간target과원문직접확인. 200m를 임의로800RP로 채우지 않음 |
| MD-2,3000/VO2 | V2-SEED-02 고정 구성 | 현행4x800m에서 시간 단위 I로 변경;[D1](#d1) |3000범위 I모델·회복·경험 적합성. 5K의 대상 결정을 복사하지 않음 |
| MD-3,800 |2x400m F,회복4분jog라는 원문 부분블록 | 현행10x200m/60초STAND와 work/recovery가 다름;[D1](#d1) Fast Reps sample | 이것은 더 긴 혼합 세션의 발췌다. 독립2회 훈련으로 채택할 전이, F입력·90초상한·종료경계 검토 |
| LD-1,LT | LT01지속 vs LT03분할 | 연속/반복과회복의 차이;[D2](#d2),[D3](#d3) | 대상10K/HM/마라톤 구분,T입력,1mi→1600m변형·주간량. 3회vs4회만 새방법으로 계산 안 함 |
| LD-2,10000 |8x1000m,GOAL10000m,회복120초 |[W5](#w5)IDX에 명시된 고정 예시,8000m운동 |10000범위 신규채택,GOAL/current구분,회복모드·terminal·직접원문·대상 |
| LD-3,10000 |1600/1200/800/800/1200/1600m,회복2~3분 |[W5](#w5)IDX,긴 구간은GOAL보다 약간 느리게/짧은 구간은약간 빠르게 |7200m순서는 구체적이나 '약간'의 수치모델 없음;임의 ±% 금지. 회복모드/값·직접원문 |

MD800의 발췌를 전체 source workout으로 오해하지 않도록 보존할 맥락: [D1](#d1)의
전체 예시는600m R/5분jog,2x400m F/4분jog,600m F/5분jog,2x300m F/3분jog,
4x200m R/200m jog를 섞는다. R/F를 한800m 페이스로 통합하거나 발췌의 나머지
운동을 자동 추가하지 않는다. 원문은 elite의 긴F구간도 별도 맥락으로 설명한다.

BASE의30분/45분/60분은 시간만 달라진 같은 지속 방법이다. BA05는 분할 구조가 다르지만
제품 변형의 근거가 미완이다. REC상태는 MAIN 다양성 집계에서 제외한다.

## 6. 유한 구성 및 조정 준비

아래는 **연구용 허용값 후보 집합**이지 실행 allowlist가 아니다. 전부
`default=null`, `runtimeAllowed=false`, `automaticAdjustment=false`다.
`work`, `target`, `recovery` 등의 필드명은 검토용 의미 경로이며 현재 API나 schema 계약을
새로 선언하지 않는다. step이 없는 범위는 임의 step을 만들지 않았다.

| 후보 | 정확한 필드/단위 및 유한 값 | 결합 조건·방향·부하 차원 | 근거와 미완 조건 |
|---|---|---|---|
| C-I | `(reps,workSeconds,recoverySeconds)` = `{(6,120,60),(5,180,120),(4,240,180)}` |target=I,mode=JOG를 묶음으로 유지. 전체preset선택만 검토;세 축 독립 슬라이더 금지. 운동시간·밀도 변화 |[D1](#d1) 직접3예시;더 쉬운 순서의 증거 아님. 종료회복·I입력·적용범위 결정 전 실행불가 |
| C-LT-TIME | `(workSeconds,targetOffsetSecondsPerKm)` 후보 `{(2400,6),(2400,12),(3600,12),(3600,20)}` |[D3](#d3)40/60분별 범위 끝값만 검토용 추출. T보다 **느린** 쪽 offset;1초step·중간값·20분동일강도연장 권한 없음 | 원문 범위를4개 운영preset으로 이산화하는 판단은 별도. 자동20→40분 증량 없음;개인T·주간량·정확한 선택 조건 미정 |
| C-LT-BREAK | LT04고정3x420초에`recoverySeconds∈{60,120}` |[D4](#d4)의운동과[D2](#d2)의범위끝값 결합. 모드미정. 회복변경은밀도변경,방향별안전성 미입증 | 이 결합을 연구자가 운영 후보로 제안한 것;동일 논문실험 아님. T5~15분 맥락·terminal·선택조건 검토 |
| C-GL500 | `(reps,recoverySeconds)∈{(3,120),(3,180),(4,120),(4,180)}`;work500m,GOAL1500 |[W5](#w5)범위끝값의 후보곱집합. 실제모든 조합이 권장된다는 뜻 아님;회복모드·용량/밀도결합 조건 미정 |IDX이므로 직접원문 먼저. 기존MD1500의3/180/CURRENT/STAND와 동일 승인으로 취급 금지 |
| C-AP-SET | 원 복합세션의`setRecoverySeconds={180}` |[P3](#p3)에서 비어 있던 값 채움.20m블록2개→30m블록1개 순서 유지;자유조정 아님 | 독립AP02의세트회복에 전이하려면 분리한세션 채택 필요;자세·terminal·준비미정 |
| C-NIT-GROUP | `(sets,repsPerSet)∈{(3,2),(2,3)}`;work300m,3000리듬,100mroll-on |[N1](#n1)의 덜숙련된선수 도입 구조 이동. 세트말roll-on 유지;후자에도2분easy를 유지하는 것은 운영 가정 | 원문이 progression 방향을 설명하지만 날짜/정량진입조건은 없음. 후자의세트휴식확정·범위검토 전 잠금 |

구성 변경 때 다시 판정할 공통 입력: 세션 목적·대상 종목·훈련경험·현재 능력
anchor·주기 단계·최근 구조화 훈련 맥락·사용자의 명시 선택. 논문48시간 또는
주3회를 이 공통 조건의 기본값으로 만들지 않는다. 원문에 없는 횟수감소비율,
페이스계수, 회복점수, `full recovery=180초` 같은 전역 상수를 만들지 않는다.

유한값을 제안하지 않는 항목도 명확하다. BA02/03/04/05,LT05,GL04/05,AP04/05,
REC03/04는 필요한 출처 또는 운동/강도/회복 정의가 부족하다. GL03의4~8분은 범위로
보존하고 중간 step/기본값을 생성하지 않는다. [P5](#p5)의60/90/120초는 사이클 조건이므로
달리기 후보에 넣지 않는다. 현행V2/MD4개의 반복축소·회복증감은 이번에 새로 승인하지 않는다.

## 7. 검증 가능한 예시와 반례

모두 합성 입력 또는 출처 구조의 산수다. 실제 선수 기록을 읽지 않았고 개인 데이터도
전송하지 않았다. 아래 조건부 합계는 누락 필드를 승인하는 수단이 아니다.

| 검사 | 입력/조건 | 기대값 및 반드시 거부할 반례 |
|---|---|---|
| E01 | C-I의3묶음,**종료회복 없음으로 별도 채택된다고 가정** |운동초`[720,900,960]`,반복사이회복초`[300,480,540]`. 종료미정이면 전체회복 확정은 보류;회복을N회로 자동 계산 금지 |
| E02 | LT03 원문1mi를 국제mile1609.344m로 단위 계산 |4mi=6437.376m,카탈로그6400m와37.376m차이. '정확히 동일' 실패. 단위변환만으로 운영상1600m선택이 자동승인되지 않음 |
| E03 |[P1](#p1)검사기반속도를 합성값`5m/s`로 입력 |긴구성 운동4.75m/s,회복2.5m/s. 이 계산은계수산수이며5K기록으로vVO2max추론 금지. 채혈경계미정이라전체elapsed 미확정 |
| E04 |[P3](#p3)복합운동의 반복사이·세트사이만 합산 |운동210m;20m회복4회x120초+30m회복2회x180초+세트회복2회x180초=1200초. 추가terminal은미정;AP02만의독립효과 주장 실패 |
| E05 |12x400/100mroll-on 및 명시된 마지막roll-on |운동4800m,반복사이1100m+종료100m=회복1200m. 회복1200초로변환하거나종료100m삭제하면실패 |
| E06 | GL02,terminal없음이라는**조건부 로컬 구조** |운동3600m,세트내6x90초+세트사이2x180초=900초.모드·target미정인상태에서eligible=true면실패 |
| E07 | C-LT-TIME,합성T=240초/km,40분/offset6후보 |246초/km. 더느리게는초/km를더함;234초/km면부호오류.합성T를사용자측정역치로저장하면실패 |
| E08 | C-NIT-GROUP,후자도세트휴식120초유지한다는**운영 가정** |둘다운동1800m/roll-on600m.세트간easy는240→120초.운동량같음이부하같음/동일시퀀스임을뜻하지않음 |
| E09 |[P2](#p2)의3도경사 및마지막3분cooldown |3도를3%로라벨변환하면실패.4x4사이540초와cooldown180초를각각보존;일반I예시에자동복사금지 |
| E10 | RE-SUPPORT-05 + D9차단/불명 |새운동·수치회복·안전해제 없음. REST14분연구로승인하거나기존차단계획실행을허용하면실패 |

E01/E06/E08의 조건부 가정은 원문이 명시하지 않은 부분을 드러내기 위한 테스트 설계다.
가정을 실제로 채택했다는 뜻이 아니다. 운동거리·운동시간·회복거리·회복시간을 나눠 저장해야
하며 unknown은0이 아니다. 표의 반례는 후속 구현의 acceptance case이고 앱 테스트 실행
결과가 아니다. 문서 대조 및 순수 산수 실행 결과는 §9에서 별도 보고한다.

## 8. 남은 사람의 판단과 다음 근거 작업

| 순서 | 담당 역할 | 정확히 결정/확인할 내용 | 완료 증거 |
|---|---|---|---|
| H1 | 원문 검토자/스프린트 코치 | W1~W6 직접원문·PDF쪽 검수, W2두표기 원문위치, LT05결합구성 탐색. AP05의30m경계 해석 | 판본/쪽/그림·접근결과·정확한필드 전사;없으면없는필드 유지 |
| H2 | 스포츠과학 검토자 + 종목코치 |5K-1의동일목적 적합성,5K-3의VO2/mixed분류;P1의400/800집단 전이,P2비전문성인남성 전이,P3블록독립화 | 실제검토자·자격/권한·날짜·대상·한계·동의/거절 근거. AI가서명생성 금지 |
| H3 | 모델/단위 검토자 + 오너 |I/T/F/R 입력 정의·공식/계수버전·current/goal 표시;MAS와vVO2max구분;원문percent reference | 출처있는모델 및 독립숫자검산;범위밖·누락·오래된입력 반례 |
| H4 | 제품오너/담당코치 |C후보중정확한bundle,기본값·방향·결합조건·적용context;1mi→1600m 및MD800발췌 채택여부 | 정확한구성별명시결정. 전체준비승인을이값승인으로확대하지않음 |
| H5 | 실험원문 검토자/담당코치 |P1채혈30초 포함/추가,terminal;P3회복자세;NIT세트후휴식과끝roll-on;준비/정리·fallback/stop | 누락은미정으로보존하고운영상변경을별도명시한완전한ordered tree |
| H6 | 지원정책 책임자/적격검토자 |REST/hold는상태로,walk/mobility는동작·시간·범위·중단이정해진비재활지원으로정의 | 지원상태계약;훈련차단을우회하지않는승인·취소흐름 |
| H7 | 후속 구현/검증 담당 | 채택된경우에만ID/version/content·component fingerprint·권한·eligibility·추천·MAIN슬롯·저장/재로드/복원/시작 취소경합 연결 | 실제테스트·적대사례·브라우저증거;이번문헌보고서는대체불가 |

우선 인계는5K-1의 I 목표 모델 및 H2/H4/H5 검토 패킷이다. 그것이 진행되는 동안
MD ordered 구간과 LT지속/분할 비교 준비를 병행할 수 있다. 조사된 논문을 근거로 사용자를
실험실 검사·채혈·새로운 개인정보 수집으로 자동 유도하지 않는다. 논문상의 윤리승인은 해당
연구의 승인이지 TrainOracle 데이터 처리 동의가 아니다. 기능 전체를 다시 승인받을 필요는
없지만, 위 구체값·대상·권한 판단은 여전히 실제 사람이 남겨야 한다.

## 9. 로컬 검증 및 보존 기록

작성 전 대상 새 파일은 존재하지 않았다. 시작시 유일한 untracked 항목은
`reports/review/SESSION_METHOD_POST_IMPLEMENTATION_REVIEW_2026-09-05.md`였으며 소유하지
않는 기존 작업으로 보존했다. 체크포인트에서 읽은 문서들의 SHA256:

| 파일 | SHA256 |
|---|---|
| AGENTS.md | `e2740ba9f893a096e9b17fac57a0071cab24e1baa4e14fdc38cdfb4ead1abb5b` |
| PRODUCT_NORTH_STAR.md | `b9e77ab3588b16e71004871e415908d43f5c44aa452ea3c14cea174a1e3f5673` |
| 2026-09-05 카탈로그 준비 보고서 | `253818c92cd82d6a0c78f041392eee264f7e4e716af59098f3f105ac549130f8` |
| 실제 카탈로그 | `c6c4e4be6681a545a4ad5390b5129653be025fc9cd02669f2c5e92ee449412f8` |
| 기존 untracked 검토 보고서 | `880ee6896de27512d5c4f3c489a10704892563e669d18bba42ef7f8f87710950` |

조사 작업자는 마지막 검증을 완료하기 전에 모델 용량 오류로 종료됐다. 따라서 위 원문별
관측은 조사 초안의 전사 기록이며, 통합 검증자가 모든 원문을 다시 읽었다는 뜻이 아니다.
통합 담당자는 D1과 D3 공식 본문을 별도로 열어 I 예시 세 구성과 1 mile 불일치를 재확인했다.
카탈로그 LT03의 출처 등급 정정은 별도 통합 변경으로 이루어졌으며, 본 조사에 새 훈련
활성화 권한을 추가하지 않았다.

통합 담당자의 실제 Node assert 실행(2026-09-06):

- 실제 카탈로그 ID와 대조한 표: 30행 / 고유 ID 30개 / 누락 0개.
- 문서 내 로컬 파일 링크: 7개 모두 존재.
- E01/E02/E04/E05/E06/E07에 해당하는 순수 산수 단언: 8개 PASS.
- E03/E08/E09/E10은 이 검사에서 실행하지 않았다. 표의 설계 반례는 앱 실행 증거가 아니다.
- 새로운 숫자 처방·매니페스트 승인·실사용자 데이터 접근은 없음.

[DRAFT_COMPLETE]
