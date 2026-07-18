# Formation Minimum Evidence Methods Review

## 결론부터

“몇 번 기록하면 분석해도 되는가”에 하나의 숫자로 답할 근거는 없다. 측정 항목마다 오차,
척도, 기기, 관찰 간격과 쓰임이 다르기 때문이다. TRAINORACLE은 데이터가 쌓였다는 이유만으로
선수의 효과·안전·회복·준비도를 단정하지 않고, 말할 수 있는 수준을 네 단계로 제한한다.

## 네 단계

| 단계 | 필요한 것 | 허용되는 말 | 금지되는 말 |
|---|---|---|---|
| `OBSERVATION` | 출처·시각·단위가 있는 한 기록 | “오늘 RPE 7을 기록함” | 평소보다 높음·원인·처방 |
| `DESCRIPTIVE_BASELINE` | 같은 방법의 반복 기록과 맥락 범위 | “최근 호환 기록에서 중앙값/범위가 이러함” | 정상·안전·준비됨 |
| `MEASUREMENT_ERROR_EXCEEDING_CHANGE` | 해당 측정의 호환 오차모형 | “알려진 측정오차보다 큰 변화” | 훈련 때문·개인 반응자 |
| `PROSPECTIVE_HYPOTHESIS_COMPARISON` | 사전 계획·비교·안정된 프로토콜·시계열 분석 | “이 사전 가설과 일치/불일치” | 효능·안전·보편 인과 |

근거군은 신뢰도·SEM·MDC·SWC와 개인반응 오해, N-of-1/단일사례의
사전계획·이월·추세·자기상관, 선수 모니터링의 불일치와 맥락 의존성을 나눠 다룬다.
정본 출처는 `FRV2-CLAIM-E-001/002`와 `search-rq-e.md`의 source table에서 추적한다.

## 최소 근거는 숫자가 아니라 패키지다

각 지표는 다음 정보를 가져야 한다.

```text
metric_id + intended_use
unit + scale anchors
device/method/firmware/protocol version
observation timestamp/timezone
quality and missingness state
comparison compatibility
reliability source and population
error model and uncertainty
important-change definition and owner
coverage count/span/cadence/context
trend/autocorrelation/carryover/confound checks
claim level + prohibited inference
```

보편적인 최소 `n`과 보편적인 “며칠 이내 데이터만 신선함”은 만들지 않는다. 신선도는
측정 대상의 시간척도·입력 지연·사용 목적에 맞춰 지표별로 결정하고 통계 검토를 받는다.

## 자동 억제 규칙

- 출처나 단위·방법이 없거나 바뀌었으면 `OBSERVATION` 이상으로 올리지 않는다.
- 같은 맥락의 범위를 충분히 관찰했는지 알 수 없으면 baseline을 만들지 않는다.
- 호환되는 오차 연구가 없으면 “의미 있는 변화”를 만들지 않는다.
- 사후 구간 선택·추세·자기상관·이월·교란이 해결되지 않으면 비교 가설 단계로 올리지 않는다.
- 어느 단계도 **그 자체로** accepted plan을 직접 바꾸거나 효능·안전·부상예측·진단·회복
  허가를 만들지 않는다. 모든 게이트를 통과한 9.5일 generator만 승인된 rule input을
  사용해 새 기본 계획 version을 만들 수 있다.

## 사용자에게 보이는 방식

선수에게 통계용어를 그대로 던지지 않는다.

| 내부 단계 | 선수용 문장 예시 |
|---|---|
| 관찰 | “오늘 기록을 저장했어요.” |
| 기준선 준비 중 | “같은 방식의 기록이 더 필요해요. 지금은 비교하지 않아요.” |
| 설명 기준선 | “최근 같은 방식으로 적은 기록의 범위예요.” |
| 오차보다 큰 변화 | “측정 오차만으로 보기 어려운 변화예요. 원인은 판단하지 않아요.” |
| 비교 가설 | “미리 정한 비교와 같은 방향이었어요. 효과가 입증된 것은 아니에요.” |

기기 변경이나 누락으로 비교가 끊기면 오류처럼 꾸짖지 말고 “기록은 남아 있지만 이전 값과
같은 방식으로 비교할 수 없어요”라고 설명한다. 선수는 언제든 원자료와 사용된 기록을 볼 수
있고 잘못된 값을 정정할 수 있어야 한다.

## 통계 검토가 필요한 것

- 지표별 최소 coverage·기간·cadence·freshness.
- 측정오차 모델과 변화 판정 방식.
- 자기상관·추세·이월·결측·다중비교 처리.
- 단일 선수 가설 비교의 사전 등록과 중단 규칙.

이 값들은 고정 9.5일 정체성을 바꾸는 결정이 아니라, 9.5일 처방이 어떤 분석을 사용할 수
있는지를 정한다. 통계 전문가 승인 전에는 `UNKNOWN`이며 런타임 입력이 아니다.

## 2026-07-17 개인내 방법 보강

공식 N-of-1/SCED 지침, 측정오차 방법, 시계열·결측 방법과 스포츠 직접 적용을 더 추적한
결과도 보편 최소 `n`이나 보편 신선도 숫자를 지지하지 않았다.

- 오차보다 큰 변화와 행동할 가치가 있는 변화를 분리한다.
- 누적 훈련은 완전한 washout을 기대하기 어려워 단순 ABAB 인과 해석을 피한다.
- 추세·성장·시즌·자기상관·이월·결측을 확인하지 않은 반복 기록은 관찰 일지다.
- 개인값을 정당화할 근거가 부족하면 값을 지어내지 않고
  `KEEP_CURRENT_COACH_AUTHORED_PLAN`으로 끝낸다.
- `PRIVATE_SELF_ONLY`의 내용과 존재·시각·빈도는 이 분석에서도 완전 무신호다.

선수 설명은 “기록이 적어서 실패했어요”가 아니라 “같은 방식의 기록과 비교 근거가 아직
부족해서 이번 추천에는 쓰지 않았어요. 지금 계획은 그대로예요”라고 한다. 5단계 설명문과
방법 표는 `.omo/evidence/formation-research-v2/within-athlete-minimum-evidence-primary-research.md`
에 있다. 이 보강은 통계 전문가의 숫자·모형 승인을 대신하지 않는다.
