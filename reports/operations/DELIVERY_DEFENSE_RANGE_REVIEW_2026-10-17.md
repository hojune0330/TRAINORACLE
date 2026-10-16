# DELIVERY — 디펜스 사거리 강화의 선택 가치 검토

작성일: 2026-10-17 KST. 대상은 현재 8개 건설 위치·고정 6웨이브다. 앱·기존 probe·규칙·밸런스·Git 이력과 인덱스는 변경하지 않았다.

## 결론

9개 정책을 화력/사거리로 짝지은 **18회 실행·9쌍 비교**에서 사거리가 최종 기지 체력·처치·누수를 개선한 쌍은 없었다. 8쌍은 같은 생존 결과였고, 중앙 연사 2개 정책은 사거리에서 더 나빴다. 전체 시간은 화력이 8쌍, 사거리가 1쌍 유리했다. 모든 쌍의 실제 지출·성공 구매 횟수·구매 웨이브와 순서가 같았다.

사거리의 국지적 효과는 존재한다. 냉각 우선 혼합은 동일 850골드·100처치·0누수에서 화력 158.90초, 사거리 158.12초로 약 0.78초(약 0.49%) 빨랐다. 기존 혼합의 4웨이브도 사거리가 18.07→16.78초로 빨랐지만, 전체는 148.65→153.88초로 느려졌다. 작은 상황별 이점은 확인했으나 현재 별 등급(기지 체력)에 영향을 줄 정도의 강한 선택 가치는 확보하지 못했다.

현재 배치·경제·적 구성과 조사한 정책에서는 화력 쪽으로 결과가 기울었다는 제한된 결론이다. 사거리가 모든 정책에서 무가치하거나 화력이 보편적 지배 전략이라는 결론은 내리지 않는다. 사람의 재미·전략 이해·재방문은 시험하지 않았다.

## 합법 구매 기준과 정책

위치 번호는 게임 표시와 같은 1~8이다. 모든 구매는 웨이브 시작 전에만 한다. 시작 180골드·기지20에서 공개 도메인 함수만 사용했으며 골드·체력·적·진행 상태를 주입하지 않았다. 매각·웨이브 중 구매·적에 반응하는 정책은 제외했다.

고정 계획은 행동을 해당 웨이브 전에 한 번 시도한다. 건설 우선 정책은 명시 순서로 빈 위치에 한 번씩 건설을 시도한 뒤, 건설된 타워를 순서대로 돈이 없거나 최대 레벨이 될 때까지 강화한다. 앞의 비싼 행동이 거절돼도 뒤의 더 싼 행동은 시도한다. 부족한 돈을 보충하지 않으며 반복 정책은 다음 웨이브 전에 다시 시도한다. 두 분기의 강화 가격은 같고 레벨3은 레벨2에서 선택한 분기를 유지한다.

| 정책 | 건설/강화 순서 | 분기를 바꾸는 대상 |
|---|---|---|
| 기존 혼합 | W1: 2연사→3포격; W2: 1냉각; W3: 3강화; W4: 2강화→3강화; W5: 4포격→4강화; W6: 4강화→2강화 | 모든 강화 |
| 포격 건설 우선 | 매 웨이브 2→3→4→5→8→1→6→7 포격 시도, 이후 건설 순서로 강화 | 모든 강화 |
| 연사 건설 우선 | 같은 위치 순서에 연사 시도, 이후 건설 순서로 강화 | 모든 강화 |
| 혼합 건설 우선 | 2연사→3포격→4냉각→5포격→8연사→1냉각→6포격→7연사; 이후 건설 순서로 강화 | 모든 강화 |
| 중앙 포격 2개 | 3→4에 포격 시도, 이후 같은 순서로 강화; 추가 건설 없음 | 두 포격 |
| 중앙 연사 2개 | 2→3에 연사 시도, 이후 같은 순서로 강화; 추가 건설 없음 | 두 연사 |
| 후반 경로 포격 2개 | 4→8에 포격 시도, 이후 같은 순서로 강화; 추가 건설 없음 | 두 포격 |
| 냉각 우선 혼합 | 2연사→3포격→1냉각 건설 시도, 강화 우선순위 1→2→3 | 냉각만; 공격 타워는 양쪽 모두 화력 |
| 후반 냉각 강화 | 기존 혼합에 W5 마지막 행동으로 1냉각 레벨2 강화 추가 | 냉각만; 공격 타워는 양쪽 모두 화력 |

## 실행 조건

- 도메인: app/src/domain/minigame/tower-defense.ts
- 실행 전·후 SHA-256: 6ccc32c23c882970fba847b9680d36043baf57303dcd85ac10f239502fb81605
- 기존 probe SHA-256: 69ccb0abdef1c0422f48e5df4914e6106ca2ca571521798385560389bdbf6ef4
- Node v24.19.0; rulesVersion 1; dt 1/60초; 웨이브당 안전 상한 12000스텝.
- UTC 시작 2026-10-16T15:26:17.904Z; 종료 2026-10-16T15:26:18.506Z; 프로그램 벽시계 소요 0.600초.
- newTowerDefense/buildTower/upgradeTower/startTowerWave/stepTowerDefense만 사용했다. 표의 시간은 전투 및 마지막 탄환/이펙트 정리까지 포함한 시뮬레이션 시간이며 사람의 구매 판단 시간은 포함하지 않는다.
- 기존 혼합·포격 단일·연사 단일의 화력 결과가 docs/phase2/defense-balance-v5.json과 주요 수치 및 전체 시간까지 정확히 일치했다.

## 쌍별 최종 결과

각 수치는 **화력 / 사거리** 순서다. 18회 모두 6웨이브를 끝냈다. 지출은 각 쌍에서 동일하지만 정책 사이에서는 다르므로 정책 간 차이를 분기 효과로 해석하면 안 된다. 성공 건설/강화 횟수도 쌍의 두 실행이 동일하다.

| 정책 | 동일 지출 | 성공 건설/강화 횟수(각 실행) | 기지 | 처치 | 누수 | 남은 골드 | 전체 초 |
|---|---:|---|---|---|---|---|---|
| 기존 혼합 | 1016 | 4/6 | 20 / 20 | 100 / 100 | 0 / 0 | 474 / 474 | 148.65 / 153.88 |
| 포격 건설 우선 | 1123 | 8/2 | 20 / 20 | 100 / 100 | 0 / 0 | 367 / 367 | 134.48 / 142.82 |
| 연사 건설 우선 | 1085 | 8/7 | 16 / 16 | 98 / 98 | 2 / 2 | 375 / 375 | 202.12 / 205.00 |
| 혼합 건설 우선 | 1108 | 8/4 | 20 / 20 | 100 / 100 | 0 / 0 | 382 / 382 | 155.95 / 159.48 |
| 중앙 포격 2개 | 706 | 2/4 | 20 / 20 | 100 / 100 | 0 / 0 | 784 / 784 | 166.73 / 175.35 |
| 중앙 연사 2개 | 450 | 2/4 | 10 / 1 | 99 / 94 | 1 / 6 | 970 / 901 | 207.08 / 238.07 |
| 후반 경로 포격 2개 | 706 | 2/4 | 20 / 20 | 100 / 100 | 0 / 0 | 784 / 784 | 228.73 / 229.88 |
| 냉각 우선 혼합 | 850 | 3/6 | 20 / 20 | 100 / 100 | 0 / 0 | 640 / 640 | 158.90 / 158.12 |
| 후반 냉각 강화 | 1088 | 4/7 | 20 / 20 | 100 / 100 | 0 / 0 | 402 / 402 | 148.27 / 148.65 |

전 쌍에서 성공 구매의 웨이브와 순서까지 일치했다. 중앙 연사 2개의 잔액 차이 69골드는 사거리 실행에서 추가로 누수된 적의 보상을 받지 못한 결과이며 추가 지출 때문이 아니다. 거절된 구매는 아래 원장에 가격·당시 골드와 함께 기록했다. 이미 점유한 위치나 최대 레벨에 대한 무의미한 재시도는 거절 횟수에서 제외했다.

## 실제 구매 순서: 냉각 우선 혼합

이 쌍은 냉각 분기만 바꾸고 두 공격 타워는 화력을 유지한다. 아래 성공 구매 및 직후 잔액은 양쪽이 동일하다.

| 웨이브 전 | 실제 성공 순서 | 종료 기지·누적 처치·누적 누수 | 화력/사거리 웨이브 초 |
|---|---|---|---|
| 1 | 건설 2번 rapid Lv1 (70골드, 잔액110) → 건설 3번 cannon Lv1 (110골드, 잔액0) | 20·8·0 | 18.97 / 18.97 |
| 2 | 건설 1번 frost Lv1 (85골드, 잔액19) | 20·20·0 | 19.90 / 19.90 |
| 3 | 강화 1번 frost Lv2 (72골드, 잔액91) → 강화 2번 rapid Lv2 (60골드, 잔액31) | 20·30·0 | 36.27 / 34.77 |
| 4 | 강화 1번 frost Lv3 (115골드, 잔액106) → 강화 2번 rapid Lv3 (95골드, 잔액11) | 20·58·0 | 21.72 / 22.43 |
| 5 | 강화 3번 cannon Lv2 (94골드, 잔액187) → 강화 3번 cannon Lv3 (149골드, 잔액38) | 20·80·0 | 31.00 / 31.00 |
| 6 | 없음 | 20·100·0 | 31.05 / 31.05 |

## 해석과 다음 설계 비교 — 이번 변경에 반영하지 않음

1. **같은 돈에서 사거리로 막을 수 있고 화력은 누수되는 배치 조건이 필요한지 먼저 정한다.** 현재 사거리 +0.8이 추가로 연결하는 경로 구간을 표시하고, 접근 기회와 화력의 처치 임계값을 따로 비교한다. 새 맵을 늘리거나 수치만 올리기 전에 플레이어가 선택 이유를 읽을 수 있어야 한다.
2. **냉각의 피해 분기와 지원 분기의 목적을 구분해 검토한다.** 현재 사거리는 50% 감속·1.7초 유지 자체를 바꾸지 않고 닿는 영역만 바꾼다. 후보 변경은 한 번에 하나만 정해 동일 골드·구매 순서로 기지/누수/표적 체류 시간/아군 추가 공격 기회를 비교한다. 이번 0.78초 단축을 강한 조합 가치로 포장하지 않는다.
3. **최고 성취가 얼마나 적은 투자로 충족되는지 점검한다.** 중앙 포격 두 개만 단계적으로 강화한 정책도 706골드로 기지20·100처치·0누수를 달성했다. 기존 혼합 1,016골드보다 싼 별개의 합법 정책으로, 포격/완벽 방어 난이도를 추가 검토할 근거다. 다만 화력 실행 시간이 166.73초로 기존 혼합 148.65초보다 길므로 모든 목적에서 우월하다고 단정하지 않는다.

냉각 우선 혼합의 사거리 이점은 3웨이브에서 1.50초 단축되지만 4웨이브에서 약 0.72초가 상쇄된다. 전투 로그만으로 이를 감속 면적이라는 단일 원인으로 확정하지 않는다. 닿는 영역·표적 선택·탄환 도착·감속이 상호작용한다. 다음에는 플레이어가 사거리를 고른 이유와 결과를 설명할 수 있는지 확인해야 한다.

## 접근 한계

- 9정책은 첫 실행 전에 고정했다. 결과를 본 뒤 사거리 우위를 찾는 추가 탐색은 하지 않았다. 전수 최적화나 CI 게이트가 아니다.
- 조사하지 않은 배치 순열, 혼합 비율, 타워별 분기 조합, 반응형 구매, 매각, 웨이브 중 강화가 있다. 한 정책의 실패나 열세는 분기의 불가능성을 뜻하지 않는다.
- 결과는 이 한 경로·6웨이브·도메인 SHA에만 해당한다. 규칙이 바뀌면 다시 비교해야 한다.
- 누수로 적이 빨리 사라져도 시간이 짧아질 수 있으므로 기지·처치·누수를 먼저 평가한다. 이번 결론도 시간 차이만으로 정하지 않았다.
- 새 기능 오류나 배포 차단 오류를 발견했다는 보고가 아니다. 현재 설계의 사거리 선택 가치가 약하다는 증거를 남기는 제한 검토다.
- 앱·기존 probe·Git 수정, 추가 unit/E2E, 브라우저·실기기·배포 검증을 수행하지 않았다. 재미·가독성·재도전 동기를 검증한 것이 아니다.

## 다음 한 번의 실험: 지도 범위의 기하와 사거리 분기

2026-10-17 추가 분석. 전투 정책을 추가 실행하지 않고, 같은 도메인의 8지점과 경로를 원-선분 교차로 계산했다. 레벨2 화력의 기본 사거리와 레벨2 사거리 분기(+0.8)를 비교했다. 연사 반경 2.45→3.25, 포격 2.65→3.45, 냉각 2.40→3.20이다. 레벨3의 공통 +0.2는 이번 표에 포함하지 않는다. 길이는 실거리 단위가 아닌 논리 좌표의 경로 길이이며 전체 경로는 26이다.

각 선분에서 탑 중심의 수직거리 d와 선분 방향 투영위치 t를 구하고, 원 내부 구간 [t−√(r²−d²), t+√(r²−d²)]를 해당 선분의 [0,L]로 잘라 길이를 합산했다. d>r이면 0이다. 그림의 면적이나 원 넓이가 아니라 실제 적이 지나가는 선분의 길이를 계산했다.

| 위치(좌표) | 연사 기존→사거리 (+길이) | 포격 기존→사거리 (+길이) | 냉각 기존→사거리 (+길이) | 연사에서 처음 연결되는 선분 |
|---|---|---|---|---|
| 1 (1.5,3.6) | 6.537→7.691 (+1.154) | 6.785→7.978 (+1.194) | 6.473→7.617 (+1.143) | S3 시작 0.691 |
| 2 (4.5,3.5) | 3.874→12.920 (+9.045) | 7.885→13.969 (+6.084) | 3.747→12.648 (+8.901) | S3 3.577, S4 3.577, S5 시작0.383 |
| 3 (5.5,5.0) | 6.674→10.960 (+4.286) | 8.897→11.581 (+2.685) | 6.555→10.824 (+4.269) | S2 후반3.077 |
| 4 (8.5,3.6) | 10.074→12.175 (+2.100) | 10.569→12.685 (+2.116) | 9.947→12.043 (+2.096) | S3 후반0.691 |
| 5 (8.5,6.7) | 5.899→9.519 (+3.620) | 6.834→10.388 (+3.553) | 5.660→9.300 (+3.640) | 새 선분 없이 기존 S3·4·6·7 연장 |
| 6 (4.5,7.6) | 3.693→5.760 (+2.067) | 4.197→6.284 (+2.087) | 3.562→5.624 (+2.062) | S4 시작0.477 |
| 7 (1.5,6.2) | 2.679→4.427 (+1.748) | 3.127→4.851 (+1.724) | 2.565→4.320 (+1.755) | 새 선분 없이 기존 S2·3 연장 |
| 8 (10.5,5.5) | 4.797→7.711 (+2.914) | 6.481→7.914 (+1.432) | 4.695→7.661 (+2.966) | S7 전체2.000 |

S1=(0,2)→(3,2), S2=(3,2)→(3,6), S3=(3,6)→(7,6), S4=(7,6)→(7,2), S5=(7,2)→(10,2), S6=(10,2)→(10,8), S7=(10,8)→(12,8). '처음 연결'은 이전 반경에서는 길이가 0이던 선분이며, 괄호의 추가 길이에는 기존 선분 양끝의 확장도 포함된다. 소수점은 표시할 때만 반올림했다.

**해석:** 확장 길이가 0인 지점/종류 조합은 없다. 1번은 약18%, 4번은 약20~21%만 늘지만, 2번 연사는 약3.33배·냉각은 약3.38배로 닿는 경로가 늘어난다. 따라서 현재 화력 편향을 '지도가 사거리 확장을 막는다' 하나로 설명할 수 없다. 레벨2의 피해 비율 1.25/1.8≈0.694를 상쇄하려면, 단일 적·동일 속도·연속 발사라는 매우 단순한 조건에서도 약1.44배의 노출 기회가 필요하다. 1번/4번은 이 단순 기준에도 못 미치지만 2번은 크게 넘는다. 그런데 2·3번 중앙 연사 정책은 실제 사거리 결과가 더 나빴으므로, 기하 길이를 곧바로 피해·승률로 바꿔 읽으면 안 된다. 넓어진 경로 길이는 실제 추가 타격 시간과 같지 않다. 적이 새로 닿는 구간에 도달하기 전에 다른 타워에 죽을 수 있고, 사거리 확장으로 표적 선택이 달라질 수도 있다. 다른 타워와 겹치는 구간, 발사 간격, 방어력과 처치에 필요한 탄 수가 함께 작용한다.

**단 하나의 수정 후보(아직 미구현): 사거리 분기의 레벨2 피해 배수를 1.25→1.50으로 바꾼다.** 사거리 +0.8, 화력1.8, 레벨3 공통 배수, 가격, 적, 지도 위치, 정책은 그대로 둔다. 지도에 이미 큰 범위 차이가 존재하므로 이번 후보에서는 위치를 이동하지 않는다. 단순 노출 기회 손익분기는 1.44배에서1.20배로 낮아지며, 화력은 여전히 동일 사거리 조건에서 한 발 피해가20% 높다. 1.50은 아직 검증하지 않은 실험값이며 추천 확정값이나 해결 수치가 아니다. 이 수치는 다음 한 번의 대조 실험 후보로만 기록한다.

다음 실험은 위 9정책×2분기=18회만 같은 dt로 다시 비교한다. 새 정책·최적화·연속 수치 탐색은 추가하지 않는다. 성공 판정은 **동일 지출·성공 구매 순서가 유지된 쌍 중 최소1쌍에서 사거리가 기지 체력 또는 누수를 개선하고, 별도 최소1쌍에서는 화력의 기지/누수 또는 명확한 시간 이점이 남는 것**이다. 전자는 사거리 선택의 실제 이득, 후자는 화력 선택을 보존하는 최소 점검이며 전역적 균형 증명은 아니다. 같은 결과에서1초 미만 시간 차이만 생기거나, 사거리가 모든 조사 정책을 일방적으로 앞서면 후보를 채택하지 않는다. 구매 가능 순서가 달라진 쌍은 경제가 같다는 비교에서 제외하고 별도로 표시한다. 현재 포격2개만으로도 양쪽 모두 최고 별을 얻으므로 최고 별 여부만으로는 판정력이 약하다. 별이 같다는 사실을 개선 성공으로 세지 않고, 웨이브별 누수/처치/종료 시간과 같은 예산에서 아직 실패하는 사례를 함께 본다.

reference의 '배치·범위 읽기'를 제품으로 확인할 때는 같은 2번 탑을 고른 상태에서 강화 전/후 범위 원과 새로 연결되는 S3·S4·S5를 보여주고, 플레이어가 '어떤 길을 더 커버하는지' 설명할 수 있는지 확인한다. 이는 새 게임 시스템 제안이 아니라 현재 범위 표시를 이해할 수 있는지의 사람 검수 항목이다.

## 전체 실행 원장

18회 전체의 실제 성공 구매 순서·거절된 시도·웨이브 종료 지출/골드/체력/처치/누수/시간을 보존했다. 매 웨이브 타워 전체 스냅샷만 제외했으며 집계·구매 영수증은 그대로다. 반올림하지 않은 수치는 아래 JSON에 있다.

```json
{
  "formatVersion": 1,
  "startedAt": "2026-10-16T15:26:17.904Z",
  "finishedAt": "2026-10-16T15:26:18.506Z",
  "wallSeconds": 0.5999684,
  "runtime": "v24.19.0",
  "source": {
    "path": "app/src/domain/minigame/tower-defense.ts",
    "sha256": "6ccc32c23c882970fba847b9680d36043baf57303dcd85ac10f239502fb81605",
    "sha256After": "6ccc32c23c882970fba847b9680d36043baf57303dcd85ac10f239502fb81605"
  },
  "previousProbe": {
    "path": ".tools/probe-tower-defense-balance.mjs",
    "sha256": "69ccb0abdef1c0422f48e5df4914e6106ca2ca571521798385560389bdbf6ef4"
  },
  "protocol": {
    "rulesVersion": 1,
    "dtSeconds": 0.016666666666666666,
    "maxStepsPerWave": 12000,
    "startingGold": 180,
    "startingLives": 20,
    "padNumbering": "1-based UI pad numbers",
    "plannedRuns": 18,
    "selection": "Nine predeclared policy families x two branch variants, not exhaustive search. No selection was changed after inspecting results.",
    "economy": "Only successful public buildTower/upgradeTower operations spend earned gold. No sale, injected state, mid-wave purchases or rewritten enemy data. Failed unaffordable attempts are logged and skipped; greedy policies reconsider before the next wave.",
    "comparison": "Variant switches all level-2 branches unless branchScope is frost-only, where attack towers remain power. Level-3 upgrades retain the chosen branch. Branch prices are identical; leaked bounties can change later affordable purchases.",
    "timeBasis": "Actual simulated domain seconds, including projectile/effect cleanup, excluding human choice time; not wall time or a human completion claim."
  },
  "families": [
    {
      "id": "reference-mixed",
      "mode": "scripted",
      "plan": [
        [
          {
            "action": "build",
            "pad": 2,
            "kind": "rapid"
          },
          {
            "action": "build",
            "pad": 3,
            "kind": "cannon"
          }
        ],
        [
          {
            "action": "build",
            "pad": 1,
            "kind": "frost"
          }
        ],
        [
          {
            "action": "upgrade",
            "pad": 3
          }
        ],
        [
          {
            "action": "upgrade",
            "pad": 2
          },
          {
            "action": "upgrade",
            "pad": 3
          }
        ],
        [
          {
            "action": "build",
            "pad": 4,
            "kind": "cannon"
          },
          {
            "action": "upgrade",
            "pad": 4
          }
        ],
        [
          {
            "action": "upgrade",
            "pad": 4
          },
          {
            "action": "upgrade",
            "pad": 2
          }
        ]
      ],
      "branchScope": "all",
      "description": "Original six-wave mixed plan, only the selected upgrade branch changes."
    },
    {
      "id": "greedy-cannon",
      "mode": "greedy",
      "builds": [
        {
          "action": "build",
          "pad": 2,
          "kind": "cannon"
        },
        {
          "action": "build",
          "pad": 3,
          "kind": "cannon"
        },
        {
          "action": "build",
          "pad": 4,
          "kind": "cannon"
        },
        {
          "action": "build",
          "pad": 5,
          "kind": "cannon"
        },
        {
          "action": "build",
          "pad": 8,
          "kind": "cannon"
        },
        {
          "action": "build",
          "pad": 1,
          "kind": "cannon"
        },
        {
          "action": "build",
          "pad": 6,
          "kind": "cannon"
        },
        {
          "action": "build",
          "pad": 7,
          "kind": "cannon"
        }
      ],
      "branchScope": "all",
      "description": "Original single-kind priority: attempt all construction, then fully upgrade in construction order."
    },
    {
      "id": "greedy-rapid",
      "mode": "greedy",
      "builds": [
        {
          "action": "build",
          "pad": 2,
          "kind": "rapid"
        },
        {
          "action": "build",
          "pad": 3,
          "kind": "rapid"
        },
        {
          "action": "build",
          "pad": 4,
          "kind": "rapid"
        },
        {
          "action": "build",
          "pad": 5,
          "kind": "rapid"
        },
        {
          "action": "build",
          "pad": 8,
          "kind": "rapid"
        },
        {
          "action": "build",
          "pad": 1,
          "kind": "rapid"
        },
        {
          "action": "build",
          "pad": 6,
          "kind": "rapid"
        },
        {
          "action": "build",
          "pad": 7,
          "kind": "rapid"
        }
      ],
      "branchScope": "all",
      "description": "Original single-kind priority with rapid towers."
    },
    {
      "id": "greedy-mixed",
      "mode": "greedy",
      "builds": [
        {
          "action": "build",
          "pad": 2,
          "kind": "rapid"
        },
        {
          "action": "build",
          "pad": 3,
          "kind": "cannon"
        },
        {
          "action": "build",
          "pad": 4,
          "kind": "frost"
        },
        {
          "action": "build",
          "pad": 5,
          "kind": "cannon"
        },
        {
          "action": "build",
          "pad": 8,
          "kind": "rapid"
        },
        {
          "action": "build",
          "pad": 1,
          "kind": "frost"
        },
        {
          "action": "build",
          "pad": 6,
          "kind": "cannon"
        },
        {
          "action": "build",
          "pad": 7,
          "kind": "rapid"
        }
      ],
      "branchScope": "all",
      "description": "Construction-first mixed coverage; all available pads have a predeclared type."
    },
    {
      "id": "central-two-cannon",
      "mode": "greedy",
      "builds": [
        {
          "action": "build",
          "pad": 3,
          "kind": "cannon"
        },
        {
          "action": "build",
          "pad": 4,
          "kind": "cannon"
        }
      ],
      "branchScope": "all",
      "description": "Two fixed central cannon pads; do not expand beyond these pads."
    },
    {
      "id": "central-two-rapid",
      "mode": "greedy",
      "builds": [
        {
          "action": "build",
          "pad": 2,
          "kind": "rapid"
        },
        {
          "action": "build",
          "pad": 3,
          "kind": "rapid"
        }
      ],
      "branchScope": "all",
      "description": "Two fixed central rapid pads; do not expand beyond these pads."
    },
    {
      "id": "late-route-two-cannon",
      "mode": "greedy",
      "builds": [
        {
          "action": "build",
          "pad": 4,
          "kind": "cannon"
        },
        {
          "action": "build",
          "pad": 8,
          "kind": "cannon"
        }
      ],
      "branchScope": "all",
      "description": "Two downstream cannon pads; geometric comparison, no early-defense subsidy."
    },
    {
      "id": "frost-priority-mixed",
      "mode": "greedy",
      "builds": [
        {
          "action": "build",
          "pad": 2,
          "kind": "rapid"
        },
        {
          "action": "build",
          "pad": 3,
          "kind": "cannon"
        },
        {
          "action": "build",
          "pad": 1,
          "kind": "frost"
        }
      ],
      "upgradePriority": [
        1,
        2,
        3
      ],
      "branchScope": "frost-only",
      "description": "Build three specified mixed towers first, upgrade the frost tower first; attack towers always use power."
    },
    {
      "id": "late-frost-upgrade",
      "mode": "scripted",
      "plan": [
        [
          {
            "action": "build",
            "pad": 2,
            "kind": "rapid"
          },
          {
            "action": "build",
            "pad": 3,
            "kind": "cannon"
          }
        ],
        [
          {
            "action": "build",
            "pad": 1,
            "kind": "frost"
          }
        ],
        [
          {
            "action": "upgrade",
            "pad": 3
          }
        ],
        [
          {
            "action": "upgrade",
            "pad": 2
          },
          {
            "action": "upgrade",
            "pad": 3
          }
        ],
        [
          {
            "action": "build",
            "pad": 4,
            "kind": "cannon"
          },
          {
            "action": "upgrade",
            "pad": 4
          },
          {
            "action": "upgrade",
            "pad": 1
          }
        ],
        [
          {
            "action": "upgrade",
            "pad": 4
          },
          {
            "action": "upgrade",
            "pad": 2
          }
        ]
      ],
      "branchScope": "frost-only",
      "description": "Original mixed plan plus one frost level-2 upgrade before wave 5; attack towers always use power."
    }
  ],
  "results": [
    {
      "family": "reference-mixed",
      "variant": "power",
      "result": "won",
      "finalWave": 6,
      "lives": 20,
      "kills": 100,
      "leaks": 0,
      "gold": 474,
      "totalSpent": 1016,
      "elapsedSeconds": 148.65000000001044,
      "stats": {
        "shotsFired": 444,
        "shotsHit": 412,
        "damageDealt": 8165.830000000031
      },
      "waves": [
        {
          "wave": 1,
          "name": "정찰 부대",
          "actions": [
            {
              "action": "build",
              "pad": 2,
              "kind": "rapid",
              "level": 1,
              "branch": null,
              "cost": 70,
              "goldAfter": 110
            },
            {
              "action": "build",
              "pad": 3,
              "kind": "cannon",
              "level": 1,
              "branch": null,
              "cost": 110,
              "goldAfter": 0
            }
          ],
          "rejected": [],
          "phase": "prepare",
          "lives": 20,
          "kills": 8,
          "leaks": 0,
          "gold": 104,
          "totalSpent": 180,
          "elapsedSeconds": 18.96666666666687,
          "waveSeconds": 18.96666666666687,
          "steps": 1138,
          "stats": {
            "shotsFired": 33,
            "shotsHit": 32,
            "damageDealt": 320
          }
        },
        {
          "wave": 2,
          "name": "빠른 침투",
          "actions": [
            {
              "action": "build",
              "pad": 1,
              "kind": "frost",
              "level": 1,
              "branch": null,
              "cost": 85,
              "goldAfter": 19
            }
          ],
          "rejected": [],
          "phase": "prepare",
          "lives": 20,
          "kills": 20,
          "leaks": 0,
          "gold": 163,
          "totalSpent": 265,
          "elapsedSeconds": 38.86666666666574,
          "waveSeconds": 19.90000000000015,
          "steps": 1194,
          "stats": {
            "shotsFired": 93,
            "shotsHit": 87,
            "damageDealt": 781.7599999999998
          }
        },
        {
          "wave": 3,
          "name": "장갑 행렬",
          "actions": [
            {
              "action": "upgrade",
              "pad": 3,
              "kind": "cannon",
              "level": 2,
              "branch": "power",
              "cost": 94,
              "goldAfter": 69
            }
          ],
          "rejected": [],
          "phase": "prepare",
          "lives": 20,
          "kills": 30,
          "leaks": 0,
          "gold": 259,
          "totalSpent": 359,
          "elapsedSeconds": 67.68333333333078,
          "waveSeconds": 28.81666666666631,
          "steps": 1729,
          "stats": {
            "shotsFired": 172,
            "shotsHit": 164,
            "damageDealt": 2062.76
          }
        },
        {
          "wave": 4,
          "name": "밀집 돌파",
          "actions": [
            {
              "action": "upgrade",
              "pad": 2,
              "kind": "rapid",
              "level": 2,
              "branch": "power",
              "cost": 60,
              "goldAfter": 199
            },
            {
              "action": "upgrade",
              "pad": 3,
              "kind": "cannon",
              "level": 3,
              "branch": "power",
              "cost": 149,
              "goldAfter": 50
            }
          ],
          "rejected": [],
          "phase": "prepare",
          "lives": 20,
          "kills": 58,
          "leaks": 0,
          "gold": 320,
          "totalSpent": 568,
          "elapsedSeconds": 85.74999999999642,
          "waveSeconds": 18.066666666666922,
          "steps": 1084,
          "stats": {
            "shotsFired": 225,
            "shotsHit": 211,
            "damageDealt": 3488.519999999996
          }
        },
        {
          "wave": 5,
          "name": "혼성 부대",
          "actions": [
            {
              "action": "build",
              "pad": 4,
              "kind": "cannon",
              "level": 1,
              "branch": null,
              "cost": 110,
              "goldAfter": 210
            },
            {
              "action": "upgrade",
              "pad": 4,
              "kind": "cannon",
              "level": 2,
              "branch": "power",
              "cost": 94,
              "goldAfter": 116
            }
          ],
          "rejected": [],
          "phase": "prepare",
          "lives": 20,
          "kills": 80,
          "leaks": 0,
          "gold": 395,
          "totalSpent": 772,
          "elapsedSeconds": 117.78333333332793,
          "waveSeconds": 32.0333333333328,
          "steps": 1922,
          "stats": {
            "shotsFired": 334,
            "shotsHit": 311,
            "damageDealt": 5423.880000000009
          }
        },
        {
          "wave": 6,
          "name": "최종 공성",
          "actions": [
            {
              "action": "upgrade",
              "pad": 4,
              "kind": "cannon",
              "level": 3,
              "branch": "power",
              "cost": 149,
              "goldAfter": 246
            },
            {
              "action": "upgrade",
              "pad": 2,
              "kind": "rapid",
              "level": 3,
              "branch": "power",
              "cost": 95,
              "goldAfter": 151
            }
          ],
          "rejected": [],
          "phase": "won",
          "lives": 20,
          "kills": 100,
          "leaks": 0,
          "gold": 474,
          "totalSpent": 1016,
          "elapsedSeconds": 148.65000000001044,
          "waveSeconds": 30.866666666666195,
          "steps": 1852,
          "stats": {
            "shotsFired": 444,
            "shotsHit": 412,
            "damageDealt": 8165.830000000031
          }
        }
      ]
    },
    {
      "family": "reference-mixed",
      "variant": "reach",
      "result": "won",
      "finalWave": 6,
      "lives": 20,
      "kills": 100,
      "leaks": 0,
      "gold": 474,
      "totalSpent": 1016,
      "elapsedSeconds": 153.88333333334793,
      "stats": {
        "shotsFired": 479,
        "shotsHit": 441,
        "damageDealt": 8165.830000000035
      },
      "waves": [
        {
          "wave": 1,
          "name": "정찰 부대",
          "actions": [
            {
              "action": "build",
              "pad": 2,
              "kind": "rapid",
              "level": 1,
              "branch": null,
              "cost": 70,
              "goldAfter": 110
            },
            {
              "action": "build",
              "pad": 3,
              "kind": "cannon",
              "level": 1,
              "branch": null,
              "cost": 110,
              "goldAfter": 0
            }
          ],
          "rejected": [],
          "phase": "prepare",
          "lives": 20,
          "kills": 8,
          "leaks": 0,
          "gold": 104,
          "totalSpent": 180,
          "elapsedSeconds": 18.96666666666687,
          "waveSeconds": 18.96666666666687,
          "steps": 1138,
          "stats": {
            "shotsFired": 33,
            "shotsHit": 32,
            "damageDealt": 320
          }
        },
        {
          "wave": 2,
          "name": "빠른 침투",
          "actions": [
            {
              "action": "build",
              "pad": 1,
              "kind": "frost",
              "level": 1,
              "branch": null,
              "cost": 85,
              "goldAfter": 19
            }
          ],
          "rejected": [],
          "phase": "prepare",
          "lives": 20,
          "kills": 20,
          "leaks": 0,
          "gold": 163,
          "totalSpent": 265,
          "elapsedSeconds": 38.86666666666574,
          "waveSeconds": 19.90000000000015,
          "steps": 1194,
          "stats": {
            "shotsFired": 93,
            "shotsHit": 87,
            "damageDealt": 781.7599999999998
          }
        },
        {
          "wave": 3,
          "name": "장갑 행렬",
          "actions": [
            {
              "action": "upgrade",
              "pad": 3,
              "kind": "cannon",
              "level": 2,
              "branch": "reach",
              "cost": 94,
              "goldAfter": 69
            }
          ],
          "rejected": [],
          "phase": "prepare",
          "lives": 20,
          "kills": 30,
          "leaks": 0,
          "gold": 259,
          "totalSpent": 359,
          "elapsedSeconds": 68.66666666666406,
          "waveSeconds": 29.79999999999959,
          "steps": 1788,
          "stats": {
            "shotsFired": 172,
            "shotsHit": 163,
            "damageDealt": 2062.76
          }
        },
        {
          "wave": 4,
          "name": "밀집 돌파",
          "actions": [
            {
              "action": "upgrade",
              "pad": 2,
              "kind": "rapid",
              "level": 2,
              "branch": "reach",
              "cost": 60,
              "goldAfter": 199
            },
            {
              "action": "upgrade",
              "pad": 3,
              "kind": "cannon",
              "level": 3,
              "branch": "reach",
              "cost": 149,
              "goldAfter": 50
            }
          ],
          "rejected": [],
          "phase": "prepare",
          "lives": 20,
          "kills": 58,
          "leaks": 0,
          "gold": 320,
          "totalSpent": 568,
          "elapsedSeconds": 85.44999999999644,
          "waveSeconds": 16.783333333333662,
          "steps": 1007,
          "stats": {
            "shotsFired": 223,
            "shotsHit": 209,
            "damageDealt": 3488.519999999996
          }
        },
        {
          "wave": 5,
          "name": "혼성 부대",
          "actions": [
            {
              "action": "build",
              "pad": 4,
              "kind": "cannon",
              "level": 1,
              "branch": null,
              "cost": 110,
              "goldAfter": 210
            },
            {
              "action": "upgrade",
              "pad": 4,
              "kind": "cannon",
              "level": 2,
              "branch": "reach",
              "cost": 94,
              "goldAfter": 116
            }
          ],
          "rejected": [],
          "phase": "prepare",
          "lives": 20,
          "kills": 80,
          "leaks": 0,
          "gold": 395,
          "totalSpent": 772,
          "elapsedSeconds": 117.94999999999459,
          "waveSeconds": 32.49999999999944,
          "steps": 1950,
          "stats": {
            "shotsFired": 342,
            "shotsHit": 317,
            "damageDealt": 5423.880000000003
          }
        },
        {
          "wave": 6,
          "name": "최종 공성",
          "actions": [
            {
              "action": "upgrade",
              "pad": 4,
              "kind": "cannon",
              "level": 3,
              "branch": "reach",
              "cost": 149,
              "goldAfter": 246
            },
            {
              "action": "upgrade",
              "pad": 2,
              "kind": "rapid",
              "level": 3,
              "branch": "reach",
              "cost": 95,
              "goldAfter": 151
            }
          ],
          "rejected": [],
          "phase": "won",
          "lives": 20,
          "kills": 100,
          "leaks": 0,
          "gold": 474,
          "totalSpent": 1016,
          "elapsedSeconds": 153.88333333334793,
          "waveSeconds": 35.93333333333258,
          "steps": 2156,
          "stats": {
            "shotsFired": 479,
            "shotsHit": 441,
            "damageDealt": 8165.830000000035
          }
        }
      ]
    },
    {
      "family": "greedy-cannon",
      "variant": "power",
      "result": "won",
      "finalWave": 6,
      "lives": 20,
      "kills": 100,
      "leaks": 0,
      "gold": 367,
      "totalSpent": 1123,
      "elapsedSeconds": 134.4833333333325,
      "stats": {
        "shotsFired": 136,
        "shotsHit": 126,
        "damageDealt": 8165.830000000002
      },
      "waves": [
        {
          "wave": 1,
          "name": "정찰 부대",
          "actions": [
            {
              "action": "build",
              "pad": 2,
              "kind": "cannon",
              "level": 1,
              "branch": null,
              "cost": 110,
              "goldAfter": 70
            }
          ],
          "rejected": [
            {
              "action": "build",
              "pad": 3,
              "kind": "cannon",
              "price": 110,
              "goldAvailable": 70,
              "reason": "insufficient earned gold"
            },
            {
              "action": "build",
              "pad": 4,
              "kind": "cannon",
              "price": 110,
              "goldAvailable": 70,
              "reason": "insufficient earned gold"
            },
            {
              "action": "build",
              "pad": 5,
              "kind": "cannon",
              "price": 110,
              "goldAvailable": 70,
              "reason": "insufficient earned gold"
            },
            {
              "action": "build",
              "pad": 8,
              "kind": "cannon",
              "price": 110,
              "goldAvailable": 70,
              "reason": "insufficient earned gold"
            },
            {
              "action": "build",
              "pad": 1,
              "kind": "cannon",
              "price": 110,
              "goldAvailable": 70,
              "reason": "insufficient earned gold"
            },
            {
              "action": "build",
              "pad": 6,
              "kind": "cannon",
              "price": 110,
              "goldAvailable": 70,
              "reason": "insufficient earned gold"
            },
            {
              "action": "build",
              "pad": 7,
              "kind": "cannon",
              "price": 110,
              "goldAvailable": 70,
              "reason": "insufficient earned gold"
            },
            {
              "action": "upgrade",
              "pad": 2,
              "branch": "power",
              "price": 94,
              "goldAvailable": 70,
              "reason": "insufficient earned gold"
            }
          ],
          "phase": "prepare",
          "lives": 20,
          "kills": 8,
          "leaks": 0,
          "gold": 174,
          "totalSpent": 110,
          "elapsedSeconds": 16.733333333333665,
          "waveSeconds": 16.733333333333665,
          "steps": 1004,
          "stats": {
            "shotsFired": 9,
            "shotsHit": 9,
            "damageDealt": 320
          }
        },
        {
          "wave": 2,
          "name": "빠른 침투",
          "actions": [
            {
              "action": "build",
              "pad": 3,
              "kind": "cannon",
              "level": 1,
              "branch": null,
              "cost": 110,
              "goldAfter": 64
            }
          ],
          "rejected": [
            {
              "action": "build",
              "pad": 4,
              "kind": "cannon",
              "price": 110,
              "goldAvailable": 64,
              "reason": "insufficient earned gold"
            },
            {
              "action": "build",
              "pad": 5,
              "kind": "cannon",
              "price": 110,
              "goldAvailable": 64,
              "reason": "insufficient earned gold"
            },
            {
              "action": "build",
              "pad": 8,
              "kind": "cannon",
              "price": 110,
              "goldAvailable": 64,
              "reason": "insufficient earned gold"
            },
            {
              "action": "build",
              "pad": 1,
              "kind": "cannon",
              "price": 110,
              "goldAvailable": 64,
              "reason": "insufficient earned gold"
            },
            {
              "action": "build",
              "pad": 6,
              "kind": "cannon",
              "price": 110,
              "goldAvailable": 64,
              "reason": "insufficient earned gold"
            },
            {
              "action": "build",
              "pad": 7,
              "kind": "cannon",
              "price": 110,
              "goldAvailable": 64,
              "reason": "insufficient earned gold"
            },
            {
              "action": "upgrade",
              "pad": 2,
              "branch": "power",
              "price": 94,
              "goldAvailable": 64,
              "reason": "insufficient earned gold"
            },
            {
              "action": "upgrade",
              "pad": 3,
              "branch": "power",
              "price": 94,
              "goldAvailable": 64,
              "reason": "insufficient earned gold"
            }
          ],
          "phase": "prepare",
          "lives": 20,
          "kills": 20,
          "leaks": 0,
          "gold": 208,
          "totalSpent": 220,
          "elapsedSeconds": 36.98333333333252,
          "waveSeconds": 20.25000000000013,
          "steps": 1215,
          "stats": {
            "shotsFired": 31,
            "shotsHit": 29,
            "damageDealt": 781.7599999999998
          }
        },
        {
          "wave": 3,
          "name": "장갑 행렬",
          "actions": [
            {
              "action": "build",
              "pad": 4,
              "kind": "cannon",
              "level": 1,
              "branch": null,
              "cost": 110,
              "goldAfter": 98
            },
            {
              "action": "upgrade",
              "pad": 2,
              "kind": "cannon",
              "level": 2,
              "branch": "power",
              "cost": 94,
              "goldAfter": 4
            }
          ],
          "rejected": [
            {
              "action": "build",
              "pad": 5,
              "kind": "cannon",
              "price": 110,
              "goldAvailable": 98,
              "reason": "insufficient earned gold"
            },
            {
              "action": "build",
              "pad": 8,
              "kind": "cannon",
              "price": 110,
              "goldAvailable": 98,
              "reason": "insufficient earned gold"
            },
            {
              "action": "build",
              "pad": 1,
              "kind": "cannon",
              "price": 110,
              "goldAvailable": 98,
              "reason": "insufficient earned gold"
            },
            {
              "action": "build",
              "pad": 6,
              "kind": "cannon",
              "price": 110,
              "goldAvailable": 98,
              "reason": "insufficient earned gold"
            },
            {
              "action": "build",
              "pad": 7,
              "kind": "cannon",
              "price": 110,
              "goldAvailable": 98,
              "reason": "insufficient earned gold"
            },
            {
              "action": "upgrade",
              "pad": 2,
              "branch": "power",
              "price": 149,
              "goldAvailable": 4,
              "reason": "insufficient earned gold"
            },
            {
              "action": "upgrade",
              "pad": 3,
              "branch": "power",
              "price": 94,
              "goldAvailable": 4,
              "reason": "insufficient earned gold"
            },
            {
              "action": "upgrade",
              "pad": 4,
              "branch": "power",
              "price": 94,
              "goldAvailable": 4,
              "reason": "insufficient earned gold"
            }
          ],
          "phase": "prepare",
          "lives": 20,
          "kills": 30,
          "leaks": 0,
          "gold": 194,
          "totalSpent": 424,
          "elapsedSeconds": 59.39999999999791,
          "waveSeconds": 22.416666666666675,
          "steps": 1345,
          "stats": {
            "shotsFired": 46,
            "shotsHit": 44,
            "damageDealt": 2062.7599999999993
          }
        },
        {
          "wave": 4,
          "name": "밀집 돌파",
          "actions": [
            {
              "action": "build",
              "pad": 5,
              "kind": "cannon",
              "level": 1,
              "branch": null,
              "cost": 110,
              "goldAfter": 84
            }
          ],
          "rejected": [
            {
              "action": "build",
              "pad": 8,
              "kind": "cannon",
              "price": 110,
              "goldAvailable": 84,
              "reason": "insufficient earned gold"
            },
            {
              "action": "build",
              "pad": 1,
              "kind": "cannon",
              "price": 110,
              "goldAvailable": 84,
              "reason": "insufficient earned gold"
            },
            {
              "action": "build",
              "pad": 6,
              "kind": "cannon",
              "price": 110,
              "goldAvailable": 84,
              "reason": "insufficient earned gold"
            },
            {
              "action": "build",
              "pad": 7,
              "kind": "cannon",
              "price": 110,
              "goldAvailable": 84,
              "reason": "insufficient earned gold"
            },
            {
              "action": "upgrade",
              "pad": 2,
              "branch": "power",
              "price": 149,
              "goldAvailable": 84,
              "reason": "insufficient earned gold"
            },
            {
              "action": "upgrade",
              "pad": 3,
              "branch": "power",
              "price": 94,
              "goldAvailable": 84,
              "reason": "insufficient earned gold"
            },
            {
              "action": "upgrade",
              "pad": 4,
              "branch": "power",
              "price": 94,
              "goldAvailable": 84,
              "reason": "insufficient earned gold"
            },
            {
              "action": "upgrade",
              "pad": 5,
              "branch": "power",
              "price": 94,
              "goldAvailable": 84,
              "reason": "insufficient earned gold"
            }
          ],
          "phase": "prepare",
          "lives": 20,
          "kills": 58,
          "leaks": 0,
          "gold": 354,
          "totalSpent": 534,
          "elapsedSeconds": 77.76666666666354,
          "waveSeconds": 18.366666666666905,
          "steps": 1102,
          "stats": {
            "shotsFired": 57,
            "shotsHit": 54,
            "damageDealt": 3488.519999999995
          }
        },
        {
          "wave": 5,
          "name": "혼성 부대",
          "actions": [
            {
              "action": "build",
              "pad": 8,
              "kind": "cannon",
              "level": 1,
              "branch": null,
              "cost": 110,
              "goldAfter": 244
            },
            {
              "action": "build",
              "pad": 1,
              "kind": "cannon",
              "level": 1,
              "branch": null,
              "cost": 110,
              "goldAfter": 134
            },
            {
              "action": "build",
              "pad": 6,
              "kind": "cannon",
              "level": 1,
              "branch": null,
              "cost": 110,
              "goldAfter": 24
            }
          ],
          "rejected": [
            {
              "action": "build",
              "pad": 7,
              "kind": "cannon",
              "price": 110,
              "goldAvailable": 24,
              "reason": "insufficient earned gold"
            },
            {
              "action": "upgrade",
              "pad": 2,
              "branch": "power",
              "price": 149,
              "goldAvailable": 24,
              "reason": "insufficient earned gold"
            },
            {
              "action": "upgrade",
              "pad": 3,
              "branch": "power",
              "price": 94,
              "goldAvailable": 24,
              "reason": "insufficient earned gold"
            },
            {
              "action": "upgrade",
              "pad": 4,
              "branch": "power",
              "price": 94,
              "goldAvailable": 24,
              "reason": "insufficient earned gold"
            },
            {
              "action": "upgrade",
              "pad": 5,
              "branch": "power",
              "price": 94,
              "goldAvailable": 24,
              "reason": "insufficient earned gold"
            },
            {
              "action": "upgrade",
              "pad": 8,
              "branch": "power",
              "price": 94,
              "goldAvailable": 24,
              "reason": "insufficient earned gold"
            },
            {
              "action": "upgrade",
              "pad": 1,
              "branch": "power",
              "price": 94,
              "goldAvailable": 24,
              "reason": "insufficient earned gold"
            },
            {
              "action": "upgrade",
              "pad": 6,
              "branch": "power",
              "price": 94,
              "goldAvailable": 24,
              "reason": "insufficient earned gold"
            }
          ],
          "phase": "prepare",
          "lives": 20,
          "kills": 80,
          "leaks": 0,
          "gold": 303,
          "totalSpent": 864,
          "elapsedSeconds": 106.24999999999525,
          "waveSeconds": 28.483333333332997,
          "steps": 1709,
          "stats": {
            "shotsFired": 92,
            "shotsHit": 88,
            "damageDealt": 5423.879999999995
          }
        },
        {
          "wave": 6,
          "name": "최종 공성",
          "actions": [
            {
              "action": "build",
              "pad": 7,
              "kind": "cannon",
              "level": 1,
              "branch": null,
              "cost": 110,
              "goldAfter": 193
            },
            {
              "action": "upgrade",
              "pad": 2,
              "kind": "cannon",
              "level": 3,
              "branch": "power",
              "cost": 149,
              "goldAfter": 44
            }
          ],
          "rejected": [
            {
              "action": "upgrade",
              "pad": 3,
              "branch": "power",
              "price": 94,
              "goldAvailable": 44,
              "reason": "insufficient earned gold"
            },
            {
              "action": "upgrade",
              "pad": 4,
              "branch": "power",
              "price": 94,
              "goldAvailable": 44,
              "reason": "insufficient earned gold"
            },
            {
              "action": "upgrade",
              "pad": 5,
              "branch": "power",
              "price": 94,
              "goldAvailable": 44,
              "reason": "insufficient earned gold"
            },
            {
              "action": "upgrade",
              "pad": 8,
              "branch": "power",
              "price": 94,
              "goldAvailable": 44,
              "reason": "insufficient earned gold"
            },
            {
              "action": "upgrade",
              "pad": 1,
              "branch": "power",
              "price": 94,
              "goldAvailable": 44,
              "reason": "insufficient earned gold"
            },
            {
              "action": "upgrade",
              "pad": 6,
              "branch": "power",
              "price": 94,
              "goldAvailable": 44,
              "reason": "insufficient earned gold"
            },
            {
              "action": "upgrade",
              "pad": 7,
              "branch": "power",
              "price": 94,
              "goldAvailable": 44,
              "reason": "insufficient earned gold"
            }
          ],
          "phase": "won",
          "lives": 20,
          "kills": 100,
          "leaks": 0,
          "gold": 367,
          "totalSpent": 1123,
          "elapsedSeconds": 134.4833333333325,
          "waveSeconds": 28.23333333333301,
          "steps": 1694,
          "stats": {
            "shotsFired": 136,
            "shotsHit": 126,
            "damageDealt": 8165.830000000002
          }
        }
      ]
    },
    {
      "family": "greedy-cannon",
      "variant": "reach",
      "result": "won",
      "finalWave": 6,
      "lives": 20,
      "kills": 100,
      "leaks": 0,
      "gold": 367,
      "totalSpent": 1123,
      "elapsedSeconds": 142.81666666667246,
      "stats": {
        "shotsFired": 164,
        "shotsHit": 158,
        "damageDealt": 8165.829999999999
      },
      "waves": [
        {
          "wave": 1,
          "name": "정찰 부대",
          "actions": [
            {
              "action": "build",
              "pad": 2,
              "kind": "cannon",
              "level": 1,
              "branch": null,
              "cost": 110,
              "goldAfter": 70
            }
          ],
          "rejected": [
            {
              "action": "build",
              "pad": 3,
              "kind": "cannon",
              "price": 110,
              "goldAvailable": 70,
              "reason": "insufficient earned gold"
            },
            {
              "action": "build",
              "pad": 4,
              "kind": "cannon",
              "price": 110,
              "goldAvailable": 70,
              "reason": "insufficient earned gold"
            },
            {
              "action": "build",
              "pad": 5,
              "kind": "cannon",
              "price": 110,
              "goldAvailable": 70,
              "reason": "insufficient earned gold"
            },
            {
              "action": "build",
              "pad": 8,
              "kind": "cannon",
              "price": 110,
              "goldAvailable": 70,
              "reason": "insufficient earned gold"
            },
            {
              "action": "build",
              "pad": 1,
              "kind": "cannon",
              "price": 110,
              "goldAvailable": 70,
              "reason": "insufficient earned gold"
            },
            {
              "action": "build",
              "pad": 6,
              "kind": "cannon",
              "price": 110,
              "goldAvailable": 70,
              "reason": "insufficient earned gold"
            },
            {
              "action": "build",
              "pad": 7,
              "kind": "cannon",
              "price": 110,
              "goldAvailable": 70,
              "reason": "insufficient earned gold"
            },
            {
              "action": "upgrade",
              "pad": 2,
              "branch": "reach",
              "price": 94,
              "goldAvailable": 70,
              "reason": "insufficient earned gold"
            }
          ],
          "phase": "prepare",
          "lives": 20,
          "kills": 8,
          "leaks": 0,
          "gold": 174,
          "totalSpent": 110,
          "elapsedSeconds": 16.733333333333665,
          "waveSeconds": 16.733333333333665,
          "steps": 1004,
          "stats": {
            "shotsFired": 9,
            "shotsHit": 9,
            "damageDealt": 320
          }
        },
        {
          "wave": 2,
          "name": "빠른 침투",
          "actions": [
            {
              "action": "build",
              "pad": 3,
              "kind": "cannon",
              "level": 1,
              "branch": null,
              "cost": 110,
              "goldAfter": 64
            }
          ],
          "rejected": [
            {
              "action": "build",
              "pad": 4,
              "kind": "cannon",
              "price": 110,
              "goldAvailable": 64,
              "reason": "insufficient earned gold"
            },
            {
              "action": "build",
              "pad": 5,
              "kind": "cannon",
              "price": 110,
              "goldAvailable": 64,
              "reason": "insufficient earned gold"
            },
            {
              "action": "build",
              "pad": 8,
              "kind": "cannon",
              "price": 110,
              "goldAvailable": 64,
              "reason": "insufficient earned gold"
            },
            {
              "action": "build",
              "pad": 1,
              "kind": "cannon",
              "price": 110,
              "goldAvailable": 64,
              "reason": "insufficient earned gold"
            },
            {
              "action": "build",
              "pad": 6,
              "kind": "cannon",
              "price": 110,
              "goldAvailable": 64,
              "reason": "insufficient earned gold"
            },
            {
              "action": "build",
              "pad": 7,
              "kind": "cannon",
              "price": 110,
              "goldAvailable": 64,
              "reason": "insufficient earned gold"
            },
            {
              "action": "upgrade",
              "pad": 2,
              "branch": "reach",
              "price": 94,
              "goldAvailable": 64,
              "reason": "insufficient earned gold"
            },
            {
              "action": "upgrade",
              "pad": 3,
              "branch": "reach",
              "price": 94,
              "goldAvailable": 64,
              "reason": "insufficient earned gold"
            }
          ],
          "phase": "prepare",
          "lives": 20,
          "kills": 20,
          "leaks": 0,
          "gold": 208,
          "totalSpent": 220,
          "elapsedSeconds": 36.98333333333252,
          "waveSeconds": 20.25000000000013,
          "steps": 1215,
          "stats": {
            "shotsFired": 31,
            "shotsHit": 29,
            "damageDealt": 781.7599999999998
          }
        },
        {
          "wave": 3,
          "name": "장갑 행렬",
          "actions": [
            {
              "action": "build",
              "pad": 4,
              "kind": "cannon",
              "level": 1,
              "branch": null,
              "cost": 110,
              "goldAfter": 98
            },
            {
              "action": "upgrade",
              "pad": 2,
              "kind": "cannon",
              "level": 2,
              "branch": "reach",
              "cost": 94,
              "goldAfter": 4
            }
          ],
          "rejected": [
            {
              "action": "build",
              "pad": 5,
              "kind": "cannon",
              "price": 110,
              "goldAvailable": 98,
              "reason": "insufficient earned gold"
            },
            {
              "action": "build",
              "pad": 8,
              "kind": "cannon",
              "price": 110,
              "goldAvailable": 98,
              "reason": "insufficient earned gold"
            },
            {
              "action": "build",
              "pad": 1,
              "kind": "cannon",
              "price": 110,
              "goldAvailable": 98,
              "reason": "insufficient earned gold"
            },
            {
              "action": "build",
              "pad": 6,
              "kind": "cannon",
              "price": 110,
              "goldAvailable": 98,
              "reason": "insufficient earned gold"
            },
            {
              "action": "build",
              "pad": 7,
              "kind": "cannon",
              "price": 110,
              "goldAvailable": 98,
              "reason": "insufficient earned gold"
            },
            {
              "action": "upgrade",
              "pad": 2,
              "branch": "reach",
              "price": 149,
              "goldAvailable": 4,
              "reason": "insufficient earned gold"
            },
            {
              "action": "upgrade",
              "pad": 3,
              "branch": "reach",
              "price": 94,
              "goldAvailable": 4,
              "reason": "insufficient earned gold"
            },
            {
              "action": "upgrade",
              "pad": 4,
              "branch": "reach",
              "price": 94,
              "goldAvailable": 4,
              "reason": "insufficient earned gold"
            }
          ],
          "phase": "prepare",
          "lives": 20,
          "kills": 30,
          "leaks": 0,
          "gold": 194,
          "totalSpent": 424,
          "elapsedSeconds": 61.11666666666448,
          "waveSeconds": 24.133333333333244,
          "steps": 1448,
          "stats": {
            "shotsFired": 52,
            "shotsHit": 49,
            "damageDealt": 2062.7599999999993
          }
        },
        {
          "wave": 4,
          "name": "밀집 돌파",
          "actions": [
            {
              "action": "build",
              "pad": 5,
              "kind": "cannon",
              "level": 1,
              "branch": null,
              "cost": 110,
              "goldAfter": 84
            }
          ],
          "rejected": [
            {
              "action": "build",
              "pad": 8,
              "kind": "cannon",
              "price": 110,
              "goldAvailable": 84,
              "reason": "insufficient earned gold"
            },
            {
              "action": "build",
              "pad": 1,
              "kind": "cannon",
              "price": 110,
              "goldAvailable": 84,
              "reason": "insufficient earned gold"
            },
            {
              "action": "build",
              "pad": 6,
              "kind": "cannon",
              "price": 110,
              "goldAvailable": 84,
              "reason": "insufficient earned gold"
            },
            {
              "action": "build",
              "pad": 7,
              "kind": "cannon",
              "price": 110,
              "goldAvailable": 84,
              "reason": "insufficient earned gold"
            },
            {
              "action": "upgrade",
              "pad": 2,
              "branch": "reach",
              "price": 149,
              "goldAvailable": 84,
              "reason": "insufficient earned gold"
            },
            {
              "action": "upgrade",
              "pad": 3,
              "branch": "reach",
              "price": 94,
              "goldAvailable": 84,
              "reason": "insufficient earned gold"
            },
            {
              "action": "upgrade",
              "pad": 4,
              "branch": "reach",
              "price": 94,
              "goldAvailable": 84,
              "reason": "insufficient earned gold"
            },
            {
              "action": "upgrade",
              "pad": 5,
              "branch": "reach",
              "price": 94,
              "goldAvailable": 84,
              "reason": "insufficient earned gold"
            }
          ],
          "phase": "prepare",
          "lives": 20,
          "kills": 58,
          "leaks": 0,
          "gold": 354,
          "totalSpent": 534,
          "elapsedSeconds": 82.89999999999658,
          "waveSeconds": 21.783333333333378,
          "steps": 1307,
          "stats": {
            "shotsFired": 72,
            "shotsHit": 69,
            "damageDealt": 3488.519999999995
          }
        },
        {
          "wave": 5,
          "name": "혼성 부대",
          "actions": [
            {
              "action": "build",
              "pad": 8,
              "kind": "cannon",
              "level": 1,
              "branch": null,
              "cost": 110,
              "goldAfter": 244
            },
            {
              "action": "build",
              "pad": 1,
              "kind": "cannon",
              "level": 1,
              "branch": null,
              "cost": 110,
              "goldAfter": 134
            },
            {
              "action": "build",
              "pad": 6,
              "kind": "cannon",
              "level": 1,
              "branch": null,
              "cost": 110,
              "goldAfter": 24
            }
          ],
          "rejected": [
            {
              "action": "build",
              "pad": 7,
              "kind": "cannon",
              "price": 110,
              "goldAvailable": 24,
              "reason": "insufficient earned gold"
            },
            {
              "action": "upgrade",
              "pad": 2,
              "branch": "reach",
              "price": 149,
              "goldAvailable": 24,
              "reason": "insufficient earned gold"
            },
            {
              "action": "upgrade",
              "pad": 3,
              "branch": "reach",
              "price": 94,
              "goldAvailable": 24,
              "reason": "insufficient earned gold"
            },
            {
              "action": "upgrade",
              "pad": 4,
              "branch": "reach",
              "price": 94,
              "goldAvailable": 24,
              "reason": "insufficient earned gold"
            },
            {
              "action": "upgrade",
              "pad": 5,
              "branch": "reach",
              "price": 94,
              "goldAvailable": 24,
              "reason": "insufficient earned gold"
            },
            {
              "action": "upgrade",
              "pad": 8,
              "branch": "reach",
              "price": 94,
              "goldAvailable": 24,
              "reason": "insufficient earned gold"
            },
            {
              "action": "upgrade",
              "pad": 1,
              "branch": "reach",
              "price": 94,
              "goldAvailable": 24,
              "reason": "insufficient earned gold"
            },
            {
              "action": "upgrade",
              "pad": 6,
              "branch": "reach",
              "price": 94,
              "goldAvailable": 24,
              "reason": "insufficient earned gold"
            }
          ],
          "phase": "prepare",
          "lives": 20,
          "kills": 80,
          "leaks": 0,
          "gold": 303,
          "totalSpent": 864,
          "elapsedSeconds": 114.79999999999477,
          "waveSeconds": 31.89999999999947,
          "steps": 1914,
          "stats": {
            "shotsFired": 117,
            "shotsHit": 112,
            "damageDealt": 5423.879999999995
          }
        },
        {
          "wave": 6,
          "name": "최종 공성",
          "actions": [
            {
              "action": "build",
              "pad": 7,
              "kind": "cannon",
              "level": 1,
              "branch": null,
              "cost": 110,
              "goldAfter": 193
            },
            {
              "action": "upgrade",
              "pad": 2,
              "kind": "cannon",
              "level": 3,
              "branch": "reach",
              "cost": 149,
              "goldAfter": 44
            }
          ],
          "rejected": [
            {
              "action": "upgrade",
              "pad": 3,
              "branch": "reach",
              "price": 94,
              "goldAvailable": 44,
              "reason": "insufficient earned gold"
            },
            {
              "action": "upgrade",
              "pad": 4,
              "branch": "reach",
              "price": 94,
              "goldAvailable": 44,
              "reason": "insufficient earned gold"
            },
            {
              "action": "upgrade",
              "pad": 5,
              "branch": "reach",
              "price": 94,
              "goldAvailable": 44,
              "reason": "insufficient earned gold"
            },
            {
              "action": "upgrade",
              "pad": 8,
              "branch": "reach",
              "price": 94,
              "goldAvailable": 44,
              "reason": "insufficient earned gold"
            },
            {
              "action": "upgrade",
              "pad": 1,
              "branch": "reach",
              "price": 94,
              "goldAvailable": 44,
              "reason": "insufficient earned gold"
            },
            {
              "action": "upgrade",
              "pad": 6,
              "branch": "reach",
              "price": 94,
              "goldAvailable": 44,
              "reason": "insufficient earned gold"
            },
            {
              "action": "upgrade",
              "pad": 7,
              "branch": "reach",
              "price": 94,
              "goldAvailable": 44,
              "reason": "insufficient earned gold"
            }
          ],
          "phase": "won",
          "lives": 20,
          "kills": 100,
          "leaks": 0,
          "gold": 367,
          "totalSpent": 1123,
          "elapsedSeconds": 142.81666666667246,
          "waveSeconds": 28.016666666666357,
          "steps": 1681,
          "stats": {
            "shotsFired": 164,
            "shotsHit": 158,
            "damageDealt": 8165.829999999999
          }
        }
      ]
    },
    {
      "family": "greedy-rapid",
      "variant": "power",
      "result": "won",
      "finalWave": 6,
      "lives": 16,
      "kills": 98,
      "leaks": 2,
      "gold": 375,
      "totalSpent": 1085,
      "elapsedSeconds": 202.11666666671965,
      "stats": {
        "shotsFired": 1041,
        "shotsHit": 1001,
        "damageDealt": 8107.03000000001
      },
      "waves": [
        {
          "wave": 1,
          "name": "정찰 부대",
          "actions": [
            {
              "action": "build",
              "pad": 2,
              "kind": "rapid",
              "level": 1,
              "branch": null,
              "cost": 70,
              "goldAfter": 110
            },
            {
              "action": "build",
              "pad": 3,
              "kind": "rapid",
              "level": 1,
              "branch": null,
              "cost": 70,
              "goldAfter": 40
            }
          ],
          "rejected": [
            {
              "action": "build",
              "pad": 4,
              "kind": "rapid",
              "price": 70,
              "goldAvailable": 40,
              "reason": "insufficient earned gold"
            },
            {
              "action": "build",
              "pad": 5,
              "kind": "rapid",
              "price": 70,
              "goldAvailable": 40,
              "reason": "insufficient earned gold"
            },
            {
              "action": "build",
              "pad": 8,
              "kind": "rapid",
              "price": 70,
              "goldAvailable": 40,
              "reason": "insufficient earned gold"
            },
            {
              "action": "build",
              "pad": 1,
              "kind": "rapid",
              "price": 70,
              "goldAvailable": 40,
              "reason": "insufficient earned gold"
            },
            {
              "action": "build",
              "pad": 6,
              "kind": "rapid",
              "price": 70,
              "goldAvailable": 40,
              "reason": "insufficient earned gold"
            },
            {
              "action": "build",
              "pad": 7,
              "kind": "rapid",
              "price": 70,
              "goldAvailable": 40,
              "reason": "insufficient earned gold"
            },
            {
              "action": "upgrade",
              "pad": 2,
              "branch": "power",
              "price": 60,
              "goldAvailable": 40,
              "reason": "insufficient earned gold"
            },
            {
              "action": "upgrade",
              "pad": 3,
              "branch": "power",
              "price": 60,
              "goldAvailable": 40,
              "reason": "insufficient earned gold"
            }
          ],
          "phase": "prepare",
          "lives": 20,
          "kills": 8,
          "leaks": 0,
          "gold": 144,
          "totalSpent": 140,
          "elapsedSeconds": 19.300000000000185,
          "waveSeconds": 19.300000000000185,
          "steps": 1158,
          "stats": {
            "shotsFired": 32,
            "shotsHit": 32,
            "damageDealt": 320
          }
        },
        {
          "wave": 2,
          "name": "빠른 침투",
          "actions": [
            {
              "action": "build",
              "pad": 4,
              "kind": "rapid",
              "level": 1,
              "branch": null,
              "cost": 70,
              "goldAfter": 74
            },
            {
              "action": "build",
              "pad": 5,
              "kind": "rapid",
              "level": 1,
              "branch": null,
              "cost": 70,
              "goldAfter": 4
            }
          ],
          "rejected": [
            {
              "action": "build",
              "pad": 8,
              "kind": "rapid",
              "price": 70,
              "goldAvailable": 4,
              "reason": "insufficient earned gold"
            },
            {
              "action": "build",
              "pad": 1,
              "kind": "rapid",
              "price": 70,
              "goldAvailable": 4,
              "reason": "insufficient earned gold"
            },
            {
              "action": "build",
              "pad": 6,
              "kind": "rapid",
              "price": 70,
              "goldAvailable": 4,
              "reason": "insufficient earned gold"
            },
            {
              "action": "build",
              "pad": 7,
              "kind": "rapid",
              "price": 70,
              "goldAvailable": 4,
              "reason": "insufficient earned gold"
            },
            {
              "action": "upgrade",
              "pad": 2,
              "branch": "power",
              "price": 60,
              "goldAvailable": 4,
              "reason": "insufficient earned gold"
            },
            {
              "action": "upgrade",
              "pad": 3,
              "branch": "power",
              "price": 60,
              "goldAvailable": 4,
              "reason": "insufficient earned gold"
            },
            {
              "action": "upgrade",
              "pad": 4,
              "branch": "power",
              "price": 60,
              "goldAvailable": 4,
              "reason": "insufficient earned gold"
            },
            {
              "action": "upgrade",
              "pad": 5,
              "branch": "power",
              "price": 60,
              "goldAvailable": 4,
              "reason": "insufficient earned gold"
            }
          ],
          "phase": "prepare",
          "lives": 20,
          "kills": 20,
          "leaks": 0,
          "gold": 148,
          "totalSpent": 280,
          "elapsedSeconds": 39.98333333333235,
          "waveSeconds": 20.68333333333344,
          "steps": 1241,
          "stats": {
            "shotsFired": 72,
            "shotsHit": 72,
            "damageDealt": 781.7599999999998
          }
        },
        {
          "wave": 3,
          "name": "장갑 행렬",
          "actions": [
            {
              "action": "build",
              "pad": 8,
              "kind": "rapid",
              "level": 1,
              "branch": null,
              "cost": 70,
              "goldAfter": 78
            },
            {
              "action": "build",
              "pad": 1,
              "kind": "rapid",
              "level": 1,
              "branch": null,
              "cost": 70,
              "goldAfter": 8
            }
          ],
          "rejected": [
            {
              "action": "build",
              "pad": 6,
              "kind": "rapid",
              "price": 70,
              "goldAvailable": 8,
              "reason": "insufficient earned gold"
            },
            {
              "action": "build",
              "pad": 7,
              "kind": "rapid",
              "price": 70,
              "goldAvailable": 8,
              "reason": "insufficient earned gold"
            },
            {
              "action": "upgrade",
              "pad": 2,
              "branch": "power",
              "price": 60,
              "goldAvailable": 8,
              "reason": "insufficient earned gold"
            },
            {
              "action": "upgrade",
              "pad": 3,
              "branch": "power",
              "price": 60,
              "goldAvailable": 8,
              "reason": "insufficient earned gold"
            },
            {
              "action": "upgrade",
              "pad": 4,
              "branch": "power",
              "price": 60,
              "goldAvailable": 8,
              "reason": "insufficient earned gold"
            },
            {
              "action": "upgrade",
              "pad": 5,
              "branch": "power",
              "price": 60,
              "goldAvailable": 8,
              "reason": "insufficient earned gold"
            },
            {
              "action": "upgrade",
              "pad": 8,
              "branch": "power",
              "price": 60,
              "goldAvailable": 8,
              "reason": "insufficient earned gold"
            },
            {
              "action": "upgrade",
              "pad": 1,
              "branch": "power",
              "price": 60,
              "goldAvailable": 8,
              "reason": "insufficient earned gold"
            }
          ],
          "phase": "prepare",
          "lives": 16,
          "kills": 28,
          "leaks": 2,
          "gold": 168,
          "totalSpent": 420,
          "elapsedSeconds": 101.46666666666219,
          "waveSeconds": 61.483333333331124,
          "steps": 3689,
          "stats": {
            "shotsFired": 369,
            "shotsHit": 367,
            "damageDealt": 2003.960000000012
          }
        },
        {
          "wave": 4,
          "name": "밀집 돌파",
          "actions": [
            {
              "action": "build",
              "pad": 6,
              "kind": "rapid",
              "level": 1,
              "branch": null,
              "cost": 70,
              "goldAfter": 98
            },
            {
              "action": "build",
              "pad": 7,
              "kind": "rapid",
              "level": 1,
              "branch": null,
              "cost": 70,
              "goldAfter": 28
            }
          ],
          "rejected": [
            {
              "action": "upgrade",
              "pad": 2,
              "branch": "power",
              "price": 60,
              "goldAvailable": 28,
              "reason": "insufficient earned gold"
            },
            {
              "action": "upgrade",
              "pad": 3,
              "branch": "power",
              "price": 60,
              "goldAvailable": 28,
              "reason": "insufficient earned gold"
            },
            {
              "action": "upgrade",
              "pad": 4,
              "branch": "power",
              "price": 60,
              "goldAvailable": 28,
              "reason": "insufficient earned gold"
            },
            {
              "action": "upgrade",
              "pad": 5,
              "branch": "power",
              "price": 60,
              "goldAvailable": 28,
              "reason": "insufficient earned gold"
            },
            {
              "action": "upgrade",
              "pad": 8,
              "branch": "power",
              "price": 60,
              "goldAvailable": 28,
              "reason": "insufficient earned gold"
            },
            {
              "action": "upgrade",
              "pad": 1,
              "branch": "power",
              "price": 60,
              "goldAvailable": 28,
              "reason": "insufficient earned gold"
            },
            {
              "action": "upgrade",
              "pad": 6,
              "branch": "power",
              "price": 60,
              "goldAvailable": 28,
              "reason": "insufficient earned gold"
            },
            {
              "action": "upgrade",
              "pad": 7,
              "branch": "power",
              "price": 60,
              "goldAvailable": 28,
              "reason": "insufficient earned gold"
            }
          ],
          "phase": "prepare",
          "lives": 16,
          "kills": 56,
          "leaks": 2,
          "gold": 298,
          "totalSpent": 560,
          "elapsedSeconds": 126.19999999999412,
          "waveSeconds": 24.73333333333321,
          "steps": 1484,
          "stats": {
            "shotsFired": 514,
            "shotsHit": 501,
            "damageDealt": 3429.7200000000075
          }
        },
        {
          "wave": 5,
          "name": "혼성 부대",
          "actions": [
            {
              "action": "upgrade",
              "pad": 2,
              "kind": "rapid",
              "level": 2,
              "branch": "power",
              "cost": 60,
              "goldAfter": 238
            },
            {
              "action": "upgrade",
              "pad": 2,
              "kind": "rapid",
              "level": 3,
              "branch": "power",
              "cost": 95,
              "goldAfter": 143
            },
            {
              "action": "upgrade",
              "pad": 3,
              "kind": "rapid",
              "level": 2,
              "branch": "power",
              "cost": 60,
              "goldAfter": 83
            },
            {
              "action": "upgrade",
              "pad": 4,
              "kind": "rapid",
              "level": 2,
              "branch": "power",
              "cost": 60,
              "goldAfter": 23
            }
          ],
          "rejected": [
            {
              "action": "upgrade",
              "pad": 3,
              "branch": "power",
              "price": 95,
              "goldAvailable": 83,
              "reason": "insufficient earned gold"
            },
            {
              "action": "upgrade",
              "pad": 4,
              "branch": "power",
              "price": 95,
              "goldAvailable": 23,
              "reason": "insufficient earned gold"
            },
            {
              "action": "upgrade",
              "pad": 5,
              "branch": "power",
              "price": 60,
              "goldAvailable": 23,
              "reason": "insufficient earned gold"
            },
            {
              "action": "upgrade",
              "pad": 8,
              "branch": "power",
              "price": 60,
              "goldAvailable": 23,
              "reason": "insufficient earned gold"
            },
            {
              "action": "upgrade",
              "pad": 1,
              "branch": "power",
              "price": 60,
              "goldAvailable": 23,
              "reason": "insufficient earned gold"
            },
            {
              "action": "upgrade",
              "pad": 6,
              "branch": "power",
              "price": 60,
              "goldAvailable": 23,
              "reason": "insufficient earned gold"
            },
            {
              "action": "upgrade",
              "pad": 7,
              "branch": "power",
              "price": 60,
              "goldAvailable": 23,
              "reason": "insufficient earned gold"
            }
          ],
          "phase": "prepare",
          "lives": 16,
          "kills": 78,
          "leaks": 2,
          "gold": 302,
          "totalSpent": 835,
          "elapsedSeconds": 161.23333333335378,
          "waveSeconds": 35.03333333333263,
          "steps": 2102,
          "stats": {
            "shotsFired": 743,
            "shotsHit": 717,
            "damageDealt": 5365.080000000001
          }
        },
        {
          "wave": 6,
          "name": "최종 공성",
          "actions": [
            {
              "action": "upgrade",
              "pad": 3,
              "kind": "rapid",
              "level": 3,
              "branch": "power",
              "cost": 95,
              "goldAfter": 207
            },
            {
              "action": "upgrade",
              "pad": 4,
              "kind": "rapid",
              "level": 3,
              "branch": "power",
              "cost": 95,
              "goldAfter": 112
            },
            {
              "action": "upgrade",
              "pad": 5,
              "kind": "rapid",
              "level": 2,
              "branch": "power",
              "cost": 60,
              "goldAfter": 52
            }
          ],
          "rejected": [
            {
              "action": "upgrade",
              "pad": 5,
              "branch": "power",
              "price": 95,
              "goldAvailable": 52,
              "reason": "insufficient earned gold"
            },
            {
              "action": "upgrade",
              "pad": 8,
              "branch": "power",
              "price": 60,
              "goldAvailable": 52,
              "reason": "insufficient earned gold"
            },
            {
              "action": "upgrade",
              "pad": 1,
              "branch": "power",
              "price": 60,
              "goldAvailable": 52,
              "reason": "insufficient earned gold"
            },
            {
              "action": "upgrade",
              "pad": 6,
              "branch": "power",
              "price": 60,
              "goldAvailable": 52,
              "reason": "insufficient earned gold"
            },
            {
              "action": "upgrade",
              "pad": 7,
              "branch": "power",
              "price": 60,
              "goldAvailable": 52,
              "reason": "insufficient earned gold"
            }
          ],
          "phase": "won",
          "lives": 16,
          "kills": 98,
          "leaks": 2,
          "gold": 375,
          "totalSpent": 1085,
          "elapsedSeconds": 202.11666666671965,
          "waveSeconds": 40.883333333332295,
          "steps": 2453,
          "stats": {
            "shotsFired": 1041,
            "shotsHit": 1001,
            "damageDealt": 8107.03000000001
          }
        }
      ]
    },
    {
      "family": "greedy-rapid",
      "variant": "reach",
      "result": "won",
      "finalWave": 6,
      "lives": 16,
      "kills": 98,
      "leaks": 2,
      "gold": 375,
      "totalSpent": 1085,
      "elapsedSeconds": 205.00000000005528,
      "stats": {
        "shotsFired": 1188,
        "shotsHit": 1131,
        "damageDealt": 8107.030000000053
      },
      "waves": [
        {
          "wave": 1,
          "name": "정찰 부대",
          "actions": [
            {
              "action": "build",
              "pad": 2,
              "kind": "rapid",
              "level": 1,
              "branch": null,
              "cost": 70,
              "goldAfter": 110
            },
            {
              "action": "build",
              "pad": 3,
              "kind": "rapid",
              "level": 1,
              "branch": null,
              "cost": 70,
              "goldAfter": 40
            }
          ],
          "rejected": [
            {
              "action": "build",
              "pad": 4,
              "kind": "rapid",
              "price": 70,
              "goldAvailable": 40,
              "reason": "insufficient earned gold"
            },
            {
              "action": "build",
              "pad": 5,
              "kind": "rapid",
              "price": 70,
              "goldAvailable": 40,
              "reason": "insufficient earned gold"
            },
            {
              "action": "build",
              "pad": 8,
              "kind": "rapid",
              "price": 70,
              "goldAvailable": 40,
              "reason": "insufficient earned gold"
            },
            {
              "action": "build",
              "pad": 1,
              "kind": "rapid",
              "price": 70,
              "goldAvailable": 40,
              "reason": "insufficient earned gold"
            },
            {
              "action": "build",
              "pad": 6,
              "kind": "rapid",
              "price": 70,
              "goldAvailable": 40,
              "reason": "insufficient earned gold"
            },
            {
              "action": "build",
              "pad": 7,
              "kind": "rapid",
              "price": 70,
              "goldAvailable": 40,
              "reason": "insufficient earned gold"
            },
            {
              "action": "upgrade",
              "pad": 2,
              "branch": "reach",
              "price": 60,
              "goldAvailable": 40,
              "reason": "insufficient earned gold"
            },
            {
              "action": "upgrade",
              "pad": 3,
              "branch": "reach",
              "price": 60,
              "goldAvailable": 40,
              "reason": "insufficient earned gold"
            }
          ],
          "phase": "prepare",
          "lives": 20,
          "kills": 8,
          "leaks": 0,
          "gold": 144,
          "totalSpent": 140,
          "elapsedSeconds": 19.300000000000185,
          "waveSeconds": 19.300000000000185,
          "steps": 1158,
          "stats": {
            "shotsFired": 32,
            "shotsHit": 32,
            "damageDealt": 320
          }
        },
        {
          "wave": 2,
          "name": "빠른 침투",
          "actions": [
            {
              "action": "build",
              "pad": 4,
              "kind": "rapid",
              "level": 1,
              "branch": null,
              "cost": 70,
              "goldAfter": 74
            },
            {
              "action": "build",
              "pad": 5,
              "kind": "rapid",
              "level": 1,
              "branch": null,
              "cost": 70,
              "goldAfter": 4
            }
          ],
          "rejected": [
            {
              "action": "build",
              "pad": 8,
              "kind": "rapid",
              "price": 70,
              "goldAvailable": 4,
              "reason": "insufficient earned gold"
            },
            {
              "action": "build",
              "pad": 1,
              "kind": "rapid",
              "price": 70,
              "goldAvailable": 4,
              "reason": "insufficient earned gold"
            },
            {
              "action": "build",
              "pad": 6,
              "kind": "rapid",
              "price": 70,
              "goldAvailable": 4,
              "reason": "insufficient earned gold"
            },
            {
              "action": "build",
              "pad": 7,
              "kind": "rapid",
              "price": 70,
              "goldAvailable": 4,
              "reason": "insufficient earned gold"
            },
            {
              "action": "upgrade",
              "pad": 2,
              "branch": "reach",
              "price": 60,
              "goldAvailable": 4,
              "reason": "insufficient earned gold"
            },
            {
              "action": "upgrade",
              "pad": 3,
              "branch": "reach",
              "price": 60,
              "goldAvailable": 4,
              "reason": "insufficient earned gold"
            },
            {
              "action": "upgrade",
              "pad": 4,
              "branch": "reach",
              "price": 60,
              "goldAvailable": 4,
              "reason": "insufficient earned gold"
            },
            {
              "action": "upgrade",
              "pad": 5,
              "branch": "reach",
              "price": 60,
              "goldAvailable": 4,
              "reason": "insufficient earned gold"
            }
          ],
          "phase": "prepare",
          "lives": 20,
          "kills": 20,
          "leaks": 0,
          "gold": 148,
          "totalSpent": 280,
          "elapsedSeconds": 39.98333333333235,
          "waveSeconds": 20.68333333333344,
          "steps": 1241,
          "stats": {
            "shotsFired": 72,
            "shotsHit": 72,
            "damageDealt": 781.7599999999998
          }
        },
        {
          "wave": 3,
          "name": "장갑 행렬",
          "actions": [
            {
              "action": "build",
              "pad": 8,
              "kind": "rapid",
              "level": 1,
              "branch": null,
              "cost": 70,
              "goldAfter": 78
            },
            {
              "action": "build",
              "pad": 1,
              "kind": "rapid",
              "level": 1,
              "branch": null,
              "cost": 70,
              "goldAfter": 8
            }
          ],
          "rejected": [
            {
              "action": "build",
              "pad": 6,
              "kind": "rapid",
              "price": 70,
              "goldAvailable": 8,
              "reason": "insufficient earned gold"
            },
            {
              "action": "build",
              "pad": 7,
              "kind": "rapid",
              "price": 70,
              "goldAvailable": 8,
              "reason": "insufficient earned gold"
            },
            {
              "action": "upgrade",
              "pad": 2,
              "branch": "reach",
              "price": 60,
              "goldAvailable": 8,
              "reason": "insufficient earned gold"
            },
            {
              "action": "upgrade",
              "pad": 3,
              "branch": "reach",
              "price": 60,
              "goldAvailable": 8,
              "reason": "insufficient earned gold"
            },
            {
              "action": "upgrade",
              "pad": 4,
              "branch": "reach",
              "price": 60,
              "goldAvailable": 8,
              "reason": "insufficient earned gold"
            },
            {
              "action": "upgrade",
              "pad": 5,
              "branch": "reach",
              "price": 60,
              "goldAvailable": 8,
              "reason": "insufficient earned gold"
            },
            {
              "action": "upgrade",
              "pad": 8,
              "branch": "reach",
              "price": 60,
              "goldAvailable": 8,
              "reason": "insufficient earned gold"
            },
            {
              "action": "upgrade",
              "pad": 1,
              "branch": "reach",
              "price": 60,
              "goldAvailable": 8,
              "reason": "insufficient earned gold"
            }
          ],
          "phase": "prepare",
          "lives": 16,
          "kills": 28,
          "leaks": 2,
          "gold": 168,
          "totalSpent": 420,
          "elapsedSeconds": 101.46666666666219,
          "waveSeconds": 61.483333333331124,
          "steps": 3689,
          "stats": {
            "shotsFired": 369,
            "shotsHit": 367,
            "damageDealt": 2003.960000000012
          }
        },
        {
          "wave": 4,
          "name": "밀집 돌파",
          "actions": [
            {
              "action": "build",
              "pad": 6,
              "kind": "rapid",
              "level": 1,
              "branch": null,
              "cost": 70,
              "goldAfter": 98
            },
            {
              "action": "build",
              "pad": 7,
              "kind": "rapid",
              "level": 1,
              "branch": null,
              "cost": 70,
              "goldAfter": 28
            }
          ],
          "rejected": [
            {
              "action": "upgrade",
              "pad": 2,
              "branch": "reach",
              "price": 60,
              "goldAvailable": 28,
              "reason": "insufficient earned gold"
            },
            {
              "action": "upgrade",
              "pad": 3,
              "branch": "reach",
              "price": 60,
              "goldAvailable": 28,
              "reason": "insufficient earned gold"
            },
            {
              "action": "upgrade",
              "pad": 4,
              "branch": "reach",
              "price": 60,
              "goldAvailable": 28,
              "reason": "insufficient earned gold"
            },
            {
              "action": "upgrade",
              "pad": 5,
              "branch": "reach",
              "price": 60,
              "goldAvailable": 28,
              "reason": "insufficient earned gold"
            },
            {
              "action": "upgrade",
              "pad": 8,
              "branch": "reach",
              "price": 60,
              "goldAvailable": 28,
              "reason": "insufficient earned gold"
            },
            {
              "action": "upgrade",
              "pad": 1,
              "branch": "reach",
              "price": 60,
              "goldAvailable": 28,
              "reason": "insufficient earned gold"
            },
            {
              "action": "upgrade",
              "pad": 6,
              "branch": "reach",
              "price": 60,
              "goldAvailable": 28,
              "reason": "insufficient earned gold"
            },
            {
              "action": "upgrade",
              "pad": 7,
              "branch": "reach",
              "price": 60,
              "goldAvailable": 28,
              "reason": "insufficient earned gold"
            }
          ],
          "phase": "prepare",
          "lives": 16,
          "kills": 56,
          "leaks": 2,
          "gold": 298,
          "totalSpent": 560,
          "elapsedSeconds": 126.19999999999412,
          "waveSeconds": 24.73333333333321,
          "steps": 1484,
          "stats": {
            "shotsFired": 514,
            "shotsHit": 501,
            "damageDealt": 3429.7200000000075
          }
        },
        {
          "wave": 5,
          "name": "혼성 부대",
          "actions": [
            {
              "action": "upgrade",
              "pad": 2,
              "kind": "rapid",
              "level": 2,
              "branch": "reach",
              "cost": 60,
              "goldAfter": 238
            },
            {
              "action": "upgrade",
              "pad": 2,
              "kind": "rapid",
              "level": 3,
              "branch": "reach",
              "cost": 95,
              "goldAfter": 143
            },
            {
              "action": "upgrade",
              "pad": 3,
              "kind": "rapid",
              "level": 2,
              "branch": "reach",
              "cost": 60,
              "goldAfter": 83
            },
            {
              "action": "upgrade",
              "pad": 4,
              "kind": "rapid",
              "level": 2,
              "branch": "reach",
              "cost": 60,
              "goldAfter": 23
            }
          ],
          "rejected": [
            {
              "action": "upgrade",
              "pad": 3,
              "branch": "reach",
              "price": 95,
              "goldAvailable": 83,
              "reason": "insufficient earned gold"
            },
            {
              "action": "upgrade",
              "pad": 4,
              "branch": "reach",
              "price": 95,
              "goldAvailable": 23,
              "reason": "insufficient earned gold"
            },
            {
              "action": "upgrade",
              "pad": 5,
              "branch": "reach",
              "price": 60,
              "goldAvailable": 23,
              "reason": "insufficient earned gold"
            },
            {
              "action": "upgrade",
              "pad": 8,
              "branch": "reach",
              "price": 60,
              "goldAvailable": 23,
              "reason": "insufficient earned gold"
            },
            {
              "action": "upgrade",
              "pad": 1,
              "branch": "reach",
              "price": 60,
              "goldAvailable": 23,
              "reason": "insufficient earned gold"
            },
            {
              "action": "upgrade",
              "pad": 6,
              "branch": "reach",
              "price": 60,
              "goldAvailable": 23,
              "reason": "insufficient earned gold"
            },
            {
              "action": "upgrade",
              "pad": 7,
              "branch": "reach",
              "price": 60,
              "goldAvailable": 23,
              "reason": "insufficient earned gold"
            }
          ],
          "phase": "prepare",
          "lives": 16,
          "kills": 78,
          "leaks": 2,
          "gold": 302,
          "totalSpent": 835,
          "elapsedSeconds": 162.45000000002142,
          "waveSeconds": 36.249999999999226,
          "steps": 2175,
          "stats": {
            "shotsFired": 807,
            "shotsHit": 770,
            "damageDealt": 5365.080000000002
          }
        },
        {
          "wave": 6,
          "name": "최종 공성",
          "actions": [
            {
              "action": "upgrade",
              "pad": 3,
              "kind": "rapid",
              "level": 3,
              "branch": "reach",
              "cost": 95,
              "goldAfter": 207
            },
            {
              "action": "upgrade",
              "pad": 4,
              "kind": "rapid",
              "level": 3,
              "branch": "reach",
              "cost": 95,
              "goldAfter": 112
            },
            {
              "action": "upgrade",
              "pad": 5,
              "kind": "rapid",
              "level": 2,
              "branch": "reach",
              "cost": 60,
              "goldAfter": 52
            }
          ],
          "rejected": [
            {
              "action": "upgrade",
              "pad": 5,
              "branch": "reach",
              "price": 95,
              "goldAvailable": 52,
              "reason": "insufficient earned gold"
            },
            {
              "action": "upgrade",
              "pad": 8,
              "branch": "reach",
              "price": 60,
              "goldAvailable": 52,
              "reason": "insufficient earned gold"
            },
            {
              "action": "upgrade",
              "pad": 1,
              "branch": "reach",
              "price": 60,
              "goldAvailable": 52,
              "reason": "insufficient earned gold"
            },
            {
              "action": "upgrade",
              "pad": 6,
              "branch": "reach",
              "price": 60,
              "goldAvailable": 52,
              "reason": "insufficient earned gold"
            },
            {
              "action": "upgrade",
              "pad": 7,
              "branch": "reach",
              "price": 60,
              "goldAvailable": 52,
              "reason": "insufficient earned gold"
            }
          ],
          "phase": "won",
          "lives": 16,
          "kills": 98,
          "leaks": 2,
          "gold": 375,
          "totalSpent": 1085,
          "elapsedSeconds": 205.00000000005528,
          "waveSeconds": 42.54999999999887,
          "steps": 2553,
          "stats": {
            "shotsFired": 1188,
            "shotsHit": 1131,
            "damageDealt": 8107.030000000053
          }
        }
      ]
    },
    {
      "family": "greedy-mixed",
      "variant": "power",
      "result": "won",
      "finalWave": 6,
      "lives": 20,
      "kills": 100,
      "leaks": 0,
      "gold": 382,
      "totalSpent": 1108,
      "elapsedSeconds": 155.95000000001625,
      "stats": {
        "shotsFired": 516,
        "shotsHit": 476,
        "damageDealt": 8165.8300000000245
      },
      "waves": [
        {
          "wave": 1,
          "name": "정찰 부대",
          "actions": [
            {
              "action": "build",
              "pad": 2,
              "kind": "rapid",
              "level": 1,
              "branch": null,
              "cost": 70,
              "goldAfter": 110
            },
            {
              "action": "build",
              "pad": 3,
              "kind": "cannon",
              "level": 1,
              "branch": null,
              "cost": 110,
              "goldAfter": 0
            }
          ],
          "rejected": [
            {
              "action": "build",
              "pad": 4,
              "kind": "frost",
              "price": 85,
              "goldAvailable": 0,
              "reason": "insufficient earned gold"
            },
            {
              "action": "build",
              "pad": 5,
              "kind": "cannon",
              "price": 110,
              "goldAvailable": 0,
              "reason": "insufficient earned gold"
            },
            {
              "action": "build",
              "pad": 8,
              "kind": "rapid",
              "price": 70,
              "goldAvailable": 0,
              "reason": "insufficient earned gold"
            },
            {
              "action": "build",
              "pad": 1,
              "kind": "frost",
              "price": 85,
              "goldAvailable": 0,
              "reason": "insufficient earned gold"
            },
            {
              "action": "build",
              "pad": 6,
              "kind": "cannon",
              "price": 110,
              "goldAvailable": 0,
              "reason": "insufficient earned gold"
            },
            {
              "action": "build",
              "pad": 7,
              "kind": "rapid",
              "price": 70,
              "goldAvailable": 0,
              "reason": "insufficient earned gold"
            },
            {
              "action": "upgrade",
              "pad": 2,
              "branch": "power",
              "price": 60,
              "goldAvailable": 0,
              "reason": "insufficient earned gold"
            },
            {
              "action": "upgrade",
              "pad": 3,
              "branch": "power",
              "price": 94,
              "goldAvailable": 0,
              "reason": "insufficient earned gold"
            }
          ],
          "phase": "prepare",
          "lives": 20,
          "kills": 8,
          "leaks": 0,
          "gold": 104,
          "totalSpent": 180,
          "elapsedSeconds": 18.96666666666687,
          "waveSeconds": 18.96666666666687,
          "steps": 1138,
          "stats": {
            "shotsFired": 33,
            "shotsHit": 32,
            "damageDealt": 320
          }
        },
        {
          "wave": 2,
          "name": "빠른 침투",
          "actions": [
            {
              "action": "build",
              "pad": 4,
              "kind": "frost",
              "level": 1,
              "branch": null,
              "cost": 85,
              "goldAfter": 19
            }
          ],
          "rejected": [
            {
              "action": "build",
              "pad": 5,
              "kind": "cannon",
              "price": 110,
              "goldAvailable": 19,
              "reason": "insufficient earned gold"
            },
            {
              "action": "build",
              "pad": 8,
              "kind": "rapid",
              "price": 70,
              "goldAvailable": 19,
              "reason": "insufficient earned gold"
            },
            {
              "action": "build",
              "pad": 1,
              "kind": "frost",
              "price": 85,
              "goldAvailable": 19,
              "reason": "insufficient earned gold"
            },
            {
              "action": "build",
              "pad": 6,
              "kind": "cannon",
              "price": 110,
              "goldAvailable": 19,
              "reason": "insufficient earned gold"
            },
            {
              "action": "build",
              "pad": 7,
              "kind": "rapid",
              "price": 70,
              "goldAvailable": 19,
              "reason": "insufficient earned gold"
            },
            {
              "action": "upgrade",
              "pad": 2,
              "branch": "power",
              "price": 60,
              "goldAvailable": 19,
              "reason": "insufficient earned gold"
            },
            {
              "action": "upgrade",
              "pad": 3,
              "branch": "power",
              "price": 94,
              "goldAvailable": 19,
              "reason": "insufficient earned gold"
            },
            {
              "action": "upgrade",
              "pad": 4,
              "branch": "power",
              "price": 72,
              "goldAvailable": 19,
              "reason": "insufficient earned gold"
            }
          ],
          "phase": "prepare",
          "lives": 20,
          "kills": 20,
          "leaks": 0,
          "gold": 163,
          "totalSpent": 265,
          "elapsedSeconds": 38.199999999999115,
          "waveSeconds": 19.233333333333523,
          "steps": 1154,
          "stats": {
            "shotsFired": 74,
            "shotsHit": 70,
            "damageDealt": 781.7599999999998
          }
        },
        {
          "wave": 3,
          "name": "장갑 행렬",
          "actions": [
            {
              "action": "build",
              "pad": 5,
              "kind": "cannon",
              "level": 1,
              "branch": null,
              "cost": 110,
              "goldAfter": 53
            }
          ],
          "rejected": [
            {
              "action": "build",
              "pad": 8,
              "kind": "rapid",
              "price": 70,
              "goldAvailable": 53,
              "reason": "insufficient earned gold"
            },
            {
              "action": "build",
              "pad": 1,
              "kind": "frost",
              "price": 85,
              "goldAvailable": 53,
              "reason": "insufficient earned gold"
            },
            {
              "action": "build",
              "pad": 6,
              "kind": "cannon",
              "price": 110,
              "goldAvailable": 53,
              "reason": "insufficient earned gold"
            },
            {
              "action": "build",
              "pad": 7,
              "kind": "rapid",
              "price": 70,
              "goldAvailable": 53,
              "reason": "insufficient earned gold"
            },
            {
              "action": "upgrade",
              "pad": 2,
              "branch": "power",
              "price": 60,
              "goldAvailable": 53,
              "reason": "insufficient earned gold"
            },
            {
              "action": "upgrade",
              "pad": 3,
              "branch": "power",
              "price": 94,
              "goldAvailable": 53,
              "reason": "insufficient earned gold"
            },
            {
              "action": "upgrade",
              "pad": 4,
              "branch": "power",
              "price": 72,
              "goldAvailable": 53,
              "reason": "insufficient earned gold"
            },
            {
              "action": "upgrade",
              "pad": 5,
              "branch": "power",
              "price": 94,
              "goldAvailable": 53,
              "reason": "insufficient earned gold"
            }
          ],
          "phase": "prepare",
          "lives": 20,
          "kills": 30,
          "leaks": 0,
          "gold": 243,
          "totalSpent": 375,
          "elapsedSeconds": 70.9333333333306,
          "waveSeconds": 32.73333333333276,
          "steps": 1964,
          "stats": {
            "shotsFired": 137,
            "shotsHit": 133,
            "damageDealt": 2062.7600000000016
          }
        },
        {
          "wave": 4,
          "name": "밀집 돌파",
          "actions": [
            {
              "action": "build",
              "pad": 8,
              "kind": "rapid",
              "level": 1,
              "branch": null,
              "cost": 70,
              "goldAfter": 173
            },
            {
              "action": "build",
              "pad": 1,
              "kind": "frost",
              "level": 1,
              "branch": null,
              "cost": 85,
              "goldAfter": 88
            },
            {
              "action": "build",
              "pad": 7,
              "kind": "rapid",
              "level": 1,
              "branch": null,
              "cost": 70,
              "goldAfter": 18
            }
          ],
          "rejected": [
            {
              "action": "build",
              "pad": 6,
              "kind": "cannon",
              "price": 110,
              "goldAvailable": 88,
              "reason": "insufficient earned gold"
            },
            {
              "action": "upgrade",
              "pad": 2,
              "branch": "power",
              "price": 60,
              "goldAvailable": 18,
              "reason": "insufficient earned gold"
            },
            {
              "action": "upgrade",
              "pad": 3,
              "branch": "power",
              "price": 94,
              "goldAvailable": 18,
              "reason": "insufficient earned gold"
            },
            {
              "action": "upgrade",
              "pad": 4,
              "branch": "power",
              "price": 72,
              "goldAvailable": 18,
              "reason": "insufficient earned gold"
            },
            {
              "action": "upgrade",
              "pad": 5,
              "branch": "power",
              "price": 94,
              "goldAvailable": 18,
              "reason": "insufficient earned gold"
            },
            {
              "action": "upgrade",
              "pad": 8,
              "branch": "power",
              "price": 60,
              "goldAvailable": 18,
              "reason": "insufficient earned gold"
            },
            {
              "action": "upgrade",
              "pad": 1,
              "branch": "power",
              "price": 72,
              "goldAvailable": 18,
              "reason": "insufficient earned gold"
            },
            {
              "action": "upgrade",
              "pad": 7,
              "branch": "power",
              "price": 60,
              "goldAvailable": 18,
              "reason": "insufficient earned gold"
            }
          ],
          "phase": "prepare",
          "lives": 20,
          "kills": 58,
          "leaks": 0,
          "gold": 288,
          "totalSpent": 600,
          "elapsedSeconds": 91.86666666666274,
          "waveSeconds": 20.933333333333426,
          "steps": 1256,
          "stats": {
            "shotsFired": 220,
            "shotsHit": 206,
            "damageDealt": 3488.5199999999973
          }
        },
        {
          "wave": 5,
          "name": "혼성 부대",
          "actions": [
            {
              "action": "build",
              "pad": 6,
              "kind": "cannon",
              "level": 1,
              "branch": null,
              "cost": 110,
              "goldAfter": 178
            },
            {
              "action": "upgrade",
              "pad": 2,
              "kind": "rapid",
              "level": 2,
              "branch": "power",
              "cost": 60,
              "goldAfter": 118
            },
            {
              "action": "upgrade",
              "pad": 2,
              "kind": "rapid",
              "level": 3,
              "branch": "power",
              "cost": 95,
              "goldAfter": 23
            }
          ],
          "rejected": [
            {
              "action": "upgrade",
              "pad": 3,
              "branch": "power",
              "price": 94,
              "goldAvailable": 23,
              "reason": "insufficient earned gold"
            },
            {
              "action": "upgrade",
              "pad": 4,
              "branch": "power",
              "price": 72,
              "goldAvailable": 23,
              "reason": "insufficient earned gold"
            },
            {
              "action": "upgrade",
              "pad": 5,
              "branch": "power",
              "price": 94,
              "goldAvailable": 23,
              "reason": "insufficient earned gold"
            },
            {
              "action": "upgrade",
              "pad": 8,
              "branch": "power",
              "price": 60,
              "goldAvailable": 23,
              "reason": "insufficient earned gold"
            },
            {
              "action": "upgrade",
              "pad": 1,
              "branch": "power",
              "price": 72,
              "goldAvailable": 23,
              "reason": "insufficient earned gold"
            },
            {
              "action": "upgrade",
              "pad": 7,
              "branch": "power",
              "price": 60,
              "goldAvailable": 23,
              "reason": "insufficient earned gold"
            },
            {
              "action": "upgrade",
              "pad": 6,
              "branch": "power",
              "price": 94,
              "goldAvailable": 23,
              "reason": "insufficient earned gold"
            }
          ],
          "phase": "prepare",
          "lives": 20,
          "kills": 80,
          "leaks": 0,
          "gold": 302,
          "totalSpent": 865,
          "elapsedSeconds": 125.89999999999414,
          "waveSeconds": 34.033333333332685,
          "steps": 2042,
          "stats": {
            "shotsFired": 392,
            "shotsHit": 365,
            "damageDealt": 5423.8800000000065
          }
        },
        {
          "wave": 6,
          "name": "최종 공성",
          "actions": [
            {
              "action": "upgrade",
              "pad": 3,
              "kind": "cannon",
              "level": 2,
              "branch": "power",
              "cost": 94,
              "goldAfter": 208
            },
            {
              "action": "upgrade",
              "pad": 3,
              "kind": "cannon",
              "level": 3,
              "branch": "power",
              "cost": 149,
              "goldAfter": 59
            }
          ],
          "rejected": [
            {
              "action": "upgrade",
              "pad": 4,
              "branch": "power",
              "price": 72,
              "goldAvailable": 59,
              "reason": "insufficient earned gold"
            },
            {
              "action": "upgrade",
              "pad": 5,
              "branch": "power",
              "price": 94,
              "goldAvailable": 59,
              "reason": "insufficient earned gold"
            },
            {
              "action": "upgrade",
              "pad": 8,
              "branch": "power",
              "price": 60,
              "goldAvailable": 59,
              "reason": "insufficient earned gold"
            },
            {
              "action": "upgrade",
              "pad": 1,
              "branch": "power",
              "price": 72,
              "goldAvailable": 59,
              "reason": "insufficient earned gold"
            },
            {
              "action": "upgrade",
              "pad": 7,
              "branch": "power",
              "price": 60,
              "goldAvailable": 59,
              "reason": "insufficient earned gold"
            },
            {
              "action": "upgrade",
              "pad": 6,
              "branch": "power",
              "price": 94,
              "goldAvailable": 59,
              "reason": "insufficient earned gold"
            }
          ],
          "phase": "won",
          "lives": 20,
          "kills": 100,
          "leaks": 0,
          "gold": 382,
          "totalSpent": 1108,
          "elapsedSeconds": 155.95000000001625,
          "waveSeconds": 30.049999999999574,
          "steps": 1803,
          "stats": {
            "shotsFired": 516,
            "shotsHit": 476,
            "damageDealt": 8165.8300000000245
          }
        }
      ]
    },
    {
      "family": "greedy-mixed",
      "variant": "reach",
      "result": "won",
      "finalWave": 6,
      "lives": 20,
      "kills": 100,
      "leaks": 0,
      "gold": 382,
      "totalSpent": 1108,
      "elapsedSeconds": 159.4833333333524,
      "stats": {
        "shotsFired": 551,
        "shotsHit": 508,
        "damageDealt": 8165.830000000035
      },
      "waves": [
        {
          "wave": 1,
          "name": "정찰 부대",
          "actions": [
            {
              "action": "build",
              "pad": 2,
              "kind": "rapid",
              "level": 1,
              "branch": null,
              "cost": 70,
              "goldAfter": 110
            },
            {
              "action": "build",
              "pad": 3,
              "kind": "cannon",
              "level": 1,
              "branch": null,
              "cost": 110,
              "goldAfter": 0
            }
          ],
          "rejected": [
            {
              "action": "build",
              "pad": 4,
              "kind": "frost",
              "price": 85,
              "goldAvailable": 0,
              "reason": "insufficient earned gold"
            },
            {
              "action": "build",
              "pad": 5,
              "kind": "cannon",
              "price": 110,
              "goldAvailable": 0,
              "reason": "insufficient earned gold"
            },
            {
              "action": "build",
              "pad": 8,
              "kind": "rapid",
              "price": 70,
              "goldAvailable": 0,
              "reason": "insufficient earned gold"
            },
            {
              "action": "build",
              "pad": 1,
              "kind": "frost",
              "price": 85,
              "goldAvailable": 0,
              "reason": "insufficient earned gold"
            },
            {
              "action": "build",
              "pad": 6,
              "kind": "cannon",
              "price": 110,
              "goldAvailable": 0,
              "reason": "insufficient earned gold"
            },
            {
              "action": "build",
              "pad": 7,
              "kind": "rapid",
              "price": 70,
              "goldAvailable": 0,
              "reason": "insufficient earned gold"
            },
            {
              "action": "upgrade",
              "pad": 2,
              "branch": "reach",
              "price": 60,
              "goldAvailable": 0,
              "reason": "insufficient earned gold"
            },
            {
              "action": "upgrade",
              "pad": 3,
              "branch": "reach",
              "price": 94,
              "goldAvailable": 0,
              "reason": "insufficient earned gold"
            }
          ],
          "phase": "prepare",
          "lives": 20,
          "kills": 8,
          "leaks": 0,
          "gold": 104,
          "totalSpent": 180,
          "elapsedSeconds": 18.96666666666687,
          "waveSeconds": 18.96666666666687,
          "steps": 1138,
          "stats": {
            "shotsFired": 33,
            "shotsHit": 32,
            "damageDealt": 320
          }
        },
        {
          "wave": 2,
          "name": "빠른 침투",
          "actions": [
            {
              "action": "build",
              "pad": 4,
              "kind": "frost",
              "level": 1,
              "branch": null,
              "cost": 85,
              "goldAfter": 19
            }
          ],
          "rejected": [
            {
              "action": "build",
              "pad": 5,
              "kind": "cannon",
              "price": 110,
              "goldAvailable": 19,
              "reason": "insufficient earned gold"
            },
            {
              "action": "build",
              "pad": 8,
              "kind": "rapid",
              "price": 70,
              "goldAvailable": 19,
              "reason": "insufficient earned gold"
            },
            {
              "action": "build",
              "pad": 1,
              "kind": "frost",
              "price": 85,
              "goldAvailable": 19,
              "reason": "insufficient earned gold"
            },
            {
              "action": "build",
              "pad": 6,
              "kind": "cannon",
              "price": 110,
              "goldAvailable": 19,
              "reason": "insufficient earned gold"
            },
            {
              "action": "build",
              "pad": 7,
              "kind": "rapid",
              "price": 70,
              "goldAvailable": 19,
              "reason": "insufficient earned gold"
            },
            {
              "action": "upgrade",
              "pad": 2,
              "branch": "reach",
              "price": 60,
              "goldAvailable": 19,
              "reason": "insufficient earned gold"
            },
            {
              "action": "upgrade",
              "pad": 3,
              "branch": "reach",
              "price": 94,
              "goldAvailable": 19,
              "reason": "insufficient earned gold"
            },
            {
              "action": "upgrade",
              "pad": 4,
              "branch": "reach",
              "price": 72,
              "goldAvailable": 19,
              "reason": "insufficient earned gold"
            }
          ],
          "phase": "prepare",
          "lives": 20,
          "kills": 20,
          "leaks": 0,
          "gold": 163,
          "totalSpent": 265,
          "elapsedSeconds": 38.199999999999115,
          "waveSeconds": 19.233333333333523,
          "steps": 1154,
          "stats": {
            "shotsFired": 74,
            "shotsHit": 70,
            "damageDealt": 781.7599999999998
          }
        },
        {
          "wave": 3,
          "name": "장갑 행렬",
          "actions": [
            {
              "action": "build",
              "pad": 5,
              "kind": "cannon",
              "level": 1,
              "branch": null,
              "cost": 110,
              "goldAfter": 53
            }
          ],
          "rejected": [
            {
              "action": "build",
              "pad": 8,
              "kind": "rapid",
              "price": 70,
              "goldAvailable": 53,
              "reason": "insufficient earned gold"
            },
            {
              "action": "build",
              "pad": 1,
              "kind": "frost",
              "price": 85,
              "goldAvailable": 53,
              "reason": "insufficient earned gold"
            },
            {
              "action": "build",
              "pad": 6,
              "kind": "cannon",
              "price": 110,
              "goldAvailable": 53,
              "reason": "insufficient earned gold"
            },
            {
              "action": "build",
              "pad": 7,
              "kind": "rapid",
              "price": 70,
              "goldAvailable": 53,
              "reason": "insufficient earned gold"
            },
            {
              "action": "upgrade",
              "pad": 2,
              "branch": "reach",
              "price": 60,
              "goldAvailable": 53,
              "reason": "insufficient earned gold"
            },
            {
              "action": "upgrade",
              "pad": 3,
              "branch": "reach",
              "price": 94,
              "goldAvailable": 53,
              "reason": "insufficient earned gold"
            },
            {
              "action": "upgrade",
              "pad": 4,
              "branch": "reach",
              "price": 72,
              "goldAvailable": 53,
              "reason": "insufficient earned gold"
            },
            {
              "action": "upgrade",
              "pad": 5,
              "branch": "reach",
              "price": 94,
              "goldAvailable": 53,
              "reason": "insufficient earned gold"
            }
          ],
          "phase": "prepare",
          "lives": 20,
          "kills": 30,
          "leaks": 0,
          "gold": 243,
          "totalSpent": 375,
          "elapsedSeconds": 70.9333333333306,
          "waveSeconds": 32.73333333333276,
          "steps": 1964,
          "stats": {
            "shotsFired": 137,
            "shotsHit": 133,
            "damageDealt": 2062.7600000000016
          }
        },
        {
          "wave": 4,
          "name": "밀집 돌파",
          "actions": [
            {
              "action": "build",
              "pad": 8,
              "kind": "rapid",
              "level": 1,
              "branch": null,
              "cost": 70,
              "goldAfter": 173
            },
            {
              "action": "build",
              "pad": 1,
              "kind": "frost",
              "level": 1,
              "branch": null,
              "cost": 85,
              "goldAfter": 88
            },
            {
              "action": "build",
              "pad": 7,
              "kind": "rapid",
              "level": 1,
              "branch": null,
              "cost": 70,
              "goldAfter": 18
            }
          ],
          "rejected": [
            {
              "action": "build",
              "pad": 6,
              "kind": "cannon",
              "price": 110,
              "goldAvailable": 88,
              "reason": "insufficient earned gold"
            },
            {
              "action": "upgrade",
              "pad": 2,
              "branch": "reach",
              "price": 60,
              "goldAvailable": 18,
              "reason": "insufficient earned gold"
            },
            {
              "action": "upgrade",
              "pad": 3,
              "branch": "reach",
              "price": 94,
              "goldAvailable": 18,
              "reason": "insufficient earned gold"
            },
            {
              "action": "upgrade",
              "pad": 4,
              "branch": "reach",
              "price": 72,
              "goldAvailable": 18,
              "reason": "insufficient earned gold"
            },
            {
              "action": "upgrade",
              "pad": 5,
              "branch": "reach",
              "price": 94,
              "goldAvailable": 18,
              "reason": "insufficient earned gold"
            },
            {
              "action": "upgrade",
              "pad": 8,
              "branch": "reach",
              "price": 60,
              "goldAvailable": 18,
              "reason": "insufficient earned gold"
            },
            {
              "action": "upgrade",
              "pad": 1,
              "branch": "reach",
              "price": 72,
              "goldAvailable": 18,
              "reason": "insufficient earned gold"
            },
            {
              "action": "upgrade",
              "pad": 7,
              "branch": "reach",
              "price": 60,
              "goldAvailable": 18,
              "reason": "insufficient earned gold"
            }
          ],
          "phase": "prepare",
          "lives": 20,
          "kills": 58,
          "leaks": 0,
          "gold": 288,
          "totalSpent": 600,
          "elapsedSeconds": 91.86666666666274,
          "waveSeconds": 20.933333333333426,
          "steps": 1256,
          "stats": {
            "shotsFired": 220,
            "shotsHit": 206,
            "damageDealt": 3488.5199999999973
          }
        },
        {
          "wave": 5,
          "name": "혼성 부대",
          "actions": [
            {
              "action": "build",
              "pad": 6,
              "kind": "cannon",
              "level": 1,
              "branch": null,
              "cost": 110,
              "goldAfter": 178
            },
            {
              "action": "upgrade",
              "pad": 2,
              "kind": "rapid",
              "level": 2,
              "branch": "reach",
              "cost": 60,
              "goldAfter": 118
            },
            {
              "action": "upgrade",
              "pad": 2,
              "kind": "rapid",
              "level": 3,
              "branch": "reach",
              "cost": 95,
              "goldAfter": 23
            }
          ],
          "rejected": [
            {
              "action": "upgrade",
              "pad": 3,
              "branch": "reach",
              "price": 94,
              "goldAvailable": 23,
              "reason": "insufficient earned gold"
            },
            {
              "action": "upgrade",
              "pad": 4,
              "branch": "reach",
              "price": 72,
              "goldAvailable": 23,
              "reason": "insufficient earned gold"
            },
            {
              "action": "upgrade",
              "pad": 5,
              "branch": "reach",
              "price": 94,
              "goldAvailable": 23,
              "reason": "insufficient earned gold"
            },
            {
              "action": "upgrade",
              "pad": 8,
              "branch": "reach",
              "price": 60,
              "goldAvailable": 23,
              "reason": "insufficient earned gold"
            },
            {
              "action": "upgrade",
              "pad": 1,
              "branch": "reach",
              "price": 72,
              "goldAvailable": 23,
              "reason": "insufficient earned gold"
            },
            {
              "action": "upgrade",
              "pad": 7,
              "branch": "reach",
              "price": 60,
              "goldAvailable": 23,
              "reason": "insufficient earned gold"
            },
            {
              "action": "upgrade",
              "pad": 6,
              "branch": "reach",
              "price": 94,
              "goldAvailable": 23,
              "reason": "insufficient earned gold"
            }
          ],
          "phase": "prepare",
          "lives": 20,
          "kills": 80,
          "leaks": 0,
          "gold": 302,
          "totalSpent": 865,
          "elapsedSeconds": 125.81666666666081,
          "waveSeconds": 33.949999999999356,
          "steps": 2037,
          "stats": {
            "shotsFired": 397,
            "shotsHit": 368,
            "damageDealt": 5423.880000000008
          }
        },
        {
          "wave": 6,
          "name": "최종 공성",
          "actions": [
            {
              "action": "upgrade",
              "pad": 3,
              "kind": "cannon",
              "level": 2,
              "branch": "reach",
              "cost": 94,
              "goldAfter": 208
            },
            {
              "action": "upgrade",
              "pad": 3,
              "kind": "cannon",
              "level": 3,
              "branch": "reach",
              "cost": 149,
              "goldAfter": 59
            }
          ],
          "rejected": [
            {
              "action": "upgrade",
              "pad": 4,
              "branch": "reach",
              "price": 72,
              "goldAvailable": 59,
              "reason": "insufficient earned gold"
            },
            {
              "action": "upgrade",
              "pad": 5,
              "branch": "reach",
              "price": 94,
              "goldAvailable": 59,
              "reason": "insufficient earned gold"
            },
            {
              "action": "upgrade",
              "pad": 8,
              "branch": "reach",
              "price": 60,
              "goldAvailable": 59,
              "reason": "insufficient earned gold"
            },
            {
              "action": "upgrade",
              "pad": 1,
              "branch": "reach",
              "price": 72,
              "goldAvailable": 59,
              "reason": "insufficient earned gold"
            },
            {
              "action": "upgrade",
              "pad": 7,
              "branch": "reach",
              "price": 60,
              "goldAvailable": 59,
              "reason": "insufficient earned gold"
            },
            {
              "action": "upgrade",
              "pad": 6,
              "branch": "reach",
              "price": 94,
              "goldAvailable": 59,
              "reason": "insufficient earned gold"
            }
          ],
          "phase": "won",
          "lives": 20,
          "kills": 100,
          "leaks": 0,
          "gold": 382,
          "totalSpent": 1108,
          "elapsedSeconds": 159.4833333333524,
          "waveSeconds": 33.66666666666604,
          "steps": 2020,
          "stats": {
            "shotsFired": 551,
            "shotsHit": 508,
            "damageDealt": 8165.830000000035
          }
        }
      ]
    },
    {
      "family": "central-two-cannon",
      "variant": "power",
      "result": "won",
      "finalWave": 6,
      "lives": 20,
      "kills": 100,
      "leaks": 0,
      "gold": 784,
      "totalSpent": 706,
      "elapsedSeconds": 166.73333333335816,
      "stats": {
        "shotsFired": 96,
        "shotsHit": 96,
        "damageDealt": 8165.830000000008
      },
      "waves": [
        {
          "wave": 1,
          "name": "정찰 부대",
          "actions": [
            {
              "action": "build",
              "pad": 3,
              "kind": "cannon",
              "level": 1,
              "branch": null,
              "cost": 110,
              "goldAfter": 70
            }
          ],
          "rejected": [
            {
              "action": "build",
              "pad": 4,
              "kind": "cannon",
              "price": 110,
              "goldAvailable": 70,
              "reason": "insufficient earned gold"
            },
            {
              "action": "upgrade",
              "pad": 3,
              "branch": "power",
              "price": 94,
              "goldAvailable": 70,
              "reason": "insufficient earned gold"
            }
          ],
          "phase": "prepare",
          "lives": 20,
          "kills": 8,
          "leaks": 0,
          "gold": 174,
          "totalSpent": 110,
          "elapsedSeconds": 22.033333333333363,
          "waveSeconds": 22.033333333333363,
          "steps": 1322,
          "stats": {
            "shotsFired": 10,
            "shotsHit": 10,
            "damageDealt": 320
          }
        },
        {
          "wave": 2,
          "name": "빠른 침투",
          "actions": [
            {
              "action": "build",
              "pad": 4,
              "kind": "cannon",
              "level": 1,
              "branch": null,
              "cost": 110,
              "goldAfter": 64
            }
          ],
          "rejected": [
            {
              "action": "upgrade",
              "pad": 3,
              "branch": "power",
              "price": 94,
              "goldAvailable": 64,
              "reason": "insufficient earned gold"
            },
            {
              "action": "upgrade",
              "pad": 4,
              "branch": "power",
              "price": 94,
              "goldAvailable": 64,
              "reason": "insufficient earned gold"
            }
          ],
          "phase": "prepare",
          "lives": 20,
          "kills": 20,
          "leaks": 0,
          "gold": 208,
          "totalSpent": 220,
          "elapsedSeconds": 47.149999999998606,
          "waveSeconds": 25.11666666666652,
          "steps": 1507,
          "stats": {
            "shotsFired": 30,
            "shotsHit": 30,
            "damageDealt": 781.7599999999998
          }
        },
        {
          "wave": 3,
          "name": "장갑 행렬",
          "actions": [
            {
              "action": "upgrade",
              "pad": 3,
              "kind": "cannon",
              "level": 2,
              "branch": "power",
              "cost": 94,
              "goldAfter": 114
            },
            {
              "action": "upgrade",
              "pad": 4,
              "kind": "cannon",
              "level": 2,
              "branch": "power",
              "cost": 94,
              "goldAfter": 20
            }
          ],
          "rejected": [
            {
              "action": "upgrade",
              "pad": 3,
              "branch": "power",
              "price": 149,
              "goldAvailable": 114,
              "reason": "insufficient earned gold"
            },
            {
              "action": "upgrade",
              "pad": 4,
              "branch": "power",
              "price": 149,
              "goldAvailable": 20,
              "reason": "insufficient earned gold"
            }
          ],
          "phase": "prepare",
          "lives": 20,
          "kills": 30,
          "leaks": 0,
          "gold": 210,
          "totalSpent": 408,
          "elapsedSeconds": 79.11666666666346,
          "waveSeconds": 31.966666666666132,
          "steps": 1918,
          "stats": {
            "shotsFired": 45,
            "shotsHit": 45,
            "damageDealt": 2062.7599999999993
          }
        },
        {
          "wave": 4,
          "name": "밀집 돌파",
          "actions": [
            {
              "action": "upgrade",
              "pad": 3,
              "kind": "cannon",
              "level": 3,
              "branch": "power",
              "cost": 149,
              "goldAfter": 61
            }
          ],
          "rejected": [
            {
              "action": "upgrade",
              "pad": 4,
              "branch": "power",
              "price": 149,
              "goldAvailable": 61,
              "reason": "insufficient earned gold"
            }
          ],
          "phase": "prepare",
          "lives": 20,
          "kills": 58,
          "leaks": 0,
          "gold": 331,
          "totalSpent": 557,
          "elapsedSeconds": 97.98333333332906,
          "waveSeconds": 18.866666666666877,
          "steps": 1132,
          "stats": {
            "shotsFired": 54,
            "shotsHit": 54,
            "damageDealt": 3488.519999999995
          }
        },
        {
          "wave": 5,
          "name": "혼성 부대",
          "actions": [
            {
              "action": "upgrade",
              "pad": 4,
              "kind": "cannon",
              "level": 3,
              "branch": "power",
              "cost": 149,
              "goldAfter": 182
            }
          ],
          "rejected": [],
          "phase": "prepare",
          "lives": 20,
          "kills": 80,
          "leaks": 0,
          "gold": 461,
          "totalSpent": 706,
          "elapsedSeconds": 129.26666666666168,
          "waveSeconds": 31.283333333332838,
          "steps": 1877,
          "stats": {
            "shotsFired": 73,
            "shotsHit": 73,
            "damageDealt": 5423.88
          }
        },
        {
          "wave": 6,
          "name": "최종 공성",
          "actions": [],
          "rejected": [],
          "phase": "won",
          "lives": 20,
          "kills": 100,
          "leaks": 0,
          "gold": 784,
          "totalSpent": 706,
          "elapsedSeconds": 166.73333333335816,
          "waveSeconds": 37.46666666666582,
          "steps": 2248,
          "stats": {
            "shotsFired": 96,
            "shotsHit": 96,
            "damageDealt": 8165.830000000008
          }
        }
      ]
    },
    {
      "family": "central-two-cannon",
      "variant": "reach",
      "result": "won",
      "finalWave": 6,
      "lives": 20,
      "kills": 100,
      "leaks": 0,
      "gold": 784,
      "totalSpent": 706,
      "elapsedSeconds": 175.35000000003168,
      "stats": {
        "shotsFired": 115,
        "shotsHit": 114,
        "damageDealt": 8165.829999999999
      },
      "waves": [
        {
          "wave": 1,
          "name": "정찰 부대",
          "actions": [
            {
              "action": "build",
              "pad": 3,
              "kind": "cannon",
              "level": 1,
              "branch": null,
              "cost": 110,
              "goldAfter": 70
            }
          ],
          "rejected": [
            {
              "action": "build",
              "pad": 4,
              "kind": "cannon",
              "price": 110,
              "goldAvailable": 70,
              "reason": "insufficient earned gold"
            },
            {
              "action": "upgrade",
              "pad": 3,
              "branch": "reach",
              "price": 94,
              "goldAvailable": 70,
              "reason": "insufficient earned gold"
            }
          ],
          "phase": "prepare",
          "lives": 20,
          "kills": 8,
          "leaks": 0,
          "gold": 174,
          "totalSpent": 110,
          "elapsedSeconds": 22.033333333333363,
          "waveSeconds": 22.033333333333363,
          "steps": 1322,
          "stats": {
            "shotsFired": 10,
            "shotsHit": 10,
            "damageDealt": 320
          }
        },
        {
          "wave": 2,
          "name": "빠른 침투",
          "actions": [
            {
              "action": "build",
              "pad": 4,
              "kind": "cannon",
              "level": 1,
              "branch": null,
              "cost": 110,
              "goldAfter": 64
            }
          ],
          "rejected": [
            {
              "action": "upgrade",
              "pad": 3,
              "branch": "reach",
              "price": 94,
              "goldAvailable": 64,
              "reason": "insufficient earned gold"
            },
            {
              "action": "upgrade",
              "pad": 4,
              "branch": "reach",
              "price": 94,
              "goldAvailable": 64,
              "reason": "insufficient earned gold"
            }
          ],
          "phase": "prepare",
          "lives": 20,
          "kills": 20,
          "leaks": 0,
          "gold": 208,
          "totalSpent": 220,
          "elapsedSeconds": 47.149999999998606,
          "waveSeconds": 25.11666666666652,
          "steps": 1507,
          "stats": {
            "shotsFired": 30,
            "shotsHit": 30,
            "damageDealt": 781.7599999999998
          }
        },
        {
          "wave": 3,
          "name": "장갑 행렬",
          "actions": [
            {
              "action": "upgrade",
              "pad": 3,
              "kind": "cannon",
              "level": 2,
              "branch": "reach",
              "cost": 94,
              "goldAfter": 114
            },
            {
              "action": "upgrade",
              "pad": 4,
              "kind": "cannon",
              "level": 2,
              "branch": "reach",
              "cost": 94,
              "goldAfter": 20
            }
          ],
          "rejected": [
            {
              "action": "upgrade",
              "pad": 3,
              "branch": "reach",
              "price": 149,
              "goldAvailable": 114,
              "reason": "insufficient earned gold"
            },
            {
              "action": "upgrade",
              "pad": 4,
              "branch": "reach",
              "price": 149,
              "goldAvailable": 20,
              "reason": "insufficient earned gold"
            }
          ],
          "phase": "prepare",
          "lives": 20,
          "kills": 30,
          "leaks": 0,
          "gold": 210,
          "totalSpent": 408,
          "elapsedSeconds": 79.74999999999676,
          "waveSeconds": 32.59999999999943,
          "steps": 1956,
          "stats": {
            "shotsFired": 50,
            "shotsHit": 50,
            "damageDealt": 2062.7599999999993
          }
        },
        {
          "wave": 4,
          "name": "밀집 돌파",
          "actions": [
            {
              "action": "upgrade",
              "pad": 3,
              "kind": "cannon",
              "level": 3,
              "branch": "reach",
              "cost": 149,
              "goldAfter": 61
            }
          ],
          "rejected": [
            {
              "action": "upgrade",
              "pad": 4,
              "branch": "reach",
              "price": 149,
              "goldAvailable": 61,
              "reason": "insufficient earned gold"
            }
          ],
          "phase": "prepare",
          "lives": 20,
          "kills": 58,
          "leaks": 0,
          "gold": 331,
          "totalSpent": 557,
          "elapsedSeconds": 97.59999999999575,
          "waveSeconds": 17.850000000000268,
          "steps": 1071,
          "stats": {
            "shotsFired": 58,
            "shotsHit": 58,
            "damageDealt": 3488.519999999995
          }
        },
        {
          "wave": 5,
          "name": "혼성 부대",
          "actions": [
            {
              "action": "upgrade",
              "pad": 4,
              "kind": "cannon",
              "level": 3,
              "branch": "reach",
              "cost": 149,
              "goldAfter": 182
            }
          ],
          "rejected": [],
          "phase": "prepare",
          "lives": 20,
          "kills": 80,
          "leaks": 0,
          "gold": 461,
          "totalSpent": 706,
          "elapsedSeconds": 135.8833333333336,
          "waveSeconds": 38.28333333333244,
          "steps": 2297,
          "stats": {
            "shotsFired": 84,
            "shotsHit": 84,
            "damageDealt": 5423.879999999995
          }
        },
        {
          "wave": 6,
          "name": "최종 공성",
          "actions": [],
          "rejected": [],
          "phase": "won",
          "lives": 20,
          "kills": 100,
          "leaks": 0,
          "gold": 784,
          "totalSpent": 706,
          "elapsedSeconds": 175.35000000003168,
          "waveSeconds": 39.46666666666571,
          "steps": 2368,
          "stats": {
            "shotsFired": 115,
            "shotsHit": 114,
            "damageDealt": 8165.829999999999
          }
        }
      ]
    },
    {
      "family": "central-two-rapid",
      "variant": "power",
      "result": "won",
      "finalWave": 6,
      "lives": 10,
      "kills": 99,
      "leaks": 1,
      "gold": 970,
      "totalSpent": 450,
      "elapsedSeconds": 207.08333333339027,
      "stats": {
        "shotsFired": 556,
        "shotsHit": 542,
        "damageDealt": 7732.13400000003
      },
      "waves": [
        {
          "wave": 1,
          "name": "정찰 부대",
          "actions": [
            {
              "action": "build",
              "pad": 2,
              "kind": "rapid",
              "level": 1,
              "branch": null,
              "cost": 70,
              "goldAfter": 110
            },
            {
              "action": "build",
              "pad": 3,
              "kind": "rapid",
              "level": 1,
              "branch": null,
              "cost": 70,
              "goldAfter": 40
            }
          ],
          "rejected": [
            {
              "action": "upgrade",
              "pad": 2,
              "branch": "power",
              "price": 60,
              "goldAvailable": 40,
              "reason": "insufficient earned gold"
            },
            {
              "action": "upgrade",
              "pad": 3,
              "branch": "power",
              "price": 60,
              "goldAvailable": 40,
              "reason": "insufficient earned gold"
            }
          ],
          "phase": "prepare",
          "lives": 20,
          "kills": 8,
          "leaks": 0,
          "gold": 144,
          "totalSpent": 140,
          "elapsedSeconds": 19.300000000000185,
          "waveSeconds": 19.300000000000185,
          "steps": 1158,
          "stats": {
            "shotsFired": 32,
            "shotsHit": 32,
            "damageDealt": 320
          }
        },
        {
          "wave": 2,
          "name": "빠른 침투",
          "actions": [
            {
              "action": "upgrade",
              "pad": 2,
              "kind": "rapid",
              "level": 2,
              "branch": "power",
              "cost": 60,
              "goldAfter": 84
            },
            {
              "action": "upgrade",
              "pad": 3,
              "kind": "rapid",
              "level": 2,
              "branch": "power",
              "cost": 60,
              "goldAfter": 24
            }
          ],
          "rejected": [
            {
              "action": "upgrade",
              "pad": 2,
              "branch": "power",
              "price": 95,
              "goldAvailable": 84,
              "reason": "insufficient earned gold"
            },
            {
              "action": "upgrade",
              "pad": 3,
              "branch": "power",
              "price": 95,
              "goldAvailable": 24,
              "reason": "insufficient earned gold"
            }
          ],
          "phase": "prepare",
          "lives": 20,
          "kills": 20,
          "leaks": 0,
          "gold": 168,
          "totalSpent": 260,
          "elapsedSeconds": 37.21666666666584,
          "waveSeconds": 17.91666666666693,
          "steps": 1075,
          "stats": {
            "shotsFired": 60,
            "shotsHit": 60,
            "damageDealt": 781.7600000000004
          }
        },
        {
          "wave": 3,
          "name": "장갑 행렬",
          "actions": [
            {
              "action": "upgrade",
              "pad": 2,
              "kind": "rapid",
              "level": 3,
              "branch": "power",
              "cost": 95,
              "goldAfter": 73
            }
          ],
          "rejected": [
            {
              "action": "upgrade",
              "pad": 3,
              "branch": "power",
              "price": 95,
              "goldAvailable": 73,
              "reason": "insufficient earned gold"
            }
          ],
          "phase": "prepare",
          "lives": 20,
          "kills": 30,
          "leaks": 0,
          "gold": 263,
          "totalSpent": 355,
          "elapsedSeconds": 76.1333333333303,
          "waveSeconds": 38.91666666666574,
          "steps": 2335,
          "stats": {
            "shotsFired": 188,
            "shotsHit": 186,
            "damageDealt": 2062.759999999995
          }
        },
        {
          "wave": 4,
          "name": "밀집 돌파",
          "actions": [
            {
              "action": "upgrade",
              "pad": 3,
              "kind": "rapid",
              "level": 3,
              "branch": "power",
              "cost": 95,
              "goldAfter": 168
            }
          ],
          "rejected": [],
          "phase": "prepare",
          "lives": 20,
          "kills": 58,
          "leaks": 0,
          "gold": 438,
          "totalSpent": 450,
          "elapsedSeconds": 96.41666666666248,
          "waveSeconds": 20.283333333333463,
          "steps": 1217,
          "stats": {
            "shotsFired": 246,
            "shotsHit": 242,
            "damageDealt": 3488.519999999991
          }
        },
        {
          "wave": 5,
          "name": "혼성 부대",
          "actions": [],
          "rejected": [],
          "phase": "prepare",
          "lives": 20,
          "kills": 80,
          "leaks": 0,
          "gold": 717,
          "totalSpent": 450,
          "elapsedSeconds": 132.09999999999727,
          "waveSeconds": 35.68333333333259,
          "steps": 2141,
          "stats": {
            "shotsFired": 383,
            "shotsHit": 374,
            "damageDealt": 5423.880000000006
          }
        },
        {
          "wave": 6,
          "name": "최종 공성",
          "actions": [],
          "rejected": [],
          "phase": "won",
          "lives": 10,
          "kills": 99,
          "leaks": 1,
          "gold": 970,
          "totalSpent": 450,
          "elapsedSeconds": 207.08333333339027,
          "waveSeconds": 74.98333333333036,
          "steps": 4499,
          "stats": {
            "shotsFired": 556,
            "shotsHit": 542,
            "damageDealt": 7732.13400000003
          }
        }
      ]
    },
    {
      "family": "central-two-rapid",
      "variant": "reach",
      "result": "won",
      "finalWave": 6,
      "lives": 1,
      "kills": 94,
      "leaks": 6,
      "gold": 901,
      "totalSpent": 450,
      "elapsedSeconds": 238.06666666674826,
      "stats": {
        "shotsFired": 744,
        "shotsHit": 704,
        "damageDealt": 7447.955000000089
      },
      "waves": [
        {
          "wave": 1,
          "name": "정찰 부대",
          "actions": [
            {
              "action": "build",
              "pad": 2,
              "kind": "rapid",
              "level": 1,
              "branch": null,
              "cost": 70,
              "goldAfter": 110
            },
            {
              "action": "build",
              "pad": 3,
              "kind": "rapid",
              "level": 1,
              "branch": null,
              "cost": 70,
              "goldAfter": 40
            }
          ],
          "rejected": [
            {
              "action": "upgrade",
              "pad": 2,
              "branch": "reach",
              "price": 60,
              "goldAvailable": 40,
              "reason": "insufficient earned gold"
            },
            {
              "action": "upgrade",
              "pad": 3,
              "branch": "reach",
              "price": 60,
              "goldAvailable": 40,
              "reason": "insufficient earned gold"
            }
          ],
          "phase": "prepare",
          "lives": 20,
          "kills": 8,
          "leaks": 0,
          "gold": 144,
          "totalSpent": 140,
          "elapsedSeconds": 19.300000000000185,
          "waveSeconds": 19.300000000000185,
          "steps": 1158,
          "stats": {
            "shotsFired": 32,
            "shotsHit": 32,
            "damageDealt": 320
          }
        },
        {
          "wave": 2,
          "name": "빠른 침투",
          "actions": [
            {
              "action": "upgrade",
              "pad": 2,
              "kind": "rapid",
              "level": 2,
              "branch": "reach",
              "cost": 60,
              "goldAfter": 84
            },
            {
              "action": "upgrade",
              "pad": 3,
              "kind": "rapid",
              "level": 2,
              "branch": "reach",
              "cost": 60,
              "goldAfter": 24
            }
          ],
          "rejected": [
            {
              "action": "upgrade",
              "pad": 2,
              "branch": "reach",
              "price": 95,
              "goldAvailable": 84,
              "reason": "insufficient earned gold"
            },
            {
              "action": "upgrade",
              "pad": 3,
              "branch": "reach",
              "price": 95,
              "goldAvailable": 24,
              "reason": "insufficient earned gold"
            }
          ],
          "phase": "prepare",
          "lives": 20,
          "kills": 20,
          "leaks": 0,
          "gold": 168,
          "totalSpent": 260,
          "elapsedSeconds": 36.39999999999922,
          "waveSeconds": 17.10000000000031,
          "steps": 1026,
          "stats": {
            "shotsFired": 70,
            "shotsHit": 68,
            "damageDealt": 781.7599999999998
          }
        },
        {
          "wave": 3,
          "name": "장갑 행렬",
          "actions": [
            {
              "action": "upgrade",
              "pad": 2,
              "kind": "rapid",
              "level": 3,
              "branch": "reach",
              "cost": 95,
              "goldAfter": 73
            }
          ],
          "rejected": [
            {
              "action": "upgrade",
              "pad": 3,
              "branch": "reach",
              "price": 95,
              "goldAvailable": 73,
              "reason": "insufficient earned gold"
            }
          ],
          "phase": "prepare",
          "lives": 16,
          "kills": 28,
          "leaks": 2,
          "gold": 233,
          "totalSpent": 355,
          "elapsedSeconds": 97.88333333332906,
          "waveSeconds": 61.483333333331124,
          "steps": 3689,
          "stats": {
            "shotsFired": 240,
            "shotsHit": 235,
            "damageDealt": 1983.747499999994
          }
        },
        {
          "wave": 4,
          "name": "밀집 돌파",
          "actions": [
            {
              "action": "upgrade",
              "pad": 3,
              "kind": "rapid",
              "level": 3,
              "branch": "reach",
              "cost": 95,
              "goldAfter": 138
            }
          ],
          "rejected": [],
          "phase": "prepare",
          "lives": 16,
          "kills": 56,
          "leaks": 2,
          "gold": 408,
          "totalSpent": 450,
          "elapsedSeconds": 121.39999999999439,
          "waveSeconds": 23.516666666666612,
          "steps": 1411,
          "stats": {
            "shotsFired": 335,
            "shotsHit": 313,
            "damageDealt": 3409.5074999999897
          }
        },
        {
          "wave": 5,
          "name": "혼성 부대",
          "actions": [],
          "rejected": [],
          "phase": "prepare",
          "lives": 16,
          "kills": 78,
          "leaks": 2,
          "gold": 687,
          "totalSpent": 450,
          "elapsedSeconds": 163.08333333335526,
          "waveSeconds": 41.68333333333225,
          "steps": 2501,
          "stats": {
            "shotsFired": 523,
            "shotsHit": 492,
            "damageDealt": 5344.867500000023
          }
        },
        {
          "wave": 6,
          "name": "최종 공성",
          "actions": [],
          "rejected": [],
          "phase": "won",
          "lives": 1,
          "kills": 94,
          "leaks": 6,
          "gold": 901,
          "totalSpent": 450,
          "elapsedSeconds": 238.06666666674826,
          "waveSeconds": 74.98333333333036,
          "steps": 4499,
          "stats": {
            "shotsFired": 744,
            "shotsHit": 704,
            "damageDealt": 7447.955000000089
          }
        }
      ]
    },
    {
      "family": "late-route-two-cannon",
      "variant": "power",
      "result": "won",
      "finalWave": 6,
      "lives": 20,
      "kills": 100,
      "leaks": 0,
      "gold": 784,
      "totalSpent": 706,
      "elapsedSeconds": 228.7333333334075,
      "stats": {
        "shotsFired": 101,
        "shotsHit": 101,
        "damageDealt": 8165.830000000008
      },
      "waves": [
        {
          "wave": 1,
          "name": "정찰 부대",
          "actions": [
            {
              "action": "build",
              "pad": 4,
              "kind": "cannon",
              "level": 1,
              "branch": null,
              "cost": 110,
              "goldAfter": 70
            }
          ],
          "rejected": [
            {
              "action": "build",
              "pad": 8,
              "kind": "cannon",
              "price": 110,
              "goldAvailable": 70,
              "reason": "insufficient earned gold"
            },
            {
              "action": "upgrade",
              "pad": 4,
              "branch": "power",
              "price": 94,
              "goldAvailable": 70,
              "reason": "insufficient earned gold"
            }
          ],
          "phase": "prepare",
          "lives": 20,
          "kills": 8,
          "leaks": 0,
          "gold": 174,
          "totalSpent": 110,
          "elapsedSeconds": 36.216666666665894,
          "waveSeconds": 36.216666666665894,
          "steps": 2173,
          "stats": {
            "shotsFired": 14,
            "shotsHit": 14,
            "damageDealt": 320
          }
        },
        {
          "wave": 2,
          "name": "빠른 침투",
          "actions": [
            {
              "action": "build",
              "pad": 8,
              "kind": "cannon",
              "level": 1,
              "branch": null,
              "cost": 110,
              "goldAfter": 64
            }
          ],
          "rejected": [
            {
              "action": "upgrade",
              "pad": 4,
              "branch": "power",
              "price": 94,
              "goldAvailable": 64,
              "reason": "insufficient earned gold"
            },
            {
              "action": "upgrade",
              "pad": 8,
              "branch": "power",
              "price": 94,
              "goldAvailable": 64,
              "reason": "insufficient earned gold"
            }
          ],
          "phase": "prepare",
          "lives": 20,
          "kills": 20,
          "leaks": 0,
          "gold": 208,
          "totalSpent": 220,
          "elapsedSeconds": 66.04999999999754,
          "waveSeconds": 29.83333333333292,
          "steps": 1790,
          "stats": {
            "shotsFired": 34,
            "shotsHit": 34,
            "damageDealt": 781.7599999999998
          }
        },
        {
          "wave": 3,
          "name": "장갑 행렬",
          "actions": [
            {
              "action": "upgrade",
              "pad": 4,
              "kind": "cannon",
              "level": 2,
              "branch": "power",
              "cost": 94,
              "goldAfter": 114
            },
            {
              "action": "upgrade",
              "pad": 8,
              "kind": "cannon",
              "level": 2,
              "branch": "power",
              "cost": 94,
              "goldAfter": 20
            }
          ],
          "rejected": [
            {
              "action": "upgrade",
              "pad": 4,
              "branch": "power",
              "price": 149,
              "goldAvailable": 114,
              "reason": "insufficient earned gold"
            },
            {
              "action": "upgrade",
              "pad": 8,
              "branch": "power",
              "price": 149,
              "goldAvailable": 20,
              "reason": "insufficient earned gold"
            }
          ],
          "phase": "prepare",
          "lives": 20,
          "kills": 30,
          "leaks": 0,
          "gold": 210,
          "totalSpent": 408,
          "elapsedSeconds": 109.18333333332842,
          "waveSeconds": 43.13333333333217,
          "steps": 2588,
          "stats": {
            "shotsFired": 49,
            "shotsHit": 49,
            "damageDealt": 2062.7599999999993
          }
        },
        {
          "wave": 4,
          "name": "밀집 돌파",
          "actions": [
            {
              "action": "upgrade",
              "pad": 4,
              "kind": "cannon",
              "level": 3,
              "branch": "power",
              "cost": 149,
              "goldAfter": 61
            }
          ],
          "rejected": [
            {
              "action": "upgrade",
              "pad": 8,
              "branch": "power",
              "price": 149,
              "goldAvailable": 61,
              "reason": "insufficient earned gold"
            }
          ],
          "phase": "prepare",
          "lives": 20,
          "kills": 58,
          "leaks": 0,
          "gold": 331,
          "totalSpent": 557,
          "elapsedSeconds": 134.61666666666594,
          "waveSeconds": 25.43333333333317,
          "steps": 1526,
          "stats": {
            "shotsFired": 56,
            "shotsHit": 56,
            "damageDealt": 3488.519999999995
          }
        },
        {
          "wave": 5,
          "name": "혼성 부대",
          "actions": [
            {
              "action": "upgrade",
              "pad": 8,
              "kind": "cannon",
              "level": 3,
              "branch": "power",
              "cost": 149,
              "goldAfter": 182
            }
          ],
          "rejected": [],
          "phase": "prepare",
          "lives": 20,
          "kills": 80,
          "leaks": 0,
          "gold": 461,
          "totalSpent": 706,
          "elapsedSeconds": 177.3333333333666,
          "waveSeconds": 42.716666666665525,
          "steps": 2563,
          "stats": {
            "shotsFired": 77,
            "shotsHit": 77,
            "damageDealt": 5423.88
          }
        },
        {
          "wave": 6,
          "name": "최종 공성",
          "actions": [],
          "rejected": [],
          "phase": "won",
          "lives": 20,
          "kills": 100,
          "leaks": 0,
          "gold": 784,
          "totalSpent": 706,
          "elapsedSeconds": 228.7333333334075,
          "waveSeconds": 51.399999999998364,
          "steps": 3084,
          "stats": {
            "shotsFired": 101,
            "shotsHit": 101,
            "damageDealt": 8165.830000000008
          }
        }
      ]
    },
    {
      "family": "late-route-two-cannon",
      "variant": "reach",
      "result": "won",
      "finalWave": 6,
      "lives": 20,
      "kills": 100,
      "leaks": 0,
      "gold": 784,
      "totalSpent": 706,
      "elapsedSeconds": 229.88333333340842,
      "stats": {
        "shotsFired": 132,
        "shotsHit": 124,
        "damageDealt": 8165.829999999999
      },
      "waves": [
        {
          "wave": 1,
          "name": "정찰 부대",
          "actions": [
            {
              "action": "build",
              "pad": 4,
              "kind": "cannon",
              "level": 1,
              "branch": null,
              "cost": 110,
              "goldAfter": 70
            }
          ],
          "rejected": [
            {
              "action": "build",
              "pad": 8,
              "kind": "cannon",
              "price": 110,
              "goldAvailable": 70,
              "reason": "insufficient earned gold"
            },
            {
              "action": "upgrade",
              "pad": 4,
              "branch": "reach",
              "price": 94,
              "goldAvailable": 70,
              "reason": "insufficient earned gold"
            }
          ],
          "phase": "prepare",
          "lives": 20,
          "kills": 8,
          "leaks": 0,
          "gold": 174,
          "totalSpent": 110,
          "elapsedSeconds": 36.216666666665894,
          "waveSeconds": 36.216666666665894,
          "steps": 2173,
          "stats": {
            "shotsFired": 14,
            "shotsHit": 14,
            "damageDealt": 320
          }
        },
        {
          "wave": 2,
          "name": "빠른 침투",
          "actions": [
            {
              "action": "build",
              "pad": 8,
              "kind": "cannon",
              "level": 1,
              "branch": null,
              "cost": 110,
              "goldAfter": 64
            }
          ],
          "rejected": [
            {
              "action": "upgrade",
              "pad": 4,
              "branch": "reach",
              "price": 94,
              "goldAvailable": 64,
              "reason": "insufficient earned gold"
            },
            {
              "action": "upgrade",
              "pad": 8,
              "branch": "reach",
              "price": 94,
              "goldAvailable": 64,
              "reason": "insufficient earned gold"
            }
          ],
          "phase": "prepare",
          "lives": 20,
          "kills": 20,
          "leaks": 0,
          "gold": 208,
          "totalSpent": 220,
          "elapsedSeconds": 66.04999999999754,
          "waveSeconds": 29.83333333333292,
          "steps": 1790,
          "stats": {
            "shotsFired": 34,
            "shotsHit": 34,
            "damageDealt": 781.7599999999998
          }
        },
        {
          "wave": 3,
          "name": "장갑 행렬",
          "actions": [
            {
              "action": "upgrade",
              "pad": 4,
              "kind": "cannon",
              "level": 2,
              "branch": "reach",
              "cost": 94,
              "goldAfter": 114
            },
            {
              "action": "upgrade",
              "pad": 8,
              "kind": "cannon",
              "level": 2,
              "branch": "reach",
              "cost": 94,
              "goldAfter": 20
            }
          ],
          "rejected": [
            {
              "action": "upgrade",
              "pad": 4,
              "branch": "reach",
              "price": 149,
              "goldAvailable": 114,
              "reason": "insufficient earned gold"
            },
            {
              "action": "upgrade",
              "pad": 8,
              "branch": "reach",
              "price": 149,
              "goldAvailable": 20,
              "reason": "insufficient earned gold"
            }
          ],
          "phase": "prepare",
          "lives": 20,
          "kills": 30,
          "leaks": 0,
          "gold": 210,
          "totalSpent": 408,
          "elapsedSeconds": 113.09999999999486,
          "waveSeconds": 47.04999999999861,
          "steps": 2823,
          "stats": {
            "shotsFired": 56,
            "shotsHit": 54,
            "damageDealt": 2062.7599999999993
          }
        },
        {
          "wave": 4,
          "name": "밀집 돌파",
          "actions": [
            {
              "action": "upgrade",
              "pad": 4,
              "kind": "cannon",
              "level": 3,
              "branch": "reach",
              "cost": 149,
              "goldAfter": 61
            }
          ],
          "rejected": [
            {
              "action": "upgrade",
              "pad": 8,
              "branch": "reach",
              "price": 149,
              "goldAvailable": 61,
              "reason": "insufficient earned gold"
            }
          ],
          "phase": "prepare",
          "lives": 20,
          "kills": 58,
          "leaks": 0,
          "gold": 331,
          "totalSpent": 557,
          "elapsedSeconds": 138.53333333333572,
          "waveSeconds": 25.43333333333317,
          "steps": 1526,
          "stats": {
            "shotsFired": 65,
            "shotsHit": 63,
            "damageDealt": 3488.519999999995
          }
        },
        {
          "wave": 5,
          "name": "혼성 부대",
          "actions": [
            {
              "action": "upgrade",
              "pad": 8,
              "kind": "cannon",
              "level": 3,
              "branch": "reach",
              "cost": 149,
              "goldAfter": 182
            }
          ],
          "rejected": [],
          "phase": "prepare",
          "lives": 20,
          "kills": 80,
          "leaks": 0,
          "gold": 461,
          "totalSpent": 706,
          "elapsedSeconds": 180.21666666670222,
          "waveSeconds": 41.68333333333225,
          "steps": 2501,
          "stats": {
            "shotsFired": 95,
            "shotsHit": 91,
            "damageDealt": 5423.879999999995
          }
        },
        {
          "wave": 6,
          "name": "최종 공성",
          "actions": [],
          "rejected": [],
          "phase": "won",
          "lives": 20,
          "kills": 100,
          "leaks": 0,
          "gold": 784,
          "totalSpent": 706,
          "elapsedSeconds": 229.88333333340842,
          "waveSeconds": 49.66666666666513,
          "steps": 2980,
          "stats": {
            "shotsFired": 132,
            "shotsHit": 124,
            "damageDealt": 8165.829999999999
          }
        }
      ]
    },
    {
      "family": "frost-priority-mixed",
      "variant": "power",
      "result": "won",
      "finalWave": 6,
      "lives": 20,
      "kills": 100,
      "leaks": 0,
      "gold": 640,
      "totalSpent": 850,
      "elapsedSeconds": 158.9000000000186,
      "stats": {
        "shotsFired": 485,
        "shotsHit": 444,
        "damageDealt": 8165.829999999996
      },
      "waves": [
        {
          "wave": 1,
          "name": "정찰 부대",
          "actions": [
            {
              "action": "build",
              "pad": 2,
              "kind": "rapid",
              "level": 1,
              "branch": null,
              "cost": 70,
              "goldAfter": 110
            },
            {
              "action": "build",
              "pad": 3,
              "kind": "cannon",
              "level": 1,
              "branch": null,
              "cost": 110,
              "goldAfter": 0
            }
          ],
          "rejected": [
            {
              "action": "build",
              "pad": 1,
              "kind": "frost",
              "price": 85,
              "goldAvailable": 0,
              "reason": "insufficient earned gold"
            },
            {
              "action": "upgrade",
              "pad": 2,
              "branch": "power",
              "price": 60,
              "goldAvailable": 0,
              "reason": "insufficient earned gold"
            },
            {
              "action": "upgrade",
              "pad": 3,
              "branch": "power",
              "price": 94,
              "goldAvailable": 0,
              "reason": "insufficient earned gold"
            }
          ],
          "phase": "prepare",
          "lives": 20,
          "kills": 8,
          "leaks": 0,
          "gold": 104,
          "totalSpent": 180,
          "elapsedSeconds": 18.96666666666687,
          "waveSeconds": 18.96666666666687,
          "steps": 1138,
          "stats": {
            "shotsFired": 33,
            "shotsHit": 32,
            "damageDealt": 320
          }
        },
        {
          "wave": 2,
          "name": "빠른 침투",
          "actions": [
            {
              "action": "build",
              "pad": 1,
              "kind": "frost",
              "level": 1,
              "branch": null,
              "cost": 85,
              "goldAfter": 19
            }
          ],
          "rejected": [
            {
              "action": "upgrade",
              "pad": 1,
              "branch": "power",
              "price": 72,
              "goldAvailable": 19,
              "reason": "insufficient earned gold"
            },
            {
              "action": "upgrade",
              "pad": 2,
              "branch": "power",
              "price": 60,
              "goldAvailable": 19,
              "reason": "insufficient earned gold"
            },
            {
              "action": "upgrade",
              "pad": 3,
              "branch": "power",
              "price": 94,
              "goldAvailable": 19,
              "reason": "insufficient earned gold"
            }
          ],
          "phase": "prepare",
          "lives": 20,
          "kills": 20,
          "leaks": 0,
          "gold": 163,
          "totalSpent": 265,
          "elapsedSeconds": 38.86666666666574,
          "waveSeconds": 19.90000000000015,
          "steps": 1194,
          "stats": {
            "shotsFired": 93,
            "shotsHit": 87,
            "damageDealt": 781.7599999999998
          }
        },
        {
          "wave": 3,
          "name": "장갑 행렬",
          "actions": [
            {
              "action": "upgrade",
              "pad": 1,
              "kind": "frost",
              "level": 2,
              "branch": "power",
              "cost": 72,
              "goldAfter": 91
            },
            {
              "action": "upgrade",
              "pad": 2,
              "kind": "rapid",
              "level": 2,
              "branch": "power",
              "cost": 60,
              "goldAfter": 31
            }
          ],
          "rejected": [
            {
              "action": "upgrade",
              "pad": 1,
              "branch": "power",
              "price": 115,
              "goldAvailable": 91,
              "reason": "insufficient earned gold"
            },
            {
              "action": "upgrade",
              "pad": 2,
              "branch": "power",
              "price": 95,
              "goldAvailable": 31,
              "reason": "insufficient earned gold"
            },
            {
              "action": "upgrade",
              "pad": 3,
              "branch": "power",
              "price": 94,
              "goldAvailable": 31,
              "reason": "insufficient earned gold"
            }
          ],
          "phase": "prepare",
          "lives": 20,
          "kills": 30,
          "leaks": 0,
          "gold": 221,
          "totalSpent": 397,
          "elapsedSeconds": 75.13333333333036,
          "waveSeconds": 36.26666666666589,
          "steps": 2176,
          "stats": {
            "shotsFired": 177,
            "shotsHit": 170,
            "damageDealt": 2062.7599999999984
          }
        },
        {
          "wave": 4,
          "name": "밀집 돌파",
          "actions": [
            {
              "action": "upgrade",
              "pad": 1,
              "kind": "frost",
              "level": 3,
              "branch": "power",
              "cost": 115,
              "goldAfter": 106
            },
            {
              "action": "upgrade",
              "pad": 2,
              "kind": "rapid",
              "level": 3,
              "branch": "power",
              "cost": 95,
              "goldAfter": 11
            }
          ],
          "rejected": [
            {
              "action": "upgrade",
              "pad": 3,
              "branch": "power",
              "price": 94,
              "goldAvailable": 11,
              "reason": "insufficient earned gold"
            }
          ],
          "phase": "prepare",
          "lives": 20,
          "kills": 58,
          "leaks": 0,
          "gold": 281,
          "totalSpent": 607,
          "elapsedSeconds": 96.84999999999579,
          "waveSeconds": 21.716666666666715,
          "steps": 1303,
          "stats": {
            "shotsFired": 250,
            "shotsHit": 231,
            "damageDealt": 3488.519999999994
          }
        },
        {
          "wave": 5,
          "name": "혼성 부대",
          "actions": [
            {
              "action": "upgrade",
              "pad": 3,
              "kind": "cannon",
              "level": 2,
              "branch": "power",
              "cost": 94,
              "goldAfter": 187
            },
            {
              "action": "upgrade",
              "pad": 3,
              "kind": "cannon",
              "level": 3,
              "branch": "power",
              "cost": 149,
              "goldAfter": 38
            }
          ],
          "rejected": [],
          "phase": "prepare",
          "lives": 20,
          "kills": 80,
          "leaks": 0,
          "gold": 317,
          "totalSpent": 850,
          "elapsedSeconds": 127.84999999999403,
          "waveSeconds": 30.99999999999952,
          "steps": 1860,
          "stats": {
            "shotsFired": 369,
            "shotsHit": 338,
            "damageDealt": 5423.879999999996
          }
        },
        {
          "wave": 6,
          "name": "최종 공성",
          "actions": [],
          "rejected": [],
          "phase": "won",
          "lives": 20,
          "kills": 100,
          "leaks": 0,
          "gold": 640,
          "totalSpent": 850,
          "elapsedSeconds": 158.9000000000186,
          "waveSeconds": 31.049999999999518,
          "steps": 1863,
          "stats": {
            "shotsFired": 485,
            "shotsHit": 444,
            "damageDealt": 8165.829999999996
          }
        }
      ]
    },
    {
      "family": "frost-priority-mixed",
      "variant": "reach",
      "result": "won",
      "finalWave": 6,
      "lives": 20,
      "kills": 100,
      "leaks": 0,
      "gold": 640,
      "totalSpent": 850,
      "elapsedSeconds": 158.11666666668464,
      "stats": {
        "shotsFired": 487,
        "shotsHit": 446,
        "damageDealt": 8165.830000000003
      },
      "waves": [
        {
          "wave": 1,
          "name": "정찰 부대",
          "actions": [
            {
              "action": "build",
              "pad": 2,
              "kind": "rapid",
              "level": 1,
              "branch": null,
              "cost": 70,
              "goldAfter": 110
            },
            {
              "action": "build",
              "pad": 3,
              "kind": "cannon",
              "level": 1,
              "branch": null,
              "cost": 110,
              "goldAfter": 0
            }
          ],
          "rejected": [
            {
              "action": "build",
              "pad": 1,
              "kind": "frost",
              "price": 85,
              "goldAvailable": 0,
              "reason": "insufficient earned gold"
            },
            {
              "action": "upgrade",
              "pad": 2,
              "branch": "power",
              "price": 60,
              "goldAvailable": 0,
              "reason": "insufficient earned gold"
            },
            {
              "action": "upgrade",
              "pad": 3,
              "branch": "power",
              "price": 94,
              "goldAvailable": 0,
              "reason": "insufficient earned gold"
            }
          ],
          "phase": "prepare",
          "lives": 20,
          "kills": 8,
          "leaks": 0,
          "gold": 104,
          "totalSpent": 180,
          "elapsedSeconds": 18.96666666666687,
          "waveSeconds": 18.96666666666687,
          "steps": 1138,
          "stats": {
            "shotsFired": 33,
            "shotsHit": 32,
            "damageDealt": 320
          }
        },
        {
          "wave": 2,
          "name": "빠른 침투",
          "actions": [
            {
              "action": "build",
              "pad": 1,
              "kind": "frost",
              "level": 1,
              "branch": null,
              "cost": 85,
              "goldAfter": 19
            }
          ],
          "rejected": [
            {
              "action": "upgrade",
              "pad": 1,
              "branch": "reach",
              "price": 72,
              "goldAvailable": 19,
              "reason": "insufficient earned gold"
            },
            {
              "action": "upgrade",
              "pad": 2,
              "branch": "power",
              "price": 60,
              "goldAvailable": 19,
              "reason": "insufficient earned gold"
            },
            {
              "action": "upgrade",
              "pad": 3,
              "branch": "power",
              "price": 94,
              "goldAvailable": 19,
              "reason": "insufficient earned gold"
            }
          ],
          "phase": "prepare",
          "lives": 20,
          "kills": 20,
          "leaks": 0,
          "gold": 163,
          "totalSpent": 265,
          "elapsedSeconds": 38.86666666666574,
          "waveSeconds": 19.90000000000015,
          "steps": 1194,
          "stats": {
            "shotsFired": 93,
            "shotsHit": 87,
            "damageDealt": 781.7599999999998
          }
        },
        {
          "wave": 3,
          "name": "장갑 행렬",
          "actions": [
            {
              "action": "upgrade",
              "pad": 1,
              "kind": "frost",
              "level": 2,
              "branch": "reach",
              "cost": 72,
              "goldAfter": 91
            },
            {
              "action": "upgrade",
              "pad": 2,
              "kind": "rapid",
              "level": 2,
              "branch": "power",
              "cost": 60,
              "goldAfter": 31
            }
          ],
          "rejected": [
            {
              "action": "upgrade",
              "pad": 1,
              "branch": "reach",
              "price": 115,
              "goldAvailable": 91,
              "reason": "insufficient earned gold"
            },
            {
              "action": "upgrade",
              "pad": 2,
              "branch": "power",
              "price": 95,
              "goldAvailable": 31,
              "reason": "insufficient earned gold"
            },
            {
              "action": "upgrade",
              "pad": 3,
              "branch": "power",
              "price": 94,
              "goldAvailable": 31,
              "reason": "insufficient earned gold"
            }
          ],
          "phase": "prepare",
          "lives": 20,
          "kills": 30,
          "leaks": 0,
          "gold": 221,
          "totalSpent": 397,
          "elapsedSeconds": 73.63333333333044,
          "waveSeconds": 34.76666666666598,
          "steps": 2086,
          "stats": {
            "shotsFired": 176,
            "shotsHit": 169,
            "damageDealt": 2062.7599999999984
          }
        },
        {
          "wave": 4,
          "name": "밀집 돌파",
          "actions": [
            {
              "action": "upgrade",
              "pad": 1,
              "kind": "frost",
              "level": 3,
              "branch": "reach",
              "cost": 115,
              "goldAfter": 106
            },
            {
              "action": "upgrade",
              "pad": 2,
              "kind": "rapid",
              "level": 3,
              "branch": "power",
              "cost": 95,
              "goldAfter": 11
            }
          ],
          "rejected": [
            {
              "action": "upgrade",
              "pad": 3,
              "branch": "power",
              "price": 94,
              "goldAvailable": 11,
              "reason": "insufficient earned gold"
            }
          ],
          "phase": "prepare",
          "lives": 20,
          "kills": 58,
          "leaks": 0,
          "gold": 281,
          "totalSpent": 607,
          "elapsedSeconds": 96.0666666666625,
          "waveSeconds": 22.43333333333334,
          "steps": 1346,
          "stats": {
            "shotsFired": 252,
            "shotsHit": 234,
            "damageDealt": 3488.519999999994
          }
        },
        {
          "wave": 5,
          "name": "혼성 부대",
          "actions": [
            {
              "action": "upgrade",
              "pad": 3,
              "kind": "cannon",
              "level": 2,
              "branch": "power",
              "cost": 94,
              "goldAfter": 187
            },
            {
              "action": "upgrade",
              "pad": 3,
              "kind": "cannon",
              "level": 3,
              "branch": "power",
              "cost": 149,
              "goldAfter": 38
            }
          ],
          "rejected": [],
          "phase": "prepare",
          "lives": 20,
          "kills": 80,
          "leaks": 0,
          "gold": 317,
          "totalSpent": 850,
          "elapsedSeconds": 127.06666666666074,
          "waveSeconds": 30.99999999999952,
          "steps": 1860,
          "stats": {
            "shotsFired": 371,
            "shotsHit": 341,
            "damageDealt": 5423.879999999999
          }
        },
        {
          "wave": 6,
          "name": "최종 공성",
          "actions": [],
          "rejected": [],
          "phase": "won",
          "lives": 20,
          "kills": 100,
          "leaks": 0,
          "gold": 640,
          "totalSpent": 850,
          "elapsedSeconds": 158.11666666668464,
          "waveSeconds": 31.049999999999518,
          "steps": 1863,
          "stats": {
            "shotsFired": 487,
            "shotsHit": 446,
            "damageDealt": 8165.830000000003
          }
        }
      ]
    },
    {
      "family": "late-frost-upgrade",
      "variant": "power",
      "result": "won",
      "finalWave": 6,
      "lives": 20,
      "kills": 100,
      "leaks": 0,
      "gold": 402,
      "totalSpent": 1088,
      "elapsedSeconds": 148.2666666666768,
      "stats": {
        "shotsFired": 442,
        "shotsHit": 411,
        "damageDealt": 8165.830000000033
      },
      "waves": [
        {
          "wave": 1,
          "name": "정찰 부대",
          "actions": [
            {
              "action": "build",
              "pad": 2,
              "kind": "rapid",
              "level": 1,
              "branch": null,
              "cost": 70,
              "goldAfter": 110
            },
            {
              "action": "build",
              "pad": 3,
              "kind": "cannon",
              "level": 1,
              "branch": null,
              "cost": 110,
              "goldAfter": 0
            }
          ],
          "rejected": [],
          "phase": "prepare",
          "lives": 20,
          "kills": 8,
          "leaks": 0,
          "gold": 104,
          "totalSpent": 180,
          "elapsedSeconds": 18.96666666666687,
          "waveSeconds": 18.96666666666687,
          "steps": 1138,
          "stats": {
            "shotsFired": 33,
            "shotsHit": 32,
            "damageDealt": 320
          }
        },
        {
          "wave": 2,
          "name": "빠른 침투",
          "actions": [
            {
              "action": "build",
              "pad": 1,
              "kind": "frost",
              "level": 1,
              "branch": null,
              "cost": 85,
              "goldAfter": 19
            }
          ],
          "rejected": [],
          "phase": "prepare",
          "lives": 20,
          "kills": 20,
          "leaks": 0,
          "gold": 163,
          "totalSpent": 265,
          "elapsedSeconds": 38.86666666666574,
          "waveSeconds": 19.90000000000015,
          "steps": 1194,
          "stats": {
            "shotsFired": 93,
            "shotsHit": 87,
            "damageDealt": 781.7599999999998
          }
        },
        {
          "wave": 3,
          "name": "장갑 행렬",
          "actions": [
            {
              "action": "upgrade",
              "pad": 3,
              "kind": "cannon",
              "level": 2,
              "branch": "power",
              "cost": 94,
              "goldAfter": 69
            }
          ],
          "rejected": [],
          "phase": "prepare",
          "lives": 20,
          "kills": 30,
          "leaks": 0,
          "gold": 259,
          "totalSpent": 359,
          "elapsedSeconds": 67.68333333333078,
          "waveSeconds": 28.81666666666631,
          "steps": 1729,
          "stats": {
            "shotsFired": 172,
            "shotsHit": 164,
            "damageDealt": 2062.76
          }
        },
        {
          "wave": 4,
          "name": "밀집 돌파",
          "actions": [
            {
              "action": "upgrade",
              "pad": 2,
              "kind": "rapid",
              "level": 2,
              "branch": "power",
              "cost": 60,
              "goldAfter": 199
            },
            {
              "action": "upgrade",
              "pad": 3,
              "kind": "cannon",
              "level": 3,
              "branch": "power",
              "cost": 149,
              "goldAfter": 50
            }
          ],
          "rejected": [],
          "phase": "prepare",
          "lives": 20,
          "kills": 58,
          "leaks": 0,
          "gold": 320,
          "totalSpent": 568,
          "elapsedSeconds": 85.74999999999642,
          "waveSeconds": 18.066666666666922,
          "steps": 1084,
          "stats": {
            "shotsFired": 225,
            "shotsHit": 211,
            "damageDealt": 3488.519999999996
          }
        },
        {
          "wave": 5,
          "name": "혼성 부대",
          "actions": [
            {
              "action": "build",
              "pad": 4,
              "kind": "cannon",
              "level": 1,
              "branch": null,
              "cost": 110,
              "goldAfter": 210
            },
            {
              "action": "upgrade",
              "pad": 4,
              "kind": "cannon",
              "level": 2,
              "branch": "power",
              "cost": 94,
              "goldAfter": 116
            },
            {
              "action": "upgrade",
              "pad": 1,
              "kind": "frost",
              "level": 2,
              "branch": "power",
              "cost": 72,
              "goldAfter": 44
            }
          ],
          "rejected": [],
          "phase": "prepare",
          "lives": 20,
          "kills": 80,
          "leaks": 0,
          "gold": 323,
          "totalSpent": 844,
          "elapsedSeconds": 117.78333333332793,
          "waveSeconds": 32.0333333333328,
          "steps": 1922,
          "stats": {
            "shotsFired": 334,
            "shotsHit": 311,
            "damageDealt": 5423.880000000008
          }
        },
        {
          "wave": 6,
          "name": "최종 공성",
          "actions": [
            {
              "action": "upgrade",
              "pad": 4,
              "kind": "cannon",
              "level": 3,
              "branch": "power",
              "cost": 149,
              "goldAfter": 174
            },
            {
              "action": "upgrade",
              "pad": 2,
              "kind": "rapid",
              "level": 3,
              "branch": "power",
              "cost": 95,
              "goldAfter": 79
            }
          ],
          "rejected": [],
          "phase": "won",
          "lives": 20,
          "kills": 100,
          "leaks": 0,
          "gold": 402,
          "totalSpent": 1088,
          "elapsedSeconds": 148.2666666666768,
          "waveSeconds": 30.483333333332883,
          "steps": 1829,
          "stats": {
            "shotsFired": 442,
            "shotsHit": 411,
            "damageDealt": 8165.830000000033
          }
        }
      ]
    },
    {
      "family": "late-frost-upgrade",
      "variant": "reach",
      "result": "won",
      "finalWave": 6,
      "lives": 20,
      "kills": 100,
      "leaks": 0,
      "gold": 402,
      "totalSpent": 1088,
      "elapsedSeconds": 148.65000000001044,
      "stats": {
        "shotsFired": 444,
        "shotsHit": 412,
        "damageDealt": 8165.830000000021
      },
      "waves": [
        {
          "wave": 1,
          "name": "정찰 부대",
          "actions": [
            {
              "action": "build",
              "pad": 2,
              "kind": "rapid",
              "level": 1,
              "branch": null,
              "cost": 70,
              "goldAfter": 110
            },
            {
              "action": "build",
              "pad": 3,
              "kind": "cannon",
              "level": 1,
              "branch": null,
              "cost": 110,
              "goldAfter": 0
            }
          ],
          "rejected": [],
          "phase": "prepare",
          "lives": 20,
          "kills": 8,
          "leaks": 0,
          "gold": 104,
          "totalSpent": 180,
          "elapsedSeconds": 18.96666666666687,
          "waveSeconds": 18.96666666666687,
          "steps": 1138,
          "stats": {
            "shotsFired": 33,
            "shotsHit": 32,
            "damageDealt": 320
          }
        },
        {
          "wave": 2,
          "name": "빠른 침투",
          "actions": [
            {
              "action": "build",
              "pad": 1,
              "kind": "frost",
              "level": 1,
              "branch": null,
              "cost": 85,
              "goldAfter": 19
            }
          ],
          "rejected": [],
          "phase": "prepare",
          "lives": 20,
          "kills": 20,
          "leaks": 0,
          "gold": 163,
          "totalSpent": 265,
          "elapsedSeconds": 38.86666666666574,
          "waveSeconds": 19.90000000000015,
          "steps": 1194,
          "stats": {
            "shotsFired": 93,
            "shotsHit": 87,
            "damageDealt": 781.7599999999998
          }
        },
        {
          "wave": 3,
          "name": "장갑 행렬",
          "actions": [
            {
              "action": "upgrade",
              "pad": 3,
              "kind": "cannon",
              "level": 2,
              "branch": "power",
              "cost": 94,
              "goldAfter": 69
            }
          ],
          "rejected": [],
          "phase": "prepare",
          "lives": 20,
          "kills": 30,
          "leaks": 0,
          "gold": 259,
          "totalSpent": 359,
          "elapsedSeconds": 67.68333333333078,
          "waveSeconds": 28.81666666666631,
          "steps": 1729,
          "stats": {
            "shotsFired": 172,
            "shotsHit": 164,
            "damageDealt": 2062.76
          }
        },
        {
          "wave": 4,
          "name": "밀집 돌파",
          "actions": [
            {
              "action": "upgrade",
              "pad": 2,
              "kind": "rapid",
              "level": 2,
              "branch": "power",
              "cost": 60,
              "goldAfter": 199
            },
            {
              "action": "upgrade",
              "pad": 3,
              "kind": "cannon",
              "level": 3,
              "branch": "power",
              "cost": 149,
              "goldAfter": 50
            }
          ],
          "rejected": [],
          "phase": "prepare",
          "lives": 20,
          "kills": 58,
          "leaks": 0,
          "gold": 320,
          "totalSpent": 568,
          "elapsedSeconds": 85.74999999999642,
          "waveSeconds": 18.066666666666922,
          "steps": 1084,
          "stats": {
            "shotsFired": 225,
            "shotsHit": 211,
            "damageDealt": 3488.519999999996
          }
        },
        {
          "wave": 5,
          "name": "혼성 부대",
          "actions": [
            {
              "action": "build",
              "pad": 4,
              "kind": "cannon",
              "level": 1,
              "branch": null,
              "cost": 110,
              "goldAfter": 210
            },
            {
              "action": "upgrade",
              "pad": 4,
              "kind": "cannon",
              "level": 2,
              "branch": "power",
              "cost": 94,
              "goldAfter": 116
            },
            {
              "action": "upgrade",
              "pad": 1,
              "kind": "frost",
              "level": 2,
              "branch": "reach",
              "cost": 72,
              "goldAfter": 44
            }
          ],
          "rejected": [],
          "phase": "prepare",
          "lives": 20,
          "kills": 80,
          "leaks": 0,
          "gold": 323,
          "totalSpent": 844,
          "elapsedSeconds": 117.78333333332793,
          "waveSeconds": 32.0333333333328,
          "steps": 1922,
          "stats": {
            "shotsFired": 334,
            "shotsHit": 311,
            "damageDealt": 5423.880000000005
          }
        },
        {
          "wave": 6,
          "name": "최종 공성",
          "actions": [
            {
              "action": "upgrade",
              "pad": 4,
              "kind": "cannon",
              "level": 3,
              "branch": "power",
              "cost": 149,
              "goldAfter": 174
            },
            {
              "action": "upgrade",
              "pad": 2,
              "kind": "rapid",
              "level": 3,
              "branch": "power",
              "cost": 95,
              "goldAfter": 79
            }
          ],
          "rejected": [],
          "phase": "won",
          "lives": 20,
          "kills": 100,
          "leaks": 0,
          "gold": 402,
          "totalSpent": 1088,
          "elapsedSeconds": 148.65000000001044,
          "waveSeconds": 30.866666666666195,
          "steps": 1852,
          "stats": {
            "shotsFired": 444,
            "shotsHit": 412,
            "damageDealt": 8165.830000000021
          }
        }
      ]
    }
  ],
  "limits": [
    "No exhaustive pad permutation, all mixed-kind assignments, sales, adaptive policies or intra-wave control.",
    "A legal failure is evidence for this policy, not impossibility of the branch.",
    "Outcomes do not establish fun, readability, retention or a globally dominant strategy."
  ],
  "baselineChecks": [
    {
      "family": "reference-mixed",
      "previousPolicy": "mixed",
      "matched": true,
      "fields": [
        "result",
        "lives",
        "kills",
        "leaks",
        "gold",
        "totalSpent",
        "elapsedSeconds"
      ]
    },
    {
      "family": "greedy-cannon",
      "previousPolicy": "cannon-only",
      "matched": true,
      "fields": [
        "result",
        "lives",
        "kills",
        "leaks",
        "gold",
        "totalSpent",
        "elapsedSeconds"
      ]
    },
    {
      "family": "greedy-rapid",
      "previousPolicy": "rapid-only",
      "matched": true,
      "fields": [
        "result",
        "lives",
        "kills",
        "leaks",
        "gold",
        "totalSpent",
        "elapsedSeconds"
      ]
    }
  ],
  "receiptParity": [
    {
      "family": "reference-mixed",
      "sameSuccessfulPurchaseOrderAndWave": true,
      "sameSpent": true,
      "powerSuccessfulBuilds": 4,
      "powerSuccessfulUpgrades": 6,
      "reachSuccessfulBuilds": 4,
      "reachSuccessfulUpgrades": 6
    },
    {
      "family": "greedy-cannon",
      "sameSuccessfulPurchaseOrderAndWave": true,
      "sameSpent": true,
      "powerSuccessfulBuilds": 8,
      "powerSuccessfulUpgrades": 2,
      "reachSuccessfulBuilds": 8,
      "reachSuccessfulUpgrades": 2
    },
    {
      "family": "greedy-rapid",
      "sameSuccessfulPurchaseOrderAndWave": true,
      "sameSpent": true,
      "powerSuccessfulBuilds": 8,
      "powerSuccessfulUpgrades": 7,
      "reachSuccessfulBuilds": 8,
      "reachSuccessfulUpgrades": 7
    },
    {
      "family": "greedy-mixed",
      "sameSuccessfulPurchaseOrderAndWave": true,
      "sameSpent": true,
      "powerSuccessfulBuilds": 8,
      "powerSuccessfulUpgrades": 4,
      "reachSuccessfulBuilds": 8,
      "reachSuccessfulUpgrades": 4
    },
    {
      "family": "central-two-cannon",
      "sameSuccessfulPurchaseOrderAndWave": true,
      "sameSpent": true,
      "powerSuccessfulBuilds": 2,
      "powerSuccessfulUpgrades": 4,
      "reachSuccessfulBuilds": 2,
      "reachSuccessfulUpgrades": 4
    },
    {
      "family": "central-two-rapid",
      "sameSuccessfulPurchaseOrderAndWave": true,
      "sameSpent": true,
      "powerSuccessfulBuilds": 2,
      "powerSuccessfulUpgrades": 4,
      "reachSuccessfulBuilds": 2,
      "reachSuccessfulUpgrades": 4
    },
    {
      "family": "late-route-two-cannon",
      "sameSuccessfulPurchaseOrderAndWave": true,
      "sameSpent": true,
      "powerSuccessfulBuilds": 2,
      "powerSuccessfulUpgrades": 4,
      "reachSuccessfulBuilds": 2,
      "reachSuccessfulUpgrades": 4
    },
    {
      "family": "frost-priority-mixed",
      "sameSuccessfulPurchaseOrderAndWave": true,
      "sameSpent": true,
      "powerSuccessfulBuilds": 3,
      "powerSuccessfulUpgrades": 6,
      "reachSuccessfulBuilds": 3,
      "reachSuccessfulUpgrades": 6
    },
    {
      "family": "late-frost-upgrade",
      "sameSuccessfulPurchaseOrderAndWave": true,
      "sameSpent": true,
      "powerSuccessfulBuilds": 4,
      "powerSuccessfulUpgrades": 7,
      "reachSuccessfulBuilds": 4,
      "reachSuccessfulUpgrades": 7
    }
  ]
}
```

## 재현용 프로그램

프로젝트 루트에서 Node 24.19+의 node --input-type=module에 아래 모듈을 stdin으로 전달한다. 실행한 정책/도메인 호출은 그대로이며 최종 JSON 파일 생성 부분만 stdout 출력으로 바꿨다. 도메인 SHA가 달라지면 중단한다. CI 게이트가 아니다.

```js

import {createHash} from 'node:crypto'
import {readFile,writeFile} from 'node:fs/promises'
import {pathToFileURL} from 'node:url'
import {performance} from 'node:perf_hooks'
import {resolve} from 'node:path'
const startedAt=new Date().toISOString(),wallStart=performance.now()
const sourcePath='app/src/domain/minigame/tower-defense.ts'
const hash=buffer=>createHash('sha256').update(buffer).digest('hex')
const sourceSha256=hash(await readFile(sourcePath))
if(sourceSha256!=='6ccc32c23c882970fba847b9680d36043baf57303dcd85ac10f239502fb81605')throw Error('Domain changed; do not compare to previous evidence.')
const {newTowerDefense,buildTower,upgradeTower,startTowerWave,stepTowerDefense,TD_VERSION,TD_WAVES,TD_TOWERS,upgradeCost,towerStats}=await import(pathToFileURL(resolve(sourcePath)).href)
const dt=1/60,maxStepsPerWave=12000
const B=(pad,kind)=>({action:'build',pad,kind}),U=pad=>({action:'upgrade',pad})
const reference=[
[B(2,'rapid'),B(3,'cannon')],[B(1,'frost')],[U(3)],[U(2),U(3)],[B(4,'cannon'),U(4)],[U(4),U(2)]
]
const families=[
{id:'reference-mixed',mode:'scripted',plan:reference,branchScope:'all',description:'Original six-wave mixed plan, only the selected upgrade branch changes.'},
{id:'greedy-cannon',mode:'greedy',builds:[2,3,4,5,8,1,6,7].map(p=>B(p,'cannon')),branchScope:'all',description:'Original single-kind priority: attempt all construction, then fully upgrade in construction order.'},
{id:'greedy-rapid',mode:'greedy',builds:[2,3,4,5,8,1,6,7].map(p=>B(p,'rapid')),branchScope:'all',description:'Original single-kind priority with rapid towers.'},
{id:'greedy-mixed',mode:'greedy',builds:[B(2,'rapid'),B(3,'cannon'),B(4,'frost'),B(5,'cannon'),B(8,'rapid'),B(1,'frost'),B(6,'cannon'),B(7,'rapid')],branchScope:'all',description:'Construction-first mixed coverage; all available pads have a predeclared type.'},
{id:'central-two-cannon',mode:'greedy',builds:[B(3,'cannon'),B(4,'cannon')],branchScope:'all',description:'Two fixed central cannon pads; do not expand beyond these pads.'},
{id:'central-two-rapid',mode:'greedy',builds:[B(2,'rapid'),B(3,'rapid')],branchScope:'all',description:'Two fixed central rapid pads; do not expand beyond these pads.'},
{id:'late-route-two-cannon',mode:'greedy',builds:[B(4,'cannon'),B(8,'cannon')],branchScope:'all',description:'Two downstream cannon pads; geometric comparison, no early-defense subsidy.'},
{id:'frost-priority-mixed',mode:'greedy',builds:[B(2,'rapid'),B(3,'cannon'),B(1,'frost')],upgradePriority:[1,2,3],branchScope:'frost-only',description:'Build three specified mixed towers first, upgrade the frost tower first; attack towers always use power.'},
{id:'late-frost-upgrade',mode:'scripted',plan:reference.map((actions,i)=>i===4?[...actions,U(1)]:actions),branchScope:'frost-only',description:'Original mixed plan plus one frost level-2 upgrade before wave 5; attack towers always use power.'}
]
function selectedBranch(family,variant,tower){return family.branchScope==='all'||tower.kind==='frost'?variant:'power'}
function run(family,variant){
 const s=newTowerDefense(),waves=[]
 function apply(action,receipts,rejections){
  const pad=action.pad-1,tower=s.towers.find(t=>t.pad===pad)
  if(action.action==='build'&&tower)return false
  if(action.action==='upgrade'&&(!tower||tower.level===3))return false
  const goldBefore=s.gold,branch=action.action==='upgrade'?selectedBranch(family,variant,tower):undefined
  const price=action.action==='build'?TD_TOWERS[action.kind].cost:upgradeCost(tower)
  const ok=action.action==='build'?buildTower(s,pad,action.kind):upgradeTower(s,pad,branch)
  if(ok){
   const t=s.towers.find(t=>t.pad===pad)
   receipts.push({action:action.action,pad:action.pad,kind:t.kind,level:t.level,branch:t.branch,cost:goldBefore-s.gold,goldAfter:s.gold})
  }else rejections.push({...action,...(branch?{branch}:{}),price,goldAvailable:goldBefore,reason:goldBefore<price?'insufficient earned gold':'domain rejected'})
  if(s.gold<0)throw Error('Negative gold')
  return ok
 }
 for(let i=0;i<TD_WAVES.length;i++){
  const actions=[],rejected=[]
  if(family.mode==='scripted'){
   for(const action of family.plan[i])apply(action,actions,rejected)
  }else{
   for(const action of family.builds)apply(action,actions,rejected)
   const pads=family.upgradePriority??s.towers.map(t=>t.pad+1)
   for(const pad of pads)while(apply(U(pad),actions,rejected)){}
  }
  if(!startTowerWave(s))throw Error('Cannot start wave')
  let steps=0
  while(s.phase==='wave'&&steps<maxStepsPerWave){stepTowerDefense(s,dt);steps++}
  if(s.phase==='wave')throw Error('Step limit')
  waves.push({wave:s.wave,name:TD_WAVES[i].name,actions,rejected,phase:s.phase,lives:s.lives,kills:s.kills,leaks:s.leaks,gold:s.gold,
   totalSpent:s.towers.reduce((sum,t)=>sum+t.spent,0),elapsedSeconds:s.time,waveSeconds:s.waveTime,steps,
   stats:{...s.stats},towers:s.towers.map(t=>({pad:t.pad+1,kind:t.kind,level:t.level,branch:t.branch,spent:t.spent,kills:t.kills,damageDealt:t.damageDealt,shotsFired:t.shotsFired,stats:towerStats(t)}))})
  if(s.phase==='lost')break
 }
 return {family:family.id,variant,result:s.phase,finalWave:s.wave,lives:s.lives,kills:s.kills,leaks:s.leaks,gold:s.gold,totalSpent:s.towers.reduce((sum,t)=>sum+t.spent,0),
 elapsedSeconds:s.time,stats:{...s.stats},waves}
}
const results=families.flatMap(f=>['power','reach'].map(v=>run(f,v)))
const afterHash=hash(await readFile(sourcePath))
if(afterHash!==sourceSha256)throw Error('Domain changed during experiment')
const report={
 formatVersion:1,startedAt,finishedAt:new Date().toISOString(),wallSeconds:(performance.now()-wallStart)/1000,runtime:process.version,
 source:{path:sourcePath,sha256:sourceSha256,sha256After:afterHash},
 previousProbe:{path:'.tools/probe-tower-defense-balance.mjs',sha256:hash(await readFile('.tools/probe-tower-defense-balance.mjs'))},
 protocol:{rulesVersion:TD_VERSION,dtSeconds:dt,maxStepsPerWave,startingGold:180,startingLives:20,padNumbering:'1-based UI pad numbers',
 plannedRuns:18,selection:'Nine predeclared policy families x two branch variants, not exhaustive search. No selection was changed after inspecting results.',
 economy:'Only successful public buildTower/upgradeTower operations spend earned gold. No sale, injected state, mid-wave purchases or rewritten enemy data. Failed unaffordable attempts are logged and skipped; greedy policies reconsider before the next wave.',
 comparison:'Variant switches all level-2 branches unless branchScope is frost-only, where attack towers remain power. Level-3 upgrades retain the chosen branch. Branch prices are identical; leaked bounties can change later affordable purchases.',
 timeBasis:'Actual simulated domain seconds, including projectile/effect cleanup, excluding human choice time; not wall time or a human completion claim.'},
 families,results,
 limits:['No exhaustive pad permutation, all mixed-kind assignments, sales, adaptive policies or intra-wave control.','A legal failure is evidence for this policy, not impossibility of the branch.','Outcomes do not establish fun, readability, retention or a globally dominant strategy.']
}
console.log(JSON.stringify(report,null,2))

```
