# 객관적 피로 근거 정규화 검토

```yaml
status: RESEARCH_BOUNDARY_FOR_IMPLEMENTATION
reviewed_at: 2026-08-03
runtime_authority: false
universal_fatigue_score: forbidden
plan_authority: false
safety_authority: false
```

## 결론부터

거리, 페이스, 반복 수, 회복 시간, 근력 부하와 점프 접촉 수는 같은 종류의 숫자가 아니다.
TrainOracle은 이 자료를 한 점수로 섞지 않는다. 같은 선수의 현재 기준을 같은 종목·운동·
측정법으로 비교할 수 있을 때만 `정규화된 비교`를 만들고, 나머지는 원자료 또는 설명용
계산으로 남긴다.

객관적 부하는 선수가 느낀 피로를 대신하지 않는다. 두 자료는 나란히 보되 서로의 빈칸을
추정해서 채우지 않는다.

## 근거에서 확인된 것

1. 국제 합의문은 내적 부하와 외적 부하를 여러 방법으로 함께 관찰하는 틀을 제안한다.
   하나의 측정법이 모든 목적에 가장 좋다고 보지 않는다.
2. 내적·외적 부하의 관련성은 훈련 방식에 따라 달라진다. 팀스포츠 메타분석에서도 관계의
   크기와 불확실성이 측정법과 훈련 모드에 의존했다. 따라서 달리기 거리, 심박, 충격,
   RPE를 같은 단위처럼 더할 수 없다.
3. 근력운동의 반복 속도 감소는 특정 운동·세트 안에서 신경근·대사 피로와 관련될 수 있다.
   그러나 이 수치를 달리기 거리나 플라이오 접촉 수와 합치는 근거는 아니다.
4. 같은 외적 부하 지표도 개인 안 변동성과 훈련 형식의 영향을 받는다. 개인 기준과 같은
   측정 맥락을 보존해야 한다.
5. 플라이오 접촉 수는 훈련량의 일부이지만, 접촉 수가 많을수록 효과나 피로가 선형으로
   증가한다고 볼 수 없다. 운동 종류와 강도를 함께 보존해야 한다.
6. 급성:만성 부하비(ACWR)는 부상 원인이나 안전 처방 규칙으로 쓰지 않는다. 비율 자체의
   통계적 문제와 인과 근거 부족 때문에 실무 처방에 부적절할 수 있다는 비판이 있다.

## 허용하는 계산

| 자료 | 계산 | 허용 범위 |
| --- | --- | --- |
| 달리기 페이스 | `현재 같은 종목 기준 초/km ÷ 실제 초/km × 100` | 같은 선수·같은 종목·같은 측정법·CURRENT 기준 |
| 달리기 거리 | `실제 거리 ÷ 현재 평소 거리 × 100` | 같은 선수·같은 세션 유형·같은 측정법 |
| 인터벌 밀도 | `운동 시간 ÷ (운동 + 회복 시간) × 100` | 해당 세션 설명만 가능 |
| 플라이오 접촉 | `실제 접촉 ÷ 현재 평소 접촉 × 100` | 같은 선수·같은 운동·같은 집계법 |
| 근력 반복량 | `세트 × 반복` | 횟수 설명만 가능; 강도나 피로 점수 아님 |
| 근력 속도 감소 | `(첫 반복 속도 - 마지막 반복 속도) ÷ 첫 반복 속도 × 100` | 같은 세트 안에서만 정규화 |
| 대체 유산소 심박 | 측정된 `%HRmax` | 해당 운동 설명만 가능 |

## 반드시 보류하는 경우

- 기준이 없거나 `STALE`, `UNKNOWN`인 경우
- 목표 기록만 있고 현재 수행 기준이 없는 경우
- 기준 종목, 운동 종류, 선수 또는 측정법이 다른 경우
- 기기·알고리즘이 바뀌었지만 연결 검증이 없는 경우
- 분모가 0이거나 물리적으로 성립하지 않는 값인 경우

보류는 `0`이 아니다. 화면에는 숫자를 만들지 않고 왜 비교할 수 없는지를 알려야 한다.

## 제품 금지선

- 서로 다른 계열을 합친 보편 객관 피로 점수
- 객관 자료로 누락된 RPE 추정
- ACWR 안전 구간, 부상 예측, 운동 허가
- 목표 기록을 현재 능력으로 해석
- 다른 종목 페이스의 임의 환산
- 접촉 수만으로 플라이오 강도 추정
- 위 계산으로 다음 훈련이나 활성 계획 자동 변경

## 1차 출처와 직접 검토 자료

- Bourdon PC 외, *Monitoring Athlete Training Loads: Consensus Statement* (2017),
  PMID 28463642: https://pubmed.ncbi.nlm.nih.gov/28463642/
- McLaren SJ 외, *The Relationships Between Internal and External Measures of Training Load and
  Intensity in Team Sports: A Meta-Analysis* (2018), PMID 29288436:
  https://pubmed.ncbi.nlm.nih.gov/29288436/
- Sánchez-Medina L, González-Badillo JJ, *Velocity loss as an indicator of neuromuscular fatigue
  during resistance training* (2011), PMID 21311352:
  https://pubmed.ncbi.nlm.nih.gov/21311352/
- Clubb J 외, *Measurement properties of external training load variables during standardised
  games in soccer* (2022), PMID 35061784: https://pubmed.ncbi.nlm.nih.gov/35061784/
- Makaruk H 외, *Effects of Plyometric Training Volume on Physical Performance in Youth
  Basketball Players* (2024), PMID 38900173: https://pubmed.ncbi.nlm.nih.gov/38900173/
- Impellizzeri FM 외, *Acute:Chronic Workload Ratio: Conceptual Issues and Fundamental Pitfalls*
  (2020), PMID 32502973: https://pubmed.ncbi.nlm.nih.gov/32502973/

## 적용 상태

`app/src/domain/objective-fatigue-evidence.ts`는 위 허용·보류 규칙의 비활성 후보 계약이다.
현재 화면, 분석, Formation, 계획 생성에는 연결하지 않는다. 사용자 공개는 별도 결정과 UX
검증 뒤에 진행한다.
