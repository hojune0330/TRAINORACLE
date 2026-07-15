# Quick Log Preset Research Review

```yaml
review_id: TO-WO010-QUICK-PRESETS-2026-07-15
status: RESEARCH_COMPLETE_OWNER_ACCEPTANCE_PENDING
authority: input_convenience_only
recommendation_authority: false
```

## 결론부터

빠른 입력 값은 선수가 자주 쓰는 숫자를 빨리 누르게 하는 **입력 바로가기**다.
권장 훈련량, 권장 수면시간, 평균 선수의 분포로 설명하면 안 된다. 현재 값은
대부분 유지할 수 있지만 `12 km`, `7.5시간`, 거리 `0.5 km`·시간 `5분` 단위는
과학적 기준이 아니라 제품 편의값으로 명시한다.

## 거리 프리셋

| 값 | 판정 | 근거와 한계 |
|---:|---|---|
| 3 km | `MAINTAIN_CAPTURE_ANCHOR` | 엘리트 성인 중거리 훈련 기록에 해당 범위가 관찰됨 |
| 5 km | `MAINTAIN_CAPTURE_ANCHOR` | 청소년 거리 선수의 1회 평균 약 5.2-5.3 km와 가까움 |
| 8 km | `MAINTAIN_CAPTURE_ANCHOR` | 같은 청소년 자료의 약 7.4-7.7 km를 둥글게 입력하는 값 |
| 10 km | `MAINTAIN_CAPTURE_ANCHOR` | 고특화 남자 청소년 일부에서 약 10.2 km 관찰 |
| 12 km | `UNKNOWN_UX_ONLY` | 직접 지지하는 대상 일치 근거를 찾지 못함 |

근거: [엘리트 성인 중거리 훈련 특성](https://pmc.ncbi.nlm.nih.gov/articles/PMC6243625/),
[청소년 거리 선수의 훈련 특성](https://pmc.ncbi.nlm.nih.gov/articles/PMC8448473/).

## 시간 프리셋

| 값 | 판정 | 근거와 한계 |
|---:|---|---|
| 20분 | `UNKNOWN_UX_ONLY` | 대상 일치 1차 근거를 찾지 못함 |
| 30분 | `MAINTAIN_CAPTURE_ANCHOR` | 성인 엘리트 훈련 기록에서 관찰 |
| 40분 | `MAINTAIN_CAPTURE_ANCHOR` | 성인 중거리 훈련 기록에서 관찰 |
| 60분 | `MAINTAIN_CAPTURE_ANCHOR` | 청소년 800/1500 m 선수 관찰 평균 범위와 가까움 |
| 90분 | `LIMITED_CAPTURE_ANCHOR` | 제한된 대학 남자 자료만 있어 일반화 금지 |

근거: [청소년 지구성 훈련 연구](https://pmc.ncbi.nlm.nih.gov/articles/PMC10331139/),
[청소년 중거리 훈련 관찰](https://www.frontiersin.org/journals/sports-and-active-living/articles/10.3389/fspor.2021.664632/pdf),
[대학 남자 중거리 자료](https://www.jstage.jst.go.jp/article/jhe1972/16/2/16_2_129/_pdf/-char/en).

## 수면 프리셋

| 값 | 판정 | 표시 원칙 |
|---:|---|---|
| 6, 6.5시간 | `UNKNOWN_UX_ONLY` | 실제 짧은 수면을 입력하기 위한 편의값, 권장 아님 |
| 7시간 | `UNKNOWN_UX_ONLY` | 직접 대상 일치 근거 없이 유지하는 편의값, 권장 아님 |
| 7.5시간 | `UNKNOWN_UX_ONLY` | 직접 과학 근거 없음 |
| 8, 9시간 | `MAINTAIN_CAPTURE_ANCHOR` | 청소년 권고 범위와 관찰 범위를 입력하기 편한 값 |

AASM의 청소년 권고는 일반적으로 8-10시간이지만 프리셋은 평가표가 아니다.
6시간을 누른 선수를 실패로 표시하거나, 8-9시간 입력을 회복 완료로 해석하지
않는다. 근거: [AASM 소아 수면 권고](https://aasm.org/resources/pdf/sleepdurationrecommendations.pdf),
[청소년 선수 수면 관찰](https://pubmed.ncbi.nlm.nih.gov/41675555/).

## 스테퍼 단위

| 항목 | 단위 | 판정 |
|---|---:|---|
| 거리 | 0.5 km | `UX_ONLY_UNKNOWN_AS_SCIENCE` |
| 시간 | 5분 | `UX_ONLY_UNKNOWN_AS_SCIENCE` |
| 체중 | 0.1 kg | `MAINTAIN_CAPTURE_PRECISION` |
| 심박 | 1 bpm | `MAINTAIN_CAPTURE_PRECISION` |

모든 스테퍼 단위는 빠른 조작을 위한 제품 선택이다. 체중·심박 단위도 측정
정확도나 생리적 의미를 보증하지 않는다.

## UI 계약

- 프리셋 옆에 `권장`, `정상`, `적정` 문구를 붙이지 않는다.
- 프리셋 클릭과 직접 입력은 같은 출처 등급 `EXPLICIT`으로 저장한다.
- 직접 입력을 막지 않고 단위와 허용 범위를 분명히 한다.
- 연령·성별·종목에 따라 프리셋을 자동 처방으로 바꾸지 않는다.
- 프리셋 선택 횟수로 선수 성향이나 적정 부하를 추론하지 않는다.
- 현재 값 변경은 제안하지 않는다. `12 km`와 `7.5시간`은 편의값으로만 유지한다.

## Non-Claims

These presets are entry anchors, not recommendations, normative distributions,
recovery targets, performance standards, or training prescriptions.

[DRAFT_COMPLETE]
