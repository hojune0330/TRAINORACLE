# 트레인오라클 상세 훈련 확장 카탈로그

```yaml
status: DRAFT_CATALOG_NOT_RUNTIME
execution_authority: NONE
reviewed_on: 2026-09-30
existing_configurations: 37
added_configurations: 80
combined_configurations: 117
added_method_groups: 50
new_runtime_activations: 0
```

## 숫자의 의미

기존 37개 구성에 80개를 추가했다. 합계 117개는 수치 변형을 포함한 **구성 수**이지 독립된 훈련법 수가 아니다.
새 구성은 목적과 방법을 함께 묶은 50개 방법군으로 분류했다. 같은 방법군의 다른 수치·순서는 동등한 부담이나 효과를 뜻하지 않는다.
새 항목은 정확한 반복·세트·회복을 계산할 수 있는 본운동 데이터다. 공개 앱 자동 처방에 연결된 새 항목은 아직 0개다.
기존 LT 파일럿 승인은 그대로 유지한다. 원본 37개 제안이나 과거 채택 지문을 덮어쓰지 않았다.
개인 기록·메모를 포함하지 않는다. 외부 전문가 승인, 청소년별 용량 검증, 독립 에이전트 검수라고 주장하지 않는다.

## 목적별 전체 수

| 목적 | 기존 | 추가 | 합계 | 추가분 방법군 |
|---|---:|---:|---:|---:|
| BASE | 4 | 12 | 16 | 6 |
| LT | 6 | 14 | 20 | 9 |
| VO2 | 7 | 14 | 21 | 8 |
| ATP-PC | 7 | 11 | 18 | 6 |
| GLY | 4 | 9 | 13 | 4 |
| MIX | 7 | 12 | 19 | 10 |
| REC | 1 | 8 | 9 | 7 |
| OFF | 1 | 0 | 1 | 0 |

## 사용하는 방식

- 사용자에게 117개 목록을 고르게 하지 않는다. 채택 후에는 목적·기록·경험·장소·가능 시간·주기 맥락으로 고른 한 안을 제시한다.
- `다른 훈련`은 같은 목적의 적합한 풀에서 다른 방법을 우선하고, 충분한 안이 없으면 없다고 알린다. 고정 짝을 만들지 않는다.
- ± 조절은 향후 채택된 수치 범위 안에서만 허용한다. 새 구성이 많아져도 강도·양·빈도를 자동으로 늘리지 않는다.
- 새 세트의 RPE는 의도한 노력 범위이며 실제 LT·VO2·ATP-PC 측정값이 아니다. 개인 초/페이스는 기존 검토 모델과 연결해야 한다.
- 100~400m 전문선수 계획 개방은 아니다. 청소년·혼자 훈련하는 사용자는 검토 대상에 포함하며 일괄 배제하지 않는다.

## 읽는 법과 시간

`r`은 반복 사이, `R`은 세트 사이 회복이다. `종료 뒤`는 바로 앞 구간/묶음이 끝난 뒤의 명시적 회복이다.
Walk/Jog/Stand는 걷기/조깅/서서 쉬기다. HIGH_OUTPUT_CONTROLLED는 자세와 출력을 유지하는 짧은 고출력이며 개인 속도 미지정이다.
표의 시간은 본운동과 그 안의 회복만 포함한다. 준비·정리와 연결하지 않았으므로 전체 운동 가능시간에 맞는다고 확정할 수 없다.
거리형·플로트·언덕 복귀 시간이 미정이면 합계를 추정하지 않는다. 언덕의 마지막 복귀·정리는 별도 명시된 경우 외에는 지원 구성에서 추가 확인한다.
자전거·걷기·수영 등은 방식별로 보존한다. 러닝 거리나 동일한 부하로 바꾸지 않는다.

## 추가 구성 전체

| ID | 훈련 | 본운동 표기 | 운동 방식 / 지형 | 본운동+내부 회복 시간 |
|---|---|---|---|---|
| X-BASE-01 | 저강도 조깅 · Easy Run | 45min @ RPE 3–4 | 달리기 / 평지 | 2700s (45min) |
| X-BASE-02 | 거리형 조깅 · Easy Run | 8km @ RPE 3–4 | 달리기 / 평지 | 미산출 |
| X-BASE-03 | 시간형 롱런 · Long Run | 60min @ RPE 3–4 | 달리기 / 평지 | 3600s (60min) |
| X-BASE-04 | 거리형 롱런 · Long Run | 12km @ RPE 3–4 | 달리기 / 평지 | 미산출 |
| X-BASE-05 | 걷기를 섞는 조깅 · Run/Walk | 3 × 12min @ RPE 3–4 · r60s Walk | 달리기 / 평지 | 2280s (38min) |
| X-BASE-06 | 거리형 런워크 · Run/Walk | 3 × 2km @ RPE 3–4 · r60s Walk | 달리기 / 평지 | 미산출 |
| X-BASE-07 | 점진 조깅 · Progressive Easy | 20min @ RPE 3 → 15min @ RPE 4 | 달리기 / 평지 | 2100s (35min) |
| X-BASE-08 | 리듬 조깅 · Easy Waves | 3 × (10min @ RPE 3 → 5min @ RPE 4) | 달리기 / 평지 | 2700s (45min) |
| X-BASE-09 | 중간 걷기 조깅 · Split Easy | 22min @ RPE 3–4 → 종료 뒤 2min Walk → 23min @ RPE 3–4 | 달리기 / 평지 | 2820s (47min) |
| X-BASE-10 | 올렸다 내리는 조깅 · Easy Wave | 10min @ RPE 3 → 15min @ RPE 4 → 10min @ RPE 3 | 달리기 / 평지 | 2100s (35min) |
| X-LT-01 | 1km 크루즈 인터벌 | 5 × 1km @ RPE 6–7 · r60s Jog | 달리기 / 평지 | 미산출 |
| X-LT-02 | 2km 크루즈 인터벌 | 3 × 2km @ RPE 6–7 · r2min Jog | 달리기 / 평지 | 미산출 |
| X-LT-03 | 3km 크루즈 인터벌 | 2 × 3km @ RPE 6–7 · r3min Jog | 달리기 / 평지 | 미산출 |
| X-LT-04 | 시간 피라미드 · Tempo Pyramid | 6min @ RPE 6–7 → 종료 뒤 60s Jog → 8min @ RPE 6–7 → 종료 뒤 60s Jog → 6min @ RPE 6–7 | 달리기 / 평지 | 1320s (22min) |
| X-LT-05 | 늘려가는 템포 · Ascending Ladder | 4min @ RPE 6–7 → 종료 뒤 60s Jog → 6min @ RPE 6–7 → 종료 뒤 60s Jog → 8min @ RPE 6–7 | 달리기 / 평지 | 1200s (20min) |
| X-LT-06 | 줄여가는 템포 · Descending Ladder | 8min @ RPE 6–7 → 종료 뒤 60s Jog → 6min @ RPE 6–7 → 종료 뒤 60s Jog → 4min @ RPE 6–7 | 달리기 / 평지 | 1200s (20min) |
| X-LT-07 | 세트형 크루즈 인터벌 | 2 sets × (3 × 4min @ RPE 6–7 · r45s Jog) · R3min Walk/Stand | 달리기 / 평지 | 1800s (30min) |
| X-LT-08 | 1km + 200m 플로트 · Cruise Float | 4 × (1km @ RPE 6–7 → 종료 뒤 200m Roll-on) | 달리기 / 평지 | 미산출 |
| X-LT-09 | 6분 + 2분 플로트 · Cruise Float | 3 × (6min @ RPE 6–7 → 종료 뒤 2min Jog) | 달리기 / 평지 | 1440s (24min) |
| X-LT-10 | 강도 교대 템포 · Tempo Alternations | 3 × (5min @ RPE 6 → 2min @ RPE 7) | 달리기 / 평지 | 1260s (21min) |
| X-LT-11 | 10 + 5 + 5분 템포 | 10min @ RPE 6–7 → 종료 뒤 60s Jog → 5min @ RPE 6–7 → 종료 뒤 60s Jog → 5min @ RPE 6–7 | 달리기 / 평지 | 1320s (22min) |
| X-LT-12 | 1200 + 800m 세트 | 2 sets × (1200m @ RPE 6–7 → 종료 뒤 60s Jog → 800m @ RPE 6–7) · R3min Walk/Stand | 달리기 / 평지 | 미산출 |
| X-VO2-01 | 400m 인터벌 | 8 × 400m @ RPE 7–8 · r90s Jog | 달리기 / 평지 | 미산출 |
| X-VO2-02 | 800m 인터벌 | 5 × 800m @ RPE 7–8 · r2min Jog | 달리기 / 평지 | 미산출 |
| X-VO2-03 | 1km 인터벌 | 4 × 1km @ RPE 7–8 · r150s Jog | 달리기 / 평지 | 미산출 |
| X-VO2-04 | 200–800m 피라미드 | 200m @ RPE 7–8 → 종료 뒤 90s Jog → 400m @ RPE 7–8 → 종료 뒤 90s Jog → 600m @ RPE 7–8 → 종료 뒤 90s Jog → 800m @ RPE 7–8 → 종료 뒤 90s Jog → 600m @ RPE 7–8 → 종료 뒤 90s Jog → 400m @ RPE 7–8 → 종료 뒤 90s Jog → 200m @ RPE 7–8 | 달리기 / 평지 | 미산출 |
| X-VO2-05 | 400 + 600m 세트 | 3 sets × (400m @ RPE 7–8 → 종료 뒤 90s Jog → 600m @ RPE 7–8) · R3min Walk/Stand | 달리기 / 평지 | 미산출 |
| X-VO2-06 | 1분 반복 세트 | 2 sets × (4 × 1min @ RPE 7–8 · r60s Jog) · R3min Walk/Stand | 달리기 / 평지 | 1020s (17min) |
| X-VO2-07 | 30/30 인터벌 | 2 sets × (8 × 30s @ RPE 7–8 · r30s Jog) · R3min Walk/Stand | 달리기 / 평지 | 1080s (18min) |
| X-VO2-08 | 15/15 인터벌 | 3 sets × (6 × 15s @ RPE 7–8 · r15s Jog) · R3min Walk/Stand | 달리기 / 평지 | 855s (14.25min) |
| X-VO2-09 | 2–4분 피라미드 | 2min @ RPE 7–8 → 종료 뒤 2min Jog → 3min @ RPE 7–8 → 종료 뒤 2min Jog → 4min @ RPE 7–8 → 종료 뒤 2min Jog → 3min @ RPE 7–8 → 종료 뒤 2min Jog → 2min @ RPE 7–8 | 달리기 / 평지 | 1320s (22min) |
| X-VO2-10 | 4–1분 사다리 | 4min @ RPE 7–8 → 종료 뒤 2min Jog → 3min @ RPE 7–8 → 종료 뒤 2min Jog → 2min @ RPE 7–8 → 종료 뒤 2min Jog → 1min @ RPE 7–8 | 달리기 / 평지 | 960s (16min) |
| X-VO2-11 | 90–30초 사다리 세트 | 2 sets × (90s @ RPE 7–8 → 종료 뒤 60s Jog → 1min @ RPE 7–8 → 종료 뒤 60s Jog → 30s @ RPE 7–8) · R3min Walk/Stand | 달리기 / 평지 | 780s (13min) |
| X-VO2-12 | 분할 2분 인터벌 · Broken Intervals | 6 × (1min @ RPE 7–8 → 종료 뒤 30s Jog → 1min @ RPE 7–8) · r2min Jog | 달리기 / 평지 | 1500s (25min) |
| X-ATP-01 | 30m 가속 · Accelerations | 6 × 30m @ HIGH_OUTPUT_CONTROLLED · r3min Walk/Stand | 달리기 / 평지 | 미산출 |
| X-ATP-02 | 50m 가속 · Accelerations | 4 × 50m @ HIGH_OUTPUT_CONTROLLED · r4min Walk/Stand | 달리기 / 평지 | 미산출 |
| X-ATP-03 | 60m 가속 · Accelerations | 4 × 60m @ HIGH_OUTPUT_CONTROLLED · r5min Walk/Stand | 달리기 / 평지 | 미산출 |
| X-ATP-04 | 플라잉 20m · Flying Sprint | 4 × (30m @ Build-up (전력질주 아님) → 20m @ HIGH_OUTPUT_CONTROLLED) · r5min Walk/Stand | 달리기 / 평지 | 미산출 |
| X-ATP-05 | 20m 가속 세트 | 3 sets × (2 × 20m @ HIGH_OUTPUT_CONTROLLED · r2min Walk/Stand) · R5min Walk/Stand | 달리기 / 평지 | 미산출 |
| X-ATP-06 | 5–7–5초 가속 | 5s @ HIGH_OUTPUT_CONTROLLED → 종료 뒤 3min Walk/Stand → 7s @ HIGH_OUTPUT_CONTROLLED → 종료 뒤 4min Walk/Stand → 5s @ HIGH_OUTPUT_CONTROLLED | 달리기 / 평지 | 437s (7.28min) |
| X-ATP-07 | 가속–빠른 구간–감속 | 4 × (10m @ Build-up (전력질주 아님) → 20m @ HIGH_OUTPUT_CONTROLLED → 10m @ CONTROLLED_DECELERATION) · r4min Walk/Stand | 달리기 / 평지 | 미산출 |
| X-ATP-08 | 10 + 30m 가속 세트 | 3 sets × (10m @ HIGH_OUTPUT_CONTROLLED → 종료 뒤 3min Walk/Stand → 30m @ HIGH_OUTPUT_CONTROLLED) · R5min Walk/Stand | 달리기 / 평지 | 미산출 |
| X-GLY-01 | 150m 고강도 반복 | 5 × 150m @ RPE 8–9 · r3min Walk/Stand | 달리기 / 평지 | 미산출 |
| X-GLY-02 | 300m 고강도 반복 | 4 × 300m @ RPE 8–9 · r4min Walk/Stand | 달리기 / 평지 | 미산출 |
| X-GLY-03 | 400m 고강도 반복 | 3 × 400m @ RPE 8–9 · r5min Walk/Stand | 달리기 / 평지 | 미산출 |
| X-GLY-04 | 150 + 150m 분할 세트 | 3 sets × (150m @ RPE 8–9 → 종료 뒤 45s Walk/Stand → 150m @ RPE 8–9) · R5min Walk/Stand | 달리기 / 평지 | 미산출 |
| X-GLY-05 | 200 + 100m 분할 세트 | 2 sets × (200m @ RPE 8–9 → 종료 뒤 60s Walk/Stand → 100m @ RPE 8–9) · R6min Walk/Stand | 달리기 / 평지 | 미산출 |
| X-GLY-06 | 300–150m 사다리 | 300m @ RPE 8–9 → 종료 뒤 4min Walk/Stand → 200m @ RPE 8–9 → 종료 뒤 4min Walk/Stand → 150m @ RPE 8–9 | 달리기 / 평지 | 미산출 |
| X-GLY-07 | 40초 고강도 반복 | 5 × 40s @ RPE 8–9 · r3min Walk/Stand | 달리기 / 평지 | 920s (15.33min) |
| X-GLY-08 | 20 + 20초 분할 세트 | 3 sets × (20s @ RPE 8–9 → 종료 뒤 40s Walk/Stand → 20s @ RPE 8–9) · R4min Walk/Stand | 달리기 / 평지 | 720s (12min) |
| X-MIX-01 | 1–3분 파틀렉 · Fartlek Pyramid | 1min @ RPE 6–7 → 종료 뒤 60s Jog → 2min @ RPE 7–8 → 종료 뒤 2min Jog → 3min @ RPE 7–8 → 종료 뒤 3min Jog → 2min @ RPE 7–8 → 종료 뒤 2min Jog → 1min @ RPE 6–7 | 달리기 / 평지 | 1020s (17min) |
| X-MIX-02 | 템포 + 인터벌 세트 | 3 sets × (3min @ RPE 6–7 → 종료 뒤 60s Jog → 1min @ RPE 7–8) · R2min Walk/Stand | 달리기 / 평지 | 1140s (19min) |
| X-MIX-03 | 1km 템포 + 200m 반복 | 3 sets × (1km @ RPE 6–7 → 종료 뒤 60s Jog → 200m @ RPE 8–9) · R3min Walk/Stand | 달리기 / 평지 | 미산출 |
| X-MIX-04 | 800m 인터벌 + 400m 템포 | 3 × (800m @ RPE 7–8 → 종료 뒤 90s Jog → 400m @ RPE 6–7) · r60s Jog | 달리기 / 평지 | 미산출 |
| X-MIX-05 | 2km 스테디 + 400m 인터벌 | 2 sets × (2km @ RPE 5 → 종료 뒤 2min Jog → 400m @ RPE 7–8) · R4min Walk/Stand | 달리기 / 평지 | 미산출 |
| X-MIX-06 | 조깅 + 10초 고출력 | 20min @ RPE 3–4 → 6 × 10s @ HIGH_OUTPUT_CONTROLLED · r90s Walk | 달리기 / 평지 | 1710s (28.5min) |
| X-MIX-07 | 템포 + 점진 가속 | 12min @ RPE 6–7 → 종료 뒤 3min Jog → 4 × 20s @ Build-up (전력질주 아님) · r2min Walk | 달리기 / 평지 | 1340s (22.33min) |
| X-MIX-08 | 200m 교대 · Alternating 200s | 4 × (200m @ RPE 7–8 → 200m @ RPE 5) | 달리기 / 평지 | 미산출 |
| X-MIX-09 | 템포–인터벌–고강도 세트 | 3 sets × (4min @ RPE 6–7 → 종료 뒤 60s Jog → 2min @ RPE 7–8 → 종료 뒤 2min Jog → 20s @ RPE 8–9) · R4min Walk/Stand | 달리기 / 평지 | 2160s (36min) |
| X-MIX-10 | 1km–800m–400m 복합 | 1km @ RPE 6–7 → 종료 뒤 2min Jog → 800m @ RPE 7–8 → 종료 뒤 150s Jog → 400m @ RPE 8–9 | 달리기 / 평지 | 미산출 |
| X-REC-01 | 회복 조깅 · Recovery Jog | 15min @ RPE 1–2 | 달리기 / 평지 | 900s (15min) |
| X-REC-02 | 걷기 중심 런워크 | 8 × (1min @ RPE 1–2 → 2min @ RPE 1–2) | 달리기 + 걷기 / 평지 | 1440s (24min) |
| X-REC-03 | 가벼운 자전거 · Easy Bike | 20min @ RPE 1–2 | 자전거 / 실내 장비 | 1200s (20min) |
| X-REC-04 | 가벼운 일립티컬 | 15min @ RPE 1–2 | 일립티컬 / 실내 장비 | 900s (15min) |
| X-REC-05 | 수중 달리기 · Aqua Jog | 15min @ RPE 1–2 | 수중 달리기 / 수영장 | 900s (15min) |
| X-REC-06 | 가벼운 수영 · Easy Swim | 10min @ RPE 1–2 | 수영 / 수영장 | 600s (10min) |
| X-REC-07 | 자전거 + 걷기 | 10min @ RPE 1–2 → 10min @ RPE 1–2 | 자전거 + 걷기 / 실내 장비 + 평지 | 1200s (20min) |
| X-REC-08 | 걷기–조깅–걷기 | 5min @ RPE 1–2 → 10min @ RPE 1–2 → 5min @ RPE 1–2 | 걷기 + 달리기 / 평지 | 1200s (20min) |
| X-HILL-01 | 8초 언덕 가속 · Hill Sprint | 6 × 8s @ HIGH_OUTPUT_CONTROLLED · r시간 미지정 Walk | 달리기 / 오르막 | 미산출 |
| X-HILL-02 | 40m 언덕 가속 | 4 × 40m @ HIGH_OUTPUT_CONTROLLED · r시간 미지정 Walk | 달리기 / 오르막 | 미산출 |
| X-HILL-03 | 6초 언덕 세트 | 2 sets × (3 × 6s @ HIGH_OUTPUT_CONTROLLED · r시간 미지정 Walk → 종료 뒤 시간 미지정 Walk) · R3min Walk/Stand | 달리기 / 오르막 | 미산출 |
| X-HILL-04 | 30초 언덕 반복 | 6 × 30s @ RPE 8–9 · r시간 미지정 Walk + 60s Stand | 달리기 / 오르막 | 미산출 |
| X-HILL-05 | 90초 언덕 인터벌 | 6 × 90s @ RPE 7–8 · r시간 미지정 Walk | 달리기 / 오르막 | 미산출 |
| X-HILL-06 | 3분 언덕 인터벌 | 4 × 3min @ RPE 7–8 · r시간 미지정 Walk + 60s Stand | 달리기 / 오르막 | 미산출 |
| X-HILL-07 | 6분 언덕 템포 | 3 × 6min @ RPE 6–7 · r시간 미지정 Walk | 달리기 / 오르막 | 미산출 |
| X-HILL-08 | 10분 지속 언덕 템포 | 10min @ RPE 6–7 → 종료 뒤 시간 미지정 Walk | 달리기 / 오르막 | 미산출 |
| X-HILL-09 | 완만한 언덕 조깅 · Rolling Easy | 30min @ RPE 3–4 | 달리기 / 오르내리는 코스 | 1800s (30min) |
| X-HILL-10 | 오르막 걷기 반복 | 4 × 5min @ RPE 3 · r시간 미지정 Walk | 걷기 / 오르막 | 미산출 |
| X-HILL-11 | 언덕 + 평지 변속 | 6 × (30s @ RPE 8–9 → 30s @ RPE 5) · r시간 미지정 Walk | 달리기 / 오르막 + 평지 | 미산출 |
| X-HILL-12 | 언덕 인터벌 + 평지 템포 | 2 sets × (1min @ RPE 7–8 → 종료 뒤 시간 미지정 Walk → 2min @ RPE 6–7) · R3min Walk/Stand | 달리기 / 오르막 + 평지 | 미산출 |

## 같은 방법의 변형을 따로 집계

| 목적 / 방법군 | 구성 ID |
|---|---|
| BASE:EASY_CONTINUOUS | X-BASE-01, X-BASE-02, X-BASE-03, X-BASE-04 |
| BASE:WALK_BREAKS | X-BASE-05, X-BASE-06, X-BASE-09 |
| BASE:PROGRESSIVE_EASY | X-BASE-07 |
| BASE:EASY_WAVES | X-BASE-08, X-BASE-10 |
| LT:CRUISE_INTERVALS | X-LT-01, X-LT-02, X-LT-03 |
| LT:PYRAMID | X-LT-04 |
| LT:ASCENDING_LADDER | X-LT-05 |
| LT:DESCENDING_LADDER | X-LT-06, X-LT-11 |
| LT:CLUSTERED_CRUISE | X-LT-07, X-LT-12 |
| LT:CRUISE_FLOAT | X-LT-08, X-LT-09 |
| LT:TEMPO_ALTERNATIONS | X-LT-10 |
| VO2:AEROBIC_INTERVALS | X-VO2-01, X-VO2-02, X-VO2-03 |
| VO2:PYRAMID | X-VO2-04, X-VO2-09 |
| VO2:CLUSTERED_INTERVALS | X-VO2-05, X-VO2-06 |
| VO2:SHORT_ON_OFF | X-VO2-07, X-VO2-08 |
| VO2:DESCENDING_LADDER | X-VO2-10 |
| VO2:CLUSTERED_LADDER | X-VO2-11 |
| VO2:BROKEN_INTERVALS | X-VO2-12 |
| ATP-PC:STANDING_ACCELERATION | X-ATP-01, X-ATP-02, X-ATP-03 |
| ATP-PC:FLYING_SEGMENT | X-ATP-04, X-ATP-07 |
| ATP-PC:CLUSTERED_ACCELERATION | X-ATP-05, X-ATP-08 |
| ATP-PC:ACCELERATION_PYRAMID | X-ATP-06 |
| GLY:HIGH_OUTPUT_REPEATS | X-GLY-01, X-GLY-02, X-GLY-03, X-GLY-07 |
| GLY:SPLIT_HIGH_OUTPUT | X-GLY-04, X-GLY-05, X-GLY-08 |
| GLY:DESCENDING_LADDER | X-GLY-06 |
| MIX:FARTLEK_PYRAMID | X-MIX-01 |
| MIX:LT_VO2_COMPOUND | X-MIX-02 |
| MIX:LT_GLY_COMPOUND | X-MIX-03 |
| MIX:VO2_LT_COMPOUND | X-MIX-04 |
| MIX:STEADY_VO2_COMPOUND | X-MIX-05 |
| MIX:EASY_ACCELERATION | X-MIX-06 |
| MIX:LT_TECHNIQUE_COMPOUND | X-MIX-07 |
| MIX:FAST_STEADY_ALTERNATION | X-MIX-08 |
| MIX:THREE_INTENT_COMPOUND | X-MIX-09, X-MIX-10 |
| REC:RECOVERY_JOG | X-REC-01 |
| REC:RECOVERY_RUN_WALK | X-REC-02, X-REC-08 |
| REC:RECOVERY_BIKE | X-REC-03 |
| REC:RECOVERY_ELLIPTICAL | X-REC-04 |
| REC:RECOVERY_DEEP_WATER | X-REC-05 |
| REC:RECOVERY_SWIM | X-REC-06 |
| REC:RECOVERY_MULTIMODAL | X-REC-07 |
| ATP-PC:HILL_ACCELERATION | X-HILL-01, X-HILL-02 |
| ATP-PC:CLUSTERED_HILL_ACCELERATION | X-HILL-03 |
| GLY:HILL_HIGH_OUTPUT | X-HILL-04 |
| VO2:HILL_AEROBIC_INTERVALS | X-HILL-05, X-HILL-06 |
| LT:HILL_CRUISE | X-HILL-07 |
| LT:HILL_CONTINUOUS | X-HILL-08 |
| BASE:ROLLING_EASY | X-HILL-09 |
| BASE:UPHILL_WALK | X-HILL-10 |
| MIX:HILL_FLAT_COMPOUND | X-HILL-11, X-HILL-12 |

## 구성별 이유와 확인 사항

### X-BASE-01 저강도 조깅 · Easy Run

- 방법: 45min @ RPE 3–4
- 목적: 편안하게 이어 가는 운동으로 지속적인 에너지 공급을 다루고, 다른 훈련을 받쳐 주는 기초 지구력을 준비해요.
- 구성 이유: 낮은 강도로 쉬지 않고 달리는 시간을 확보한다.
- 부담·한계: 45분 자체가 모든 선수의 적정량은 아니다.
- 회복 이유: 별도 회복 구간 없이 이어가는 구성이다. 구간 안의 강도·운동 방식 전환은 원본에 남긴다.
- 구간 목적: X-BASE-01-1: BASE / 달리기 / 평지
- 제안 경험 범위: DEVELOPING, EXPERIENCED (개별 적합성 입증 아님).
- 근거: [DISTANCE_REVIEW](https://pmc.ncbi.nlm.nih.gov/articles/PMC8975965/). 새 숫자 전체는 제품 코칭 초안이다.
- 다음 검토: EXACT_DOSE_AND_POPULATION, OWNER_FINAL_ADOPTION, WARMUP_COOLDOWN_BINDING, CURRENT_SAFETY_AND_AUTHORITY, FRAME_AND_NEIGHBOUR_SESSIONS, PERSONAL_PACE_OR_EFFORT_BINDING

### X-BASE-02 거리형 조깅 · Easy Run

- 방법: 8km @ RPE 3–4
- 목적: 편안하게 이어 가는 운동으로 지속적인 에너지 공급을 다루고, 다른 훈련을 받쳐 주는 기초 지구력을 준비해요.
- 구성 이유: 익숙한 코스의 거리로 저강도 지속 달리기를 관리한다.
- 부담·한계: 거리만으로 걸리는 시간이나 부담을 정할 수 없다.
- 회복 이유: 별도 회복 구간 없이 이어가는 구성이다. 구간 안의 강도·운동 방식 전환은 원본에 남긴다.
- 구간 목적: X-BASE-02-1: BASE / 달리기 / 평지
- 제안 경험 범위: DEVELOPING, EXPERIENCED (개별 적합성 입증 아님).
- 근거: [DISTANCE_REVIEW](https://pmc.ncbi.nlm.nih.gov/articles/PMC8975965/). 새 숫자 전체는 제품 코칭 초안이다.
- 다음 검토: EXACT_DOSE_AND_POPULATION, OWNER_FINAL_ADOPTION, WARMUP_COOLDOWN_BINDING, CURRENT_SAFETY_AND_AUTHORITY, FRAME_AND_NEIGHBOUR_SESSIONS, PERSONAL_PACE_OR_EFFORT_BINDING

### X-BASE-03 시간형 롱런 · Long Run

- 방법: 60min @ RPE 3–4
- 목적: 편안하게 이어 가는 운동으로 지속적인 에너지 공급을 다루고, 다른 훈련을 받쳐 주는 기초 지구력을 준비해요.
- 구성 이유: 최근 장거리 경험 안에서 저강도 지속 시간을 늘려 경험하는 안이다.
- 부담·한계: 기존 최장 거리·최근 주간량 없이 기본 배치하지 않는다.
- 회복 이유: 별도 회복 구간 없이 이어가는 구성이다. 구간 안의 강도·운동 방식 전환은 원본에 남긴다.
- 구간 목적: X-BASE-03-1: BASE / 달리기 / 평지
- 제안 경험 범위: EXPERIENCED (개별 적합성 입증 아님).
- 근거: [DISTANCE_REVIEW](https://pmc.ncbi.nlm.nih.gov/articles/PMC8975965/). 새 숫자 전체는 제품 코칭 초안이다.
- 다음 검토: EXACT_DOSE_AND_POPULATION, OWNER_FINAL_ADOPTION, WARMUP_COOLDOWN_BINDING, CURRENT_SAFETY_AND_AUTHORITY, FRAME_AND_NEIGHBOUR_SESSIONS, PERSONAL_PACE_OR_EFFORT_BINDING, RECENT_LONG_RUN_BASELINE

### X-BASE-04 거리형 롱런 · Long Run

- 방법: 12km @ RPE 3–4
- 목적: 편안하게 이어 가는 운동으로 지속적인 에너지 공급을 다루고, 다른 훈련을 받쳐 주는 기초 지구력을 준비해요.
- 구성 이유: 거리 기준으로 긴 저강도 달리기를 구성한다.
- 부담·한계: 느린 선수에게 더 긴 시간이 될 수 있어 60분 안과 동등하지 않다.
- 회복 이유: 별도 회복 구간 없이 이어가는 구성이다. 구간 안의 강도·운동 방식 전환은 원본에 남긴다.
- 구간 목적: X-BASE-04-1: BASE / 달리기 / 평지
- 제안 경험 범위: EXPERIENCED (개별 적합성 입증 아님).
- 근거: [DISTANCE_REVIEW](https://pmc.ncbi.nlm.nih.gov/articles/PMC8975965/). 새 숫자 전체는 제품 코칭 초안이다.
- 다음 검토: EXACT_DOSE_AND_POPULATION, OWNER_FINAL_ADOPTION, WARMUP_COOLDOWN_BINDING, CURRENT_SAFETY_AND_AUTHORITY, FRAME_AND_NEIGHBOUR_SESSIONS, PERSONAL_PACE_OR_EFFORT_BINDING, RECENT_LONG_RUN_BASELINE

### X-BASE-05 걷기를 섞는 조깅 · Run/Walk

- 방법: 3 × 12min @ RPE 3–4 · r60s Walk
- 목적: 편안하게 이어 가는 운동으로 지속적인 에너지 공급을 다루고, 다른 훈련을 받쳐 주는 기초 지구력을 준비해요.
- 구성 이유: 짧은 걷기로 연속 달리기의 부담을 끊는다.
- 부담·한계: 걷기가 들어가도 총 36분 달리기이므로 초보 기본량으로 단정하지 않는다.
- 회복 이유: 출력을 낮춰 다음 반복을 준비한다. 완전 회복을 보장하지 않는다.
- 구간 목적: X-BASE-05-1-1: BASE / 달리기 / 평지
- 제안 경험 범위: DEVELOPING, EXPERIENCED (개별 적합성 입증 아님).
- 근거: [DISTANCE_REVIEW](https://pmc.ncbi.nlm.nih.gov/articles/PMC8975965/). 새 숫자 전체는 제품 코칭 초안이다.
- 다음 검토: EXACT_DOSE_AND_POPULATION, OWNER_FINAL_ADOPTION, WARMUP_COOLDOWN_BINDING, CURRENT_SAFETY_AND_AUTHORITY, FRAME_AND_NEIGHBOUR_SESSIONS, PERSONAL_PACE_OR_EFFORT_BINDING

### X-BASE-06 거리형 런워크 · Run/Walk

- 방법: 3 × 2km @ RPE 3–4 · r60s Walk
- 목적: 편안하게 이어 가는 운동으로 지속적인 에너지 공급을 다루고, 다른 훈련을 받쳐 주는 기초 지구력을 준비해요.
- 구성 이유: 2km마다 걷는 구간을 두어 코스 단위로 조절한다.
- 부담·한계: 구간 속도 없이 전체 소요시간은 알 수 없다.
- 회복 이유: 출력을 낮춰 다음 반복을 준비한다. 완전 회복을 보장하지 않는다.
- 구간 목적: X-BASE-06-1-1: BASE / 달리기 / 평지
- 제안 경험 범위: DEVELOPING, EXPERIENCED (개별 적합성 입증 아님).
- 근거: [DISTANCE_REVIEW](https://pmc.ncbi.nlm.nih.gov/articles/PMC8975965/). 새 숫자 전체는 제품 코칭 초안이다.
- 다음 검토: EXACT_DOSE_AND_POPULATION, OWNER_FINAL_ADOPTION, WARMUP_COOLDOWN_BINDING, CURRENT_SAFETY_AND_AUTHORITY, FRAME_AND_NEIGHBOUR_SESSIONS, PERSONAL_PACE_OR_EFFORT_BINDING

### X-BASE-07 점진 조깅 · Progressive Easy

- 방법: 20min @ RPE 3 → 15min @ RPE 4
- 목적: 편안하게 이어 가는 운동으로 지속적인 에너지 공급을 다루고, 다른 훈련을 받쳐 주는 기초 지구력을 준비해요.
- 구성 이유: 쉬운 강도 안에서 뒤 구간의 노력을 조금 바꾼다.
- 부담·한계: 마지막을 역치나 전력 달리기로 올리는 훈련이 아니다.
- 회복 이유: 별도 회복 구간 없이 이어가는 구성이다. 구간 안의 강도·운동 방식 전환은 원본에 남긴다.
- 구간 목적: X-BASE-07-1: BASE / 달리기 / 평지; X-BASE-07-2: BASE / 달리기 / 평지
- 제안 경험 범위: DEVELOPING, EXPERIENCED (개별 적합성 입증 아님).
- 근거: [DISTANCE_REVIEW](https://pmc.ncbi.nlm.nih.gov/articles/PMC8975965/). 새 숫자 전체는 제품 코칭 초안이다.
- 다음 검토: EXACT_DOSE_AND_POPULATION, OWNER_FINAL_ADOPTION, WARMUP_COOLDOWN_BINDING, CURRENT_SAFETY_AND_AUTHORITY, FRAME_AND_NEIGHBOUR_SESSIONS, PERSONAL_PACE_OR_EFFORT_BINDING

### X-BASE-08 리듬 조깅 · Easy Waves

- 방법: 3 × (10min @ RPE 3 → 5min @ RPE 4)
- 목적: 편안하게 이어 가는 운동으로 지속적인 에너지 공급을 다루고, 다른 훈련을 받쳐 주는 기초 지구력을 준비해요.
- 구성 이유: 쉬운 두 수준을 번갈아 지속하며 리듬을 바꾼다.
- 부담·한계: 45분 모두 움직이므로 짧은 회복 운동으로 취급하지 않는다.
- 회복 이유: 별도 회복 구간 없이 이어가는 구성이다. 구간 안의 강도·운동 방식 전환은 원본에 남긴다.
- 구간 목적: X-BASE-08-1-1: BASE / 달리기 / 평지; X-BASE-08-1-2: BASE / 달리기 / 평지
- 제안 경험 범위: EXPERIENCED (개별 적합성 입증 아님).
- 근거: [DISTANCE_REVIEW](https://pmc.ncbi.nlm.nih.gov/articles/PMC8975965/). 새 숫자 전체는 제품 코칭 초안이다.
- 다음 검토: EXACT_DOSE_AND_POPULATION, OWNER_FINAL_ADOPTION, WARMUP_COOLDOWN_BINDING, CURRENT_SAFETY_AND_AUTHORITY, FRAME_AND_NEIGHBOUR_SESSIONS, PERSONAL_PACE_OR_EFFORT_BINDING

### X-BASE-09 중간 걷기 조깅 · Split Easy

- 방법: 22min @ RPE 3–4 → 종료 뒤 2min Walk → 23min @ RPE 3–4
- 목적: 편안하게 이어 가는 운동으로 지속적인 에너지 공급을 다루고, 다른 훈련을 받쳐 주는 기초 지구력을 준비해요.
- 구성 이유: 긴 달리기의 중간에 한 번 걷는 지점을 둔다.
- 부담·한계: 3회 분할보다 연속 부담이 길다. 같은 총시간이어도 같지 않다.
- 회복 이유: 출력을 낮춰 다음 반복을 준비한다. 완전 회복을 보장하지 않는다.
- 구간 목적: X-BASE-09-1: BASE / 달리기 / 평지; X-BASE-09-2: BASE / 달리기 / 평지
- 제안 경험 범위: EXPERIENCED (개별 적합성 입증 아님).
- 근거: [DISTANCE_REVIEW](https://pmc.ncbi.nlm.nih.gov/articles/PMC8975965/). 새 숫자 전체는 제품 코칭 초안이다.
- 다음 검토: EXACT_DOSE_AND_POPULATION, OWNER_FINAL_ADOPTION, WARMUP_COOLDOWN_BINDING, CURRENT_SAFETY_AND_AUTHORITY, FRAME_AND_NEIGHBOUR_SESSIONS, PERSONAL_PACE_OR_EFFORT_BINDING

### X-BASE-10 올렸다 내리는 조깅 · Easy Wave

- 방법: 10min @ RPE 3 → 15min @ RPE 4 → 10min @ RPE 3
- 목적: 편안하게 이어 가는 운동으로 지속적인 에너지 공급을 다루고, 다른 훈련을 받쳐 주는 기초 지구력을 준비해요.
- 구성 이유: 쉬운 범위에서 중간 노력만 높이고 다시 낮춘다.
- 부담·한계: 강도 차이가 작으며 심박 Zone 2를 측정했다는 뜻은 아니다.
- 회복 이유: 별도 회복 구간 없이 이어가는 구성이다. 구간 안의 강도·운동 방식 전환은 원본에 남긴다.
- 구간 목적: X-BASE-10-1: BASE / 달리기 / 평지; X-BASE-10-2: BASE / 달리기 / 평지; X-BASE-10-3: BASE / 달리기 / 평지
- 제안 경험 범위: DEVELOPING, EXPERIENCED (개별 적합성 입증 아님).
- 근거: [DISTANCE_REVIEW](https://pmc.ncbi.nlm.nih.gov/articles/PMC8975965/). 새 숫자 전체는 제품 코칭 초안이다.
- 다음 검토: EXACT_DOSE_AND_POPULATION, OWNER_FINAL_ADOPTION, WARMUP_COOLDOWN_BINDING, CURRENT_SAFETY_AND_AUTHORITY, FRAME_AND_NEIGHBOUR_SESSIONS, PERSONAL_PACE_OR_EFFORT_BINDING

### X-LT-01 1km 크루즈 인터벌

- 방법: 5 × 1km @ RPE 6–7 · r60s Jog
- 목적: 지속 가능한 비교적 높은 노력을 이어 가며, 에너지 공급과 젖산 생성·이용이 함께 일어나는 강도에서 페이스를 유지할 능력을 준비해요.
- 구성 이유: 1km 단위와 짧은 조깅 회복으로 역치 부근의 노력을 나눈다.
- 부담·한계: 1km를 레이스처럼 달리면 의도와 다르다.
- 회복 이유: 낮은 노력으로 움직이면서 다음 운동 구간으로 연결한다.
- 구간 목적: X-LT-01-1-1: LT / 달리기 / 평지
- 제안 경험 범위: EXPERIENCED (개별 적합성 입증 아님).
- 근거: [THRESHOLD](https://support.vdoto2.com/2017/12/whats-threshold-pace/). 새 숫자 전체는 제품 코칭 초안이다.
- 다음 검토: EXACT_DOSE_AND_POPULATION, OWNER_FINAL_ADOPTION, WARMUP_COOLDOWN_BINDING, CURRENT_SAFETY_AND_AUTHORITY, FRAME_AND_NEIGHBOUR_SESSIONS, PERSONAL_PACE_OR_EFFORT_BINDING

### X-LT-02 2km 크루즈 인터벌

- 방법: 3 × 2km @ RPE 6–7 · r2min Jog
- 목적: 지속 가능한 비교적 높은 노력을 이어 가며, 에너지 공급과 젖산 생성·이용이 함께 일어나는 강도에서 페이스를 유지할 능력을 준비해요.
- 구성 이유: 한 구간의 지속 시간을 길게 가져가는 거리형 안이다.
- 부담·한계: 기록에 따라 구간 시간이 크게 달라진다.
- 회복 이유: 낮은 노력으로 움직이면서 다음 운동 구간으로 연결한다.
- 구간 목적: X-LT-02-1-1: LT / 달리기 / 평지
- 제안 경험 범위: EXPERIENCED (개별 적합성 입증 아님).
- 근거: [THRESHOLD](https://support.vdoto2.com/2017/12/whats-threshold-pace/). 새 숫자 전체는 제품 코칭 초안이다.
- 다음 검토: EXACT_DOSE_AND_POPULATION, OWNER_FINAL_ADOPTION, WARMUP_COOLDOWN_BINDING, CURRENT_SAFETY_AND_AUTHORITY, FRAME_AND_NEIGHBOUR_SESSIONS, PERSONAL_PACE_OR_EFFORT_BINDING

### X-LT-03 3km 크루즈 인터벌

- 방법: 2 × 3km @ RPE 6–7 · r3min Jog
- 목적: 지속 가능한 비교적 높은 노력을 이어 가며, 에너지 공급과 젖산 생성·이용이 함께 일어나는 강도에서 페이스를 유지할 능력을 준비해요.
- 구성 이유: 긴 노력 두 번을 조깅으로 구분한다.
- 부담·한계: 6km 역치성 달리기는 충분한 선행 경험을 요구한다.
- 회복 이유: 낮은 노력으로 움직이면서 다음 운동 구간으로 연결한다.
- 구간 목적: X-LT-03-1-1: LT / 달리기 / 평지
- 제안 경험 범위: EXPERIENCED (개별 적합성 입증 아님).
- 근거: [THRESHOLD](https://support.vdoto2.com/2017/12/whats-threshold-pace/). 새 숫자 전체는 제품 코칭 초안이다.
- 다음 검토: EXACT_DOSE_AND_POPULATION, OWNER_FINAL_ADOPTION, WARMUP_COOLDOWN_BINDING, CURRENT_SAFETY_AND_AUTHORITY, FRAME_AND_NEIGHBOUR_SESSIONS, PERSONAL_PACE_OR_EFFORT_BINDING, RECENT_THRESHOLD_VOLUME

### X-LT-04 시간 피라미드 · Tempo Pyramid

- 방법: 6min @ RPE 6–7 → 종료 뒤 60s Jog → 8min @ RPE 6–7 → 종료 뒤 60s Jog → 6min @ RPE 6–7
- 목적: 지속 가능한 비교적 높은 노력을 이어 가며, 에너지 공급과 젖산 생성·이용이 함께 일어나는 강도에서 페이스를 유지할 능력을 준비해요.
- 구성 이유: 가운데 구간을 길게 두되 같은 강도 목표를 유지한다.
- 부담·한계: 짧아지는 마지막을 더 빠르게 달릴 이유는 없다.
- 회복 이유: 낮은 노력으로 움직이면서 다음 운동 구간으로 연결한다.
- 구간 목적: X-LT-04-1: LT / 달리기 / 평지; X-LT-04-2: LT / 달리기 / 평지; X-LT-04-3: LT / 달리기 / 평지
- 제안 경험 범위: EXPERIENCED (개별 적합성 입증 아님).
- 근거: [THRESHOLD](https://support.vdoto2.com/2017/12/whats-threshold-pace/). 새 숫자 전체는 제품 코칭 초안이다.
- 다음 검토: EXACT_DOSE_AND_POPULATION, OWNER_FINAL_ADOPTION, WARMUP_COOLDOWN_BINDING, CURRENT_SAFETY_AND_AUTHORITY, FRAME_AND_NEIGHBOUR_SESSIONS, PERSONAL_PACE_OR_EFFORT_BINDING

### X-LT-05 늘려가는 템포 · Ascending Ladder

- 방법: 4min @ RPE 6–7 → 종료 뒤 60s Jog → 6min @ RPE 6–7 → 종료 뒤 60s Jog → 8min @ RPE 6–7
- 목적: 지속 가능한 비교적 높은 노력을 이어 가며, 에너지 공급과 젖산 생성·이용이 함께 일어나는 강도에서 페이스를 유지할 능력을 준비해요.
- 구성 이유: 반복할수록 한 구간을 버티는 시간을 늘린다.
- 부담·한계: 누적 피로가 큰 뒤 구간의 품질을 관찰해야 한다.
- 회복 이유: 낮은 노력으로 움직이면서 다음 운동 구간으로 연결한다.
- 구간 목적: X-LT-05-1: LT / 달리기 / 평지; X-LT-05-2: LT / 달리기 / 평지; X-LT-05-3: LT / 달리기 / 평지
- 제안 경험 범위: EXPERIENCED (개별 적합성 입증 아님).
- 근거: [THRESHOLD](https://support.vdoto2.com/2017/12/whats-threshold-pace/). 새 숫자 전체는 제품 코칭 초안이다.
- 다음 검토: EXACT_DOSE_AND_POPULATION, OWNER_FINAL_ADOPTION, WARMUP_COOLDOWN_BINDING, CURRENT_SAFETY_AND_AUTHORITY, FRAME_AND_NEIGHBOUR_SESSIONS, PERSONAL_PACE_OR_EFFORT_BINDING

### X-LT-06 줄여가는 템포 · Descending Ladder

- 방법: 8min @ RPE 6–7 → 종료 뒤 60s Jog → 6min @ RPE 6–7 → 종료 뒤 60s Jog → 4min @ RPE 6–7
- 목적: 지속 가능한 비교적 높은 노력을 이어 가며, 에너지 공급과 젖산 생성·이용이 함께 일어나는 강도에서 페이스를 유지할 능력을 준비해요.
- 구성 이유: 긴 구간을 먼저 하고 뒤의 지속 부담을 줄인다.
- 부담·한계: 오름형과 총시간이 같아도 수행 순서와 피로 경험이 다르다.
- 회복 이유: 낮은 노력으로 움직이면서 다음 운동 구간으로 연결한다.
- 구간 목적: X-LT-06-1: LT / 달리기 / 평지; X-LT-06-2: LT / 달리기 / 평지; X-LT-06-3: LT / 달리기 / 평지
- 제안 경험 범위: EXPERIENCED (개별 적합성 입증 아님).
- 근거: [THRESHOLD](https://support.vdoto2.com/2017/12/whats-threshold-pace/). 새 숫자 전체는 제품 코칭 초안이다.
- 다음 검토: EXACT_DOSE_AND_POPULATION, OWNER_FINAL_ADOPTION, WARMUP_COOLDOWN_BINDING, CURRENT_SAFETY_AND_AUTHORITY, FRAME_AND_NEIGHBOUR_SESSIONS, PERSONAL_PACE_OR_EFFORT_BINDING

### X-LT-07 세트형 크루즈 인터벌

- 방법: 2 sets × (3 × 4min @ RPE 6–7 · r45s Jog) · R3min Walk/Stand
- 목적: 지속 가능한 비교적 높은 노력을 이어 가며, 에너지 공급과 젖산 생성·이용이 함께 일어나는 강도에서 페이스를 유지할 능력을 준비해요.
- 구성 이유: 짧은 회복 세 번 묶음 사이에 더 긴 세트 회복을 둔다.
- 부담·한계: 24분 역치성 운동이다. 세트 회복이 있다고 총량을 더하지 않는다.
- 회복 이유: 출력을 낮춰 다음 반복을 준비한다. 완전 회복을 보장하지 않는다. / 낮은 노력으로 움직이면서 다음 운동 구간으로 연결한다.
- 구간 목적: X-LT-07-1-1-1: LT / 달리기 / 평지
- 제안 경험 범위: EXPERIENCED (개별 적합성 입증 아님).
- 근거: [THRESHOLD](https://support.vdoto2.com/2017/12/whats-threshold-pace/), [REPEATING_SETS](https://support.vdoto2.com/2022/02/repeating-sets-of-work/). 새 숫자 전체는 제품 코칭 초안이다.
- 다음 검토: EXACT_DOSE_AND_POPULATION, OWNER_FINAL_ADOPTION, WARMUP_COOLDOWN_BINDING, CURRENT_SAFETY_AND_AUTHORITY, FRAME_AND_NEIGHBOUR_SESSIONS, PERSONAL_PACE_OR_EFFORT_BINDING

### X-LT-08 1km + 200m 플로트 · Cruise Float

- 방법: 4 × (1km @ RPE 6–7 → 종료 뒤 200m Roll-on)
- 목적: 지속 가능한 비교적 높은 노력을 이어 가며, 에너지 공급과 젖산 생성·이용이 함께 일어나는 강도에서 페이스를 유지할 능력을 준비해요.
- 구성 이유: 달리기를 멈추지 않고 200m를 낮은 강도로 연결한다.
- 부담·한계: 마지막 200m도 포함한다. 빠른 플로트로 바꾸면 전체 부담이 달라진다.
- 회복 이유: 거리로 구분한 저강도 연결 구간이다. 시간이나 동등한 부하는 추정하지 않는다.
- 구간 목적: X-LT-08-1-1: LT / 달리기 / 평지
- 제안 경험 범위: EXPERIENCED (개별 적합성 입증 아님).
- 근거: [THRESHOLD](https://support.vdoto2.com/2017/12/whats-threshold-pace/). 새 숫자 전체는 제품 코칭 초안이다.
- 다음 검토: EXACT_DOSE_AND_POPULATION, OWNER_FINAL_ADOPTION, WARMUP_COOLDOWN_BINDING, CURRENT_SAFETY_AND_AUTHORITY, FRAME_AND_NEIGHBOUR_SESSIONS, PERSONAL_PACE_OR_EFFORT_BINDING

### X-LT-09 6분 + 2분 플로트 · Cruise Float

- 방법: 3 × (6min @ RPE 6–7 → 종료 뒤 2min Jog)
- 목적: 지속 가능한 비교적 높은 노력을 이어 가며, 에너지 공급과 젖산 생성·이용이 함께 일어나는 강도에서 페이스를 유지할 능력을 준비해요.
- 구성 이유: 각 6분 뒤에 2분 쉬운 조깅을 명시적으로 둔다.
- 부담·한계: 마지막 조깅도 본 구성에 포함하며 정리운동과 이중 계산하지 않는다.
- 회복 이유: 낮은 노력으로 움직이면서 다음 운동 구간으로 연결한다.
- 구간 목적: X-LT-09-1-1: LT / 달리기 / 평지
- 제안 경험 범위: EXPERIENCED (개별 적합성 입증 아님).
- 근거: [THRESHOLD](https://support.vdoto2.com/2017/12/whats-threshold-pace/). 새 숫자 전체는 제품 코칭 초안이다.
- 다음 검토: EXACT_DOSE_AND_POPULATION, OWNER_FINAL_ADOPTION, WARMUP_COOLDOWN_BINDING, CURRENT_SAFETY_AND_AUTHORITY, FRAME_AND_NEIGHBOUR_SESSIONS, PERSONAL_PACE_OR_EFFORT_BINDING

### X-LT-10 강도 교대 템포 · Tempo Alternations

- 방법: 3 × (5min @ RPE 6 → 2min @ RPE 7)
- 목적: 지속 가능한 비교적 높은 노력을 이어 가며, 에너지 공급과 젖산 생성·이용이 함께 일어나는 강도에서 페이스를 유지할 능력을 준비해요.
- 구성 이유: 멈추지 않고 역치 관련 노력 범위의 두 수준을 교대한다.
- 부담·한계: 개인의 실제 역치가 확인된 것이 아니며 높은 쪽으로 계속 밀면 안 된다.
- 회복 이유: 별도 회복 구간 없이 이어가는 구성이다. 구간 안의 강도·운동 방식 전환은 원본에 남긴다.
- 구간 목적: X-LT-10-1-1: LT / 달리기 / 평지; X-LT-10-1-2: LT / 달리기 / 평지
- 제안 경험 범위: EXPERIENCED (개별 적합성 입증 아님).
- 근거: [THRESHOLD](https://support.vdoto2.com/2017/12/whats-threshold-pace/). 새 숫자 전체는 제품 코칭 초안이다.
- 다음 검토: EXACT_DOSE_AND_POPULATION, OWNER_FINAL_ADOPTION, WARMUP_COOLDOWN_BINDING, CURRENT_SAFETY_AND_AUTHORITY, FRAME_AND_NEIGHBOUR_SESSIONS, PERSONAL_PACE_OR_EFFORT_BINDING

### X-LT-11 10 + 5 + 5분 템포

- 방법: 10min @ RPE 6–7 → 종료 뒤 60s Jog → 5min @ RPE 6–7 → 종료 뒤 60s Jog → 5min @ RPE 6–7
- 목적: 지속 가능한 비교적 높은 노력을 이어 가며, 에너지 공급과 젖산 생성·이용이 함께 일어나는 강도에서 페이스를 유지할 능력을 준비해요.
- 구성 이유: 긴 첫 구간 뒤에는 짧게 나누어 같은 목표 노력을 이어간다.
- 부담·한계: 20분 연속 안과 같은 효과나 부담이라고 단정하지 않는다.
- 회복 이유: 낮은 노력으로 움직이면서 다음 운동 구간으로 연결한다.
- 구간 목적: X-LT-11-1: LT / 달리기 / 평지; X-LT-11-2: LT / 달리기 / 평지; X-LT-11-3: LT / 달리기 / 평지
- 제안 경험 범위: EXPERIENCED (개별 적합성 입증 아님).
- 근거: [THRESHOLD](https://support.vdoto2.com/2017/12/whats-threshold-pace/). 새 숫자 전체는 제품 코칭 초안이다.
- 다음 검토: EXACT_DOSE_AND_POPULATION, OWNER_FINAL_ADOPTION, WARMUP_COOLDOWN_BINDING, CURRENT_SAFETY_AND_AUTHORITY, FRAME_AND_NEIGHBOUR_SESSIONS, PERSONAL_PACE_OR_EFFORT_BINDING

### X-LT-12 1200 + 800m 세트

- 방법: 2 sets × (1200m @ RPE 6–7 → 종료 뒤 60s Jog → 800m @ RPE 6–7) · R3min Walk/Stand
- 목적: 지속 가능한 비교적 높은 노력을 이어 가며, 에너지 공급과 젖산 생성·이용이 함께 일어나는 강도에서 페이스를 유지할 능력을 준비해요.
- 구성 이유: 서로 다른 거리 두 개를 한 묶음으로 반복한다.
- 부담·한계: 800m는 짧아도 강도를 추가로 높이지 않는다.
- 회복 이유: 출력을 낮춰 다음 반복을 준비한다. 완전 회복을 보장하지 않는다. / 낮은 노력으로 움직이면서 다음 운동 구간으로 연결한다.
- 구간 목적: X-LT-12-1-1: LT / 달리기 / 평지; X-LT-12-1-2: LT / 달리기 / 평지
- 제안 경험 범위: EXPERIENCED (개별 적합성 입증 아님).
- 근거: [THRESHOLD](https://support.vdoto2.com/2017/12/whats-threshold-pace/), [REPEATING_SETS](https://support.vdoto2.com/2022/02/repeating-sets-of-work/). 새 숫자 전체는 제품 코칭 초안이다.
- 다음 검토: EXACT_DOSE_AND_POPULATION, OWNER_FINAL_ADOPTION, WARMUP_COOLDOWN_BINDING, CURRENT_SAFETY_AND_AUTHORITY, FRAME_AND_NEIGHBOUR_SESSIONS, PERSONAL_PACE_OR_EFFORT_BINDING

### X-VO2-01 400m 인터벌

- 방법: 8 × 400m @ RPE 7–8 · r90s Jog
- 목적: 높은 산소 이용이 필요한 운동 구간을 회복과 함께 반복해 강한 유산소 노력을 이어 갈 능력을 준비해요.
- 구성 이유: 짧은 거리 반복을 조깅 회복으로 연결한다.
- 부담·한계: 기록에 따라 400m 지속 시간이 달라져 별도 페이스 연결이 필요하다.
- 회복 이유: 낮은 노력으로 움직이면서 다음 운동 구간으로 연결한다.
- 구간 목적: X-VO2-01-1-1: VO2 / 달리기 / 평지
- 제안 경험 범위: EXPERIENCED (개별 적합성 입증 아님).
- 근거: [INTERVAL_LENGTH](https://pubmed.ncbi.nlm.nih.gov/15387806/). 새 숫자 전체는 제품 코칭 초안이다.
- 다음 검토: EXACT_DOSE_AND_POPULATION, OWNER_FINAL_ADOPTION, WARMUP_COOLDOWN_BINDING, CURRENT_SAFETY_AND_AUTHORITY, FRAME_AND_NEIGHBOUR_SESSIONS, PERSONAL_PACE_OR_EFFORT_BINDING

### X-VO2-02 800m 인터벌

- 방법: 5 × 800m @ RPE 7–8 · r2min Jog
- 목적: 높은 산소 이용이 필요한 운동 구간을 회복과 함께 반복해 강한 유산소 노력을 이어 갈 능력을 준비해요.
- 구성 이유: 400m보다 긴 한 번의 노력으로 높은 산소 이용을 겨냥한다.
- 부담·한계: 모든 선수에게 같은 분량의 자극이 아니다.
- 회복 이유: 낮은 노력으로 움직이면서 다음 운동 구간으로 연결한다.
- 구간 목적: X-VO2-02-1-1: VO2 / 달리기 / 평지
- 제안 경험 범위: EXPERIENCED (개별 적합성 입증 아님).
- 근거: [INTERVAL_LENGTH](https://pubmed.ncbi.nlm.nih.gov/15387806/). 새 숫자 전체는 제품 코칭 초안이다.
- 다음 검토: EXACT_DOSE_AND_POPULATION, OWNER_FINAL_ADOPTION, WARMUP_COOLDOWN_BINDING, CURRENT_SAFETY_AND_AUTHORITY, FRAME_AND_NEIGHBOUR_SESSIONS, PERSONAL_PACE_OR_EFFORT_BINDING

### X-VO2-03 1km 인터벌

- 방법: 4 × 1km @ RPE 7–8 · r150s Jog
- 목적: 높은 산소 이용이 필요한 운동 구간을 회복과 함께 반복해 강한 유산소 노력을 이어 갈 능력을 준비해요.
- 구성 이유: 익숙한 1km 단위의 긴 반복이다.
- 부담·한계: 입문자에게 매우 긴 고강도 구간이 될 수 있다.
- 회복 이유: 낮은 노력으로 움직이면서 다음 운동 구간으로 연결한다.
- 구간 목적: X-VO2-03-1-1: VO2 / 달리기 / 평지
- 제안 경험 범위: EXPERIENCED (개별 적합성 입증 아님).
- 근거: [INTERVAL_LENGTH](https://pubmed.ncbi.nlm.nih.gov/15387806/). 새 숫자 전체는 제품 코칭 초안이다.
- 다음 검토: EXACT_DOSE_AND_POPULATION, OWNER_FINAL_ADOPTION, WARMUP_COOLDOWN_BINDING, CURRENT_SAFETY_AND_AUTHORITY, FRAME_AND_NEIGHBOUR_SESSIONS, PERSONAL_PACE_OR_EFFORT_BINDING

### X-VO2-04 200–800m 피라미드

- 방법: 200m @ RPE 7–8 → 종료 뒤 90s Jog → 400m @ RPE 7–8 → 종료 뒤 90s Jog → 600m @ RPE 7–8 → 종료 뒤 90s Jog → 800m @ RPE 7–8 → 종료 뒤 90s Jog → 600m @ RPE 7–8 → 종료 뒤 90s Jog → 400m @ RPE 7–8 → 종료 뒤 90s Jog → 200m @ RPE 7–8
- 목적: 높은 산소 이용이 필요한 운동 구간을 회복과 함께 반복해 강한 유산소 노력을 이어 갈 능력을 준비해요.
- 구성 이유: 구간 길이를 늘렸다 줄이며 높은 유산소 노력을 경험한다.
- 부담·한계: 동일 회복을 둔 초안으로 각 구간 속도와 회복 적합성 검토가 필요하다.
- 회복 이유: 낮은 노력으로 움직이면서 다음 운동 구간으로 연결한다.
- 구간 목적: X-VO2-04-1: VO2 / 달리기 / 평지; X-VO2-04-2: VO2 / 달리기 / 평지; X-VO2-04-3: VO2 / 달리기 / 평지; X-VO2-04-4: VO2 / 달리기 / 평지; X-VO2-04-5: VO2 / 달리기 / 평지; X-VO2-04-6: VO2 / 달리기 / 평지; X-VO2-04-7: VO2 / 달리기 / 평지
- 제안 경험 범위: EXPERIENCED (개별 적합성 입증 아님).
- 근거: [INTERVAL_LENGTH](https://pubmed.ncbi.nlm.nih.gov/15387806/). 새 숫자 전체는 제품 코칭 초안이다.
- 다음 검토: EXACT_DOSE_AND_POPULATION, OWNER_FINAL_ADOPTION, WARMUP_COOLDOWN_BINDING, CURRENT_SAFETY_AND_AUTHORITY, FRAME_AND_NEIGHBOUR_SESSIONS, PERSONAL_PACE_OR_EFFORT_BINDING

### X-VO2-05 400 + 600m 세트

- 방법: 3 sets × (400m @ RPE 7–8 → 종료 뒤 90s Jog → 600m @ RPE 7–8) · R3min Walk/Stand
- 목적: 높은 산소 이용이 필요한 운동 구간을 회복과 함께 반복해 강한 유산소 노력을 이어 갈 능력을 준비해요.
- 구성 이유: 짧고 긴 구간 한 쌍을 세트 회복으로 분리한다.
- 부담·한계: 세트가 많다는 이유로 마지막에 속도를 올리지 않는다.
- 회복 이유: 출력을 낮춰 다음 반복을 준비한다. 완전 회복을 보장하지 않는다. / 낮은 노력으로 움직이면서 다음 운동 구간으로 연결한다.
- 구간 목적: X-VO2-05-1-1: VO2 / 달리기 / 평지; X-VO2-05-1-2: VO2 / 달리기 / 평지
- 제안 경험 범위: EXPERIENCED (개별 적합성 입증 아님).
- 근거: [INTERVAL_LENGTH](https://pubmed.ncbi.nlm.nih.gov/15387806/), [REPEATING_SETS](https://support.vdoto2.com/2022/02/repeating-sets-of-work/). 새 숫자 전체는 제품 코칭 초안이다.
- 다음 검토: EXACT_DOSE_AND_POPULATION, OWNER_FINAL_ADOPTION, WARMUP_COOLDOWN_BINDING, CURRENT_SAFETY_AND_AUTHORITY, FRAME_AND_NEIGHBOUR_SESSIONS, PERSONAL_PACE_OR_EFFORT_BINDING

### X-VO2-06 1분 반복 세트

- 방법: 2 sets × (4 × 1min @ RPE 7–8 · r60s Jog) · R3min Walk/Stand
- 목적: 높은 산소 이용이 필요한 운동 구간을 회복과 함께 반복해 강한 유산소 노력을 이어 갈 능력을 준비해요.
- 구성 이유: 1분 노력과 1분 조깅을 네 번 묶어 두 세트로 진행한다.
- 부담·한계: 짧은 반복을 전력질주로 바꾸면 목적이 달라진다.
- 회복 이유: 출력을 낮춰 다음 반복을 준비한다. 완전 회복을 보장하지 않는다. / 낮은 노력으로 움직이면서 다음 운동 구간으로 연결한다.
- 구간 목적: X-VO2-06-1-1-1: VO2 / 달리기 / 평지
- 제안 경험 범위: EXPERIENCED (개별 적합성 입증 아님).
- 근거: [INTERVAL_LENGTH](https://pubmed.ncbi.nlm.nih.gov/15387806/). 새 숫자 전체는 제품 코칭 초안이다.
- 다음 검토: EXACT_DOSE_AND_POPULATION, OWNER_FINAL_ADOPTION, WARMUP_COOLDOWN_BINDING, CURRENT_SAFETY_AND_AUTHORITY, FRAME_AND_NEIGHBOUR_SESSIONS, PERSONAL_PACE_OR_EFFORT_BINDING

### X-VO2-07 30/30 인터벌

- 방법: 2 sets × (8 × 30s @ RPE 7–8 · r30s Jog) · R3min Walk/Stand
- 목적: 높은 산소 이용이 필요한 운동 구간을 회복과 함께 반복해 강한 유산소 노력을 이어 갈 능력을 준비해요.
- 구성 이유: 짧은 운동과 짧은 저강도 회복을 연속시켜 산소 이용 자극을 구성한다.
- 부담·한계: 연구의 vVO2max 속도를 확인한 처방이 아니며 이 세트 수는 제품 초안이다.
- 회복 이유: 출력을 낮춰 다음 반복을 준비한다. 완전 회복을 보장하지 않는다. / 낮은 노력으로 움직이면서 다음 운동 구간으로 연결한다.
- 구간 목적: X-VO2-07-1-1-1: VO2 / 달리기 / 평지
- 제안 경험 범위: EXPERIENCED (개별 적합성 입증 아님).
- 근거: [SHORT_INTERVALS](https://pubmed.ncbi.nlm.nih.gov/10638376/). 새 숫자 전체는 제품 코칭 초안이다.
- 다음 검토: EXACT_DOSE_AND_POPULATION, OWNER_FINAL_ADOPTION, WARMUP_COOLDOWN_BINDING, CURRENT_SAFETY_AND_AUTHORITY, FRAME_AND_NEIGHBOUR_SESSIONS, PERSONAL_PACE_OR_EFFORT_BINDING

### X-VO2-08 15/15 인터벌

- 방법: 3 sets × (6 × 15s @ RPE 7–8 · r15s Jog) · R3min Walk/Stand
- 목적: 높은 산소 이용이 필요한 운동 구간을 회복과 함께 반복해 강한 유산소 노력을 이어 갈 능력을 준비해요.
- 구성 이유: 더 짧은 전환으로 짧은 운동·회복 리듬을 만든다.
- 부담·한계: 30초 연구를 15초 구성의 직접 검증으로 쓰지 않는다. 잦은 가감속 부담도 있다.
- 회복 이유: 출력을 낮춰 다음 반복을 준비한다. 완전 회복을 보장하지 않는다. / 낮은 노력으로 움직이면서 다음 운동 구간으로 연결한다.
- 구간 목적: X-VO2-08-1-1-1: VO2 / 달리기 / 평지
- 제안 경험 범위: EXPERIENCED (개별 적합성 입증 아님).
- 근거: [SHORT_INTERVALS](https://pubmed.ncbi.nlm.nih.gov/10638376/). 새 숫자 전체는 제품 코칭 초안이다.
- 다음 검토: EXACT_DOSE_AND_POPULATION, OWNER_FINAL_ADOPTION, WARMUP_COOLDOWN_BINDING, CURRENT_SAFETY_AND_AUTHORITY, FRAME_AND_NEIGHBOUR_SESSIONS, PERSONAL_PACE_OR_EFFORT_BINDING

### X-VO2-09 2–4분 피라미드

- 방법: 2min @ RPE 7–8 → 종료 뒤 2min Jog → 3min @ RPE 7–8 → 종료 뒤 2min Jog → 4min @ RPE 7–8 → 종료 뒤 2min Jog → 3min @ RPE 7–8 → 종료 뒤 2min Jog → 2min @ RPE 7–8
- 목적: 높은 산소 이용이 필요한 운동 구간을 회복과 함께 반복해 강한 유산소 노력을 이어 갈 능력을 준비해요.
- 구성 이유: 가운데 긴 반복을 중심으로 앞뒤 지속 시간을 조절한다.
- 부담·한계: 시간이 짧은 반복을 과속하면 전체 목적이 바뀐다.
- 회복 이유: 낮은 노력으로 움직이면서 다음 운동 구간으로 연결한다.
- 구간 목적: X-VO2-09-1: VO2 / 달리기 / 평지; X-VO2-09-2: VO2 / 달리기 / 평지; X-VO2-09-3: VO2 / 달리기 / 평지; X-VO2-09-4: VO2 / 달리기 / 평지; X-VO2-09-5: VO2 / 달리기 / 평지
- 제안 경험 범위: EXPERIENCED (개별 적합성 입증 아님).
- 근거: [INTERVAL_LENGTH](https://pubmed.ncbi.nlm.nih.gov/15387806/). 새 숫자 전체는 제품 코칭 초안이다.
- 다음 검토: EXACT_DOSE_AND_POPULATION, OWNER_FINAL_ADOPTION, WARMUP_COOLDOWN_BINDING, CURRENT_SAFETY_AND_AUTHORITY, FRAME_AND_NEIGHBOUR_SESSIONS, PERSONAL_PACE_OR_EFFORT_BINDING

### X-VO2-10 4–1분 사다리

- 방법: 4min @ RPE 7–8 → 종료 뒤 2min Jog → 3min @ RPE 7–8 → 종료 뒤 2min Jog → 2min @ RPE 7–8 → 종료 뒤 2min Jog → 1min @ RPE 7–8
- 목적: 높은 산소 이용이 필요한 운동 구간을 회복과 함께 반복해 강한 유산소 노력을 이어 갈 능력을 준비해요.
- 구성 이유: 긴 구간을 먼저 수행하고 뒤로 갈수록 구간 시간을 줄인다.
- 부담·한계: 마지막 1분을 전력 테스트로 사용하지 않는다.
- 회복 이유: 낮은 노력으로 움직이면서 다음 운동 구간으로 연결한다.
- 구간 목적: X-VO2-10-1: VO2 / 달리기 / 평지; X-VO2-10-2: VO2 / 달리기 / 평지; X-VO2-10-3: VO2 / 달리기 / 평지; X-VO2-10-4: VO2 / 달리기 / 평지
- 제안 경험 범위: EXPERIENCED (개별 적합성 입증 아님).
- 근거: [INTERVAL_LENGTH](https://pubmed.ncbi.nlm.nih.gov/15387806/). 새 숫자 전체는 제품 코칭 초안이다.
- 다음 검토: EXACT_DOSE_AND_POPULATION, OWNER_FINAL_ADOPTION, WARMUP_COOLDOWN_BINDING, CURRENT_SAFETY_AND_AUTHORITY, FRAME_AND_NEIGHBOUR_SESSIONS, PERSONAL_PACE_OR_EFFORT_BINDING

### X-VO2-11 90–30초 사다리 세트

- 방법: 2 sets × (90s @ RPE 7–8 → 종료 뒤 60s Jog → 1min @ RPE 7–8 → 종료 뒤 60s Jog → 30s @ RPE 7–8) · R3min Walk/Stand
- 목적: 높은 산소 이용이 필요한 운동 구간을 회복과 함께 반복해 강한 유산소 노력을 이어 갈 능력을 준비해요.
- 구성 이유: 세트 안에서 세 가지 지속 시간을 경험한다.
- 부담·한계: 동일 목적이지만 일정 길이 반복과 부담이 같지는 않다.
- 회복 이유: 출력을 낮춰 다음 반복을 준비한다. 완전 회복을 보장하지 않는다. / 낮은 노력으로 움직이면서 다음 운동 구간으로 연결한다.
- 구간 목적: X-VO2-11-1-1: VO2 / 달리기 / 평지; X-VO2-11-1-2: VO2 / 달리기 / 평지; X-VO2-11-1-3: VO2 / 달리기 / 평지
- 제안 경험 범위: EXPERIENCED (개별 적합성 입증 아님).
- 근거: [INTERVAL_LENGTH](https://pubmed.ncbi.nlm.nih.gov/15387806/), [REPEATING_SETS](https://support.vdoto2.com/2022/02/repeating-sets-of-work/). 새 숫자 전체는 제품 코칭 초안이다.
- 다음 검토: EXACT_DOSE_AND_POPULATION, OWNER_FINAL_ADOPTION, WARMUP_COOLDOWN_BINDING, CURRENT_SAFETY_AND_AUTHORITY, FRAME_AND_NEIGHBOUR_SESSIONS, PERSONAL_PACE_OR_EFFORT_BINDING

### X-VO2-12 분할 2분 인터벌 · Broken Intervals

- 방법: 6 × (1min @ RPE 7–8 → 종료 뒤 30s Jog → 1min @ RPE 7–8) · r2min Jog
- 목적: 높은 산소 이용이 필요한 운동 구간을 회복과 함께 반복해 강한 유산소 노력을 이어 갈 능력을 준비해요.
- 구성 이유: 한 번의 2분 노력을 중간 30초 조깅으로 나눈다.
- 부담·한계: 연속 2분과 다른 구조이며 내부 회복과 반복 사이 회복을 혼동하지 않는다.
- 회복 이유: 낮은 노력으로 움직이면서 다음 운동 구간으로 연결한다.
- 구간 목적: X-VO2-12-1-1: VO2 / 달리기 / 평지; X-VO2-12-1-2: VO2 / 달리기 / 평지
- 제안 경험 범위: EXPERIENCED (개별 적합성 입증 아님).
- 근거: [INTERVAL_LENGTH](https://pubmed.ncbi.nlm.nih.gov/15387806/). 새 숫자 전체는 제품 코칭 초안이다.
- 다음 검토: EXACT_DOSE_AND_POPULATION, OWNER_FINAL_ADOPTION, WARMUP_COOLDOWN_BINDING, CURRENT_SAFETY_AND_AUTHORITY, FRAME_AND_NEIGHBOUR_SESSIONS, PERSONAL_PACE_OR_EFFORT_BINDING

### X-ATP-01 30m 가속 · Accelerations

- 방법: 6 × 30m @ HIGH_OUTPUT_CONTROLLED · r3min Walk/Stand
- 목적: 매우 짧은 가속·스피드 구간에서 ATP를 빠르게 공급하며 높은 출력을 내는 능력을 준비해요.
- 구성 이유: 짧은 구간의 빠른 ATP 공급이 필요한 고출력을 반복한다.
- 부담·한계: 짧은 거리도 높은 기계적 부담이 있다. 다른 대사 경로도 함께 관여한다.
- 회복 이유: 출력을 낮춰 다음 반복을 준비한다. 완전 회복을 보장하지 않는다.
- 구간 목적: X-ATP-01-1-1: ATP-PC / 달리기 / 평지
- 제안 경험 범위: EXPERIENCED (개별 적합성 입증 아님).
- 근거: [SPEED_QUALITY](https://www.nsca.com/education/articles/kinetic-select/designing-speed-training-sessions/). 새 숫자 전체는 제품 코칭 초안이다.
- 다음 검토: EXACT_DOSE_AND_POPULATION, OWNER_FINAL_ADOPTION, WARMUP_COOLDOWN_BINDING, CURRENT_SAFETY_AND_AUTHORITY, FRAME_AND_NEIGHBOUR_SESSIONS, PERSONAL_PACE_OR_EFFORT_BINDING, ACCELERATION_AND_DECELERATION_SPACE

### X-ATP-02 50m 가속 · Accelerations

- 방법: 4 × 50m @ HIGH_OUTPUT_CONTROLLED · r4min Walk/Stand
- 목적: 매우 짧은 가속·스피드 구간에서 ATP를 빠르게 공급하며 높은 출력을 내는 능력을 준비해요.
- 구성 이유: 출발 후 가속이 이어지는 거리를 늘린 구성이다.
- 부담·한계: 30m 안의 단순 동등 대체가 아니며 장거리 기록으로 초를 환산하지 않는다.
- 회복 이유: 출력을 낮춰 다음 반복을 준비한다. 완전 회복을 보장하지 않는다.
- 구간 목적: X-ATP-02-1-1: ATP-PC / 달리기 / 평지
- 제안 경험 범위: EXPERIENCED (개별 적합성 입증 아님).
- 근거: [SPEED_QUALITY](https://www.nsca.com/education/articles/kinetic-select/designing-speed-training-sessions/). 새 숫자 전체는 제품 코칭 초안이다.
- 다음 검토: EXACT_DOSE_AND_POPULATION, OWNER_FINAL_ADOPTION, WARMUP_COOLDOWN_BINDING, CURRENT_SAFETY_AND_AUTHORITY, FRAME_AND_NEIGHBOUR_SESSIONS, PERSONAL_PACE_OR_EFFORT_BINDING, ACCELERATION_AND_DECELERATION_SPACE

### X-ATP-03 60m 가속 · Accelerations

- 방법: 4 × 60m @ HIGH_OUTPUT_CONTROLLED · r5min Walk/Stand
- 목적: 매우 짧은 가속·스피드 구간에서 ATP를 빠르게 공급하며 높은 출력을 내는 능력을 준비해요.
- 구성 이유: 짧은 고출력 주행을 더 긴 회복으로 분리한다.
- 부담·한계: 선수별 지속 시간이 달라 ATP-PC만 쓰는 구간이라고 단정하지 않는다.
- 회복 이유: 출력을 낮춰 다음 반복을 준비한다. 완전 회복을 보장하지 않는다.
- 구간 목적: X-ATP-03-1-1: ATP-PC / 달리기 / 평지
- 제안 경험 범위: EXPERIENCED (개별 적합성 입증 아님).
- 근거: [SPEED_QUALITY](https://www.nsca.com/education/articles/kinetic-select/designing-speed-training-sessions/). 새 숫자 전체는 제품 코칭 초안이다.
- 다음 검토: EXACT_DOSE_AND_POPULATION, OWNER_FINAL_ADOPTION, WARMUP_COOLDOWN_BINDING, CURRENT_SAFETY_AND_AUTHORITY, FRAME_AND_NEIGHBOUR_SESSIONS, PERSONAL_PACE_OR_EFFORT_BINDING, ACCELERATION_AND_DECELERATION_SPACE

### X-ATP-04 플라잉 20m · Flying Sprint

- 방법: 4 × (30m @ Build-up (전력질주 아님) → 20m @ HIGH_OUTPUT_CONTROLLED) · r5min Walk/Stand
- 목적: 매우 짧은 가속·스피드 구간에서 ATP를 빠르게 공급하며 높은 출력을 내는 능력을 준비해요.
- 구성 이유: 접근 가속 뒤 빠른 20m를 별도로 구분한다.
- 부담·한계: 접근 30m를 목표 고출력 20m와 합쳐 같은 구간으로 표시하지 않는다.
- 회복 이유: 출력을 낮춰 다음 반복을 준비한다. 완전 회복을 보장하지 않는다.
- 구간 목적: X-ATP-04-1-1: TECHNIQUE / 달리기 / 평지; X-ATP-04-1-2: ATP-PC / 달리기 / 평지
- 제안 경험 범위: EXPERIENCED (개별 적합성 입증 아님).
- 근거: [SPEED_QUALITY](https://www.nsca.com/education/articles/kinetic-select/designing-speed-training-sessions/). 새 숫자 전체는 제품 코칭 초안이다.
- 다음 검토: EXACT_DOSE_AND_POPULATION, OWNER_FINAL_ADOPTION, WARMUP_COOLDOWN_BINDING, CURRENT_SAFETY_AND_AUTHORITY, FRAME_AND_NEIGHBOUR_SESSIONS, PERSONAL_PACE_OR_EFFORT_BINDING, ACCELERATION_AND_DECELERATION_SPACE

### X-ATP-05 20m 가속 세트

- 방법: 3 sets × (2 × 20m @ HIGH_OUTPUT_CONTROLLED · r2min Walk/Stand) · R5min Walk/Stand
- 목적: 매우 짧은 가속·스피드 구간에서 ATP를 빠르게 공급하며 높은 출력을 내는 능력을 준비해요.
- 구성 이유: 두 번의 짧은 가속을 더 긴 세트 회복으로 분리한다.
- 부담·한계: 품질 저하가 있으면 세트 수를 채우는 것이 우선이 아니다.
- 회복 이유: 출력을 낮춰 다음 반복을 준비한다. 완전 회복을 보장하지 않는다.
- 구간 목적: X-ATP-05-1-1-1: ATP-PC / 달리기 / 평지
- 제안 경험 범위: EXPERIENCED (개별 적합성 입증 아님).
- 근거: [SPEED_QUALITY](https://www.nsca.com/education/articles/kinetic-select/designing-speed-training-sessions/). 새 숫자 전체는 제품 코칭 초안이다.
- 다음 검토: EXACT_DOSE_AND_POPULATION, OWNER_FINAL_ADOPTION, WARMUP_COOLDOWN_BINDING, CURRENT_SAFETY_AND_AUTHORITY, FRAME_AND_NEIGHBOUR_SESSIONS, PERSONAL_PACE_OR_EFFORT_BINDING, ACCELERATION_AND_DECELERATION_SPACE

### X-ATP-06 5–7–5초 가속

- 방법: 5s @ HIGH_OUTPUT_CONTROLLED → 종료 뒤 3min Walk/Stand → 7s @ HIGH_OUTPUT_CONTROLLED → 종료 뒤 4min Walk/Stand → 5s @ HIGH_OUTPUT_CONTROLLED
- 목적: 매우 짧은 가속·스피드 구간에서 ATP를 빠르게 공급하며 높은 출력을 내는 능력을 준비해요.
- 구성 이유: 거리 대신 짧은 운동 시간을 달리해 고출력 구간을 구성한다.
- 부담·한계: 시간이 끝나는 지점 이후에도 안전한 감속 공간이 필요하다.
- 회복 이유: 출력을 낮춰 다음 반복을 준비한다. 완전 회복을 보장하지 않는다.
- 구간 목적: X-ATP-06-1: ATP-PC / 달리기 / 평지; X-ATP-06-2: ATP-PC / 달리기 / 평지; X-ATP-06-3: ATP-PC / 달리기 / 평지
- 제안 경험 범위: EXPERIENCED (개별 적합성 입증 아님).
- 근거: [SPEED_QUALITY](https://www.nsca.com/education/articles/kinetic-select/designing-speed-training-sessions/). 새 숫자 전체는 제품 코칭 초안이다.
- 다음 검토: EXACT_DOSE_AND_POPULATION, OWNER_FINAL_ADOPTION, WARMUP_COOLDOWN_BINDING, CURRENT_SAFETY_AND_AUTHORITY, FRAME_AND_NEIGHBOUR_SESSIONS, PERSONAL_PACE_OR_EFFORT_BINDING, ACCELERATION_AND_DECELERATION_SPACE

### X-ATP-07 가속–빠른 구간–감속

- 방법: 4 × (10m @ Build-up (전력질주 아님) → 20m @ HIGH_OUTPUT_CONTROLLED → 10m @ CONTROLLED_DECELERATION) · r4min Walk/Stand
- 목적: 매우 짧은 가속·스피드 구간에서 ATP를 빠르게 공급하며 높은 출력을 내는 능력을 준비해요.
- 구성 이유: 가속·고출력·감속을 구조 안에서 따로 표시한다.
- 부담·한계: 표시한 감속 10m 밖의 여유 공간도 필요할 수 있다.
- 회복 이유: 출력을 낮춰 다음 반복을 준비한다. 완전 회복을 보장하지 않는다.
- 구간 목적: X-ATP-07-1-1: TECHNIQUE / 달리기 / 평지; X-ATP-07-1-2: ATP-PC / 달리기 / 평지; X-ATP-07-1-3: TECHNIQUE / 달리기 / 평지
- 제안 경험 범위: EXPERIENCED (개별 적합성 입증 아님).
- 근거: [SPEED_QUALITY](https://www.nsca.com/education/articles/kinetic-select/designing-speed-training-sessions/). 새 숫자 전체는 제품 코칭 초안이다.
- 다음 검토: EXACT_DOSE_AND_POPULATION, OWNER_FINAL_ADOPTION, WARMUP_COOLDOWN_BINDING, CURRENT_SAFETY_AND_AUTHORITY, FRAME_AND_NEIGHBOUR_SESSIONS, PERSONAL_PACE_OR_EFFORT_BINDING, ACCELERATION_AND_DECELERATION_SPACE

### X-ATP-08 10 + 30m 가속 세트

- 방법: 3 sets × (10m @ HIGH_OUTPUT_CONTROLLED → 종료 뒤 3min Walk/Stand → 30m @ HIGH_OUTPUT_CONTROLLED) · R5min Walk/Stand
- 목적: 매우 짧은 가속·스피드 구간에서 ATP를 빠르게 공급하며 높은 출력을 내는 능력을 준비해요.
- 구성 이유: 초기 가속과 더 긴 가속을 세트 안에서 구분한다.
- 부담·한계: 두 거리의 목표 초를 하나의 장거리 페이스로 계산하지 않는다.
- 회복 이유: 출력을 낮춰 다음 반복을 준비한다. 완전 회복을 보장하지 않는다.
- 구간 목적: X-ATP-08-1-1: ATP-PC / 달리기 / 평지; X-ATP-08-1-2: ATP-PC / 달리기 / 평지
- 제안 경험 범위: EXPERIENCED (개별 적합성 입증 아님).
- 근거: [SPEED_QUALITY](https://www.nsca.com/education/articles/kinetic-select/designing-speed-training-sessions/). 새 숫자 전체는 제품 코칭 초안이다.
- 다음 검토: EXACT_DOSE_AND_POPULATION, OWNER_FINAL_ADOPTION, WARMUP_COOLDOWN_BINDING, CURRENT_SAFETY_AND_AUTHORITY, FRAME_AND_NEIGHBOUR_SESSIONS, PERSONAL_PACE_OR_EFFORT_BINDING, ACCELERATION_AND_DECELERATION_SPACE

### X-GLY-01 150m 고강도 반복

- 방법: 5 × 150m @ RPE 8–9 · r3min Walk/Stand
- 목적: 짧은 고강도 구간에서 빠른 ATP 공급을 요구하고, 반복되는 부담 속에서도 계획한 출력을 이어 갈 능력을 준비해요.
- 구성 이유: 높은 에너지 요구에 해당과정이 함께 대응하는 반복을 구성한다.
- 부담·한계: 거리만으로 해당계 기여율이나 최적 속도를 정할 수 없다.
- 회복 이유: 출력을 낮춰 다음 반복을 준비한다. 완전 회복을 보장하지 않는다.
- 구간 목적: X-GLY-01-1-1: GLY / 달리기 / 평지
- 제안 경험 범위: EXPERIENCED (개별 적합성 입증 아님).
- 근거: [SPRINT_RECOVERY](https://pubmed.ncbi.nlm.nih.gov/21777153/). 새 숫자 전체는 제품 코칭 초안이다.
- 다음 검토: EXACT_DOSE_AND_POPULATION, OWNER_FINAL_ADOPTION, WARMUP_COOLDOWN_BINDING, CURRENT_SAFETY_AND_AUTHORITY, FRAME_AND_NEIGHBOUR_SESSIONS, PERSONAL_PACE_OR_EFFORT_BINDING

### X-GLY-02 300m 고강도 반복

- 방법: 4 × 300m @ RPE 8–9 · r4min Walk/Stand
- 목적: 짧은 고강도 구간에서 빠른 ATP 공급을 요구하고, 반복되는 부담 속에서도 계획한 출력을 이어 갈 능력을 준비해요.
- 구성 이유: 긴 고출력 구간과 회복을 분리한다.
- 부담·한계: 종목 기록·직전 훈련과 최근 고강도 경험을 확인해야 한다.
- 회복 이유: 출력을 낮춰 다음 반복을 준비한다. 완전 회복을 보장하지 않는다.
- 구간 목적: X-GLY-02-1-1: GLY / 달리기 / 평지
- 제안 경험 범위: EXPERIENCED (개별 적합성 입증 아님).
- 근거: [SPRINT_RECOVERY](https://pubmed.ncbi.nlm.nih.gov/21777153/). 새 숫자 전체는 제품 코칭 초안이다.
- 다음 검토: EXACT_DOSE_AND_POPULATION, OWNER_FINAL_ADOPTION, WARMUP_COOLDOWN_BINDING, CURRENT_SAFETY_AND_AUTHORITY, FRAME_AND_NEIGHBOUR_SESSIONS, PERSONAL_PACE_OR_EFFORT_BINDING

### X-GLY-03 400m 고강도 반복

- 방법: 3 × 400m @ RPE 8–9 · r5min Walk/Stand
- 목적: 짧은 고강도 구간에서 빠른 ATP 공급을 요구하고, 반복되는 부담 속에서도 계획한 출력을 이어 갈 능력을 준비해요.
- 구성 이유: 각 구간의 높은 출력 지속 요구를 길게 둔다.
- 부담·한계: 400m 선수 전용 계획을 개방하는 것이 아니다. 산화 대사도 상당히 관여할 수 있다.
- 회복 이유: 출력을 낮춰 다음 반복을 준비한다. 완전 회복을 보장하지 않는다.
- 구간 목적: X-GLY-03-1-1: GLY / 달리기 / 평지
- 제안 경험 범위: EXPERIENCED (개별 적합성 입증 아님).
- 근거: [SPRINT_RECOVERY](https://pubmed.ncbi.nlm.nih.gov/21777153/). 새 숫자 전체는 제품 코칭 초안이다.
- 다음 검토: EXACT_DOSE_AND_POPULATION, OWNER_FINAL_ADOPTION, WARMUP_COOLDOWN_BINDING, CURRENT_SAFETY_AND_AUTHORITY, FRAME_AND_NEIGHBOUR_SESSIONS, PERSONAL_PACE_OR_EFFORT_BINDING

### X-GLY-04 150 + 150m 분할 세트

- 방법: 3 sets × (150m @ RPE 8–9 → 종료 뒤 45s Walk/Stand → 150m @ RPE 8–9) · R5min Walk/Stand
- 목적: 짧은 고강도 구간에서 빠른 ATP 공급을 요구하고, 반복되는 부담 속에서도 계획한 출력을 이어 갈 능력을 준비해요.
- 구성 이유: 짧은 내부 회복으로 불완전한 회복 상태의 두 번째 구간을 만든다.
- 부담·한계: 세트 안에서 완전 회복이라고 설명하면 안 된다.
- 회복 이유: 출력을 낮춰 다음 반복을 준비한다. 완전 회복을 보장하지 않는다.
- 구간 목적: X-GLY-04-1-1: GLY / 달리기 / 평지; X-GLY-04-1-2: GLY / 달리기 / 평지
- 제안 경험 범위: EXPERIENCED (개별 적합성 입증 아님).
- 근거: [SPRINT_RECOVERY](https://pubmed.ncbi.nlm.nih.gov/21777153/). 새 숫자 전체는 제품 코칭 초안이다.
- 다음 검토: EXACT_DOSE_AND_POPULATION, OWNER_FINAL_ADOPTION, WARMUP_COOLDOWN_BINDING, CURRENT_SAFETY_AND_AUTHORITY, FRAME_AND_NEIGHBOUR_SESSIONS, PERSONAL_PACE_OR_EFFORT_BINDING

### X-GLY-05 200 + 100m 분할 세트

- 방법: 2 sets × (200m @ RPE 8–9 → 종료 뒤 60s Walk/Stand → 100m @ RPE 8–9) · R6min Walk/Stand
- 목적: 짧은 고강도 구간에서 빠른 ATP 공급을 요구하고, 반복되는 부담 속에서도 계획한 출력을 이어 갈 능력을 준비해요.
- 구성 이유: 긴 첫 노력과 짧은 두 번째 노력을 세트로 묶는다.
- 부담·한계: 100m를 전력 스프린트로 추가하는 허가가 아니다.
- 회복 이유: 출력을 낮춰 다음 반복을 준비한다. 완전 회복을 보장하지 않는다.
- 구간 목적: X-GLY-05-1-1: GLY / 달리기 / 평지; X-GLY-05-1-2: GLY / 달리기 / 평지
- 제안 경험 범위: EXPERIENCED (개별 적합성 입증 아님).
- 근거: [SPRINT_RECOVERY](https://pubmed.ncbi.nlm.nih.gov/21777153/), [REPEATING_SETS](https://support.vdoto2.com/2022/02/repeating-sets-of-work/). 새 숫자 전체는 제품 코칭 초안이다.
- 다음 검토: EXACT_DOSE_AND_POPULATION, OWNER_FINAL_ADOPTION, WARMUP_COOLDOWN_BINDING, CURRENT_SAFETY_AND_AUTHORITY, FRAME_AND_NEIGHBOUR_SESSIONS, PERSONAL_PACE_OR_EFFORT_BINDING

### X-GLY-06 300–150m 사다리

- 방법: 300m @ RPE 8–9 → 종료 뒤 4min Walk/Stand → 200m @ RPE 8–9 → 종료 뒤 4min Walk/Stand → 150m @ RPE 8–9
- 목적: 짧은 고강도 구간에서 빠른 ATP 공급을 요구하고, 반복되는 부담 속에서도 계획한 출력을 이어 갈 능력을 준비해요.
- 구성 이유: 누적 피로 뒤의 운동 구간을 짧게 바꾼다.
- 부담·한계: 짧아진 거리만큼 무조건 더 빠르게 달리지 않는다.
- 회복 이유: 출력을 낮춰 다음 반복을 준비한다. 완전 회복을 보장하지 않는다.
- 구간 목적: X-GLY-06-1: GLY / 달리기 / 평지; X-GLY-06-2: GLY / 달리기 / 평지; X-GLY-06-3: GLY / 달리기 / 평지
- 제안 경험 범위: EXPERIENCED (개별 적합성 입증 아님).
- 근거: [SPRINT_RECOVERY](https://pubmed.ncbi.nlm.nih.gov/21777153/). 새 숫자 전체는 제품 코칭 초안이다.
- 다음 검토: EXACT_DOSE_AND_POPULATION, OWNER_FINAL_ADOPTION, WARMUP_COOLDOWN_BINDING, CURRENT_SAFETY_AND_AUTHORITY, FRAME_AND_NEIGHBOUR_SESSIONS, PERSONAL_PACE_OR_EFFORT_BINDING

### X-GLY-07 40초 고강도 반복

- 방법: 5 × 40s @ RPE 8–9 · r3min Walk/Stand
- 목적: 짧은 고강도 구간에서 빠른 ATP 공급을 요구하고, 반복되는 부담 속에서도 계획한 출력을 이어 갈 능력을 준비해요.
- 구성 이유: 측정 거리가 없는 곳에서 높은 노력의 지속 시간을 기준으로 반복한다.
- 부담·한계: 전력 테스트가 아니다. RPE가 개별 출력 검증을 대신하지 않는다.
- 회복 이유: 출력을 낮춰 다음 반복을 준비한다. 완전 회복을 보장하지 않는다.
- 구간 목적: X-GLY-07-1-1: GLY / 달리기 / 평지
- 제안 경험 범위: EXPERIENCED (개별 적합성 입증 아님).
- 근거: [SPRINT_RECOVERY](https://pubmed.ncbi.nlm.nih.gov/21777153/). 새 숫자 전체는 제품 코칭 초안이다.
- 다음 검토: EXACT_DOSE_AND_POPULATION, OWNER_FINAL_ADOPTION, WARMUP_COOLDOWN_BINDING, CURRENT_SAFETY_AND_AUTHORITY, FRAME_AND_NEIGHBOUR_SESSIONS, PERSONAL_PACE_OR_EFFORT_BINDING

### X-GLY-08 20 + 20초 분할 세트

- 방법: 3 sets × (20s @ RPE 8–9 → 종료 뒤 40s Walk/Stand → 20s @ RPE 8–9) · R4min Walk/Stand
- 목적: 짧은 고강도 구간에서 빠른 ATP 공급을 요구하고, 반복되는 부담 속에서도 계획한 출력을 이어 갈 능력을 준비해요.
- 구성 이유: 짧은 고출력 구간 사이에 짧은 회복, 세트 사이에 긴 회복을 둔다.
- 부담·한계: 총 운동시간이 짧아도 피로와 근육 부담이 작다고 볼 수 없다.
- 회복 이유: 출력을 낮춰 다음 반복을 준비한다. 완전 회복을 보장하지 않는다.
- 구간 목적: X-GLY-08-1-1: GLY / 달리기 / 평지; X-GLY-08-1-2: GLY / 달리기 / 평지
- 제안 경험 범위: EXPERIENCED (개별 적합성 입증 아님).
- 근거: [SPRINT_RECOVERY](https://pubmed.ncbi.nlm.nih.gov/21777153/). 새 숫자 전체는 제품 코칭 초안이다.
- 다음 검토: EXACT_DOSE_AND_POPULATION, OWNER_FINAL_ADOPTION, WARMUP_COOLDOWN_BINDING, CURRENT_SAFETY_AND_AUTHORITY, FRAME_AND_NEIGHBOUR_SESSIONS, PERSONAL_PACE_OR_EFFORT_BINDING

### X-MIX-01 1–3분 파틀렉 · Fartlek Pyramid

- 방법: 1min @ RPE 6–7 → 종료 뒤 60s Jog → 2min @ RPE 7–8 → 종료 뒤 2min Jog → 3min @ RPE 7–8 → 종료 뒤 3min Jog → 2min @ RPE 7–8 → 종료 뒤 2min Jog → 1min @ RPE 6–7
- 목적: 구성이 확인된 경우 서로 다른 운동 구간을 연결해 지속적인 에너지 공급과 강도 변화에 대응하는 능력을 함께 준비해요.
- 구성 이유: 지속 시간과 목표 노력을 바꾸고 길이에 맞춘 낮은 노력 구간으로 연결한다.
- 부담·한계: 모든 빠른 구간을 같은 속도로 달리는 처방이 아니다.
- 회복 이유: 낮은 노력으로 움직이면서 다음 운동 구간으로 연결한다.
- 구간 목적: X-MIX-01-1: LT / 달리기 / 평지; X-MIX-01-2: VO2 / 달리기 / 평지; X-MIX-01-3: VO2 / 달리기 / 평지; X-MIX-01-4: VO2 / 달리기 / 평지; X-MIX-01-5: LT / 달리기 / 평지
- 제안 경험 범위: EXPERIENCED (개별 적합성 입증 아님).
- 근거: [INTERVAL_LENGTH](https://pubmed.ncbi.nlm.nih.gov/15387806/), [THRESHOLD](https://support.vdoto2.com/2017/12/whats-threshold-pace/). 새 숫자 전체는 제품 코칭 초안이다.
- 다음 검토: EXACT_DOSE_AND_POPULATION, OWNER_FINAL_ADOPTION, WARMUP_COOLDOWN_BINDING, CURRENT_SAFETY_AND_AUTHORITY, FRAME_AND_NEIGHBOUR_SESSIONS, PERSONAL_PACE_OR_EFFORT_BINDING

### X-MIX-02 템포 + 인터벌 세트

- 방법: 3 sets × (3min @ RPE 6–7 → 종료 뒤 60s Jog → 1min @ RPE 7–8) · R2min Walk/Stand
- 목적: 구성이 확인된 경우 서로 다른 운동 구간을 연결해 지속적인 에너지 공급과 강도 변화에 대응하는 능력을 함께 준비해요.
- 구성 이유: LT 노력 뒤에 짧은 높은 유산소 노력을 연결한다.
- 부담·한계: 두 목적의 누적 부담을 따로 읽으며 단일 에너지 비율로 표시하지 않는다.
- 회복 이유: 출력을 낮춰 다음 반복을 준비한다. 완전 회복을 보장하지 않는다. / 낮은 노력으로 움직이면서 다음 운동 구간으로 연결한다.
- 구간 목적: X-MIX-02-1-1: LT / 달리기 / 평지; X-MIX-02-1-2: VO2 / 달리기 / 평지
- 제안 경험 범위: EXPERIENCED (개별 적합성 입증 아님).
- 근거: [THRESHOLD](https://support.vdoto2.com/2017/12/whats-threshold-pace/), [INTERVAL_LENGTH](https://pubmed.ncbi.nlm.nih.gov/15387806/). 새 숫자 전체는 제품 코칭 초안이다.
- 다음 검토: EXACT_DOSE_AND_POPULATION, OWNER_FINAL_ADOPTION, WARMUP_COOLDOWN_BINDING, CURRENT_SAFETY_AND_AUTHORITY, FRAME_AND_NEIGHBOUR_SESSIONS, PERSONAL_PACE_OR_EFFORT_BINDING

### X-MIX-03 1km 템포 + 200m 반복

- 방법: 3 sets × (1km @ RPE 6–7 → 종료 뒤 60s Jog → 200m @ RPE 8–9) · R3min Walk/Stand
- 목적: 구성이 확인된 경우 서로 다른 운동 구간을 연결해 지속적인 에너지 공급과 강도 변화에 대응하는 능력을 함께 준비해요.
- 구성 이유: 긴 역치성 구간 뒤에 짧은 고강도 구간을 구분해 배치한다.
- 부담·한계: 고강도 구간을 덤으로 추가하지 않는다. 이것 전체가 하나의 주요 훈련이다.
- 회복 이유: 출력을 낮춰 다음 반복을 준비한다. 완전 회복을 보장하지 않는다. / 낮은 노력으로 움직이면서 다음 운동 구간으로 연결한다.
- 구간 목적: X-MIX-03-1-1: LT / 달리기 / 평지; X-MIX-03-1-2: GLY / 달리기 / 평지
- 제안 경험 범위: EXPERIENCED (개별 적합성 입증 아님).
- 근거: [THRESHOLD](https://support.vdoto2.com/2017/12/whats-threshold-pace/), [SPRINT_RECOVERY](https://pubmed.ncbi.nlm.nih.gov/21777153/). 새 숫자 전체는 제품 코칭 초안이다.
- 다음 검토: EXACT_DOSE_AND_POPULATION, OWNER_FINAL_ADOPTION, WARMUP_COOLDOWN_BINDING, CURRENT_SAFETY_AND_AUTHORITY, FRAME_AND_NEIGHBOUR_SESSIONS, PERSONAL_PACE_OR_EFFORT_BINDING

### X-MIX-04 800m 인터벌 + 400m 템포

- 방법: 3 × (800m @ RPE 7–8 → 종료 뒤 90s Jog → 400m @ RPE 6–7) · r60s Jog
- 목적: 구성이 확인된 경우 서로 다른 운동 구간을 연결해 지속적인 에너지 공급과 강도 변화에 대응하는 능력을 함께 준비해요.
- 구성 이유: 강한 구간 뒤에 낮춘 목표 노력의 달리기를 이어간다.
- 부담·한계: 400m는 완전 휴식이 아니며 전체 품질 거리로 보존한다.
- 회복 이유: 낮은 노력으로 움직이면서 다음 운동 구간으로 연결한다.
- 구간 목적: X-MIX-04-1-1: VO2 / 달리기 / 평지; X-MIX-04-1-2: LT / 달리기 / 평지
- 제안 경험 범위: EXPERIENCED (개별 적합성 입증 아님).
- 근거: [INTERVAL_LENGTH](https://pubmed.ncbi.nlm.nih.gov/15387806/), [THRESHOLD](https://support.vdoto2.com/2017/12/whats-threshold-pace/). 새 숫자 전체는 제품 코칭 초안이다.
- 다음 검토: EXACT_DOSE_AND_POPULATION, OWNER_FINAL_ADOPTION, WARMUP_COOLDOWN_BINDING, CURRENT_SAFETY_AND_AUTHORITY, FRAME_AND_NEIGHBOUR_SESSIONS, PERSONAL_PACE_OR_EFFORT_BINDING

### X-MIX-05 2km 스테디 + 400m 인터벌

- 방법: 2 sets × (2km @ RPE 5 → 종료 뒤 2min Jog → 400m @ RPE 7–8) · R4min Walk/Stand
- 목적: 구성이 확인된 경우 서로 다른 운동 구간을 연결해 지속적인 에너지 공급과 강도 변화에 대응하는 능력을 함께 준비해요.
- 구성 이유: 중간 노력의 지속 구간과 높은 유산소 반복을 세트로 분리한다.
- 부담·한계: RPE 5 구간은 쉬운 BASE 처방과 구분해야 하며 중강도 구간으로 별도 설명한다.
- 회복 이유: 출력을 낮춰 다음 반복을 준비한다. 완전 회복을 보장하지 않는다. / 낮은 노력으로 움직이면서 다음 운동 구간으로 연결한다.
- 구간 목적: X-MIX-05-1-1: STEADY / 달리기 / 평지; X-MIX-05-1-2: VO2 / 달리기 / 평지
- 제안 경험 범위: EXPERIENCED (개별 적합성 입증 아님).
- 근거: [DISTANCE_REVIEW](https://pmc.ncbi.nlm.nih.gov/articles/PMC8975965/), [INTERVAL_LENGTH](https://pubmed.ncbi.nlm.nih.gov/15387806/). 새 숫자 전체는 제품 코칭 초안이다.
- 다음 검토: EXACT_DOSE_AND_POPULATION, OWNER_FINAL_ADOPTION, WARMUP_COOLDOWN_BINDING, CURRENT_SAFETY_AND_AUTHORITY, FRAME_AND_NEIGHBOUR_SESSIONS, PERSONAL_PACE_OR_EFFORT_BINDING

### X-MIX-06 조깅 + 10초 고출력

- 방법: 20min @ RPE 3–4 → 6 × 10s @ HIGH_OUTPUT_CONTROLLED · r90s Walk
- 목적: 구성이 확인된 경우 서로 다른 운동 구간을 연결해 지속적인 에너지 공급과 강도 변화에 대응하는 능력을 함께 준비해요.
- 구성 이유: 저강도 달리기와 짧은 고출력 자극을 한 세션 안에서 별도로 구성한다.
- 부담·한계: 조깅 뒤 고출력 회복 90초가 충분한지 검토해야 한다.
- 회복 이유: 출력을 낮춰 다음 반복을 준비한다. 완전 회복을 보장하지 않는다.
- 구간 목적: X-MIX-06-1: BASE / 달리기 / 평지; X-MIX-06-2-1: ATP-PC / 달리기 / 평지
- 제안 경험 범위: EXPERIENCED (개별 적합성 입증 아님).
- 근거: [DISTANCE_REVIEW](https://pmc.ncbi.nlm.nih.gov/articles/PMC8975965/), [SPEED_QUALITY](https://www.nsca.com/education/articles/kinetic-select/designing-speed-training-sessions/). 새 숫자 전체는 제품 코칭 초안이다.
- 다음 검토: EXACT_DOSE_AND_POPULATION, OWNER_FINAL_ADOPTION, WARMUP_COOLDOWN_BINDING, CURRENT_SAFETY_AND_AUTHORITY, FRAME_AND_NEIGHBOUR_SESSIONS, PERSONAL_PACE_OR_EFFORT_BINDING, ACCELERATION_AND_DECELERATION_SPACE

### X-MIX-07 템포 + 점진 가속

- 방법: 12min @ RPE 6–7 → 종료 뒤 3min Jog → 4 × 20s @ Build-up (전력질주 아님) · r2min Walk
- 목적: 구성이 확인된 경우 서로 다른 운동 구간을 연결해 지속적인 에너지 공급과 강도 변화에 대응하는 능력을 함께 준비해요.
- 구성 이유: 템포와 전력이 아닌 점진 가속 기술 구간을 분리한다.
- 부담·한계: 피로 후 자세 품질을 확인해야 하며 기술 구간을 ATP-PC 처방으로 부풀리지 않는다.
- 회복 이유: 낮은 노력으로 움직이면서 다음 운동 구간으로 연결한다. / 출력을 낮춰 다음 반복을 준비한다. 완전 회복을 보장하지 않는다.
- 구간 목적: X-MIX-07-1: LT / 달리기 / 평지; X-MIX-07-2-1: TECHNIQUE / 달리기 / 평지
- 제안 경험 범위: EXPERIENCED (개별 적합성 입증 아님).
- 근거: [THRESHOLD](https://support.vdoto2.com/2017/12/whats-threshold-pace/), [SPEED_QUALITY](https://www.nsca.com/education/articles/kinetic-select/designing-speed-training-sessions/). 새 숫자 전체는 제품 코칭 초안이다.
- 다음 검토: EXACT_DOSE_AND_POPULATION, OWNER_FINAL_ADOPTION, WARMUP_COOLDOWN_BINDING, CURRENT_SAFETY_AND_AUTHORITY, FRAME_AND_NEIGHBOUR_SESSIONS, PERSONAL_PACE_OR_EFFORT_BINDING, ACCELERATION_AND_DECELERATION_SPACE

### X-MIX-08 200m 교대 · Alternating 200s

- 방법: 4 × (200m @ RPE 7–8 → 200m @ RPE 5)
- 목적: 구성이 확인된 경우 서로 다른 운동 구간을 연결해 지속적인 에너지 공급과 강도 변화에 대응하는 능력을 함께 준비해요.
- 구성 이유: 강한 200m와 중간 노력 200m를 멈추지 않고 교대한다.
- 부담·한계: 낮은 쪽도 중강도 운동이며 회복 조깅과 같지 않다.
- 회복 이유: 별도 회복 구간 없이 이어가는 구성이다. 구간 안의 강도·운동 방식 전환은 원본에 남긴다.
- 구간 목적: X-MIX-08-1-1: VO2 / 달리기 / 평지; X-MIX-08-1-2: STEADY / 달리기 / 평지
- 제안 경험 범위: EXPERIENCED (개별 적합성 입증 아님).
- 근거: [INTERVAL_LENGTH](https://pubmed.ncbi.nlm.nih.gov/15387806/). 새 숫자 전체는 제품 코칭 초안이다.
- 다음 검토: EXACT_DOSE_AND_POPULATION, OWNER_FINAL_ADOPTION, WARMUP_COOLDOWN_BINDING, CURRENT_SAFETY_AND_AUTHORITY, FRAME_AND_NEIGHBOUR_SESSIONS, PERSONAL_PACE_OR_EFFORT_BINDING

### X-MIX-09 템포–인터벌–고강도 세트

- 방법: 3 sets × (4min @ RPE 6–7 → 종료 뒤 60s Jog → 2min @ RPE 7–8 → 종료 뒤 2min Jog → 20s @ RPE 8–9) · R4min Walk/Stand
- 목적: 구성이 확인된 경우 서로 다른 운동 구간을 연결해 지속적인 에너지 공급과 강도 변화에 대응하는 능력을 함께 준비해요.
- 구성 이유: 서로 다른 지속 시간과 출력 요구를 순서대로 배치한다.
- 부담·한계: 복잡하고 피로가 겹친다. 첫 공개 우선 구성으로 삼지 않는다.
- 회복 이유: 출력을 낮춰 다음 반복을 준비한다. 완전 회복을 보장하지 않는다. / 낮은 노력으로 움직이면서 다음 운동 구간으로 연결한다.
- 구간 목적: X-MIX-09-1-1: LT / 달리기 / 평지; X-MIX-09-1-2: VO2 / 달리기 / 평지; X-MIX-09-1-3: GLY / 달리기 / 평지
- 제안 경험 범위: EXPERIENCED (개별 적합성 입증 아님).
- 근거: [THRESHOLD](https://support.vdoto2.com/2017/12/whats-threshold-pace/), [INTERVAL_LENGTH](https://pubmed.ncbi.nlm.nih.gov/15387806/), [SPRINT_RECOVERY](https://pubmed.ncbi.nlm.nih.gov/21777153/). 새 숫자 전체는 제품 코칭 초안이다.
- 다음 검토: EXACT_DOSE_AND_POPULATION, OWNER_FINAL_ADOPTION, WARMUP_COOLDOWN_BINDING, CURRENT_SAFETY_AND_AUTHORITY, FRAME_AND_NEIGHBOUR_SESSIONS, PERSONAL_PACE_OR_EFFORT_BINDING, COMPLEX_SESSION_REVIEW

### X-MIX-10 1km–800m–400m 복합

- 방법: 1km @ RPE 6–7 → 종료 뒤 2min Jog → 800m @ RPE 7–8 → 종료 뒤 150s Jog → 400m @ RPE 8–9
- 목적: 구성이 확인된 경우 서로 다른 운동 구간을 연결해 지속적인 에너지 공급과 강도 변화에 대응하는 능력을 함께 준비해요.
- 구성 이유: 거리를 줄이면서 구간별 목적을 바꾸는 복합 안이다.
- 부담·한계: 빠른 마지막 구간의 피로를 별도로 확인하며 세 구간을 같은 RP로 처방하지 않는다.
- 회복 이유: 낮은 노력으로 움직이면서 다음 운동 구간으로 연결한다.
- 구간 목적: X-MIX-10-1: LT / 달리기 / 평지; X-MIX-10-2: VO2 / 달리기 / 평지; X-MIX-10-3: GLY / 달리기 / 평지
- 제안 경험 범위: EXPERIENCED (개별 적합성 입증 아님).
- 근거: [THRESHOLD](https://support.vdoto2.com/2017/12/whats-threshold-pace/), [INTERVAL_LENGTH](https://pubmed.ncbi.nlm.nih.gov/15387806/), [SPRINT_RECOVERY](https://pubmed.ncbi.nlm.nih.gov/21777153/). 새 숫자 전체는 제품 코칭 초안이다.
- 다음 검토: EXACT_DOSE_AND_POPULATION, OWNER_FINAL_ADOPTION, WARMUP_COOLDOWN_BINDING, CURRENT_SAFETY_AND_AUTHORITY, FRAME_AND_NEIGHBOUR_SESSIONS, PERSONAL_PACE_OR_EFFORT_BINDING, COMPLEX_SESSION_REVIEW

### X-REC-01 회복 조깅 · Recovery Jog

- 방법: 15min @ RPE 1–2
- 목적: 새 고강도 자극을 쌓기보다 부담을 낮춘 움직임으로 다음 훈련 사이의 여유를 두는 목적이에요.
- 구성 이유: 아주 낮은 노력으로 짧게 움직이는 선택지다.
- 부담·한계: 회복 완료나 통증 없는 수행을 보장하지 않는다.
- 회복 이유: 별도 회복 구간 없이 이어가는 구성이다. 구간 안의 강도·운동 방식 전환은 원본에 남긴다.
- 구간 목적: X-REC-01-1: REC / 달리기 / 평지
- 제안 경험 범위: DEVELOPING, EXPERIENCED (개별 적합성 입증 아님).
- 근거: [DISTANCE_REVIEW](https://pmc.ncbi.nlm.nih.gov/articles/PMC8975965/). 새 숫자 전체는 제품 코칭 초안이다.
- 다음 검토: EXACT_DOSE_AND_POPULATION, OWNER_FINAL_ADOPTION, WARMUP_COOLDOWN_BINDING, CURRENT_SAFETY_AND_AUTHORITY, FRAME_AND_NEIGHBOUR_SESSIONS, PERSONAL_PACE_OR_EFFORT_BINDING

### X-REC-02 걷기 중심 런워크

- 방법: 8 × (1min @ RPE 1–2 → 2min @ RPE 1–2)
- 목적: 새 고강도 자극을 쌓기보다 부담을 낮춘 움직임으로 다음 훈련 사이의 여유를 두는 목적이에요.
- 구성 이유: 짧은 조깅과 더 긴 걷기를 교대한다.
- 부담·한계: 24분 활동이며 8분짜리 회복이라고 표시하지 않는다.
- 회복 이유: 별도 회복 구간 없이 이어가는 구성이다. 구간 안의 강도·운동 방식 전환은 원본에 남긴다.
- 구간 목적: X-REC-02-1-1: REC / 달리기 / 평지; X-REC-02-1-2: REC / 걷기 / 평지
- 제안 경험 범위: DEVELOPING, EXPERIENCED (개별 적합성 입증 아님).
- 근거: [DISTANCE_REVIEW](https://pmc.ncbi.nlm.nih.gov/articles/PMC8975965/). 새 숫자 전체는 제품 코칭 초안이다.
- 다음 검토: EXACT_DOSE_AND_POPULATION, OWNER_FINAL_ADOPTION, WARMUP_COOLDOWN_BINDING, CURRENT_SAFETY_AND_AUTHORITY, FRAME_AND_NEIGHBOUR_SESSIONS, PERSONAL_PACE_OR_EFFORT_BINDING

### X-REC-03 가벼운 자전거 · Easy Bike

- 방법: 20min @ RPE 1–2
- 목적: 새 고강도 자극을 쌓기보다 부담을 낮춘 움직임으로 다음 훈련 사이의 여유를 두는 목적이에요.
- 구성 이유: 달리기 외 방식으로 낮은 노력의 활동을 선택한다.
- 부담·한계: 달리기 거리로 환산하지 않는다. 회복 효과를 보장하지 않는다.
- 회복 이유: 별도 회복 구간 없이 이어가는 구성이다. 구간 안의 강도·운동 방식 전환은 원본에 남긴다.
- 구간 목적: X-REC-03-1: REC / 자전거 / 실내 장비
- 제안 경험 범위: DEVELOPING, EXPERIENCED (개별 적합성 입증 아님).
- 근거: [CROSS_TRAINING](https://pubmed.ncbi.nlm.nih.gov/7649149/). 새 숫자 전체는 제품 코칭 초안이다.
- 다음 검토: EXACT_DOSE_AND_POPULATION, OWNER_FINAL_ADOPTION, WARMUP_COOLDOWN_BINDING, CURRENT_SAFETY_AND_AUTHORITY, FRAME_AND_NEIGHBOUR_SESSIONS, PERSONAL_PACE_OR_EFFORT_BINDING, BIKE_AVAILABLE

### X-REC-04 가벼운 일립티컬

- 방법: 15min @ RPE 1–2
- 목적: 새 고강도 자극을 쌓기보다 부담을 낮춘 움직임으로 다음 훈련 사이의 여유를 두는 목적이에요.
- 구성 이유: 장비에서 낮은 노력으로 움직이는 대안이다.
- 부담·한계: 수영 연구가 이 시간과 기구의 효과를 입증한 것은 아니다.
- 회복 이유: 별도 회복 구간 없이 이어가는 구성이다. 구간 안의 강도·운동 방식 전환은 원본에 남긴다.
- 구간 목적: X-REC-04-1: REC / 일립티컬 / 실내 장비
- 제안 경험 범위: DEVELOPING, EXPERIENCED (개별 적합성 입증 아님).
- 근거: [CROSS_TRAINING](https://pubmed.ncbi.nlm.nih.gov/7649149/). 새 숫자 전체는 제품 코칭 초안이다.
- 다음 검토: EXACT_DOSE_AND_POPULATION, OWNER_FINAL_ADOPTION, WARMUP_COOLDOWN_BINDING, CURRENT_SAFETY_AND_AUTHORITY, FRAME_AND_NEIGHBOUR_SESSIONS, PERSONAL_PACE_OR_EFFORT_BINDING, ELLIPTICAL_AVAILABLE

### X-REC-05 수중 달리기 · Aqua Jog

- 방법: 15min @ RPE 1–2
- 목적: 새 고강도 자극을 쌓기보다 부담을 낮춘 움직임으로 다음 훈련 사이의 여유를 두는 목적이에요.
- 구성 이유: 지상 달리기와 다른 방식으로 낮은 노력을 유지한다.
- 부담·한계: 수중 적응과 안전 장비·시설 조건이 필요하다. 부상 치료 지시가 아니다.
- 회복 이유: 별도 회복 구간 없이 이어가는 구성이다. 구간 안의 강도·운동 방식 전환은 원본에 남긴다.
- 구간 목적: X-REC-05-1: REC / 수중 달리기 / 수영장
- 제안 경험 범위: DEVELOPING, EXPERIENCED (개별 적합성 입증 아님).
- 근거: [WATER_REVIEW](https://pubmed.ncbi.nlm.nih.gov/35954790/). 새 숫자 전체는 제품 코칭 초안이다.
- 다음 검토: EXACT_DOSE_AND_POPULATION, OWNER_FINAL_ADOPTION, WARMUP_COOLDOWN_BINDING, CURRENT_SAFETY_AND_AUTHORITY, FRAME_AND_NEIGHBOUR_SESSIONS, PERSONAL_PACE_OR_EFFORT_BINDING, WATER_SAFETY_AND_EQUIPMENT

### X-REC-06 가벼운 수영 · Easy Swim

- 방법: 10min @ RPE 1–2
- 목적: 새 고강도 자극을 쌓기보다 부담을 낮춘 움직임으로 다음 훈련 사이의 여유를 두는 목적이에요.
- 구성 이유: 수영에 익숙한 사람의 낮은 노력 활동 대안이다.
- 부담·한계: 수영 기술이 부족하면 낮은 노력이 아닐 수 있다.
- 회복 이유: 별도 회복 구간 없이 이어가는 구성이다. 구간 안의 강도·운동 방식 전환은 원본에 남긴다.
- 구간 목적: X-REC-06-1: REC / 수영 / 수영장
- 제안 경험 범위: DEVELOPING, EXPERIENCED (개별 적합성 입증 아님).
- 근거: [CROSS_TRAINING](https://pubmed.ncbi.nlm.nih.gov/7649149/). 새 숫자 전체는 제품 코칭 초안이다.
- 다음 검토: EXACT_DOSE_AND_POPULATION, OWNER_FINAL_ADOPTION, WARMUP_COOLDOWN_BINDING, CURRENT_SAFETY_AND_AUTHORITY, FRAME_AND_NEIGHBOUR_SESSIONS, PERSONAL_PACE_OR_EFFORT_BINDING, SWIMMING_ABILITY_AND_WATER_SAFETY

### X-REC-07 자전거 + 걷기

- 방법: 10min @ RPE 1–2 → 10min @ RPE 1–2
- 목적: 새 고강도 자극을 쌓기보다 부담을 낮춘 움직임으로 다음 훈련 사이의 여유를 두는 목적이에요.
- 구성 이유: 두 운동 방식을 짧게 나누어 낮은 노력으로 연결한다.
- 부담·한계: 두 부분 모두 보존하며 달리기 20분으로 저장하지 않는다.
- 회복 이유: 별도 회복 구간 없이 이어가는 구성이다. 구간 안의 강도·운동 방식 전환은 원본에 남긴다.
- 구간 목적: X-REC-07-1: REC / 자전거 / 실내 장비; X-REC-07-2: REC / 걷기 / 평지
- 제안 경험 범위: DEVELOPING, EXPERIENCED (개별 적합성 입증 아님).
- 근거: [CROSS_TRAINING](https://pubmed.ncbi.nlm.nih.gov/7649149/). 새 숫자 전체는 제품 코칭 초안이다.
- 다음 검토: EXACT_DOSE_AND_POPULATION, OWNER_FINAL_ADOPTION, WARMUP_COOLDOWN_BINDING, CURRENT_SAFETY_AND_AUTHORITY, FRAME_AND_NEIGHBOUR_SESSIONS, PERSONAL_PACE_OR_EFFORT_BINDING, BIKE_AVAILABLE

### X-REC-08 걷기–조깅–걷기

- 방법: 5min @ RPE 1–2 → 10min @ RPE 1–2 → 5min @ RPE 1–2
- 목적: 새 고강도 자극을 쌓기보다 부담을 낮춘 움직임으로 다음 훈련 사이의 여유를 두는 목적이에요.
- 구성 이유: 조깅 전후에 걷기를 명시적으로 배치한다.
- 부담·한계: 걷기를 포함한 20분 구성이다. 준비·정리와 중복 합산하지 않는다.
- 회복 이유: 별도 회복 구간 없이 이어가는 구성이다. 구간 안의 강도·운동 방식 전환은 원본에 남긴다.
- 구간 목적: X-REC-08-1: REC / 걷기 / 평지; X-REC-08-2: REC / 달리기 / 평지; X-REC-08-3: REC / 걷기 / 평지
- 제안 경험 범위: DEVELOPING, EXPERIENCED (개별 적합성 입증 아님).
- 근거: [DISTANCE_REVIEW](https://pmc.ncbi.nlm.nih.gov/articles/PMC8975965/). 새 숫자 전체는 제품 코칭 초안이다.
- 다음 검토: EXACT_DOSE_AND_POPULATION, OWNER_FINAL_ADOPTION, WARMUP_COOLDOWN_BINDING, CURRENT_SAFETY_AND_AUTHORITY, FRAME_AND_NEIGHBOUR_SESSIONS, PERSONAL_PACE_OR_EFFORT_BINDING

### X-HILL-01 8초 언덕 가속 · Hill Sprint

- 방법: 6 × 8s @ HIGH_OUTPUT_CONTROLLED · r시간 미지정 Walk
- 목적: 매우 짧은 가속·스피드 구간에서 ATP를 빠르게 공급하며 높은 출력을 내는 능력을 준비해요.
- 구성 이유: 짧은 오르막 고출력 구간으로 평지와 다른 저항 조건을 준다.
- 부담·한계: 경사와 접지에 따라 부담이 달라지고 하산 완료가 충분한 회복을 뜻하지 않는다.
- 회복 이유: 걸어서 출발점으로 안전하게 돌아간다. 내리막을 빠르게 달리지 않는다. 지형에 따라 걸리는 시간은 미산출이다.
- 구간 목적: X-HILL-01-1-1: ATP-PC / 달리기 / 오르막
- 제안 경험 범위: EXPERIENCED (개별 적합성 입증 아님).
- 근거: [HILLS](https://worldathletics.org/personal-best/performance/hill-running-training-variety-speed-sessions), [SPEED_QUALITY](https://www.nsca.com/education/articles/kinetic-select/designing-speed-training-sessions/). 새 숫자 전체는 제품 코칭 초안이다.
- 다음 검토: EXACT_DOSE_AND_POPULATION, OWNER_FINAL_ADOPTION, WARMUP_COOLDOWN_BINDING, CURRENT_SAFETY_AND_AUTHORITY, FRAME_AND_NEIGHBOUR_SESSIONS, PERSONAL_PACE_OR_EFFORT_BINDING, HILL_SURFACE_GRADE_RETURN, ACCELERATION_AND_DECELERATION_SPACE

### X-HILL-02 40m 언덕 가속

- 방법: 4 × 40m @ HIGH_OUTPUT_CONTROLLED · r시간 미지정 Walk
- 목적: 매우 짧은 가속·스피드 구간에서 ATP를 빠르게 공급하며 높은 출력을 내는 능력을 준비해요.
- 구성 이유: 오르막 길이를 기준으로 짧은 가속을 반복한다.
- 부담·한계: 평지 40m 속도나 소요시간을 복사하지 않는다.
- 회복 이유: 걸어서 출발점으로 안전하게 돌아간다. 내리막을 빠르게 달리지 않는다. 지형에 따라 걸리는 시간은 미산출이다.
- 구간 목적: X-HILL-02-1-1: ATP-PC / 달리기 / 오르막
- 제안 경험 범위: EXPERIENCED (개별 적합성 입증 아님).
- 근거: [HILLS](https://worldathletics.org/personal-best/performance/hill-running-training-variety-speed-sessions), [SPEED_QUALITY](https://www.nsca.com/education/articles/kinetic-select/designing-speed-training-sessions/). 새 숫자 전체는 제품 코칭 초안이다.
- 다음 검토: EXACT_DOSE_AND_POPULATION, OWNER_FINAL_ADOPTION, WARMUP_COOLDOWN_BINDING, CURRENT_SAFETY_AND_AUTHORITY, FRAME_AND_NEIGHBOUR_SESSIONS, PERSONAL_PACE_OR_EFFORT_BINDING, HILL_SURFACE_GRADE_RETURN, ACCELERATION_AND_DECELERATION_SPACE

### X-HILL-03 6초 언덕 세트

- 방법: 2 sets × (3 × 6s @ HIGH_OUTPUT_CONTROLLED · r시간 미지정 Walk → 종료 뒤 시간 미지정 Walk) · R3min Walk/Stand
- 목적: 매우 짧은 가속·스피드 구간에서 ATP를 빠르게 공급하며 높은 출력을 내는 능력을 준비해요.
- 구성 이유: 짧은 오르막 반복을 세트로 나누어 둔다.
- 부담·한계: 각 세트 마지막에도 걷기 복귀가 있고, 그 뒤 세트 사이에만 3분을 더 쉰다. 고정 3분을 전체 회복으로 표시하지 않는다.
- 회복 이유: 출력을 낮춰 다음 반복을 준비한다. 완전 회복을 보장하지 않는다. / 걸어서 출발점으로 안전하게 돌아간다. 내리막을 빠르게 달리지 않는다. 지형에 따라 걸리는 시간은 미산출이다.
- 구간 목적: X-HILL-03-1-1-1: ATP-PC / 달리기 / 오르막
- 제안 경험 범위: EXPERIENCED (개별 적합성 입증 아님).
- 근거: [HILLS](https://worldathletics.org/personal-best/performance/hill-running-training-variety-speed-sessions), [SPEED_QUALITY](https://www.nsca.com/education/articles/kinetic-select/designing-speed-training-sessions/). 새 숫자 전체는 제품 코칭 초안이다.
- 다음 검토: EXACT_DOSE_AND_POPULATION, OWNER_FINAL_ADOPTION, WARMUP_COOLDOWN_BINDING, CURRENT_SAFETY_AND_AUTHORITY, FRAME_AND_NEIGHBOUR_SESSIONS, PERSONAL_PACE_OR_EFFORT_BINDING, HILL_SURFACE_GRADE_RETURN, ACCELERATION_AND_DECELERATION_SPACE

### X-HILL-04 30초 언덕 반복

- 방법: 6 × 30s @ RPE 8–9 · r시간 미지정 Walk + 60s Stand
- 목적: 짧은 고강도 구간에서 빠른 ATP 공급을 요구하고, 반복되는 부담 속에서도 계획한 출력을 이어 갈 능력을 준비해요.
- 구성 이유: 오르막의 높은 에너지 요구를 일정 시간 유지하고 복귀 뒤 추가로 쉰다.
- 부담·한계: 짧은 언덕 가속과 같은 훈련이 아니다. 지형과 누적 출력 저하를 확인한다.
- 회복 이유: 걸어서 출발점으로 안전하게 돌아간다. 내리막을 빠르게 달리지 않는다. 지형에 따라 걸리는 시간은 미산출이다. / 출력을 낮춰 다음 반복을 준비한다. 완전 회복을 보장하지 않는다.
- 구간 목적: X-HILL-04-1-1: GLY / 달리기 / 오르막
- 제안 경험 범위: EXPERIENCED (개별 적합성 입증 아님).
- 근거: [HILLS](https://worldathletics.org/personal-best/performance/hill-running-training-variety-speed-sessions), [SPRINT_RECOVERY](https://pubmed.ncbi.nlm.nih.gov/21777153/). 새 숫자 전체는 제품 코칭 초안이다.
- 다음 검토: EXACT_DOSE_AND_POPULATION, OWNER_FINAL_ADOPTION, WARMUP_COOLDOWN_BINDING, CURRENT_SAFETY_AND_AUTHORITY, FRAME_AND_NEIGHBOUR_SESSIONS, PERSONAL_PACE_OR_EFFORT_BINDING, HILL_SURFACE_GRADE_RETURN

### X-HILL-05 90초 언덕 인터벌

- 방법: 6 × 90s @ RPE 7–8 · r시간 미지정 Walk
- 목적: 높은 산소 이용이 필요한 운동 구간을 회복과 함께 반복해 강한 유산소 노력을 이어 갈 능력을 준비해요.
- 구성 이유: 오르막에서 긴 유산소 반복 노력을 구성한다.
- 부담·한계: 하산 시간이 길거나 짧아질 때 같은 자극이 유지된다고 단정하지 않는다.
- 회복 이유: 걸어서 출발점으로 안전하게 돌아간다. 내리막을 빠르게 달리지 않는다. 지형에 따라 걸리는 시간은 미산출이다.
- 구간 목적: X-HILL-05-1-1: VO2 / 달리기 / 오르막
- 제안 경험 범위: EXPERIENCED (개별 적합성 입증 아님).
- 근거: [HILLS](https://worldathletics.org/personal-best/performance/hill-running-training-variety-speed-sessions), [INTERVAL_LENGTH](https://pubmed.ncbi.nlm.nih.gov/15387806/). 새 숫자 전체는 제품 코칭 초안이다.
- 다음 검토: EXACT_DOSE_AND_POPULATION, OWNER_FINAL_ADOPTION, WARMUP_COOLDOWN_BINDING, CURRENT_SAFETY_AND_AUTHORITY, FRAME_AND_NEIGHBOUR_SESSIONS, PERSONAL_PACE_OR_EFFORT_BINDING, HILL_SURFACE_GRADE_RETURN

### X-HILL-06 3분 언덕 인터벌

- 방법: 4 × 3min @ RPE 7–8 · r시간 미지정 Walk + 60s Stand
- 목적: 높은 산소 이용이 필요한 운동 구간을 회복과 함께 반복해 강한 유산소 노력을 이어 갈 능력을 준비해요.
- 구성 이유: 긴 오르막 반복 뒤 걷기 복귀와 추가 회복을 구분한다.
- 부담·한계: 충분한 길이의 코스와 안전한 복귀 경로가 필요하다.
- 회복 이유: 걸어서 출발점으로 안전하게 돌아간다. 내리막을 빠르게 달리지 않는다. 지형에 따라 걸리는 시간은 미산출이다. / 출력을 낮춰 다음 반복을 준비한다. 완전 회복을 보장하지 않는다.
- 구간 목적: X-HILL-06-1-1: VO2 / 달리기 / 오르막
- 제안 경험 범위: EXPERIENCED (개별 적합성 입증 아님).
- 근거: [HILLS](https://worldathletics.org/personal-best/performance/hill-running-training-variety-speed-sessions), [INTERVAL_LENGTH](https://pubmed.ncbi.nlm.nih.gov/15387806/). 새 숫자 전체는 제품 코칭 초안이다.
- 다음 검토: EXACT_DOSE_AND_POPULATION, OWNER_FINAL_ADOPTION, WARMUP_COOLDOWN_BINDING, CURRENT_SAFETY_AND_AUTHORITY, FRAME_AND_NEIGHBOUR_SESSIONS, PERSONAL_PACE_OR_EFFORT_BINDING, HILL_SURFACE_GRADE_RETURN

### X-HILL-07 6분 언덕 템포

- 방법: 3 × 6min @ RPE 6–7 · r시간 미지정 Walk
- 목적: 지속 가능한 비교적 높은 노력을 이어 가며, 에너지 공급과 젖산 생성·이용이 함께 일어나는 강도에서 페이스를 유지할 능력을 준비해요.
- 구성 이유: 역치 관련 노력을 오르막에서 길게 유지하는 안이다.
- 부담·한계: 하산 회복이 길어질 수 있어 평지 크루즈와 동등하지 않다.
- 회복 이유: 걸어서 출발점으로 안전하게 돌아간다. 내리막을 빠르게 달리지 않는다. 지형에 따라 걸리는 시간은 미산출이다.
- 구간 목적: X-HILL-07-1-1: LT / 달리기 / 오르막
- 제안 경험 범위: EXPERIENCED (개별 적합성 입증 아님).
- 근거: [HILLS](https://worldathletics.org/personal-best/performance/hill-running-training-variety-speed-sessions), [THRESHOLD](https://support.vdoto2.com/2017/12/whats-threshold-pace/). 새 숫자 전체는 제품 코칭 초안이다.
- 다음 검토: EXACT_DOSE_AND_POPULATION, OWNER_FINAL_ADOPTION, WARMUP_COOLDOWN_BINDING, CURRENT_SAFETY_AND_AUTHORITY, FRAME_AND_NEIGHBOUR_SESSIONS, PERSONAL_PACE_OR_EFFORT_BINDING, HILL_SURFACE_GRADE_RETURN

### X-HILL-08 10분 지속 언덕 템포

- 방법: 10min @ RPE 6–7 → 종료 뒤 시간 미지정 Walk
- 목적: 지속 가능한 비교적 높은 노력을 이어 가며, 에너지 공급과 젖산 생성·이용이 함께 일어나는 강도에서 페이스를 유지할 능력을 준비해요.
- 구성 이유: 연속 오르막 노력과 종료 후 복귀를 구분한다.
- 부담·한계: 복귀 시간이 미정이라 전체 시간을 10분으로 제시하지 않는다.
- 회복 이유: 걸어서 출발점으로 안전하게 돌아간다. 내리막을 빠르게 달리지 않는다. 지형에 따라 걸리는 시간은 미산출이다.
- 구간 목적: X-HILL-08-1: LT / 달리기 / 오르막
- 제안 경험 범위: EXPERIENCED (개별 적합성 입증 아님).
- 근거: [HILLS](https://worldathletics.org/personal-best/performance/hill-running-training-variety-speed-sessions), [THRESHOLD](https://support.vdoto2.com/2017/12/whats-threshold-pace/). 새 숫자 전체는 제품 코칭 초안이다.
- 다음 검토: EXACT_DOSE_AND_POPULATION, OWNER_FINAL_ADOPTION, WARMUP_COOLDOWN_BINDING, CURRENT_SAFETY_AND_AUTHORITY, FRAME_AND_NEIGHBOUR_SESSIONS, PERSONAL_PACE_OR_EFFORT_BINDING, HILL_SURFACE_GRADE_RETURN

### X-HILL-09 완만한 언덕 조깅 · Rolling Easy

- 방법: 30min @ RPE 3–4
- 목적: 편안하게 이어 가는 운동으로 지속적인 에너지 공급을 다루고, 다른 훈련을 받쳐 주는 기초 지구력을 준비해요.
- 구성 이유: 오르내리는 코스에서도 낮은 노력을 유지한다.
- 부담·한계: 오르막에서 평지 페이스를 강제하거나 내리막을 질주하지 않는다.
- 회복 이유: 별도 회복 구간 없이 이어가는 구성이다. 구간 안의 강도·운동 방식 전환은 원본에 남긴다.
- 구간 목적: X-HILL-09-1: BASE / 달리기 / 오르내리는 코스
- 제안 경험 범위: DEVELOPING, EXPERIENCED (개별 적합성 입증 아님).
- 근거: [HILLS](https://worldathletics.org/personal-best/performance/hill-running-training-variety-speed-sessions), [DISTANCE_REVIEW](https://pmc.ncbi.nlm.nih.gov/articles/PMC8975965/). 새 숫자 전체는 제품 코칭 초안이다.
- 다음 검토: EXACT_DOSE_AND_POPULATION, OWNER_FINAL_ADOPTION, WARMUP_COOLDOWN_BINDING, CURRENT_SAFETY_AND_AUTHORITY, FRAME_AND_NEIGHBOUR_SESSIONS, PERSONAL_PACE_OR_EFFORT_BINDING, HILL_SURFACE_GRADE_RETURN

### X-HILL-10 오르막 걷기 반복

- 방법: 4 × 5min @ RPE 3 · r시간 미지정 Walk
- 목적: 편안하게 이어 가는 운동으로 지속적인 에너지 공급을 다루고, 다른 훈련을 받쳐 주는 기초 지구력을 준비해요.
- 구성 이유: 달리기 대신 낮은 노력의 오르막 걷기로 지속 활동을 만든다.
- 부담·한계: 경사가 높으면 같은 속도에서도 강도가 높아진다. 회복일과 자동 동치가 아니다.
- 회복 이유: 걸어서 출발점으로 안전하게 돌아간다. 내리막을 빠르게 달리지 않는다. 지형에 따라 걸리는 시간은 미산출이다.
- 구간 목적: X-HILL-10-1-1: BASE / 걷기 / 오르막
- 제안 경험 범위: DEVELOPING, EXPERIENCED (개별 적합성 입증 아님).
- 근거: [HILLS](https://worldathletics.org/personal-best/performance/hill-running-training-variety-speed-sessions). 새 숫자 전체는 제품 코칭 초안이다.
- 다음 검토: EXACT_DOSE_AND_POPULATION, OWNER_FINAL_ADOPTION, WARMUP_COOLDOWN_BINDING, CURRENT_SAFETY_AND_AUTHORITY, FRAME_AND_NEIGHBOUR_SESSIONS, PERSONAL_PACE_OR_EFFORT_BINDING, HILL_SURFACE_GRADE_RETURN

### X-HILL-11 언덕 + 평지 변속

- 방법: 6 × (30s @ RPE 8–9 → 30s @ RPE 5) · r시간 미지정 Walk
- 목적: 구성이 확인된 경우 서로 다른 운동 구간을 연결해 지속적인 에너지 공급과 강도 변화에 대응하는 능력을 함께 준비해요.
- 구성 이유: 언덕 뒤 연결된 평지 구간에서 낮춘 목표 노력으로 이어간다.
- 부담·한계: 이어지는 평지 구간이 실제 있는 코스여야 한다. 평지는 휴식이 아니다.
- 회복 이유: 걸어서 출발점으로 안전하게 돌아간다. 내리막을 빠르게 달리지 않는다. 지형에 따라 걸리는 시간은 미산출이다.
- 구간 목적: X-HILL-11-1-1: GLY / 달리기 / 오르막; X-HILL-11-1-2: STEADY / 달리기 / 평지
- 제안 경험 범위: EXPERIENCED (개별 적합성 입증 아님).
- 근거: [HILLS](https://worldathletics.org/personal-best/performance/hill-running-training-variety-speed-sessions), [SPRINT_RECOVERY](https://pubmed.ncbi.nlm.nih.gov/21777153/). 새 숫자 전체는 제품 코칭 초안이다.
- 다음 검토: EXACT_DOSE_AND_POPULATION, OWNER_FINAL_ADOPTION, WARMUP_COOLDOWN_BINDING, CURRENT_SAFETY_AND_AUTHORITY, FRAME_AND_NEIGHBOUR_SESSIONS, PERSONAL_PACE_OR_EFFORT_BINDING, HILL_SURFACE_GRADE_RETURN, CONNECTED_HILL_FLAT_ROUTE

### X-HILL-12 언덕 인터벌 + 평지 템포

- 방법: 2 sets × (1min @ RPE 7–8 → 종료 뒤 시간 미지정 Walk → 2min @ RPE 6–7) · R3min Walk/Stand
- 목적: 구성이 확인된 경우 서로 다른 운동 구간을 연결해 지속적인 에너지 공급과 강도 변화에 대응하는 능력을 함께 준비해요.
- 구성 이유: 오르막 자극 뒤 복귀하여 평지 역치성 노력을 별도로 수행한다.
- 부담·한계: 하산 시간이 변하면 연결 자극도 달라지므로 고정 회복 세션처럼 취급하지 않는다.
- 회복 이유: 출력을 낮춰 다음 반복을 준비한다. 완전 회복을 보장하지 않는다. / 걸어서 출발점으로 안전하게 돌아간다. 내리막을 빠르게 달리지 않는다. 지형에 따라 걸리는 시간은 미산출이다.
- 구간 목적: X-HILL-12-1-1: VO2 / 달리기 / 오르막; X-HILL-12-1-2: LT / 달리기 / 평지
- 제안 경험 범위: EXPERIENCED (개별 적합성 입증 아님).
- 근거: [HILLS](https://worldathletics.org/personal-best/performance/hill-running-training-variety-speed-sessions), [INTERVAL_LENGTH](https://pubmed.ncbi.nlm.nih.gov/15387806/), [THRESHOLD](https://support.vdoto2.com/2017/12/whats-threshold-pace/). 새 숫자 전체는 제품 코칭 초안이다.
- 다음 검토: EXACT_DOSE_AND_POPULATION, OWNER_FINAL_ADOPTION, WARMUP_COOLDOWN_BINDING, CURRENT_SAFETY_AND_AUTHORITY, FRAME_AND_NEIGHBOUR_SESSIONS, PERSONAL_PACE_OR_EFFORT_BINDING, HILL_SURFACE_GRADE_RETURN

## 출처가 말하는 범위

### DISTANCE_REVIEW

[Haugen et al., The Training Characteristics of World-Class Distance Runners (2022)](https://pmc.ncbi.nlm.nih.gov/articles/PMC8975965/)

- 종류: REVIEW / 확인: SEARCH_EXCERPT_REVIEWED
- 사용한 내용: 세계 정상급 장거리 선수의 지속 달리기와 강도 배분을 다루는 종설.
- 적용 한계: 엘리트의 관행을 개인의 권장 주간량·장거리 상한으로 복사하지 않는다.

### THRESHOLD

[VDOT, What's Threshold Pace?](https://support.vdoto2.com/2017/12/whats-threshold-pace/)

- 종류: COACHING / 확인: PRIOR_REVIEW_REFERENCE
- 사용한 내용: 템포런과 회복을 둔 크루즈 인터벌의 구분.
- 적용 한계: 여기의 새 사다리·세트·거리 조합이나 RPE를 원문의 검증 수치로 보지 않는다.

### REPEATING_SETS

[VDOT, Repeating Sets of Work (2022)](https://support.vdoto2.com/2022/02/repeating-sets-of-work/)

- 종류: COACHING / 확인: PAGE_REVIEWED
- 사용한 내용: 길이가 다른 반복 구간을 세트로 묶는 실제 코칭 예시.
- 적용 한계: VDOT R pace는 RPE 또는 ATP-PC 단독 자극과 같은 말이 아니다. 새 조합의 용량 승인이 아니다.

### SHORT_INTERVALS

[Billat et al. (2000), Intermittent runs at vVO2max](https://pubmed.ncbi.nlm.nih.gov/10638376/)

- 종류: ACUTE_STUDY / 확인: ABSTRACT_REVIEWED
- 사용한 내용: 달리기 선수 8명의 30초 운동/30초 저강도 반복과 연속 운동의 급성 산소섭취 반응 비교.
- 적용 한계: 연구의 vVO2max를 RPE로 대체 검증하지 않는다. 새 15초·30초 세트의 장기 효과나 청소년 용량을 입증하지 않는다.

### INTERVAL_LENGTH

[Seiler and Sjursen (2004), Work duration in self-paced interval training](https://pubmed.ncbi.nlm.nih.gov/15387806/)

- 종류: ACUTE_STUDY / 확인: PRIOR_REVIEW_REFERENCE
- 사용한 내용: 구간 길이와 자기조절 속도에 따른 급성 반응 차이.
- 적용 한계: 시간형을 거리형으로 자동 환산하거나 짧으면 반드시 더 빠르게 달려야 한다고 정하지 않는다.

### SPEED_QUALITY

[NSCA, Designing Speed Training Sessions (2019)](https://www.nsca.com/education/articles/kinetic-select/designing-speed-training-sessions/)

- 종류: COACHING / 확인: PAGE_EXCERPT_REVIEWED
- 사용한 내용: 고출력 수행의 질과 회복을 중시하는 스피드 훈련 설계.
- 적용 한계: 종목·연령별 개인 속도, 완전 회복 시간, 이번 구성의 고정 훈련량을 입증하지 않는다.

### SPRINT_RECOVERY

[Saraslanidis et al. (2011), Sprint running with different rest intervals](https://pubmed.ncbi.nlm.nih.gov/21777153/)

- 종류: TRAINING_STUDY / 확인: PRIOR_REVIEW_REFERENCE
- 사용한 내용: 달리기의 회복 간격 차이가 수행과 대사 반응에 영향을 줄 수 있다는 근거.
- 적용 한계: 모든 해당계 세션에 충분한 회복을 약속하지 않는다. 새 반복·세트의 효과나 인구 범위를 그대로 승인하지 않는다.

### HILLS

[World Athletics / Mara Yamauchi, Hill running training variety](https://worldathletics.org/personal-best/performance/hill-running-training-variety-speed-sessions)

- 종류: COACHING / 확인: SEARCH_EXCERPT_REVIEWED
- 사용한 내용: 짧고 긴 오르막 반복, 언덕 코스·변속·지속 오르막 등 방식의 다양성.
- 적용 한계: 경사·노면·하산 시간과 개별 부담은 따로 확인한다. 재접속 403으로 검색 본문을 참고했고 새 수치의 승인 자료가 아니다.

### WATER_REVIEW

[Deep-water running systematic review (2022)](https://pubmed.ncbi.nlm.nih.gov/35954790/)

- 종류: SYSTEMATIC_REVIEW / 확인: ABSTRACT_REVIEWED
- 사용한 내용: 11개 시험, 287명에 대한 수중 달리기 관련 체력·기능 결과 종합.
- 적용 한계: 연구가 이질적이다. 통증 치료·부상 회복 완료나 육상 달리기와 동등한 부하를 뜻하지 않는다.

### CROSS_TRAINING

[Effects of swim versus run training on performance in runners (1995)](https://pubmed.ncbi.nlm.nih.gov/7649149/)

- 종류: TRAINING_STUDY / 확인: ABSTRACT_REVIEWED
- 사용한 내용: 달리기 선수의 다른 운동 방식 병행과 종목 특이적 적응을 구분하는 근거.
- 적용 한계: 자전거·일립티컬의 정확한 시간이나 회복 효과를 검증한 자료가 아니다. 새 저강도 대안은 제품 코칭 초안이다.

## 상황별 검사

실제 선수 시험이 아니라 선언한 제약을 확인하는 합성 조건이다. 미제외도 실행 승인이 아니다.

| 상황 | 해당 목적 구성 | 조건상 제외 | 검토 대상으로 남음 |
|---|---:|---:|---:|
| 5km 경험자 · 평지 LT | 14 | 2 | 12 |
| 마라톤 · 평지 VO2 | 14 | 2 | 12 |
| 800m · 짧은 고출력 | 11 | 3 | 8 |
| 가속 공간 없음 | 11 | 11 | 0 |
| 언덕 LT | 14 | 12 | 2 |
| 지형 미확인 | 14 | 0 | 14 |
| 입문자 · 고강도 기존 개방으로 오인 금지 | 9 | 9 | 0 |
| 회복 자전거 | 8 | 7 | 1 |
| 수영장 회복 | 8 | 6 | 2 |
| 통증 확인 필요 | 14 | 14 | 0 |
| 상태 미확인 | 14 | 2 | 12 |
| 전체 가능시간 20분 | 14 | 7 | 7 |

## 공개 적용으로 이어갈 작업

1. 경험·최근 훈련량별 적용 범위, 구간별 개인 페이스/노력 기준, 정확한 수치와 회복을 채택한다.
2. 준비·정리·언덕 복귀·장비 전환까지 연결해 전체 시간을 검토한다.
3. 기존 주기와 앞뒤 훈련, 같은 날 오전·오후 관계를 확인한다. 목적별 풀로 연결하고 고정 짝을 두지 않는다.
4. 새 구조를 홈·달력·수행 설명·수치 조절·연결 일지에 동일하게 표시한다. 검수 후 실제 공개 범위를 갱신한다.

## 재현

`cd app` 후 `node scripts/build-expanded-workout-catalog.mjs`로 재생성한다. `--check`는 원본과 보고서의 일치를 검사한다.
동반 JSON SHA-256: `fd46ec21cbe6bfa1ece18840f1c020a13dd74d49adbe25dfd71e7fba483701f4`.
[기존 37개 검토](METHOD_PURPOSE_SUPPLY_REVIEW_V3.md) / [구조화 데이터](EXPANDED_WORKOUT_CATALOG_V3.json)

[DRAFT_COMPLETE]
