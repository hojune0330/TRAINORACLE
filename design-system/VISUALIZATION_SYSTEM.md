# VISUALIZATION SYSTEM — 시각화 정본

> TRAINORACLE의 모든 차트·시각 컴포넌트가 따라야 할 단일 기준 문서.
>
> **목적**: 사용자가 **1초 안에 분류**하고, **5초 안에 상태를 파악**하고,
> **30초 안에 근거를 확인**할 수 있는 시각화 체계.
>
> **선행 문서**:
> - `DESIGN_TOKENS.md` §1.4 (4-tier 컬러 토큰)
> - `SYSTEM_FOUNDATIONS.md` §2 (Visualization 시스템 4 시스템 중 2번)
> - `SAFEGUARDS.md` §1, §4 (Cold start, Narrative 안전)
> - `PHILOSOPHY.md` §5.5, §5.6 (4 Records, Personal Archive)

---

## §0. 결정 요약 (정리본 § Q1~Q6 반영)

| 결정 | 내용 |
|---|---|
| Q1 | 에너지 시스템 색은 **컨텍스트별 4-tier 강도**. "도트·underline만" 규칙은 폐기. |
| Q2 | **사용자 ↔ AI 1:1**. Cohort/Coach view 차트는 **P3로 미룸** |
| Q3 | **Rule engine 단계**의 시각화만 다룸. Track Record 차트는 제외. PB·SB는 1급 시민. |
| Q4 | 시간축 차트는 **1년 default + 범위 토글** (1y / 2y / 3y / all). 추후 확장 가능 구조. |
| Q5 | MIXED(MX)는 보류. 등장 시 **두 시스템 50:50 줄무늬**로 임시 처리. |
| Q6 | **3중 인코딩 의무 (색 + 코드 + 위치/모양)**. 단 정보 과다 시 **단계적 노출**. |

---

## §1. 시각화 철학

### 1.1 인지 깊이 3단계

| 깊이 | 시간 | 사용자 행동 | 시각화 책임 |
|---|---|---|---|
| **Glance** | 1초 | 색만 본다 | 에너지 시스템 분류 즉시 인지 |
| **Scan** | 5초 | 숫자·라벨까지 본다 | 상태(좋음/나쁨/판정 불확실)와 추세 파악 |
| **Inspect** | 30초 | 근거를 확인한다 | verdict, confidence, citation, 데이터 출처 |

모든 차트는 이 3단계를 동시에 만족해야 한다. 한 단계만 잘하는 차트는 부적합.

### 1.2 Tufte × Linear 시각 톤

- **데이터 잉크 비율 ↑**: 격자·테두리 최소화 (`hair` 색 #E8E6DF, 1px)
- **장식 잉크 0**: gradient, glow, shadow, 입체감 모두 금지
- **숫자는 monospace** (JetBrains Mono, `tabular-nums`)
- **섹션 번호** (§1, §2) 사용
- **카드보다 hairline + 여백**으로 그룹화

### 1.3 시간 축이 모든 시각화의 기본

> "데이터는 사용자의 이야기다." (PHILOSOPHY §5.6)

좋은 기록도 나쁜 기록도 시간순으로 그대로 보존된다. 따라서 **거의 모든 차트의 X축은 시간**.
- 시간을 가리는 시각화 금지 (예: PB만 모은 ranking은 부적합 — PB Trail로 시간 위에 그린다)
- DNF / DNS / 부상 / 통증도 시간축에 표시 (감정 평가 없이, 사실로)

### 1.4 데이터 흐름 위에서의 시각화 위치

```
Primary Device → Raw Activity → Derived Metrics → Energy System → Cycle Slot → 9 Rules → Verdict
                                       ↓                ↓               ↓             ↓
                                     CTL/ATL/TSB    Energy stack    Cycle rail    Validation
                                     HR drift        Heatmap                         차트
                                     Pace split

User Input ──────────┐
  PB / SB / Target ──┼──→ PB Trail, Race target gap, Records 표
  Reference ─────────┘
  Pain / RPE / Sleep ───→ Pain trend, Mode chip
```

각 차트가 어느 데이터 단계를 비추는지 명확히 알면 12개가 흩어진 것이 아니라 하나의 시스템이 된다.

---

## §2. 컬러 시스템 (4-tier)

> 토큰 정의는 `DESIGN_TOKENS.md` §1.4. 여기서는 **사용 규칙**만 다룬다.

### 2.1 Tier 1 — Strong (즉시 인지)

색 면적이 크다. 1초 안에 분류돼야 하는 곳.

| 사용처 | 형태 | 면적 |
|---|---|---|
| Calendar 셀 (Week / 9.5-Cycle view) | 셀 배경 또는 좌측 strip 4–6px | 큼 |
| Session card 좌측 컬러바 | 4–6px vertical strip | 중 |
| Session hero (Detail 페이지 상단) | 좌측 6px strip + 점·코드 inline | 큼 |
| Energy stack bar (cycle/week 분포) | 100% width 14–16px height | 큼 |
| 3-year heatmap 셀 | 8–14px square (반응형) | 작음 ×많음 |

**Hex**: `--e-{system}-strong` (예: BASE `#2A6396`, LT `#8A7818`).

### 2.2 Tier 2 — Mid (분석 차트)

차트의 데이터 레이어. 본문 흐름은 유지하되 분류는 명확.

| 사용처 | 형태 |
|---|---|
| Line chart (CTL/ATL/TSB) | 1.5px stroke |
| Bar chart (Weekly TSS, HR drift) | bar fill |
| Distribution stack (Energy mix) | 100% stack |
| Density scatter (Pace × HR) | 3px circle, opacity 0.6 |
| PB Trail | 1.5px stroke + 4px dot at PB |

**Hex**: `--e-{system}-mid` (예: BASE `#4A8FC7`).

### 2.3 Tier 3 — Subtle (본문 안 inline)

가장 작은 면적. 본문 텍스트와 같이 흐른다.

| 사용처 | 형태 |
|---|---|
| Inline tag (`● V2  VO2-Long`) | 7px dot + 2자 코드 + 1.5px underline |
| Mini chip in table cell | 점 + 코드만 |
| Footnote / reference 안 | 코드 + underline |

**Hex**: `--e-{system}-text` (예: BASE `#1D4E75`). 점은 mid 색, underline은 text 색.

### 2.4 Tier 4 — Wash (배경 / 컨텍스트)

5% 톤. 무의식적 인식.

| 사용처 | 형태 |
|---|---|
| Today highlight (Calendar 오늘 셀) | 셀 배경 wash |
| Selected state (필터, range switcher) | 배경 wash |
| Mode chip 배경 (RECOVERY mode 등) | 화면 상단 5% wash |
| Cycle phase 배경 (현재 D-day 셀) | 배경 wash |

**Hex**: `--e-{system}-wash` (예: BASE `#E8F0F7`).

### 2.5 Tier 충돌 규칙

- **같은 영역에서 T1과 T4를 동시에 쓰지 않는다.** 둘 중 하나만.
- **차트 안에서는 T2가 기본**, hover/active에 한해 T1로 강조.
- **T3는 본문 흐름에 종속**, 차트에는 사용 X.

---

## §3. 3중 인코딩과 단계적 노출

### 3.1 인코딩 3축

| 축 | 역할 | 예 |
|---|---|---|
| **색** | Glance (1초 인지) | `#9E5A14` (VO2 strong) |
| **2자 코드** | Scan + color-blind 대응 | `V2` |
| **위치/모양** | Inspect + 보조 인코딩 | dot 위치 (앞/뒤), 패턴 (실선/점선/줄무늬) |

### 3.2 단계적 노출 규칙 (Q6 결정 반영)

정보 과다는 오히려 시각적 불편함. 컴팩트 컨텍스트에서는 모든 축을 다 보이지 않는다.

| 컨텍스트 | 색 | 코드 | 위치/모양 |
|---|---|---|---|
| **Heatmap 셀 (1095개)** | ✓ | hover시만 | — |
| **Calendar 셀** | ✓ | ✓ | 점 위치 (AM/PM) |
| **Session card** | ✓ | ✓ | 좌측 strip = 위치 |
| **본문 inline tag** | ✓ | ✓ | underline = 모양 |
| **Legend / Footnote** | ✓ | ✓ | 패턴 샘플 표시 |

**원칙**: 컴팩트할수록 색만, 확장할수록 코드 + 위치/모양 추가.
사용자가 hover하거나 클릭하면 상위 축이 노출되는 식으로 설계.

### 3.3 Color-blind 대응

- **2자 코드는 차트 legend에 항상 표시** (단, 차트 셀 안에는 컴팩트 시 생략 가능)
- **패턴 보조** (점선/실선/줄무늬)는 line/distribution에서 우선 활용
- **Hover/click 시 코드 노출**이 최후의 보루

---

## §4. 12개 차트 타입 카탈로그

> 정리본 §16 + SYSTEM_FOUNDATIONS §2.3을 통합. 각 차트는 **언제·어디서·어떻게**를 명시.

### 차트 인덱스

| # | 이름 | Tier | 사용 화면 | 데이터 단계 |
|---|---|---|---|---|
| C-1 | Energy System stack bar | T2 | Dashboard, Analysis, Cycle | Energy classification |
| C-2 | 3-year training heatmap | T1 | Personal Archive, Analysis | Raw activity volume |
| C-3 | PB Trail | T2 | Records, Personal Archive | PB / SB |
| C-4 | CTL / ATL / TSB line | T2 | Analysis | Derived metrics |
| C-5 | HR drift bar (target band) | T2 | Session Detail, Analysis | Derived metrics |
| C-6 | Pace split curve | T2 | Session Detail, Competitions | Raw activity |
| C-7 | Cycle rhythm rail (9.5-day) | T1 | Calendar, Dashboard | Cycle slot |
| C-8 | Weekly load distribution | T2 | Analysis, Dashboard | Energy + volume |
| C-9 | Injury / pain trend | T2 | Personal Archive, Dashboard | User input |
| C-10 | Race target gap | T2 | Competitions, Records | Target vs PB |
| C-11 | Cohort comparison | T2 | (P3, 추후) | External (Reference) |
| C-12 | Session result comparison | T2 | Session Detail | This vs Last (curve compare) |

---

### C-1. Energy System stack bar

**무엇을**: 한 사이클(또는 한 주)의 시간/거리를 6개 에너지 시스템으로 분해해 가로 stack으로 표시.

**어디서**:
- Dashboard "이번 사이클" 모듈
- Analysis "Energy distribution" 섹션
- Cycle Report

**규격**:
- 가로 100% × 높이 14–16px
- 5–6 segment
- 각 segment에 **점·코드** (mid 색), 본 색은 strong
- Legend 별도 (segment 하단 또는 우측)

**Glance / Scan / Inspect**:
- Glance: 가장 큰 색 면적 → 이번 사이클의 강조 시스템
- Scan: 각 segment의 % 라벨
- Inspect: 클릭 시 일별 contribution drill-down (DESIGN_TOKENS §2.5 drill-down)

**Tier**: T2 (data) + segment label은 T3 inline tag

**Cold start (SAFEGUARDS §1)**:
- `bootstrap` / `cold` 상태: 표시 X, "데이터 import 중" placeholder
- `fresh-import`: "3년 / N개 활동 분석 완료" 라벨
- `warming`: 점선 stroke + 신뢰도 -20% 라벨

---

### C-2. Multi-year training heatmap

**무엇을**: 일 단위 훈련량(거리 또는 TSS)을 셀 강도로 표시. 1년·2년·3년 토글.

**어디서**:
- Personal Archive (★ 메인 시각화)
- Analysis "Long-term volume" 섹션

**규격**:
- 1년: 7주(행) × 53주(열) → 모바일 360px에서 셀 약 4–5px
- 2년·3년: range switcher로 확장. 데스크톱은 동시에 보기, 모바일은 토글
- 셀 색: T1 strong 색을 강도(0–4 단계)로 채도 조절. 각 셀의 **dominant energy system** 색 사용
- 셀 hover: 날짜·거리·세션 타입 tooltip

**Range Switcher 구조** (Q4 — 추후 확장 고려):
```
[ 1Y ]  [ 2Y ]  [ 3Y ]  [ all ]
```
- 모바일: 1Y default, 토글로 확장
- 데스크톱: 1Y default, 3Y까지 한 화면, all은 별도 페이지
- **확장 가능 구조**: range switcher 컴포넌트는 4w/8w/12w/1y/2y/3y/all 모두 받을 수 있도록 설계

**감정 평가 금지** (SAFEGUARDS §4):
- 빈 셀(휴식/부상)도 회색 wash로 표시
- "스트릭" / "연속 N일" 표시 금지
- 그냥 "그날 거리 X km" 사실만

---

### C-3. PB Trail

**무엇을**: 종목별 PB의 시간순 갱신 기록을 line으로 표시. SB도 함께 표시.

**어디서**:
- Records 화면 (`SPRINT2_Records.html`)
- Personal Archive
- Competitions (next race 종목의 PB Trail)

**규격**:
- X: 시간 (1Y / 2Y / 3Y / all)
- Y: 기록 (시간, 작을수록 위)
- **PB line**: T2 mid stroke 1.5px (해당 종목 에너지 시스템 색)
- **SB markers**: 매 시즌의 SB를 4px dot으로 line 위에 표시
- **Target**: 점선 horizontal line (사용자가 target 입력했을 때만)
- **Reference**: 점선 horizontal line, 회색(`ink-3`)

**Glance / Scan / Inspect**:
- Glance: line이 위(=빠름)로 가는가, 아래로 가는가
- Scan: 가장 최근 PB 값, target까지 거리
- Inspect: 각 dot 클릭 → 그 PB 갱신 세션/대회 상세

**Q3 결정 반영**: PB·SB는 시각화 1급 시민. PB Trail은 모든 종목별로 만든다 (1500m / 5000m / 10000m).

**Narrative 안전 (SAFEGUARDS §4)**:
- 후퇴(현재 SB가 PB보다 느림)도 그대로 표시
- "전성기 대비 N% 하락" 같은 평가 금지
- "1년 전 16:42, 지금 16:10. -32"" 같은 사실만

---

### C-4. CTL / ATL / TSB line chart

**무엇을**: Training load 3종(만성/급성/스트레스밸런스) 추이.

**어디서**:
- Analysis "Performance Manager" 섹션 (메인)
- Dashboard mini sparkline (KPI 옆)

**규격**:
- X: 시간 (4w / 8w / 12w / 1y range switcher)
- Y: load 값
- 3 line:
  - CTL: `ink` 1.5px stroke
  - ATL: `warn` 1.5px stroke
  - TSB: `brand` 1.5px stroke (zero line은 dashed `hair`)
- 격자: hairline `#E8E6DF`
- "today" 마커: vertical dashed line

**Tier**: T2. 에너지 시스템 색 X (load는 시스템과 무관).

**Inspect**:
- Hover: tooltip with mono numbers
- 클릭: 해당 일자 세션 목록 drill-down

---

### C-5. HR drift bar with target band

**무엇을**: MAIN 세션의 HR drift % 를 bar로, 목표 band를 회색 영역으로.

**어디서**:
- Session Detail §4 Validation
- Analysis "HR drift · MAIN" 섹션

**규격**:
- X: 세션 시간순 (가장 최근 7–14개)
- Y: drift %
- Bar: T2 mid 색 (해당 세션의 에너지 시스템 색)
- Target band: 회색 wash (예: ±3%)
- Band 초과 시 bar 색이 `warn`으로 자동 전환 (Rule R-7 위반 표시)

**Inspect**:
- Hover: 해당 세션 날짜·페이스·drift 값
- 클릭: Session Detail로 이동

**Verdict 연동**:
- 14d 평균이 band 초과 → INBOX RULE 자동 생성

---

### C-6. Pace split curve

**무엇을**: 한 세션 안의 lap별 pace 변화 곡선.

**어디서**:
- Session Detail Hero (오늘 세션 결과)
- Competitions (race pace strategy)

**규격**:
- X: lap 번호 (1500m = 4 lap, 5000m = 12.5 lap)
- Y: lap pace (시간, 작을수록 위)
- Line: T2 mid 색 (세션 에너지 시스템 색)
- Target pace: horizontal `brand` dashed line
- Drift threshold: 마지막 2 rep (R-7) 회색 wash 영역
- 각 lap에 **dot + mono 숫자**

---

### C-7. Cycle rhythm rail (9.5-day)

**무엇을**: 9.5일 사이클의 10-slot rail. 각 slot이 어느 세션 타입인지 색으로.

**어디서**:
- Calendar 9.5-Cycle view (메인)
- Dashboard cycle progress (mini)
- Session Detail §5 Cycle context

**규격**:
- 가로 10 cell (D-1 ~ D-9 + transition .5)
- 각 cell:
  - 배경: T1 strong 색 (해당 D의 세션 에너지 시스템)
  - MAIN(D-5): cell border `ink-2` 강조 + ※ marker
  - 오늘: T4 wash + ink border
  - 미완료 미래: `surface-2`
  - 완료 과거: T1 strong + ✓ tick
  - DNF/누락: T1 strong + 점선 border (사실 그대로 표시)

**Tier**: T1 (Strong) — 9.5-Cycle은 제품 정체성, 색 강도 최대.

**모바일**:
- 가로 스크롤 X (v1 사용성 이슈 반영, SCREENS §4)
- list view (10 row vertical)

---

### C-8. Weekly load distribution

**무엇을**: 주간 TSS 또는 distance를 7-day bar로.

**어디서**:
- Dashboard "이번 주" 모듈
- Analysis weekly summary

**규격**:
- 7 bar (월–일)
- Bar 색: T2 mid (각 일의 dominant energy system)
- 높이: TSS 또는 km
- "today" 마커
- 주 누적값 mono 숫자 (우상단)

---

### C-9. Injury / pain trend

**무엇을**: 사용자가 입력한 통증 부위·강도의 시간순 추이.

**어디서**:
- Personal Archive (메인)
- Dashboard CAUTION/RECOVERY mode 시 우선 표시

**규격**:
- X: 시간 (4w / 8w / 12w / 1y / all)
- Y: 통증 강도 (0–5)
- 부위별로 **별도 line** (오른 무릎, 왼 종아리 등)
- 색: 각 line은 ink-3, ink-2 등 회색 계열 (에너지 시스템 색 사용 X — 통증은 분류 X)
- Threshold lines:
  - 3/5: dashed `warn`
  - 4/5: solid `warn` (CAUTION mode 진입 기준, SAFEGUARDS §3)

**Narrative 안전**:
- 통증 입력해도 **즉각 페널티 X** (SAFEGUARDS §3)
- "걱정됩니다" 같은 메시지 금지
- 사실만: "4/5 입력 — 14일 추세에 반영"

**Mode 연동**:
- 4/5 한 번 → CAUTION 제안 (사용자 거부 가능)
- 3일 연속 같은 부위 → CAUTION 제안

---

### C-10. Race target gap

**무엇을**: 다음 대회 D-day까지 Target과 현재 PB(또는 최근 SB)의 격차를 시각화.

**어디서**:
- Competitions Hero
- Dashboard race week mode

**규격**:
- 수평 number line:
  ```
  [PB 16:10]──────[현재 SB 15:58]──────[Target 15:45]
  ```
- 위에 시간 진행 bar (D−21 taper 시작점 표시, R-9)
- D-day countdown mono 숫자

**Q3 결정 반영**: PB·SB·Target은 모두 1급 시민. 동시에 표시.

**Inspect**:
- 각 마커 클릭 → 해당 기록 세션/대회로 이동

---

### C-11. Cohort comparison (P3 — 추후)

**무엇을**: 동일 그룹 평균/상위 10%와 본인 기록 비교.

**현재 단계 (Q2 결정)**: **표시 X**.

**구조만 미리 준비** (`SCREENS.md` Coach view 항목 참고):
- 데이터 모델: `cohort_aggregate` 테이블
- UI: Pro lock overlay (FEATURE_TIERS §3.1)
- privacy: opt-in only

이번 시각화 시스템 산출물 디자인에는 **placeholder 상태**로만 포함 (locked card 형태).

---

### C-12. Session result comparison (Curve compare)

**무엇을**: This session vs Last session (또는 vs Target) 의 pace/HR 곡선 겹침.

**어디서**:
- Session Detail (방금 완료한 세션 결과)
- Analysis MAIN sessions table에서 두 세션 선택 시

**규격**:
- 두 line:
  - This: T2 mid (세션 에너지 시스템 색), 1.5px
  - Last/Target: `ink-3`, 1.5px dashed
- Delta 표시 우상단: `+12s`, `-3"/km` 등 (정리본 §17.2 — "좋음/나쁨" 평가 X, 사실만)

**Comparison Mode** (SYSTEM_FOUNDATIONS §2.4):
- vs **어제** (어제 같은 시간)
- vs **지난주** 같은 요일
- vs **지난 사이클** D-N
- vs **작년 같은 시기**
- vs **Target**

---

## §5. Comparison Mode (모든 차트 공통)

거의 모든 차트에 비교 토글이 있어야 한다.

### 5.1 비교 표시 규칙

- 두 라인의 색 의미:
  - Current: `ink` (또는 해당 에너지 시스템 mid)
  - Previous: `ink-3` dashed
  - **두 라인에 색으로 좋고 나쁨 부여 X** — 사용자가 판단

- Delta 표기:
  - Mono 숫자, `+12%`, `-3"`, `-32"`
  - 색 부여 X (예: 향상이라고 녹색, 후퇴라고 빨강 — 둘 다 금지)
  - 단순히 mono 사실만

### 5.2 Drill-down

- 모든 통계 숫자는 **클릭 가능**
- CTL 클릭 → 일별 contribution
- 주간 TSS 클릭 → 7일 세션별 분해
- Energy mix 클릭 → 사이클별 비율 변화

---

## §6. Anomaly Markers

차트 위에 이상 신호를 표시.

### 6.1 마커 종류

| 마커 | 의미 | 모양 |
|---|---|---|
| **PB** | 신기록 | ▲ 4px, brand 색, label "PB" |
| **SB** | 시즌 신기록 | △ 4px, ink-2 색, label "SB" |
| **DNF** | 미완주 | ◯ 4px outline, `warn`, label "DNF" |
| **DNS** | 미출전 | ◯ 4px outline dashed, ink-3 |
| **Pain ≥ 4** | 통증 4/5 이상 입력 | × 4px, `warn` |
| **Mode change** | CAUTION/RECOVERY 진입 | vertical dashed line + mode chip |
| **Race day** | 대회일 | vertical solid `brand` line + flag |
| **Rule violation** | 9 Rules fail | × 4px, `warn` + R-N 코드 |

### 6.2 표시 규칙

- 마커는 차트의 **데이터 line 위에 overlay**
- Hover/click 시 detail tooltip
- 너무 많으면(한 화면 8개 초과) **상위 4개 + "이 외 N"** 형태로 접기

---

## §7. Cold Start / Empty / Loading 상태

> SAFEGUARDS §1 매핑.

### 7.1 dataState별 차트 동작

| dataState | 차트 표시 | 라벨 |
|---|---|---|
| `bootstrap` | 차트 영역에 spinner + "데이터 분석 중" | 진행률 표시 |
| `fresh-import` | 정상 표시 | "3년 / N개 활동 분석 완료" 라벨 |
| `cold` | 빈 차트 + 추정값 점선 | "PB 기준 추정. 14일 후 정확해집니다" |
| `warming` | 점선 stroke + 회색화 | "초기 데이터 (신뢰도 -20%)" |
| `normal` | 정상 표시 | — |

### 7.2 Empty state (데이터는 있으나 해당 종목/기간 비어있음)

- 차트 영역에 hairline border + ink-3 텍스트
- "이 종목의 PB Trail은 첫 기록 입력 후 표시됩니다"
- CTA: 입력 화면으로 가는 underlined link

---

## §8. Verdict 시각화

> SAFEGUARDS §2 매핑.

### 8.1 차트 위 verdict chip

차트 우상단에 verdict + confidence 표기 (필요한 경우).

```
§2 HR drift trend                    [RECOMMEND · 78%]
```

- CONFIRM: ok 색 underline
- RECOMMEND: brand 색 underline
- UNC: unc 색 underline
- LACK: warn 색 underline

### 8.2 Confidence < 50% (LACK) 시

- 차트 자체를 표시하되 **회색화 + "데이터 부족" 라벨**
- "필요한 데이터: RPE 14일 추가 입력" 같은 명시적 요청
- 사용자가 어떤 행동을 하면 풀리는지 표시

### 8.3 신호 충돌 (UNC) 시

- 두 데이터 line을 **동시 표시**
- "두 신호 충돌" tooltip
- Alternative view (예: Daniels는 -15%, A_guide는 -10%) 별도 카드

---

## §9. Comparison · Drill · Range 토글 컴포넌트

### 9.1 Range Switcher (시간축 차트용)

```
[ 4w ]  [ 8w ]  [ 12w ]  [ 1y ]  [ 2y ]  [ 3y ]  [ all ]
```

- 컴팩트 default: `4w / 12w / 1y` 만 표시
- 확장: 모든 옵션
- 컴포넌트 spec: `RangeSwitcher` (COMPONENT_INVENTORY §3.5 이미 존재)
- **Q4 확장성**: 컴포넌트는 임의의 range 배열을 prop으로 받도록 설계
  - `<RangeSwitcher options={['4w','8w','12w','1y','2y','3y','all']} default="1y" />`

### 9.2 Comparison Toggle

```
비교: [ none ]  [ 어제 ]  [ 지난주 ]  [ 지난 사이클 ]  [ 작년 ]
```

- 첫 옵션은 `none` (비교 끔)
- 한 번에 1개만 활성

### 9.3 Energy System Filter

```
보기: ● BA  ● LT  ● V2  ● GL  ● AP  ● RE
       (체크박스, default 모두 ON)
```

- 차트에서 특정 에너지 시스템만 보고 싶을 때
- 단계적 노출의 한 축: 클릭 가능 chip + 체크 상태

---

## §10. 접근성 (a11y)

### 10.1 Color contrast

- T1 strong 색은 흰 배경에 4.5:1 이상 (WCAG AA)
- T3 text 색은 흰 배경에 7:1 이상 (WCAG AAA — 본문이므로)
- T4 wash는 정보 전달이 아니라 컨텍스트만, 대비 검사 면제

### 10.2 색에 의존하지 않기

- 모든 차트 legend에 **2자 코드 동시 표시** (Q6)
- 차트 셀 hover 시 코드 노출
- Pattern 보조 (점선/실선/줄무늬)

### 10.3 Keyboard navigation

- 모든 차트 인터랙티브 요소(dot, bar, cell)는 `tabindex="0"`
- Enter/Space로 drill-down
- Arrow key로 인접 데이터 포인트 이동 (line/heatmap)

### 10.4 Screen reader

- 차트는 `<figure>` + `<figcaption>` 구조
- aria-label에 "차트: PB Trail, 5000m, 2023–2026"
- 데이터 테이블 fallback (sr-only) 제공

---

## §11. Responsive 규칙

### 11.1 브레이크포인트

| 폭 | 환경 |
|---|---|
| 360px | 모바일 (default) |
| 768px | 태블릿 |
| 1240px | 데스크톱 content |
| 1408px | 데스크톱 frame max |

### 11.2 차트별 모바일 변형

| 차트 | 모바일 | 데스크톱 |
|---|---|---|
| C-1 Energy stack | 100% width × 14px | 100% × 16px |
| C-2 Heatmap | 1Y default, range 토글로 확장 | 3Y 동시 표시 |
| C-3 PB Trail | 종목 토글 (한 종목씩) | 3개 동시 grid |
| C-4 CTL/ATL/TSB | line 단순화, hover X (tap만) | 모든 인터랙션 |
| C-7 Cycle rail | vertical list (10 row) | horizontal rail |

### 11.3 터치 타겟

- 모든 인터랙티브 마커 최소 **44×44px** 터치 영역 (시각적 dot은 4px여도 padding으로 확장)

---

## §12. 검증 매트릭스 — 새 차트 추가 시 체크

새 차트를 추가하거나 기존 차트를 수정할 때 통과해야 할 점검표.

| # | 체크 | 통과 기준 |
|---|---|---|
| 1 | Tier 명시 | T1/T2/T3/T4 중 어느 tier 사용? |
| 2 | 3중 인코딩 | 색 + 코드 + 위치/모양 중 컴팩트일 때 무엇을 노출? |
| 3 | 시간축 | X축이 시간인가? 아니라면 그 이유는? |
| 4 | Cold start | 5개 dataState 모두 정의됨? |
| 5 | Verdict | confidence 명시? <50% 동작 정의? |
| 6 | Narrative 안전 | 감정 평가 0개? "좋음/나쁨" 색 부여 0개? |
| 7 | Comparison | Comparison toggle 지원? |
| 8 | Drill-down | 숫자/마커 클릭 가능? |
| 9 | Range | 시간축 차트면 RangeSwitcher 통합? |
| 10 | a11y | 코드 표시, 키보드 가능, sr-only fallback? |
| 11 | 모바일 | 360px에서 작동? 터치 44px? |
| 12 | Tier 충돌 | T1+T4 동시 사용 X? T3 차트 안 사용 X? |

12개 다 통과해야 production 배포.

---

## §13. 미해결 / 추후 결정

- [ ] **MIXED(MX) 시각화 방식** (Q5 보류) — 두 시스템 50:50 줄무늬 임시 채택, SPRINT2_VisualizationSystem.html 작업 중 재검토
- [ ] Cohort 차트 (C-11) 활성 시점 — Pro 분리 결정과 연동
- [ ] Track Record 차트 — LLM 단계 진입 후 다시 검토
- [ ] Dark mode 시 Tier hex 보정값
- [ ] 종목 확장 (800m / 마라톤) 시 PB Trail 종목 토글 UI

---

## §14. 한 줄 결론

> **시각화는 사용자의 이야기를 시간 위에 펼치는 일이다.**
> **에너지 시스템 색은 그 이야기의 챕터를 1초에 알아보게 하는 글자이고,**
> **숫자·코드·위치는 5초·30초의 깊이를 만든다.**
> **모르면 모른다고, 후퇴했으면 후퇴한 대로, 부상했으면 부상한 대로 — 그대로 그린다.**
